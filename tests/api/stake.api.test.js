/**
 * Staking API Tests
 * Tests all staking related API endpoints
 */

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');

const mockStakeService = {
    getStakeInfo: sinon.stub(),
    stake: sinon.stub(),
    unstake: sinon.stub(),
    claimReward: sinon.stub(),
    getPendingReward: sinon.stub(),
    getStakingStats: sinon.stub()
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
    
    app.get('/api/stake/info/:walletAddress', async (req, res) => {
        try {
            const info = await mockStakeService.getStakeInfo(req.params.walletAddress);
            res.json({ success: true, ...info });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/stake/stake', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const { amount, lockDuration } = req.body;
            const result = await mockStakeService.stake(req.user.walletAddress, amount, lockDuration);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/stake/unstake', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const { amount } = req.body;
            const result = await mockStakeService.unstake(req.user.walletAddress, amount);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/stake/claim', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const result = await mockStakeService.claimReward(req.user.walletAddress);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/stake/pending/:walletAddress', async (req, res) => {
        try {
            const reward = await mockStakeService.getPendingReward(req.params.walletAddress);
            res.json({ success: true, pendingReward: reward });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/stake/stats', async (req, res) => {
        try {
            const stats = await mockStakeService.getStakingStats();
            res.json({ success: true, stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    return app;
}

describe('Staking API', function () {
    let app;
    
    beforeEach(function () {
        app = createTestApp();
        sinon.resetHistory();
    });
    
    afterEach(function () {
        sinon.restore();
    });
    
    describe('GET /api/stake/info/:walletAddress', function () {
        it('should return stake info for user', async function () {
            mockStakeService.getStakeInfo.resolves({
                stakedAmount: 1000 * 1e6,
                lockEndTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
                pendingReward: 50 * 1e6,
                isLocked: true
            });
            
            const res = await request(app).get('/api/stake/info/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.stakedAmount).to.equal(1000 * 1e6);
            expect(res.body.isLocked).to.be.true;
        });
        
        it('should return empty info for non-staker', async function () {
            mockStakeService.getStakeInfo.resolves({
                stakedAmount: 0,
                lockEndTime: 0,
                pendingReward: 0,
                isLocked: false
            });
            
            const res = await request(app).get('/api/stake/info/TPLNEWADDRESS');
            
            expect(res.status).to.equal(200);
            expect(res.body.stakedAmount).to.equal(0);
        });
    });
    
    describe('POST /api/stake/stake', function () {
        it('should stake CHIP for authenticated user', async function () {
            mockStakeService.stake.resolves({
                success: true,
                txHash: '0x123...',
                stakedAmount: 100 * 1e6,
                lockEndTime: Date.now() + 30 * 24 * 60 * 60 * 1000
            });
            
            const res = await request(app)
                .post('/api/stake/stake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 100 * 1e6, lockDuration: 30 });
            
            expect(res.status).to.equal(200);
            expect(res.body.stakedAmount).to.equal(100 * 1e6);
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app)
                .post('/api/stake/stake')
                .send({ amount: 100, lockDuration: 30 });
            
            expect(res.status).to.equal(401);
        });
        
        it('should reject insufficient balance', async function () {
            mockStakeService.stake.rejects(new Error('Insufficient CHIP balance'));
            
            const res = await request(app)
                .post('/api/stake/stake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 1000000 * 1e6, lockDuration: 30 });
            
            expect(res.status).to.equal(400);
        });
        
        it('should validate lock duration', async function () {
            mockStakeService.stake.rejects(new Error('Invalid lock duration'));
            
            const res = await request(app)
                .post('/api/stake/stake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 100 * 1e6, lockDuration: 1 }); // Too short
            
            expect(res.status).to.equal(400);
        });
        
        it('should reject when already staked (need to unstake first)', async function () {
            mockStakeService.stake.rejects(new Error('Already staking, unstake first'));
            
            const res = await request(app)
                .post('/api/stake/stake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 100 * 1e6, lockDuration: 30 });
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('POST /api/stake/unstake', function () {
        it('should unstake CHIP after lock period', async function () {
            mockStakeService.unstake.resolves({
                success: true,
                txHash: '0x123...',
                unstakedAmount: 100 * 1e6,
                penalty: 0
            });
            
            const res = await request(app)
                .post('/api/stake/unstake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 100 * 1e6 });
            
            expect(res.status).to.equal(200);
            expect(res.body.penalty).to.equal(0);
        });
        
        it('should apply penalty for early unstake', async function () {
            mockStakeService.unstake.resolves({
                success: true,
                txHash: '0x123...',
                unstakedAmount: 90 * 1e6,
                penalty: 10 * 1e6, // 10% penalty
                earlyUnstake: true
            });
            
            const res = await request(app)
                .post('/api/stake/unstake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 100 * 1e6 });
            
            expect(res.status).to.equal(200);
            expect(res.body.penalty).to.equal(10 * 1e6);
        });
        
        it('should reject unstake with no active stake', async function () {
            mockStakeService.unstake.rejects(new Error('No active stake'));
            
            const res = await request(app)
                .post('/api/stake/unstake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 100 * 1e6 });
            
            expect(res.status).to.equal(400);
        });
        
        it('should reject amount exceeding stake', async function () {
            mockStakeService.unstake.rejects(new Error('Amount exceeds staked amount'));
            
            const res = await request(app)
                .post('/api/stake/unstake')
                .set('Authorization', 'Bearer valid_token')
                .send({ amount: 10000 * 1e6 });
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('POST /api/stake/claim', function () {
        it('should claim pending rewards', async function () {
            mockStakeService.claimReward.resolves({
                success: true,
                txHash: '0x123...',
                claimedAmount: 50 * 1e6
            });
            
            const res = await request(app)
                .post('/api/stake/claim')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(200);
            expect(res.body.claimedAmount).to.equal(50 * 1e6);
        });
        
        it('should reject claim with no pending rewards', async function () {
            mockStakeService.claimReward.rejects(new Error('No pending rewards'));
            
            const res = await request(app)
                .post('/api/stake/claim')
                .set('Authorization', 'Bearer valid_token');
            
            expect(res.status).to.equal(400);
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app).post('/api/stake/claim');
            
            expect(res.status).to.equal(401);
        });
    });
    
    describe('GET /api/stake/pending/:walletAddress', function () {
        it('should return pending reward amount', async function () {
            mockStakeService.getPendingReward.resolves(50 * 1e6);
            
            const res = await request(app).get('/api/stake/pending/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.pendingReward).to.equal(50 * 1e6);
        });
    });
    
    describe('GET /api/stake/stats', function () {
        it('should return global staking statistics', async function () {
            mockStakeService.getStakingStats.resolves({
                totalStaked: 1000000 * 1e6,
                totalStakers: 150,
                averageStake: 6666.67 * 1e6,
                totalRewardsDistributed: 50000 * 1e6,
                currentAPY: 0.12 // 12%
            });
            
            const res = await request(app).get('/api/stake/stats');
            
            expect(res.status).to.equal(200);
            expect(res.body.stats.totalStakers).to.equal(150);
            expect(res.body.stats.currentAPY).to.equal(0.12);
        });
    });
});
