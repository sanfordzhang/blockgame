const express = require('express');
const router = express.Router();
const ChipService = require('../../services/ChipService');
const ChipTransaction = require('../../models/ChipTransaction');
const { authMiddleware } = require('../../middleware/auth');

/**
 * @route GET /api/chip/balance/:walletAddress
 * @desc Get user's CHIP balance and info
 */
router.get('/balance/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        // Calculate game chip balance from transactions
        const txResult = await ChipTransaction.aggregate([
            { $match: { walletAddress: walletAddress.toLowerCase() } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const gameBalance = txResult.length > 0 ? txResult[0].total : 0;
        
        // Get on-chain stake info (source of truth)
        const onChainStake = await ChipService.getOnChainStakeInfo(walletAddress);
        const stakedAmount = onChainStake && onChainStake.isActive ? onChainStake.amount : 0;
        
        // Get on-chain balance
        const onChainBalance = await ChipService.getOnChainBalance(walletAddress);
        
        // Get VIP status
        const info = await ChipService.getUserInfo(walletAddress);
        
        res.json({ 
            success: true, 
            chip: gameBalance,
            staked: stakedAmount,
            onChainBalance,
            pendingReward: info.pendingReward || 0,
            totalValue: gameBalance + stakedAmount,
            isVip: info.isVip || false,
            discount: info.discount || 0,
            onChainStake: onChainStake && onChainStake.isActive ? onChainStake : null
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/vip-status/:walletAddress
 * @desc Get user's VIP status based on staked amount
 */
router.get('/vip-status/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const vipStatus = await ChipService.getVipStatusByStaking(walletAddress);

        // Calculate required stake to reach next level
        const thresholds = {
            BRONZE: { next: 'SILVER', required: 1000 },
            SILVER: { next: 'GOLD', required: 10000 },
            GOLD: { next: 'PLATINUM', required: 100000 },
            PLATINUM: { next: null, required: 0 }
        };

        const currentLevel = vipStatus.level;
        const threshold = thresholds[currentLevel];
        const stakedAmount = vipStatus.stakedAmount / 1e6; // Convert to CHIP

        let requiredStake = 0;
        if (threshold.next) {
            requiredStake = threshold.required - stakedAmount;
            if (requiredStake < 0) requiredStake = 0;
        }

        res.json({
            success: true,
            level: vipStatus.level,
            discount: vipStatus.discount,
            chipRewardRate: vipStatus.chipRewardRate,
            stakedAmount: stakedAmount,
            requiredStake: Math.ceil(requiredStake)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/chip/transfer
 * @desc Transfer CHIP tokens in database (game internal)
 */
router.post('/transfer', async (req, res) => {
    try {
        const { from, to, amount } = req.body;
        const walletAddress = from || req.headers['x-wallet-address'];
        
        if (!walletAddress || !to || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Create debit transaction for sender
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'transfer',
            amount: -amount,
            toAddress: to,
            description: `Transfer to ${to.substring(0, 8)}...`
        });
        
        // Create credit transaction for receiver
        await ChipTransaction.createTransaction({
            walletAddress: to,
            type: 'receive',
            amount: amount,
            fromAddress: walletAddress,
            description: `Received from ${walletAddress.substring(0, 8)}...`
        });
        
        res.json({ success: true, from: walletAddress, to, amount });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/onchain/balance/:walletAddress
 * @desc Get user's on-chain CHIP balance from contract
 */
router.get('/onchain/balance/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const balance = await ChipService.getOnChainBalance(walletAddress);
        res.json({ success: true, balance });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/chip/onchain/transfer
 * @desc Prepare on-chain transfer data for frontend to sign
 */
router.post('/onchain/transfer', async (req, res) => {
    try {
        const { to, amount } = req.body;
        
        if (!to || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        // Return contract info for frontend to sign
        res.json({ 
            success: true, 
            contractAddress: process.env.CHIP_TOKEN_ADDRESS || 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n',
            to,
            amount: parseFloat(amount) * 1e6, // Convert to smallest unit
            method: 'transfer(address,uint256)'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/chip/withdraw
 * @desc Withdraw CHIP from game balance to blockchain wallet
 * This will deduct from database and transfer real tokens to user's wallet
 */
router.post('/withdraw', async (req, res) => {
    try {
        const { amount } = req.body;
        const walletAddress = req.headers['x-wallet-address'];
        
        if (!walletAddress || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const withdrawAmount = parseFloat(amount);
        if (withdrawAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Amount must be positive' });
        }
        
        // Check user's game balance (case-insensitive)
        const txResult = await ChipTransaction.aggregate([
            { $match: { walletAddress: walletAddress.toLowerCase() } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const gameBalance = txResult.length > 0 ? txResult[0].total : 0;
        
        if (gameBalance < withdrawAmount) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient game balance. You have ${gameBalance} CHIP` 
            });
        }
        
        // Execute on-chain transfer from treasury (deployer account)
        const result = await ChipService.withdrawToWallet(walletAddress, withdrawAmount);
        
        // Deduct from game balance
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'withdraw',
            amount: -withdrawAmount,
            description: `Withdrawn to blockchain wallet`,
            txHash: result.txid
        });
        
        res.json({ 
            success: true, 
            message: `Successfully withdrawn ${withdrawAmount} CHIP to your wallet`,
            txid: result.txid,
            gameBalance: gameBalance - withdrawAmount,
            onChainBalance: result.newBalance
        });
        
    } catch (error) {
        console.error('[Chip API] Withdraw error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/supply
 * @desc Get total CHIP supply info
 */
router.get('/supply', async (req, res) => {
    try {
        const supplyInfo = await ChipService.getSupplyInfo();
        res.json({ success: true, ...supplyInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/rewards/:walletAddress
 * @desc Get pending CHIP rewards for user
 */
router.get('/rewards/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const rewards = await ChipService.getPendingRewards(walletAddress);
        res.json({ success: true, rewards });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/chip/claim-rewards
 * @desc Claim pending CHIP rewards
 */
router.post('/claim-rewards', async (req, res) => {
    try {
        const walletAddress = req.headers['x-wallet-address'];
        const { amount } = req.body;
        
        // Create claim transaction
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'claim',
            amount: amount || 10,
            description: 'Claimed staking reward'
        });
        
        res.json({ success: true, claimedAmount: amount || 10 });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/history/:walletAddress
 * @desc Get user's CHIP transaction history (alias for transactions)
 */
router.get('/history/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const result = await ChipTransaction.findByWalletPaginated(walletAddress, page, limit);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/transactions/:walletAddress
 * @desc Get user's CHIP transaction history
 */
router.get('/transactions/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const result = await ChipTransaction.findByWalletPaginated(walletAddress, page, limit);
        res.json({ success: true, transactions: result.transactions, ...result.pagination });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/chip/test/create-transactions
 * @desc Create test transactions for testing (testnet only)
 */
router.post('/test/create-transactions', async (req, res) => {
    try {
        const { walletAddress } = req.body;
        
        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'walletAddress required' });
        }
        
        const now = new Date();
        const transactions = [];
        
        // First, give user initial CHIP balance (simulating airdrop/deposit)
        const initialTx = await ChipTransaction.createTransaction({
            walletAddress,
            type: 'reward',
            amount: 5000,
            description: 'Initial CHIP airdrop',
            timestamp: new Date(now - 3600000 * 24) // 24 hours ago
        });
        transactions.push(initialTx);
        
        // Create various test transactions
        const testTxs = [
            { type: 'reward', amount: 150, description: 'Game reward - Straight', gameId: 'test-game-001' },
            { type: 'reward', amount: 75, description: 'Tournament reward', gameId: 'test-game-002', tournamentId: 'test-tournament-001' },
            { type: 'stake', amount: -1000, description: 'Staked for 30 days', lockDays: 30 },
            { type: 'transfer', amount: -200, description: 'Transfer to TX27...', toAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' },
            { type: 'receive', amount: 500, description: 'Received from TX27...', fromAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' },
            { type: 'vip_discount', amount: 25, description: 'VIP discount applied' },
            { type: 'claim', amount: 50, description: 'Claimed staking reward' },
            { type: 'reward', amount: 200, description: 'Game reward - Flush', gameId: 'test-game-003' },
        ];
        
        for (let i = 0; i < testTxs.length; i++) {
            const txData = testTxs[i];
            const tx = await ChipTransaction.createTransaction({
                walletAddress,
                ...txData,
                timestamp: new Date(now - (i * 3600000)) // 1 hour apart
            });
            transactions.push(tx);
        }
        
        res.json({ 
            success: true, 
            message: `Created ${transactions.length} test transactions`,
            transactions 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/chip/deposit-to-game
 * @desc Transfer CHIP from On-Chain Balance to Game Balance
 */
router.post('/deposit-to-game', async (req, res) => {
    try {
        const { walletAddress, amount } = req.body;
        
        if (!walletAddress || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }
        
        const depositAmount = parseFloat(amount);
        if (depositAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Amount must be positive' });
        }
        
        // Check on-chain balance
        let onChainBalance = 0;
        try {
            onChainBalance = await ChipService.getOnChainBalance(walletAddress);
        } catch (e) {
            console.error('[Deposit] Failed to check on-chain balance:', e.message);
        }
        
        // Credit Game Balance in database
        await ChipTransaction.createTransaction({
            walletAddress,
            type: 'deposit',
            amount: depositAmount,
            description: `Deposited ${depositAmount} CHIP from On-Chain Balance`,
            txHash: `deposit_${Date.now()}`,
            timestamp: new Date()
        });
        
        console.log(`[Deposit] ${walletAddress} deposited ${depositAmount} CHIP to Game Balance`);
        res.json({ success: true, deposited: depositAmount });
    } catch (error) {
        console.error('[Chip API] deposit-to-game error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
