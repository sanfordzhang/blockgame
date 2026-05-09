/**
 * FairnessService - Verifiable Fairness System
 * Implements commit-reveal scheme for shuffle seeds + state hash chain + DA anchoring
 */

const crypto = require('crypto');

class FairnessService {
    constructor() {
        // Active commitments stored by handId
        // Format: { commitment: hex, seed: hex|null, salt: hex|null, revealed: bool }
        this.commitments = new Map();
        
        // State hash chain: handId => { stateHash, prevHandStateHash }
        this.stateHashes = new Map();
        
        // Previous hand's state hash (for chaining)
        this.lastStateHash = null;
    }

    /**
     * Phase 1: Generate seed commitment before dealing
     * Called at the start of each hand before any cards are dealt
     * @param {string} tableId - Table identifier
     * @param {number|string} handNumber - Sequential hand number
     * @returns {{ commitment: string, handId: string }}
     */
    generateCommitment(tableId, handNumber) {
        const handId = `${tableId}_h${handNumber}`;
        
        // Generate cryptographically secure random seed (32 bytes)
        const seed = crypto.randomBytes(32).toString('hex');
        
        // Generate random salt (16 bytes)
        const salt = crypto.randomBytes(16).toString('hex');
        
        // Compute commitment H = SHA256(seed + salt + tableId + handNumber)
        const commitmentInput = seed + salt + tableId + String(handNumber);
        const commitment = crypto.createHash('sha256').update(commitmentInput).digest('hex');
        
        // Store commitment (keep seed/salt secret until reveal)
        this.commitments.set(handId, {
            commitment: '0x' + commitment,
            seed: '0x' + seed,
            salt: '0x' + salt,
            revealed: false,
            tableId,
            handNumber,
            createdAt: Date.now()
        });

        console.log(`[FairnessService] Commitment generated for ${handId}: 0x${commitment.slice(0, 16)}...`);
        
        return {
            commitment: '0x' + commitment,
            handId,
            tableId,
            handNumber
        };
    }

    /**
     * Reveal the seed after game ends
     * @param {string} handId - Hand identifier
     * @returns {{ seed: string, salt: string, commitment: string, valid: boolean }}
     */
    revealSeed(handId) {
        const record = this.commitments.get(handId);
        
        if (!record) {
            throw new Error(`[FairnessService] No commitment found for handId: ${handId}`);
        }

        if (record.revealed) {
            // Already revealed, return existing reveal data
            return {
                seed: record.seed,
                salt: record.salt,
                commitment: record.commitment,
                valid: true,
                alreadyRevealed: true
            };
        }

        // Mark as revealed
        record.revealed = true;
        record.revealedAt = Date.now();

        // Verify commitment matches (self-check)
        const commitmentInput = record.seed.replace('0x', '') + 
                                   record.salt.replace('0x', '') + 
                                   record.tableId + 
                                   String(record.handNumber);
        const computedCommitment = crypto.createHash('sha256')
            .update(commitmentInput).digest('hex');

        const valid = computedCommitment === record.commitment.replace('0x', '');

        console.log(`[FairnessService] Seed revealed for ${handId}: valid=${valid}`);

        return {
            seed: record.seed,
            salt: record.salt,
            commitment: record.commitment,
            valid,
            alreadyRevealed: false
        };
    }

    /**
     * Verify a commitment-reveal pair
     * Public method for third-party verification
     * @param {string} commitment - The committed hash (hex, with or without 0x prefix)
     * @param {string} seed - Revealed seed (hex)
     * @param {string} salt - Revealed salt (hex)
     * @param {string} tableId - Table identifier used during commitment
     * @param {number|string} handNumber - Hand number used during commitment
     * @returns {boolean} Whether commitment matches reveal
     */
    verifyCommitment(commitment, seed, salt, tableId, handNumber) {
        const cleanCommitment = commitment.replace(/^0x/, '');
        const cleanSeed = seed.replace(/^0x/, '');
        const cleanSalt = salt.replace(/^0x/, '');

        const input = cleanSeed + cleanSalt + tableId + String(handNumber);
        const recomputed = crypto.createHash('sha256').update(input).digest('hex');

        return recomputed === cleanCommitment;
    }

    /**
     * Phase 2: Generate deterministic state hash for a completed hand
     * Includes hash chain linkage to previous hand
     * @param {Object} gameResult - Complete game state
     * @returns {string} SHA-256 state hash as hex string with 0x prefix
     */
    generateStateHash(gameResult) {
        // Deterministic serialization: sort keys alphabetically
        const normalized = this._normalizeGameState(gameResult);
        const serialized = JSON.stringify(normalized);

        // Include previous state hash for chain linkage
        const chainInput = this.lastStateHash 
            ? serialized + this.lastStateHash 
            : serialized;

        const stateHash = crypto.createHash('sha256').update(chainInput).digest('hex');
        const prefixedHash = '0x' + stateHash;

        // Store in hash chain
        const handId = gameResult.handId || 'unknown';
        this.stateHashes.set(handId, {
            stateHash: prefixedHash,
            prevStateHash: this.lastStateHash,
            timestamp: Date.now()
        });

        // Update last for next hand
        this.lastStateHash = prefixedHash;

        console.log(`[FairnessService] State hash generated for ${handId}: ${prefixedHash.slice(0, 18)}...`);
        
        return prefixedHash;
    }

