/**
 * TronLink Wallet Integration Utilities
 * Handles wallet connection and basic TRON operations
 */

// Contract ABI (will be replaced with actual ABI after deployment)
const CONTRACT_ABI = [
  // Player functions
  "function registerPlayer()",
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function joinTable(uint256 tableId, uint256 buyInAmount)",
  "function leaveTable(uint256 tableId)",
  "function settleGame(uint256 tableId, address[] winners, uint256[] amounts, bytes32 resultHash)",
  
  // View functions
  "function players(address) view returns (uint256 balance, uint256 lockedAmount, bool isRegistered, uint256 registeredAt)",
  "function getPlayerBalance(address) view returns (uint256)",
  "function getPlayerLockedBalance(address) view returns (uint256)",
  "function getPlayerInfo(address) view returns (uint256 balance, uint256 lockedAmount, bool isRegistered, uint256 registeredAt)",
  "function getStatistics() view returns (uint256 _totalVolume, uint256 _totalRakeCollected, uint256 _totalGamesPlayed, uint256 _accumulatedRake, uint256 _rakeRate, uint256 _playerCount)",
  "function rakeRate() view returns (uint256)",
  "function getPendingRakeChange() view returns (bool exists, uint256 newRate, uint256 effectiveTime)",
  
  // Admin functions
  "function scheduleRakeRateChange(uint256 newRate)",
  "function applyRakeRateChange()",
  "function cancelRakeRateChange()",
  "function withdrawRake(address to, uint256 amount)",
  "function pause()",
  "function unpause()",
  
  // Events
  "event PlayerRegistered(address indexed player, uint256 timestamp)",
  "event Deposited(address indexed player, uint256 amount)",
  "event Withdrawn(address indexed player, uint256 amount)",
  "event GameSettled(uint256 indexed gameId, address[] winners, uint256[] amounts, uint256 rakeCollected)"
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
    contractAddress: process.env.REACT_APP_TESTNET_CONTRACT_ADDRESS
  }
};

// Default network (testnet for development)
let currentNetwork = 'testnet';

/**
 * Check if TronLink is installed
 */
export const isTronLinkInstalled = () => {
  return typeof window !== 'undefined' && window.tronLink !== undefined;
};

/**
 * Connect to TronLink wallet
 * @returns {Promise<object>} Connection result
 */
export const connectTronLink = async () => {
  if (!isTronLinkInstalled()) {
    return {
      success: false,
      error: 'TronLink not installed',
      installUrl: 'https://www.tronlink.org/'
    };
  }

  try {
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
  return window.tronLink.tronWeb?.defaultAddress?.base58 || null;
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
    const balance = await window.tronLink.tronWeb.trx.getBalance(address);
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
    const contract = await window.tronLink.tronWeb.contract(
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
