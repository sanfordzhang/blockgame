/**
 * BlockchainServiceInterface
 * 统一区块链服务接口约定，支持多链适配器模式（TRON / 0G EVM）
 *
 * 实现类必须提供以下方法：
 * - init(network)           : 初始化连接
 * - getSignerAddress()      : 获取签名者地址
 * - sendTransaction(tx)     : 发送交易
 * - callContract(abi, address, method, args) : 只读合约调用
 * - queryEvents(abi, address, eventName, filter): 查询链上事件
 * - getNetworkConfig(network): 获取网络配置
 */

class BlockchainServiceInterface {
    constructor() {
        this.network = null;
        this.initialized = false;
    }

    /**
     * Initialize connection to blockchain network
     * @param {string} network - Network identifier (e.g., 'testnet', 'mainnet')
     * @returns {BlockchainServiceInterface} this
     */
    init(network) {
        throw new Error('init() must be implemented by subclass');
    }

    /**
     * Get the signer/wallet address used for transactions
     * @returns {string} Address in chain-specific format
     */
    getSignerAddress() {
        throw new Error('getSignerAddress() must be implemented by subclass');
    }

    /**
     * Send a signed transaction to the blockchain
     * @param {Object} tx - Transaction object (format depends on chain)
     * @returns {Promise<Object>} Transaction receipt
     */
    async sendTransaction(tx) {
        throw new Error('sendTransaction() must be implemented by subclass');
    }

    /**
     * Make a read-only contract call
     * @param {Array|Object} abi - Contract ABI
     * @param {string} address - Contract address
     * @param {string} method - Method name to call
     * @param {Array} args - Method arguments
     * @returns {Promise<*>} Call result
     */
    async callContract(abi, address, method, args = []) {
        throw new Error('callContract() must be implemented by subclass');
    }

    /**
     * Query on-chain events/logs
     * @param {Array|Object} abi - Contract ABI
     * @param {string} address - Contract address
     * @param {string} eventName - Event name to query
     * @param {Object} filter - Event filter criteria
     * @returns {Promise<Array>} Array of event logs
     */
    async queryEvents(abi, address, eventName, filter = {}) {
        throw new Error('queryEvents() must be implemented by subclass');
    }

    /**
     * Get network-specific configuration
     * @param {string} network - Network identifier
     * @returns {Object} Network config (RPC URLs, contract addresses, etc.)
     */
    getNetworkConfig(network) {
        throw new Error('getNetworkConfig() must be implemented by subclass');
    }
}

module.exports = BlockchainServiceInterface;
