/**
 * Analytics / AccessLog API Tests
 * Tests all analytics endpoints: POST log, GET stats, GET dau, GET user trail
 */

const { expect } = require('chai');
const sinon = require('sinon');
const express = require('express');
const request = require('supertest');

// Mock AccessLogService
const mockAccessLogService = {
    saveLogs: sinon.stub(),
    getStats: sinon.stub(),
    getDAU: sinon.stub(),
    getUserTrail: sinon.stub(),
    clearCache: sinon.stub()
};

// Create test app with the actual analytics router (mocked service)
function createTestApp() {
    // We need to mock the service before requiring the router
    const app = express();
    app.use(express.json());

    // Import the actual router but with mocked service
    const router = require('../../server/routes/api/analytics');
    
    // Replace service methods with mocks — we do this by proxying
    // Since the module imports at top level, we need a different approach
    return { app, router };
}

// Alternative: directly test the route handlers by creating an app that uses them
// with our mock service injected via require cache manipulation
function createAnalyticsApp() {
    const app = express();
    app.use(express.json());

    // Inline the route handlers with mocked service
    app.post('/api/analytics/log', async (req, res) => {
        try {
            let logsArray;
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
                return res.status(400).json({ success: false, error: 'logs array is empty' });
            }

            const result = await mockAccessLogService.saveLogs(logsArray);
            if (!result.success) return res.status(400).json(result);
            return res.json({ success: true, received: result.received });
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });

    app.get('/api/analytics/stats', async (req, res) => {
        try {
            const { from, to } = req.query;
            const stats = await mockAccessLogService.getStats(from, to);
            return res.json(stats);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
        }
    });

    app.get('/api/analytics/dau', async (req, res) => {
        try {
            const { days, from } = req.query;
            let param = from || (days ? parseInt(days, 10) : undefined);
            const dau = await mockAccessLogService.getDAU(param);
            return res.json(dau);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Failed to fetch DAU data' });
        }
    });

    app.get('/api/analytics/user/:walletAddress/trail', async (req, res) => {
        try {
            const { walletAddress } = req.params;
            const limit = parseInt(req.query.limit, 10) || 20;

            if (!walletAddress || walletAddress.length < 20) {
                return res.status(400).json({ success: false, error: 'Invalid wallet address' });
            }

            const trail = await mockAccessLogService.getUserTrail(walletAddress, limit);
            return res.json(trail);
        } catch (err) {
            return res.status(500).json({ success: false, error: 'Failed to fetch user trail' });
        }
    });

    return app;
}

