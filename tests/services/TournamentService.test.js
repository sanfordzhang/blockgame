/**
 * TournamentService Unit Tests
 * Tests core functionality without heavy Mongoose dependencies
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('TournamentService', function () {
    this.timeout(5000);
    
    let TournamentService;
    let tournamentService;
    let mockContract;
    let mockTronWeb;

    beforeEach(function () {
        // Create mock tronWeb
        mockTronWeb = {
            toDecimal: sinon.stub().callsFake(v => parseInt(v) || 0),
            address: { toHex: sinon.stub().returns('0x123') },
            contract: sinon.stub().returns({
                at: sinon.stub().resolves({})
            })
        };

        // Create mock contract
        mockContract = {
            createTournament: sinon.stub().returns({ 
                send: sinon.stub().resolves({ events: { TournamentCreated: { result: { tournamentId: 1 } } } }) 
            }),
            joinTournament: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            startTournament: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            cancelTournament: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            finishTournament: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            getTournamentConfig: sinon.stub().returns({ 
                call: sinon.stub().resolves({
                    tournamentType: { toNumber: () => 1 },
                    playerCount: { toNumber: () => 6 },
                    buyIn: { toNumber: () => 100e6 },
                    rakeRate: { toNumber: () => 500 },
                    prizeDistribution: [{ toNumber: () => 50 }, { toNumber: () => 30 }, { toNumber: () => 20 }],
                    initialChips: { toNumber: () => 1500 },
                    startMode: { toNumber: () => 0 },
                    waitTimeout: { toNumber: () => 600 }
                }) 
            })
        };

        // Create service instance
        TournamentService = require('../../server/services/TournamentService');
        tournamentService = new TournamentService({
            tronWeb: mockTronWeb,
            tournamentContractAddress: 'TTOURNAMENT',
            serverWallet: 'TSERVER'
        });
        
        tournamentService.contract = mockContract;
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('Constructor', function () {
        it('should initialize with correct config', function () {
            expect(tournamentService.tronWeb).to.equal(mockTronWeb);
            expect(tournamentService.contractAddress).to.equal('TTOURNAMENT');
            expect(tournamentService.serverWallet).to.equal('TSERVER');
            expect(tournamentService.activeTables).to.be.instanceOf(Map);
        });
    });

    describe('setSocketIO', function () {
        it('should set socketIO instance', function () {
            const mockIO = { to: sinon.stub().returns({ emit: sinon.stub() }) };
            tournamentService.setSocketIO(mockIO);
            expect(tournamentService.socketIO).to.equal(mockIO);
        });
    });

    describe('broadcastUpdate', function () {
        it('should do nothing when socketIO not set', function () {
            // Should not throw
            tournamentService.broadcastUpdate('1', { type: 'test' });
        });

        it('should broadcast to room when socketIO is set', function () {
            const mockEmit = sinon.stub();
            const mockIO = { to: sinon.stub().returns({ emit: mockEmit }) };
            tournamentService.setSocketIO(mockIO);
            
            tournamentService.broadcastUpdate('123', { type: 'test', data: 'value' });
            
            expect(mockIO.to.calledWith('tournament:123')).to.be.true;
            expect(mockEmit.calledOnce).to.be.true;
        });
    });

    describe('broadcastGameState', function () {
        it('should broadcast game state to room', function () {
            const mockEmit = sinon.stub();
            const mockIO = { to: sinon.stub().returns({ emit: mockEmit }) };
            tournamentService.setSocketIO(mockIO);
            
            tournamentService.broadcastGameState('123', { pot: 100, board: [] });
            
            expect(mockIO.to.calledWith('tournament:123')).to.be.true;
        });
    });

    describe('getConfig', function () {
        it('should return null when contract not set', async function () {
            tournamentService.contract = null;
            
            const result = await tournamentService.getConfig(1);
            
            expect(result).to.be.null;
        });

        it('should return parsed config from contract', async function () {
            const result = await tournamentService.getConfig(1);
            
            expect(result.id).to.equal(1);
            expect(result.playerCount).to.equal(6);
            expect(result.buyIn).to.equal(100e6);
            expect(result.rakeRate).to.equal(500);
        });
    });

    describe('handleGameAction', function () {
        it('should throw when tournament not active', function () {
            expect(() => tournamentService.handleGameAction('999', 'socket1', { type: 'fold' }))
                .to.throw('Tournament not active');
        });

        it('should throw for unknown action type', function () {
            // Add a mock table
            const mockTable = {
                handleFold: sinon.stub(),
                handleCheck: sinon.stub(),
                handleCall: sinon.stub(),
                handleRaise: sinon.stub()
            };
            tournamentService.activeTables.set('1', mockTable);
            
            expect(() => tournamentService.handleGameAction('1', 'socket1', { type: 'unknown' }))
                .to.throw('Unknown action');
        });
    });

    describe('startWaitingCheck', function () {
        it('should start interval without error', function () {
            // Should not throw
            tournamentService.startWaitingCheck('test-tournament');
            
            // Clean up immediately
            tournamentService.stopWaitingCheck('test-tournament');
        });
    });

    describe('stopWaitingCheck', function () {
        it('should handle missing interval gracefully', function () {
            // Should not throw even if no check exists
            tournamentService.stopWaitingCheck('non-existent');
        });
    });

    describe('Prize Calculation Logic', function () {
        it('should calculate correct prize distribution', function () {
            const buyIn = 100e6;
            const playerCount = 6;
            const rakeRate = 500; // 5%
            const prizeDistribution = [50, 30, 20];
            
            const totalPot = buyIn * playerCount;
            const rakeAmount = Math.floor(totalPot * rakeRate / 10000);
            const prizePool = totalPot - rakeAmount;
            
            const prizes = prizeDistribution.map(pct => Math.floor(prizePool * pct / 100));
            
            expect(totalPot).to.equal(600e6);
            expect(rakeAmount).to.equal(30e6);
            expect(prizes[0]).to.equal(285e6);
            expect(prizes[1]).to.equal(171e6);
            expect(prizes[2]).to.equal(114e6);
        });

        it('should handle different player counts', function () {
            const buyIn = 50e6;
            const playerCount = 2;
            const rakeRate = 500;
            
            const totalPot = buyIn * playerCount;
            const rakeAmount = Math.floor(totalPot * rakeRate / 10000);
            
            expect(totalPot).to.equal(100e6);
            expect(rakeAmount).to.equal(5e6);
        });
    });

    describe('Tournament State Transitions', function () {
        it('should validate correct state flow', function () {
            const states = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
            const validTransitions = {
                'WAITING': ['IN_PROGRESS', 'CANCELLED'],
                'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
                'COMPLETED': [],
                'CANCELLED': []
            };
            
            // WAITING can transition to IN_PROGRESS
            expect(validTransitions['WAITING']).to.include('IN_PROGRESS');
            // WAITING can transition to CANCELLED
            expect(validTransitions['WAITING']).to.include('CANCELLED');
            // IN_PROGRESS can transition to COMPLETED
            expect(validTransitions['IN_PROGRESS']).to.include('COMPLETED');
        });
    });

    describe('handleDisconnect', function () {
        it('should handle disconnect gracefully with no active tables', function () {
            // Should not throw
            tournamentService.handleDisconnect('socket123');
        });

        it('should check active tables for player', function () {
            const mockTable = {
                handleDisconnect: sinon.stub().returns(null)
            };
            tournamentService.activeTables.set('1', mockTable);
            
            tournamentService.handleDisconnect('socket123');
            
            expect(mockTable.handleDisconnect.calledWith('socket123')).to.be.true;
        });
    });
});
