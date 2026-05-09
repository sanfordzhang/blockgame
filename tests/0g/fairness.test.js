/**
 * Fairness Service Tests
 * Tests seed commitment-reveal scheme and state hash generation
 */

const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');

// Use the singleton or create fresh instance
let FairnessService;
try {
    const mod = require('../../server/pokergame/FairnessService');
    FairnessService = mod.FairnessService || mod; 
} catch (e) {
    console.log('Skipping: FairnessService not loadable');
}

describe('FairnessService', function() {

    if (!FairnessService) {
        it.skip('skipping - FairnessService not available', () => {});
        return;
    }

    let fairness;

    beforeEach(function() {
        fairness = new FairnessService();
    });

    afterEach(function() {
        fairness.cleanup(0); // Clean all records
    });

    describe('generateCommitment()', function() {
        it('should generate a commitment hash', function() {
            const result = fairness.generateCommitment('tbl_001', 1);
            
            expect(result).to.have.property('commitment').that.is.a('string');
            expect(result.commitment).to.match(/^0x[0-9a-f]+$/i);
            expect(result.commitment.length).to.equal(66); // 0x + 64 hex chars
        });

        it('should include handId in result', function() {
            const result = fairness.generateCommitment('tbl_002', 5);
            expect(result.handId).to.equal('tbl_002_h5');
        });

        it('should generate unique commitments for each call', function() {
            const r1 = fairness.generateCommitment('tbl_001', 1);
            const r2 = fairness.generateCommitment('tbl_001', 2);
            
            expect(r1.commitment).to.not.equal(r2.commitment);
        });

        it('should store commitment record internally', function() {
            const result = fairness.generateCommitment('tbl_001', 3);
            const info = fairness.getCommitmentInfo(result.handId);
            
            expect(info).to.not.be.null;
            expect(info.commitment).to.equal(result.commitment);
            expect(info.revealed).to.equal(false);
            expect(info.seed).to.not.be.null; // Seed is stored but not revealed yet
        });
    });

    describe('revealSeed()', function() {
        let commitmentResult;

        beforeEach(function() {
            commitmentResult = fairness.generateCommitment('tbl_reveal', 10);
        });

        it('should reveal seed and salt', function() {
            const reveal = fairness.revealSeed(commitmentResult.handId);
            
            expect(reveal).to.have.property('seed').that.is.a('string');
            expect(reveal).to.have.property('salt').that.is.a('string');
            expect(reveal).to.have.property('valid').that.is.a('boolean');
            expect(reveal.valid).to.equal(true);
        });

        it('should mark record as revealed', function() {
            fairness.revealSeed(commitmentResult.handId);
            const info = fairness.getCommitmentInfo(commitmentResult.handId);
            
            expect(info.revealed).to.equal(true);
        });

        it('should be idempotent (second reveal returns same data)', function() {
            const r1 = fairness.revealSeed(commitmentResult.handId);
            const r2 = fairness.revealSeed(commitmentResult.handId);
            
            expect(r1.seed).to.equal(r2.seed);
            expect(r1.salt).to.equal(r2.salt);
            expect(r1.alreadyRevealed).to.equal(false);
            expect(r2.alreadyRevealed).to.equal(true);
        });

        it('should fail for unknown handId', function() {
            try {
                fairness.revealSeed('nonexistent_hand_xyz');
                expect.fail('Should have thrown');
            } catch (e) {
                expect(e.message).to.include('No commitment found');
            }
        });
    });

    describe('verifyCommitment()', function() {
        it('should verify correct commitment-reveal pair', function() {
            const commit = fairness.generateCommitment('tbl_verify', 1);
            const reveal = fairness.revealSeed(commit.handId);
            
            const valid = fairness.verifyCommitment(
                commit.commitment,
                reveal.seed,
                reveal.salt,
                commit.tableId,
                commit.handNumber
            );
            
            expect(valid).to.equal(true);
        });

        it('should detect tampered seed', function() {
            const commit = fairness.generateCommitment('tbl_tamper', 1);
            const reveal = fairness.revealSeed(commit.handId);
            
            const invalid = fairness.verifyCommitment(
                commit.commitment,
                '0x' + 'deadbeef'.repeat(8),  // Wrong seed!
                reveal.salt,
                commit.tableId,
                commit.handNumber
            );
            
            expect(invalid).to.equal(false);
        });

        it('should detect tampered salt', function() {
            const commit = fairness.generateCommitment('tbl_salter', 1);
            const reveal = fairness.revealSeed(commit.handId);
            
            const invalid = fairness.verifyCommitment(
                commit.commitment,
                reveal.seed,
                '0x' + 'cafebabe'.repeat(4),   // Wrong salt!
                commit.tableId,
                commit.handNumber
            );
            
            expect(invalid).to.equal(false);
        });
    });

    describe('generateStateHash()', function() {
        it('should produce deterministic hash from same input', function() {
            const gameData = {
                handId: 'hash_test_1',
                tableId: 'tbl_hash',
                boardCards: ['Ah', 'Kh', 'Qd'],
                playerResults: [
                    { addr: '0xPlayer1', chipsWon: 500 },
                    { addr: '0xAI_Bot', chipsWon: 300 }
                ]
            };

            const h1 = fairness.generateStateHash(gameData);
            const h2 = fairness.generateStateHash(gameData);

            expect(h1).to.equal(h2);
            expect(h1).to.match(/^0x[0-9a-f]{64}$/);
        });

        it('should produce different hashes for different data', function() {
            const d1 = { handId: 'h1', results: [{ won: 100 }] };
            const d2 = { handId: 'h1', results: [{ won: 200 }] };

            const h1 = fairness.generateStateHash(d1);
            const h2 = fairness.generateStateHash(d2);

            expect(h1).to.not.equal(h2);
        });

        it('should link to previous state hash (chain)', function() {
            const d1 = { handId: 'chain_1', pot: 100 };
            const d2 = { handId: 'chain_2', pot: 200 };
            const d3 = { handId: 'chain_3', pot: 300 };

            fairness.lastStateHash = null;
            const h1 = fairness.generateStateHash(d1);
            const h2 = fairness.generateStateHash(d2);
            const h3 = fairness.generateStateHash(d3);

            // All should be different
            expect(h1).to.not.equal(h2);
            expect(h2).to.not.equal(h3);

            // State records should show chain linkage
            const s2 = fairness.stateHashes.get('chain_2');
            const s3 = fairness.stateHashes.get('chain_3');
            expect(s2.prevStateHash).to.equal(h1);
            expect(s3.prevStateHash).to.equal(h2);
        });
    });

    describe('verifyHandFairness()', function() {
        it('should validate a complete fair hand', async function() {
            // Setup: commit -> reveal -> state hash
            const commit = fairness.generateCommitment('tbl_full', 99);
            const reveal = fairness.revealSeed(commit.handId);
            fairness.generateStateHash({
                handId: commit.handId,
                tableId: commit.tableId,
                boardCards: ['Ah', 'Ks', 'Qh', 'Jc', 'Td']
            });

            const report = await fairness.verifyHandFairness(commit.handId);

            expect(report.overallValid).to.equal(true);
            expect(report.verdict).to.include('VALID');
            expect(report.checks.seedCommitment.valid).to.equal(true);
            expect(report.checks.stateHash.valid).to.equal(true);
            expect(report.errors).to.have.lengthOf(0);
        });

        it('should report errors for incomplete hands', async function() {
            const report = await fairness.verifyHandFairness('nonexistent_hand');

            expect(report.overallValid).to.equal(false);
            expect(report.errors.length).to.be.greaterThan(0);
        });
    });

    describe('cleanup()', function() {
        it('should remove old records', function() {
            fairness.generateCommitment('cleanup_test', 1);
            expect(fairness.commitments.size).to.equal(1);

            fairness.cleanup(0); // maxAgeMs = 0 means everything is old
            expect(fairness.commitments.size).to.equal(0);
        });
    });

    describe('getStatus()', function() {
        it('should return current status summary', function() {
            fairness.generateCommitment('status_test', 1);
            fairness.generateStateHash({ handId: 'st_1' });

            const status = fairness.getStatus();

            expect(status.activeCommitments).to.be.at.least(1);
            expect(status.stateHashCount).to.be.at.least(1);
            expect(typeof status.hasLastStateHash).to.equal('boolean');
        });
    });
});
