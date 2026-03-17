const jwt = require('jsonwebtoken');
const Table = require('../pokergame/Table');
const Player = require('../pokergame/Player');
const {
  CS_FETCH_LOBBY_INFO,
  SC_RECEIVE_LOBBY_INFO,
  SC_PLAYERS_UPDATED,
  CS_JOIN_TABLE,
  SC_TABLE_JOINED,
  SC_TABLES_UPDATED,
  CS_LEAVE_TABLE,
  SC_TABLE_LEFT,
  CS_FOLD,
  CS_CHECK,
  CS_CALL,
  CS_RAISE,
  TABLE_MESSAGE,
  CS_SIT_DOWN,
  CS_REBUY,
  CS_STAND_UP,
  SITTING_OUT,
  SITTING_IN,
  CS_DISCONNECT,
  SC_TABLE_UPDATED,
  WINNER,
  CS_LOBBY_CONNECT,
  CS_LOBBY_DISCONNECT,
  SC_LOBBY_CONNECTED,
  SC_LOBBY_DISCONNECTED,
  SC_LOBBY_CHAT,
  CS_LOBBY_CHAT,
  // Blockchain integration events
  CS_JOIN_TABLE_BLOCKCHAIN,
  CS_LEAVE_TABLE_BLOCKCHAIN,
  SC_BLOCKCHAIN_STATUS,
  SC_BLOCKCHAIN_TX_STATUS,
  SC_BLOCKCHAIN_ERROR,
  SC_BLOCKCHAIN_SETTLEMENT,
  SC_BALANCE_SYNCED,
  // Player-signed contract events
  CS_CONTRACT_JOIN_SUCCESS,
  CS_CONTRACT_JOIN_FAILED,
  CS_CONTRACT_LEAVE_SUCCESS,
  CS_CONTRACT_LEAVE_FAILED,
  // Delegate (Server Proxy) events
  CS_SET_DELEGATE,
  SC_DELEGATE_SET,
  SC_DELEGATE_ERROR,
  CS_CHECK_DELEGATE,
  SC_DELEGATE_STATUS,
} = require('../pokergame/actions');
const config = require('../config');
const gameFlowIntegration = require('../services/GameFlowIntegration');
const contractService = require('../blockchain/ContractService');
const tronService = require('../blockchain/TronService');

const tables = {
  1: new Table(1, 'Table 1', config.INITIAL_CHIPS_AMOUNT),
};
const players = {};

function getCurrentPlayers() {
  return Object.values(players).map((player) => ({
    socketId: player.socketId,
    id: player.id,
    name: player.name,
  }));
}

function getCurrentTables() {
  return Object.values(tables).map((table) => ({
    id: table.id,
    name: table.name,
    limit: table.limit,
    maxPlayers: table.maxPlayers,
    currentNumberPlayers: table.players.length,
    smallBlind: table.minBet,
    bigBlind: table.minBet * 2,
  }));
}

