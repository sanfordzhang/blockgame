/**
 * Bot Player Tests
 * Tests bot connection, game actions, and strategies
 */

const { expect } = require('chai');
const sinon = require('sinon');
const { BotPlayer, BotManager } = require('../helpers/bot-player');

describe('Bot Player Tests', function () {
    this.timeout(30000);
    
    let botManager;
    
    beforeEach(function () {
        botManager = new BotManager();
    });
    
    afterEach(function () {
        botManager.disconnectAll();
        sinon.restore();
    });
    
    describe('Bot Creation', function () {
        it('should create bot with default config', function () {
            const bot = botManager.createBot();
            
            expect(bot.id).to.exist;
            expect(bot.name).to.exist;
            expect(bot.address).to.match(/^T/);
            expect(bot.address.length).to.equal(34);
        });
        
        it('should create bot with custom config', function () {
            const bot = botManager.createBot({
                id: 'test_bot_1',
                name: 'TestBot',
                strategy: 'aggressive',
                actionDelay: 1000
            });
            
            expect(bot.id).to.equal('test_bot_1');
            expect(bot.name).to.equal('TestBot');
            expect(bot.strategy).to.equal('aggressive');
            expect(bot.actionDelay).to.equal(1000);
        });
        
        it('should generate unique addresses', function () {
            const bots = botManager.createBots(10);
            const addresses = bots.map(b => b.address);
            const uniqueAddresses = new Set(addresses);
            
            expect(uniqueAddresses.size).to.equal(10);
        });
    });
    
    describe('Bot Manager', function () {
        it('should create multiple bots', function () {
            const bots = botManager.createBots(6);
            
            expect(bots).to.have.length(6);
            expect(botManager.bots.size).to.equal(6);
        });
        
        it('should get bot by ID', function () {
            const bot = botManager.createBot({ id: 'bot_123' });
            
            const retrieved = botManager.getBot('bot_123');
            expect(retrieved).to.equal(bot);
        });
        
        it('should get all bots', function () {
            botManager.createBots(3);
            
            const allBots = botManager.getAllBots();
            expect(allBots).to.have.length(3);
        });
        
        it('should disconnect all bots', function () {
            const bots = botManager.createBots(3);
            bots.forEach(bot => bot.connected = true);
            
            botManager.disconnectAll();
            
            expect(botManager.bots.size).to.equal(0);
        });
    });
    
    describe('Bot Strategies', function () {
        describe('Random Strategy', function () {
            it('should make random decisions', function () {
                const bot = botManager.createBot({ strategy: 'random' });
                bot.stack = 1000;
                
                const gameData = { callAmount: 10, minRaise: 20, canRaise: true, canCheck: true };
                
                // Run multiple times to check randomness
                const actions = new Set();
                for (let i = 0; i < 20; i++) {
                    const action = bot.decideAction(gameData);
                    actions.add(action.action);
                }
                
                // Should have variety (at least 2 different actions)
                expect(actions.size).to.be.greaterThan(1);
            });
        });
        
        describe('Aggressive Strategy', function () {
            it('should prefer raising', function () {
                const bot = botManager.createBot({ strategy: 'aggressive' });
                bot.stack = 1000;
                
                const gameData = { callAmount: 10, minRaise: 20, canRaise: true, canCheck: false };
                
                // Run multiple times
                let raiseCount = 0;
                for (let i = 0; i < 10; i++) {
                    const action = bot.decideAction(gameData);
                    if (action.action === 'raise') raiseCount++;
                }
                
                // Aggressive should raise often
                expect(raiseCount).to.be.greaterThan(5);
            });
        });
        
        describe('Passive Strategy', function () {
            it('should prefer checking and calling', function () {
                const bot = botManager.createBot({ strategy: 'passive' });
                bot.stack = 1000;
                
                const gameData = { callAmount: 10, minRaise: 20, canRaise: true, canCheck: true };
                
                // Run multiple times
                let passiveActions = 0;
                for (let i = 0; i < 10; i++) {
                    const action = bot.decideAction(gameData);
                    if (action.action === 'check' || action.action === 'call') passiveActions++;
                }
                
                expect(passiveActions).to.be.greaterThan(7);
            });
        });
        
        describe('Optimal Strategy', function () {
            it('should make decisions based on hand strength', function () {
                const bot = botManager.createBot({ strategy: 'optimal' });
                bot.stack = 1000;
                
                // Strong hand scenario
                bot.cards = ['Ah', 'Ad']; // Pair of Aces
                const strongHandAction = bot.decideAction({ 
                    callAmount: 10, 
                    minRaise: 30, 
                    canRaise: true, 
                    pot: 50 
                });
                
                expect(strongHandAction.action).to.be.oneOf(['raise', 'call']);
            });
            
            it('should fold weak hands to big bets', function () {
                const bot = botManager.createBot({ strategy: 'optimal' });
                bot.stack = 1000;
                bot.cards = ['7h', '2d']; // Weak hand
                
                const action = bot.decideAction({
                    callAmount: 500, // Big bet relative to pot
                    minRaise: 1000,
                    canRaise: false,
                    canCheck: false,
                    pot: 100
                });
                
                // Should fold weak hand to big bet
                expect(action.action).to.equal('fold');
            });
        });
        
        describe('Caller Strategy', function () {
            it('should only call or check', function () {
                const bot = botManager.createBot({ strategy: 'caller' });
                bot.stack = 1000;
                
                const gameData = { callAmount: 10, minRaise: 20, canRaise: true, canCheck: false };
                
                for (let i = 0; i < 10; i++) {
                    const action = bot.decideAction(gameData);
                    expect(action.action).to.be.oneOf(['call', 'check', 'fold']);
                }
            });
        });
        
        describe('Folder Strategy', function () {
            it('should only check or fold', function () {
                const bot = botManager.createBot({ strategy: 'folder' });
                bot.stack = 1000;
                
                const gameData = { callAmount: 10, minRaise: 20, canRaise: true, canCheck: false };
                
                for (let i = 0; i < 10; i++) {
                    const action = bot.decideAction(gameData);
                    expect(action.action).to.be.oneOf(['check', 'fold']);
                }
            });
        });
    });
    
    describe('Hand Evaluation', function () {
        it('should evaluate pair hands correctly', function () {
            const bot = botManager.createBot();
            
            bot.cards = ['Ah', 'Ad'];
            const strength = bot.evaluateHand();
            
            expect(strength).to.be.greaterThan(0.5); // Pair should be above average
        });
        
        it('should evaluate suited cards correctly', function () {
            const bot = botManager.createBot();
            
            bot.cards = ['Ah', 'Kh']; // Suited AK
            const suitedStrength = bot.evaluateHand();
            
            bot.cards = ['Ah', 'Kd']; // Offsuit AK
            const offsuitStrength = bot.evaluateHand();
            
            // Suited cards should have higher or equal strength
            expect(suitedStrength).to.be.at.least(offsuitStrength);
        });
        
        it('should evaluate high cards correctly', function () {
            const bot = botManager.createBot();
            
            bot.cards = ['Ah', 'Kd'];
            const highStrength = bot.evaluateHand();
            
            bot.cards = ['2h', '7d'];
            const lowStrength = bot.evaluateHand();
            
            expect(highStrength).to.be.greaterThan(lowStrength);
        });
    });
    
    describe('Bot Statistics', function () {
        it('should track hands played', function () {
            const bot = botManager.createBot();
            
            bot.stats.handsPlayed = 0;
            
            // Simulate hand result
            bot.handleMessage({ event: 'hand_result', data: { winners: [] } });
            
            expect(bot.stats.handsPlayed).to.equal(1);
        });
        
        it('should track wins', function () {
            const bot = botManager.createBot();
            bot.seatId = 1;
            
            bot.handleMessage({ 
                event: 'hand_result', 
                data: { winners: [1], winAmount: 100 } 
            });
            
            expect(bot.stats.handsWon).to.equal(1);
            expect(bot.stats.biggestWin).to.equal(100);
        });
        
        it('should track NFTs earned', function () {
            const bot = botManager.createBot();
            
            bot.handleMessage({ event: 'nft_achievement', data: { type: 'ROYAL_FLUSH' } });
            
            expect(bot.stats.nftsEarned).to.equal(1);
        });
        
        it('should calculate stats summary', function () {
            botManager.createBots(3);
            
            const stats = botManager.getStatsSummary();
            
            expect(stats.botCount).to.equal(3);
            expect(stats).to.have.property('totalHands');
            expect(stats).to.have.property('totalWins');
        });
    });
    
    describe('Multi-Bot Scenarios', function () {
        it('should handle 6-player game simulation', async function () {
            const bots = botManager.createBots(6, { strategy: 'random' });
            
            // All bots should be unique
            const ids = new Set(bots.map(b => b.id));
            expect(ids.size).to.equal(6);
        });
        
        it('should handle mixed strategies', function () {
            const strategies = ['random', 'aggressive', 'passive', 'optimal', 'caller', 'folder'];
            
            const bots = strategies.map((strategy, i) => 
                botManager.createBot({ strategy, name: `Bot_${strategy}` })
            );
            
            expect(bots).to.have.length(6);
            bots.forEach((bot, i) => {
                expect(bot.strategy).to.equal(strategies[i]);
            });
        });
    });
});
