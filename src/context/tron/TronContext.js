/**
 * TronContext - TronLink Wallet State Management
 * Provides wallet connection state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  isTronLinkInstalled,
  connectTronLink,
  getCurrentAddress,
  getTrxBalance,
  getPlayerBalance,
  setNetwork,
  getCurrentNetwork,
  formatAddress,
  formatTrx
} from '../../utils/tronInteract';

// Create context
const TronContext = createContext(null);

// Network names
const NETWORK_NAMES = {
  mainnet: 'Mainnet',
  testnet: 'Nile Testnet'
};

/**
 * TronProvider component
 */
export const TronProvider = ({ children }) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [address, setAddress] = useState(null);
  const [error, setError] = useState(null);
  
  // Network state
  const [network, setNetworkState] = useState('testnet');
  const [chainId, setChainId] = useState(null);
  
  // Balance state
  const [trxWalletBalance, setTrxWalletBalanceRaw] = useState(0);
  const [contractBalance, setContractBalance] = useState({ balance: 0, locked: 0 });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const skipWalletBalanceRefreshUntil = useRef(0);

  // Wrapper: skip update if optimistic hold is active
  const setTrxWalletBalance = useCallback((val) => {
    if (Date.now() < skipWalletBalanceRefreshUntil.current) {
      console.log('[TronContext] Skipping wallet balance update (optimistic hold active)');
      return;
    }
    setTrxWalletBalanceRaw(val);
  }, []);

  // Force update regardless of hold (used by deposit optimistic update itself)
  const setTrxWalletBalanceForce = useCallback((val) => {
    setTrxWalletBalanceRaw(val);
  }, []);
  
  // Game mode state
  const [gameMode, setGameMode] = useState(
    process.env.REACT_APP_NETWORK === 'testnet' ? 'fun' : 'real'
  );
  
  // Install status
  const [isInstalled, setIsInstalled] = useState(false);

  /**
   * Check if TronLink is installed
   */
  useEffect(() => {
    const checkInstallation = () => {
      const installed = isTronLinkInstalled();
      setIsInstalled(installed);
      
      if (installed && window.tronLink) {
        // Check if already connected
        const addr = getCurrentAddress();
        if (addr) {
          setAddress(addr);
          setIsConnected(true);
        }
      }
    };

    checkInstallation();
    
    // Re-check after a delay (TronLink might still be loading)
    const timeout = setTimeout(checkInstallation, 1000);
    
    return () => clearTimeout(timeout);
  }, []);

  /**
   * Set up event listeners for TronLink events
   */
  useEffect(() => {
    if (!isInstalled || !window.tronLink) return;

    const handleConnect = () => {
      console.log('[TronContext] Wallet connected');
      const addr = getCurrentAddress();
      if (addr) {
        setAddress(addr);
        setIsConnected(true);
        setError(null);
        refreshBalances();
      }
    };

    const handleDisconnect = () => {
      console.log('[TronContext] Wallet disconnected');
      setIsConnected(false);
      setAddress(null);
      setTrxWalletBalance(0);
      setContractBalance({ balance: 0, locked: 0 });
    };

    const handleAccountChange = (event) => {
      console.log('[TronContext] Account changed:', event);
      const addr = getCurrentAddress();
      if (addr !== address) {
        setAddress(addr);
        refreshBalances();
      }
    };

    const handleChainChange = (event) => {
      console.log('[TronContext] Chain changed:', event);
      // Update network based on chain
      refreshBalances();
    };

    // Listen for TronLink events
    window.addEventListener('tronLink#connect', handleConnect);
    window.addEventListener('tronLink#disconnect', handleDisconnect);
    window.addEventListener('tronLink#accountsChanged', handleAccountChange);
    window.addEventListener('tronLink#chainChanged', handleChainChange);

    return () => {
      window.removeEventListener('tronLink#connect', handleConnect);
      window.removeEventListener('tronLink#disconnect', handleDisconnect);
      window.removeEventListener('tronLink#accountsChanged', handleAccountChange);
      window.removeEventListener('tronLink#chainChanged', handleChainChange);
    };
  }, [isInstalled, address]);

  /**
   * Connect wallet
   */
  const connect = useCallback(async () => {
    if (isConnected) return;
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const result = await connectTronLink();
      
      if (result.success) {
        setAddress(result.address);
        setChainId(result.chainId);
        setIsConnected(true);
        
        // Set network based on game mode
        const targetNetwork = gameMode === 'real' ? 'mainnet' : 'testnet';
        setNetwork(targetNetwork);
        setNetworkState(targetNetwork);
        
        await refreshBalances();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, gameMode]);

  /**
   * Disconnect wallet (just clear local state)
   */
  const disconnect = useCallback(() => {
    setIsConnected(false);
    setAddress(null);
    setTrxWalletBalance(0);
    setContractBalance({ balance: 0, locked: 0 });
    setError(null);
  }, []);

  /**
   * Refresh all balances
   */
  const refreshBalances = useCallback(async () => {
    if (!address) return;

    setIsLoadingBalance(true);

    try {
      // Get contract balance always
      const contractBal = await getPlayerBalance(address);
      setContractBalance(contractBal);

      // Skip wallet balance refresh if we have a pending optimistic update
      if (Date.now() < skipWalletBalanceRefreshUntil.current) {
        console.log('[TronContext] Skipping wallet balance refresh (optimistic update pending)');
        return;
      }

      const walletBalance = await getTrxBalance(address);
      setTrxWalletBalance(walletBalance);
    } catch (err) {
      console.error('[TronContext] Error refreshing balances:', err);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address]);

  /**
   * Switch game mode
   */
  const switchGameMode = useCallback((mode) => {
    setGameMode(mode);
    
    const targetNetwork = mode === 'real' ? 'mainnet' : 'testnet';
    setNetwork(targetNetwork);
    setNetworkState(targetNetwork);
    
    // Refresh balances for new network
    if (isConnected) {
      refreshBalances();
    }
  }, [isConnected, refreshBalances]);

  /**
   * Switch network
   */
  const switchNetwork = useCallback(async (targetNetwork) => {
    setNetwork(targetNetwork);
    setNetworkState(targetNetwork);
    setGameMode(targetNetwork === 'mainnet' ? 'real' : 'fun');
    
    if (isConnected) {
      await refreshBalances();
    }
  }, [isConnected, refreshBalances]);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context value
  const value = {
    // Connection state
    isConnected,
    isConnecting,
    isInstalled,
    address,
    formattedAddress: formatAddress(address),
    error,
    
    // Network state
    network,
    networkName: NETWORK_NAMES[network] || network,
    chainId,
    gameMode,
    
    // Balance state
    trxWalletBalance,
    setTrxWalletBalance,
    setTrxWalletBalanceForce,
    trxWalletBalanceFormatted: formatTrx(trxWalletBalance),
    contractBalance,
    availableBalance: contractBalance.balance - contractBalance.locked,
    lockedBalance: contractBalance.locked,
    isLoadingBalance,
    
    // Methods
    connect,
    disconnect,
    refreshBalances,
    holdWalletBalanceRefresh: (ms = 15000) => {
      skipWalletBalanceRefreshUntil.current = Date.now() + ms;
    },
    switchGameMode,
    switchNetwork,
    clearError
  };

  return (
    <TronContext.Provider value={value}>
      {children}
    </TronContext.Provider>
  );
};

/**
 * useTron hook
 */
export const useTron = () => {
  const context = useContext(TronContext);
  
  if (!context) {
    throw new Error('useTron must be used within a TronProvider');
  }
  
  return context;
};

/**
 * useTronLink hook - Extended hook for AMM/DEX operations
 * Provides additional wallet interaction methods for trading
 */
export const useTronLink = () => {
  const tronContext = useTron();
  
  /**
   * Sign and send a transaction
   * @param {string} to - Contract address
   * @param {number|string} value - TRX value in SUN
   * @param {string|object} data - Transaction data (hex string or { function, parameters })
   */
  const signAndSendTransaction = async (to, value = 0, data = '') => {
    if (!tronContext.isConnected || !tronContext.address) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
      const userAddress = tronContext.address;
      
      // Convert value to number
      const callValue = typeof value === 'string' ? parseInt(value, 10) : (value || 0);
      
      // If data is provided, it's a contract call
      if (data) {
        let functionSelector, parameters;
        
        // Handle object format from API
        if (typeof data === 'object' && data.function) {
          functionSelector = data.function;
          parameters = data.parameters || [];
        } else if (typeof data === 'string' && data !== '0x' && data !== '') {
          // Handle hex string format
          functionSelector = data;
          parameters = [];
        } else {
          // No data, simple transfer
          const tx = await tronWeb.transactionBuilder.sendTrx(to, callValue, userAddress);
          const signedTx = await tronWeb.trx.sign(tx);
          const result = await tronWeb.trx.sendRawTransaction(signedTx);
          return result?.txid || result;
        }
        
        // Parse function selector to get function name and parameter types
        const match = functionSelector.match(/^(\w+)\(([^)]*)\)$/);
        if (!match) {
          throw new Error(`Invalid function selector: ${functionSelector}`);
        }
        
        const functionName = match[1];
        
        // Build ABI for this function
        const abi = [{
          inputs: parameters.map((p, i) => ({
            name: `param${i}`,
            type: p.type
          })),
          name: functionName,
          outputs: [],
          stateMutability: callValue > 0 ? 'payable' : 'nonpayable',
          type: 'function'
        }];
        
        // Build args array, replacing placeholders
        const args = parameters.map(p => {
          if (p.value === 'REPLACE_WITH_USER_ADDRESS') {
            return userAddress;
          }
          return p.value;
        });
        
        console.log('[useTronLink] Calling contract:', {
          to,
          functionName,
          callValue,
          args
        });
        
        // Use contract().send() method which works better with TronLink
        const contract = tronWeb.contract(abi, to);
        
        // Call the method and send
        const result = await contract.methods[functionName](...args).send({
          feeLimit: 100_000_000,
          callValue: callValue,
          shouldPollResponse: false
        });
        
        return result;
      }
      
      // Simple TRX transfer
      const tx = await tronWeb.transactionBuilder.sendTrx(to, callValue, userAddress);
      const signedTx = await tronWeb.trx.sign(tx);
      const result = await tronWeb.trx.sendRawTransaction(signedTx);
      
      return result?.txid || result;
    } catch (error) {
      console.error('[useTronLink] signAndSendTransaction error:', error);
      throw error;
    }
  };
  
  /**
   * Approve token for spending
   * @param {string} tokenAddress - Token contract address
   * @param {string} spender - Spender address (e.g., router)
   * @param {number} amount - Amount to approve
   */
  const approveToken = async (tokenAddress, spender, amount) => {
    if (!tronContext.isConnected || !tronContext.address) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
      
      // ERC20 approve ABI
      const approveAbi = [{
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        name: 'approve',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function'
      }];
      
      const contract = await tronWeb.contract(approveAbi, tokenAddress);
      const tx = await contract.approve(spender, amount).send({
        feeLimit: 100_000_000,
        shouldPollResponse: false
      });
      
      return tx;
    } catch (error) {
      console.error('[useTronLink] approveToken error:', error);
      throw error;
    }
  };
  
  /**
   * Get token balance
   * @param {string|null} tokenAddress - Token contract address (null for TRX)
   * @param {string} address - Wallet address
   */
  const getTokenBalance = async (tokenAddress, address) => {
    if (!address) return '0';
    
    try {
      const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
      
      if (!tronWeb) {
        console.warn('[useTronLink] TronWeb not available');
        return '0';
      }
      
      // TRX balance
      if (!tokenAddress || tokenAddress === 'TRX') {
        const balance = await tronWeb.trx.getBalance(address);
        return balance.toString();
      }
      
      // Validate token address format (TRON addresses start with T and are 34 chars)
      if (typeof tokenAddress !== 'string' || !tokenAddress.startsWith('T') || tokenAddress.length !== 34) {
        console.warn('[useTronLink] Invalid token address:', tokenAddress);
        return '0';
      }
      
      // CHIP token or other TRC20
      const balanceAbi = [{
        inputs: [{ name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
      }];
      
      const contract = await tronWeb.contract(balanceAbi, tokenAddress);
      const balance = await contract.balanceOf(address).call();
      
      // Handle BigNumber/string
      if (typeof balance === 'object' && balance.toString) {
        return balance.toString();
      }
      return balance?.toString() || '0';
    } catch (error) {
      console.error('[useTronLink] getTokenBalance error:', error);
      return '0';
    }
  };
  
  return {
    // Connection state
    connected: tronContext.isConnected,
    address: tronContext.address,
    
    // Methods
    connect: tronContext.connect,
    signAndSendTransaction,
    approveToken,
    getTokenBalance
  };
};

export default TronContext;
