/**
 * zeroGInteract - Utility functions for 0G Chain interaction
 * Used alongside ZeroGContext for direct wallet/contract interactions
 */

import { ethers } from 'ethers';
import { buildApiUrl } from './serverConfig';

const CHAIN_IDS = {
    TESTNET: '0x40DA',   // 16602 (0G Testnet)
    MAINNET: '0x4115'    // 16661 (0G Mainnet)
};

function safeConsole(method, ...args) {
    try {
        const logger = console && console[method];
        if (typeof logger === 'function') logger.apply(console, args);
    } catch (e) {
        // Browser extensions can monkey-patch console and throw; wallet flow must continue.
    }
}

export function getPokerGame0GAddress() {
    // Use mainnet-specific env var when building for mainnet
    if (process.env.REACT_APP_NETWORK === 'mainnet') {
        return process.env.REACT_APP_ZEROG_POKERGAME_ADDRESS_MAINNET || process.env.REACT_APP_ZEROG_POKERGAME_ADDRESS || '';
    }
    return process.env.REACT_APP_ZEROG_POKERGAME_ADDRESS || '0xc4975D55aD2607B14616E97B9a8E5622778eF5aE';
}

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
        safeConsole('warn', '[zeroG] Request already pending, waiting for existing...');
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
export async function switchChain(network) {
    if (!hasEvmWallet()) throw new Error('No wallet');

    // Default to build-time network (mainnet or testnet)
    const targetNetwork = network || process.env.REACT_APP_NETWORK || 'testnet';

    if (_isPending()) {
        safeConsole('warn', '[zeroG] Switch chain request already pending, waiting...');
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
            rpcUrls: ['https://evmrpc.0g.ai'],
            blockExplorerUrls: ['https://chainscan.0g.ai']
        }
    };

    const cfg = configs[targetNetwork];
    const targetChainId = parseInt(cfg.chainId, 16);

    const p = (async () => {
        // Pre-check: already on correct chain?
        try {
            const currentCid = await window.ethereum.request({ method: 'eth_chainId' });
            if (parseInt(currentCid, 16) === targetChainId) {
                safeConsole('log', '[zeroG] Already on', cfg.chainName);
                return;
            }
        } catch (e) {
            safeConsole('warn', '[zeroG] Chain check failed:', e.message);
        }

        try {
            // Step 1: Try switching to existing chain
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: cfg.chainId }]
            });
            safeConsole('log', '[zeroG] Successfully switched to', cfg.chainName);
            return;
        } catch (switchError) {
            safeConsole('warn', '[zeroG] switch error:', switchError.code, switchError.message);
            
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
                    safeConsole('log', '[zeroG] Adding chain...', cfg.chainName, addParams[0]);
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: addParams
                    });
                    safeConsole('log', '[zeroG] Chain added successfully');
                    
                    // After adding, switch again
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: cfg.chainId }]
                    });
                    return;
                } catch (addError) {
                    safeConsole('error', '[zeroG] Add chain error:', addError.code, addError.message);
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

    const CONTRACT_ADDRESS = getPokerGame0GAddress();

    // withdraw(uint256 amount) ABI
    const abi = [
        "function withdraw(uint256 amount) external"
    ];

    // Build calldata
    const iface = new ethers.utils.Interface(abi);
    const amountWei = ethers.utils.parseEther(amountEth.toString());
    const data = iface.encodeFunctionData('withdraw', [amountWei]);

    safeConsole('log', `[zeroG] Withdrawing ${amountEth} 0G (${amountWei.toString()} wei)`);

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

    // Use direct RPC call to get real 0G balance (respects build-time network)
    const isMainnet = process.env.REACT_APP_NETWORK === 'mainnet';
    const OG_RPC_URLS = isMainnet
        ? ['https://evmrpc.0g.ai']   // mainnet
        : [
            'https://evmrpc-galileo.0g.ai',   // testnet primary
            'https://evmrpc.0g.ai'               // testnet fallback
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
                safeConsole('log', `[zeroG] Balance via ${rpcUrl}: ${bal} 0G`);
                return bal;
            }
        } catch (e) {
            safeConsole('warn', `[zeroG] Failed ${rpcUrl}:`, e.message);
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
            safeConsole('warn', '[zeroG] Wallet fallback failed:', e.message);
        }
    }

    return '0';
}

/**
 * Get player's 0G game balance from PokerGame0G contract.
 * `balance` is spendable custody, `locked` is active-table funds, `total` is both.
 * @param {string} address - EVM wallet address
 * @returns {Promise<{balance: string, locked: string, total: string, rawBalance: string, rawLockedBalance: string, rawTotalBalance: string}>}
 */
