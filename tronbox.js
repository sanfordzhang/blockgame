// Load environment variables
require('dotenv').config();

module.exports = {
  networks: {
    // Nile Testnet for Fun Mode
    nile: {
      privateKey: process.env.NILE_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6, // 1000 TRX
      fullHost: 'https://nile.trongrid.io',
      network_id: '*'
    },
    // Tron Mainnet for Real Mode
    mainnet: {
      privateKey: process.env.MAINNET_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6, // 1000 TRX
      fullHost: 'https://api.trongrid.io',
      network_id: '*'
    },
    // Shasta Testnet (alternative)
    shasta: {
      privateKey: process.env.SHASTA_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6,
      fullHost: 'https://api.shasta.trongrid.io',
      network_id: '*'
    },
    // Local development
    development: {
      privateKey: process.env.DEV_PRIVATE_KEY || '0000000000000000000000000000000000000000000000000000000000000001',
      userFeePercentage: 0,
      feeLimit: 1000 * 1e6,
      fullHost: 'http://127.0.0.1:9090',
      network_id: '*'
    }
  },
  compilers: {
    solc: {
      version: '0.8.20',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  // Specify contracts directory
  contracts_directory: './contracts',
  contracts_build_directory: './build/contracts'
};
