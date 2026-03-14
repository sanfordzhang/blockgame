/**
 * TronLink Wallet Integration Utilities
 * Handles wallet connection and basic TRON operations
 */

// Contract ABI in JSON format (TronWeb requires JSON ABI)
const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "registerPlayer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"name": "amount", "type": "uint256"}],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "tableId", "type": "uint256"},
      {"name": "buyInAmount", "type": "uint256"}
    ],
    "name": "joinTable",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "tableId", "type": "uint256"}],
    "name": "leaveTable",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "", "type": "address"}],
    "name": "players",
    "outputs": [
      {"name": "balance", "type": "uint256"},
      {"name": "lockedAmount", "type": "uint256"},
      {"name": "isRegistered", "type": "bool"},
      {"name": "registeredAt", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "", "type": "address"}],
    "name": "getPlayerInfo",
    "outputs": [
      {"name": "balance", "type": "uint256"},
      {"name": "lockedAmount", "type": "uint256"},
      {"name": "isRegistered", "type": "bool"},
      {"name": "registeredAt", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "player", "type": "address"},
      {"indexed": false, "name": "timestamp", "type": "uint256"}
    ],
    "name": "PlayerRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "player", "type": "address"},
      {"indexed": false, "name": "amount", "type": "uint256"}
    ],
    "name": "Deposited",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "player", "type": "address"},
      {"indexed": false, "name": "amount", "type": "uint256"}
    ],
    "name": "Withdrawn",
    "type": "event"
  },
  {
    "inputs": [{"name": "tableId", "type": "uint256"}],
    "name": "getGameSession",
    "outputs": [
      {"name": "tableId", "type": "uint256"},
      {"name": "players_", "type": "address[]"},
      {"name": "buyInAmounts_", "type": "uint256[]"},
      {"name": "totalPot", "type": "uint256"},
      {"name": "state", "type": "uint8"},
      {"name": "rakeRateUsed", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Network configurations
const NETWORKS = {
  mainnet: {
    chainId: '0x2b6653dc', // 728126428
    name: 'Mainnet',
    fullHost: 'https://api.trongrid.io',
    contractAddress: process.env.REACT_APP_MAINNET_CONTRACT_ADDRESS
  },
  testnet: {
    chainId: '0xcd8690dc', // 3448148188
    name: 'Nile Testnet',
    fullHost: 'https://nile.trongrid.io',
    contractAddress: process.env.REACT_APP_TESTNET_CONTRACT_ADDRESS || 'TLrp189jSVRdFSigEfECM7M4k2K73zdtp3'
  }
};

// Default network (testnet for development)
let currentNetwork = 'testnet';

/**
 * Check if TronLink is installed
 */
export const isTronLinkInstalled = () => {
  if (typeof window === 'undefined') return false;
  // TronLink injects both tronLink and tronWeb
  return !!(window.tronLink || window.tronWeb);
};

/**
 * Wait for TronLink to be ready
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<boolean>}
 */
export const waitForTronLink = (timeout = 3000) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    // Already ready
    if (window.tronLink?.ready || window.tronWeb) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    
    const check = () => {
      if (window.tronLink?.ready || window.tronWeb) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        resolve(false);
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  });
};

/**
 * Check if TronLink is ready
 */
export const isTronLinkReady = () => {
  if (typeof window === 'undefined') return false;
  return !!(window.tronLink?.ready || window.tronWeb);
};

/**
 * Connect to TronLink wallet
 * @returns {Promise<object>} Connection result
 */
export const connectTronLink = async () => {
  // Wait for TronLink to be ready
  const ready = await waitForTronLink(5000);
  
  // Debug: log tronLink state
  console.log('[TronLink] Initial state:', {
    ready,
    tronLinkReady: window.tronLink?.ready,
    hasTronLink: !!window.tronLink,
    hasTronWeb: !!window.tronWeb,
    tronWebAddress: window.tronWeb?.defaultAddress?.base58,
    tronLinkAddress: window.tronLink?.tronWeb?.defaultAddress?.base58
  });
  
  if (!ready && !window.tronLink && !window.tronWeb) {
    return {
      success: false,
      error: 'TronLink 未检测到。请安装或解锁 TronLink 钱包。',
      installUrl: 'https://www.tronlink.org/'
    };
  }

  try {
    // Get tronWeb instance - try multiple access points
    let tronWeb = window.tronLink?.tronWeb || window.tronWeb;
    
    // Check if already connected with an address (most reliable check)
    const existingAddress = tronWeb?.defaultAddress?.base58;
    if (existingAddress) {
      console.log('[TronLink] Already connected:', existingAddress);
      return {
        success: true,
        address: existingAddress,
        chainId: tronWeb.fullNode?.chainId,
        network: getNetworkByChainId(tronWeb.fullNode?.chainId)
      };
    }

    // Check if TronLink is locked (has tronLink but not ready and no address)
    // Note: defaultAddress can be false, null, undefined, or empty string when not connected
    const hasAddress = tronWeb?.defaultAddress?.base58 && tronWeb.defaultAddress.base58 !== false;
    
    if (window.tronLink && !hasAddress) {
      // TronLink exists but no address - need to request connection
      console.log('[TronLink] Detected but no address, requesting connection...');
      
      // Try to request accounts first (this triggers the authorization popup)
      if (window.tronLink?.request) {
        try {
          const res = await window.tronLink.request({
            method: 'tron_requestAccounts'
          });
          
          console.log('[TronLink] Request response:', JSON.stringify(res, null, 2));
          
          // Refresh tronWeb reference
          tronWeb = window.tronLink?.tronWeb || window.tronWeb;
          const address = tronWeb?.defaultAddress?.base58;
          
          // Handle successful connection
          if (res === true || res?.code === 200 || res?.result === true || (address && address !== false)) {
            if (address && address !== false) {
              return {
                success: true,
                address,
                chainId: tronWeb.fullNode?.chainId,
                network: getNetworkByChainId(tronWeb.fullNode?.chainId)
              };
            }
          }
          
          // Handle specific error codes
          if (res?.code === 4001) {
            return {
              success: false,
              error: '用户拒绝了连接请求，请在 TronLink 中点击确认'
            };
          }
          
          if (res?.code === 4100) {
            return {
              success: false,
              error: '请先解锁 TronLink 钱包（点击浏览器扩展图标并输入密码）'
            };
          }
        } catch (requestError) {
          console.log('[TronLink] Request error:', requestError.message);
        }
      }
      
      // Wait and re-check
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Re-check after waiting
      tronWeb = window.tronLink?.tronWeb || window.tronWeb;
      const addressAfterWait = tronWeb?.defaultAddress?.base58;
      if (addressAfterWait && addressAfterWait !== false) {
        console.log('[TronLink] Connected after request:', addressAfterWait);
        return {
          success: true,
          address: addressAfterWait,
          chainId: tronWeb.fullNode?.chainId,
          network: getNetworkByChainId(tronWeb.fullNode?.chainId)
        };
      }
      
      // Still no address - need user to manually authorize
      return {
        success: false,
        error: '请在 TronLink 钱包中点击"连接"按钮授权连接，然后刷新页面重试'
      };
    }

    // Try to request connection via tronLink (only if ready)
    if (window.tronLink?.request && window.tronLink?.ready) {
      try {
        const res = await window.tronLink.request({
          method: 'tron_requestAccounts'
        });

        console.log('[TronLink] Request response:', JSON.stringify(res, null, 2));

        // Handle different response formats
        if (res === true || res?.code === 200 || res?.result === true) {
          // Refresh tronWeb reference after connection
          tronWeb = window.tronLink?.tronWeb || window.tronWeb;
          const address = tronWeb?.defaultAddress?.base58;
          
          if (address) {
            return {
              success: true,
              address,
              chainId: tronWeb.fullNode?.chainId,
              network: getNetworkByChainId(tronWeb.fullNode?.chainId)
            };
          }
        }
        
        // Check for specific error codes
        if (res?.code === 4001 || res?.error?.code === 4001) {
          return {
            success: false,
            error: '用户拒绝了连接请求'
          };
        }
        
        if (res?.code === 4100 || res?.error?.code === 4100) {
          return {
            success: false,
            error: '请先解锁 TronLink 钱包（点击浏览器扩展图标并输入密码）'
          };
        }
        
        // If response has an error message
        if (res?.error?.message) {
          return {
            success: false,
            error: res.error.message
          };
        }
        
        // If response has message directly
        if (res?.message) {
          return {
            success: false,
            error: res.message
          };
        }
        
        // Check if address became available after request
        const address = window.tronLink?.tronWeb?.defaultAddress?.base58 || window.tronWeb?.defaultAddress?.base58;
        if (address) {
          return {
            success: true,
            address,
            chainId: (window.tronLink?.tronWeb || window.tronWeb)?.fullNode?.chainId,
            network: 'testnet'
          };
        }
        
        // Empty response usually means TronLink needs user interaction
        if (res === '' || res === undefined || res === null) {
          return {
            success: false,
            error: '请在 TronLink 钱包中点击确认连接按钮'
          };
        }
        
        return {
          success: false,
          error: `连接失败 (code: ${res?.code})，请确保 TronLink 已解锁`
        };
      } catch (requestError) {
        console.error('[TronLink] Request error:', requestError);
        // Fall through to direct tronWeb check
      }
    }
    
    // Direct tronWeb access fallback (some wallets don't use request pattern)
    const address = tronWeb?.defaultAddress?.base58;
    if (address) {
      console.log('[TronLink] Direct access address:', address);
      return {
        success: true,
        address,
        chainId: tronWeb.fullNode?.chainId,
        network: 'testnet'
      };
    }
    
    // Final check - if tronLink exists but no address, likely needs unlock
    if (window.tronLink) {
      return {
        success: false,
        error: '请先解锁 TronLink 钱包（点击浏览器扩展图标并输入密码），然后刷新页面'
      };
    }
    
    return {
      success: false,
      error: '无法获取钱包地址，请确保 TronLink 已安装并解锁'
    };
  } catch (error) {
    console.error('[TronLink] Error connecting:', error);
    return {
      success: false,
      error: error.message || '连接钱包时发生错误'
    };
  }
};

/**
 * Get current connected address
 */
export const getCurrentAddress = () => {
  if (!isTronLinkInstalled()) return null;
  const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
  return tronWeb?.defaultAddress?.base58 || null;
};

/**
 * Get TRX balance for an address
 * @param {string} address - TRON address
 * @returns {Promise<number>} Balance in SUN
 */
export const getTrxBalance = async (address) => {
  if (!isTronLinkInstalled()) {
    throw new Error('TronLink not installed');
  }

  try {
    const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
    const balance = await tronWeb.trx.getBalance(address);
    return balance;
  } catch (error) {
    console.error('Error getting TRX balance:', error);
    throw error;
  }
};

/**
 * Get contract instance
 * @param {string} contractAddress - Contract address
 * @returns {Promise<object>} Contract instance
 */
export const getContract = async (contractAddress) => {
  if (!isTronLinkInstalled()) {
    throw new Error('TronLink not installed');
  }

  try {
    const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
    const contract = await tronWeb.contract(
      CONTRACT_ABI,
      contractAddress
    );
    return contract;
  } catch (error) {
    console.error('Error getting contract:', error);
    throw error;
  }
};

/**
 * Get contract address for current network
 */
export const getContractAddress = () => {
  return NETWORKS[currentNetwork].contractAddress;
};

/**
 * Set current network
 */
export const setNetwork = (network) => {
  if (NETWORKS[network]) {
    currentNetwork = network;
    return true;
  }
  return false;
};

/**
 * Get current network config
 */
export const getCurrentNetwork = () => {
  return {
    name: currentNetwork,
    ...NETWORKS[currentNetwork]
  };
};

/**
 * Get network by chain ID
 */
export const getNetworkByChainId = (chainId) => {
  for (const [name, config] of Object.entries(NETWORKS)) {
    if (config.chainId === chainId) {
      return name;
    }
  }
  return 'unknown';
};

/**
 * Register player in contract
 */
export const registerPlayer = async () => {
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    throw new Error('Contract not deployed for this network');
  }

  const contract = await getContract(contractAddress);
  
  try {
    // Use shouldPollResponse: false for faster response in development
    // Transaction will still be processed, we just don't wait for confirmation
    const tx = await contract.registerPlayer().send({
      feeLimit: 100_000_000,
      shouldPollResponse: false  // Don't wait for confirmation
    });
    return tx;
  } catch (error) {
    console.error('Error registering player:', error);
    throw error;
  }
};

