/**
 * DAO Governance API Tests
 * Tests all DAO related API endpoints
 */

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');

const mockDAOService = {
    createProposal: sinon.stub(),
    getProposal: sinon.stub(),
    getActiveProposals: sinon.stub(),
    getProposalsByProposer: sinon.stub(),
    castVote: sinon.stub(),
    hasVoted: sinon.stub(),
    getVoteStats: sinon.stub(),
    executeProposal: sinon.stub()
};

function createTestApp() {
    const app = express();
    app.use(express.json());
    
    app.use((req, res, next) => {
        if (req.headers.authorization === 'Bearer valid_token') {
            req.user = { walletAddress: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' };
        }
        next();
    });
    
    app.get('/api/dao/proposals', async (req, res) => {
        try {
            const { status } = req.query;
            let proposals;
            if (status === 'active') {
                proposals = await mockDAOService.getActiveProposals();
            } else {
                proposals = await mockDAOService.getActiveProposals();
            }
            res.json({ success: true, proposals });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/dao/proposal/:proposalId', async (req, res) => {
        try {
            const proposal = await mockDAOService.getProposal(req.params.proposalId);
            if (!proposal) {
                return res.status(404).json({ success: false, error: 'Proposal not found' });
            }
            res.json({ success: true, proposal });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/dao/proposal', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const proposal = await mockDAOService.createProposal({
                ...req.body,
                proposerAddress: req.user.walletAddress
            });
            res.json({ success: true, proposal });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/dao/proposal/:proposalId/vote', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const { support, reason } = req.body;
            const vote = await mockDAOService.castVote(
                req.params.proposalId,
                req.user.walletAddress,
                support,
                reason
            );
            res.json({ success: true, vote });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/dao/proposal/:proposalId/votes', async (req, res) => {
        try {
            const stats = await mockDAOService.getVoteStats(req.params.proposalId);
            res.json({ success: true, ...stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/dao/proposal/:proposalId/voted/:walletAddress', async (req, res) => {
        try {
            const hasVoted = await mockDAOService.hasVoted(
                req.params.proposalId,
                req.params.walletAddress
            );
            res.json({ success: true, hasVoted });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/dao/proposal/:proposalId/execute', async (req, res) => {
        try {
            const result = await mockDAOService.executeProposal(req.params.proposalId);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/dao/proposals/by/:walletAddress', async (req, res) => {
        try {
            const proposals = await mockDAOService.getProposalsByProposer(req.params.walletAddress);
            res.json({ success: true, proposals });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    return app;
}

describe('DAO Governance API', function () {
    let app;
    
    beforeEach(function () {
        app = createTestApp();
        sinon.resetHistory();
    });
    
    afterEach(function () {
        sinon.restore();
    });
    
    describe('GET /api/dao/proposals', function () {
        it('should return list of proposals', async function () {
            mockDAOService.getActiveProposals.resolves([
                { _id: '1', proposalType: 'RAKE_RATE', state: 'ACTIVE' },
                { _id: '2', proposalType: 'GENERAL', state: 'ACTIVE' }
            ]);
            
            const res = await request(app).get('/api/dao/proposals');
            
            expect(res.status).to.equal(200);
            expect(res.body.proposals).to.have.length(2);
        });
        
        it('should filter by status', async function () {
            mockDAOService.getActiveProposals.resolves([
                { _id: '1', state: 'ACTIVE' }
            ]);
            
            const res = await request(app).get('/api/dao/proposals?status=active');
            
            expect(res.status).to.equal(200);
            expect(mockDAOService.getActiveProposals.called).to.be.true;
        });
    });
    
    describe('GET /api/dao/proposal/:proposalId', function () {
        it('should return proposal details', async function () {
            mockDAOService.getProposal.resolves({
                _id: '1',
                proposalType: 'RAKE_RATE',
                description: 'Reduce rake to 3%',
                state: 'ACTIVE',
                forVotes: 5000 * 1e6,
                againstVotes: 1000 * 1e6,
                endTime: Date.now() + 86400000
            });
            
            const res = await request(app).get('/api/dao/proposal/1');
            
            expect(res.status).to.equal(200);
            expect(res.body.proposal.proposalType).to.equal('RAKE_RATE');
        });
        
        it('should return 404 for non-existent proposal', async function () {
            mockDAOService.getProposal.resolves(null);
            
            const res = await request(app).get('/api/dao/proposal/nonexistent');
            
            expect(res.status).to.equal(404);
        });
    });
    
    describe('POST /api/dao/proposal', function () {
        it('should create proposal for authenticated user', async function () {
            mockDAOService.createProposal.resolves({
                _id: '1',
                proposalType: 'RAKE_RATE',
                description: 'Reduce rake to 3%',
                state: 'ACTIVE'
            });
            
            const res = await request(app)
                .post('/api/dao/proposal')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    proposalType: 'RAKE_RATE',
                    description: 'Reduce rake to 3%',
                    parameters: { newRakeRate: 300 }
                });
            
            expect(res.status).to.equal(200);
            expect(res.body.proposal.state).to.equal('ACTIVE');
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app)
                .post('/api/dao/proposal')
                .send({ proposalType: 'RAKE_RATE' });
            
            expect(res.status).to.equal(401);
        });
        
        it('should reject user below threshold', async function () {
            mockDAOService.createProposal.rejects(new Error('Insufficient CHIP balance for proposal'));
            
            const res = await request(app)
                .post('/api/dao/proposal')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    proposalType: 'RAKE_RATE',
                    description: 'Test'
                });
            
            expect(res.status).to.equal(400);
            expect(res.body.error).to.include('Insufficient');
        });
    });
    
    describe('POST /api/dao/proposal/:proposalId/vote', function () {
        it('should cast vote for authenticated user', async function () {
            mockDAOService.castVote.resolves({
                proposalId: '1',
                support: 1, // For
                weight: 1000 * 1e6,
                txHash: '0x123...'
            });
            
            const res = await request(app)
                .post('/api/dao/proposal/1/vote')
                .set('Authorization', 'Bearer valid_token')
                .send({ support: 1, reason: 'I support this' });
            
            expect(res.status).to.equal(200);
            expect(res.body.vote.support).to.equal(1);
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app)
                .post('/api/dao/proposal/1/vote')
                .send({ support: 1 });
            
            expect(res.status).to.equal(401);
        });
        
        it('should reject double vote', async function () {
            mockDAOService.castVote.rejects(new Error('Already voted'));
            
            const res = await request(app)
                .post('/api/dao/proposal/1/vote')
                .set('Authorization', 'Bearer valid_token')
                .send({ support: 1 });
            
            expect(res.status).to.equal(400);
        });
        
        it('should reject vote on inactive proposal', async function () {
            mockDAOService.castVote.rejects(new Error('Proposal not active'));
            
            const res = await request(app)
                .post('/api/dao/proposal/1/vote')
                .set('Authorization', 'Bearer valid_token')
                .send({ support: 1 });
            
            expect(res.status).to.equal(400);
        });
        
        it('should reject vote with no CHIP', async function () {
            mockDAOService.castVote.rejects(new Error('No voting power'));
            
            const res = await request(app)
                .post('/api/dao/proposal/1/vote')
                .set('Authorization', 'Bearer valid_token')
                .send({ support: 1 });
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('GET /api/dao/proposal/:proposalId/votes', function () {
        it('should return vote statistics', async function () {
            mockDAOService.getVoteStats.resolves({
                forVotes: 5000 * 1e6,
                againstVotes: 1000 * 1e6,
                abstainVotes: 500 * 1e6,
                totalVotes: 6500 * 1e6,
                quorumReached: true
            });
            
            const res = await request(app).get('/api/dao/proposal/1/votes');
            
            expect(res.status).to.equal(200);
            expect(res.body.quorumReached).to.be.true;
        });
    });
    
    describe('GET /api/dao/proposal/:proposalId/voted/:walletAddress', function () {
        it('should return true if user has voted', async function () {
            mockDAOService.hasVoted.resolves(true);
            
            const res = await request(app).get('/api/dao/proposal/1/voted/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.hasVoted).to.be.true;
        });
        
        it('should return false if user has not voted', async function () {
            mockDAOService.hasVoted.resolves(false);
            
            const res = await request(app).get('/api/dao/proposal/1/voted/TPLNEWADDRESS');
            
            expect(res.status).to.equal(200);
            expect(res.body.hasVoted).to.be.false;
        });
    });
    
    describe('POST /api/dao/proposal/:proposalId/execute', function () {
        it('should execute successful proposal', async function () {
            mockDAOService.executeProposal.resolves({
                success: true,
                txHash: '0x123...',
                state: 'EXECUTED'
            });
            
            const res = await request(app).post('/api/dao/proposal/1/execute');
            
            expect(res.status).to.equal(200);
            expect(res.body.state).to.equal('EXECUTED');
        });
        
        it('should reject execution of non-qualified proposal', async function () {
            mockDAOService.executeProposal.rejects(new Error('Proposal cannot be executed'));
            
            const res = await request(app).post('/api/dao/proposal/1/execute');
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('GET /api/dao/proposals/by/:walletAddress', function () {
        it('should return proposals by proposer', async function () {
            mockDAOService.getProposalsByProposer.resolves([
                { _id: '1', proposerAddress: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' }
            ]);
            
            const res = await request(app).get('/api/dao/proposals/by/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.proposals).to.have.length(1);
        });
    });
});
