/**
 * zeroGInteract - Utility functions for 0G Chain interaction
 * Used alongside ZeroGContext for direct wallet/contract interactions
 */

import { ethers } from 'ethers';

const CHAIN_IDS = {
    TESTNET: '0x40DA',   // 16602 (0G Testnet)
    MAINNET: '0x4115'    // 16661 (0G Mainnet)
};

// === Global pending request guard ===
// Prevents "wallet_requestPermissions already pending" error when multiple
// connect/switch calls happen simultaneously (e.g., button click + page auto-restore)
let _pendingRequest = null;

function _setPending(promise) {
    _pendingRequest = promise;
    promise.finally(() => {
        if (_pendingRequest === promise) _pendingRequest = null;
    });
}

function _isPending() {
    return _pendingRequest !== null;
}

/**
 * Check if an EVM wallet (MetaMask/OKX) is available
 * @returns {boolean}
 */
export function hasEvmWallet() {
    return typeof window !== 'undefined' && !!window.ethereum;
}

/**
 * Connect wallet and get accounts (with deduplication guard)
 * @returns {Promise<{address: string, addresses: string[]}>} Object with primary address
 */
export async function connectWallet() {
    if (!hasEvmWallet()) {
        throw new Error('No EVM wallet found. Install MetaMask.');
    }

    if (_isPending()) {
        console.warn('[zeroG] Request already pending, waiting for existing...');
        try { return await _pendingRequest; } catch { /* fall through */ }
    }

    const p = (async () => {
        const addresses = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return { address: addresses[0], addresses };
    })();
    _setPending(p);
    return p;
}

/**
 * Disconnect (clears local state; actual wallet disconnection handled by extension)
 */
export function disconnectWallet() {
    localStorage.removeItem('zerog_connected');
}

/**
 * Switch to 0G network with robust error handling (with deduplication guard)
 * @param {'testnet'|'mainnet'} network
 */
export async function switchChain(network = 'testnet') {
    if (!hasEvmWallet()) throw new Error('No wallet');

    if (_isPending()) {
        console.warn('[zeroG] Switch chain request already pending, waiting...');
        try { return await _pendingRequest; } catch { /* fall through */ }
    }

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
    const targetChainId = parseInt(cfg.chainId, 16);

    const p = (async () => {
        // Pre-check: already on correct chain?
        try {
            const currentCid = await window.ethereum.request({ method: 'eth_chainId' });
            if (parseInt(currentCid, 16) === targetChainId) {
                console.log('[zeroG] Already on', cfg.chainName);
                return;
            }
        } catch (e) {
            console.warn('[zeroG] Chain check failed:', e.message);
        }

        try {
            // Step 1: Try switching to existing chain
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: cfg.chainId }]
            });
            console.log('[zeroG] Successfully switched to', cfg.chainName);
            return;
        } catch (switchError) {
            console.warn('[zeroG] switch error:', switchError.code, switchError.message);
            
            // Step 2: Chain not added yet (code 4902)
            if (switchError.code === 4902) {
                try {
                    const addParams = [{
                        chainId: cfg.chainId,
                        chainName: cfg.chainName,
                        nativeCurrency: cfg.nativeCurrency,
                        rpcUrls: cfg.rpcUrls,
                        blockExplorerUrls: cfg.blockExplorerUrls
                    }];
                    console.log('[zeroG] Adding chain...', cfg.chainName, addParams[0]);
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: addParams
                    });
                    console.log('[zeroG] Chain added successfully');
                    
                    // After adding, switch again
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: cfg.chainId }]
                    });
                    return;
                } catch (addError) {
                    console.error('[zeroG] Add chain error:', addError.code, addError.message);
                    throw new Error(`Failed to add ${cfg.chainName}: ${addError.message}`);
                }
            }
            
            // Step 3: User rejected (4001) or other known codes
            if (switchError.code === 4001) {
                throw new Error('User rejected network switch');
            }
            if (switchError.code === -32002) {
                throw new Error('Request pending — please check your wallet popup');
            }
            
            // Unknown error
            throw switchError;
        }
    })();
    _setPending(p);
    return p;
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
 * Withdraw from PokerGame0G contract
 * @param {number|string} amountEth - Amount in ETH (e.g., 0.1 for 0.1 0G)
 * @returns {Promise<string>} Transaction hash
 */