const init = (socket, io) => {
  
  // Set up notification callback for blockchain events
  gameFlowIntegration.setNotificationCallback(socket.id, (event, data) => {
    socket.emit(event, data);
  });

  socket.on(CS_LOBBY_CONNECT, ({gameId, address, userInfo }) => {
    socket.join(gameId)
    io.to(gameId).emit(SC_LOBBY_CONNECTED, {address, userInfo})
    console.log( SC_LOBBY_CONNECTED , address, socket.id)
  })
  
  socket.on(CS_LOBBY_DISCONNECT, ({gameId, address, userInfo}) => {
    io.to(gameId).emit(SC_LOBBY_DISCONNECTED, {address, userInfo})
    console.log(CS_LOBBY_DISCONNECT, address, socket.id);
  })

  socket.on(CS_LOBBY_CHAT, ({ gameId, text, userInfo }) => {
    io.to(gameId).emit(SC_LOBBY_CHAT, {text, userInfo})
  })

  socket.on(CS_FETCH_LOBBY_INFO, async ({walletAddress, socketId, gameId, username}) => {

    const found = Object.values(players).find((player) => {
        return player.id == walletAddress;
      });

      if (found) {
        delete players[found.socketId];
        Object.values(tables).map((table) => {
          table.removePlayer(found.socketId);
          broadcastToTable(table);
        });
      }

      players[socketId] = new Player(
        socketId,
        walletAddress,
        username,
        config.INITIAL_CHIPS_AMOUNT,
      );

      // Task 15.5: Sync blockchain balance on player connect
      if (config.BLOCKCHAIN_ENABLED && walletAddress) {
        try {
          const blockchainBalance = await gameFlowIntegration.syncOnPlayerConnect(
            walletAddress, 
            socket.id
          );
          
          // Use blockchain balance if available
          // Rule a: bankroll = balance (don't subtract locked)
          if (blockchainBalance) {
            // Rule a: bankroll = balance
            const availableBalance = blockchainBalance.balance;
            players[socketId].bankroll = availableBalance;
            
            socket.emit(SC_BALANCE_SYNCED, {
              balance: blockchainBalance.balance,
              locked: blockchainBalance.lockedAmount,
              available: availableBalance
            });
          }
        } catch (error) {
          console.error('[Socket] Balance sync error:', error.message);
          // Continue with default balance
        }
      } else {
        console.warn('⚠️ [BLOCKCHAIN DISABLED] syncOnPlayerConnect - Blockchain is disabled, using default balance. Check BLOCKCHAIN_ENABLED in .env.local');
      }

      socket.emit(SC_RECEIVE_LOBBY_INFO, {
        tables: getCurrentTables(),
        players: getCurrentPlayers(),
        socketId: socket.id,
        amount: players[socketId].bankroll
      });
      socket.broadcast.emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
  });

  // Task 15.1: Join table with blockchain integration
  socket.on(CS_JOIN_TABLE, async (tableId) => {
    const table = tables[tableId];
    const player = players[socket.id];
    console.log("tableid====>", tableId, table, player)
    
    // Add player to table (local)
    table.addPlayer(player);
    socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId });
    socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
    
    // Find an empty seat (seats are 1-indexed)
    let emptySeatId = 1;
    for (let i = 1; i <= table.maxPlayers; i++) {
      if (!table.seats[i] || !table.seats[i].player) {
        emptySeatId = i;
        break;
      }
    }
    
    // Auto sit down
    await sitDown(tableId, emptySeatId, table.limit);

    if (
      tables[tableId].players &&
      tables[tableId].players.length > 0 &&
      player
    ) {
      let message = `${player.name} joined the table.`;
      broadcastToTable(table, message);
    }
  });

  // Blockchain-specific join table with explicit buy-in
  socket.on(CS_JOIN_TABLE_BLOCKCHAIN, async ({ tableId, buyInAmount }) => {
    const table = tables[tableId];
    const player = players[socket.id];
    
    console.log('[Socket] CS_JOIN_TABLE_BLOCKCHAIN:', { tableId, buyInAmount, player: player?.id });
    
    if (!player) {
      socket.emit(SC_BLOCKCHAIN_ERROR, {
        operation: 'joinTable',
        message: 'Player not found'
      });
      return;
    }

    // Validate buyInAmount - must be at least 20 big blinds
    const bigBlind = table.minBet * 2;
    const minBuyIn = bigBlind * 20; // Minimum 20 big blinds
    
    if (!buyInAmount || buyInAmount < minBuyIn) {
      console.warn('[Socket] Invalid buyInAmount:', buyInAmount, 'min required:', minBuyIn);
      socket.emit(SC_BLOCKCHAIN_ERROR, {
        operation: 'joinTable',
        message: `Buy-in must be at least ${minBuyIn} SUN (${minBuyIn / 1000000} TRX, 20 big blinds)`,
        required: minBuyIn,
        provided: buyInAmount || 0
      });
      return;
    }

    // Cap buyIn at table limit
    const cappedBuyIn = Math.min(buyInAmount, table.limit);
    
    if (config.BLOCKCHAIN_ENABLED) {
      try {
        // Check if player has authorized this server as delegate
        const serverAddress = tronService.getSignerAddress();
        const isAuthorized = await contractService.isAuthorizedDelegate(player.id, serverAddress);
        
        console.log('[Socket] Delegate check:', { player: player.id, server: serverAddress, isAuthorized });
        
        if (!isAuthorized) {
          // Player needs to authorize the server first
          socket.emit(SC_DELEGATE_ERROR, {
            message: '请先授权服务器代理操作。点击"授权服务器"按钮。',
            serverAddress: serverAddress,
            needAuthorization: true
          });
          return;
        }
        
        // Use server proxy join (joinTableFor)
        console.log('[Socket] Calling joinTableFor via server...');
        const result = await contractService.joinTableFor(player.id, tableId, cappedBuyIn);
        console.log('[Socket] joinTableFor result:', result);
        
        // Add player to table after successful blockchain operation
        table.addPlayer(player);
        socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId, txId: result.tx });
        socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
        
        // Find an empty seat (seats are 1-indexed)
        let emptySeatId = 1;
        for (let i = 1; i <= table.maxPlayers; i++) {
          if (!table.seats[i] || !table.seats[i].player) {
            emptySeatId = i;
            break;
          }
        }
        
        console.log('[Socket] Sitting down at seat:', emptySeatId);

        // Update balance cache BEFORE sitDown so validation passes
        gameFlowIntegration.updatePlayerBalanceCache(player.id, -cappedBuyIn, cappedBuyIn);

        // Sit down with the buy-in amount
        await sitDown(tableId, emptySeatId, cappedBuyIn);
        
        // Sync balance from contract
        const freshBalance = await contractService.getPlayerInfo(player.id);
        player.bankroll = freshBalance.balance;
        
        // Notify player about balance update
        socket.emit(SC_BALANCE_SYNCED, {
          balance: freshBalance.balance,
          locked: freshBalance.lockedAmount,
          available: freshBalance.balance,
          reason: 'join_table'
        });
        
        let message = `${player.name} joined the table.`;
        broadcastToTable(table, message);
        
      } catch (error) {
        console.error('[Socket] Join table error:', error);
        gameFlowIntegration.handleBlockchainError(error, 'joinTable', socket.id);
      }
    } else {
      console.warn('⚠️ [BLOCKCHAIN DISABLED] handleJoinTable - No blockchain transaction. Check BLOCKCHAIN_ENABLED in .env.local');
      // Non-blockchain mode - use default behavior
      table.addPlayer(player);
      socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId });
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      await sitDown(tableId, table.players.length - 1, table.limit);
      
      let message = `${player.name} joined the table.`;
      broadcastToTable(table, message);
    }
  });

  // Task 15.2: Leave table with blockchain integration
  socket.on(CS_LEAVE_TABLE, async (tableId) => {
    const table = tables[tableId];
    const player = players[socket.id];
    const seat = Object.values(table.seats).find(
      (seat) => seat && seat.player.socketId === socket.id,
    );

    // IMPORTANT: Save seat info BEFORE any modifications
    // This ensures we have the data needed for blockchain leave
    const savedSeatStack = seat?.stack || 0;
    const savedPlayerId = player?.id;

    console.log('[Socket] ========== LEAVE TABLE START ==========');
    console.log('[Socket] Player:', player?.name, savedPlayerId);
    console.log('[Socket] Before leave - Bankroll:', player?.bankroll);
    console.log('[Socket] Seat stack (saved):', savedSeatStack);

    if (seat && player) {
      const oldBankroll = player.bankroll;
      updatePlayerBankroll(player, seat.stack);
      console.log('[Socket] After updatePlayerBankroll - Bankroll:', player.bankroll, `(${oldBankroll} + ${seat.stack})`);
    }

    // Task 15.2: Blockchain leave table
    // IMPORTANT: Always call blockchain leave if enabled and player exists
    // This ensures lockedAmount is properly released
    console.log('[Socket] ========== BLOCKCHAIN LEAVE CHECK ==========');
    console.log('[Socket] BLOCKCHAIN_ENABLED:', config.BLOCKCHAIN_ENABLED);
    console.log('[Socket] Player ID:', savedPlayerId);
    console.log('[Socket] Saved seat stack:', savedSeatStack);

    if (config.BLOCKCHAIN_ENABLED && savedPlayerId) {
      try {
        console.log('[Socket] Calling blockchain leaveTable with stack:', savedSeatStack);
        await gameFlowIntegration.handleLeaveTable(
          savedPlayerId,
          tableId,
          socket.id,
          savedSeatStack,
          player?.bankroll || 0  // Pass current bankroll for logging
        );
        console.log('[Socket] ✅ Blockchain leaveTable success');
      } catch (error) {
        // Log error but continue with local leave
        console.error('[Socket] ❌ Blockchain leave table error:', error.message);
        console.error('[Socket] ❌ Error stack:', error.stack);
      }
    } else {
      if (!config.BLOCKCHAIN_ENABLED) {
        console.warn('⚠️ [BLOCKCHAIN DISABLED] handleLeaveTable - No blockchain transaction. Check BLOCKCHAIN_ENABLED in .env.local');
      } else {
        console.log('[Socket] Skipping blockchain leaveTable (no player)');
      }
    }
    console.log('[Socket] ============================================');

    table.removePlayer(socket.id);
    console.log('[Socket] Player removed from table');
    console.log('[Socket] Final bankroll:', player?.bankroll);
    console.log('[Socket] ========== LEAVE TABLE END ==========');

    socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
    socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });

    // Broadcast updated player list so everyone sees the balance change
    io.emit(SC_PLAYERS_UPDATED, getCurrentPlayers());

    if (
      tables[tableId].players &&
      tables[tableId].players.length > 0 &&
      player
    ) {
      let message = `${player.name} left the table.`;
      broadcastToTable(table, message);
    }

    if (table.activePlayers().length === 1) {
      clearForOnePlayer(table);
    }
  });

  // Blockchain-specific leave table
  socket.on(CS_LEAVE_TABLE_BLOCKCHAIN, async ({ tableId }) => {
    const table = tables[tableId];
    const player = players[socket.id];
    
    if (!player) {
      socket.emit(SC_BLOCKCHAIN_ERROR, {
        operation: 'leaveTable',
        message: 'Player not found'
      });
      return;
    }

    const seat = Object.values(table.seats).find(
      (seat) => seat && seat.player.socketId === socket.id,
    );

    if (config.BLOCKCHAIN_ENABLED) {
      try {
        // Check if player has authorized this server as delegate
        const serverAddress = tronService.getSignerAddress();
        const isAuthorized = await contractService.isAuthorizedDelegate(player.id, serverAddress);
        
        console.log('[Socket] Leave delegate check:', { player: player.id, server: serverAddress, isAuthorized });
        
        const stack = seat?.stack || 0;
        
        if (isAuthorized) {
          // Use server proxy leave (leaveTableFor)
          console.log('[Socket] Calling leaveTableFor via server...');
          const result = await contractService.leaveTableFor(player.id, tableId, stack);
          console.log('[Socket] leaveTableFor txId:', result.tx);

          // Optimistically update local cache: locked=0, balance += stack
          gameFlowIntegration.updatePlayerBalanceCache(player.id, stack, -stack);

          // Notify player with optimistic balance (EventListener will sync real value later)
          const cachedBalance = gameFlowIntegration.getPlayerBalanceCache(player.id);
          socket.emit(SC_BALANCE_SYNCED, {
            balance: cachedBalance?.balance || player.bankroll,
            locked: 0,
            available: cachedBalance?.balance || player.bankroll,
            reason: 'leave_table'
          });

          table.removePlayer(socket.id);
          socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
          socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });

          let message = `${player.name} left the table.`;
          broadcastToTable(table, message);

          if (table.activePlayers().length === 1) {
            clearForOnePlayer(table);
          }
        } else {
          // Delegate not authorized - ask frontend to sign leaveTableSession directly
          console.log('[Socket] Delegate not authorized, requesting player-signed leave');
          socket.emit('SC_REQUEST_PLAYER_LEAVE', { tableId, stack });
          // Do NOT remove player from table yet - wait for CS_CONTRACT_LEAVE_SUCCESS
          return;
        }
        
      } catch (error) {
        console.error('[Socket] Leave table error:', error);
        gameFlowIntegration.handleBlockchainError(error, 'leaveTable', socket.id);
        
        // Still remove player from table locally
        if (seat) {
          updatePlayerBankroll(player, seat.stack);
        }
        table.removePlayer(socket.id);
        socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
        socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });
      }
    } else {
      console.warn('⚠️ [BLOCKCHAIN DISABLED] CS_LEAVE_TABLE_BLOCKCHAIN - No blockchain transaction. Check BLOCKCHAIN_ENABLED in .env.local');
      // Non-blockchain mode - standard leave
      if (seat && player) {
        updatePlayerBankroll(player, seat.stack);
      }
      table.removePlayer(socket.id);
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });
      
      if (player) {
        let message = `${player.name} left the table.`;
        broadcastToTable(table, message);
      }
      
      if (table.activePlayers().length === 1) {
        clearForOnePlayer(table);
      }
    }
  });

  // ============ Delegate (Server Proxy) Event Handlers ============
  
  /**
   * Check delegate authorization status
   * @param {object} data - Optional data with walletAddress (for Landing page before full registration)
   */
  socket.on(CS_CHECK_DELEGATE, async (data) => {
    // Get walletAddress from data or from registered players
    const walletAddress = data?.walletAddress || players[socket.id]?.id;
    
    if (!walletAddress) {
      socket.emit(SC_DELEGATE_STATUS, {
        isAuthorized: false,
        error: 'No wallet address provided'
      });
      return;
    }

    try {
      const serverAddress = tronService.getSignerAddress();
      const isAuthorized = await contractService.isAuthorizedDelegate(walletAddress, serverAddress);
      const currentDelegate = await contractService.getPlayerDelegate(walletAddress);
      
      console.log('[Socket] CS_CHECK_DELEGATE:', {
        player: walletAddress,
        server: serverAddress,
        isAuthorized,
        currentDelegate
      });
      
      socket.emit(SC_DELEGATE_STATUS, {
        isAuthorized,
        serverAddress,
        currentDelegate,
        playerAddress: walletAddress
      });
    } catch (error) {
      console.error('[Socket] Error checking delegate:', error.message);
      socket.emit(SC_DELEGATE_STATUS, {
        isAuthorized: false,
        error: error.message,
        serverAddress: tronService.getSignerAddress() // Still send server address for reference
      });
    }
  });
  
  /**
   * Handle setDelegate success from frontend (player signed the transaction)
   */
  socket.on(CS_SET_DELEGATE, async ({ delegateAddress, txId }) => {
    const player = players[socket.id];
    
    console.log('[Socket] CS_SET_DELEGATE:', { delegateAddress, txId, player: player?.id });
    
    if (!player) {
      socket.emit(SC_DELEGATE_ERROR, {
        message: 'Player not found'
      });
      return;
    }
    
    try {
      // Verify the delegate is set correctly
      const currentDelegate = await contractService.getPlayerDelegate(player.id);
      
      if (currentDelegate && currentDelegate.toLowerCase() === delegateAddress.toLowerCase()) {
        socket.emit(SC_DELEGATE_SET, {
          success: true,
          delegateAddress,
          txId
        });
        console.log('[Socket] ✅ Delegate successfully set for player:', player.id);
      } else {
        socket.emit(SC_DELEGATE_ERROR, {
          message: 'Delegate verification failed',
          expected: delegateAddress,
          actual: currentDelegate
        });
      }
    } catch (error) {
      console.error('[Socket] Error verifying delegate:', error.message);
      socket.emit(SC_DELEGATE_ERROR, {
        message: error.message
      });
    }
  });

  // ============ Player-Signed Contract Events ============
  // These events are emitted by the frontend AFTER the player has successfully
  // called the contract directly (signing with their own wallet)

  /**
   * Handle successful contract joinTable call from frontend
   * Player has already signed and the contract call succeeded
   */
  socket.on(CS_CONTRACT_JOIN_SUCCESS, async ({ tableId, buyInAmount, txId }) => {
    const table = tables[tableId];
    const player = players[socket.id];
    
    console.log('[Socket] CS_CONTRACT_JOIN_SUCCESS:', { tableId, buyInAmount, txId, player: player?.id });
    
    if (!player) {
      console.error('[Socket] Player not found for CS_CONTRACT_JOIN_SUCCESS');
      return;
    }

    // Cap buyIn at table limit
    const cappedBuyIn = Math.min(buyInAmount, table.limit);
    
    try {
      // Update local cache
      const cached = gameFlowIntegration.getPlayerBalanceCache(player.id);
      if (cached) {
        gameFlowIntegration.updatePlayerBalanceCache(player.id, 0, cappedBuyIn);
      }
      
      // Sync balance from contract
      if (config.BLOCKCHAIN_ENABLED) {
        try {
          await gameFlowIntegration.syncPlayerBalance(player.id);
        } catch (e) {
          console.warn('[Socket] Failed to sync balance from contract:', e.message);
        }
      }
      
      // Add player to table
      table.addPlayer(player);
      socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId, txId });
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      
      // Find an empty seat (seats are 1-indexed)
      let emptySeatId = 1;
      for (let i = 1; i <= table.maxPlayers; i++) {
        if (!table.seats[i] || !table.seats[i].player) {
          emptySeatId = i;
          break;
        }
      }
      
      console.log('[Socket] Sitting down at seat:', emptySeatId);
      
      // Sit down with the buy-in amount
      await sitDown(tableId, emptySeatId, cappedBuyIn);
      
      let message = `${player.name} joined the table.`;
      broadcastToTable(table, message);
      
    } catch (error) {
      console.error('[Socket] Error processing CS_CONTRACT_JOIN_SUCCESS:', error);
    }
  });

  /**
   * Handle failed contract joinTable call from frontend
   */
  socket.on(CS_CONTRACT_JOIN_FAILED, ({ tableId, buyInAmount, error }) => {
    console.error('[Socket] CS_CONTRACT_JOIN_FAILED:', { tableId, buyInAmount, error });
    
    // Notify the player about the failure
    socket.emit(SC_BLOCKCHAIN_ERROR, {
      operation: 'joinTable',
      message: error || 'Contract call failed',
      tableId,
      buyInAmount
    });
  });

  /**
   * Handle successful contract leaveTableSession call from frontend
   * Player has already signed and the contract call succeeded
   */
  socket.on(CS_CONTRACT_LEAVE_SUCCESS, async ({ tableId, stack, txId }) => {
    const table = tables[tableId];
    const player = players[socket.id];
    
    console.log('[Socket] CS_CONTRACT_LEAVE_SUCCESS:', { tableId, stack, txId, player: player?.id });
    
    if (!player) {
      console.error('[Socket] Player not found for CS_CONTRACT_LEAVE_SUCCESS');
      return;
    }

    const seat = Object.values(table.seats).find(
      (seat) => seat && seat.player.socketId === socket.id,
    );

    try {
      // Sync balance from contract (this is the source of truth)
      if (config.BLOCKCHAIN_ENABLED) {
        try {
          const freshBalance = await gameFlowIntegration.syncPlayerBalance(player.id);
          
          // Notify player about synced balance
          socket.emit(SC_BALANCE_SYNCED, {
            balance: freshBalance.balance,
            locked: freshBalance.lockedAmount,
            available: freshBalance.balance,
            reason: 'leave_table'
          });
          
          // Update player bankroll from contract
          player.bankroll = freshBalance.balance;
        } catch (e) {
          console.warn('[Socket] Failed to sync balance from contract:', e.message);
          // Fallback: use the stack value from frontend
          if (seat) {
            player.bankroll += seat.stack;
          }
        }
      } else {
        // Non-blockchain mode: just add stack to bankroll
        if (seat) {
          player.bankroll += seat.stack;
        }
      }
      
      // Remove player from table
      table.removePlayer(socket.id);
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });
      
      // Broadcast updated player list
      io.emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
      
      let message = `${player.name} left the table.`;
      broadcastToTable(table, message);
      
      if (table.activePlayers().length === 1) {
        clearForOnePlayer(table);
      }
      
    } catch (error) {
      console.error('[Socket] Error processing CS_CONTRACT_LEAVE_SUCCESS:', error);
    }
  });

  /**
   * Handle failed contract leaveTableSession call from frontend
   */
  socket.on(CS_CONTRACT_LEAVE_FAILED, ({ tableId, stack, error }) => {
    console.error('[Socket] CS_CONTRACT_LEAVE_FAILED:', { tableId, stack, error });
    
    const table = tables[tableId];
    const player = players[socket.id];
    
    // Still remove player from table locally
    if (player) {
      const seat = Object.values(table.seats).find(
        (seat) => seat && seat.player.socketId === socket.id,
      );
      
      if (seat) {
        updatePlayerBankroll(player, seat.stack);
      }
      
      table.removePlayer(socket.id);
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });
      
      let message = `${player.name} left the table (blockchain sync pending).`;
      broadcastToTable(table, message);
      
      if (table.activePlayers().length === 1) {
        clearForOnePlayer(table);
      }
    }
    
    // Notify the player about the failure
    socket.emit(SC_BLOCKCHAIN_ERROR, {
      operation: 'leaveTable',
      message: error || 'Contract call failed. Your balance will be synced later.',
      tableId
    });
  });

  socket.on(CS_FOLD, (tableId) => {
    console.log('[Socket] CS_FOLD received from', socket.id, 'for table', tableId);
    let table = tables[tableId];
    let res = table.handleFold(socket.id);
    console.log('[Socket] handleFold result:', res);
    res && broadcastToTable(table, res.message);
    res && changeTurnAndBroadcast(table, res.seatId);
  });

  socket.on(CS_CHECK, (tableId) => {
    console.log('[Socket] CS_CHECK received from', socket.id, 'for table', tableId);
    let table = tables[tableId];
    let res = table.handleCheck(socket.id);
    console.log('[Socket] handleCheck result:', res);
    res && broadcastToTable(table, res.message);
    res && changeTurnAndBroadcast(table, res.seatId);
  });

  socket.on(CS_CALL, (tableId) => {
    console.log('[Socket] CS_CALL received from', socket.id, 'for table', tableId);
    let table = tables[tableId];
    let res = table.handleCall(socket.id);
    console.log('[Socket] handleCall result:', res);
    res && broadcastToTable(table, res.message);
    res && changeTurnAndBroadcast(table, res.seatId);
  });

  socket.on(CS_RAISE, ({ tableId, amount }) => {
    console.log('[Socket] CS_RAISE received from', socket.id, 'for table', tableId, 'amount:', amount);
    let table = tables[tableId];
    let res = table.handleRaise(socket.id, amount);
    console.log('[Socket] handleRaise result:', res);
    res && broadcastToTable(table, res.message);
    res && changeTurnAndBroadcast(table, res.seatId);
  });

  socket.on(TABLE_MESSAGE, ({ message, from, tableId }) => {
    let table = tables[tableId];
    broadcastToTable(table, message, from);
  });

  // Task 15.3: Sit down with balance validation
  const sitDown = async (tableId, seatId, amount) => {
    const table = tables[tableId];
    const player = players[socket.id];
    
    console.log('[Socket] sitDown called:', { tableId, seatId, amount, player: player?.id });
    
    if (player) {
      // Task 15.3: Validate contract balance before sitting down
      if (config.BLOCKCHAIN_ENABLED) {
        try {
          console.log('[Socket] Validating balance for sitDown...');
          
          // Check if player is already at any table
          const isPlayerAtTable = Object.values(tables).some(t => 
            Object.values(t.seats).some(seat => seat && seat.player && seat.player.socketId === socket.id)
          );
          
          // Add timeout to prevent blocking
          const validation = await Promise.race([
            gameFlowIntegration.validateBalanceForSitDown(player.id, amount, isPlayerAtTable),
            new Promise((resolve) => 
              setTimeout(() => resolve({ valid: false, message: 'Validation timeout' }), 3000)
            )
          ]);
          
          console.log('[Socket] Validation result:', validation);
          
          if (!validation.valid) {
            // Task 15.7: Notify player about insufficient balance
            console.warn('[Socket] Validation failed:', validation.message);
            socket.emit(SC_BLOCKCHAIN_ERROR, {
              operation: 'sitDown',
              message: validation.message,
              available: validation.available,
              required: validation.required
            });
            return;
          }
          
          // Task 15.7: Send transaction status
          gameFlowIntegration.sendTransactionStatus(socket.id, 'sitDown', 'confirmed', {
            seatId,
            amount,
            available: validation.available
          });
          
        } catch (error) {
          console.error('[Socket] Balance validation error:', error.message);
          // Continue in non-blockchain mode
        }
      } else {
        console.warn('⚠️ [BLOCKCHAIN DISABLED] validateBalanceForSitDown - No blockchain validation. Check BLOCKCHAIN_ENABLED in .env.local');
      }
      
      console.log('[Socket] Calling table.sitPlayer...');
      table.sitPlayer(player, seatId, amount);
      let message = `${player.name} sat down in Seat ${seatId}`;

      // Note: In blockchain mode, bankroll is managed by blockchain cache
      // The updatePlayerBankroll call was causing double deduction
      // bankroll should reflect: contractBalance - lockedBalance
      if (!config.BLOCKCHAIN_ENABLED) {
        updatePlayerBankroll(player, -amount);
      }

      broadcastToTable(table, message);
      console.log('[Socket] Active players:', table.activePlayers().length);
      if (table.activePlayers().length === 2) {
        initNewHand(table);
      }
    } else {
      console.error('[Socket] sitDown: Player not found');
    }
  }

  socket.on(CS_SIT_DOWN, async ({ tableId, seatId, amount }) => {
    await sitDown(tableId, seatId, amount);
  });

  // Rule f: Rebuy from balance (not from locked)
  // Rebuy: balance -= amount, locked += amount, stack += amount
  socket.on(CS_REBUY, async ({ tableId, seatId, amount }) => {
    const table = tables[tableId];
    const player = players[socket.id];

    console.log('[Socket] CS_REBUY received:', { tableId, seatId, amount, player: player?.id });

    if (!player) {
      socket.emit(SC_BLOCKCHAIN_ERROR, {
        operation: 'rebuy',
        message: 'Player not found'
      });
      return;
    }

    // Rule f: Check if player has enough balance for rebuy
    // Balance (not locked) is used for rebuy
    if (config.BLOCKCHAIN_ENABLED) {
      try {
        const cachedBalance = gameFlowIntegration.getPlayerBalanceCache(player.id);
        const availableBalance = cachedBalance ? cachedBalance.balance : player.bankroll;
        
        console.log(`[Socket] Rebuy validation: availableBalance=${availableBalance}, amount=${amount}`);
        
        if (availableBalance < amount) {
          socket.emit(SC_BLOCKCHAIN_ERROR, {
            operation: 'rebuy',
            message: `Insufficient balance for rebuy. Available: ${availableBalance / 1e6} TRX, Required: ${amount / 1e6} TRX`,
            available: availableBalance,
            required: amount
          });
          return;
        }

        // Rule f: Rebuy from balance
        // balance -= amount, locked += amount, stack += amount
        gameFlowIntegration.updatePlayerBalanceCache(player.id, -amount, amount);
        
        // Update local player bankroll
        player.bankroll -= amount;

        console.log(`[Socket] Rebuy executed: player ${player.name}`);
        console.log(`[Socket]   balance decreased by ${amount}`);
        console.log(`[Socket]   locked increased by ${amount}`);
        console.log(`[Socket]   stack will increase by ${amount}`);

      } catch (error) {
        console.error('[Socket] Rebuy error:', error.message);
        socket.emit(SC_BLOCKCHAIN_ERROR, {
          operation: 'rebuy',
          message: error.message
        });
        return;
      }
    } else {
      // Non-blockchain mode
      updatePlayerBankroll(player, -amount);
    }

    // Execute rebuy in table (updates stack)
    table.rebuyPlayer(seatId, amount);

    // Notify player about balance update
    const updatedCache = gameFlowIntegration.getPlayerBalanceCache(player.id);
    if (updatedCache) {
      socket.emit(SC_BALANCE_SYNCED, {
        balance: updatedCache.balance,
        locked: updatedCache.lockedAmount,
        available: updatedCache.balance,
        reason: 'rebuy',
        amount: -amount
      });
    }

    broadcastToTable(table);
  });

  socket.on(CS_STAND_UP, (tableId) => {
    const table = tables[tableId];
    const player = players[socket.id];
    const seat = Object.values(table.seats).find(
      (seat) => seat && seat.player.socketId === socket.id,
    );

    let message = '';
    if (seat) {
      updatePlayerBankroll(player, seat.stack);
      message = `${player.name} left the table`;
    }

    table.standPlayer(socket.id);

    broadcastToTable(table, message);
    if (table.activePlayers().length === 1) {
      clearForOnePlayer(table);
    }
  });

  socket.on(SITTING_OUT, ({ tableId, seatId }) => {
    const table = tables[tableId];
    const seat = table.seats[seatId];
    seat.sittingOut = true;

    broadcastToTable(table);
  });

  socket.on(SITTING_IN, ({ tableId, seatId }) => {
    const table = tables[tableId];
    const seat = table.seats[seatId];
    seat.sittingOut = false;

    broadcastToTable(table);
    if (table.handOver && table.activePlayers().length === 2) {
      initNewHand(table);
    }
  });

  socket.on(CS_DISCONNECT, () => {
    const seat = findSeatBySocketId(socket.id);
    if (seat) {
      updatePlayerBankroll(seat.player, seat.stack);
    }

    // Clean up notification callback
    gameFlowIntegration.removeNotificationCallback(socket.id);

    delete players[socket.id];
    removeFromTables(socket.id);

    socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
    socket.broadcast.emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
  });

  async function updatePlayerBankroll(player, amount) {
    if (!player) return;
    player.bankroll += amount;
    io.to(player.socketId).emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
  }

  function findSeatBySocketId(socketId) {
    let foundSeat = null;
    Object.values(tables).forEach((table) => {
      Object.values(table.seats).forEach((seat) => {
        if (seat && seat.player.socketId === socketId) {
          foundSeat = seat;
        }
      });
    });
    return foundSeat;
  }
 
  function removeFromTables(socketId) {
    for (let i = 0; i < Object.keys(tables).length; i++) {
      tables[Object.keys(tables)[i]].removePlayer(socketId);
    }
  }

  function broadcastToTable(table, message = null, from = null) {
    for (let i = 0; i < table.players.length; i++) {
      let socketId = table.players[i].socketId;
      let tableCopy = hideOpponentCards(table, socketId);
      io.to(socketId).emit(SC_TABLE_UPDATED, {
        table: tableCopy,
        message,
        from,
      });
    }
  }

  function changeTurnAndBroadcast(table, seatId) {
    console.log('[Socket] ========== changeTurnAndBroadcast ==========');
    console.log('[Socket] seatId:', seatId, 'handOver:', table.handOver);
    console.log('[Socket] board length:', table.board.length);
    console.log('[Socket] current turn:', table.turn);
    console.log('[Socket] callAmount:', table.callAmount);

    // Log all seats status
    for (let i = 1; i <= table.maxPlayers; i++) {
      const seat = table.seats[i];
      if (seat && seat.player) {
        console.log(`[Socket] Seat ${i}: ${seat.player.name}, bet=${seat.bet}, stack=${seat.stack}, folded=${seat.folded}, checked=${seat.checked}, lastAction=${seat.lastAction}`);
      }
    }

    setTimeout(async () => {
      table.changeTurn(seatId);
      console.log('[Socket] After changeTurn:');
      console.log('[Socket] handOver:', table.handOver);
      console.log('[Socket] board length:', table.board.length);
      console.log('[Socket] board:', table.board.map(c => `${c.rank}${c.suit}`));
      console.log('[Socket] winMessages:', table.winMessages);

      broadcastToTable(table);

      if (table.handOver) {
        console.log('[Socket] Hand is over, calling handleGameEnd...');
        // Handle game end (settlement and balance updates) before starting new hand
        await handleGameEnd(table);
        initNewHand(table);
      }
    }, 1000);
  }

  // Track stack before each hand for session mode settlement
  const stackBeforeHand = new Map();

  // Modified to include blockchain settlement
  async function initNewHand(table) {
    console.log('[Socket] initNewHand called, active players:', table.activePlayers().length);
    if (table.activePlayers().length > 1) {
      broadcastToTable(table, '---New hand starting in 5 seconds---');
    }
    setTimeout(() => {
      table.clearWinMessages();
      table.startHand();
      
      // Record stack before hand for session mode settlement
      stackBeforeHand.clear();
      for (const seatId of Object.keys(table.seats)) {
        const seat = table.seats[seatId];
        if (seat && seat.player && seat.stack !== undefined) {
          stackBeforeHand.set(seat.player.id, seat.stack);
          console.log(`[Socket] Recorded stack before hand: ${seat.player.name} = ${seat.stack}`);
        }
      }
      
      console.log('[Socket] After startHand:');
      console.log('[Socket] board length:', table.board.length);
      console.log('[Socket] turn:', table.turn);
      console.log('[Socket] button:', table.button);
      console.log('[Socket] smallBlind:', table.smallBlind);
      console.log('[Socket] bigBlind:', table.bigBlind);
      console.log('[Socket] callAmount:', table.callAmount);

      // Log seat hands
      for (let i = 1; i <= table.maxPlayers; i++) {
        const seat = table.seats[i];
        if (seat && seat.player && seat.hand) {
          console.log(`[Socket] Seat ${i} hand:`, seat.hand.map(c => `${c.rank}${c.suit}`));
        }
      }

      broadcastToTable(table, '--- New hand started ---');
    }, 5000);
  }

  // Task 15.4: Handle game end with settlement and balance updates
  // Rule j: Session mode - settleGame only updates stack, locked unchanged
  // Final settlement happens when player leaves table (leaveTable)
  async function handleGameEnd(table) {
    console.log('[Socket] handleGameEnd called (Session Mode)');
    console.log('[Socket] winMessages:', table.winMessages);
    console.log('[Socket] table.seats:', Object.keys(table.seats).filter(id => table.seats[id]?.player).map(id => ({
      seatId: id,
      playerName: table.seats[id]?.player?.name,
      playerId: table.seats[id]?.player?.id,
      socketId: table.seats[id]?.player?.socketId,
      stack: table.seats[id]?.stack
    })));

    // Convert table result to settlement format
    // Pass global players registry so we can find winners even if they left the table
    const settlementData = gameFlowIntegration.convertTableResultToSettlement(
      table,
      table.winMessages,
      players  // Pass global players registry for fallback lookup
    );

    console.log('[Socket] Settlement data winners:', settlementData.winners);

    // Collect stack changes for session mode settlement
    const playerStacks = [];

    // Rule d: During game, only stack changes, locked stays unchanged
    // Rule j: Session mode - don't update locked, only update local stack
    if (settlementData.winners.length > 0) {
      for (const winner of settlementData.winners) {
        // Find the player by address in global players registry
        const playerEntry = Object.entries(players).find(
          ([_, p]) => p.id === winner.address
        );

        console.log(`[Socket] Looking for winner ${winner.address} in players registry...`);
        
        if (playerEntry) {
          const [socketId, player] = playerEntry;
          // Rule d: Don't update player.bankroll during game (only stack changes)
          // The winner's stack is already updated in Table.determineWinner
          // We just need to update the cache balance for tracking purposes
          console.log(`[Socket] Winner ${player.name} won ${winner.amount}. Stack already updated in game logic.`);

          // Update cache: balance increases (winner gets amount), locked stays same
          // This is for tracking purposes - actual locked is settled on leaveTable
          gameFlowIntegration.updatePlayerBalanceCache(winner.address, winner.amount, 0);

          // Collect stack info for session settlement
          const stackBefore = stackBeforeHand.get(winner.address) || 0;
          // Find current stack from table seats
          let stackAfter = stackBefore;
          for (const seatId of Object.keys(table.seats)) {
            const seat = table.seats[seatId];
            if (seat && seat.player && seat.player.id === winner.address) {
              stackAfter = seat.stack;
              break;
            }
          }
          playerStacks.push({
            address: winner.address,
            stackBefore,
            stackAfter
          });

          // Notify client about balance update (for display purposes)
          io.to(socketId).emit(SC_BALANCE_SYNCED, {
            balance: player.bankroll,
            locked: gameFlowIntegration.getPlayerBalanceCache(winner.address)?.lockedAmount || 0,
            available: player.bankroll,
            reason: 'game_won',
            amount: winner.amount
          });
        } else {
          console.warn(`[Socket] Winner player not found for address: ${winner.address}`);
          // Player might have disconnected, but we should still track the win
          gameFlowIntegration.updatePlayerBalanceCache(winner.address, winner.amount, 0);
        }
      }

      // Also collect non-winner players' stack changes
      for (const seatId of Object.keys(table.seats)) {
        const seat = table.seats[seatId];
        if (seat && seat.player && seat.stack !== undefined) {
          const address = seat.player.id;
          // Check if already added
          if (!playerStacks.find(p => p.address === address)) {
            const stackBefore = stackBeforeHand.get(address) || 0;
            playerStacks.push({
              address,
              stackBefore,
              stackAfter: seat.stack
            });
          }
        }
      }

      // Rule j: Session mode - don't update locked after each hand
      // Locked will be settled when player leaves table
      // Stack is already managed by the game engine (Table.js)

      // Broadcast updated table state so all players see updated stacks
      broadcastToTable(table);
    }

    // Clear stack tracking for next hand
    stackBeforeHand.clear();

    // Only do blockchain settlement if enabled
    if (!config.BLOCKCHAIN_ENABLED) {
      console.warn('⚠️ [BLOCKCHAIN DISABLED] handleGameSettlement - No on-chain settlement. Check BLOCKCHAIN_ENABLED in .env.local');
      return;
    }

    console.log('[Socket] ========== BLOCKCHAIN SETTLEMENT (Session Mode) ==========');
    console.log('[Socket] Session mode: Stack updated locally, final settlement on leaveTable');
    console.log('[Socket] Player stacks for settlement:', playerStacks);

    // TEMPORARY FIX: Skip on-chain settlement per hand to avoid REVERT errors
    // Stack is already updated locally in game logic
    // Final settlement will happen when player leaves table (leaveTableFor)
    console.log('[Socket] ⚠️ Skipping on-chain settlement per hand (will settle on leaveTable)');
    console.log('[Socket] ============================================');
  }

  function clearForOnePlayer(table) {
    table.clearWinMessages();
    setTimeout(() => {
      table.clearSeatHands();
      table.resetBoardAndPot();
      broadcastToTable(table, 'Waiting for more players');
    }, 5000);
  }

  function hideOpponentCards(table, socketId) {
    let tableCopy = JSON.parse(JSON.stringify(table));
    let hiddenCard = { suit: 'hidden', rank: 'hidden' };
    let hiddenHand = [hiddenCard, hiddenCard];

    for (let i = 1; i <= tableCopy.maxPlayers; i++) {
      let seat = tableCopy.seats[i];
      if (
        seat &&
        seat.hand.length > 0 &&
        seat.player.socketId !== socketId &&
        !(seat.lastAction === WINNER && tableCopy.wentToShowdown)
      ) {
        seat.hand = hiddenHand;
      }
    }
    return tableCopy;
  }
};


module.exports = { init };
