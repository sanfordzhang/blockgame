const express = require('express');
const router = express.Router();
const ChipService = require('../../services/ChipService');
const ChipTransaction = require('../../models/ChipTransaction');

/**
 * @route GET /api/stake/info/:walletAddress
 * @desc Get user's on-chain staking info
 */
router.get('/info/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const stakeInfo = await ChipService.getOnChainStakeInfo(walletAddress);
        const pendingReward = await ChipService.getPendingStakeReward(walletAddress);
        
        res.json({ 
            success: true, 
            stake: stakeInfo,
            pendingReward
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/stake/history/:walletAddress
 * @desc Get user's staking info (on-chain) + transaction history
 */
router.get('/history/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        // Get on-chain stake info
        const onChainStake = await ChipService.getOnChainStakeInfo(walletAddress);
        
        // Build stakes array for frontend
        let stakes = [];
        if (onChainStake && onChainStake.isActive && onChainStake.amount > 0) {
            stakes.push({
                _id: 'on-chain',
                amount: onChainStake.amount,
                lockDays: onChainStake.remainingLockDays || 0,
                startTime: onChainStake.startTime,
                unlockAt: onChainStake.lockedUntil,
                pendingReward: await ChipService.getPendingStakeReward(walletAddress),
                isActive: true,
                isLocked: onChainStake.isLocked
            });
        }
        
        res.json({ 
            success: true, 
            stakes,
            onChainStake: onChainStake && onChainStake.isActive ? onChainStake : null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/stake/prepare/:walletAddress
 * @desc Prepare stake transaction data for frontend to sign
 */
router.get('/prepare/:walletAddress', async (req, res) => {
    try {
        const { amount, lockDays } = req.query;
        
        if (!amount || !lockDays) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing amount or lockDays' 
            });
        }
        
        const lockDurationSeconds = parseInt(lockDays) * 24 * 60 * 60;
        const stakeData = ChipService.prepareStakeData(parseFloat(amount), lockDurationSeconds);
        
        res.json({ 
            success: true, 
            ...stakeData,
            instructions: [
                '1. First call approve on CHIP token contract',
                '2. Then call stake on staking contract',
                'Frontend should handle this via TronLink'
            ]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/create
 * @desc Log stake transaction (called after user successfully stakes on-chain)
 * This only records the transaction in history, doesn't create database stake
 */
router.post('/create', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;
        const { amount, lockDays, txHash } = req.body;
        
        if (!walletAddress || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Just log the transaction (no database stake record)
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'stake',
            amount: -amount,
            lockDays,
            txHash,
            description: `Staked ${amount} CHIP for ${lockDays} days (on-chain)`
        });
        
        res.json({ 
            success: true, 
            message: 'Stake transaction logged',
            note: 'Actual stake data is on blockchain'
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/unstake
 * @desc Prepare unstake transaction data
 */
router.post('/unstake', async (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount) {
            return res.status(400).json({ success: false, error: 'Missing amount' });
        }
        
        const unstakeData = ChipService.prepareUnstakeData(parseFloat(amount));
        
        res.json({ 
            success: true, 
            ...unstakeData,
            note: 'Call unstake on staking contract via TronLink'
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/log-unstake
 * @desc Log unstake transaction (called after user successfully unstakes on-chain)
 * Note: amount is NOT recorded to Game Balance since chain already transferred
 */
router.post('/log-unstake', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;
        const { amount, txHash, penalty } = req.body;

        // Note: We record the transaction for history but with amount 0
        // because the chain already transferred the unstake directly to wallet
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'unstake',
            amount: 0,  // Set to 0 to avoid affecting Game Balance
            txHash,
            description: `Unstaked ${amount} CHIP on-chain (penalty: ${penalty || 0})`
        });

        res.json({ success: true, message: 'Unstake logged (not added to Game Balance)' });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/stake/claim-prepare
 * @desc Prepare claim reward transaction data
 */
router.get('/claim-prepare', async (req, res) => {
    try {
        const claimData = ChipService.prepareClaimRewardData();
        
        res.json({ 
            success: true, 
            ...claimData,
            note: 'Call claimReward on staking contract via TronLink'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/stake/claim-reward
 * @desc Log claim transaction (called after user successfully claims on-chain)
 * Note: amount is NOT recorded to Game Balance since chain already transferred
 */
router.post('/claim-reward', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'] || req.body.walletAddress;
        const { amount, txHash } = req.body;

        // Note: We record the transaction for history but with amount 0
        // because the chain already transferred the reward directly to wallet
        // If we record the amount, it would double-count in Game Balance
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'claim',
            amount: 0,  // Set to 0 to avoid double-counting in Game Balance
            txHash,
            description: `Claimed staking reward (${amount || 'unknown'} CHIP on-chain)`
        });

        res.json({ success: true, message: 'Claim logged (not added to Game Balance)' });
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

/**
 * @route GET /api/stake/contracts
 * @desc Get staking contract addresses
 */
router.get('/contracts', (req, res) => {
    res.json({
        success: true,
        stakingContract: process.env.STAKING_CONTRACT_ADDRESS,
        chipToken: process.env.CHIP_TOKEN_ADDRESS
    });
});

module.exports = router;