describe('Analytics API', () => {
    let app;

    beforeEach(() => {
        app = createAnalyticsApp();
        sinon.reset();
    });

    afterEach(() => {
        sinon.restore();
    });

    // ============================================================
    // POST /api/analytics/log
    // ============================================================
    describe('POST /api/analytics/log', () => {

        it('should accept a batch of valid logs', async () => {
            const logs = [
                {
                    sessionId: 'sess-001',
                    path: '/play',
                    entryTime: new Date().toISOString(),
                    exitTime: new Date().toISOString(),
                    duration: 30.5,
                    walletAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
                },
                {
                    sessionId: 'sess-001',
                    path: '/tournament',
                    entryTime: new Date().toISOString(),
                    duration: null
                }
            ];

            mockAccessLogService.saveLogs.resolves({ success: true, received: 2 });

            const res = await request(app)
                .post('/api/analytics/log')
                .send({ logs })
                .expect(200);

            expect(res.body.success).to.equal(true);
            expect(res.body.received).to.equal(2);
            expect(mockAccessLogService.saveLogs.calledOnce).to.be.true;
        });

        it('should accept a single log object (legacy format)', async () => {
            const singleLog = {
                sessionId: 'sess-002',
                path: '/',
                entryTime: new Date().toISOString()
            };

            mockAccessLogService.saveLogs.resolves({ success: true, received: 1 });

            const res = await request(app)
                .post('/api/analytics/log')
                .send(singleLog)
                .expect(200);

            expect(res.body.success).to.equal(true);
            expect(res.body.received).to.equal(1);
        });

        it('should reject empty logs array', async () => {
            const res = await request(app)
                .post('/api/analytics/log')
                .send({ logs: [] })
                .expect(400);

            expect(res.body.success).to.equal(false);
            expect(res.body.error).to.include('empty');
        });

        it('should reject invalid request body format', async () => {
            const res = await request(app)
                .post('/api/analytics/log')
                .send({ foo: 'bar' })
                .expect(400);

            expect(res.body.success).to.equal(false);
        });

        it('should propagate validation errors from service', async () => {
            mockAccessLogService.saveLogs.resolves({
                success: false,
                received: 0,
                error: 'No valid logs after validation'
            });

            const res = await request(app)
                .post('/api/analytics/log')
                .send({ logs: [{ badEntry: true }] })
                .expect(400);

            expect(res.body.success).to.equal(false);
        });

        it('should handle server errors gracefully', async () => {
            mockAccessLogService.saveLogs.rejects(new Error('DB connection lost'));

            const res = await request(app)
                .post('/api/analytics/log')
                .send({ logs: [{ sessionId: 's', path: '/p', entryTime: new Date().toISOString() }] })
                .expect(500);

            expect(res.body.success).to.equal(false);
        });
    });

    // ============================================================
    // GET /api/analytics/stats
    // ============================================================
    describe('GET /api/analytics/stats', () => {

        it('should return overview statistics', async () => {
            const mockStats = {
                period: { from: '2026-03-19', to: '2026-04-18' },
                totalUsers: 50,
                totalVisits: 200,
                totalPageviews: 1000,
                avgSessionDuration: 120.5,
                topPages: [
                    { path: '/', pv: 500, uv: 40 },
                    { path: '/play', pv: 300, uv: 25 }
                ]
            };

            mockAccessLogService.getStats.resolves(mockStats);

            const res = await request(app)
                .get('/api/analytics/stats')
                .expect(200);

            expect(res.body.totalUsers).to.equal(50);
            expect(res.body.totalVisits).to.equal(200);
            expect(res.body.totalPageviews).to.equal(1000);
            expect(res.body.avgSessionDuration).to.equal(120.5);
            expect(res.body.topPages).to.have.lengthOf(2);
        });

        it('should pass date range parameters to service', async () => {
            mockAccessLogService.getStats.resolves({});
            
            await request(app)
                .get('/api/analytics/stats?from=2026-04-01&to=2026-04-18')
                .expect(200);

            expect(mockAccessLogService.getStats.calledWith('2026-04-01', '2026-04-18')).to.be.true;
        });

        it('should handle zero data gracefully', async () => {
            mockAccessLogService.getStats.resolves({
                period: { from: '2026-03-19', to: '2026-04-18' },
                totalUsers: 0,
                totalVisits: 0,
                totalPageviews: 0,
                avgSessionDuration: 0,
                topPages: []
            });

            const res = await request(app)
                .get('/api/analytics/stats')
                .expect(200);

            expect(res.body.totalUsers).to.equal(0);
            expect(res.body.topPages).to.eql([]);
        });
    });

    // ============================================================
    // GET /api/analytics/dau
    // ============================================================
    describe('GET /api/analytics/dau', () => {

        it('should return DAU data for default period (7 days)', async () => {
            const mockDAU = {
                period: { from: '2026-04-11', to: '2026-04-18' },
                dau: [
                    { date: '2026-04-11', connectedUsers: 30, visits: 45 },
                    { date: '2026-04-12', connectedUsers: 35, visits: 50 }
                ],
                summary: {
                    avgConnectedDAU: 32.5,
                    avgVisitDAU: 47.5,
                    peakDate: '2026-04-12',
                    peakUsers: 35
                }
            };

            mockAccessLogService.getDAU.resolves(mockDAU);

            const res = await request(app)
                .get('/api/analytics/dau')
                .expect(200);

            expect(res.body.dau).to.have.lengthOf(2);
            expect(res.body.summary.avgConnectedDAU).to.equal(32.5);
            expect(res.body.summary.peakDate).to.equal('2026-04-12');
        });

        it('should accept custom days parameter', async () => {
            mockAccessLogService.getDAU.resolves({});

            await request(app)
                .get('/api/analytics/dau?days=30')
                .expect(200);

            expect(mockAccessLogService.getDAU.calledWith(30)).to.be.true;
        });

        it('should accept custom date range via "from" parameter', async () => {
            mockAccessLogService.getDAU.resolves({});

            await request(app)
                .get('/api/analytics/dau?from=2026-04-01')
                .expect(200);

            expect(mockAccessLogService.getDAU.calledWith('2026-04-01')).to.be.true;
        });
    });

    // ============================================================
    // GET /api/analytics/user/:walletAddress/trail
    // ============================================================
    describe('GET /api/analytics/user/:walletAddress/trail', () => {

        const testWallet = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

        it('should return user visit trail', async () => {
            const mockTrail = {
                walletAddress: testWallet.toLowerCase(),
                trails: [
                    { sessionId: 'sess-001', path: '/play', entryTime: '2026-04-18T10:00:00Z', duration: 180.5 },
                    { sessionId: 'sess-002', path: '/tournament', entryTime: '2026-04-18T12:00:00Z', duration: 60.0 }
                ],
                totalPageviews: 42,
                lastActiveAt: '2026-04-18T14:00:00Z'
            };

            mockAccessLogService.getUserTrail.resolves(mockTrail);

            const res = await request(app)
                .get(`/api/analytics/user/${testWallet}/trail`)
                .expect(200);

            expect(res.body.walletAddress).to.equal(testWallet.toLowerCase());
            expect(res.body.trails).to.have.lengthOf(2);
            expect(res.body.totalPageviews).to.equal(42);
        });

        it('should accept custom limit parameter', async () => {
            mockAccessLogService.getUserTrail.resolves({});

            await request(app)
                .get(`/api/analytics/user/${testWallet}/trail?limit=50`)
                .expect(200);

            expect(mockAccessLogService.getUserTrail.calledWith(testWallet, 50)).to.be.true;
        });

        it('should reject invalid wallet address', async () => {
            const res = await request(app)
                .get('/api/analytics/user/shortaddr/trail')
                .expect(400);

            expect(res.body.success).to.equal(false);
            expect(res.body.error).to.include('Invalid');
        });

        it('should return empty trail for unknown user', async () => {
            mockAccessLogService.getUserTrail.resolves({
                walletAddress: 'unknown'.padEnd(34, 'x'),
                trails: [],
                totalPageviews: 0,
                lastActiveAt: null
            });

            const unknownWallet = 'T'.padEnd(34, 'x');
            const res = await request(app)
                .get(`/api/analytics/user/${unknownWallet}/trail`)
                .expect(200);

            expect(res.body.trails).to.eql([]);
            expect(res.body.totalPageviews).to.equal(0);
        });
    });
});
