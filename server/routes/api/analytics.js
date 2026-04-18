/**
 * Analytics API Routes
 * Endpoints for access log collection and statistics
 */

const express = require('express');
const router = express.Router();
const AccessLogService = require('../../services/AccessLogService');

// ============================================================
// POST /api/analytics/log — Receive frontend pageview logs
// ============================================================
router.post('/log', async (req, res) => {
    try {
        let logsArray;

        // Support both formats:
        // 1) { logs: [...] } — batch format
        // 2) { sessionId, path, ... } — single log object (legacy compat)
        if (req.body.logs && Array.isArray(req.body.logs)) {
            logsArray = req.body.logs;
        } else if (req.body.sessionId && req.body.path && req.body.entryTime) {
            logsArray = [req.body];
        } else if (Array.isArray(req.body)) {
            logsArray = req.body;
        } else {
            return res.status(400).json({
                success: false,
                error: 'Invalid request body: expected { logs: [...] } or single log object'
            });
        }

        if (logsArray.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'logs array is empty'
            });
        }

        const result = await AccessLogService.saveLogs(logsArray);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.json({
            success: true,
            received: result.received
        });

    } catch (err) {
        console.error('[Analytics API] POST /log error:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// ============================================================
// GET /api/analytics/stats — Overview statistics
// Query params: from, to (YYYY-MM-DD, default last 30 days)
// ============================================================
router.get('/stats', async (req, res) => {
    try {
        const { from, to } = req.query;
        const stats = await AccessLogService.getStats(from, to);
        return res.json(stats);
    } catch (err) {
        console.error('[Analytics API] GET /stats error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// ============================================================
// GET /api/analytics/dau — Daily Active Users
// Query params: days (default 7, max 90), or from (date string)
// ============================================================
router.get('/dau', async (req, res) => {
    try {
        const { days, from } = req.query;
        let param = from || (days ? parseInt(days, 10) : undefined);
        const dau = await AccessLogService.getDAU(param);
        return res.json(dau);
    } catch (err) {
        console.error('[Analytics API] GET /dau error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch DAU data'
        });
    }
});

// ============================================================
// GET /api/analytics/user/:walletAddress/trail — User visit trail
// Query params: limit (default 20, max 100)
// ============================================================
router.get('/user/:walletAddress/trail', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const limit = parseInt(req.query.limit, 10) || 20;

        // Validate wallet address format (basic check)
        if (!walletAddress || walletAddress.length < 20) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address'
            });
        }

        const trail = await AccessLogService.getUserTrail(walletAddress, limit);
        return res.json(trail);
    } catch (err) {
        console.error('[Analytics API] GET /user/:addr/trail error:', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch user trail'
        });
    }
});

module.exports = router;