/**
 * Check if player is registered
 */
export const isPlayerRegistered = async (address) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) return false;

  const contract = await getContract(contractAddress);
  
  try {
    const player = await contract.players(address).call();
    return player.isRegistered;
  } catch (error) {
    console.error('Error checking registration:', error);
    return false;
  }
};

/**
 * Convert value to number (handles BigNumber, BigInt, string, number)
 */
const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return parseInt(value, 10);
  if (typeof value.toNumber === 'function') return value.toNumber();
  if (typeof value.toString === 'function') return parseInt(value.toString(), 10);
  return Number(value);
};

/**
 * Get player balance from contract
 */
export const getPlayerBalance = async (address) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) return { balance: 0, locked: 0 };

  const contract = await getContract(contractAddress);
  
  try {
    const info = await contract.getPlayerInfo(address).call();
    return {
      balance: toNumber(info.balance),
      locked: toNumber(info.lockedAmount)
    };
  } catch (error) {
    console.error('Error getting player balance:', error);
    return { balance: 0, locked: 0 };
  }
};

/**
 * Deposit TRX to contract
 */
export const depositTrx = async (amount) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    throw new Error('Contract not deployed for this network');
  }

  const contract = await getContract(contractAddress);
  
  try {
    // Use shouldPollResponse: false for faster response
    const tx = await contract.deposit().send({
      callValue: amount,
      feeLimit: 100_000_000,
      shouldPollResponse: false  // Don't wait for confirmation
    });
    return tx;
  } catch (error) {
    console.error('Error depositing:', error);
    throw error;
  }
};

