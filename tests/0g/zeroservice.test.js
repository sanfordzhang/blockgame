/**
 * ZeroGService Unit Tests
 * Tests EVM connection, address queries, and transaction construction
 */

const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');

describe('ZeroGService', function() {
    
    let ZeroGService;

    before(function() {
        try {
            ZeroGService = require('../../server/blockchain/ZeroGService');
        } catch (e) {
            console.log('Skipping: ZeroGService not loadable', e.message);
            this.skip();
        }
    });

    describe('Initialization', function() {
        it('should create instance without crashing', function() {
            const service = new ZeroGService();
            expect(service).to.be.an('object');
            expect(service.initialized).to.equal(false);
        });

        it('should have all required methods defined', function() {
            const service = new ZeroGService();
            expect(service.init).to.be.a('function');
            expect(service.getSignerAddress).to.be.a('function');
            expect(service.sendTransaction).to.be.a('function');
            expect(service.callContract).to.be.a('function');
            expect(service.queryEvents).to.be.a('function');
            expect(service.getNetworkConfig).to.be.a('function');
            expect(service.getBalance).to.be.a('function');
            expect(service.validateConnection).to.be.a('function');
        });
    });

    describe('getNetworkConfig()', function() {
        let service;

        beforeEach(function() {
            service = new ZeroGService();
        });

        it('should return testnet config for "testnet" parameter', function() {
            const cfg = service.getNetworkConfig('testnet');
            expect(cfg).to.be.an('object');
            expect(cfg.chainId).to.equal(16602);
            expect(cfg.rpcUrl).to.be.a('string');
            expect(cfg.privateKey).to.be.a('string');
        });

        it('should return mainnet config for "mainnet" parameter', function() {
            const cfg = service.getNetworkConfig('mainnet');
            expect(cfg).to.be.an('object');
            expect(cfg.chainId).to.equal(16661);
        });

        it('should fallback to testnet config for unknown network', function() {
            const cfg = service.getNetworkConfig('unknown_network');
            expect(cfg.chainId).to.equal(16602); // Fallback to testnet
        });

        it('should use env vars when available', function() {
            const originalRpc = process.env.ZEROG_RPC_URL;
            process.env.ZEROG_RPC_URL = 'https://custom-rpc.test.0g.ai';

            const cfg = service.getNetworkConfig('testnet');
            expect(cfg.rpcUrl).to.include('custom-rpc');

            if (originalRpc !== undefined) {
                process.env.ZEROG_RPC_URL = originalRpc;
            } else {
                delete process.env.ZEROG_RPC_URL;
            }
        });
    });

    describe('init() - without real connection', function() {
        it('should handle missing private key gracefully', function() {
            const service = new ZeroGService();
            
            // Temporarily remove private key
            const originalKey = process.env.ZEROG_PRIVATE_KEY;
            delete process.env.ZEROG_PRIVATE_KEY;

            service.init('testnet');
            // Should NOT throw, just remain uninitialized
            expect(service.initialized).to.equal(false);

            // Restore
            if (originalKey) process.env.ZEROG_PRIVATE_KEY = originalKey;
        });

        it('should handle missing RPC URL gracefully', function() {
            const service = new ZeroGService();
            const originalUrl = process.env.ZEROG_RPC_URL;
            delete process.env.ZEROG_RPC_URL;

            service.init('testnet');
            expect(service.initialized).to.equal(false);

            if (originalUrl) process.env.ZEROG_RPC_URL = originalUrl;
        });
    });

    describe('sendTransaction() - validation', function() {
        it('should reject when not initialized', async function() {
            const service = new ZeroGService();

            try {
                await service.sendTransaction('0x1234', '0x00', '0');
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.message).to.include('Not initialized');
            }
        });
    });

    describe('callContract() - validation', function() {
        it('should reject when not initialized', async function() {
            const service = new ZeroGService();

            try {
                await service.callContract([], '0x1234', 'balanceOf', []);
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.message).to.include('Not initialized');
            }
        });
    });

    describe('queryEvents() - validation', function() {
        it('should reject when not initialized', async function() {
            const service = new ZeroGService();

            try {
                await service.queryEvents([], '0x1234', 'Transfer', {});
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err.message).to.include('Not initialized');
            }
        });
    });
});
