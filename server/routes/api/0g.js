/**
 * 0G API Routes
 * Provides REST endpoints for 0G-specific features
 */

const express = require('express');
const router = express.Router();

function init0GController() {
    try {
        return require('../../controllers/0gController');
    } catch (e) {
        console.log('[0G Routes] Controller not available:', e.message);
        return null;
    }
}

let controller;

// Lazy-load controller on first request
function getController() {
    if (!controller) {
        controller = init0GController();
    }
    return controller;
}

// ============ 0G Status & Health ============

router.get('/status', (req, res) => {
    const ctrl = getController();
    if (ctrl) {
        return ctrl.getStatus(req, res);
    }

    res.json({
        status: 'degraded',
        zerogEnabled: process.env.ZEROG_ENABLED === 'true',
        mode: process.env.BLOCKCHAIN_MODE || 'tron',
        services: {
            storage: !!process.env.ZEROG_STORAGE_INDEXER_RPC,
            da: !!process.env.ZEROG_DA_RPC_URL,
            compute: false
        }
    });
});

// ============ DA Proof Queries ============

router.get('/da-proof/:handId', (req, res) => {
    const ctrl = getController();
    if (ctrl && ctrl.getDAProof) {
        return ctrl.getDAProof(req, res);
    }
    res.status(404).json({ error: 'DA proof not available for this hand' });
});

// ============ Fairness Verification ============

router.get('/fairness-verify/:handId', async (req, res) => {
    const ctrl = getController();
    if (ctrl && ctrl.verifyFairness) {
        return ctrl.verifyFairness(req, res);
    }
    res.json({
        handId: req.params.handId,
        overallValid: null,
        error: 'Fairness verification service not initialized',
        checks: {}
    });
});

// ============ Storage Queries ============

router.get('/storage/:rootHash', (req, res) => {
    const ctrl = getController();
    if (ctrl && ctrl.getStorageFile) {
        return ctrl.getStorageFile(req, res);
    }
    res.status(501).json({ error: 'Storage service not implemented' });
});

// ============ INFT Operations ============

router.post('/mint-inft', async (req, res) => {
    const ctrl = getController();
    if (ctrl && ctrl.mintINFT) {
        return ctrl.mintINFT(req, res);
    }
    res.status(501).json({ error: 'INFT minting not implemented' });
});

router.get('/inft/:tokenId', (req, res) => {
    const ctrl = getController();
    if (ctrl && ctrl.getINFTData) {
        return ctrl.getINFTData(req, res);
    }
    res.status(404).json({ error: `INFT #${req.params.tokenId} not found` });
});

/**
 * @route GET /api/0g/infts/:address
 * @desc Get all INFTs owned by an address
 */
router.get('/infts/:address', (req, res) => {
    const ctrl = getController();
    if (ctrl && ctrl.getINFTsByAddress) {
        return ctrl.getINFTsByAddress(req, res);
    }
    res.json({ success: true, infts: [] });
});

// ============ Balance Queries ============

/**
 * @route GET /api/0g/balance/:walletAddress
 * @desc Get player's custody balance from PokerGame0G contract
 */
router.get('/balance/:walletAddress', async (req, res) => {
    try {
        const { getZeroGService } = require('../../blockchain/blockchainFactory');
        const ZeroGContractService = require('../../blockchain/ZeroGContractService');

        const walletAddress = req.params.walletAddress;
        if (!walletAddress || !walletAddress.startsWith('0x')) {
            return res.status(400).json({ error: 'Invalid EVM address' });
        }

        const zgService = getZeroGService();
        if (!zgService || !zgService.initialized) {
            return res.json({ success: false, balance: '0', error: '0G service not initialized' });
        }

        const zgContractService = new ZeroGContractService();
        zgContractService.init(zgService, process.env.ZEROG_NETWORK || 'testnet');

        const rawBalance = await zgContractService.getCustodyBalance(walletAddress);
        // Convert from wei (smallest unit) to decimal 0G tokens
        const rawNum = BigInt(rawBalance || '0');
        const balanceDecimal = Number(rawNum) / 1e18;
        console.log('[0G API] Balance query:', { player: walletAddress, raw: rawBalance, decimal: balanceDecimal.toFixed(6) });

        res.json({ success: true, balance: balanceDecimal.toString() });
    } catch (error) {
        console.error('[0G API] Balance error:', error.message);
        res.status(500).json({ success: false, balance: '0', error: error.message });
    }
});

// ============ AI System Status ============

router.get('/ai-status', (req, res) => {
    const ctrl = getController();
    if (ctrl && ctrl.getAIStatus) {
        return ctrl.getAIStatus(req, res);
    }

    // Return basic AI status even without full controller
    const aiEnabled = process.env.AI_ENABLED !== 'false';
    res.json({
        running: aiEnabled,
        pid: null,
        uptime: 0,
        activePlayers: 0,
        totalHandsPlayed: 0,
        totalDecisionsMade: 0,
        averageDecisionTimeMs: 0,
        errors: 0,
        modelLoaded: aiEnabled,
        enabled: aiEnabled,
        difficulty: process.env.AI_DEFAULT_DIFFICULTY || 'medium'
    });
});

module.exports = router;
