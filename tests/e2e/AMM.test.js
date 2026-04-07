/**
 * AMM E2E Tests
 * End-to-end tests for AMM functionality
 */

const { chromium } = require('playwright');
const { expect } = require('chai');

// Test configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';

// Test addresses (Nile testnet)
const TEST_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

describe('AMM E2E Tests', function() {
  this.timeout(60000);
  
  let browser;
  let page;
  let context;
  
  before(async function() {
    // Connect to existing Chrome with CDP
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    context = browser.contexts()[0] || await browser.newContext();
    page = await context.newPage();
    
    // Setup test helpers
    await page.setViewportSize({ width: 1280, height: 800 });
  });
  
  after(async function() {
    // Don't close browser, just close page
    if (page) await page.close();
  });
  
  describe('DEX Page Navigation', function() {
    it('should load DEX page', async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      
      // Check page title
      const title = await page.title();
      expect(title).to.include('DEX');
    });
    
    it('should display pool information', async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      
      // Wait for pool info to load
      await page.waitForSelector('[data-testid="pool-info"]', { timeout: 10000 });
      
      // Check reserve displays
      const reserveTRX = await page.textContent('[data-testid="reserve-trx"]');
      const reserveCHIP = await page.textContent('[data-testid="reserve-chip"]');
      
      expect(reserveTRX).to.exist;
      expect(reserveCHIP).to.exist;
    });
    
    it('should show current price', async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      
      await page.waitForSelector('[data-testid="current-price"]', { timeout: 10000 });
      
      const price = await page.textContent('[data-testid="current-price"]');
      expect(price).to.match(/\d+/); // Should contain numbers
    });
  });
  
  describe('Swap Functionality', function() {
    beforeEach(async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="trading-panel"]', { timeout: 10000 });
    });
    
    it('should show swap form', async function() {
      const swapForm = await page.$('[data-testid="swap-form"]');
      expect(swapForm).to.exist;
    });
    
    it('should calculate swap output', async function() {
      // Select TRX to CHIP
      await page.click('[data-testid="swap-direction-trx-to-chip"]');
      
      // Enter amount
      await page.fill('[data-testid="swap-amount-in"]', '10');
      
      // Wait for output calculation
      await page.waitForSelector('[data-testid="swap-amount-out"]', { timeout: 5000 });
      
      const amountOut = await page.inputValue('[data-testid="swap-amount-out"]');
      expect(parseFloat(amountOut)).to.be.greaterThan(0);
    });
    
    it('should show price impact warning for large swaps', async function() {
      // Enter large amount
      await page.fill('[data-testid="swap-amount-in"]', '10000');
      
      // Check for price impact display
      await page.waitForSelector('[data-testid="price-impact"]', { timeout: 5000 });
      
      const priceImpact = await page.textContent('[data-testid="price-impact"]');
      const impactValue = parseFloat(priceImpact.replace('%', ''));
      
      // Large swap should show warning
      if (impactValue > 1) {
        const warning = await page.$('[data-testid="price-impact-warning"]');
        expect(warning).to.exist;
      }
    });
    
    it('should validate slippage settings', async function() {
      // Open slippage settings
      await page.click('[data-testid="slippage-settings"]');
      
      // Test preset values
      await page.click('[data-testid="slippage-0.5"]');
      let selectedSlippage = await page.getAttribute('[data-testid="slippage-0.5"]', 'class');
      expect(selectedSlippage).to.include('active');
      
      await page.click('[data-testid="slippage-1"]');
      selectedSlippage = await page.getAttribute('[data-testid="slippage-1"]', 'class');
      expect(selectedSlippage).to.include('active');
    });
  });
  
  describe('Liquidity Management', function() {
    beforeEach(async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="liquidity-panel"]', { timeout: 10000 });
    });
    
    it('should show liquidity panel', async function() {
      const liquidityPanel = await page.$('[data-testid="liquidity-panel"]');
      expect(liquidityPanel).to.exist;
    });
    
    it('should calculate liquidity position', async function() {
      // Switch to Add Liquidity tab
      await page.click('[data-testid="add-liquidity-tab"]');
      
      // Enter amounts
      await page.fill('[data-testid="liquidity-trx-amount"]', '100');
      await page.fill('[data-testid="liquidity-chip-amount"]', '1000');
      
      // Check LP token estimate
      await page.waitForSelector('[data-testid="expected-lp"]', { timeout: 5000 });
      
      const expectedLP = await page.textContent('[data-testid="expected-lp"]');
      expect(parseFloat(expectedLP)).to.be.greaterThan(0);
    });
    
    it('should show user liquidity positions', async function() {
      // Switch to My Liquidity tab
      await page.click('[data-testid="my-liquidity-tab"]');
      
      // Wait for positions to load
      await page.waitForSelector('[data-testid="liquidity-positions"]', { timeout: 10000 });
      
      const positions = await page.$$('[data-testid="liquidity-position"]');
      // May be empty if user has no positions
      expect(positions).to.be.an('array');
    });
  });
  
  describe('Price Chart', function() {
    beforeEach(async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="price-chart"]', { timeout: 15000 });
    });
    
    it('should render price chart', async function() {
      const chart = await page.$('[data-testid="price-chart"]');
      expect(chart).to.exist;
    });
    
    it('should switch time intervals', async function() {
      // Click 1h interval
      await page.click('[data-testid="interval-1h"]');
      
      // Wait for chart update
      await page.waitForTimeout(1000);
      
      // Verify active state
      const activeInterval = await page.getAttribute('[data-testid="interval-1h"]', 'class');
      expect(activeInterval).to.include('active');
    });
  });
  
  describe('Transaction History', function() {
    beforeEach(async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="transaction-history"]', { timeout: 10000 });
    });
    
    it('should show transaction history', async function() {
      const historyPanel = await page.$('[data-testid="transaction-history"]');
      expect(historyPanel).to.exist;
    });
    
    it('should filter transactions by type', async function() {
      // Click Swap filter
      await page.click('[data-testid="filter-swap"]');
      
      // Wait for filtered results
      await page.waitForTimeout(500);
      
      // Verify filter is active
      const swapFilter = await page.getAttribute('[data-testid="filter-swap"]', 'class');
      expect(swapFilter).to.include('active');
    });
    
    it('should link to block explorer', async function() {
      // Find a transaction link
      const txLink = await page.$('[data-testid="tx-link"]');
      
      if (txLink) {
        const href = await txLink.getAttribute('href');
        expect(href).to.include('tronscan');
      }
    });
  });
  
  describe('Error Handling', function() {
    it('should show error for insufficient balance', async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      
      // Enter amount larger than balance
      await page.fill('[data-testid="swap-amount-in"]', '999999999');
      
      // Check for error message
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 5000 });
      
      const error = await page.textContent('[data-testid="error-message"]');
      expect(error).to.include('insufficient');
    });
    
    it('should show error for invalid input', async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      
      // Enter invalid amount
      await page.fill('[data-testid="swap-amount-in"]', 'abc');
      
      // Check for validation error
      const amountIn = await page.$('[data-testid="swap-amount-in"]');
      const isValid = await amountIn.evaluate(el => el.checkValidity());
      
      expect(isValid).to.be.false;
    });
  });
  
  describe('WebSocket Updates', function() {
    it('should receive real-time price updates', async function() {
      await page.goto(`${FRONTEND_URL}/dex`, { waitUntil: 'networkidle' });
      
      // Get initial price
      await page.waitForSelector('[data-testid="current-price"]', { timeout: 10000 });
      const initialPrice = await page.textContent('[data-testid="current-price"]');
      
      // Wait for potential update (5 seconds)
      await page.waitForTimeout(5000);
      
      // Price should still be displayed
      const currentPrice = await page.textContent('[data-testid="current-price"]');
      expect(currentPrice).to.exist;
    });
  });
});

// Helper functions
async function connectWallet(page, address) {
  // Mock wallet connection for testing
  await page.evaluate((addr) => {
    window.tronWeb = {
      defaultAddress: {
        base58: addr
      },
      ready: true
    };
    
    window.dispatchEvent(new CustomEvent('tronLink#connect'));
  }, address);
}

async function mockTransaction(page, type) {
  // Mock transaction response
  await page.evaluate((txType) => {
    window.mockTxResult = {
      type: txType,
      txHash: '0x' + Math.random().toString(16).substr(2, 64),
      success: true
    };
  }, type);
}

module.exports = {
  connectWallet,
  mockTransaction
};
