/**
 * Blockchain API Integration Tests
 */

const request = require('supertest');
const express = require('express');
const blockchainRoutes = require('../../server/blockchain');

// Mock TronService
jest.mock('../../server/blockchain/TronService', () => ({
  getInstance: () => ({
    getBalance: jest.fn().mockResolvedValue(1000000000),
    getAddress: jest.fn().mockReturnValue('TRX_ADDRESS')
  })
}));

// Mock ContractService
jest.mock('../../server/blockchain/ContractService', () => ({
  getInstance: () => ({
    getPlayerBalance: jest.fn().mockResolvedValue({ available: 100, locked: 0 }),
    deposit: jest.fn().mockResolvedValue({ txHash: '0x123' }),
    withdraw: jest.fn().mockResolvedValue({ txHash: '0x456' })
  })
}));

describe('Blockchain API', () => {
  let app;
  
  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/blockchain', blockchainRoutes);
  });
  
  describe('GET /api/blockchain/balance/:address', () => {
    it('should return player balance', async () => {
      const response = await request(app)
        .get('/api/blockchain/balance/TEST_ADDRESS')
        .expect(200);
      
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('locked');
    });
  });
  
  describe('POST /api/blockchain/deposit', () => {
    it('should initiate deposit transaction', async () => {
      const response = await request(app)
        .post('/api/blockchain/deposit')
        .send({ amount: 100 })
        .expect(200);
      
      expect(response.body).toHaveProperty('txHash');
    });
  });
  
  describe('POST /api/blockchain/withdraw', () => {
    it('should initiate withdraw transaction', async () => {
      const response = await request(app)
        .post('/api/blockchain/withdraw')
        .send({ amount: 50 })
        .expect(200);
      
      expect(response.body).toHaveProperty('txHash');
    });
  });
});
