// Environment variables should be loaded by loadEnv.js before this file is imported

module.exports = {
  PORT: process.env.SERVER_PORT || 7777,
  JWT_SECRET: process.env.JWT_SECRET,
  MONGO_URI: process.env.MONGO_URI,
  NODE_ENV: process.env.NODE_ENV,
  INITIAL_CHIPS_AMOUNT: 100000000, // 100 TRX = 100,000,000 SUN
  
  // Blockchain configuration
  BLOCKCHAIN_ENABLED: process.env.BLOCKCHAIN_ENABLED === 'true' || false,
  TRON_NETWORK: process.env.TRON_NETWORK || 'testnet',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || '',
  TRON_GRID_API_KEY: process.env.TRON_GRID_API_KEY || '',
  }
