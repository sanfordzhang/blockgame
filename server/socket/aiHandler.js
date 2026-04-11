const {
  CS_AI_ENABLE,
  SC_AI_ENABLED,
  CS_AI_DISABLE,
  SC_AI_DISABLED,
  CS_AI_STATS,
  SC_AI_STATS,
  SC_AI_ACTION,
  CS_GET_SUGGESTION,
  SC_SUGGESTION,
} = require('../pokergame/actions');
const aiService = require('../services/ai/AIService');

function initAIHandlers(socket, io, tables, players) {
  // Enable AI autopilot
  socket.on(CS_AI_ENABLE, ({ tableId, difficulty, maxHands }) => {
    const playerId = cycleMap(players, socket.id)?.id || socket.id;
    const result = aiService.enableAI(playerId, difficulty, maxHands);
    socket.emit(SC_AI_ENABLED, result);
  });

  // Disable AI autopilot
  socket.on(CS_AI_DISABLE, () => {
    const playerId = cycleMap(players, socket.id)?.id || socket.id;
    const result = aiService.disableAI(playerId);
    socket.emit(SC_AI_DISABLED, result);
  });

  // Get AI stats
  socket.on(CS_AI_STATS, () => {
    const playerId = cycleMap(players, socket.id)?.id || socket.id;
    const stats = aiService.getStats(playerId);
    socket.emit(SC_AI_STATS, stats || { error: 'AI not enabled' });
  });

  // Get suggestion (without executing)
  socket.on(CS_GET_SUGGESTION, async (gameState) => {
    try {
      const suggestion = await aiService.getSuggestion(gameState);
      socket.emit(SC_SUGGESTION, suggestion);
    } catch (err) {
      socket.emit(SC_SUGGESTION, { error: err.message });
    }
  });
}

// Execute AI action when it's the AI player's turn
async function executeAIAction(socket, io, table, seat) {
  const playerId = seat.player?.id || seat.id;

  if (!aiService.isAIEnabled(playerId)) return false;

  // Build game state from table/seat
  const gameState = {
    hand: seat.hand.map(c => `${c.rank === '10' ? 'T' : c.rank}${c.suit[0]}`),
    board: table.board.map(c => `${c.rank === '10' ? 'T' : c.rank}${c.suit[0]}`),
    pot: table.pot,
    callAmount: table.callAmount || 0,
    minRaise: table.minRaise || 0,
    stack: seat.stack,
    position: getPosition(table, seat.id),
    numPlayers: table.unfoldedPlayers ? table.unfoldedPlayers().length : 2
  };

  // Add small delay to simulate human thinking (200-1000ms)
  const delay = 200 + Math.random() * 800;
  await new Promise(r => setTimeout(r, delay));

  const decision = await aiService.getAIDecision(playerId, gameState);

  // Notify all players at the table of AI action (broadcast per-socket like broadcastToTable)
  const actionPayload = { playerId, seatId: seat.id, ...decision };
  if (table.players && table.players.length > 0) {
    for (const p of table.players) {
      if (p.socketId) io.to(p.socketId).emit(SC_AI_ACTION, actionPayload);
    }
  } else {
    // Fallback: notify the AI player's own socket
    socket.emit(SC_AI_ACTION, actionPayload);
  }

  // Execute the action on the table
  try {
    switch (decision.action) {
      case 'fold':
        table.handleFold(socket.id);
        break;
      case 'check':
        table.handleCheck(socket.id);
        break;
      case 'call':
        table.handleCall(socket.id);
        break;
      case 'raise':
        table.handleRaise(socket.id, decision.amount);
        break;
      default:
        // Fallback: check or fold
        if ((table.callAmount || 0) === 0) {
          table.handleCheck(socket.id);
        } else {
          table.handleFold(socket.id);
        }
    }
    return true;
  } catch (err) {
    console.error(`[AI] Error executing action: ${err.message}`);
    return false;
  }
}

function getPosition(table, seatId) {
  if (table.button === seatId) return 'button';
  if (table.smallBlind === seatId) return 'sb';
  if (table.bigBlind === seatId) return 'bb';
  return 'other';
}

function cycleMap(map, key) {
  if (map instanceof Map) return map.get(key);
  return map?.[key];
}

module.exports = { initAIHandlers, executeAIAction };
