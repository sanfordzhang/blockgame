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
} = require('../pokergame/actions');
const config = require('../config');
const gameFlowIntegration = require('../services/GameFlowIntegration');
const contractService = require('../blockchain/ContractService');

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
          if (blockchainBalance) {
            const availableBalance = blockchainBalance.balance - blockchainBalance.lockedAmount;
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
        // Task 15.1: Call blockchain integration
        const result = await gameFlowIntegration.handleJoinTable(
          player.id,
          tableId,
          cappedBuyIn,
          socket.id,
          player.bankroll  // Pass current bankroll for logging
        );
        
        console.log('[Socket] handleJoinTable result:', result);
        
        // Add player to table after successful blockchain operation
        table.addPlayer(player);
        socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId, txId: result.txId });
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
        console.error('[Socket] Join table error:', error);
        // Task 15.6: Error handling
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

    console.log('[Socket] ========== LEAVE TABLE START ==========');
    console.log('[Socket] Player:', player?.name, player?.id);
    console.log('[Socket] Before leave - Bankroll:', player?.bankroll);
    console.log('[Socket] Seat stack:', seat?.stack || 0);

    if (seat && player) {
      const oldBankroll = player.bankroll;
      updatePlayerBankroll(player, seat.stack);
      console.log('[Socket] After updatePlayerBankroll - Bankroll:', player.bankroll, `(${oldBankroll} + ${seat.stack})`);
    }

    // Task 15.2: Blockchain leave table (only if stack > 0)
    console.log('[Socket] ========== BLOCKCHAIN LEAVE CHECK ==========');
    console.log('[Socket] BLOCKCHAIN_ENABLED:', config.BLOCKCHAIN_ENABLED);
    console.log('[Socket] Player:', player?.name, player?.id);
    console.log('[Socket] Seat stack:', seat?.stack || 0);
    console.log('[Socket] Will call blockchain:', config.BLOCKCHAIN_ENABLED && player && (seat?.stack || 0) > 0);

    if (config.BLOCKCHAIN_ENABLED && player && (seat?.stack || 0) > 0) {
      try {
        console.log('[Socket] Calling blockchain leaveTable with stack:', seat.stack);
        await gameFlowIntegration.handleLeaveTable(
          player.id,
          tableId,
          socket.id,
          seat.stack,
          player.bankroll  // Pass current bankroll for logging
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
        console.log('[Socket] Skipping blockchain leaveTable (stack=0)');
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
        // Task 15.2: Call blockchain integration
        const stack = seat?.stack || 0;
        await gameFlowIntegration.handleLeaveTable(player.id, tableId, socket.id, stack);
        
        if (seat) {
          updatePlayerBankroll(player, seat.stack);
        }
        
        table.removePlayer(socket.id);
        socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
        socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });
        
        let message = `${player.name} left the table.`;
        broadcastToTable(table, message);
        
        if (table.activePlayers().length === 1) {
          clearForOnePlayer(table);
        }
        
      } catch (error) {
        // Task 15.6: Error handling
        gameFlowIntegration.handleBlockchainError(error, 'leaveTable', socket.id);
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

  socket.on(CS_FOLD, (tableId) => {
    let table = tables[tableId];
    let res = table.handleFold(socket.id);
    res && broadcastToTable(table, res.message);
    res && changeTurnAndBroadcast(table, res.seatId);
  });

  socket.on(CS_CHECK, (tableId) => {
    let table = tables[tableId];
    let res = table.handleCheck(socket.id);
    res && broadcastToTable(table, res.message);
    res && changeTurnAndBroadcast(table, res.seatId);
  });

  socket.on(CS_CALL, (tableId) => {
    let table = tables[tableId];
    let res = table.handleCall(socket.id);
    res && broadcastToTable(table, res.message);
    res && changeTurnAndBroadcast(table, res.seatId);
  });

  socket.on(CS_RAISE, ({ tableId, amount }) => {
    let table = tables[tableId];
    let res = table.handleRaise(socket.id, amount);
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

      updatePlayerBankroll(player, -amount);

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

  socket.on(CS_REBUY, ({ tableId, seatId, amount }) => {
    const table = tables[tableId];
    const player = players[socket.id];

    table.rebuyPlayer(seatId, amount);
    updatePlayerBankroll(player, -amount);

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
    players[socket.id].bankroll += amount;
    io.to(socket.id).emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
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
    console.log('[Socket] changeTurnAndBroadcast called, seatId:', seatId, 'current handOver:', table.handOver);
    setTimeout(async () => {
      table.changeTurn(seatId);
      console.log('[Socket] After changeTurn, handOver:', table.handOver, 'winMessages:', table.winMessages);
      broadcastToTable(table);

      if (table.handOver) {
        console.log('[Socket] Hand is over, calling handleGameEnd...');
        // Handle game end (settlement and balance updates) before starting new hand
        await handleGameEnd(table);
        initNewHand(table);
      }
    }, 1000);
  }

  // Modified to include blockchain settlement
  async function initNewHand(table) {
    if (table.activePlayers().length > 1) {
      broadcastToTable(table, '---New hand starting in 5 seconds---');
    }
    setTimeout(() => {
      table.clearWinMessages();
      table.startHand();
      broadcastToTable(table, '--- New hand started ---');
    }, 5000);
  }

  // Task 15.4: Handle game end with settlement and balance updates
  async function handleGameEnd(table) {
    console.log('[Socket] handleGameEnd called');
    console.log('[Socket] winMessages:', table.winMessages);
    console.log('[Socket] table.seats:', Object.keys(table.seats).filter(id => table.seats[id]?.player).map(id => ({
      seatId: id,
      playerName: table.seats[id]?.player?.name,
      playerId: table.seats[id]?.player?.id,
      socketId: table.seats[id]?.player?.socketId
    })));
    console.log('[Socket] players registry:', Object.keys(players).map(sid => ({
      socketId: sid,
      playerId: players[sid]?.id,
      playerName: players[sid]?.name
    })));

    // Convert table result to settlement format
    // Pass global players registry so we can find winners even if they left the table
    const settlementData = gameFlowIntegration.convertTableResultToSettlement(
      table,
      table.winMessages,
      players  // Pass global players registry for fallback lookup
    );

    console.log('[Socket] Settlement data winners:', settlementData.winners);

    // Always update local player balances (regardless of blockchain mode)
    if (settlementData.winners.length > 0) {
      for (const winner of settlementData.winners) {
        // Find the player by address in global players registry
        // Note: We use global 'players' object, not 'table.seats', because the winner
        // may have already left the table but should still receive their winnings
        const playerEntry = Object.entries(players).find(
          ([_, p]) => p.id === winner.address
        );

        console.log(`[Socket] Looking for winner ${winner.address} in players registry...`);
        
        if (playerEntry) {
          const [socketId, player] = playerEntry;
          // Update player's local bankroll
          const oldBankroll = player.bankroll;
          player.bankroll += winner.amount;
          console.log(`[Socket] Updated ${player.name} bankroll: ${oldBankroll} -> ${player.bankroll} (+${winner.amount})`);

          // Update cache in gameFlowIntegration - winner gets the amount, locked stays the same
          gameFlowIntegration.updatePlayerBalanceCache(winner.address, winner.amount, 0);

          // Notify client about balance update
          io.to(socketId).emit(SC_BALANCE_SYNCED, {
            balance: player.bankroll,
            locked: 0,
            available: player.bankroll,
            reason: 'game_won',
            amount: winner.amount
          });
        } else {
          console.warn(`[Socket] Winner player not found for address: ${winner.address}`);
          // Player might have disconnected, but we should still track the win
          // Update the balance cache anyway so when they reconnect they get their balance
          gameFlowIntegration.updatePlayerBalanceCache(winner.address, winner.amount, 0);
        }
      }

      // Update locked amount for all players who were in this hand
      // After game ends, their locked amount should reflect their current stack
      for (const seatId of Object.keys(table.seats)) {
        const seat = table.seats[seatId];
        if (seat && seat.player) {
          const cachedBalance = gameFlowIntegration.getPlayerBalanceCache(seat.player.id);
          if (cachedBalance) {
            // Update locked to match current stack (what they have left on table)
            const newLocked = seat.stack || 0;
            console.log(`[Socket] Updating locked for ${seat.player.name}: ${cachedBalance.lockedAmount} -> ${newLocked}`);
            gameFlowIntegration.updatePlayerBalanceCache(seat.player.id, 0, newLocked - cachedBalance.lockedAmount);
          }
        }
      }

      // Also notify all players at table about their final balance
      for (const player of table.players) {
        const playerEntry = Object.entries(players).find(
          ([_, p]) => p.id === player.id
        );
        if (playerEntry) {
          const [socketId, p] = playerEntry;
          io.to(socketId).emit(SC_BALANCE_SYNCED, {
            balance: p.bankroll,
            locked: 0,
            available: p.bankroll,
            reason: 'game_end'
          });
        }
      }

      // Broadcast updated table state so all players see updated stacks
      broadcastToTable(table);
    }

    // Only do blockchain settlement if enabled
    if (!config.BLOCKCHAIN_ENABLED) {
      console.warn('⚠️ [BLOCKCHAIN DISABLED] handleGameSettlement - No on-chain settlement. Check BLOCKCHAIN_ENABLED in .env.local');
      return;
    }

    console.log('[Socket] ========== BLOCKCHAIN SETTLEMENT ==========');
    console.log('[Socket] BLOCKCHAIN_ENABLED:', config.BLOCKCHAIN_ENABLED);
    console.log('[Socket] Settlement data:', JSON.stringify(settlementData, null, 2));

    try {
      // Task 15.4: Process blockchain settlement
      const result = await gameFlowIntegration.handleGameSettlement(settlementData);
      console.log('[Socket] ✅ Game settled on blockchain:', result.txId);

    } catch (error) {
      console.error('[Socket] ❌ Game settlement error:', error.message);
      console.error('[Socket] ❌ Error stack:', error.stack);

      // Task 15.6: Notify players about settlement failure
      for (const player of table.players) {
        gameFlowIntegration.notifyPlayer(player.socketId, SC_BLOCKCHAIN_SETTLEMENT, {
          status: 'failed',
          message: error.message,
          tableId: table.id
        });
      }
    }
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
