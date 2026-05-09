/**
 * GameLogStorage — Persist complete poker game states to 0G Storage
 *
 * After each hand settles, serializes the full game state (cards, actions, results)
 * and uploads to 0G Storage for immutable record-keeping.
 */

const config = require('../config');

class GameLogStorage {
    constructor() {
        this.enabled = config.ZEROG_STORAGE_ENABLED === true && config.ZEROG_ENABLED === true;
        this.uploadQueue = [];
    }

    /**
     * Store a complete game log after settlement
     * @param {Object} gameState - Full serialized game state
     * @returns {Promise<Object>} { success, rootHash, timestamp, storageType }
     */
    async storeGameLog(gameState) {
        if (!this.enabled || !global.zeroGStorageService) {
            // Local DB fallback — store log reference only
            console.log('[GameLogStorage] Storage not enabled, skipping remote upload');
            return { success: true, rootHash: null, timestamp: Date.now(), storageType: 'local' };
        }

        try {
            // Serialize game state to JSON
            const logPayload = {
                version: '1.0',
                type: 'poker-game-log',
                timestamp: Date.now(),
                network: config.BLOCKCHAIN_MODE || 'tron',
                data: gameState
            };

            const result = await global.zeroGStorageService.uploadMetadata(logPayload);
            
            console.log(`[GameLogStorage] ✅ Game log stored: hand=${gameState.handId || 'unknown'} rootHash=${result.rootHash}`);
            return { 
                success: true, 
                rootHash: result.rootHash, 
                url: result.url,
                timestamp: Date.now(), 
                storageType: '0g' 
            };
        } catch (err) {
            console.error('[GameLogStorage] ❌ Failed to store game log:', err.message);
            // Queue for retry later
            this.uploadQueue.push({ gameState, timestamp: Date.now() });
            return { success: false, error: err.message, storageType: 'error' };
        }
    }

    /**
     * Retrieve a game log by its root hash
     * @param {string} rootHash - Merkle root / file identifier from 0G Storage
     * @returns {Promise<Object>} Parsed game log or error
     */
    async retrieveGameLog(rootHash) {
        if (!global?.zeroGStorageService) {
            return { error: 'Storage service not available' };
        }

        try {
            const content = await global.zeroGStorageService.downloadFile(rootHash);
            return { success: true, data: content };
        } catch (err) {
            return { error: err.message };
        }
    }

    /**
     * Get public URL for a stored game log
     */
    getLogUrl(rootHash) {
        if (!global?.zeroGStorageService?.getFileUrl) return null;
        return global.zeroGStorageService.getFileUrl(rootHash);
    }

    /**
     * Retry queued uploads
     */
    async retryQueuedUploads() {
        if (this.uploadQueue.length === 0) return 0;

        let retried = 0;
        const remaining = [];

        for (const item of this.uploadQueue) {
            try {
                await this.storeGameLog(item.gameState);
                retried++;
            } catch (e) {
                remaining.push(item);
            }
        }

        this.uploadQueue = remaining;
        if (retried > 0) {
            console.log(`[GameLogStorage] Retried ${retried} queued uploads, ${remaining.length} still pending`);
        }
        return retried;
    }
}

module.exports = new GameLogStorage();