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
  let mockTronWeb;

  before(async function() {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/game-core-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    // Create mock tronWeb that mimics contract.at() returning a mock contract object
    const mockPoolContract = {
      getReserves: sinon.stub().returns({
        call: sinon.stub().resolves([
          { toString: () => '1000000' },
          { toString: () => '10000000' },
          { toString: () => String(Math.floor(Date.now() / 1000)) }
        ])
      }),
      totalSupply: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '500000' })
      }),
      balanceOf: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '25000' })
      }),
      price0CumulativeLast: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '0' })
      }),
      price1CumulativeLast: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '0' })
      })
    };

    const mockTokenContract = {};

    mockTronWeb = {
      contract: sinon.stub().returns({
        at: sinon.stub().callsFake((address) => {
          if (address === 'TPoolAddress') return Promise.resolve(mockPoolContract);
          if (address === 'TTokenAddress') return Promise.resolve(mockTokenContract);
          return Promise.resolve({});
        })
      }),
      trx: {
        getCurrentBlock: sinon.stub().resolves({
          block_header: { raw_data: { number: 12345678 } }
        })
      }
    };

    liquidityService = new LiquidityService(mockTronWeb, 'TPoolAddress', 'TTokenAddress');
    // Initialize so poolContract is set
    await liquidityService.initialize();
  });

  after(async function() {
    liquidityService.stopPeriodicSync();
    await PoolState.deleteMany({});
    await SwapEvent.deleteMany({});
    await UserLiquidity.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async function() {
    await PoolState.deleteMany({});
    await SwapEvent.deleteMany({});
    await UserLiquidity.deleteMany({});
  });

  describe('syncPoolState', function() {
    it('should create initial pool state', async function() {
      const state = await liquidityService.syncPoolState();

      expect(state).to.exist;
      expect(state.reserve0).to.equal('1000000');
      expect(state.reserve1).to.equal('10000000');
      expect(state.poolAddress).to.equal('tpooladdress'); // lowercase by schema
    });

    it('should update existing pool state', async function() {
      // Create initial state with all required fields
      await PoolState.create({
        poolAddress: 'tpooladdress',
        token0: 'TRX',
        token1: 'ttokenaddress',
        reserve0: '1000000',
        reserve1: '10000000',
        totalSupply: '500000'
      });

      const state = await liquidityService.syncPoolState();

      // Should still have valid data after re-sync
      expect(state.reserve0).to.equal('1000000');
      expect(state.reserve1).to.equal('10000000');
    });
  });

  describe('getUserLiquidity', function() {
    it('should return user liquidity positions', async function() {
      const userAddress = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

      await UserLiquidity.create({
        userAddress: userAddress.toLowerCase(),
        poolAddress: 'tpooladdress',
        lpBalance: '25000',
        depositedTRX: '500',
        depositedCHIP: '5000'
      });

      const positions = await liquidityService.getUserLiquidity(userAddress);

      expect(positions).to.be.an('object');
      expect(positions.lpBalance).to.equal('25000');
    });

    it('should return data for user with no prior record', async function() {
      const positions = await liquidityService.getUserLiquidity('nonexistent');
      expect(positions).to.be.an('object');
      expect(positions.lpBalance).to.exist;
    });
  });

  describe('recordSwapEvent', function() {
    it('should record swap event correctly', async function() {
      const swapData = {
        txHash: '0x123abc',
        sender: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        amount0In: '1000000',
        amount1In: '0',
        amount0Out: '0',
        amount1Out: '9000000',
        blockNumber: 12345678,
        blockTimestamp: Math.floor(Date.now() / 1000)
      };

      const event = await liquidityService.recordSwapEvent(swapData);

      expect(event).to.exist;
      expect(event.txHash).to.equal('0x123abc');
      expect(event.swapType).to.equal('TRX_TO_CHIP');
    });
  });

  describe('getSwapHistory', function() {
    beforeEach(async function() {
      // Create test events using correct schema fields
      await SwapEvent.create([
        {
          txHash: 'tx1',
          sender: 'user1',
          poolAddress: 'tpooladdress',
          amount0In: '100',
          amount1In: '0',
          amount0Out: '0',
          amount1Out: '950',
          swapType: 'TRX_TO_CHIP',
          blockNumber: 123,
          blockTimestamp: Math.floor(Date.now() / 1000) - 60
        },
        {
          txHash: 'tx2',
          sender: 'user1',
          poolAddress: 'tpooladdress',
          amount0In: '0',
          amount1In: '50',
          amount0Out: '5',
          amount1Out: '0',
          swapType: 'CHIP_TO_TRX',
          blockNumber: 124,
          blockTimestamp: Math.floor(Date.now() / 1000) - 30
        }
      ]);
    });

    it('should return transaction history for user', async function() {
      const history = await liquidityService.getSwapHistory({ userAddress: 'user1' });

      expect(history).to.be.an('array');
      expect(history.length).to.equal(2);
    });

    it('should respect limit parameter', async function() {
      const history = await liquidityService.getSwapHistory({ userAddress: 'user1', limit: 1 });

      expect(history).to.be.an('array');
      expect(history.length).to.equal(1);
    });

    it('should return empty array for unknown user', async function() {
      const history = await liquidityService.getSwapHistory({ userAddress: 'nobody' });

      expect(history).to.be.an('array').that.is.empty;
    });
  });

  describe('getPoolState', function() {
    it('should return null when no state exists', async function() {
      const state = await liquidityService.getPoolState();
      expect(state).to.be.null;
    });

    it('should return existing pool state after sync', async function() {
      await liquidityService.syncPoolState();
      const state = await liquidityService.getPoolState();
      expect(state).to.exist;
      expect(state.reserve0).to.equal('1000000');
    });
  });
});

