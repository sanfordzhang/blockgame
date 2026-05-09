/**
 * ZeroGStorageService - 0G Decentralized Storage Integration
 * Handles file upload/download, Merkle verification, and NFT metadata storage
 */

const crypto = require('crypto');
const config = require('../config');

class ZeroGStorageService {
    constructor() {
        this.client = null;
        this.initialized = false;
        this.uploadQueue = [];
        this.isProcessingQueue = false;
        this.cache = new Map();
        this.cacheMaxSize = 100;
        this.cacheTTLMs = 30 * 60 * 1000; // 30 minutes
    }

    init() {
        if (!config.ZEROG_STORAGE_ENABLED || config.ZEROG_MOCK) {
            console.log('[ZeroGStorageService] Running in', config.ZEROG_MOCK ? 'MOCK' : 'DISABLED', 'mode');
            this.initialized = true;
            return this;
        }

        try {
            // Try to initialize 0G Storage SDK
            // The SDK package may not be available on npm yet;
            // fallback to HTTP API or mock mode
            const indexerRpc = config.ZEROG_STORAGE_INDEXER_RPC;
            const endpoint = config.ZEROG_STORAGE_ENDPOINT;

            if (!indexerRpc && !endpoint) {
                console.warn('[ZeroGStorageService] No storage endpoints configured, using mock mode');
                this.initialized = true;
                return this;
            }

            this.initialized = true;
            console.log(`[ZeroGStorageService] Initialized (endpoint: ${endpoint || indexerRpc})`);
        } catch (e) {
            console.error('[ZeroGStorageService] Init failed:', e.message);
            this.initialized = true; // Still usable in mock mode
        }

        return this;
    }

    /**
     * Upload a file/buffer to 0G Storage network
     * @param {Buffer} data - File data buffer
     * @param {Object} options - { contentType, encrypt, publicKey }
     * @returns {Promise<{rootHash: string, merkleProof: Array, fileSize: number}>}
     */
    async uploadFile(data, options = {}) {
        const taskId = crypto.randomBytes(4).toString('hex');

        if (config.ZEROG_MOCK || !this._isRealMode()) {
            return this._mockUpload(data, options);
        }

        // Queue-based upload for non-blocking behavior
        return new Promise((resolve, reject) => {
            this.uploadQueue.push({ taskId, data, options, resolve, reject });
            this._processQueue();
        });
    }

    async uploadMetadata(jsonData) {
        if (typeof jsonData === 'object') {
            jsonData = JSON.stringify(jsonData);
        }
        return this.uploadFile(Buffer.from(jsonData), { contentType: 'application/json' });
    }

    /**
     * Download file from 0G Storage and verify integrity
     * @param {string} rootHash - Merkle root hash
     * @returns {Promise<Buffer>} File data
     */
    async downloadFile(rootHash) {
        // Check cache first
        const cached = this._getCached(rootHash);
        if (cached) return cached;

        if (config.ZEROG_MOCK || !this._isRealMode()) {
            return Buffer.from(JSON.stringify({ mock: true, rootHash }));
        }

        // Real SDK download with Merkle proof verification
        try {
            // TODO: Implement actual SDK download call when available
            // const result = await this.client.getFile(rootHash);
            // await this._verifyMerkle(result.data, result.proof, rootHash);
            
            // Cache the result
            // this._setCache(rootHash, result.data);
            throw new Error('Real 0G Storage download not yet implemented - use MOCK mode');
        } catch (e) {
            throw new Error(`[ZeroGStorageService] Download failed: ${e.message}`);
        }
    }

    /**
     * Get public URL for a stored file
     * @param {string} rootHash 
     * @returns {string}
     */
    getFileUrl(rootHash) {
        if (config.ZEROG_MOCK) {
            return `zerog://mock/${rootHash}`;
        }
        return `${config.ZEROG_STORAGE_ENDPOINT}/file/${rootHash}`;
    }

    /**
     * Upload NFT image and metadata together, returning both hashes
     */
    async uploadNFTAssets(imageBuffer, metadataJson) {
        const [imageResult, metaResult] = await Promise.all([
            this.uploadFile(imageBuffer, { contentType: 'image/png' }),
            this.uploadMetadata(metadataJson)
        ]);

        return {
            imageRootHash: imageResult.rootHash,
            imageMerkleProof: imageResult.merkleProof,
            metadataRootHash: metaResult.rootHash,
            metadataUrl: `zerog://${metaResult.rootHash}`
        };
    }

    // ============ Internal Methods ============

    _isRealMode() {
        return config.ZEROG_STORAGE_ENABLED &&
               config.ZEROG_STORAGE_INDEXER_RPC &&
               !config.ZEROG_MOCK;
    }

    async _mockUpload(data, options) {
        const rootHash = '0x' + crypto.createHash('sha256')
            .update(data)
            .update(Date.now().toString())
            .digest('hex');
        
        const mockResult = {
            rootHash,
            merkleProof: ['0xmockproof1', '0xmockproof2'],
            fileSize: data.length,
            timestamp: Date.now()
        };

        console.log(`[ZeroGStorageService] Mock upload: ${data.length} bytes → ${rootHash.slice(0, 16)}...`);
        
        // Cache mock results too
        this._setCache(rootHash, data);

        return mockResult;
    }

    async _processQueue() {
        if (this.isProcessingQueue || this.uploadQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.uploadQueue.length > 0) {
            const task = this.uploadQueue.shift();
            
            try {
                let retryCount = 0;
                const maxRetries = 3;
                let lastError;

                while (retryCount < maxRetries) {
                    try {
                        const result = await this._doRealUpload(task.data, task.options);
                        task.resolve(result);
                        break;
                    } catch (err) {
                        lastError = err;
                        retryCount++;
                        if (retryCount < maxRetries) {
                            const delay = Math.pow(2, retryCount) * 1000;
                            console.log(`[ZeroGStorageService] Retry ${retryCount}/${maxRetries} after ${delay}ms`);
                            await this._sleep(delay);
                        }
                    }
                }

                if (retryCount >= maxRetries) {
                    task.reject(lastError || new Error('Max retries exceeded'));
                }
            } catch (e) {
                task.reject(e);
            }
        }

        this.isProcessingQueue = false;
    }

    async _doRealUpload(data, options) {
        // TODO: Replace with actual 0G Storage SDK call
        // For now, simulate a real upload with hashing
        const rootHash = '0x' + crypto.createHash('sha256').update(data).digest('hex');
        
        return {
            rootHash,
            merkleProof: ['0xmerkle1'],
            fileSize: data.length,
            encrypted: options.encrypt || false
        };
    }

    _verifyMerkle(data, merkleProof, expectedRootHash) {
        // Merkle proof verification placeholder
        // In production: reconstruct root from data leaf + proof path
        const computedHash = crypto.createHash('sha256').update(data).digest('hex');
        return computedHash === expectedRootHash.replace('0x', '');
    }

    // ============ LRU Cache ============

    _getCached(rootHash) {
        const cached = this.cache.get(rootHash);
        if (cached && Date.now() - cached.timestamp < this.cacheTTLMs) {
            return cached.data;
        }
        if (cached) {
            this.cache.delete(rootHash);
        }
        return null;
    }

    _setCache(rootHash, data) {
        if (this.cache.size >= this.cacheMaxSize) {
            // Evict oldest entry
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(rootHash, { data, timestamp: Date.now() });
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            initialized: this.initialized,
            isMock: !!config.ZEROG_MOCK,
            queueLength: this.uploadQueue.length,
            cacheSize: this.cache.size,
            isRealMode: this._isRealMode()
        };
    }
}

module.exports = ZeroGStorageService;