export async function withdrawFromContract(amountEth) {
    if (!hasEvmWallet()) throw new Error('No wallet');

    // PokerGame0G contract address (testnet)
    const CONTRACT_ADDRESS = '0xc6F5495D411405630dF5d5ad32225d7F51dC1645';

    // withdraw(uint256 amount) ABI
    const abi = [
        "function withdraw(uint256 amount) external"
    ];

    // Build calldata
    const iface = new ethers.utils.Interface(abi);
    const amountWei = ethers.utils.parseEther(amountEth.toString());
    const data = iface.encodeFunctionData('withdraw', [amountWei]);

    console.log(`[zeroG] Withdrawing ${amountEth} 0G (${amountWei.toString()} wei)`);

    return sendTransaction({
        to: CONTRACT_ADDRESS,
        data: data,
        value: '0x0'
    });
}

/**
 * Get ETH/native token balance for address via 0G RPC directly (NOT through MetaMask)
 * This ensures we always get 0G balance regardless of which chain MetaMask is currently on.
 * @param {string} [address] - Address to query (default: first account)
 * @returns {Promise<string>} Balance as decimal ETH string
 */
export async function getBalance(address) {
    // Always try 0G RPC first for accurate balance reading
    const addr = address || (hasEvmWallet() ? (await window.ethereum.request({ method: 'eth_accounts' }))[0] : null);
    if (!addr) return '0';

    // Use direct RPC call to 0G Testnet to get real 0G balance
    const OG_RPC_URLS = [
        'https://evmrpc-galileo.0g.ai',   // testnet primary
        'https://rpc.0g.ai'                // mainnet fallback
    ];

    for (const rpcUrl of OG_RPC_URLS) {
        try {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBalance',
                    params: [addr, 'latest'],
                    id: 1
                })
            });
            const data = await response.json();
            if (data.result) {
                const balWei = parseInt(data.result, 16);
                const bal = (balWei / 1e18).toString();
                console.log(`[zeroG] Balance via ${rpcUrl}: ${bal} 0G`);
                return bal;
            }
        } catch (e) {
            console.warn(`[zeroG] Failed ${rpcUrl}:`, e.message);
        }
    }

    // Fallback: use wallet provider if available and on correct chain
    if (hasEvmWallet()) {
        try {
            const cid = await window.ethereum.request({ method: 'eth_chainId' });
            if (cid === '0x40DA' || cid === '0x4115') {  // 0G testnet or mainnet
                const bal = await window.ethereum.request({
                    method: 'eth_getBalance',
                    params: [addr, 'latest']
                });
                return (parseInt(bal, 16) / 1e18).toString();
            }
        } catch (e) {
            console.warn('[zeroG] Wallet fallback failed:', e.message);
        }
    }

    return '0';
}

/**
 * Get player's custody (game) balance from PokerGame0G contract
 * Uses server API first, falls back to direct RPC call
 * @param {string} address - EVM wallet address
 * @returns {Promise<string>} Balance as decimal string (in 0G tokens)
 */
