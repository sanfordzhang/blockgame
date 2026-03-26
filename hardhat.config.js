require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      // Local testnet configuration
      chainId: 1337
    },
    tron: {
      // TRON Nile testnet
      url: "https://nile.trongrid.io",
      chainId: 3448148188,
      accounts: process.env.NILE_PRIVATE_KEY ? [process.env.NILE_PRIVATE_KEY] : []
    },
    tronMainnet: {
      // TRON mainnet
      url: "https://api.trongrid.io",
      chainId: 728126428,
      accounts: process.env.MAINNET_PRIVATE_KEY ? [process.env.MAINNET_PRIVATE_KEY] : []
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./tests/contracts",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 40000
  }
};