/**
 * Withdraw TRX from contract
 */
export const withdrawTrx = async (amount) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    throw new Error('Contract not deployed for this network');
  }

  const contract = await getContract(contractAddress);
  
  try {
    const tx = await contract.withdraw(amount).send({
      feeLimit: 100_000_000,
      shouldPollResponse: true
    });
    return tx;
  } catch (error) {
    console.error('Error withdrawing:', error);
    throw error;
  }
};

/**
 * Format address for display (truncate)
 */
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

/**
 * Format TRX amount (SUN to TRX)
 */
export const formatTrx = (sun) => {
  if (!sun) return '0';
  return (sun / 1e6).toFixed(2);
};

/**
 * Parse TRX to SUN
 */
export const parseTrx = (trx) => {
  return Math.floor(parseFloat(trx) * 1e6);
};

/**
 * Try to unlock locked balance by leaving table
 * This attempts to call leaveTable for a specific tableId
 */
export const tryUnlockLockedBalance = async (tableId = 1) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    throw new Error('Contract not deployed for this network');
  }

  const contract = await getContract(contractAddress);

  try {
    // Try to leave table to unlock funds
    const tx = await contract.leaveTable(tableId).send({
      feeLimit: 100_000_000,
      shouldPollResponse: true
    });
    return { success: true, tx };
  } catch (error) {
    console.error('Error unlocking balance:', error);
    throw error;
  }
};

