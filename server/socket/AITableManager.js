/**
 * AI Table Manager — Auto-fill tables with AI players and route events to AI engine
 *
 * When a table has empty seats, automatically spawns AI agents to fill them.
 * Forwards CS_* socket events to the AI decision engine and converts responses
 * back to socket operations.
 */

const config = require('../../config');
let aiServiceInstance = null;

class AITableManager {
    constructor() {
        this.aiPlayers = new Map();   // tableId -> [{socket, playerId, difficulty}]
        this.maxAITables = parseInt(process.env.AI_MAX_TABLES) || 10;
        this.maxAIPerTable = config.AI_MAX_PLAYERS_PER_TABLE || 3;
    }

    /**
     * Initialize AI service connection
     */
    init(aiSvc) {
        if (aiSvc) {
            aiServiceInstance = aiSvc;
            console.log('[AITableManager] ✅ AI Service connected');
        }
    }

    /**
     * Check if a table needs AI players and fill empty seats
     * Called when player count changes on a table.
     * 
     * @param {Object} table - Table instance
     * @param {number} humanPlayerCount - Number of real players
     * @returns {Array} Array of newly created AI player info
     */
    autoFillTable(table, humanPlayerCount) {
        if (!aiServiceInstance || !aiServiceInstance.isRunning()) {
            return [];
        }

        const tableId = table.id;
        const totalSeats = table.maxPlayers || 6;
        const currentAIs = this.aiPlayers.get(tableId) || [];
        const existingAICount = currentAIs.length;
        const emptySeats = Math.max(0, totalSeats - humanPlayerCount - existingAICount);
        const aisToAdd = Math.min(emptySeats, this.maxAIPerTable - existingAICount);

        if (aisToAdd <= 0) return [];

        const newAIs = [];
        for (let i = 0; i < aisToAdd; i++) {
            const aiPlayer = this._createAIPlayer(tableId, table);
            if (aiPlayer) {
                currentAIs.push(aiPlayer);
                newAIs.push(aiPlayer);
            }
        }

        if (newAIs.length > 0) {
            this.aiPlayers.set(tableId, currentAIs);
            console.log(`[AITableManager] Added ${newAIs.length} AI player(s) to table ${tableId} (humans=${humanPlayerCount}, AIs=${currentAIs.length})`);
        }

        return newAIs;
    }

    /**
     * Create an AI player mock socket that can join a table
     */
    _createAIPlayer(tableId, table) {
        const aiId = `ai_${tableId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const difficulty = ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)];

        // Create mock socket-like interface
        const mockSocket = {
            id: aiId,
            emit: (event, data) => {
                // AI doesn't need UI updates, but we log for debugging
                if (event.includes('ERROR') || event.includes('UPDATE')) {
                    // Silent for normal events
                }
            },
            on: () => {}, // No-op event listener for AI
            join: () => {}
        };

        const aiPlayer = {
            id: aiId,
            socket: mockSocket,
            playerId: aiId,
            difficulty,
            tableId,
            joinedAt: Date.now(),
            isAI: true,

            /**
             * Handle a game action request — send to AI engine
             */
            async requestAction(gameState) {
                if (!aiServiceInstance || !aiServiceInstance.isRunning()) {
                    return { action: 'fold', amount: 0, reason: 'ai_unavailable', confidence: 0 };
                }

                try {
                    const decision = await aiServiceInstance.requestAction({
                        ...gameState,
                        difficulty,
                        aiPlayerId: aiId
                    });

                    // Map AI decision to socket action
                    return this._mapDecisionToAction(decision, gameState);
                } catch (err) {
                    console.error(`[AITableManager] AI decision error for ${aiId}:`, err.message);
                    return { action: 'fold', amount: 0, reason: 'ai_error', confidence: 0 };
                }
            },

            /**
             * Remove AI player from table
             */
            remove() {
                const ais = this.aiPlayers.get(tableId) || [];
                const filtered = ais.filter(a => a.id !== aiId);
                this.aiPlayers.set(tableId, filtered);
                console.log(`[AITableManager] AI player ${aiId} removed from table ${tableId}`);
            }
        };

        return aiPlayer;
    }

    /**
     * Map AI decision output to valid socket action format
     */
    _mapDecisionToAction(decision, gameState) {
        const validActions = ['fold', 'check', 'call', 'raise', 'all-in'];
        let action = (decision.action || 'fold').toLowerCase();

        // Validate action
        if (!validActions.includes(action)) {
            action = 'fold';
        }

        // Clamp raise amount to valid range
        let amount = parseInt(decision.amount) || 0;
        if (action === 'raise') {
            const minRaise = gameState.minRaise || (gameState.callAmount || 0) * 2;
            const maxRaise = gameState.stack || gameState.maxBet || 10000;
            amount = Math.max(minRaise, Math.min(amount, maxRaise));
        }

        if (action === 'call') {
            amount = gameState.callAmount || 0;
        }

        return {
            action,
            amount,
            confidence: decision.confidence || 0.5,
            reason: decision.reason || '',
            difficulty: decision.difficulty || 'medium'
        };
    }

    /**
     * Get all AI players at a specific table
     */
    getTableAIs(tableId) {
        return this.aiPlayers.get(tableId) || [];
    }

    /**
     * Remove all AI players from a table (when table closes)
     */
    clearTableAIs(tableId) {
        const count = (this.aiPlayers.get(tableId) || []).length;
        this.aiPlayers.delete(tableId);
        if (count > 0) {
            console.log(`[AITableManager] Cleared ${count} AI(s) from table ${tableId}`);
        }
        return count;
    }

    /**
     * Get stats about AI usage
     */
    getStats() {
        let totalAIs = 0;
        for (const [, ais] of this.aiPlayers) {
            totalAIs += ais.length;
        }
        return {
            totalAIs,
            tablesWithAI: this.aiPlayers.size,
            aiServiceRunning: aiServiceInstance?.isRunning() || false,
            maxAIPerTable: this.maxAIPerTable
        };
    }
}

module.exports = new AITableManager();