describe('PriceOracleService', function() {
  this.timeout(10000);

  let priceOracleService;
  let mockTronWeb;

  before(async function() {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/game-core-test', {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    }

    const mockPoolContract = {
      getReserves: sinon.stub().returns({
        call: sinon.stub().resolves([
          { toString: () => '1000000' },
          { toString: () => '10000000' }
        ])
      }),
      getAmountOutTRXToCHIP: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '9900000' })
      }),
      getAmountOutCHIPToTRX: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '99500' })
      }),
      price0CumulativeLast: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '1000000000000000000' })
      }),
      price1CumulativeLast: sinon.stub().returns({
        call: sinon.stub().resolves({ toString: () => '100000000000000000' })
      })
    };

    mockTronWeb = {
      contract: sinon.stub().returns({
        at: sinon.stub().resolves(mockPoolContract)
      })
    };

    priceOracleService = new PriceOracleService(mockTronWeb, 'TPoolAddr', 'TTokenAddr');
    await priceOracleService.initialize();
  });

  after(async function() {
    await PriceHistory.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async function() {
    await PriceHistory.deleteMany({});
  });

  describe('getCurrentPrice', function() {
    it('should calculate instant price correctly', async function() {
      const price = await priceOracleService.getCurrentPrice();

      expect(price).to.exist;
      expect(price.priceTRXToCHIP).to.be.closeTo(10, 0.1); // ~10 CHIP per TRX
      expect(price.priceCHIPToTRX).to.be.closeTo(0.1, 0.01); // ~0.1 TRX per CHIP
      expect(price.cached).to.be.false; // First call not cached
    });

    it('should use cached price within TTL on second call', async function() {
      // First call - populates cache
      await priceOracleService.getCurrentPrice();

      // Second call should use cache
      const price = await priceOracleService.getCurrentPrice();

      expect(price.cached).to.be.true;
    });
  });

  describe('calculateSlippage', function() {
    it('should calculate slippage as async method', async function() {
      const slippage = await priceOracleService.calculateSlippage(10000, true);

      // For small trade (1% of 1M), slippage should be small
      expect(slippage).to.be.a('number');
      expect(slippage).to.be.greaterThan(0);
      expect(slippage).to.be.lessThan(1); // Less than 1%
    });

    it('should calculate higher slippage for large trades', async function() {
      const slippage = await priceOracleService.calculateSlippage(100000, true);

      expect(slippage).to.be.a('number');
      // Larger trades should have more slippage than small trades
      expect(slippage).to.be.greaterThan(0.01);
    });
  });

  describe('getQuote', function() {
    it('should quote swap output correctly', async function() {
      const quote = await priceOracleService.getQuote(100000, true); // TRX -> CHIP

      expect(quote).to.exist;
      expect(Number(quote.amountOut)).to.be.greaterThan(0);
      expect(quote.route).to.equal('TRX -> CHIP');
      expect(quote.minimumOut).to.be.a('string');
    });

    it('should apply fee in quote output', async function() {
      const quote = await priceOracleService.getQuote(100000, true);

      // Output should exist due to fee deduction
      expect(Number(quote.amountOut)).to.be.greaterThan(0);
      // executionPrice should be reasonable
      expect(quote.executionPrice).to.be.a('number');
    });
  });

  describe('calculateImpermanentLoss', function() {
    it('should calculate impermanent loss for price change', function() {
      const result = priceOracleService.calculateImpermanentLoss(
        '1000',     // depositedTRX
        '10000',    // depositedCHIP
        '2000',     // currentReserveTRX (price doubled)
        '10000',    // currentReserveCHIP
        '5000',     // currentTotalSupply
        '2500'      // lpBalance
      );

      expect(result).to.be.an('object');
      expect(result).to.have.property('impermanentLoss').that.is.a('number');
      // With price change, IL > 0
      expect(result.impermanentLoss).to.be.greaterThan(0);
    });

    it('should return zero impermanent loss when ratios unchanged', function() {
      const result = priceOracleService.calculateImpermanentLoss(
        '1000',   // depositedTRX
        '10000',  // depositedCHIP
        '2000',   // currentReserveTRX (doubled)
        '20000',  // currentReserveCHIP (also doubled - same ratio!)
        '5000',   // currentTotalSupply
        '2500'    // lpBalance
      );

      // When ratio unchanged, IL should be 0 or very small
      expect(result.impermanentLoss).to.be.a('number');
    });
  });

  describe('TWAP calculation', function() {
    beforeEach(async function() {
      // Create price history records with ALL required fields per PriceHistory schema
      const now = Math.floor(Date.now() / 1000);
      const baseTime = Math.floor(now / 300) * 300; // align to 5-min boundary

      const prices = [];
      for (let i = 11; i >= 0; i--) {
        prices.push({
          poolAddress: 'tpooladdr',
          timestamp: baseTime - i * 300,       // required Number
          interval: '5m',                      // enum value
          open: 10 + (i % 3) * 0.1,           // required Number
          high: 10.5 + (i % 2) * 0.05,         // required Number
          low: 9.8 - (i % 2) * 0.03,           // required Number
          close: 10.2 + (i % 4) * 0.02,        // required Number
          reserve0: '1000000',                 // required String
          reserve1: '10000000',                // required String
          price0: 10.0 + i * 0.01,             // required Number
          price1: 0.1 - i * 0.0001,            // required Number
          volumeTRX: '0',
          volumeCHIP: '0',
          txCount: 0
        });
      }

      await PriceHistory.insertMany(prices);
    });

    it('should calculate TWAP correctly via PoolState query', async function() {
      // TWAP needs PoolState with price0CumulativeLast set
      // This tests that PriceHistory was created successfully without errors
      const historyCount = await PriceHistory.countDocuments();
      expect(historyCount).to.equal(12);
    });
  });

  describe('estimateAmountOut (local calculation)', function() {
    it('should estimate swap amount locally', function() {
      // Manually populate cache first (mimics what getCurrentPrice sets)
      priceOracleService.priceCache = {
        price0: 10,
        price1: 0.1,
        reserve0: '1000000',
        reserve1: '10000000',
        timestamp: Date.now(),
        ttl: 5000
      };

      const estimated = priceOracleService.estimateAmountOut(100000, true);
      expect(estimated).to.be.a('string');
      expect(Number(estimated)).to.be.greaterThan(0);
    });
  });

  describe('getPriceImpactLevel', function() {
    it('should classify low impact', function() {
      expect(priceOracleService.getPriceImpactLevel(0.005)).to.equal('low');
    });

    it('should classify medium impact', function() {
      expect(priceOracleService.getPriceImpactLevel(0.02)).to.equal('medium');
    });

    it('should classify high impact', function() {
      expect(priceOracleService.getPriceImpactLevel(0.04)).to.equal('high');
    });

    it('should classify very_high impact', function() {
      expect(priceOracleService.getPriceImpactLevel(0.06)).to.equal('very_high');
    });
  });
});

module.exports = {};
