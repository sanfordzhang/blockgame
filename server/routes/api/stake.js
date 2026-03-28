const express = require('express');
const router = express.Router();
const Stake = require('../../models/Stake');
const ChipTransaction = require('../../models/ChipTransaction');
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
router.post('/create', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;
        const { amount, lockDays } = req.body;
        
        if (!walletAddress || !amount || !lockDays) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const startTime = new Date();
        const lockedUntil = new Date(startTime.getTime() + lockDays * 24 * 60 * 60 * 1000);
        
        const stake = new Stake({
            playerAddress: walletAddress.toLowerCase(),
            amount,
            lockDuration: lockDays,
            startTime,
            lockedUntil,
            isActive: true
        });
        await stake.save();
        
        // Create stake transaction
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'stake',
            amount: -amount,
            stakeId: stake._id,
            lockDays,
            description: `Staked ${amount} CHIP for ${lockDays} days`
        });
        
        res.json({ success: true, stake });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/unstake
 * @desc Unstake tokens (with penalty if early)
 */
router.post('/unstake', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;
        const { stakeId } = req.body;
        
        const stake = await Stake.findById(stakeId);
        if (!stake || stake.playerAddress !== walletAddress.toLowerCase()) {
            return res.status(404).json({ success: false, error: 'Stake not found' });
        }
        
        stake.unstake(0.1);
        await stake.save();
        
        // Create unstake transaction
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'unstake',
            amount: stake.unstakeAmount,
            stakeId: stake._id,
            description: `Unstaked ${stake.unstakeAmount} CHIP`
        });
        
        res.json({ success: true, stake });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/claim-reward
 * @desc Claim staking rewards
 */
router.post('/claim-reward', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;
        const { stakeId, amount } = req.body;
        
        // Create claim transaction
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'claim',
            amount: amount || 10,
            stakeId,
            description: 'Claimed staking reward'
        });
        
        res.json({ success: true, claimedAmount: amount || 10 });
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
        
        const stakes = await Stake.find({ playerAddress: walletAddress.toLowerCase() })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));
            
        const total = await Stake.countDocuments({ playerAddress: walletAddress.toLowerCase() });
        
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
