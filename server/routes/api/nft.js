const express = require('express');
const router = express.Router();
const NFTService = require('../../services/NFTService');
const { authMiddleware } = require('../../middleware/auth');

/**
 * @route GET /api/nft/types
 * @desc Get all achievement types
 */
router.get('/types', (req, res) => {
    const types = NFTService.getAchievementTypes();
    res.json({ success: true, types });
});

/**
 * @route GET /api/nft/collection/:walletAddress
 * @desc Get user's NFT collection
 */
router.get('/collection/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const nfts = await NFTService.getPlayerNFTs(walletAddress);
        res.json({ success: true, nfts });
    } catch (error) {
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
router.post('/prepare-mint', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.user;
        const { achievementType, gameSessionId, handData } = req.body;
        
        const result = await NFTService.prepareMint(walletAddress, {
            achievementType,
            gameSessionId,
            handData
        });
        
        res.json({ success: true, ...result });
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
 * @route GET /api/nft/metadata/:tokenId
 * @desc Get NFT metadata (for external platforms)
 */
router.get('/metadata/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        const metadata = await NFTService.getNFTMetadata(tokenId);
        res.json(metadata);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
