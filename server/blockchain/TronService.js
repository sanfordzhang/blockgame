/**
 * TronService - TronWeb Integration
 * Handles connection to TRON network and basic operations
 */

// tronweb v6+ exports TronWeb as a named export
const { TronWeb } = require('tronweb');

class TronService {
    constructor() {
        this.tronWeb = null;
        this.network = null;
        this.initialized = false;
    }

    /**
     * Initialize TronWeb for specified network
     * @param {string} network - 'testnet' | 'mainnet' | 'development'
     */
    init(network = 'testnet') {
        const config = this.getNetworkConfig(network);
        
        this.tronWeb = new TronWeb({
            fullHost: config.fullHost,
            privateKey: config.privateKey,
            headers: config.apiKey ? { 'TRON-PRO-API-KEY': config.apiKey } : undefined
        });
        
        this.network = network;
        this.initialized = true;
        
        // Get and log the server's wallet address (derived from private key)
        const serverAddress = this.getSignerAddress();
        console.log(`[TronService] Initialized for ${network} at ${config.fullHost}`);
        console.log(`[TronService] Server wallet address: ${serverAddress}`);
        
        // Set server wallet address in config for frontend to use
        const appConfig = require('../config');
        appConfig.setServerWalletAddress(serverAddress);
        
        return this;
    }

    /**
     * Get network configuration
     */
    getNetworkConfig(network) {
        const configs = {
            testnet: {
                fullHost: process.env.TESTNET_FULL_HOST || 'https://nile.trongrid.io',
                privateKey: process.env.TESTNET_PRIVATE_KEY,
                apiKey: process.env.TRONGRID_API_KEY,
                contractAddress: process.env.TESTNET_CONTRACT_ADDRESS
            },
            mainnet: {
                fullHost: process.env.MAINNET_FULL_HOST || 'https://api.trongrid.io',
                privateKey: process.env.MAINNET_PRIVATE_KEY,
                apiKey: process.env.TRONGRID_API_KEY,
                contractAddress: process.env.MAINNET_CONTRACT_ADDRESS
            },
            development: {
                fullHost: 'http://127.0.0.1:9090',
                privateKey: process.env.DEV_PRIVATE_KEY || 
                    '0000000000000000000000000000000000000000000000000000000000000001',
                apiKey: null,
                contractAddress: process.env.DEV_CONTRACT_ADDRESS
            }
        };

        const config = configs[network];
        if (!config) {
            throw new Error(`Unknown network: ${network}`);
        }
        return config;
    }

    /**
     * Get TRX balance for an address
     * @param {string} address - TRON address
     * @returns {Promise<number>} Balance in SUN
     */
    async getTrxBalance(address) {
        this.ensureInitialized();
        try {
            const balance = await this.tronWeb.trx.getBalance(address);
            return balance;
        } catch (error) {
            console.error(`[TronService] Error getting balance for ${address}:`, error.message);
            throw error;
        }
    }

    /**
     * Get current block number
     */
    async getCurrentBlock() {
        this.ensureInitialized();
        try {
            const block = await this.tronWeb.trx.getCurrentBlock();
            return block.block_header.raw_data.number;
        } catch (error) {
            console.error('[TronService] Error getting current block:', error.message);
            throw error;
        }
    }

    /**
     * Validate a TRON address
     * @param {string} address 
     * @returns {boolean}
     */
    isValidAddress(address) {
        return this.tronWeb.isAddress(address);
    }

    /**
     * Convert address to hex format
     */
    addressToHex(address) {
        return this.tronWeb.address.toHex(address);
    }

    /**
     * Convert hex to base58 address
     */
    hexToAddress(hex) {
        return this.tronWeb.address.fromHex(hex);
    }

    /**
     * Get address from private key
     */
    getAddressFromPrivateKey(privateKey) {
        return this.tronWeb.address.fromPrivateKey(privateKey).address;
    }

    /**
     * Get current signer address (from initialized private key)
     */
    getSignerAddress() {
        this.ensureInitialized();
        return this.tronWeb.defaultAddress.base58;
    }

    /**
     * Send TRX to an address
     * @param {string} to - Recipient address
     * @param {number} amount - Amount in SUN
     */
    async sendTrx(to, amount) {
        this.ensureInitialized();
        try {
            const tx = await this.tronWeb.trx.sendTransaction(to, amount);
            console.log(`[TronService] Sent ${amount} SUN to ${to}, tx: ${tx.txid}`);
            return tx;
        } catch (error) {
            console.error(`[TronService] Error sending TRX:`, error.message);
            throw error;
        }
    }

    /**
     * Wait for transaction confirmation
     * @param {string} txId - Transaction ID
     * @param {number} timeout - Timeout in ms
     */
    async waitForConfirmation(txId, timeout = 30000) {
        this.ensureInitialized();
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const info = await this.tronWeb.trx.getTransactionInfo(txId);
                if (info.id) {
                    return {
                        confirmed: true,
                        blockNumber: info.blockNumber,
                        receipt: info.receipt
                    };
                }
            } catch (error) {
                // Transaction not yet confirmed
            }
            
            await this.sleep(3000);
        }
        
        throw new Error(`Transaction ${txId} not confirmed within ${timeout}ms`);
    }

    /**
     * Get transaction info
     */
    async getTransactionInfo(txId) {
        this.ensureInitialized();
        return await this.tronWeb.trx.getTransactionInfo(txId);
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Ensure service is initialized
     */
    ensureInitialized() {
        if (!this.initialized || !this.tronWeb) {
            throw new Error('TronService not initialized. Call init() first.');
        }
    }

    /**
     * Get the TronWeb instance
     */
    getTronWeb() {
        this.ensureInitialized();
        return this.tronWeb;
    }
}

// Export singleton instance
module.exports = new TronService();
