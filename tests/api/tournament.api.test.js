/**
 * Tournament API Tests
 * Tests all tournament-related API endpoints
 */

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');

// Mock dependencies
const mockTournamentService = {
    getTournaments: sinon.stub(),
    getTournamentById: sinon.stub(),
    getConfigs: sinon.stub(),
    createTournament: sinon.stub(),
    joinTournament: sinon.stub(),
    cancelJoin: sinon.stub(),
    startTournament: sinon.stub(),
    finishTournament: sinon.stub(),
    getTournamentPlayers: sinon.stub(),
    getPlayerHistory: sinon.stub(),
    claimPrize: sinon.stub()
};

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    
    // Mock auth middleware
    app.use((req, res, next) => {
        if (req.headers.authorization === 'Bearer valid_token') {
            req.user = { walletAddress: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' };
        } else if (req.headers.authorization === 'Bearer admin_token') {
            req.user = { walletAddress: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b', isAdmin: true };
        }
        next();
    });
    
    // Tournament routes
    app.get('/api/tournament/list', async (req, res) => {
        try {
            const { status, type } = req.query;
            const tournaments = await mockTournamentService.getTournaments({ status, type });
            res.json({ success: true, tournaments });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/tournament/:tournamentId', async (req, res) => {
        try {
            const tournament = await mockTournamentService.getTournamentById(req.params.tournamentId);
            if (!tournament) {
                return res.status(404).json({ success: false, error: 'Tournament not found' });
            }
            res.json({ success: true, tournament });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/tournament/configs/list', async (req, res) => {
        try {
            const configs = await mockTournamentService.getConfigs();
            res.json({ success: true, configs });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/tournament/create', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const tournament = await mockTournamentService.createTournament(req.body);
            res.json({ success: true, tournament });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/tournament/:tournamentId/join', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const result = await mockTournamentService.joinTournament(
                req.params.tournamentId, 
                req.user.walletAddress
            );
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/tournament/:tournamentId/cancel', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const result = await mockTournamentService.cancelJoin(
                req.params.tournamentId, 
                req.user.walletAddress
            );
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/tournament/:tournamentId/start', async (req, res) => {
        try {
            const result = await mockTournamentService.startTournament(req.params.tournamentId);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/tournament/:tournamentId/finish', async (req, res) => {
        try {
            const result = await mockTournamentService.finishTournament(
                req.params.tournamentId, 
                req.body.rankings
            );
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/tournament/:tournamentId/players', async (req, res) => {
        try {
            const players = await mockTournamentService.getTournamentPlayers(req.params.tournamentId);
            res.json({ success: true, players });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/tournament/history/:walletAddress', async (req, res) => {
        try {
            const history = await mockTournamentService.getPlayerHistory(req.params.walletAddress);
            res.json({ success: true, history });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/tournament/:tournamentId/claim', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const result = await mockTournamentService.claimPrize(
                req.params.tournamentId, 
                req.user.walletAddress
            );
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    return app;
}

describe('Tournament API', function () {
    let app;
    
    beforeEach(function () {
        app = createTestApp();
        sinon.resetHistory();
    });
    
    afterEach(function () {
        sinon.restore();
    });
    
    describe('GET /api/tournament/list', function () {
        it('should return list of tournaments', async function () {
            const mockTournaments = [
                { _id: '1', status: 'WAITING', config: { playerCount: 2 } },
                { _id: '2', status: 'IN_PROGRESS', config: { playerCount: 6 } }
            ];
            mockTournamentService.getTournaments.resolves(mockTournaments);
            
            const res = await request(app).get('/api/tournament/list');
            
            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
            expect(res.body.tournaments).to.have.length(2);
        });
        
        it('should filter by status', async function () {
            mockTournamentService.getTournaments.resolves([
                { _id: '1', status: 'WAITING' }
            ]);
            
            const res = await request(app).get('/api/tournament/list?status=WAITING');
            
            expect(res.status).to.equal(200);
            expect(mockTournamentService.getTournaments.calledWith({ status: 'WAITING', type: undefined })).to.be.true;
        });
        
        it('should handle errors', async function () {
            mockTournamentService.getTournaments.rejects(new Error('Database error'));
            
            const res = await request(app).get('/api/tournament/list');
            
            expect(res.status).to.equal(500);
            expect(res.body.success).to.be.false;
            expect(res.body.error).to.include('Database error');
        });
    });
    
    describe('GET /api/tournament/:tournamentId', function () {
        it('should return tournament details', async function () {
            const mockTournament = {
                _id: '1',
                status: 'WAITING',
                config: { playerCount: 2, buyIn: 100e6 },
                players: ['TPL111', 'TPL222']
            };
            mockTournamentService.getTournamentById.resolves(mockTournament);
            
            const res = await request(app).get('/api/tournament/1');
            
            expect(res.status).to.equal(200);
            expect(res.body.tournament._id).to.equal('1');
        });
        
        it('should return 404 for non-existent tournament', async function () {
            mockTournamentService.getTournamentById.resolves(null);
            
            const res = await request(app).get('/api/tournament/nonexistent');
            
            expect(res.status).to.equal(404);
            expect(res.body.error).to.include('not found');
        });
    });
    
    describe('POST /api/tournament/create', function () {
        it('should create tournament for authenticated user', async function () {
            mockTournamentService.createTournament.resolves({
                _id: '1',
                status: 'WAITING'
            });
            
            const res = await request(app)
                .post('/api/tournament/create')
                .set('Authorization', 'Bearer valid_token')
                .send({ configId: 1 });
            
            expect(res.status).to.equal(200);
            expect(res.body.success).to.be.true;
            expect(res.body.tournament).to.exist;
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app)
                .post('/api/tournament/create')
                .send({ configId: 1 });
            
            expect(res.status).to.equal(401);
        });
        
        it('should handle invalid config', async function () {
            mockTournamentService.createTournament.rejects(new Error('Invalid config'));
            
            const res = await request(app)
                .post('/api/tournament/create')
                .set('Authorization', 'Bearer valid_token')
                .send({ configId: 999 });
            
            expect(res.status).to.equal(400);
            expect(res.body.error).to.include('Invalid config');
        });
    });
    
    describe('POST /api/tournament/:tournamentId/join', function () {
        it('should allow authenticated user to join', async function () {
            mockTournamentService.joinTournament.resolves({
                success: true,
                seatId: 1,
                buyIn: 100e6
            });
            
            const res = await request(app)
                .post('/api/tournament/1/join')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(200);
            expect(res.body.seatId).to.equal(1);
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app)
                .post('/api/tournament/1/join');
            
            expect(res.status).to.equal(401);
        });
        
        it('should reject join for full tournament', async function () {
            mockTournamentService.joinTournament.rejects(new Error('Tournament is full'));
            
            const res = await request(app)
                .post('/api/tournament/1/join')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(400);
            expect(res.body.error).to.include('full');
        });
        
        it('should reject duplicate join', async function () {
            mockTournamentService.joinTournament.rejects(new Error('Already joined'));
            
            const res = await request(app)
                .post('/api/tournament/1/join')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(400);
            expect(res.body.error).to.include('Already joined');
        });
    });
    
    describe('POST /api/tournament/:tournamentId/cancel', function () {
        it('should allow player to cancel', async function () {
            mockTournamentService.cancelJoin.resolves({
                success: true,
                refundAmount: 100e6
            });
            
            const res = await request(app)
                .post('/api/tournament/1/cancel')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(200);
            expect(res.body.refundAmount).to.equal(100e6);
        });
        
        it('should reject cancel for non-joined player', async function () {
            mockTournamentService.cancelJoin.rejects(new Error('Not joined'));
            
            const res = await request(app)
                .post('/api/tournament/1/cancel')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('POST /api/tournament/:tournamentId/start', function () {
        it('should start tournament', async function () {
            mockTournamentService.startTournament.resolves({
                success: true,
                tableId: 'table_1'
            });
            
            const res = await request(app)
                .post('/api/tournament/1/start');
            
            expect(res.status).to.equal(200);
            expect(res.body.tableId).to.exist;
        });
        
        it('should fail with insufficient players', async function () {
            mockTournamentService.startTournament.rejects(new Error('Not enough players'));
            
            const res = await request(app)
                .post('/api/tournament/1/start');
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('POST /api/tournament/:tournamentId/finish', function () {
        it('should finish tournament with rankings', async function () {
            mockTournamentService.finishTournament.resolves({
                success: true,
                prizePool: 190e6
            });
            
            const res = await request(app)
                .post('/api/tournament/1/finish')
                .send({ rankings: ['TPL111', 'TPL222'] });
            
            expect(res.status).to.equal(200);
        });
    });
    
    describe('GET /api/tournament/:tournamentId/players', function () {
        it('should return list of players', async function () {
            mockTournamentService.getTournamentPlayers.resolves([
                { address: 'TPL111', seatId: 1, status: 'active' },
                { address: 'TPL222', seatId: 2, status: 'active' }
            ]);
            
            const res = await request(app).get('/api/tournament/1/players');
            
            expect(res.status).to.equal(200);
            expect(res.body.players).to.have.length(2);
        });
    });
    
    describe('GET /api/tournament/history/:walletAddress', function () {
        it('should return player history', async function () {
            mockTournamentService.getPlayerHistory.resolves([
                { tournamentId: '1', position: 1, prize: 133e6 }
            ]);
            
            const res = await request(app).get('/api/tournament/history/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.history).to.have.length(1);
        });
    });
    
    describe('POST /api/tournament/:tournamentId/claim', function () {
        it('should allow winner to claim prize', async function () {
            mockTournamentService.claimPrize.resolves({
                success: true,
                amount: 133e6,
                txHash: '0x123...'
            });
            
            const res = await request(app)
                .post('/api/tournament/1/claim')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(200);
            expect(res.body.amount).to.equal(133e6);
        });
        
        it('should reject claim for non-winner', async function () {
            mockTournamentService.claimPrize.rejects(new Error('No prize to claim'));
            
            const res = await request(app)
                .post('/api/tournament/1/claim')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('Rate Limiting', function () {
        it('should handle rapid requests', async function () {
            mockTournamentService.getTournaments.resolves([]);
            
            const requests = [];
            for (let i = 0; i < 10; i++) {
                requests.push(request(app).get('/api/tournament/list'));
            }
            
            const responses = await Promise.all(requests);
            const successCount = responses.filter(r => r.status === 200).length;
            
            // All should succeed (no rate limiting in test)
            expect(successCount).to.equal(10);
        });
    });
});
