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
  const ready = await waitForTronLink(3000);
  
  if (!ready) {
    return {
      success: false,
      error: 'TronLink not detected. Please install or unlock TronLink.',
      installUrl: 'https://www.tronlink.org/'
    };
  }

  try {
    // Use tronWeb if tronLink is not available
    const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
    
    // Check if already connected
    if (tronWeb?.defaultAddress?.base58) {
      const address = tronWeb.defaultAddress.base58;
      const chainId = tronWeb.fullNode?.chainId;
      
      return {
        success: true,
        address,
        chainId,
        network: getNetworkByChainId(chainId)
      };
    }

    // Request connection via tronLink
    if (window.tronLink?.request) {
      const res = await window.tronLink.request({
        method: 'tron_requestAccounts'
      });

      if (res.code === 200) {
        const address = window.tronLink.tronWeb.defaultAddress.base58;
        const chainId = await window.tronLink.tronWeb.fullNode.chainId;
        
        return {
          success: true,
          address,
          chainId,
          network: getNetworkByChainId(chainId)
        };
      } else if (res.code === 4001) {
        return {
          success: false,
          error: 'User rejected connection'
        };
      } else {
        return {
          success: false,
          error: res.message || 'Connection failed'
        };
      }
    } else {
      // Direct tronWeb access (some wallets)
      const address = tronWeb?.defaultAddress?.base58;
      if (address) {
        return {
          success: true,
          address,
          chainId: tronWeb.fullNode?.chainId,
          network: 'testnet'
        };
      }
      
      return {
        success: false,
        error: 'Please unlock TronLink wallet'
      };
    }
  } catch (error) {
    console.error('Error connecting to TronLink:', error);
    return {
      success: false,
      error: error.message
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
    const tx = await contract.registerPlayer().send({
      feeLimit: 100_000_000,
      shouldPollResponse: true
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
 * Get player balance from contract
 */
export const getPlayerBalance = async (address) => {
  const contractAddress = getContractAddress();
  if (!contractAddress) return { balance: 0, locked: 0 };

  const contract = await getContract(contractAddress);
  
  try {
    const info = await contract.getPlayerInfo(address).call();
    return {
      balance: info.balance.toNumber(),
      locked: info.lockedAmount.toNumber()
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
    const tx = await contract.deposit().send({
      callValue: amount,
      feeLimit: 100_000_000,
      shouldPollResponse: true
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
  formatAddress,
  formatTrx,
  parseTrx,
  getTransactionLink,
  getAddressLink,
  setNetwork,
  getCurrentNetwork,
  NETWORKS
};
