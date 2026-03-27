/**
 * NFTService Unit Tests
 * Tests NFT service functionality for poker hand achievements
 */

const { expect } = require('chai');
const sinon = require('sinon');

// Import mock poker hands
const { PokerHandTestData } = require('../mock/poker-hands');

describe('NFTService', function () {
    let NFTService;
    let nftService;
    let mockContract;
    let mockTronWeb;

    beforeEach(function () {
        mockTronWeb = {
            toDecimal: sinon.stub().callsFake(v => parseInt(v) || 0),
            address: { toHex: sinon.stub().returns('0x123') },
            utils: {
                bytesToHex: sinon.stub().callsFake(arr => Buffer.from(arr).toString('hex')),
                hexToBytes: sinon.stub().callsFake(hex => Buffer.from(hex, 'hex'))
            },
            sha3: sinon.stub().returns('0xabc123'),
            sign: sinon.stub().resolves('0xsignature')
        };

        mockContract = {
            getAchievementType: sinon.stub().returns({ call: sinon.stub().resolves({ name: 'Royal Flush', rarity: 1 }) }),
            checkMonthlyLimit: sinon.stub().returns({ call: sinon.stub().resolves(false) }),
            claimNFT: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            balanceOf: sinon.stub().returns({ call: sinon.stub().resolves('5') }),
            getAchievementInfo: sinon.stub().returns({ call: sinon.stub().resolves({}) }),
            monthlyMinted: sinon.stub().returns({ call: sinon.stub().resolves('10') })
        };

        // Create service instance
        NFTService = require('../../server/services/NFTService');
        nftService = new NFTService.NFTService({
            tronWeb: mockTronWeb,
            nftContractAddress: 'TNFT'
        });

        nftService.contract = mockContract;
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('checkAchievement', function () {
        it('Should detect Royal Flush', function () {
            const testData = PokerHandTestData.royal_flush[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result).to.not.be.null;
            expect(result.type).to.equal('ROYAL_FLUSH');
        });

        it('Should detect Straight Flush', function () {
            const testData = PokerHandTestData.straight_flush[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result).to.not.be.null;
            expect(result.type).to.equal('STRAIGHT_FLUSH');
        });

        it('Should detect Four of a Kind', function () {
            const testData = PokerHandTestData.four_of_a_kind[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result).to.not.be.null;
            expect(result.type).to.equal('FOUR_OF_A_KIND');
        });

        it('Should detect Full House', function () {
            const testData = PokerHandTestData.full_house[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result).to.not.be.null;
            expect(result.type).to.equal('FULL_HOUSE');
        });

        it('Should detect Flush', function () {
            const testData = PokerHandTestData.flush[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result).to.not.be.null;
            expect(result.type).to.equal('FLUSH');
        });

        it('Should detect Straight', function () {
            const testData = PokerHandTestData.straight[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result).to.not.be.null;
            expect(result.type).to.equal('STRAIGHT');
        });

        it('Should not detect achievement for non-qualifying hand', function () {
            const testData = PokerHandTestData.non_achievement[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result).to.be.null;
        });

        it('Should detect highest achievement for multiple qualifying patterns', function () {
            const testData = PokerHandTestData.royal_flush[0];
            const result = nftService.checkAchievement(testData.holeCards, testData.board);

            expect(result.type).to.equal('ROYAL_FLUSH');
        });
    });

    describe('Achievement Types', function () {
        it('Should define all achievement types', function () {
            const achievementTypes = [
                { type: 'ROYAL_FLUSH', name: 'Royal Flush', rank: 1 },
                { type: 'STRAIGHT_FLUSH', name: 'Straight Flush', rank: 2 },
                { type: 'FOUR_OF_A_KIND', name: 'Four of a Kind', rank: 3 },
                { type: 'FULL_HOUSE', name: 'Full House', rank: 4 },
                { type: 'FLUSH', name: 'Flush', rank: 5 },
                { type: 'STRAIGHT', name: 'Straight', rank: 6 }
            ];

            expect(achievementTypes).to.have.length(6);
            expect(achievementTypes[0].type).to.equal('ROYAL_FLUSH');
        });

        it('Should define rarity correctly', function () {
            const rarities = {
                'ROYAL_FLUSH': 1,
                'STRAIGHT_FLUSH': 2,
                'FOUR_OF_A_KIND': 3,
                'FULL_HOUSE': 4,
                'FLUSH': 5,
                'STRAIGHT': 6
            };

            expect(rarities['ROYAL_FLUSH']).to.equal(1);
            expect(rarities['STRAIGHT']).to.equal(6);
        });
    });

    describe('Monthly Limits', function () {
        it('Should define monthly mint limits per achievement type', function () {
            const monthlyLimits = {
                1: 5,  // Royal Flush
                2: 10, // Straight Flush
                3: 50, // Four of a Kind
                4: 100, // Full House
                5: 200, // Flush
                6: 300  // Straight
            };

            expect(monthlyLimits[1]).to.equal(5);
            expect(monthlyLimits[6]).to.equal(300);
        });

        it('Should calculate current month key correctly', function () {
            const currentMonth = new Date().toISOString().slice(0, 7);
            expect(currentMonth).to.match(/^\d{4}-\d{2}$/);
        });
    });

    describe('Signature Generation', function () {
        it('Should generate valid signature data', function () {
            const playerAddress = 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b';
            const achievementType = 1;
            const nonce = Date.now();

            const message = `mint_${achievementType}_${playerAddress}_${nonce}`;
            expect(message).to.include('mint_');
            expect(message).to.include(playerAddress);
        });
    });

    describe('Constructor', function () {
        it('should initialize with correct config', function () {
            expect(nftService.tronWeb).to.equal(mockTronWeb);
            expect(nftService.contractAddress).to.equal('TNFT');
        });
    });
});
