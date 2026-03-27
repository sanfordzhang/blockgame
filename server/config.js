// Environment variables should be loaded by loadEnv.js before this file is imported

const config = {
  PORT: process.env.SERVER_PORT || process.env.REACT_APP_SERVER_PORT || 7777,
  JWT_SECRET: process.env.JWT_SECRET,
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker',
  NODE_ENV: process.env.NODE_ENV,
  INITIAL_CHIPS_AMOUNT: 100000000, // 100 TRX = 100,000,000 SUN
  
  // Blockchain configuration
  BLOCKCHAIN_ENABLED: process.env.BLOCKCHAIN_ENABLED === 'true' || false,
  TRON_NETWORK: process.env.TRON_NETWORK || 'testnet',
  // Use network-specific contract address
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS ||
    (process.env.TRON_NETWORK === 'mainnet' ? process.env.MAINNET_CONTRACT_ADDRESS : process.env.TESTNET_CONTRACT_ADDRESS) || '',
  TRON_GRID_API_KEY: process.env.TRON_GRID_API_KEY || '',
  
  // Server wallet address (for delegate authorization)
  // This is derived from TESTNET_PRIVATE_KEY or MAINNET_PRIVATE_KEY
  // Players need to authorize this address to allow server proxy operations
  SERVER_WALLET_ADDRESS: null, // Will be set by TronService.init()
};

// Function to set server wallet address (called by TronService after init)
config.setServerWalletAddress = (address) => {
  config.SERVER_WALLET_ADDRESS = address;
};

// Log blockchain configuration on load
console.log('[Config] ========== BLOCKCHAIN CONFIG ==========');
console.log(`[Config] BLOCKCHAIN_ENABLED: ${config.BLOCKCHAIN_ENABLED}`);
console.log(`[Config] TRON_NETWORK: ${config.TRON_NETWORK}`);
console.log(`[Config] CONTRACT_ADDRESS: ${config.CONTRACT_ADDRESS || '(not set)'}`);
console.log('[Config] =======================================');

module.exports = config;