export async function getGameBalance(address) {
    const zero = {
        balance: '0',
        locked: '0',
        total: '0',
        rawBalance: '0',
        rawLockedBalance: '0',
        rawTotalBalance: '0'
    };

    if (!address || !address.startsWith('0x')) return zero;

    // Try server API first
    try {
        const response = await fetch(buildApiUrl(`/api/0g/balance/${address}`));
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const balance = data.balance || data.available || '0';
                const locked = data.locked || '0';
                const total = data.total || String((parseFloat(balance) || 0) + (parseFloat(locked) || 0));
                const info = {
                    balance,
                    locked,
                    total,
                    rawBalance: data.rawBalance || '0',
                    rawLockedBalance: data.rawLockedBalance || '0',
                    rawTotalBalance: data.rawTotalBalance || '0'
                };
                safeConsole('log', '[zeroG] Game balance via API:', info);
                return info;
            }
        }
    } catch (e) {
        safeConsole('warn', '[zeroG] API game balance fetch failed, trying RPC:', e.message);
    }

    // Fallback: direct RPC call to PokerGame0G contract
    const CONTRACT_ADDRESS = getPokerGame0GAddress();
    const ABI = ['function getPlayerInfo(address player) view returns (uint256 balance, uint256 lockedAmount, bool isRegistered)'];

    try {
        const iface = new ethers.utils.Interface(ABI);
        const data = iface.encodeFunctionData('getPlayerInfo', [address]);

        for (const rpcUrl of (process.env.REACT_APP_NETWORK === 'mainnet'
            ? ['https://evmrpc.0g.ai']
            : ['https://evmrpc-galileo.0g.ai', 'https://evmrpc.0g.ai'])) {
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
                    const decoded = iface.decodeFunctionResult('getPlayerInfo', result.result);
                    const rawBalance = decoded.balance.toString();
                    const rawLockedBalance = decoded.lockedAmount.toString();
                    const rawTotalBalance = decoded.balance.add(decoded.lockedAmount).toString();
                    const info = {
                        balance: ethers.utils.formatEther(decoded.balance),
                        locked: ethers.utils.formatEther(decoded.lockedAmount),
                        total: ethers.utils.formatEther(decoded.balance.add(decoded.lockedAmount)),
                        rawBalance,
                        rawLockedBalance,
                        rawTotalBalance
                    };
                    safeConsole('log', `[zeroG] Game balance via ${rpcUrl}:`, info);
                    return info;
                }
            } catch (e) { /* try next RPC */ }
        }
    } catch (e) {
        safeConsole('error', '[zeroG] RPC game balance failed:', e.message);
    }

    return zero;
}

/**
 * Get player's spendable custody balance from PokerGame0G contract
 * Uses server API first, falls back to direct RPC call
 * @param {string} address - EVM wallet address
 * @returns {Promise<string>} Custody balance as decimal string (in 0G tokens)
 */
export async function getCustodyBalance(address) {
    const info = await getGameBalance(address);
    safeConsole('log', '[zeroG] Custody balance:', info.balance);
    return info.balance;
}

/**
 * Backwards-compatible alias for the total 0G game balance.
 */
export async function getTotalGameBalance(address) {
    const info = await getGameBalance(address);
    return info.total;
}

/**
 * Return zero when no custody balance can be read.
 */
export async function getCustodyBalanceFallback() {
    return '0';
}

/**
 * Leave table session - call leaveTableSession on PokerGame0G contract
 * Returns stack to custody balance
 * @param {number} stackWei - Stack amount in wei (from game)
 * @returns {Promise<{tx: string}>} Transaction result
 */
export async function leaveTableSession(stackWei, tableId = 1) {
    if (!hasEvmWallet()) throw new Error('No wallet');

    // Ensure we're on the correct 0G chain
    try { await ensureCorrectChain(); } catch (e) {
        throw new Error(`Failed to switch to 0G network: ${e.message}`);
    }

    const POKERGAME_0G_ADDRESS = getPokerGame0GAddress();
    const ABI = ['function leaveTableSession(uint256 tableId, uint256 finalStack)'];
    const iface = new ethers.utils.Interface(ABI);
    const data = iface.encodeFunctionData('leaveTableSession', [tableId.toString(), stackWei.toString()]);

    safeConsole('log', `[zeroG] Leaving table session, stack: ${stackWei} wei`);

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
export async function ensureCorrectChain(network) {
    if (!hasEvmWallet()) throw new Error('No wallet');

    const targetNetwork = network || process.env.REACT_APP_NETWORK || 'testnet';
    const expectedCid = parseInt(CHAIN_IDS[targetNetwork.toUpperCase()], 16);
    const actualCid = await getChainId();

    if (actualCid === expectedCid) return; // Already correct

    safeConsole('warn', `[zeroG] Chain mismatch! Expected ${expectedCid} (${targetNetwork}), got ${actualCid}. Switching...`);

    // Try to auto-switch
    try {
        await switchChain(targetNetwork);
        // Verify after switch
        const newCid = await getChainId();
        if (newCid !== expectedCid) {
            throw new Error(
                `Failed to switch to ${targetNetwork} network. ` +
                `Current chain: ${newCid}, Expected: ${expectedCid} (${targetNetwork === 'testnet' ? '0x40DA' : '0x4115'}). ` +
                `Please manually switch your wallet to 0G ${targetNetwork === 'testnet' ? 'Testnet' : 'Mainnet'} first.`
            );
        }
    } catch (err) {
        throw new Error(
            `Cannot proceed — wrong chain. Wallet is on chain ${actualCid}, need ${expectedCid} (0G ${targetNetwork}). ` +
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
