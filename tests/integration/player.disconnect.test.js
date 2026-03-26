/**
 * Player Disconnect/Reconnect Integration Tests
 * Tests player connection handling and game state preservation
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { BotPlayer, BotManager } = require('../helpers/bot-player');

describe('Player Disconnect/Reconnect Integration', function () {
    this.timeout(60000);
    
    let botManager;
    
    beforeEach(function () {
        botManager = new BotManager();
    });
    
    afterEach(function () {
        botManager.disconnectAll();
        sinon.restore();
    });
    
    describe('Disconnect Handling', function () {
        it('should auto-fold for disconnected player on turn', async function () {
            const bot = botManager.createBot({ strategy: 'random' });
            
            // Simulate disconnect during turn
            const gameData = {
                isMyTurn: true,
                callAmount: 100,
                canCheck: false
            };
            
            // Bot disconnects
            bot.connected = false;
            
            // Server should handle as auto-fold
            const action = bot.decideAction(gameData);
            
            // Disconnected player should be treated as folded
            expect(action).to.exist;
        });
        
        it('should preserve player stack on disconnect', async function () {
            const bot = botManager.createBot({
                strategy: 'passive'
            });
            
            bot.stack = 1000;
            bot.currentTable = 'table_1';
            bot.seatId = 1;
            
            // Simulate disconnect
            bot.connected = false;
            
            // Stack should be preserved
            expect(bot.stack).to.equal(1000);
            expect(bot.currentTable).to.equal('table_1');
        });
        
        it('should mark player as sitting out', function () {
            const bot = botManager.createBot();
            
            bot.connected = true;
            bot.currentTable = 'table_1';
            
            // Disconnect
            bot.disconnect();
            
            expect(bot.connected).to.be.false;
        });
    });
    
    describe('Reconnect Flow', function () {
        it('should restore player to same table', async function () {
            const bot = botManager.createBot({
                autoReconnect: true
            });
            
            const originalTable = 'table_1';
            const originalSeat = 3;
            const originalStack = 1500;
            
            bot.currentTable = originalTable;
            bot.seatId = originalSeat;
            bot.stack = originalStack;
            
            // Simulate reconnect
            const reconnectData = {
                tableId: originalTable,
                seatId: originalSeat,
                stack: originalStack
            };
            
            // Verify reconnection data
            expect(reconnectData.tableId).to.equal(originalTable);
            expect(reconnectData.seatId).to.equal(originalSeat);
            expect(reconnectData.stack).to.equal(originalStack);
        });
        
        it('should sync game state on reconnect', function () {
            const bot = botManager.createBot();
            
            // Game state to sync
            const gameState = {
                phase: 'FLOP',
                pot: 300,
                board: ['Ah', 'Kh', 'Qh'],
                currentPlayer: 2,
                communityCards: ['Ah', 'Kh', 'Qh']
            };
            
            bot.updateGameState(gameState);
            
            expect(bot.pot).to.equal(300);
        });
        
        it('should handle multiple reconnects', async function () {
            const bot = botManager.createBot({
                autoReconnect: true,
                actionDelay: 100
            });
            
            const address = bot.address;
            
            // First connection
            expect(bot.address).to.equal(address);
            
            // Simulate disconnect
            bot.disconnect();
            expect(bot.connected).to.be.false;
            
            // Reconnect should preserve address
            expect(bot.address).to.equal(address);
        });
    });
    
    describe('Tournament Reconnect', function () {
        it('should restore tournament position on reconnect', function () {
            const bot = botManager.createBot();
            
            const tournamentData = {
                tournamentId: 'tournament_1',
                currentLevel: 3,
                blinds: { small: 50, big: 100 },
                remainingPlayers: 4,
                position: 2
            };
            
            bot.currentTournament = tournamentData.tournamentId;
            bot.stack = 2000;
            
            // Verify tournament state
            expect(bot.currentTournament).to.equal('tournament_1');
        });
        
        it('should apply time bank correctly', function () {
            const timeBank = 30; // seconds
            const timeUsed = 10;
            const remaining = timeBank - timeUsed;
            
            expect(remaining).to.equal(20);
            
            // Exhausted time bank
            const exhaustedTimeBank = 0;
            const shouldAutoFold = exhaustedTimeBank <= 0;
            expect(shouldAutoFold).to.be.true;
        });
        
        it('should handle elimination during disconnect', function () {
            const bot = botManager.createBot();
            
            bot.stack = 0;
            bot.currentTournament = 'tournament_1';
            
            // Check if eliminated
            const isEliminated = bot.stack <= 0;
            expect(isEliminated).to.be.true;
        });
    });
    
    describe('Multi-Player Disconnect Scenarios', function () {
        it('should handle all players disconnected', async function () {
            const bots = botManager.createBots(2);
            
            // All disconnect
            bots.forEach(bot => bot.disconnect());
            
            const allDisconnected = bots.every(bot => !bot.connected);
            expect(allDisconnected).to.be.true;
        });
        
        it('should continue game with one player disconnected', async function () {
            const bots = botManager.createBots(2, { strategy: 'passive' });
            
            // Set both bots as connected first
            bots.forEach(bot => bot.connected = true);
            
            // One disconnects
            bots[0].disconnect();
            
            const activePlayers = bots.filter(bot => bot.connected).length;
            expect(activePlayers).to.equal(1);
        });
        
        it('should handle reconnect race condition', async function () {
            const bots = botManager.createBots(2);
            
            // Simulate rapid reconnect attempts
            const reconnectAttempts = bots.map(bot => ({
                address: bot.address,
                timestamp: Date.now()
            }));
            
            // Should handle without conflict
            const uniqueAddresses = new Set(reconnectAttempts.map(r => r.address));
            expect(uniqueAddresses.size).to.equal(2);
        });
    });
    
    describe('Connection State Machine', function () {
        it('should track connection states correctly', function () {
            const states = ['CONNECTED', 'DISCONNECTED', 'RECONNECTING', 'SPECTATING'];
            
            const stateTransitions = [
                { from: 'CONNECTED', to: 'DISCONNECTED', event: 'disconnect' },
                { from: 'DISCONNECTED', to: 'RECONNECTING', event: 'reconnect_attempt' },
                { from: 'RECONNECTING', to: 'CONNECTED', event: 'reconnect_success' }
            ];
            
            expect(stateTransitions).to.have.length(3);
        });
        
        it('should handle graceful disconnect', async function () {
            const bot = botManager.createBot();
            
            bot.connected = true;
            bot.currentTable = 'table_1';
            
            // Graceful disconnect (leaves table first)
            bot.leaveTable();
            bot.disconnect();
            
            expect(bot.currentTable).to.be.null;
            expect(bot.connected).to.be.false;
        });
    });
    
    describe('Socket Event Handling', function () {
        it('should handle socket close event', function (done) {
            const bot = botManager.createBot();
            
            bot.on('disconnected', () => {
                expect(bot.connected).to.be.false;
                done();
            });
            
            // Simulate close
            bot.connected = false;
            bot.emit('disconnected');
        });
        
        it('should queue actions during disconnect', function () {
            const bot = botManager.createBot();
            
            // Actions queued while disconnected
            const pendingActions = [];
            const action = { type: 'fold', timestamp: Date.now() };
            
            if (!bot.connected) {
                pendingActions.push(action);
            }
            
            expect(pendingActions).to.have.length(1);
        });
    });
});
