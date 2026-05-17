/**
 * 0G Controller - Handles requests for 0G-specific API endpoints
 */

const config = require('../config');
const path = require('path');

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
     * GET /api/0g/infts/:address - Get all INFTs owned by an address
     * Uses direct RPC call (doesn't depend on global contractService.inftContract)
     */
    async getINFTsByAddress(req, res) {
        const { address } = req.params;

        try {
            const { getZeroGService } = require('../blockchain/blockchainFactory');
            const ZeroGContractService = require('../blockchain/ZeroGContractService');
            const fs = require('fs');

            const zgService = getZeroGService();
            if (!zgService || !zgService.initialized || !zgService.provider) {
                return res.json({ success: true, infts: [], error: '0G service not initialized' });
            }

            // Create our own INFT contract instance (don't rely on global one)
            let inftAbi = null;
            const abiDir = path.resolve(__dirname, '../artifacts/contracts/0g/PokerHandINFT.sol/PokerHandINFT.json');
            try {
                console.log('[0G] Trying ABI path:', abiDir);
                console.log('[0G] File exists:', fs.existsSync(abiDir));
                inftAbi = JSON.parse(fs.readFileSync(abiDir, 'utf8')).abi;
                console.log('[0G] INFT ABI loaded, functions:', inftAbi?.length);
            } catch(abiErr) {
                console.error('[0G] ABI load error:', abiErr.message);
                // Try alternative paths
                const altPaths = [
                    path.resolve(__dirname, '../artifacts/contracts/0g/PokerHandINFT.json'),
                    path.resolve(__dirname, '../../artifacts/contracts/0g/PokerHandINFT.sol/PokerHandINFT.json')
                ];
                for (const ap of altPaths) {
                    try {
                        if (fs.existsSync(ap)) {
                            inftAbi = JSON.parse(fs.readFileSync(ap, 'utf8')).abi;
                            console.log('[0G] INFT ABI loaded from alt:', ap);
                            break;
                        }
                    } catch(e2) {}
                }
            }

            if (!inftAbi) {
                console.error('[0G] Could not load PokerHandINFT ABI');
                return res.json({ success: true, infts: [], error: 'INFT ABI not available' });
            }

            // Get INFT address from env var directly
            const inftAddr = process.env.ZEROG_INFT_ADDRESS || '0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5';

            // Create INFT contract using same ethers version as ZeroGService (v6)
            const ethers6 = require('ethers6');
            const inftContract = new ethers6.Contract(
                inftAddr, inftAbi, zgService.provider
            );

            // Query balanceOf
            const balance = await inftContract.balanceOf(address);
            const count = parseInt(balance.toString());

            if (count === 0) {
                return res.json({ success: true, infts: [], count: 0 });
            }

            const tokenIds = new Set();

            // Prefer indexed mint events. Token IDs are not guaranteed to be 1..balance.
            try {
                const mintFilter = inftContract.filters.PokerHandMinted(null, null, address);
                const events = await inftContract.queryFilter(mintFilter, 0, 'latest');
                events.forEach((event) => {
                    const tokenId = event?.args?.tokenId;
                    if (tokenId !== undefined) tokenIds.add(tokenId.toString());
                });
            } catch (eventErr) {
                console.warn('[0G] Mint event query failed:', eventErr.message);
            }

            // Database fallback for locally minted achievements.
            try {
                const NFTClaim = require('../models/NFTClaim');
                const claims = await NFTClaim.find({
                    playerAddress: address.toLowerCase(),
                    onchainTokenId: { $ne: null }
                }).sort({ claimedAt: -1 }).limit(50);
                claims.forEach((claim) => tokenIds.add(String(claim.onchainTokenId)));
            } catch (dbErr) {
                console.warn('[0G] NFTClaim fallback failed:', dbErr.message);
            }

            // Last-resort bounded scan for older local deployments.
            if (tokenIds.size === 0) {
                for (let i = 1; i <= 200; i++) {
                    try {
                        const owner = await inftContract.ownerOf(i);
                        if (owner.toLowerCase() === address.toLowerCase()) {
                            tokenIds.add(String(i));
                            if (tokenIds.size >= count) break;
                        }
                    } catch(e) {
                        // Skip gaps/nonexistent token ids.
                    }
                }
            }

            const claimsByOnchainTokenId = new Map();
            try {
                const NFTClaim = require('../models/NFTClaim');
                const claims = await NFTClaim.find({
                    playerAddress: address.toLowerCase(),
                    onchainTokenId: { $in: Array.from(tokenIds).map((id) => parseInt(id, 10)).filter(Number.isFinite) }
                }).sort({ claimedAt: -1 }).limit(100);
                claims.forEach((claim) => claimsByOnchainTokenId.set(String(claim.onchainTokenId), claim));
            } catch (dbErr) {
                console.warn('[0G] NFTClaim enrichment failed:', dbErr.message);
            }

            // Query each token
            const infts = [];
            for (const tokenId of Array.from(tokenIds).slice(0, 50)) {
                try {
                    let owner;
                    try { owner = await inftContract.ownerOf(tokenId); } catch(e) { continue; }
                    if (owner.toLowerCase() !== address.toLowerCase()) continue;

                    const uri = await inftContract.tokenURI(tokenId);

                    // Decode metadata
                    let metadataImage = null, metadataName = '';
                    if (uri && uri.startsWith('data:application/json;base64,')) {
                        try {
                            const b64 = uri.split(',')[1];
                            if (b64) {
                                const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
                                metadataImage = json.image || null;
                                metadataName = json.name || '';
                            }
                        } catch(e) {}
                    }

                    // Try getPokerData
                    let pokerData = {};
                    try {
                        const pd = await inftContract.getPokerData(tokenId);
                        pokerData = {
                            handType: pd?.handType || pd?.[0],
                            storageRootHash: pd?.storageRootHash || pd?.[1],
                            rarity: this._getRarity(pd?.handType || pd?.[0])
                        };
                    } catch(e) { /* no poker data */ }

                    const claim = claimsByOnchainTokenId.get(String(tokenId));

                    infts.push({
                        tokenId: parseInt(tokenId, 10),
                        owner,
                        tokenURI: uri,
                        metadataURI: uri,
                        metadataImage,
                        metadataName,
                        handType: pokerData.handType || 6,
                        storageRootHash: pokerData.storageRootHash,
                        rarity: pokerData.rarity,
                        mintedAt: claim?.mintedAt || claim?.claimedAt || new Date().toISOString(),
                        gameId: claim?.gameId || null,
                        gameScreenshot: claim?.gameScreenshot || null,
                        screenshotFormat: claim?.screenshotFormat || 'png',
                        cards: claim?.cards || []
                    });
                } catch(e) {
                    console.error(`[0G] Error fetching token ${tokenId}:`, e.message);
                }
            }

            console.log(`[0G] INFT query for ${address}: ${infts.length} tokens found`);
            res.json({ success: true, infts, count: infts.length });

        } catch(error) {
            console.error('[0G] getINFTsByAddress error:', error.message);
            res.json({ success: true, infts: [], error: error.message });
        }
    }

    /**
     * GET /api/0g/ai-status - AI system monitoring
     */
    async getAIStatus(req, res) {
        const aiService = require('../services/ai/AIService');
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
