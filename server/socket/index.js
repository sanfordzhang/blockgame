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
    
    // Auto sit down
    await sitDown(tableId, table.players.length, table.limit);

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
    
    if (!player) {
      socket.emit(SC_BLOCKCHAIN_ERROR, {
        operation: 'joinTable',
        message: 'Player not found'
      });
      return;
    }

    if (config.BLOCKCHAIN_ENABLED) {
      try {
        // Task 15.1: Call blockchain integration
        const result = await gameFlowIntegration.handleJoinTable(
          player.id,
          tableId,
          buyInAmount,
          socket.id
        );
        
        // Add player to table after successful blockchain operation
        table.addPlayer(player);
        socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId, txId: result.txId });
        socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
        
        // Sit down with the buy-in amount
        await sitDown(tableId, table.players.length, buyInAmount);
        
        let message = `${player.name} joined the table.`;
        broadcastToTable(table, message);
        
      } catch (error) {
        // Task 15.6: Error handling
        gameFlowIntegration.handleBlockchainError(error, 'joinTable', socket.id);
      }
    } else {
      // Non-blockchain mode - use default behavior
      table.addPlayer(player);
      socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId });
      socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
      await sitDown(tableId, table.players.length, table.limit);
      
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

    if (seat && player) {
      updatePlayerBankroll(player, seat.stack);
    }

    // Task 15.2: Blockchain leave table
    if (config.BLOCKCHAIN_ENABLED && player) {
      try {
        await gameFlowIntegration.handleLeaveTable(player.id, tableId, socket.id);
      } catch (error) {
        // Log error but continue with local leave
        console.error('[Socket] Blockchain leave table error:', error.message);
      }
    }

    table.removePlayer(socket.id);

    socket.broadcast.emit(SC_TABLES_UPDATED, getCurrentTables());
    socket.emit(SC_TABLE_LEFT, { tables: getCurrentTables(), tableId });

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
        await gameFlowIntegration.handleLeaveTable(player.id, tableId, socket.id);
        
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
    
    if (player) {
      // Task 15.3: Validate contract balance before sitting down
      if (config.BLOCKCHAIN_ENABLED) {
        try {
          const validation = await gameFlowIntegration.validateBalanceForSitDown(
            player.id,
            amount
          );
          
          if (!validation.valid) {
            // Task 15.7: Notify player about insufficient balance
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
      }
      
      table.sitPlayer(player, seatId, amount);
      let message = `${player.name} sat down in Seat ${seatId}`;

      updatePlayerBankroll(player, -amount);

      broadcastToTable(table, message);
      if (table.activePlayers().length === 2) {
        initNewHand(table);
      }
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
    setTimeout(() => {
      table.changeTurn(seatId);
      broadcastToTable(table);

      if (table.handOver) {
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

  // Task 15.4: Handle game end with settlement
  async function handleGameEnd(table) {
    if (!config.BLOCKCHAIN_ENABLED) {
      return; // Skip blockchain settlement in non-blockchain mode
    }

    try {
      // Convert table result to settlement format
      const settlementData = gameFlowIntegration.convertTableResultToSettlement(
        table,
        table.winMessages
      );

      // Only settle if there are winners
      if (settlementData.winners.length > 0) {
        // Task 15.4: Process blockchain settlement
        const result = await gameFlowIntegration.handleGameSettlement(settlementData);
        
        console.log('[Socket] Game settled on blockchain:', result.txId);
      }
    } catch (error) {
      console.error('[Socket] Game settlement error:', error.message);
      
      // Task 15.6: Notify players about settlement failure
      for (const player of table.players) {
        gameFlowIntegration.notifyPlayer(player.socketId, SC_BLOCKCHAIN_SETTLEMENT, {
          status: 'failed',
          message: error.message,
          tableId: table.id
        });
      }
    }
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
