const express = require('express');
const router = express.Router();
const TournamentService = require('../../services/TournamentService');
const { authMiddleware, optionalAuth } = require('../../middleware/auth');

/**
 * @route GET /api/tournament/list
 * @desc Get all tournaments with optional filter
 */
router.get('/list', async (req, res) => {
    try {
        const { status, type } = req.query;
        const tournaments = await TournamentService.getTournaments({ status, type });
        res.json({ success: true, tournaments });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/tournament/configs/list
 * @desc Get available tournament configurations
 */
router.get('/configs/list', async (req, res) => {
    try {
        const configs = await TournamentService.getConfigs();
        res.json({ success: true, configs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/tournament/history/:walletAddress
 * @desc Get player tournament history
 * NOTE: Must be before /:tournamentId to avoid route collision
 */
router.get('/history/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const history = await TournamentService.getPlayerHistory(walletAddress);
        res.json({ success: true, history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/tournament/:tournamentId
 * @desc Get tournament details
 */
router.get('/:tournamentId', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const tournament = await TournamentService.getTournamentById(tournamentId);
        if (!tournament) {
            return res.status(404).json({ success: false, error: 'Tournament not found' });
        }
        res.json({ success: true, tournament });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/tournament/create
 * @desc Create a new tournament (admin only, but allows test mode)
 */
router.post('/create', optionalAuth, async (req, res) => {
    try {
        const { configId, startTime, walletAddress } = req.body;
        // Use authenticated user's wallet address or provided address (test mode)
        const creatorAddress = req.user?.walletAddress || walletAddress || 'test-mode';
        const tournament = await TournamentService.createTournament({ configId, startTime, creatorAddress });
        res.json({ success: true, tournament });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/tournament/:tournamentId/join
 * @desc Join a tournament
 */
router.post('/:tournamentId/join', optionalAuth, async (req, res) => {
    try {
        const { tournamentId } = req.params;
        // Use authenticated user's wallet address or provided address (test mode)
        const walletAddress = req.user?.walletAddress || req.body.walletAddress || req.headers['x-wallet-address'];
        
        if (!walletAddress) {
            return res.status(401).json({ success: false, error: 'Authentication required. Please connect your wallet.' });
        }
        
        const result = await TournamentService.joinTournament(tournamentId, walletAddress);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/tournament/:tournamentId/cancel
 * @desc Cancel tournament join
 */
router.post('/:tournamentId/cancel', authMiddleware, async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { walletAddress } = req.user;
        const result = await TournamentService.cancelJoin(tournamentId, walletAddress);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/tournament/:tournamentId/start
 * @desc Start a tournament (server only)
 */
router.post('/:tournamentId/start', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const result = await TournamentService.startTournament(tournamentId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/tournament/:tournamentId/finish
 * @desc Finish a tournament with rankings
 */
router.post('/:tournamentId/finish', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const { rankings } = req.body;
        const result = await TournamentService.finishTournament(tournamentId, rankings);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

/**
 * @route GET /api/tournament/:tournamentId/players
 * @desc Get tournament players
 */
router.get('/:tournamentId/players', async (req, res) => {
    try {
        const { tournamentId } = req.params;
        const players = await TournamentService.getTournamentPlayers(tournamentId);
        res.json({ success: true, players });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @route POST /api/tournament/:tournamentId/claim
 * @desc Claim tournament prize
 */
router.post('/:tournamentId/claim', optionalAuth, async (req, res) => {
    try {
        const { tournamentId } = req.params;
        // Use authenticated user's wallet address or provided address (test mode)
        const walletAddress = req.user?.walletAddress || req.body.walletAddress || req.headers['x-wallet-address'];
        
        if (!walletAddress) {
            return res.status(401).json({ success: false, error: 'Authentication required. Please connect your wallet.' });
        }
        
        const result = await TournamentService.claimPrize(tournamentId, walletAddress);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

module.exports = router;
