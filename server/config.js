const dotenv = require('dotenv')

// Load env vars if env is not production
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: './server/config/local.env' })
}

module.exports = {
  PORT: process.env.SERVER_PORT || 7777,
  JWT_SECRET: process.env.JWT_SECRET,
  MONGO_URI: process.env.MONGO_URI,
  NODE_ENV: process.env.NODE_ENV,
  INITIAL_CHIPS_AMOUNT: 100000,
  
  // Blockchain configuration
  BLOCKCHAIN_ENABLED: process.env.BLOCKCHAIN_ENABLED === 'true' || false,
  TRON_NETWORK: process.env.TRON_NETWORK || 'testnet',
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || '',
  TRON_GRID_API_KEY: process.env.TRON_GRID_API_KEY || '',
  }
