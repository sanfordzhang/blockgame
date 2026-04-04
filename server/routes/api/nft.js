const express = require('express');
const router = express.Router();
const NFTService = require('../../services/NFTService');
const NFTClaim = require('../../models/NFTClaim');
const { authMiddleware } = require('../../middleware/auth');

// NFTService实例（用于牌型检测）
const nftServiceInstance = new (require('../../services/NFTService').NFTService)({
    tronWeb: null,
    contractAddress: null,
    signerPrivateKey: null,
    signerAddress: null
});

/**
 * @route GET /api/nft/types
 * @desc Get all achievement types
 */
router.get('/types', (req, res) => {
    const types = NFTService.getAchievementTypes();
    res.json({ success: true, types });
});

/**
 * @route GET /api/nft/monthly-limit/:typeId
 * @desc Get monthly limit for achievement type
 */
router.get('/monthly-limit/:typeId', async (req, res) => {
    try {
        const { typeId } = req.params;
        const typeIdNum = parseInt(typeId);
        
        // 获取成就类型信息
        const types = NFTService.getAchievementTypes();
        const typeInfo = types.find(t => t.id === typeIdNum);
        
        if (!typeInfo) {
            return res.status(404).json({ success: false, error: 'Invalid achievement type' });
        }
        
        // 尝试从合约获取剩余数量
        let remaining = typeInfo.monthlyLimit;
        try {
            remaining = await NFTService.getMonthlyRemaining(typeIdNum);
        } catch (e) {
            // 使用默认值
        }
        
        res.json({ 
            success: true, 
            typeId: typeIdNum,
            typeName: typeInfo.name,
            monthlyLimit: typeInfo.monthlyLimit,
            remaining: remaining
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/nft/detect
 * @desc Detect achievement from poker hand
 */
router.post('/detect', async (req, res) => {
    try {
        const { holeCards, board, walletAddress } = req.body;
        
        if (!holeCards || !Array.isArray(holeCards)) {
            return res.status(400).json({ success: false, error: 'holeCards required' });
        }
        
        if (!board || !Array.isArray(board)) {
            return res.status(400).json({ success: false, error: 'board required' });
        }
        
        // 检测牌型
        const achievement = nftServiceInstance.checkAchievement(holeCards, board);
        
        res.json({ 
            success: true, 
            holeCards,
            board,
            achievement: achievement,
            hasAchievement: achievement !== null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/collection/:walletAddress
 * @desc Get user's NFT collection
 */
router.get('/collection/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        // 直接使用NFTClaim模型查询数据库
        const nfts = await NFTClaim.findByPlayer(walletAddress);
        console.log('[NFT API] Collection query for', walletAddress, 'found', nfts.length, 'NFTs');
        res.json({ success: true, nfts });
    } catch (error) {
        console.error('[NFT API] Collection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/:tokenId
 * @desc Get NFT details by token ID
 */
router.get('/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        const nft = await NFTService.getNFTById(tokenId);
        if (!nft) {
            return res.status(404).json({ success: false, error: 'NFT not found' });
        }
        res.json({ success: true, nft });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/limit/:walletAddress/:achievementType
 * @desc Check monthly limit for achievement type
 */
router.get('/limit/:walletAddress/:achievementType', async (req, res) => {
    try {
        const { walletAddress, achievementType } = req.params;
        const limitInfo = await NFTService.checkMonthlyLimit(walletAddress, parseInt(achievementType));
        res.json({ success: true, ...limitInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/nft/prepare-mint
 * @desc Prepare NFT mint with signature (requires achievement)
 */
router.post('/prepare-mint', async (req, res) => {
    try {
        const { walletAddress, achievementType, gameSessionId, handData } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'walletAddress required' });
        }

        if (!achievementType) {
            return res.status(400).json({ success: false, error: 'achievementType required' });
        }

        const result = await NFTService.prepareMint(walletAddress, {
            achievementType,
            gameSessionId,
            handData
        });

        res.json(result);
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/stats/:walletAddress
 * @desc Get user's NFT statistics
 */
router.get('/stats/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const stats = await NFTService.getNFTStats(walletAddress);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/metadata/:achievementType/:tokenId
 * @desc Get NFT metadata with achievementType (for contract tokenURI format)
 * Contract returns: baseURI + achievementType + "/" + tokenId
 */
router.get('/metadata/:achievementType/:tokenId', async (req, res) => {
    try {
        const { achievementType, tokenId } = req.params;
        console.log('[NFT API] ========== METADATA REQUEST ==========');
        console.log('[NFT API] Type:', achievementType, 'Token:', tokenId);
        console.log('[NFT API] Headers:', JSON.stringify(req.headers));

        const metadata = await NFTService.getNFTMetadata(tokenId);
        console.log('[NFT API] Metadata attributes:', JSON.stringify(metadata.attributes));
        res.json(metadata);
    } catch (error) {
        console.error('[NFT API] Metadata error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/nft/metadata/:tokenId
 * @desc Get NFT metadata (for external platforms and direct access)
 */
router.get('/metadata/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        console.log('[NFT API] Metadata request for tokenId:', tokenId);
        const metadata = await NFTService.getNFTMetadata(tokenId);
        console.log('[NFT API] Metadata generated:', JSON.stringify(metadata).substring(0, 100));
        res.json(metadata);
    } catch (error) {
        console.error('[NFT API] Metadata error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