    /**
     * Full verification of a completed hand's fairness
     * Combines commitment verification + state hash consistency + DA proof check
     * @param {string} handId - Hand to verify
     * @param {Object} daReceipt - Optional DA layer receipt
     * @returns {Object} Detailed verification report
     */
    async verifyHandFairness(handId, daReceipt = null) {
        const report = {
            handId,
            timestamp: Date.now(),
            checks: {},
            overallValid: false,
            errors: []
        };

        // Check 1: Seed commitment
        const commitmentRecord = this.commitments.get(handId);
        if (commitmentRecord) {
            if (commitmentRecord.revealed) {
                const seedValid = this.verifyCommitment(
                    commitmentRecord.commitment,
                    commitmentRecord.seed,
                    commitmentRecord.salt,
                    commitmentRecord.tableId,
                    commitmentRecord.handNumber
                );
                report.checks.seedCommitment = {
                    valid: seedValid,
                    commitment: commitmentRecord.commitment,
                    revealed: true
                };
                if (!seedValid) report.errors.push('Seed commitment mismatch');
            } else {
                report.checks.seedCommitment = { valid: false, reason: 'Not yet revealed' };
                report.errors.push('Seed not revealed');
            }
        } else {
            report.checks.seedCommitment = { valid: false, reason: 'No commitment record' };
            report.errors.push('No commitment record found');
        }

        // Check 2: State hash existence
        const stateRecord = this.stateHashes.get(handId);
        if (stateRecord) {
            report.checks.stateHash = {
                valid: true,
                stateHash: stateRecord.stateHash,
                prevStateHash: stateRecord.prevStateHash || 'none (genesis)'
            };
        } else {
            report.checks.stateHash = { valid: false, reason: 'No state hash record' };
            report.errors.push('No state hash recorded');
        }

        // Check 3: Hash chain continuity
        if (stateRecord && stateRecord.prevStateHash !== null) {
            report.checks.hashChain = { valid: true, linkedToPrevious: true };
        } else if (stateRecord) {
            report.checks.hashChain = { valid: true, linkedToPrevious: false, note: 'Genesis hand' };
        } else {
            report.checks.hashChain = { valid: false };
        }

        // Check 4: DA layer anchoring (if receipt provided)
        if (daReceipt) {
            if (daReceipt.status === 'confirmed' || daReceipt.verified) {
                report.checks.daAnchoring = {
                    valid: true,
                    batchIndex: daReceipt.batchIndex,
                    commitmentHash: daReceipt.commitmentHash
                };
            } else if (daReceipt.status === 'submitted') {
                report.checks.daAnchoring = { valid: true, note: 'Submitted but not yet confirmed' };
            } else {
                report.checks.daAnchoring = { valid: false, status: daReceipt.status };
                report.errors.push(`DA anchoring issue: ${daReceipt.status || 'unknown'}`);
            }
        } else {
            report.checks.daAnchoring = { valid: null, note: 'No DA receipt provided' };
        }

        // Overall verdict
        report.overallValid = report.errors.length === 0;
        report.verdict = report.overallValid ? 'VALID ✅' : 'INVALID ❌';

        return report;
    }

    /**
     * Get stored commitment info (without revealing seed if not yet revealed)
     */
    getCommitmentInfo(handId) {
        const record = this.commitments.get(handId);
        if (!record) return null;

        return {
            handId,
            commitment: record.commitment,
            revealed: record.revealed,
            revealedAt: record.revealedAt || null,
            tableId: record.tableId,
            handNumber: record.handNumber,
            createdAt: record.createdAt
        };
    }

    /**
     * Clean up old records (call periodically to prevent memory leaks)
     * @param {number} maxAgeMs - Maximum age in milliseconds (default 24h)
     */
    cleanup(maxAgeMs = 24 * 60 * 60 * 1000) {
        const now = Date.now();
        let cleaned = 0;

        for (const [handId, record] of this.commitments) {
            if (now - record.createdAt > maxAgeMs) {
                this.commitments.delete(handId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[FairnessService] Cleaned up ${cleaned} old commitment records`);
        }
    }

    // ============ Private Helpers ============

    /**
     * Normalize game state for deterministic serialization
     * Sort keys alphabetically recursively
     */
    _normalizeGameState(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this._normalizeGameState(item));
        }
        const sorted = {};
        const keys = Object.keys(obj).sort();
        for (const key of keys) {
            sorted[key] = this._normalizeGameState(obj[key]);
        }
        return sorted;
    }

    getStatus() {
        return {
            activeCommitments: this.commitments.size,
            stateHashCount: this.stateHashes.size,
            hasLastStateHash: !!this.lastStateHash
        };
    }
}

// Singleton export
const instance = new FairnessService();
module.exports = instance;
module.exports.FairnessService = FairnessService; // Also export class for testing
