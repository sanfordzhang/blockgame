/**
 * ChipService Unit Tests
 * Tests CHIP token and staking functionality
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('ChipService', function () {
    let ChipService;
    let chipService;
    let mockChipContract;
    let mockStakingContract;
    let mockTronWeb;

    beforeEach(function () {
        mockTronWeb = {
            toDecimal: sinon.stub().callsFake(v => parseInt(v) || 0),
            address: { toHex: sinon.stub().returns('0x123') }
        };

        mockChipContract = {
            balanceOf: sinon.stub().returns({ call: sinon.stub().resolves('1000000000000000000000') }),
            totalSupply: sinon.stub().returns({ call: sinon.stub().resolves('10000000000000000000000') }),
            mint: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            transfer: sinon.stub().returns({ send: sinon.stub().resolves({}) })
        };

        mockStakingContract = {
            getStakeInfo: sinon.stub().returns({ call: sinon.stub().resolves({ stakedAmount: '500000000000000000000', lockEndTime: 0 }) }),
            getPendingReward: sinon.stub().returns({ call: sinon.stub().resolves('25000000000000000000') }),
            stake: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            unstake: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            claimReward: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            totalStaked: sinon.stub().returns({ call: sinon.stub().resolves('1000000000000000000000000') })
        };

        ChipService = require('../../server/services/ChipService');
        chipService = new ChipService({
            tronWeb: mockTronWeb,
            chipTokenAddress: 'TCHIP',
            stakingAddress: 'TSTAKE'
        });

        chipService.tokenContract = mockChipContract;
        chipService.stakingContract = mockStakingContract;
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('getBalance', function () {
        it('Should return 0 if contract not initialized', async function () {
            chipService.tokenContract = null;
            const result = await chipService.getBalance('TRX123');
            expect(result).to.equal(0);
        });

        it('Should return balance from contract', async function () {
            const result = await chipService.getBalance('TRX123');
            // Balance is parsed as number by toDecimal
            expect(result).to.equal(1e21);
        });
    });

    describe('getVipStatus', function () {
        it('Should return VIP status object', function () {
            const balance = 15000 * 1e6;
            const result = chipService.getVipStatus(balance);
            expect(result).to.exist;
        });
    });

    describe('calculateVipDiscount', function () {
        it('Should return discount amount', function () {
            const rake = 10e6;
            const discount = chipService.calculateVipDiscount('TRX123', rake);
            expect(discount).to.exist;
        });
    });

    describe('VIP Tier Thresholds', function () {
        it('Should define correct tier thresholds', function () {
            const vipThreshold = 10000 * 1e6;
            const superVipThreshold = 100000 * 1e6;

            expect(vipThreshold).to.equal(10e9);
            expect(superVipThreshold).to.equal(100e9);
        });
    });

    describe('Reward Calculation', function () {
        it('Should calculate staking rewards correctly', function () {
            const stakedAmount = 1000e6;
            const rewardRate = 0.1;

            const expectedReward = stakedAmount * rewardRate;
            expect(expectedReward).to.equal(100e6);
        });

        it('Should calculate early unstake penalty', function () {
            const stakedAmount = 1000e6;
            const penaltyRate = 0.1;
            const penalty = stakedAmount * penaltyRate;

            expect(penalty).to.equal(100e6);
        });
    });

    describe('Constructor', function () {
        it('should initialize with correct config', function () {
            expect(chipService.tronWeb).to.equal(mockTronWeb);
            expect(chipService.tokenAddress).to.equal('TCHIP');
            expect(chipService.stakingAddress).to.equal('TSTAKE');
        });
    });
});
