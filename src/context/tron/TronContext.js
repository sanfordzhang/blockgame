/**
 * TronContext - TronLink Wallet State Management
 * Provides wallet connection state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [trxWalletBalance, setTrxWalletBalance] = useState(0);
  const [contractBalance, setContractBalance] = useState({ balance: 0, locked: 0 });
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
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
      // Get wallet TRX balance
      const walletBalance = await getTrxBalance(address);
      setTrxWalletBalance(walletBalance);
      
      // Get contract balance
      const contractBal = await getPlayerBalance(address);
      setContractBalance(contractBal);
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
    trxWalletBalanceFormatted: formatTrx(trxWalletBalance),
    contractBalance,
    availableBalance: contractBalance.balance - contractBalance.locked,
    lockedBalance: contractBalance.locked,
    isLoadingBalance,
    
    // Methods
    connect,
    disconnect,
    refreshBalances,
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

export default TronContext;
