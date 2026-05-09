/**
 * zeroGInteract - Utility functions for 0G Chain interaction
 * Used alongside ZeroGContext for direct wallet/contract interactions
 */

const CHAIN_IDS = {
    TESTNET: '0x40EA',   // 16602
    MAINNET: '0x4115'    // 16661
};

/**
 * Check if an EVM wallet (MetaMask/OKX) is available
 * @returns {boolean}
 */
export function hasEvmWallet() {
    return typeof window !== 'undefined' && !!window.ethereum;
}

/**
 * Connect wallet and get accounts
 * @returns {Promise<string[]>} Array of addresses
 */
export async function connectWallet() {
    if (!hasEvmWallet()) {
        throw new Error('No EVM wallet found. Install MetaMask.');
    }
    return window.ethereum.request({ method: 'eth_requestAccounts' });
}

/**
 * Disconnect (clears local state; actual wallet disconnection handled by extension)
 */
export function disconnectWallet() {
    localStorage.removeItem('zerog_connected');
}

/**
 * Switch to 0G network
 * @param {'testnet'|'mainnet'} network 
 */
export async function switchChain(network = 'testnet') {
    if (!hasEvmWallet()) throw new Error('No wallet');

    const configs = {
        testnet: {
            chainId: CHAIN_IDS.TESTNET,
            chainName: '0G Testnet',
            nativeCurrency: { name: '0G Token', symbol: '0G', decimals: 18 },
            rpcUrls: ['https://evmrpc-galileo.0g.ai'],
            blockExplorerUrls: ['https://chainscan-galileo.0g.ai']
        },
        mainnet: {
            chainId: CHAIN_IDS.MAINNET,
            chainName: '0G Mainnet',
            nativeCurrency: { name: '0G Token', symbol: '0G', decimals: 18 },
            rpcUrls: ['https://rpc.0g.ai'],
            blockExplorerUrls: ['https://evm-explorer.0g.ai']
        }
    };

    const cfg = configs[network];

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: cfg.chainId }]
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [cfg]
            });
        } else {
            throw switchError;
        }
    }
}

/**
 * Sign message with connected wallet
 * @param {string} message - Message to sign
 * @param {string} [address] - Optional specific address (defaults to first account)
 * @returns {Promise<string>} Signature
 */
export async function signMessage(message, address) {
    if (!hasEvmWallet()) throw new Error('No wallet');
    
    const addr = address || (await connectWallet())[0];
    return window.ethereum.request({
        method: 'personal_sign',
        params: [message, addr]
    });
}

/**
 * Send transaction via connected wallet
 * @param {Object} tx - Transaction object { to, data, value? }
 * @returns {Promise<string>} Transaction hash
 */
export async function sendTransaction(tx) {
    if (!hasEvmWallet()) throw new Error('No wallet');

    const txParams = {
        from: (await window.ethereum.request({ method: 'eth_accounts' }))[0],
        to: tx.to,
        data: tx.data || '0x',
        value: tx.value || '0x0'
    };

    const hash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams]
    });

    return hash;
}

/**
 * Get ETH/native token balance for address
 * @param {string} [address] - Address to query (default: first account)
 * @returns {Promise<string>} Balance as decimal ETH string
 */
export async function getBalance(address) {
    if (!hasEvmWallet()) return '0';

    const addr = address || (await window.ethereum.request({ method: 'eth_accounts' }))[0];
    if (!addr) return '0';

    const bal = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [addr, 'latest']
    });

    return (parseInt(bal, 16) / 1e18).toString();
}

/**
 * Format address for display
 * @param {string} address - Full EVM address
 * @param {number} [startChars=6] - Chars to show at start
 * @param {number} [endChars=4] - Chars to show at end
 * @returns {string}
 */
export function formatAddress(address, startChars = 6, endChars = 4) {
    if (!address) return '';
    const clean = address.replace(/^0x/, '');
    return `0x${clean.slice(0, startChars)}...${clean.slice(-endChars)}`;
}

/**
 * Get current chain ID
 * @returns {Promise<number>}
 */
export async function getChainId() {
    if (!hasEvmWallet()) return null;
    const cid = await window.ethereum.request({ method: 'eth_chainId' });
    return parseInt(cid, 16);
}

/**
 * Check if currently on 0G network
 * @returns {Promise<boolean>}
 */
export async function isOn0GNetwork() {
    const chainId = await getChainId();
    return chainId === 16602 || chainId === 16661;
}

/**
 * Shorten long hashes for display
 * @param {string} hash 
 * @returns {string}
 */
export function shortenHash(hash) {
    if (!hash || typeof hash !== 'string') return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export default {
    hasEvmWallet,
    connectWallet,
    disconnectWallet,
    switchChain,
    signMessage,
    sendTransaction,
    getBalance,
    formatAddress,
    getChainId,
    isOn0GNetwork,
    shortenHash,
    CHAIN_IDS
};