/**
 * Get game session info
 */
export const getGameSession = async (tableId) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) {
    return null;
  }

  const contract = await getContract(contractAddress);

  try {
    const session = await contract.getGameSession(tableId).call();
    return {
      tableId: toNumber(session.tableId),
      state: session.state, // 0=WAITING, 1=PLAYING, 2=SETTLING, 3=FINISHED
      players: session.players_ || [],
      totalPot: toNumber(session.totalPot),
      stateName: ['WAITING', 'PLAYING', 'SETTLING', 'FINISHED'][session.state] || 'UNKNOWN'
    };
  } catch (error) {
    console.error('Error getting game session:', error);
    return null;
  }
};

/**
 * Get transaction link
 */
export const getTransactionLink = (txId, network = currentNetwork) => {
  const baseUrls = {
    mainnet: 'https://tronscan.org/#/transaction/',
    testnet: 'https://nile.tronscan.org/#/transaction/'
  };
  return `${baseUrls[network]}${txId}`;
};

/**
 * Get address link
 */
export const getAddressLink = (address, network = currentNetwork) => {
  const baseUrls = {
    mainnet: 'https://tronscan.org/#/address/',
    testnet: 'https://nile.tronscan.org/#/address/'
  };
  return `${baseUrls[network]}${address}`;
};

export default {
  isTronLinkInstalled,
  connectTronLink,
  getCurrentAddress,
  getTrxBalance,
  getContract,
  registerPlayer,
  isPlayerRegistered,
  getPlayerBalance,
  depositTrx,
  withdrawTrx,
  tryUnlockLockedBalance,
  getGameSession,
  formatAddress,
  formatTrx,
  parseTrx,
  getTransactionLink,
  getAddressLink,
  setNetwork,
  getCurrentNetwork,
  NETWORKS
};
