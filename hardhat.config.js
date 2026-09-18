require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "cancun",
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    tron: {
      url: "https://nile.trongrid.io",
      chainId: 3448148188,
      accounts: process.env.NILE_PRIVATE_KEY ? [process.env.NILE_PRIVATE_KEY] : []
    },
    tronMainnet: {
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
