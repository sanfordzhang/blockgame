/**
 * GameSettlementService - Game Settlement Integration
 * Handles the settlement flow from game end to blockchain confirmation
 */

const crypto = require('crypto');

class GameSettlementService {
    constructor() {
        this.contractService = null;
        this.tronService = null;
        this.transactionQueue = null;
        this.pendingSettlements = new Map();
    }

    /**
     * Initialize service
     */
    init(contractService, tronService, transactionQueue) {
        this.contractService = contractService;
        this.tronService = tronService;
        this.transactionQueue = transactionQueue;
        console.log('[GameSettlementService] Initialized');
        return this;
    }

    /**
     * Generate settlement data from game result
     * @param {object} gameResult - Game result from game logic
     * @returns {object} Settlement data
     */
    generateSettlementData(gameResult) {
        const { tableId, players, pot, winners } = gameResult;
        
        // Calculate winnings for each winner
        const winnerAddresses = [];
        const winnerAmounts = [];
        
        for (const winner of winners) {
            winnerAddresses.push(winner.address);
            winnerAmounts.push(winner.amount);
        }
        
        // Generate result hash for verification
        const resultHash = this.generateResultHash(tableId, winnerAddresses, winnerAmounts);
        
        return {
            tableId,
            winners: winnerAddresses,
            amounts: winnerAmounts,
            resultHash,
            totalPot: pot,
            timestamp: Date.now()
        };
    }

    /**
     * Generate cryptographic hash of game result
     */
    generateResultHash(tableId, winners, amounts) {
        const data = JSON.stringify({
            tableId,
            winners: winners.sort(), // Sort for deterministic hash
            amounts,
            timestamp: Math.floor(Date.now() / 1000 / 300) // 5-minute window
        });
        
        return '0x' + crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Settle a game
     * @param {object} settlementData - Settlement data
     * @returns {Promise<object>} Settlement result
     */
    async settleGame(settlementData) {
        const { tableId, winners, amounts, resultHash } = settlementData;
        
        console.log(`[GameSettlementService] Settling game at table ${tableId}`);
        
        // Add to transaction queue
        const result = await this.transactionQueue.add(
            { type: 'settleGame', tableId, winners, amounts, resultHash },
            async (data) => {
                return await this.contractService.settleGame(
                    data.tableId,
                    data.winners,
                    data.amounts,
                    data.resultHash
                );
            }
        );
        
        return {
            success: true,
            txId: result.txid || result,
            tableId,
            winners,
            amounts
        };
    }

    /**
     * Process game end event
     * This is called when a game ends in the game logic
     */
    async processGameEnd(gameResult) {
        console.log(`[GameSettlementService] Processing game end for table ${gameResult.tableId}`);
        
        // Generate settlement data
        const settlementData = this.generateSettlementData(gameResult);
        
        // Track pending settlement
        const settlementId = `settlement_${gameResult.tableId}_${Date.now()}`;
        this.pendingSettlements.set(settlementId, {
            ...settlementData,
            status: 'pending',
            createdAt: Date.now()
        });
        
        try {
            // Execute settlement
            const result = await this.settleGame(settlementData);
            
            // Update pending settlement status
            this.pendingSettlements.set(settlementId, {
                ...settlementData,
                status: 'confirmed',
                txId: result.txId,
                confirmedAt: Date.now()
            });
            
            return result;
            
        } catch (error) {
            // Update pending settlement status
            this.pendingSettlements.set(settlementId, {
                ...settlementData,
                status: 'failed',
                error: error.message,
                failedAt: Date.now()
            });
            
            throw error;
        }
    }

    /**
     * Get pending settlements
     */
    getPendingSettlements() {
        const pending = [];
        for (const [id, settlement] of this.pendingSettlements) {
            if (settlement.status === 'pending') {
                pending.push({ id, ...settlement });
            }
        }
        return pending;
    }

    /**
     * Get settlement history
     */
    getSettlementHistory(limit = 50) {
        const history = [];
        for (const [id, settlement] of this.pendingSettlements) {
            if (settlement.status !== 'pending') {
                history.push({ id, ...settlement });
            }
        }
        return history.slice(-limit);
    }

    /**
     * Calculate rake from winning amount
     * @param {number} amount - Gross winning amount (in SUN)
     * @param {number} rakeRate - Rake rate in basis points
     * @returns {object} { netAmount, rakeAmount }
     */
    calculateRake(amount, rakeRate) {
        const rakeAmount = Math.floor((amount * rakeRate) / 10000);
        const netAmount = amount - rakeAmount;
        return { netAmount, rakeAmount };
    }

    /**
     * Clean up old settlements (keep last 1000)
     */
    cleanupOldSettlements() {
        const maxSettlements = 1000;
        
        if (this.pendingSettlements.size > maxSettlements) {
            const entries = Array.from(this.pendingSettlements.entries());
            const toKeep = entries.slice(-maxSettlements);
            
            this.pendingSettlements.clear();
            for (const [id, settlement] of toKeep) {
                this.pendingSettlements.set(id, settlement);
            }
            
            console.log(`[GameSettlementService] Cleaned up ${entries.length - maxSettlements} old settlements`);
        }
    }
}

// Export singleton instance
module.exports = new GameSettlementService();
