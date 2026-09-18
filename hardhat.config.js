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
    },
    // ============ 0G (ZeroGravity) EVM Network ============
    zerogTestnet: {
      url: process.env.ZEROG_RPC_URL || "https://evmrpc-galileo.0g.ai",
      chainId: 16602,
      accounts: process.env.ZEROG_PRIVATE_KEY ? [process.env.ZEROG_PRIVATE_KEY] : [],
      gasPrice: 3000000000, // 3 gwei (safe margin on 0G testnet)
      gasMultiplier: 1.2
    },
    zerogMainnet: {
      url: process.env.ZEROG_MAINNET_RPC_URL || "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: process.env.ZEROG_MAINNET_PRIVATE_KEY ? [process.env.ZEROG_MAINNET_PRIVATE_KEY] : [],
      gasPrice: 1000000000,
      gasMultiplier: 1.2
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
  },
  etherscan: {
    apiKey: {
      zerogTestnet: "", // 0G block explorer API key (if available)
      zerogMainnet: ""
    }
  }
};
