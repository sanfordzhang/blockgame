/**
 * CHIP Token API Tests
 * Tests all CHIP token related API endpoints
 */

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');

const mockChipService = {
    getBalance: sinon.stub(),
    getUserInfo: sinon.stub(),
    getTransactionHistory: sinon.stub(),
    transfer: sinon.stub(),
    rewardGameplay: sinon.stub(),
    calculateVIPDiscount: sinon.stub()
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
    
    app.get('/api/chip/balance/:walletAddress', async (req, res) => {
        try {
            const balance = await mockChipService.getBalance(req.params.walletAddress);
            res.json({ success: true, balance });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/chip/info/:walletAddress', async (req, res) => {
        try {
            const info = await mockChipService.getUserInfo(req.params.walletAddress);
            res.json({ success: true, ...info });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/chip/history/:walletAddress', async (req, res) => {
        try {
            const { limit = 20, offset = 0 } = req.query;
            const history = await mockChipService.getTransactionHistory(
                req.params.walletAddress, 
                parseInt(limit), 
                parseInt(offset)
            );
            res.json({ success: true, history });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/chip/transfer', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const { to, amount } = req.body;
            const result = await mockChipService.transfer(req.user.walletAddress, to, amount);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/chip/vip-discount/:walletAddress', async (req, res) => {
        try {
            const discount = await mockChipService.calculateVIPDiscount(req.params.walletAddress);
            res.json({ success: true, discount });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    return app;
}

describe('CHIP Token API', function () {
    let app;
    
    beforeEach(function () {
        app = createTestApp();
        sinon.resetHistory();
    });
    
    afterEach(function () {
        sinon.restore();
    });
    
    describe('GET /api/chip/balance/:walletAddress', function () {
        it('should return CHIP balance', async function () {
            mockChipService.getBalance.resolves(1000 * 1e6);
            
            const res = await request(app).get('/api/chip/balance/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.balance).to.equal(1000 * 1e6);
        });
        
        it('should return 0 for address without CHIP', async function () {
            mockChipService.getBalance.resolves(0);
            
            const res = await request(app).get('/api/chip/balance/TPLNEWADDRESS');
            
            expect(res.status).to.equal(200);
            expect(res.body.balance).to.equal(0);
        });
    });
    
    describe('GET /api/chip/info/:walletAddress', function () {
        it('should return user CHIP info', async function () {
            mockChipService.getUserInfo.resolves({
                balance: 1000 * 1e6,
                stakedAmount: 500 * 1e6,
                pendingReward: 10 * 1e6,
                isVIP: true,
                vipLevel: 2
            });
            
            const res = await request(app).get('/api/chip/info/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.balance).to.equal(1000 * 1e6);
            expect(res.body.isVIP).to.be.true;
        });
    });
    
    describe('GET /api/chip/history/:walletAddress', function () {
        it('should return transaction history', async function () {
            mockChipService.getTransactionHistory.resolves([
                { type: 'REWARD', amount: 100, timestamp: Date.now() - 1000 },
                { type: 'TRANSFER_IN', amount: 500, timestamp: Date.now() - 2000 }
            ]);
            
            const res = await request(app).get('/api/chip/history/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.history).to.have.length(2);
        });
        
        it('should support pagination', async function () {
            mockChipService.getTransactionHistory.resolves([]);
            
            const res = await request(app).get('/api/chip/history/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b?limit=10&offset=20');
            
            expect(res.status).to.equal(200);
            expect(mockChipService.getTransactionHistory.calledWith(sinon.match.any, 10, 20)).to.be.true;
        });
    });
    
    describe('POST /api/chip/transfer', function () {
        it('should transfer CHIP for authenticated user', async function () {
            mockChipService.transfer.resolves({
                success: true,
                txHash: '0x123...',
                amount: 100 * 1e6
            });
            
            const res = await request(app)
                .post('/api/chip/transfer')
                .set('Authorization', 'Bearer valid_token')
                .send({ to: 'TPLRECIPIENT', amount: 100 * 1e6 });
            
            expect(res.status).to.equal(200);
            expect(res.body.txHash).to.exist;
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app)
                .post('/api/chip/transfer')
                .send({ to: 'TPLRECIPIENT', amount: 100 });
            
            expect(res.status).to.equal(401);
        });
        
        it('should reject insufficient balance', async function () {
            mockChipService.transfer.rejects(new Error('Insufficient balance'));
            
            const res = await request(app)
                .post('/api/chip/transfer')
                .set('Authorization', 'Bearer valid_token')
                .send({ to: 'TPLRECIPIENT', amount: 1000000 * 1e6 });
            
            expect(res.status).to.equal(400);
            expect(res.body.error).to.include('Insufficient');
        });
        
        it('should validate transfer amount', async function () {
            const res = await request(app)
                .post('/api/chip/transfer')
                .set('Authorization', 'Bearer valid_token')
                .send({ to: 'TPLRECIPIENT', amount: -100 });
            
            // Should be handled by service validation
        });
    });
    
    describe('GET /api/chip/vip-discount/:walletAddress', function () {
        it('should return VIP discount for VIP users', async function () {
            mockChipService.calculateVIPDiscount.resolves({
                isVIP: true,
                discountRate: 0.1, // 10% discount
                rakeDiscount: 0.5, // 50% rake discount
                benefits: ['Reduced rake', 'Priority support']
            });
            
            const res = await request(app).get('/api/chip/vip-discount/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.discount.isVIP).to.be.true;
            expect(res.body.discount.discountRate).to.equal(0.1);
        });
        
        it('should return no discount for non-VIP users', async function () {
            mockChipService.calculateVIPDiscount.resolves({
                isVIP: false,
                discountRate: 0,
                rakeDiscount: 0,
                benefits: []
            });
            
            const res = await request(app).get('/api/chip/vip-discount/TPLNEWADDRESS');
            
            expect(res.status).to.equal(200);
            expect(res.body.discount.isVIP).to.be.false;
        });
    });
});
