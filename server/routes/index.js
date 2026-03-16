const configureRoutes = (app) => {
  app.use('/api/auth', require('./api/auth'));
  app.use('/api/users', require('./api/users'));
  app.use('/api/chips', require('./api/chips'));
  
  // Blockchain config endpoint
  app.get('/api/blockchain/config', (req, res) => {
    const config = require('../config');
    res.json({
      blockchainEnabled: config.BLOCKCHAIN_ENABLED,
      tronNetwork: config.TRON_NETWORK,
      contractAddress: config.CONTRACT_ADDRESS,
      serverWalletAddress: config.SERVER_WALLET_ADDRESS
    });
  });
  
  app.use('/', (req, res) => {
    res.status(200).send('GGLab API Documents');
  });
};

module.exports = configureRoutes;  