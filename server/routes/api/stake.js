const express = require('express');
const router = express.Router();
const Stake = require('../../models/Stake');
const ChipService = require('../../services/ChipService');
const { authMiddleware } = require('../../middleware/auth');

/**
 * @route GET /api/stake/info/:walletAddress
 * @desc Get user's staking info
 */
router.get('/info/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const stakeInfo = await ChipService.getStakeInfo(walletAddress);
        res.json({ success: true, ...stakeInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/create
 * @desc Create a new stake
 */
router.post('/create', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.user;
        const { amount, lockDays } = req.body;
        
        const result = await ChipService.createStake(walletAddress, amount, lockDays);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/unstake
 * @desc Unstake tokens (with penalty if early)
 */
router.post('/unstake', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.user;
        const { stakeId } = req.body;
        
        const result = await ChipService.unstake(walletAddress, stakeId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/claim-reward
 * @desc Claim staking rewards
 */
router.post('/claim-reward', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.user;
        const { stakeId } = req.body;
        
        const result = await ChipService.claimStakeReward(walletAddress, stakeId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/stake/pending-reward/:walletAddress
 * @desc Get pending staking reward
 */
router.get('/pending-reward/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const pending = await ChipService.getPendingStakeReward(walletAddress);
        res.json({ success: true, pending });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/stake/history/:walletAddress
 * @desc Get user's staking history
 */
router.get('/history/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        const stakes = await Stake.find({ walletAddress })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
            
        const total = await Stake.countDocuments({ walletAddress });
        
        res.json({ 
            success: true, 
            stakes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/stake/stats
 * @desc Get global staking statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await ChipService.getStakingStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
