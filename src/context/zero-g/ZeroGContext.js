/**
 * ZeroGContext - 0G (ZeroGravity) EVM Wallet State Management
 * Manages MetaMask / OKX wallet connection for 0G Chain
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Create context
const ZeroGContext = createContext(null);

// Chain configurations
const CHAIN_CONFIGS = {
    testnet: {
        chainId: '0x40EA', // 16602 in hex
        chainName: '0G Testnet',
        nativeCurrency: { name: '0G Token', symbol: '0G', decimals: 18 },
        rpcUrls: ['https://evmrpc-galileo.0g.ai'],
        blockExplorerUrls: ['https://chainscan-galileo.0g.ai']
    },
    mainnet: {
        chainId: '0x4115', // 16661 in hex
        chainName: '0G Mainnet',
        nativeCurrency: { name: '0G Token', symbol: '0G', decimals: 18 },
        rpcUrls: ['https://rpc.0g.ai'],
        blockExplorerUrls: ['https://evm-explorer.0g.ai']
    }
};

/**
 * ZeroGProvider component - wraps app with 0G wallet state
 */
export const ZeroGProvider = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [address, setAddress] = useState(null);
    const [error, setError] = useState(null);
    
    // Network state
    const [chainId, setChainId] = useState(null);
    const [networkName, setNetworkName] = useState('');
    
    // Balance state
    const [balance, setBalanceRaw] = useState('0');
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);

    // Check if MetaMask / EVM wallet is installed
    const hasEvmWallet = () => {
        return typeof window !== 'undefined' && !!window.ethereum;
    };

    /**
     * Connect to EVM wallet (MetaMask / OKX etc.)
     */
    const connectWallet = useCallback(async () => {
        if (!hasEvmWallet()) {
            setError('No EVM wallet found. Please install MetaMask or OKX.');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
                setAddress(accounts[0]);
                setIsConnected(true);

                // Get current network
                await _fetchNetworkInfo();
                
                // Fetch balance
                await refreshBalance();
            }
        } catch (err) {
            if (err.code === 4001) {
                setError('Connection rejected by user');
            } else {
                setError(`Failed to connect: ${err.message}`);
            }
        } finally {
            setIsConnecting(false);
        }
    }, []);

    /**
     * Disconnect wallet (clear local state only)
     */
    const disconnectWallet = useCallback(() => {
        setAddress(null);
        setIsConnected(false);
        setChainId(null);
        setNetworkName('');
        setBalanceRaw('0');
        console.log('[ZeroGContext] Wallet disconnected');
    }, []);

    /**
     * Switch to 0G network if not already on it
     */
    const switchTo0GNetwork = useCallback(async (network = 'testnet') => {
        if (!hasEvmWallet()) return;

        try {
            const config = CHAIN_CONFIGS[network];
            
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: config.chainId }]
                });
            } catch (switchError) {
                // Chain not added yet, add it
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: config.chainId,
                            chainName: config.chainName,
                            nativeCurrency: config.nativeCurrency,
                            rpcUrls: config.rpcUrls,
                            blockExplorerUrls: config.blockExplorerUrls
                        }]
                    });
                }
            }

            await _fetchNetworkInfo();
            await refreshBalance();
        } catch (err) {
            setError(`Failed to switch network: ${err.message}`);
        }
    }, []);

    /**
     * Sign a message for authentication
     */
    const signMessage = useCallback(async (message) => {
        if (!address || !hasEvmWallet()) throw new Error('Not connected');

        try {
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, address]
            });
            return signature;
        } catch (err) {
            throw new Error(`Signing failed: ${err.message}`);
        }
    }, [address]);

    /**
     * Refresh balance from blockchain
     */
    const refreshBalance = useCallback(async () => {
        if (!address || !hasEvmWallet()) return;

        setIsLoadingBalance(true);
        try {
            const bal = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [address, 'latest']
            });
            // Convert from wei (hex) to decimal ETH string
            const balanceWei = parseInt(bal, 16);
            setBalanceRaw((balanceWei / 1e18).toString());
        } catch (e) {
            console.error('[ZeroGContext] Balance fetch failed:', e.message);
        } finally {
            setIsLoadingBalance(false);
        }
    }, [address]);

    /**
     * Format address for display
     */
    const formatAddress = useCallback((addr) => {
        if (!addr) return '';
        addr = addr.replace(/^0x/, '');
        return `0x${addr.slice(0, 5)}...${addr.slice(-4)}`;
    }, []);

    // Internal helper: fetch network info
    async function _fetchNetworkInfo() {
        if (!window.ethereum) return;

        try {
            const cid = await window.ethereum.request({ method: 'eth_chainId' });
            setChainId(cid);

            const numericCid = parseInt(cid, 16);
            if (numericCid === 16602) {
                setNetworkName('0G Testnet');
            } else if (numericCid === 16661) {
                setNetworkName('0G Mainnet');
            } else {
                setNetworkName(`Unknown (${numericCid})`);
            }
        } catch (e) {
            console.warn('[ZeroGContext] Failed to fetch network info:', e.message);
        }
    }

    // Listen for account changes
    useEffect(() => {
        if (!hasEvmWallet()) return;

        const handleAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                disconnectWallet();
            } else if (accounts[0] !== address) {
                setAddress(accounts[0]);
                refreshBalance();
            }
        };

        const handleChainChanged = (newChainId) => {
            setChainId(newChainId);
            const ncid = parseInt(newChainId, 16);
            if (ncid === 16602) setNetworkName('0G Testnet');
            else if (ncid === 16661) setNetworkName('0G Mainnet');
            else setNetworkName(`Unknown (${ncid})`);
            refreshBalance();
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        return () => {
            if (window.ethereum?.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, [address, disconnectWallet, refreshBalance]);

    // NOTE: Auto-reconnect removed — user must explicitly click Connect button.
    // Previously this effect auto-restored connection from eth_accounts,
    // which caused unwanted behavior (e.g., conflicting with TRON mode).
    // If you want to re-enable, guard with a user preference check.

    const value = {
        // State
        isConnected,
        isConnecting,
        hasWallet: hasEvmWallet(),
        address,
        error,
        chainId,
        networkName,
        balance: parseFloat(balance),
        isLoadingBalance,

        // Actions
        connectWallet,
        disconnectWallet,
        switchTo0GNetwork,
        signMessage,
        refreshBalance,
        formatAddress,

        // Constants
        CHAIN_CONFIGS
    };

    return (
        <ZeroGContext.Provider value={value}>
            {children}
        </ZeroGContext.Provider>
    );
};

/**
 * Hook to use ZeroG context
 */
export function useZeroG() {
    const context = useContext(ZeroGContext);
    if (!context) {
        throw new Error('useZeroG must be used within ZeroGProvider');
    }
    return context;
}

export default ZeroGContext;
