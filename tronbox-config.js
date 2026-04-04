require('dotenv').config({ path: '.env.testnet' });

module.exports = {
  networks: {
    shasta: {
      privateKey: process.env.TESTNET_PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1500000000,
      fullHost: 'https://api.shasta.trongrid.io',
      network_id: '2'
    }
  },
  compilers: {
    solc: {
      version: '0.8.20'
    }
  }
};
