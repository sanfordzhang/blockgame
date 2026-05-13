const configureRoutes = (app) => {
  app.use('/api/auth', require('./api/auth'));
  app.use('/api/users', require('./api/users'));
  app.use('/api/chips', require('./api/chips'));
  
  // Tournament System API
  app.use('/api/tournament', require('./api/tournament'));
  
  // NFT Achievement System API
  app.use('/api/nft', require('./api/nft'));
  app.use('/api/nft-image', require('./api/nft-image'));
  
  // CHIP Token API
  app.use('/api/chip', require('./api/chip'));
  
  // Staking System API
  app.use('/api/stake', require('./api/stake'));
  
  // DAO Governance API
  app.use('/api/dao', require('./api/dao'));
  
  // AMM (DEX) API - will be configured later with services
  app.use('/api/amm', require('./api/amm').router);
  
  // Analytics / Access Log API
  app.use('/api/analytics', require('./api/analytics'));
  
  // ============ 0G (ZeroGravity) Network API ============
  try {
    const zerogRoutes = require('./api/0g');
    app.use('/api/0g', zerogRoutes);
    console.log('[Routes] ✅ /api/0g routes registered');
  } catch (e) {
    console.log('[Routes] ℹ️ 0G routes not available:', e.message);
  }
  
  // AI Service Status API
  try {
    const { router: aiRouter } = require('./api/ai') || {};
    if (aiRouter) app.use('/api/ai', aiRouter);
  } catch (e) {
    console.log('[Routes] ℹ️ AI routes not available:', e.message);
  }
  
  // Blockchain config endpoint
  app.get('/api/blockchain/config', (req, res) => {
    const config = require('../config');
    res.json({
      blockchainEnabled: config.BLOCKCHAIN_ENABLED,
      tronNetwork: config.TRON_NETWORK,
      contractAddress: config.CONTRACT_ADDRESS,
      serverWalletAddress: config.SERVER_WALLET_ADDRESS,
      zeroGServerWalletAddress: config.ZEROG_WALLET_ADDRESS || null,
      // New contract addresses
      tournamentContract: process.env.TOURNAMENT_CONTRACT_ADDRESS,
      nftContract: process.env.NFT_CONTRACT_ADDRESS,
      chipToken: process.env.CHIP_TOKEN_ADDRESS,
      stakingContract: process.env.STAKING_CONTRACT_ADDRESS,
      governanceContract: process.env.GOVERNANCE_CONTRACT_ADDRESS,
      // 0G configuration
      zeroGEnabled: config.ZEROG_ENABLED,
      blockchainMode: config.BLOCKCHAIN_MODE,
      zeroGNetwork: config.ZEROG_NETWORK,
      zeroGPokerGameAddress: config.ZEROG_POKERGAME_ADDRESS,
      zeroGINFTAddress: config.ZEROG_INFT_ADDRESS,
      storageEnabled: config.ZEROG_STORAGE_ENABLED,
      daEnabled: config.ZEROG_DA_ENABLED
    });
  });
  
  app.use('/', (req, res) => {
    res.status(200).send('GGLab API Documents');
  });
};

module.exports = configureRoutes;  