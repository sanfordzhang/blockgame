/**
 * 0G Controller - Handles requests for 0G-specific API endpoints
 */

const config = require('../config');

class ZeroGController {

    /**
     * GET /api/0g/status - Overall 0G system status
     */
    async getStatus(req, res) {
        const status = {
            timestamp: Date.now(),
            zerog: {
                enabled: config.ZEROG_ENABLED,
                network: config.ZEROG_NETWORK,
                mode: config.BLOCKCHAIN_MODE,
                mockMode: !!config.ZEROG_MOCK,
                chainId: config.ZEROG_CHAIN_ID,
                contractAddresses: {
                    pokerGame: config.ZEROG_POKERGAME_ADDRESS || '(not deployed)',
                    inft: config.ZEROG_INFT_ADDRESS || '(not deployed)'
                }
            },
            services: {
                storage: this._getServiceStatus(global.zeroGStorageService),
                da: this._getServiceStatus(global.zeroGDAService),
                ai: this._getServiceStatus(require('../services/AIService'))
            },
            contracts: this._getContractStatus()
        };

        res.json(status);
    }

    /**
     * GET /api/0g/da-proof/:handId - Query DA proof for a hand
     */
    async getDAProof(req, res) {
        const { handId } = req.params;

        if (!global.zeroGDAService) {
            return res.status(404).json({
                error: 'No DA proof for this hand',
                reason: '0G DA Service not active or hand was played before DA integration'
            });
        }

        const submissionStatus = global.zeroGDAService.getSubmissionStatus(handId);
        
        if (submissionStatus.status === 'pending') {
            return res.json({ ...submissionStatus, message: 'DA proof being generated...' });
        }

        // Try to find stored proof (would query MongoDB in production)
        // For now, check if we can generate a fresh verification
        const fairnessService = require('../pokergame/FairnessService');
        const commitmentInfo = fairnessService.getCommitmentInfo(handId);

        if (!commitmentInfo) {
            return res.status(404).json({
                error: 'No DA proof for this hand',
                reason: 'Hand ID not found in fairness records'
            });
        }

        res.json({
            handId,
            daProof: submissionStatus.status !== 'unknown' ? submissionStatus : null,
            fairness: {
                commitmentExists: true,
                commitment: commitmentInfo.commitment,
                revealed: commitmentInfo.revealed,
                createdAt: commitmentInfo.createdAt
            }
        });
    }

    /**
     * GET /api/0g/fairness-verify/:handId - Online fairness verification
     */
    async verifyFairness(req, res) {
        const { handId } = req.params;
        const fairnessService = require('../pokergame/FairnessService');

        try {
            const report = await fairnessService.verifyHandFairness(
                handId, 
                global.zeroGDAService ? global.zeroGDAService.getSubmissionStatus(handId) : null
            );

            res.json(report);
        } catch (error) {
            res.status(500).json({
                error: 'Verification failed',
                details: error.message
            });
        }
    }

    /**
     * GET /api/0g/storage/:rootHash - Retrieve storage file metadata
     */
    async getStorageFile(req, res) {
        const { rootHash } = req.params;

        if (!global.zeroGStorageService) {
            return res.status(503).json({ error: 'Storage service unavailable' });
        }

        const url = global.zeroGStorageService.getFileUrl(rootHash);
        
        res.json({
            rootHash,
            url,
            exists: !url.includes('mock'), // Simple heuristic
            serviceStatus: global.zeroGStorageService.getStatus()
        });
    }

    /**
     * POST /api/0g/mint-inft - Trigger INFT minting
     */
    async mintINFT(req, res) {
        const { to, handType, cards } = req.body;
        const contractService = global.zeroGContractService;
        const storageService = global.zeroGStorageService;

        if (!contractService || !storageService) {
            return res.status(503).json({
                error: 'Required services not available',
                needs: {
                    contractService: !!contractService,
                    storageService: !!storageService
                }
            });
        }

        try {
            // In production: would upload image to 0G Storage first
            const mockRootHash = '0x' + require('crypto')
                .createHash('sha256').update(Date.now().toString()).digest('hex');

            // Call INFT contract
            const result = await contractService.mintINFT(
                to,
                handType,
                mockRootHash,
                `zerog://${mockRootHash}/metadata`
            );

            res.json({
                success: true,
                txHash: result.hash,
                tokenId: result.events?.find(e => e.event === 'Transfer')?.args?.tokenId?.toString(),
                handType,
                storageRootHash: mockRootHash
            });
        } catch (error) {
            res.status(500).json({
                error: 'MINT_FAILED',
                details: error.message
            });
        }
    }

    /**
     * GET /api/0g/inft/:tokenId - Get INFT data
     */
    async getINFTData(req, res) {
        const { tokenId } = req.params;
        const contractService = global.zeroGContractService;

        if (!contractService?.inftContract) {
            return res.status(404).json({ error: 'INFT contract not connected' });
        }

        try {
            const data = await contractService.queryNFTData(tokenId);
            if (!data) {
                return res.status(404).json({ error: `Token #${tokenId} does not exist` });
            }

            const owner = await contractService.inftContract.ownerOf(tokenId);
            const uri = await contractService.inftContract.tokenURI(tokenId);

            res.json({
                tokenId,
                owner,
                tokenURI: uri,
                pokerData: {
                    handType: data.handType || data[0],
                    storageRootHash: data.storageRootHash || data[1],
                    timestamp: data.timestamp || data[3]?.toString(),
                    aiAgent: data.aiAgent || data[4],
                    isEncrypted: data.isEncrypted || data[5],
                    rarity: this._getRarity(data.handType || data[0])
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    /**
     * GET /api/0g/ai-status - AI system monitoring
     */
    async getAIStatus(req, res) {
        const aiService = require('../services/AIService');
        res.json(aiService.getStatus());
    }

    // ============ Helpers ============

    _getServiceStatus(service) {
        if (!service || typeof service.getStatus !== 'function') {
            return { available: false };
        }
        try {
            return { available: true, ...service.getStatus() };
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    _getContractStatus() {
        const cs = global.zeroGContractService;
        if (!cs) {
            return { available: false };
        }
        try {
            return cs.getStatus();
        } catch (e) {
            return { available: false, error: e.message };
        }
    }

    _getRarity(handType) {
        const rarityMap = {
            'Royal Flush': { level: 0, label: 'Legendary', color: '#FFD700' },
            'Straight Flush': { level: 1, label: 'Epic', color: '#A55EEA' },
            'Four of a Kind': { level: 2, label: 'Rare', color: '#0070DD' },
            'Full House': { level: 3, label: 'Common', color: '#888888' },
            'Flush': { level: 3, label: 'Common', color: '#888888' },
            'Straight': { level: 3, label: 'Common', color: '#888888' }
        };
        return rarityMap[handType] || { level: 3, label: 'Unknown', color: '#666666' };
    }
}

module.exports = new ZeroGController();
