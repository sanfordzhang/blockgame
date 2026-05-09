/**
 * Fairness Integration — Hooks into game flow for commitment-reveal fairness
 *
 * Integrates FairnessService into the poker game Table lifecycle:
 * 1. Before deal: generate seed commitment
 * 2. After settlement: reveal seed + submit state hash to DA layer
 */

const config = require('../config');

class FairnessIntegration {
    constructor() {
        this.fairnessService = null;
        this.enabled = false;
    }

    /**
     * Initialize fairness service
     */
    init() {
        try {
            this.fairnessService = require('./FairnessService');
            this.enabled = true;
            console.log('[FairnessIntegration] ✅ Initialized — commitment-reveal fairness active');
        } catch (e) {
            console.log('[FairnessIntegration] ℹ️ Not available:', e.message);
        }
    }

    /**
     * Hook called BEFORE dealing cards for a new hand.
     * Generates seed commitment that will be revealed after hand ends.
     * 
     * @param {string} tableId - The table identifier
     * @param {number} handNumber - Sequential hand number on this table
     * @returns {Object|null} { commitment, salt, tableId, handNumber, timestamp }
     */
    generatePreDealCommitment(tableId, handNumber) {
        if (!this.enabled || !this.fairnessService) return null;

        try {
            const result = this.fairnessService.generateCommitment(tableId, handNumber);
            console.log(`[FairnessIntegration] Pre-deal commitment generated: table=${tableId} hand=${handNumber}`);
            return result;
        } catch (err) {
            console.error('[FairnessIntegration] Pre-deal commitment failed:', err.message);
            return null;
        }
    }

    /**
     * Hook called AFTER settlement completes.
     * Reveals the seed and submits state hash to DA layer.
     * 
     * @param {string} handId - Unique hand identifier  
     * @param {Object} commitmentData - The pre-deal commitment data
     * @param {Object} gameResult - Full game result including cards, pot, winners
     * @returns {Object|null} { revealed, stateHash, daSubmitted }
     */
    async postSettlementReveal(handId, commitmentData, gameResult) {
        if (!this.enabled || !this.fairnessService) return null;

        try {
            // 1. Reveal the seed
            let revealResult = null;
            if (commitmentData) {
                revealResult = this.fairnessService.revealSeed(
                    handId,
                    commitmentData.seed,
                    commitmentData.salt,
                    commitmentData.tableId,
                    commitmentData.handNumber
                );
            }

            // 2. Generate and anchor state hash
            const stateHashResult = this.fairnessService.generateStateHash(gameResult);
            
            // 3. Submit to DA layer if enabled
            let daSubmitted = false;
            if (stateHashResult.stateHash && global.zeroGDAService) {
                try {
                    await global.zeroGDAService.submitStateHash({
                        handId,
                        stateHash: stateHashResult.stateHash,
                        winners: gameResult.winners || [],
                        totalPot: gameResult.totalPot || 0,
                        timestamp: Date.now()
                    });
                    daSubmitted = true;
                    console.log(`[FairnessIntegration] State hash anchored to DA: ${stateHashResult.stateHash.slice(0, 16)}...`);
                } catch (daErr) {
                    console.warn('[FairnessIntegration] DA submission failed (non-critical):', daErr.message);
                }
            }

            const result = {
                revealed: revealResult,
                stateHash: stateHashResult.stateHash,
                daSubmitted,
                verificationData: {
                    handId,
                    commitment: commitmentData ? commitmentData.commitment : null,
                    seedRevealed: !!revealResult,
                    stateHash: stateHashResult.stateHash,
                    daAnchored: daSubmitted,
                    timestamp: Date.now()
                }
            };

            console.log(`[FairnessIntegration] Post-settlement complete: hand=${handId} da=${daSubmitted}`);
            return result;
        } catch (err) {
            console.error('[FairnessIntegration] Post-settlement reveal failed:', err.message);
            return null;
        }
    }

    /**
     * Generate a standalone fairness report for any completed hand
     * Can be called by API or frontend to verify past hands.
     */
    generateVerificationReport(handId, gameResult) {
        if (!this.enabled || !this.fairnessService) {
            return { error: 'Fairness service not initialized' };
        }

        try {
            return this.fairnessService.generateVerificationReport(gameResult);
        } catch (err) {
            return { error: err.message };
        }
    }
}

module.exports = new FairnessIntegration();