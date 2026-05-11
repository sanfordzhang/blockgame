/**
 * ZeroGService - 0G (ZeroGravity) EVM Chain Integration
 * Uses ethers.js v6 for EVM-compatible interaction with 0G network
 */

const config = require('../config');

// Use ethers v6 for EVM-compatible 0G interaction
// Note: project has both ethers (v5, for TRON/Hardhat) and ethers6 (v6, for 0G/EVM)
let ethers;
try {
    ethers = require('ethers6');
} catch (e) {
    console.warn('[ZeroGService] ethers6 not found, attempting fallback to ethers');
    try {
        ethers = require('ethers');
        // Check if v6 API is available
        if (!ethers.JsonRpcProvider) {
            throw new Error('ethers v5 detected but v6 API required - please install ethers6: npm install ethers6');
        }
    } catch (e2) {
        console.error('[ZeroGService] No compatible ethers version found:', e2.message);
        throw e2;
    }
}

class ZeroGService {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.network = null;
        this.chainId = null;
        this.initialized = false;
    }

    /**
     * Initialize ZeroG service for specified network
     * @param {string} network - 'testnet' (Chain ID: 16602) | 'mainnet' (Chain ID: 16661)
     * @returns {ZeroGService} this
     */
    init(network = 'testnet') {
        const netConfig = this.getNetworkConfig(network);
        
        if (!netConfig.rpcUrl) {
            console.warn('[ZeroGService] No RPC URL configured for', network);
            return this;
        }

        if (!netConfig.privateKey) {
            console.warn('[ZeroGService] No private key configured for', network);
            return this;
        }

        try {
            this.provider = new ethers.JsonRpcProvider(netConfig.rpcUrl);
            this.wallet = new ethers.Wallet(netConfig.privateKey, this.provider);
            this.network = network;
            this.chainId = netConfig.chainId;
            this.initialized = true;

            const addr = this.getSignerAddress();
            console.log(`[ZeroGService] Initialized for ${network} (Chain ID: ${this.chainId})`);
            console.log(`[ZeroGService] Server wallet address: ${addr}`);
            
            // Set server wallet address in config
            config.setZeroGWalletAddress && config.setZeroGWalletAddress(addr);

        } catch (error) {
            console.error('[ZeroGService] Initialization failed:', error.message);
            this.initialized = false;
        }

        return this;
    }

    /**
     * Get signer address
     * @returns {string} 0x-prefixed EVM address
     */
    getSignerAddress() {
        if (!this.initialized || !this.wallet) {
            return null;
        }
        return this.wallet.address;
    }

    /**
     * Send a transaction via the server wallet
     * @param {string} to - Recipient address
     * @param {string} data - Encoded calldata (hex)
     * @param {string|bigint} [value='0'] - ETH value to send
     * @returns {Promise<Object>} Transaction receipt
     */
    async sendTransaction(to, data, value = '0') {
        if (!this.initialized) {
            throw new Error('[ZeroGService] Not initialized');
        }

        const tx = {
            to,
            data,
            value: typeof value === 'string' ? value : ethers.parseEther(value.toString())
        };

        console.log(`[ZeroGService] Sending tx to ${to}, value: ${value}`);

        const sentTx = await this.wallet.sendTransaction(tx);
        console.log(`[ZeroGService] Tx submitted: ${sentTx.hash}`);
        
        const receipt = await sentTx.wait();
        console.log(`[ZeroGService] Tx confirmed in block ${receipt.blockNumber}, gas used: ${receipt.gasUsed.toString()}`);

        return {
            hash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            status: receipt.status === 1 ? 'success' : 'failed',
            from: receipt.from,
            to: receipt.to
        };
    }

    /**
     * Read-only contract call
     * @param {Array|Object} abi - Contract ABI
     * @param {string} address - Contract address
     * @param {string} method - Method name
     * @param {Array} [args=[]] - Arguments
     * @returns {Promise<*>} Result
     */
    async callContract(abi, address, method, args = []) {
        if (!this.initialized) {
            throw new Error('[ZeroGService] Not initialized');
        }

        const contract = new ethers.Contract(address, abi, this.provider);
        return await contract[method](...args);
    }

    /**
     * Query events from a contract using queryFilter
     * @param {Array|Object} abi - Contract ABI
     * @param {string} address - Contract address
     * @param {string} eventName - Event name (e.g., 'Deposited')
     * @param {Object} [filter={}] - Filter with fromBlock, toBlock, etc.
     * @returns {Promise<Array>} Event log array
     */
    async queryEvents(abi, address, eventName, filter = {}) {
        if (!this.initialized) {
            throw new Error('[ZeroGService] Not initialized');
        }

        const contract = new ethers.Contract(address, abi, this.provider);
        const eventFragment = contract.interface.getEvent(eventName);
        
        const defaultFilter = {
            fromBlock: filter.fromBlock || 0n,
            toBlock: filter.toBlock || 'latest',
            ...filter
        };

        const logs = await contract.queryFilter(eventFragment, defaultFilter.fromBlock, defaultFilter.toBlock);
        
        return logs.map(log => ({
            ...log,
            parsed: contract.interface.parseLog(log)?.args || {}
        }));
    }

    /**
     * Get network configuration for 0G
     * @param {string} network - 'testnet' | 'mainnet'
     * @returns {Object} Config object
     */
    getNetworkConfig(network) {
        const configs = {
            testnet: {
                rpcUrl: process.env.ZEROG_RPC_URL || config.ZEROG_RPC_URL || 'https://rpc.testnet.0g.ai',
                privateKey: process.env.ZEROG_PRIVATE_KEY || config.ZEROG_PRIVATE_KEY || '',
                chainId: 16602,
                pokerGameAddress: process.env.ZEROG_POKERGAME_ADDRESS || config.ZEROG_POKERGAME_ADDRESS || '',
                inftAddress: process.env.ZEROG_INFT_ADDRESS || config.ZEROG_INFT_ADDRESS || ''
            },
            mainnet: {
                rpcUrl: process.env.ZEROG_MAINNET_RPC_URL || 'https://rpc.0g.ai',
                privateKey: process.env.ZEROG_MAINNET_PRIVATE_KEY || config.ZEROG_PRIVATE_KEY || '',
                chainId: 16661,
                pokerGameAddress: process.env.ZEROG_MAINNET_POKERGAME_ADDRESS || '',
                inftAddress: process.env.ZEROG_MAINNET_INFT_ADDRESS || ''
            }
        };

        return configs[network] || configs.testnet;
    }

    /**
     * Get native token balance for an address
     * @param {string} address - EVM address
     * @returns {Promise<string>} Balance in ETH units as decimal string
     */
    async getBalance(address) {
        if (!this.initialized) {
            throw new Error('[ZeroGService] Not initialized');
        }
        const balance = await this.provider.getBalance(address);
        return ethers.formatEther(balance);
    }

    /**
     * Check if connected to correct chain
     * @returns {Promise<boolean>}
     */
    async validateConnection() {
        if (!this.initialized) return false;
        try {
            const network = await this.provider.getNetwork();
            return Number(network.chainId) === this.chainId;
        } catch (e) {
            return false;
        }
    }
}

module.exports = ZeroGService;
