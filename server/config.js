// Environment variables should be loaded by loadEnv.js before this file is imported

const config = {
  PORT: process.env.SERVER_PORT || process.env.REACT_APP_SERVER_PORT || 7778,
  HOST: process.env.SERVER_HOST_BIND || process.env.HOST || '127.0.0.1',
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
  
  // CHIP Token Configuration
  CHIP_TOKEN_ADDRESS: process.env.CHIP_TOKEN_ADDRESS || '',
  CHIP_DAILY_REWARD_LIMIT: parseInt(process.env.CHIP_DAILY_REWARD_LIMIT) || 5000, // 5,000 CHIP per day
  CHIP_RESERVE_TARGET: parseInt(process.env.CHIP_RESERVE_TARGET) || 500000, // 500,000 CHIP reserve target
  
  // AMM Pool Configuration
  AMM_POOL_ADDRESS: process.env.AMM_POOL_ADDRESS || '',
  AMM_ROUTER_ADDRESS: process.env.AMM_ROUTER_ADDRESS || '',

  // AI Configuration
  AI_ENABLED: process.env.AI_ENABLED !== 'false', // enabled by default
  AI_DEFAULT_DIFFICULTY: process.env.AI_DEFAULT_DIFFICULTY || 'medium',
  AI_WORKER_PRELOAD: process.env.AI_WORKER_PRELOAD === 'true',
  AI_MAX_PLAYERS_PER_TABLE: parseInt(process.env.AI_MAX_PLAYERS_PER_TABLE) || 3,
  AI_PROCESS_PATH: process.env.AI_PROCESS_PATH || 'python3',
  AI_SCRIPT: process.env.AI_SCRIPT || 'ai_engine/decision_engine.py',

  // ============ 0G (ZeroGravity) Network Configuration ============
  ZEROG_ENABLED: process.env.ZEROG_ENABLED === 'true' || false,
  ZEROG_NETWORK: process.env.ZEROG_NETWORK || 'testnet',
  ZEROG_RPC_URL: process.env.ZEROG_RPC_URL || 'https://rpc.testnet.0g.ai',
  ZEROG_PRIVATE_KEY: process.env.ZEROG_PRIVATE_KEY || '',
  ZEROG_CHAIN_ID: process.env.ZEROG_CHAIN_ID === '16661' ? 16661 : 16602,

  // Multi-chain mode: 'tron' | '0g' | 'both'
  BLOCKCHAIN_MODE: process.env.BLOCKCHAIN_MODE || 'tron',

  // 0G Contract Addresses (set after deployment)
  ZEROG_POKERGAME_ADDRESS: process.env.ZEROG_POKERGAME_ADDRESS || '',
  ZEROG_INFT_ADDRESS: process.env.ZEROG_INFT_ADDRESS || '',

  // 0G Storage
  ZEROG_STORAGE_ENABLED: process.env.ZEROG_STORAGE_ENABLED === 'true',
  ZEROG_STORAGE_INDEXER_RPC: process.env.ZEROG_STORAGE_INDEXER_RPC || '',
  ZEROG_STORAGE_ENDPOINT: process.env.ZEROG_STORAGE_ENDPOINT || '',
  ZEROG_MOCK: process.env.ZEROG_MOCK === 'true',

  // 0G Data Availability
  ZEROG_DA_ENABLED: process.env.ZEROG_DA_ENABLED === 'true',
  ZEROG_DA_RPC_URL: process.env.ZEROG_DA_RPC_URL || '',

  // 0G Compute (AI Inference on TEE)
  ZEROG_COMPUTE_ENABLED: process.env.ZEROG_COMPUTE_ENABLED === 'true',
  ZEROG_COMPUTE_ROUTER_URL: process.env.ZEROG_COMPUTE_ROUTER_URL || '',

  // Settlement fallback
  SETTLEMENT_FALLBACK_ENABLED: process.env.SETTLEMENT_FALLBACK_ENABLED !== 'false',
};

// Function to set server wallet address (called by TronService after init)
config.setServerWalletAddress = (address) => {
  config.SERVER_WALLET_ADDRESS = address;
};

// Function to set 0G/EVM server wallet address (called by ZeroGService after init)
config.setZeroGWalletAddress = (address) => {
  config.ZEROG_WALLET_ADDRESS = address;
};

// Log blockchain configuration on load
console.log('[Config] ========== BLOCKCHAIN CONFIG ==========');
console.log(`[Config] BLOCKCHAIN_ENABLED: ${config.BLOCKCHAIN_ENABLED}`);
console.log(`[Config] TRON_NETWORK: ${config.TRON_NETWORK}`);
console.log(`[Config] CONTRACT_ADDRESS: ${config.CONTRACT_ADDRESS || '(not set)'}`);
console.log('[Config] ========== 0G CONFIG ==========');
console.log(`[Config] ZEROG_ENABLED: ${config.ZEROG_ENABLED}`);
console.log(`[Config] BLOCKCHAIN_MODE: ${config.BLOCKCHAIN_MODE}`);
console.log(`[Config] ZEROG_NETWORK: ${config.ZEROG_NETWORK}`);
console.log(`[Config] ZEROG_RPC_URL: ${config.ZEROG_RPC_URL || '(not set)'}`);
console.log(`[Config] ZEROG_MOCK: ${config.ZEROG_MOCK}`);
console.log('[Config] =======================================');

module.exports = config;
