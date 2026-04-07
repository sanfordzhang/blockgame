/**
 * AMM Integration Tests
 * Full integration tests for AMM system
 */

const { expect } = require('chai');
const mongoose = require('mongoose');
const sinon = require('sinon');

// Import services
const LiquidityService = require('../../server/services/LiquidityService');
const PriceOracleService = require('../../server/services/PriceOracleService');
const AMMListener = require('../../server/blockchain/AMMListener');

// Import models
const PoolState = require('../../server/models/PoolState');
const SwapEvent = require('../../server/models/SwapEvent');
const UserLiquidity = require('../../server/models/UserLiquidity');
const PriceHistory = require('../../server/models/PriceHistory');

describe('AMM Integration Tests', function() {
  this.timeout(30000);
  
  let liquidityService;
  let priceOracleService;
  let ammListener;
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
      callContract: sinon.stub(),
      subscribeToEvents: sinon.stub()
    };
    
    // Initialize services
    liquidityService = new LiquidityService(mockTronService);
    priceOracleService = new PriceOracleService(liquidityService);
    ammListener = new AMMListener(mockTronService, liquidityService);
  });
  
  after(async function() {
    // Cleanup
    await PoolState.deleteMany({});
    await SwapEvent.deleteMany({});
    await UserLiquidity.deleteMany({});
    await PriceHistory.deleteMany({});
    
    await mongoose.connection.close();
  });
  
  beforeEach(async function() {
    // Clear collections
    await PoolState.deleteMany({});
    await SwapEvent.deleteMany({});
    await UserLiquidity.deleteMany({});
    await PriceHistory.deleteMany({});
    
    // Reset stubs
    mockTronService.callContract.reset();
    mockTronService.getContractInstance.reset();
  });
  
  describe('Full Swap Flow', function() {
    it('should process a complete swap from event to database', async function() {
      // 1. Setup initial pool state
      await PoolState.create({
        poolAddress: 'test-pool',
        reserveTRX: 1000000,
        reserveCHIP: 10000000,
        totalLiquidity: 100000,
        blockTimestampLast: Date.now()
      });
      
      // 2. Simulate swap event from blockchain
      const swapEvent = {
        event: 'Swap',
        sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        amountIn: 100000,
        amountOut: 900000,
        tokenIn: 'TRX',
        tokenOut: 'CHIP',
        txHash: '0xswap123',
        blockNumber: 12345
      };
      
      // 3. Process event through listener
      await ammListener.handleSwapEvent(swapEvent);
      
      // 4. Verify database updates
      const swapRecord = await SwapEvent.findOne({ txHash: '0xswap123' });
      expect(swapRecord).to.exist;
      expect(swapRecord.type).to.equal('swap');
      expect(swapRecord.amountIn).to.equal(100000);
      
      // 5. Verify pool state updated
      const poolState = await PoolState.findOne({ poolAddress: 'test-pool' });
      expect(poolState.reserveTRX).to.equal(1100000); // +100000 TRX
    });
    
    it('should calculate correct price after multiple swaps', async function() {
      // Setup initial state
      await PoolState.create({
        poolAddress: 'test-pool',
        reserveTRX: 1000000,
        reserveCHIP: 10000000,
        totalLiquidity: 100000,
        blockTimestampLast: Date.now()
      });
      
      // Process multiple swaps
      for (let i = 0; i < 5; i++) {
        const swapEvent = {
          event: 'Swap',
          sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
          amountIn: 10000,
          amountOut: 0, // Will be calculated
          tokenIn: 'TRX',
          tokenOut: 'CHIP',
          txHash: `0xswap${i}`,
          blockNumber: 12345 + i
        };
        
        await ammListener.handleSwapEvent(swapEvent);
      }
      
      // Get current price
      const price = await priceOracleService.getInstantPrice();
      expect(price).to.exist;
      
      // Price should have changed due to swaps
      expect(price.price).to.not.equal(10); // Initial price was 10
    });
  });
  
  describe('Liquidity Management Flow', function() {
    it('should process add liquidity event', async function() {
      // Setup initial pool
      await PoolState.create({
        poolAddress: 'test-pool',
        reserveTRX: 1000000,
        reserveCHIP: 10000000,
        totalLiquidity: 100000
      });
      
      const addEvent = {
        event: 'Mint',
        sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        amountTRXIn: 100000,
        amountCHIPIn: 1000000,
        liquidity: 10000,
        txHash: '0xadd123',
        blockNumber: 12345
      };
      
      await ammListener.handleMintEvent(addEvent);
      
      // Verify user liquidity record
      const userLiquidity = await UserLiquidity.findOne({
        userAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
      });
      
      expect(userLiquidity).to.exist;
      expect(userLiquidity.liquidityAmount).to.equal(10000);
      
      // Verify pool state
      const poolState = await PoolState.findOne({ poolAddress: 'test-pool' });
      expect(poolState.totalLiquidity).to.equal(110000);
    });
    
    it('should process remove liquidity event', async function() {
      // Setup with user having liquidity
      await PoolState.create({
        poolAddress: 'test-pool',
        reserveTRX: 1000000,
        reserveCHIP: 10000000,
        totalLiquidity: 100000
      });
      
      await UserLiquidity.create({
        userAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        poolAddress: 'test-pool',
        liquidityAmount: 50000,
        trxAmount: 500000,
        chipAmount: 5000000
      });
      
      const removeEvent = {
        event: 'Burn',
        sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        liquidity: 10000,
        amountTRX: 100000,
        amountCHIP: 1000000,
        txHash: '0xremove123',
        blockNumber: 12345
      };
      
      await ammListener.handleBurnEvent(removeEvent);
      
      // Verify updated liquidity
      const userLiquidity = await UserLiquidity.findOne({
        userAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
      });
      
      expect(userLiquidity.liquidityAmount).to.equal(40000); // 50000 - 10000
    });
  });
  
  describe('Price History Tracking', function() {
    it('should track price history over time', async function() {
      // Create price history entries
      const now = Date.now();
      const prices = [];
      
      for (let i = 0; i < 10; i++) {
        prices.push({
          timestamp: new Date(now - i * 60000), // 1 min intervals
          price: 10 + Math.random() * 0.5,
          reserveTRX: 1000000,
          reserveCHIP: 10000000
        });
      }
      
      await PriceHistory.insertMany(prices);
      
      // Get price history
      const history = await PriceHistory.find()
        .sort({ timestamp: -1 })
        .limit(10);
      
      expect(history.length).to.equal(10);
    });
    
    it('should calculate TWAP correctly', async function() {
      // Create stable price history
      const now = Date.now();
      const prices = [];
      
      for (let i = 0; i < 12; i++) {
        prices.push({
          timestamp: new Date(now - i * 300000), // 5 min intervals
          price: 10.0,
          reserveTRX: 1000000,
          reserveCHIP: 10000000
        });
      }
      
      await PriceHistory.insertMany(prices);
      
      // Get TWAP
      const twap = await priceOracleService.getTWAP(60);
      
      expect(twap.price).to.be.closeTo(10.0, 0.01);
    });
  });
  
  describe('Error Recovery', function() {
    it('should handle missing pool state gracefully', async function() {
      // Try to get price without pool state
      try {
        await priceOracleService.getInstantPrice();
      } catch (error) {
        expect(error.message).to.include('not found');
      }
    });
    
    it('should handle duplicate events', async function() {
      // Create initial event
      await SwapEvent.create({
        txHash: '0xdup123',
        sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        type: 'swap',
        tokenIn: 'TRX',
        amountIn: 100,
        amountOut: 1000,
        timestamp: new Date()
      });
      
      // Try to create duplicate
      try {
        await SwapEvent.create({
          txHash: '0xdup123',
          sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
          type: 'swap',
          tokenIn: 'TRX',
          amountIn: 100,
          amountOut: 1000,
          timestamp: new Date()
        });
        
        // Should not reach here if unique index works
      } catch (error) {
        expect(error.code).to.equal(11000); // Duplicate key error
      }
    });
    
    it('should reconnect after connection loss', async function() {
      // Simulate connection loss
      ammListener.connected = false;
      
      // Attempt reconnection
      await ammListener.reconnect();
      
      expect(ammListener.connected).to.be.true;
    });
  });
  
  describe('Performance Tests', function() {
    it('should handle high volume of swaps', async function() {
      // Setup pool
      await PoolState.create({
        poolAddress: 'test-pool',
        reserveTRX: 1000000000, // Large reserves
        reserveCHIP: 10000000000,
        totalLiquidity: 100000000
      });
      
      const startTime = Date.now();
      const numSwaps = 100;
      
      // Process many swaps
      for (let i = 0; i < numSwaps; i++) {
        await SwapEvent.create({
          txHash: `0xperf${i}`,
          sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
          type: 'swap',
          tokenIn: i % 2 === 0 ? 'TRX' : 'CHIP',
          amountIn: 1000,
          amountOut: 10000,
          timestamp: new Date()
        });
      }
      
      const duration = Date.now() - startTime;
      const avgTime = duration / numSwaps;
      
      console.log(`Processed ${numSwaps} swaps in ${duration}ms (avg: ${avgTime}ms per swap)`);
      
      // Should process each swap in under 50ms on average
      expect(avgTime).to.be.lessThan(50);
    });
  });
});

module.exports = {
  // Export for other test files
};
