const express = require('express');
const router = express.Router();
const ChipService = require('../../services/ChipService');
const { authMiddleware } = require('../../middleware/auth');

/**
 * @route GET /api/chip/balance/:walletAddress
 * @desc Get user's CHIP balance and info
 */
router.get('/balance/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const info = await ChipService.getUserInfo(walletAddress);
        res.json({ success: true, ...info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/vip-status/:walletAddress
 * @desc Get user's VIP status and discount
 */
router.get('/vip-status/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const vipStatus = await ChipService.getVIPStatus(walletAddress);
        res.json({ success: true, ...vipStatus });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/chip/transfer
 * @desc Transfer CHIP tokens (requires auth)
 */
router.post('/transfer', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.user;
        const { to, amount } = req.body;
        
        const result = await ChipService.transfer(walletAddress, to, amount);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
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
router.post('/claim-rewards', authMiddleware, async (req, res) => {
    try {
        const { walletAddress } = req.user;
        const result = await ChipService.claimRewards(walletAddress);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/chip/history/:walletAddress
 * @desc Get user's CHIP transaction history
 */
router.get('/history/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const history = await ChipService.getTransactionHistory(walletAddress, page, limit);
        res.json({ success: true, ...history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
