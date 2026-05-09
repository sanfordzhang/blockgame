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
