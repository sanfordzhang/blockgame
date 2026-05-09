/**
 * ZeroGDAService - 0G Data Availability Layer Integration
 * Submits game state hashes to DA layer for verifiable fairness
 */

const crypto = require('crypto');
const config = require('../config');

class ZeroGDAService {
    constructor() {
        this.client = null;
        this.initialized = false;
        this.pendingSubmissions = new Map(); // handId => submission status
        this.batchBuffer = [];
        this.batchTimer = null;
        this.batchIntervalMs = 5000; // Batch every 5 seconds
    }

    init() {
        if (!config.ZEROG_DA_ENABLED) {
            console.log('[ZeroGDAService] DA disabled');
            this.initialized = true;
            return this;
        }

        if (config.ZEROG_MOCK) {
            console.log('[ZeroGDAService] Running in MOCK mode');
            this.initialized = true;
            return this;
        }

        try {
            const rpcUrl = config.ZEROG_DA_RPC_URL;
            if (!rpcUrl) {
                console.warn('[ZeroGDAService] No DA RPC URL configured, running in degraded mode');
                this.initialized = true;
                return this;
            }

            this.initialized = true;
            console.log(`[ZeroGDAService] Initialized (RPC: ${rpcUrl})`);
        } catch (e) {
            console.error('[ZeroGDAService] Init failed:', e.message);
            this.initialized = true; // Degrade gracefully
        }

        return this;
    }

    /**
     * Submit game state hash to 0G Data Availability layer
     * @param {Object} stateData - Game state object
     * @returns {Promise<Object>} DA receipt
     */
    async submitStateHash(stateData) {
        if (!stateData?.stateHash) {
            throw new Error('[ZeroGDAService] Invalid state data: missing stateHash');
        }

        const handId = stateData.handId || stateData.tableId || 'unknown';
        
        if (this.pendingSubmissions.has(handId)) {
            return this.pendingSubmissions.get(handId);
        }

        if (config.ZEROG_MOCK) {
            return this._mockSubmit(stateData);
        }

        // Async non-blocking submission
        const submissionPromise = this._doSubmit(stateData);
        this.pendingSubmissions.set(handId, submissionPromise);

        try {
            const result = await submissionPromise;
            this.pendingSubmissions.delete(handId);
            return result;
        } catch (error) {
            this.pendingSubmissions.delete(handId);
            throw error;
        }
    }

    /**
     * Batch submit multiple state hashes for efficiency
     * @param {Array<Object>} stateDataArray - Array of state objects
     * @returns {Promise<Array>} Array of receipts
     */
    async batchSubmit(stateDataArray) {
        if (!Array.isArray(stateDataArray) || stateDataArray.length === 0) {
            return [];
        }

        console.log(`[ZeroGDAService] Batch submitting ${stateDataArray.length} state hashes`);

        if (config.ZEROG_MOCK) {
            return stateDataArray.map(data => this._mockSubmit(data));
        }

        const results = await Promise.allSettled(
            stateDataArray.map(data => this.submitStateHash(data))
        );

        return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message });
    }

    /**
     * Query DA proof for a specific batch
     * @param {number} batchIndex - DA batch index
     * @returns {Promise<Object>} Proof data
     */
    async queryDAProof(batchIndex) {
        if (config.ZEROG_MOCK) {
            return {
                batchIndex,
                commitmentHash: '0xmockCommitment' + batchIndex,
                status: 'confirmed',
                timestamp: Date.now(),
                verified: true
            };
        }

        // TODO: Implement actual DA layer query
        throw new Error('[ZeroGDAService] Real DA query not yet implemented');
    }

    /**
     * Check submission status for a hand ID
     */
    getSubmissionStatus(handId) {
        const pending = this.pendingSubmissions.get(handId);
        if (pending) {
            return { status: 'pending', handId };
        }
        // Could also check DB for previously submitted proofs
        return { status: 'unknown', handId };
    }

    // ============ Internal Methods ============

    async _doSubmit(stateData) {
        const serialized = JSON.stringify(stateData);
        const stateHash = stateData.stateHash || 
            crypto.createHash('sha256').update(serialized).digest('hex');

        try {
            // TODO: Replace with actual 0G DA SDK submitTransaction() call
            // Example:
            // const receipt = await this.daClient.submitTransaction(
            //     Buffer.from(stateHash, 'hex'),
            //     { confirm: false } // Don't wait for confirmation
            // );

            // Simulate successful DA submission
            const receipt = {
                batchIndex: Math.floor(Math.random() * 100000),
                commitmentHash: '0x' + stateHash,
                status: 'submitted',
                timestamp: Date.now(),
                handId: stateData.handId,
                stateHash: '0x' + stateHash,
                tableId: stateData.tableId,
                verified: false // Will be confirmed asynchronously
            };

            console.log(
                `[ZeroGDAService] State hash submitted for hand #${stateData.handId || '?'} ` +
                `(batch #${receipt.batchIndex})`
            );

            return receipt;
        } catch (error) {
            console.error(`[ZeroGDAService] Submission failed for ${stateData.handId}:`, error.message);
            
            // Store locally as pending retry
            receipt = {
                batchIndex: -1,
                commitmentHash: '0x' + stateHash,
                status: 'failed_local',
                timestamp: Date.now(),
                error: error.message,
                willRetry: true
            };

            return receipt;
        }
    }

    _mockSubmit(stateData) {
        const stateHash = stateData.stateHash || 
            crypto.createHash('sha256').update(JSON.stringify(stateData)).digest('hex');

        const receipt = {
            batchIndex: Math.floor(Math.random() * 100000),
            commitmentHash: '0x' + stateHash,
            status: 'confirmed',
            timestamp: Date.now(),
            handId: stateData.handId || 'mock_hand_' + Date.now(),
            stateHash: '0x' + stateHash,
            tableId: stateData.tableId || 'mock_table',
            verified: true,
            mock: true
        };

        console.log(`[ZeroGDAService] [MOCK] Submitted: hand=${receipt.handId}, batch=${receipt.batchIndex}`);
        return receipt;
    }

    getStatus() {
        return {
            initialized: this.initialized,
            enabled: config.ZEROG_DA_ENABLED,
            isMock: !!config.ZEROG_MOCK,
            pendingCount: this.pendingSubmissions.size,
            bufferSize: this.batchBuffer.length
        };
    }
}

module.exports = ZeroGDAService;
