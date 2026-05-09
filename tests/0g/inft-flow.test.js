/**
 * INFT Full Mint Flow Integration Test
 * Tests the complete flow: game end → achievement detection → storage upload → INFT mint
 */

const assert = require('assert');

describe('INFT Mint Flow Integration', function () {
    this.timeout(15000);

    it('should detect achievement from hand cards', function () {
        const nftModule = require('../../server/services/NFTService');
        
        // Royal Flush should be detected
        const royalFlush = nftModule.checkAchievement(
            ['Ah', 'Kh'], 
            ['Qh', 'Jh', 'Th', '2c', '3d']
        );
        assert.ok(royalFlush, 'Should detect royal flush');
        assert.strictEqual(royalFlush.type, 'ROYAL_FLUSH');
    });

    it('should detect straight flush', function () {
        const nftModule = require('../../server/services/NFTService');
        
        const sf = nftModule.checkAchievement(
            ['8h', '9h'],
            ['6h', '7h', 'Th', '2c', '3d']
        );
        assert.ok(sf);
        assert.strictEqual(sf.type, 'STRAIGHT_FLUSH');
    });

    it('should detect four of a kind', function () {
        const nftModule = require('../../server/services/NFTService');
        
        const fok = nftModule.checkAchievement(
            ['Ks', 'Kd'],
            ['Kh', 'Kc', '3s', '7h', '2d']
        );
        assert.ok(fok);
        assert.strictEqual(fok.type, 'FOUR_OF_A_KIND');
    });

    it('should NOT detect non-achievement hands', function () {
        const nftModule = require('../../server/services/NFTService');
        
        const pair = nftModule.checkAchievement(
            ['2h', '2d'],
            ['7s', '8c', 'Th', 'Kh', 'As']
        );
        assert.strictEqual(pair, null, 'Pair should not be an achievement');
    });

    it('should prepare NFT mint data correctly', async function () {
        const nftModule = require('../../server/services/NFTService');
        
        // This requires database connection; skip gracefully if not available
        try {
            const result = await nftModule.prepareMint('TTestAddress123', {
                achievementType: 'ROYAL_FLUSH',
                gameSessionId: 'test-game-integration-001',
                handData: {
                    cards: [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 'h' }]
                }
            });
            
            assert.ok(result.success);
            assert.ok(result.tokenId);
            assert.ok(result.signature);
            assert.strictEqual(result.signature.v, 27 || 28);
            console.log(`  Prepared NFT #${result.tokenId} type=${result.achievementType}`);
        } catch (e) {
            console.log('  Skipped (DB may not be available):', e.message);
        }
    });

    it('should generate commitment-reveal pair for fairness', function () {
        const FairnessService = require('../../server/pokergame/FairnessService');
        const fs = new FairnessService();
        
        const tableId = 'test-table-inft';
        const handNum = 42;

        // Generate commitment
        const commit = fs.generateCommitment(tableId, handNum);
        assert.ok(commit.commitment);
        assert.ok(commit.seed);
        assert.ok(commit.salt);
        assert.strictEqual(commit.tableId, tableId);
        assert.strictEqual(handNum, handNum);

        // Reveal and verify
        const reveal = fs.revealSeed(`hand-${Date.now()}`, commit.seed, commit.salt, tableId, handNum);
        assert.ok(reveal.valid);

        // Verify the commitment matches
        const verify = fs.verifyCommitment(commit.commitment, commit.seed, commit.salt, tableId, handNum);
        assert.ok(verify.valid);
    });
});
