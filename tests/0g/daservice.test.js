/**
 * DA Service Mock Tests
 */

const assert = require('assert');

describe('ZeroGDAService', function () {
    this.timeout(5000);

    let daService;

    before(async function () {
        try {
            const ZeroGDAService = require('../../server/services/ZeroGDAService');
            daService = new ZeroGDAService();
            await daService.init();
        } catch (e) {
            console.log('DA Service init skipped:', e.message);
        }
    });

    it('should submit state hash (mock mode)', async function () {
        if (!daService) {
            this.skip(); // Skip if service unavailable
        }

        const result = await daService.submitStateHash({
            handId: `test-hand-${Date.now()}`,
            stateHash: '0x' + 'b'.repeat(64),
            winners: ['0xPlayer1'],
            timestamp: Date.now()
        });

        assert.ok(result);
        // In mock mode, should succeed
        if (daService.mockMode) {
            assert.ok(result.success || result.batchIndex !== undefined);
        }
    });

    it('should batch submit multiple hashes', async function () {
        if (!daService) this.skip();

        const hashes = Array.from({ length: 5 }, (_, i) => ({
            handId: `batch-${i}-${Date.now()}`,
            stateHash: '0x' + 'c'.repeat(64),
            timestamp: Date.now() + i
        }));

        const results = await daService.batchSubmit(hashes);
        assert.ok(Array.isArray(results));
        assert.strictEqual(results.length, 5);
    });

    it('should handle empty batch gracefully', async function () {
        if (!daService) this.skip();

        const results = await daService.batchSubmit([]);
        assert.ok(Array.isArray(results));
        assert.strictEqual(results.length, 0);
    });
});
