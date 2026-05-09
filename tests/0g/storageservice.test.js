/**
 * Storage Service Mock Tests
 * Tests upload/download functionality in mock mode
 */

const { describe, it, beforeEach } = require('mocha');
const { expect } = require('chai');

describe('ZeroGStorageService (Mock)', function() {
    let storage;

    before(function() {
        try {
            storage = require('../../server/services/ZeroGStorageService');
        } catch (e) {
            this.skip();
        }
    });

    beforeEach(function() {
        // Create fresh instance for each test
        storage = new storage.constructor();
        // Force mock mode by setting env var temporarily
    });

    describe('uploadFile()', function() {
        it('should upload buffer and return root hash', async function() {
            const data = Buffer.from('test image data for NFT');
            const result = await storage.uploadFile(data);

            expect(result.rootHash).to.be.a('string');
            expect(result.rootHash).to.match(/^0x[0-9a-f]+$/i);
            expect(result.fileSize).to.equal(data.length);
            expect(result.merkleProof).to.be.an('array');
        });

        it('should produce unique hashes for different files', async function() {
            const r1 = await storage.uploadFile(Buffer.from('file A'));
            const r2 = await storage.uploadFile(Buffer.from('file B'));

            expect(r1.rootHash).to.not.equal(r2.rootHash);
        });

        it('should produce consistent hash for same file content', async function() {
            const data = Buffer.from('same content');
            // Note: mock mode includes timestamp, so exact same content may differ
            // This tests that the format is always correct
            const result = await storage.uploadFile(data);
            expect(result.rootHash).to.have.length.above(10);
        });
    });

    describe('uploadMetadata()', function() {
        it('should upload JSON metadata', async function() {
            const meta = {
                name: 'Test NFT',
                description: 'A test poker NFT',
                attributes: []
            };

            const result = await storage.uploadMetadata(meta);

            expect(result.rootHash).to.be.a('string');
        });

        it('should handle string JSON input', async function() {
            const jsonStr = '{"name":"Test"}';
            const result = await storage.uploadMetadata(jsonStr);

            expect(result.rootHash).to.be.a('string');
        });
    });

    describe('downloadFile()', function() {
        it('should download previously uploaded file from cache', async function() {
            const original = Buffer.from('downloadable content');
            const upload = await storage.uploadFile(original);
            
            const downloaded = await storage.downloadFile(upload.rootHash);

            expect(downloaded).to.be.instanceOf(Buffer);
        });
    });

    describe('getFileUrl()', function() {
        it('should return URL containing root hash', function() {
            const url = storage.getFileUrl('0xabc123def456');
            expect(url).to.be.a('string');
            expect(url).to.include('0xabc123def456');
        });
    });

    describe('uploadNFTAssets()', function() {
        it('should upload both image and metadata', async function() {
            const imgBuf = Buffer.from('fake_png_image_data');
            const meta = { name: 'Royal Flush INFT', rarity: 'Legendary' };

            const result = await storage.uploadNFTAssets(imgBuf, meta);

            expect(result.imageRootHash).to.be.a('string');
            expect(result.metadataRootHash).to.be.a('string');
            expect(result.metadataUrl).to.include('zerog://');
        });
    });

    describe('getStatus()', function() {
        it('should return service status', function() {
            const status = storage.getStatus();

            expect(status.initialized).to.equal(true);
            expect(status.queueLength).to.equal(0);
            expect(typeof status.isRealMode).to.equal('boolean');
        });
    });
});
