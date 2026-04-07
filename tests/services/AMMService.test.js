/**
 * AMM Service Tests
 * Unit tests for LiquidityService and PriceOracleService
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const sinon = require('sinon');

// Import services
const LiquidityService = require('../../server/services/LiquidityService');
const PriceOracleService = require('../../server/services/PriceOracleService');

// Import models
const PoolState = require('../../server/models/PoolState');
const SwapEvent = require('../../server/models/SwapEvent');
const UserLiquidity = require('../../server/models/UserLiquidity');
const PriceHistory = require('../../server/models/PriceHistory');

describe('LiquidityService', function() {
  this.timeout(10000);
  
  let liquidityService;
  let mockTronService;
  
  before(async function() {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/game-core-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
    
    // Create mock TronService
    mockTronService = {
      getContractInstance: sinon.stub(),
      callContract: sinon.stub()
    };
    
    liquidityService = new LiquidityService(mockTronService);
  });
  
  after(async function() {
    // Cleanup
    await PoolState.deleteMany({});
    await SwapEvent.deleteMany({});
    await UserLiquidity.deleteMany({});
    await mongoose.connection.close();
  });
  
  beforeEach(async function() {
    // Clear collections before each test
    await PoolState.deleteMany({});
    await SwapEvent.deleteMany({});
    await UserLiquidity.deleteMany({});
  });
  
  describe('syncPoolState', function() {
    it('should create initial pool state', async function() {
      // Mock contract call
      mockTronService.callContract.resolves({
        reserveTRX: 1000000n,
        reserveCHIP: 10000000n,
        blockTimestampLast: Date.now()
      });
      
      const state = await liquidityService.syncPoolState();
      
      expect(state).to.exist;
      expect(state.reserveTRX).to.equal(1000000);
      expect(state.reserveCHIP).to.equal(10000000);
    });
    
    it('should update existing pool state', async function() {
      // Create initial state
      await PoolState.create({
        poolAddress: 'test-pool',
        reserveTRX: 1000000,
        reserveCHIP: 10000000,
        totalLiquidity: 100000
      });
      
      // Mock updated contract state
      mockTronService.callContract.resolves({
        reserveTRX: 2000000n,
        reserveCHIP: 20000000n,
        blockTimestampLast: Date.now()
      });
      
      const state = await liquidityService.syncPoolState();
      
      expect(state.reserveTRX).to.equal(2000000);
      expect(state.reserveCHIP).to.equal(20000000);
    });
  });
  
  describe('getUserLiquidity', function() {
    it('should return user liquidity positions', async function() {
      const userAddress = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
      
      // Create test data
      await UserLiquidity.create({
        userAddress,
        poolAddress: 'test-pool',
        liquidityAmount: 100000,
        trxAmount: 1000,
        chipAmount: 10000
      });
      
      const positions = await liquidityService.getUserLiquidity(userAddress);
      
      expect(positions).to.be.an('array');
      expect(positions.length).to.equal(1);
      expect(positions[0].liquidityAmount).to.equal(100000);
    });
    
    it('should return empty array for user with no positions', async function() {
      const positions = await liquidityService.getUserLiquidity('nonexistent');
      expect(positions).to.be.an('array').that.is.empty;
    });
  });
  
  describe('recordSwapEvent', function() {
    it('should record swap event correctly', async function() {
      const swapData = {
        txHash: '0x123abc',
        sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        tokenIn: 'TRX',
        tokenOut: 'CHIP',
        amountIn: 1000000,
        amountOut: 10000000,
        reserveTRXAfter: 2000000,
        reserveCHIPAfter: 9000000
      };
      
      const event = await liquidityService.recordSwapEvent(swapData);
      
      expect(event).to.exist;
      expect(event.txHash).to.equal('0x123abc');
      expect(event.type).to.equal('swap');
    });
  });
  
  describe('getTransactionHistory', function() {
    beforeEach(async function() {
      // Create test events
      await SwapEvent.create([
        {
          txHash: 'tx1',
          sender: 'user1',
          type: 'swap',
          tokenIn: 'TRX',
          amountIn: 100,
          amountOut: 1000,
          timestamp: new Date()
        },
        {
          txHash: 'tx2',
          sender: 'user1',
          type: 'add_liquidity',
          trxAmount: 1000,
          chipAmount: 10000,
          timestamp: new Date()
        }
      ]);
    });
    
    it('should return transaction history', async function() {
      const history = await liquidityService.getTransactionHistory('user1');
      
      expect(history).to.be.an('array');
      expect(history.length).to.equal(2);
    });
    
    it('should filter by type', async function() {
      const history = await liquidityService.getTransactionHistory('user1', 'swap');
      
      expect(history).to.be.an('array');
      expect(history.length).to.equal(1);
      expect(history[0].type).to.equal('swap');
    });
    
    it('should respect limit parameter', async function() {
      const history = await liquidityService.getTransactionHistory('user1', null, 1);
      
      expect(history).to.be.an('array');
      expect(history.length).to.equal(1);
    });
  });
});

describe('PriceOracleService', function() {
  this.timeout(10000);
  
  let priceOracleService;
  let mockLiquidityService;
  
  before(async function() {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/game-core-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }
    
    mockLiquidityService = {
      getPoolState: sinon.stub()
    };
    
    priceOracleService = new PriceOracleService(mockLiquidityService);
  });
  
  after(async function() {
    await PriceHistory.deleteMany({});
    await mongoose.connection.close();
  });
  
  beforeEach(async function() {
    await PriceHistory.deleteMany({});
  });
  
  describe('getInstantPrice', function() {
    it('should calculate instant price correctly', async function() {
      mockLiquidityService.getPoolState.resolves({
        reserveTRX: 1000000,
        reserveCHIP: 10000000
      });
      
      const price = await priceOracleService.getInstantPrice();
      
      expect(price).to.exist;
      expect(price.price).to.be.closeTo(10, 0.1); // 10 CHIP per TRX
      expect(price.reserveTRX).to.equal(1000000);
      expect(price.reserveCHIP).to.equal(10000000);
    });
    
    it('should use cached price within TTL', async function() {
      mockLiquidityService.getPoolState.resolves({
        reserveTRX: 1000000,
        reserveCHIP: 10000000
      });
      
      // First call
      await priceOracleService.getInstantPrice();
      
      // Second call should use cache
      const price = await priceOracleService.getInstantPrice();
      
      expect(mockLiquidityService.getPoolState.calledOnce).to.be.true;
    });
  });
  
  describe('calculateSlippage', function() {
    it('should calculate slippage for small trades', async function() {
      const reserveTRX = 1000000;
      const reserveCHIP = 10000000;
      const amountTRX = 10000; // 1% of reserve
      
      const slippage = priceOracleService.calculateSlippage(
        amountTRX,
        reserveTRX,
        reserveCHIP
      );
      
      // For small trades, slippage should be small
      expect(slippage).to.be.lessThan(1); // Less than 1%
    });
    
    it('should calculate higher slippage for large trades', async function() {
      const reserveTRX = 1000000;
      const reserveCHIP = 10000000;
      const amountTRX = 100000; // 10% of reserve
      
      const slippage = priceOracleService.calculateSlippage(
        amountTRX,
        reserveTRX,
        reserveCHIP
      );
      
      // Larger trades should have more slippage
      expect(slippage).to.be.greaterThan(0.5);
    });
  });
  
  describe('quoteSwap', function() {
    it('should quote swap output correctly', async function() {
      mockLiquidityService.getPoolState.resolves({
        reserveTRX: 1000000,
        reserveCHIP: 10000000
      });
      
      const quote = await priceOracleService.quoteSwap(100000, 'TRX', 'CHIP');
      
      expect(quote).to.exist;
      expect(quote.amountOut).to.be.greaterThan(0);
      expect(quote.priceImpact).to.be.a('number');
      expect(quote.minimumOut).to.be.a('number');
    });
    
    it('should apply fee in quote', async function() {
      mockLiquidityService.getPoolState.resolves({
        reserveTRX: 1000000,
        reserveCHIP: 10000000
      });
      
      const quote = await priceOracleService.quoteSwap(100000, 'TRX', 'CHIP');
      
      // The output should be less than the theoretical maximum due to fee
      const theoreticalOut = (100000 * 10000000) / 1000000;
      expect(quote.amountOut).to.be.lessThan(theoreticalOut);
    });
  });
  
  describe('calculateImpermanentLoss', function() {
    it('should calculate impermanent loss for price change', async function() {
      const initialPrice = 10; // 10 CHIP per TRX
      const currentPrice = 11; // 10% price increase
      
      const loss = priceOracleService.calculateImpermanentLoss(initialPrice, currentPrice);
      
      expect(loss).to.be.a('number');
      // With 10% price change, IL should be around 0.05%
      expect(loss).to.be.greaterThan(0);
      expect(loss).to.be.lessThan(1);
    });
    
    it('should return zero for no price change', async function() {
      const loss = priceOracleService.calculateImpermanentLoss(10, 10);
      expect(loss).to.equal(0);
    });
  });
  
  describe('TWAP calculation', function() {
    beforeEach(async function() {
      // Create price history
      const now = Date.now();
      const prices = [];
      
      for (let i = 0; i < 12; i++) {
        prices.push({
          timestamp: new Date(now - i * 5 * 60 * 1000), // 5 min intervals
          price: 10 + Math.random() * 0.5, // Price around 10
          reserveTRX: 1000000,
          reserveCHIP: 10000000
        });
      }
      
      await PriceHistory.insertMany(prices);
    });
    
    it('should calculate TWAP correctly', async function() {
      const twap = await priceOracleService.getTWAP(60); // 1 hour TWAP
      
      expect(twap).to.exist;
      expect(twap.price).to.be.closeTo(10.25, 0.5);
    });
  });
});

module.exports = {
  // Export for integration tests
};