export async function getCustodyBalance(address) {
    if (!address || !address.startsWith('0x')) return '0';

    // Try server API first
    try {
        const serverPort = (typeof process !== 'undefined' && process.env?.REACT_APP_SERVER_PORT) || '7778';
        const response = await fetch(`http://127.0.0.1:${serverPort}/api/0g/balance/${address}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.balance) {
                console.log('[zeroG] Custody balance via API:', data.balance);
                return data.balance;
            }
        }
    } catch (e) {
        console.warn('[zeroG] API balance fetch failed, trying RPC:', e.message);
    }

    // Fallback: direct RPC call to PokerGame0G contract
    const CONTRACT_ADDRESS = '0xc6F5495D411405630dF5d5ad32225d7F51dC1645';
    const ABI = ['function getCustodyBalance(address player) view returns (uint256)'];

    try {
        const iface = new ethers.utils.Interface(ABI);
        const data = iface.encodeFunctionData('getCustodyBalance', [address]);

        for (const rpcUrl of [
            'https://evmrpc-galileo.0g.ai',
            'https://rpc.0g.ai'
        ]) {
            try {
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_call',
                        params: [{ to: CONTRACT_ADDRESS, data: data }, 'latest'],
                        id: 1
                    })
                });
                const result = await response.json();
                if (result.result) {
                    const balWei = parseInt(result.result, 16);
                    const bal = (balWei / 1e18).toString();
                    console.log(`[zeroG] Custody balance via ${rpcUrl}: ${bal}`);
                    return bal;
                }
            } catch (e) { /* try next RPC */ }
        }
    } catch (e) {
        console.error('[zeroG] RPC custody balance failed:', e.message);
    }

    return '0';
}

/**
 * Leave table session - call leaveTableSession on PokerGame0G contract
 * Returns stack to custody balance
 * @param {number} stackWei - Stack amount in wei (from game)
 * @returns {Promise<{tx: string}>} Transaction result
 */
export async function leaveTableSession(stackWei) {
    if (!hasEvmWallet()) throw new Error('No wallet');

    // Ensure we're on the correct 0G chain
    try { await ensureCorrectChain('testnet'); } catch (e) {
        throw new Error(`Failed to switch to 0G network: ${e.message}`);
    }

    const POKERGAME_0G_ADDRESS = '0xc6F5495D411405630dF5d5ad32225d7F51dC1645';
    const ABI = ['function leaveTableSession(uint256 finalStack)'];
    const iface = new ethers.utils.Interface(ABI);
    const data = iface.encodeFunctionData('leaveTableSession', [stackWei.toString()]);

    console.log(`[zeroG] Leaving table session, stack: ${stackWei} wei`);

    const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
            from: (await window.ethereum.request({ method: 'eth_accounts' }))[0],
            to: POKERGAME_0G_ADDRESS,
            data
        }]
    });

    return { tx: txHash };
}

/**
 * Normalize a balance value that might be in wei (raw uint256) or decimal.
 * If value > 1e12, treat as wei and convert to decimal by dividing 1e18.
 * @param {string|number} val
 * @returns {string} Decimal balance string
 */
export function normalizeBalance(val) {
    if (!val) return '0';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (!isFinite(num)) return '0';
    // Detect raw unit values that need conversion to decimal 0G:
    //   > 10000  → likely raw SUN/wei (game uses SUN internally, 1 TRX = 1e6 SUN)
    //   > 1e12  → definitely raw wei (contract returns 18-decimal places)
    //   > 1     but < reasonable 0G balance (< 10) → keep as decimal
    if (num > 10000 && !(num > 0 && num < 10)) {
        return (num / 1e18).toString();
    }
    return num.toString();
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
 * Ensure wallet is on the correct 0G chain before sending transactions.
 * Fixes "invalid chain id for signer: have X want Y" errors.
 *
 * @param {'testnet'|'mainnet'} [network='testnet']
 * @throws {Error} If not on correct chain and switch fails
 */
export async function ensureCorrectChain(network = 'testnet') {
    if (!hasEvmWallet()) throw new Error('No wallet');

    const expectedCid = parseInt(CHAIN_IDS[network.toUpperCase()], 16);
    const actualCid = await getChainId();

    if (actualCid === expectedCid) return; // Already correct

    console.warn(`[zeroG] Chain mismatch! Expected ${expectedCid} (0${network}), got ${actualCid}. Switching...`);

    // Try to auto-switch
    try {
        await switchChain(network);
        // Verify after switch
        const newCid = await getChainId();
        if (newCid !== expectedCid) {
            throw new Error(
                `Failed to switch to ${network} network. ` +
                `Current chain: ${newCid}, Expected: ${expectedCid} (${network === 'testnet' ? '0x40DA' : '0x4115'}). ` +
                `Please manually switch your wallet to 0G ${network === 'testnet' ? 'Testnet' : 'Mainnet'} first.`
            );
        }
    } catch (err) {
        throw new Error(
            `Cannot proceed — wrong chain. Wallet is on chain ${actualCid}, need ${expectedCid} (0G ${network}). ` +
            `Switch error: ${err.message}`
        );
    }
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
    ensureCorrectChain,
    shortenHash,
    CHAIN_IDS
};
