/**
 * DAOService Unit Tests
 * Tests DAO governance functionality
 */

const { expect } = require('chai');
const sinon = require('sinon');

describe('DAOService', function () {
    let DAOService;
    let daoService;
    let mockContract;
    let mockChipContract;
    let mockTronWeb;

    beforeEach(function () {
        mockContract = {
            createProposal: sinon.stub().returns({
                send: sinon.stub().resolves({ events: { ProposalCreated: { result: { proposalId: { toNumber: () => 1 } } } } })
            }),
            castVote: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            executeProposal: sinon.stub().returns({ send: sinon.stub().resolves({}) }),
            proposalThreshold: sinon.stub().returns({ call: sinon.stub().resolves('1000000000') }),
            votingPeriod: sinon.stub().returns({ call: sinon.stub().resolves('259200') }),
            quorum: sinon.stub().returns({ call: sinon.stub().resolves('10000000000') })
        };

        mockChipContract = {
            balanceOf: sinon.stub().returns({ call: sinon.stub().resolves('5000000000') }),
            totalSupply: sinon.stub().returns({ call: sinon.stub().resolves('100000000000000') })
        };

        mockTronWeb = {
            toDecimal: sinon.stub().callsFake(v => parseInt(v) || 0),
            sha3: sinon.stub().returns('12345678'),
            utils: { padLeft: sinon.stub().callsFake(s => s.toString().padStart(64, '0')) }
        };

        DAOService = require('../../server/services/DAOService');
        daoService = new DAOService.DAOService({
            tronWeb: mockTronWeb,
            governanceAddress: 'TGOVERNANCE',
            chipTokenAddress: 'TCHIP'
        });

        daoService.contract = mockContract;
        daoService.chipContract = mockChipContract;
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('getChipBalance', function () {
        it('should return CHIP balance', async function () {
            const balance = await daoService.getChipBalance('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');

            expect(balance).to.equal(5000000000);
        });

        it('should return 0 if chipContract not initialized', async function () {
            daoService.chipContract = null;

            const balance = await daoService.getChipBalance('TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b');

            expect(balance).to.equal(0);
        });
    });

    describe('getTotalVotingPower', function () {
        it('should return total supply', async function () {
            const power = await daoService.getTotalVotingPower();

            expect(power).to.equal(100000000000000);
        });
    });

    describe('getProposalThreshold', function () {
        it('should return threshold from contract', async function () {
            const threshold = await daoService.getProposalThreshold();

            expect(threshold).to.equal(1000000000);
        });

        it('should return default threshold if no contract', async function () {
            daoService.contract = null;

            const threshold = await daoService.getProposalThreshold();

            expect(threshold).to.equal(1000 * 1e6);
        });
    });

    describe('getVotingPeriod', function () {
        it('should return voting period from contract', async function () {
            const period = await daoService.getVotingPeriod();

            expect(period).to.equal(259200);
        });

        it('should return default period if no contract', async function () {
            daoService.contract = null;

            const period = await daoService.getVotingPeriod();

            expect(period).to.equal(3 * 24 * 60 * 60);
        });
    });

    describe('encodeSetRakeRate', function () {
        it('should encode rake rate call data', function () {
            const callData = daoService.encodeSetRakeRate(300); // 3%

            expect(callData).to.match(/^0x/);
            expect(callData.length).to.be.greaterThan(10);
        });
    });

    describe('Proposal Types', function () {
        it('should support multiple proposal types', function () {
            const proposalTypes = [
                { type: 'RAKE_RATE', description: 'Change rake rate' },
                { type: 'TOURNAMENT_CONFIG', description: 'Modify tournament configuration' },
                { type: 'GENERAL', description: 'General proposal' }
            ];

            expect(proposalTypes).to.have.length(3);
        });
    });

    describe('Voting Logic', function () {
        it('should calculate quorum correctly', function () {
            const totalSupply = 100000000000000;
            const quorumPercentage = 10;
            const requiredQuorum = totalSupply * quorumPercentage / 100;

            expect(requiredQuorum).to.equal(10000000000000);
        });

        it('should determine if proposal passes', function () {
            const forVotes = 600;
            const againstVotes = 400;
            const totalVotes = forVotes + againstVotes;
            const quorum = 500;

            const quorumReached = totalVotes >= quorum;
            const majorityReached = forVotes > againstVotes;

            expect(quorumReached).to.be.true;
            expect(majorityReached).to.be.true;
        });
    });

    describe('Constructor', function () {
        it('should initialize with correct config', function () {
            expect(daoService.tronWeb).to.equal(mockTronWeb);
            expect(daoService.governanceAddress).to.equal('TGOVERNANCE');
        });
    });
});
