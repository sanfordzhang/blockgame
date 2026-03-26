/**
 * NFT API Tests
 * Tests all NFT-related API endpoints
 */

const request = require('supertest');
const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');

const mockNFTService = {
    getAchievementTypes: sinon.stub(),
    getPlayerNFTs: sinon.stub(),
    getNFTById: sinon.stub(),
    checkMonthlyLimit: sinon.stub(),
    prepareMint: sinon.stub(),
    getNFTStats: sinon.stub(),
    getNFTMetadata: sinon.stub()
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
    
    app.get('/api/nft/types', (req, res) => {
        const types = mockNFTService.getAchievementTypes();
        res.json({ success: true, types });
    });
    
    app.get('/api/nft/collection/:walletAddress', async (req, res) => {
        try {
            const nfts = await mockNFTService.getPlayerNFTs(req.params.walletAddress);
            res.json({ success: true, nfts });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/nft/:tokenId', async (req, res) => {
        try {
            const nft = await mockNFTService.getNFTById(req.params.tokenId);
            if (!nft) {
                return res.status(404).json({ success: false, error: 'NFT not found' });
            }
            res.json({ success: true, nft });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/nft/limit/:walletAddress/:achievementType', async (req, res) => {
        try {
            const limitInfo = await mockNFTService.checkMonthlyLimit(
                req.params.walletAddress, 
                parseInt(req.params.achievementType)
            );
            res.json({ success: true, ...limitInfo });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.post('/api/nft/prepare-mint', async (req, res) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        try {
            const result = await mockNFTService.prepareMint(req.user.walletAddress, req.body);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/nft/stats/:walletAddress', async (req, res) => {
        try {
            const stats = await mockNFTService.getNFTStats(req.params.walletAddress);
            res.json({ success: true, stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    app.get('/api/nft/metadata/:tokenId', async (req, res) => {
        try {
            const metadata = await mockNFTService.getNFTMetadata(req.params.tokenId);
            res.json(metadata);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    return app;
}

describe('NFT API', function () {
    let app;
    
    beforeEach(function () {
        app = createTestApp();
        sinon.resetHistory();
    });
    
    afterEach(function () {
        sinon.restore();
    });
    
    describe('GET /api/nft/types', function () {
        it('should return all achievement types', function () {
            mockNFTService.getAchievementTypes.returns([
                { id: 1, name: 'Royal Flush', rarity: 'LEGENDARY' },
                { id: 2, name: 'Straight Flush', rarity: 'EPIC' },
                { id: 3, name: 'Four of a Kind', rarity: 'RARE' }
            ]);
            
            const res = request(app).get('/api/nft/types');
            
            return res.then(r => {
                expect(r.status).to.equal(200);
                expect(r.body.types).to.have.length(3);
                expect(r.body.types[0].name).to.equal('Royal Flush');
            });
        });
    });
    
    describe('GET /api/nft/collection/:walletAddress', function () {
        it('should return user NFT collection', async function () {
            mockNFTService.getPlayerNFTs.resolves([
                { tokenId: 1, achievementType: 1, rarity: 'LEGENDARY' },
                { tokenId: 2, achievementType: 3, rarity: 'RARE' }
            ]);
            
            const res = await request(app).get('/api/nft/collection/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.nfts).to.have.length(2);
        });
        
        it('should return empty array for user without NFTs', async function () {
            mockNFTService.getPlayerNFTs.resolves([]);
            
            const res = await request(app).get('/api/nft/collection/TPLNEWADDRESS');
            
            expect(res.status).to.equal(200);
            expect(res.body.nfts).to.have.length(0);
        });
    });
    
    describe('GET /api/nft/:tokenId', function () {
        it('should return NFT details', async function () {
            mockNFTService.getNFTById.resolves({
                tokenId: 1,
                achievementType: 1,
                rarity: 'LEGENDARY',
                owner: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
                claimedAt: Date.now()
            });
            
            const res = await request(app).get('/api/nft/1');
            
            expect(res.status).to.equal(200);
            expect(res.body.nft.tokenId).to.equal(1);
            expect(res.body.nft.rarity).to.equal('LEGENDARY');
        });
        
        it('should return 404 for non-existent NFT', async function () {
            mockNFTService.getNFTById.resolves(null);
            
            const res = await request(app).get('/api/nft/999999');
            
            expect(res.status).to.equal(404);
            expect(res.body.error).to.include('not found');
        });
    });
    
    describe('GET /api/nft/limit/:walletAddress/:achievementType', function () {
        it('should return monthly limit info', async function () {
            mockNFTService.checkMonthlyLimit.resolves({
                limit: 5,
                remaining: 4,
                canMint: true
            });
            
            const res = await request(app).get('/api/nft/limit/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b/1');
            
            expect(res.status).to.equal(200);
            expect(res.body.remaining).to.equal(4);
            expect(res.body.canMint).to.be.true;
        });
        
        it('should return canMint false when limit reached', async function () {
            mockNFTService.checkMonthlyLimit.resolves({
                limit: 5,
                remaining: 0,
                canMint: false
            });
            
            const res = await request(app).get('/api/nft/limit/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b/1');
            
            expect(res.status).to.equal(200);
            expect(res.body.canMint).to.be.false;
        });
    });
    
    describe('POST /api/nft/prepare-mint', function () {
        it('should prepare mint for authenticated user', async function () {
            mockNFTService.prepareMint.resolves({
                signature: {
                    v: 27,
                    r: '0x123...',
                    s: '0x456...',
                    deadline: Date.now() + 3600000
                },
                nonce: 'abc123',
                tokenId: 100
            });
            
            const res = await request(app)
                .post('/api/nft/prepare-mint')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    achievementType: 3,
                    gameSessionId: 'game_123',
                    handData: { holeCards: ['Ah', 'Ad'], board: ['As', 'Ac', 'Kh', '2c', '3d'] }
                });
            
            expect(res.status).to.equal(200);
            expect(res.body.signature).to.exist;
            expect(res.body.nonce).to.exist;
        });
        
        it('should reject unauthenticated user', async function () {
            const res = await request(app)
                .post('/api/nft/prepare-mint')
                .send({ achievementType: 1 });
            
            expect(res.status).to.equal(401);
        });
        
        it('should reject invalid achievement type', async function () {
            mockNFTService.prepareMint.rejects(new Error('Invalid achievement type'));
            
            const res = await request(app)
                .post('/api/nft/prepare-mint')
                .set('Authorization', 'Bearer valid_token')
                .send({ achievementType: 999 });
            
            expect(res.status).to.equal(400);
        });
        
        it('should reject when monthly limit exceeded', async function () {
            mockNFTService.prepareMint.rejects(new Error('Monthly limit exceeded'));
            
            const res = await request(app)
                .post('/api/nft/prepare-mint')
                .set('Authorization', 'Bearer valid_token')
                .send({ achievementType: 1, gameSessionId: 'game_123' });
            
            expect(res.status).to.equal(400);
            expect(res.body.error).to.include('limit exceeded');
        });
        
        it('should reject for non-achievement hands', async function () {
            mockNFTService.prepareMint.rejects(new Error('Hand does not qualify for achievement'));
            
            const res = await request(app)
                .post('/api/nft/prepare-mint')
                .set('Authorization', 'Bearer valid_token')
                .send({
                    achievementType: 3,
                    handData: { holeCards: ['Ah', 'Kd'], board: ['Qc', 'Js', '9d', '2c', '3d'] }
                });
            
            expect(res.status).to.equal(400);
        });
    });
    
    describe('GET /api/nft/stats/:walletAddress', function () {
        it('should return NFT statistics', async function () {
            mockNFTService.getNFTStats.resolves({
                totalNFTs: 5,
                byRarity: {
                    LEGENDARY: 1,
                    EPIC: 1,
                    RARE: 2,
                    COMMON: 1
                },
                byType: {
                    ROYAL_FLUSH: 1,
                    STRAIGHT_FLUSH: 1,
                    FOUR_OF_A_KIND: 2,
                    FLUSH: 1
                }
            });
            
            const res = await request(app).get('/api/nft/stats/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(200);
            expect(res.body.stats.totalNFTs).to.equal(5);
            expect(res.body.stats.byRarity.LEGENDARY).to.equal(1);
        });
    });
    
    describe('GET /api/nft/metadata/:tokenId', function () {
        it('should return NFT metadata in standard format', async function () {
            mockNFTService.getNFTMetadata.resolves({
                name: 'Poker Achievement #1 - Royal Flush',
                description: 'Earned for achieving a Royal Flush',
                image: 'ipfs://Qm...',
                attributes: [
                    { trait_type: 'Achievement', value: 'Royal Flush' },
                    { trait_type: 'Rarity', value: 'LEGENDARY' }
                ]
            });
            
            const res = await request(app).get('/api/nft/metadata/1');
            
            expect(res.status).to.equal(200);
            expect(res.body.name).to.include('Royal Flush');
            expect(res.body.attributes).to.have.length(2);
        });
    });
    
    describe('Error Handling', function () {
        it('should handle service errors gracefully', async function () {
            mockNFTService.getPlayerNFTs.rejects(new Error('Database connection failed'));
            
            const res = await request(app).get('/api/nft/collection/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');
            
            expect(res.status).to.equal(500);
            expect(res.body.success).to.be.false;
        });
    });
});
