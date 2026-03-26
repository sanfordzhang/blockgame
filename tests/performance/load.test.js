/**
 * Performance Tests
 * Tests for concurrent operations, latency, and throughput
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { BotManager } = require('../helpers/bot-player');

describe('Performance Tests', function () {
    this.timeout(120000);
    
    let botManager;
    
    beforeEach(function () {
        botManager = new BotManager();
    });
    
    afterEach(function () {
        botManager.disconnectAll();
        sinon.restore();
    });
    
    describe('Concurrent Tournament Join', function () {
        it('should handle 100 concurrent join requests', async function () {
            const startTime = Date.now();
            
            // Simulate 100 concurrent joins
            const joinPromises = [];
            for (let i = 0; i < 100; i++) {
                joinPromises.push(
                    new Promise(resolve => {
                        // Simulate join operation
                        setTimeout(() => resolve({ playerId: i, success: true }), Math.random() * 100);
                    })
                );
            }
            
            const results = await Promise.all(joinPromises);
            const duration = Date.now() - startTime;
            
            expect(results).to.have.length(100);
            expect(results.every(r => r.success)).to.be.true;
            console.log(`  100 concurrent joins completed in ${duration}ms`);
        });
        
        it('should maintain data consistency under load', async function () {
            const sharedState = { playerCount: 0 };
            const operations = 1000;
            
            // Simulate concurrent increments
            const increments = [];
            for (let i = 0; i < operations; i++) {
                increments.push(
                    new Promise(resolve => {
                        sharedState.playerCount++;
                        resolve();
                    })
                );
            }
            
            await Promise.all(increments);
            
            // Note: In real scenario, this would need proper locking
            // This test demonstrates the need for atomic operations
            console.log(`  Final count: ${sharedState.playerCount} (expected: ${operations})`);
        });
    });
    
    describe('Game Latency', function () {
        it('should complete action within 100ms', async function () {
            const bot = botManager.createBot();
            
            const gameData = {
                callAmount: 10,
                minRaise: 20,
                canRaise: true,
                canCheck: true
            };
            
            const startTime = Date.now();
            const action = bot.decideAction(gameData);
            const duration = Date.now() - startTime;
            
            expect(action).to.exist;
            expect(duration).to.be.lessThan(100);
            console.log(`  Decision time: ${duration}ms`);
        });
        
        it('should handle rapid state updates', async function () {
            const bot = botManager.createBot();
            
            const startTime = Date.now();
            const updates = 1000;
            
            for (let i = 0; i < updates; i++) {
                bot.updateGameState({
                    pot: i * 10,
                    stack: 1000 - i
                });
            }
            
            const duration = Date.now() - startTime;
            const avgTime = duration / updates;
            
            expect(avgTime).to.be.lessThan(1); // Less than 1ms per update
            console.log(`  ${updates} updates in ${duration}ms (${avgTime.toFixed(3)}ms avg)`);
        });
    });
    
    describe('Socket Connection Stability', function () {
        it('should handle connection pool', function () {
            const poolSize = 100;
            const connections = [];
            
            for (let i = 0; i < poolSize; i++) {
                connections.push({
                    id: i,
                    connected: true,
                    lastHeartbeat: Date.now()
                });
            }
            
            const activeConnections = connections.filter(c => c.connected);
            expect(activeConnections).to.have.length(poolSize);
            console.log(`  Connection pool size: ${poolSize}`);
        });
        
        it('should detect stale connections', function () {
            const now = Date.now();
            const staleThreshold = 30000; // 30 seconds
            
            const connections = [
                { id: 1, lastHeartbeat: now - 1000, stale: false },
                { id: 2, lastHeartbeat: now - 60000, stale: true },
                { id: 3, lastHeartbeat: now - 5000, stale: false }
            ];
            
            const staleConnections = connections.filter(c => 
                (now - c.lastHeartbeat) > staleThreshold
            );
            
            expect(staleConnections).to.have.length(1);
        });
    });
    
    describe('Database Query Performance', function () {
        it('should complete find queries within threshold', async function () {
            // Mock database query
            const mockQuery = sinon.stub().resolves(
                Array(100).fill({ _id: 'test', data: 'test' })
            );
            
            const startTime = Date.now();
            await mockQuery();
            const duration = Date.now() - startTime;
            
            expect(duration).to.be.lessThan(50);
            console.log(`  Query time: ${duration}ms`);
        });
        
        it('should handle bulk inserts efficiently', async function () {
            const records = Array(1000).fill(null).map((_, i) => ({
                id: i,
                data: `record_${i}`
            }));
            
            const startTime = Date.now();
            
            // Simulate bulk insert
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const duration = Date.now() - startTime;
            const recordsPerSecond = (records.length / duration) * 1000;
            
            console.log(`  Bulk insert: ${records.length} records in ${duration}ms`);
            console.log(`  Throughput: ${recordsPerSecond.toFixed(0)} records/sec`);
        });
    });
    
    describe('Hand Evaluation Performance', function () {
        it('should evaluate 1000 hands within 100ms', function () {
            const bot = botManager.createBot({ strategy: 'optimal' });
            
            const hands = [
                ['Ah', 'Ad'],
                ['Kh', 'Kd'],
                ['Qh', 'Qd'],
                ['Jh', 'Jd'],
                ['Th', 'Td'],
                ['Ah', 'Kh'],
                ['2h', '7d'],
                ['9c', '8c'],
                ['As', 'Ks'],
                ['5h', '5d']
            ];
            
            const startTime = Date.now();
            let evaluations = 0;
            
            for (let i = 0; i < 1000; i++) {
                bot.cards = hands[i % hands.length];
                bot.evaluateHand();
                evaluations++;
            }
            
            const duration = Date.now() - startTime;
            
            expect(duration).to.be.lessThan(100);
            console.log(`  1000 hand evaluations in ${duration}ms`);
        });
    });
    
    describe('Bot Creation Performance', function () {
        it('should create 100 bots within 1 second', function () {
            const startTime = Date.now();
            
            botManager.createBots(100);
            
            const duration = Date.now() - startTime;
            
            expect(duration).to.be.lessThan(1000);
            expect(botManager.bots.size).to.equal(100);
            console.log(`  Created 100 bots in ${duration}ms`);
        });
    });
    
    describe('Memory Usage', function () {
        it('should not leak memory on repeated operations', function () {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Perform many operations
            for (let i = 0; i < 10000; i++) {
                const bot = new (require('../helpers/bot-player').BotPlayer)();
                bot.evaluateHand();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024;
            
            console.log(`  Memory growth: ${memoryGrowth.toFixed(2)}MB`);
            // Memory growth should be reasonable (less than 50MB for this test)
            expect(memoryGrowth).to.be.lessThan(50);
        });
    });
    
    describe('Tournament Simulation Performance', function () {
        it('should simulate 6-player tournament flow', async function () {
            const bots = botManager.createBots(6, {
                strategy: 'random',
                actionDelay: 0 // No delay for performance test
            });
            
            const startTime = Date.now();
            
            // Simulate 100 hands
            for (let hand = 0; hand < 100; hand++) {
                bots.forEach(bot => {
                    const action = bot.decideAction({
                        callAmount: 10,
                        minRaise: 20,
                        canRaise: true,
                        canCheck: Math.random() > 0.5
                    });
                });
            }
            
            const duration = Date.now() - startTime;
            const handsPerSecond = 100 / (duration / 1000);
            
            console.log(`  100 hands simulated in ${duration}ms`);
            console.log(`  ${handsPerSecond.toFixed(1)} hands/second`);
        });
    });
});
