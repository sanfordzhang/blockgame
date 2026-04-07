/**
 * AMM Monitoring Service
 * Monitors pool health, price stability, and system performance
 */

const mongoose = require('mongoose');
const PoolState = require('../models/PoolState');
const SwapEvent = require('../models/SwapEvent');
const PriceHistory = require('../models/PriceHistory');

class AMMMonitor {
  constructor(liquidityService, priceOracleService, options = {}) {
    this.liquidityService = liquidityService;
    this.priceOracleService = priceOracleService;
    
    // Monitoring intervals
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    this.priceAlertInterval = options.priceAlertInterval || 60000; // 1 minute
    this.performanceInterval = options.performanceInterval || 60000; // 1 minute
    
    // Alert thresholds
    this.thresholds = {
      minLiquidity: options.minLiquidity || 100000, // Minimum pool liquidity
      maxPriceChange: options.maxPriceChange || 10, // Max % price change per hour
      maxSlippage: options.maxSlippage || 5, // Max acceptable slippage
      minReserveRatio: options.minReserveRatio || 0.1, // Min reserve ratio
      maxGasPrice: options.maxGasPrice || 1000, // Max SUN per gas
    };
    
    // State tracking
    this.lastHealthCheck = null;
    this.lastPrice = null;
    this.alertCallbacks = new Set();
    this.timers = [];
  }
  
  /**
   * Start monitoring
   */
  start() {
    console.log('[AMM Monitor] Starting monitoring services...');
    
    // Health check timer
    this.timers.push(
      setInterval(() => this.checkHealth(), this.healthCheckInterval)
    );
    
    // Price alert timer
    this.timers.push(
      setInterval(() => this.checkPriceAlerts(), this.priceAlertInterval)
    );
    
    // Performance timer
    this.timers.push(
      setInterval(() => this.checkPerformance(), this.performanceInterval)
    );
    
    console.log('[AMM Monitor] Monitoring started');
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    console.log('[AMM Monitor] Stopping monitoring...');
    
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
    
    console.log('[AMM Monitor] Monitoring stopped');
  }
  
  /**
   * Register alert callback
   */
  onAlert(callback) {
    this.alertCallbacks.add(callback);
    return () => this.alertCallbacks.delete(callback);
  }
  
  /**
   * Emit alert
   */
  emitAlert(type, severity, message, data = {}) {
    const alert = {
      type,
      severity,
      message,
      data,
      timestamp: new Date()
    };
    
    console.log(`[AMM Monitor] Alert [${severity}] ${type}: ${message}`);
    
    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('[AMM Monitor] Alert callback error:', error);
      }
    }
  }
  
  /**
   * Check pool health
   */
  async checkHealth() {
    try {
      const poolState = await this.liquidityService.getPoolState();
      
      if (!poolState) {
        this.emitAlert('health', 'critical', 'Pool state not found');
        return;
      }
      
      // Check minimum liquidity
      if (poolState.totalLiquidity < this.thresholds.minLiquidity) {
        this.emitAlert('liquidity', 'warning', 
          `Low liquidity: ${poolState.totalLiquidity} (min: ${this.thresholds.minLiquidity})`,
          { currentLiquidity: poolState.totalLiquidity }
        );
      }
      
      // Check reserve ratio
      const reserveRatio = Math.min(
        poolState.reserveTRX / poolState.reserveCHIP,
        poolState.reserveCHIP / poolState.reserveTRX
      );
      
      if (reserveRatio < this.thresholds.minReserveRatio) {
        this.emitAlert('reserves', 'warning',
          `Low reserve ratio: ${reserveRatio.toFixed(4)}`,
          { reserveRatio, reserveTRX: poolState.reserveTRX, reserveCHIP: poolState.reserveCHIP }
        );
      }
      
      // Check for extreme imbalance
      const price = poolState.reserveCHIP / poolState.reserveTRX;
      if (price > 1000 || price < 0.001) {
        this.emitAlert('price', 'critical',
          `Extreme price detected: ${price.toFixed(6)} CHIP/TRX`,
          { price }
        );
      }
      
      this.lastHealthCheck = {
        timestamp: new Date(),
        healthy: true,
        liquidity: poolState.totalLiquidity,
        reserves: {
          trx: poolState.reserveTRX,
          chip: poolState.reserveCHIP
        }
      };
      
    } catch (error) {
      this.emitAlert('health', 'critical', `Health check failed: ${error.message}`);
      this.lastHealthCheck = {
        timestamp: new Date(),
        healthy: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check for price anomalies
   */
  async checkPriceAlerts() {
    try {
      const currentPrice = await this.priceOracleService.getInstantPrice();
      
      if (!this.lastPrice) {
        this.lastPrice = currentPrice;
        return;
      }
      
      // Calculate price change
      const priceChange = Math.abs(
        ((currentPrice.price - this.lastPrice.price) / this.lastPrice.price) * 100
      );
      
      if (priceChange > this.thresholds.maxPriceChange) {
        this.emitAlert('price', 'warning',
          `Large price movement: ${priceChange.toFixed(2)}% in the last minute`,
          {
            previousPrice: this.lastPrice.price,
            currentPrice: currentPrice.price,
            changePercent: priceChange
          }
        );
      }
      
      this.lastPrice = currentPrice;
      
    } catch (error) {
      this.emitAlert('price', 'error', `Price check failed: ${error.message}`);
    }
  }
  
  /**
   * Check system performance
   */
  async checkPerformance() {
    try {
      // Get recent transaction count
      const oneHourAgo = new Date(Date.now() - 3600000);
      const txCount = await SwapEvent.countDocuments({
        timestamp: { $gte: oneHourAgo }
      });
      
      // Get average transaction time
      const avgTxTime = await this.getAverageTransactionTime();
      
      // Check database connection
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      const performance = {
        transactionsPerHour: txCount,
        averageTransactionTime: avgTxTime,
        databaseStatus: dbStatus,
        timestamp: new Date()
      };
      
      // Alert on performance issues
      if (avgTxTime > 5000) { // More than 5 seconds
        this.emitAlert('performance', 'warning',
          `Slow transaction processing: ${avgTxTime}ms average`,
          performance
        );
      }
      
      if (dbStatus !== 'connected') {
        this.emitAlert('database', 'critical', 'Database disconnected');
      }
      
      return performance;
      
    } catch (error) {
      this.emitAlert('performance', 'error', `Performance check failed: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Get average transaction processing time
   */
  async getAverageTransactionTime() {
    // This would be implemented with actual timing data
    // For now, return a mock value
    return 150; // ms
  }
  
  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.timers.length > 0,
      lastHealthCheck: this.lastHealthCheck,
      lastPrice: this.lastPrice?.price || null,
      thresholds: this.thresholds
    };
  }
  
  /**
   * Get monitoring metrics
   */
  async getMetrics() {
    const poolState = await this.liquidityService.getPoolState();
    const price = await this.priceOracleService.getInstantPrice();
    const twap = await this.priceOracleService.getTWAP(60);
    
    return {
      pool: {
        reserveTRX: poolState?.reserveTRX || 0,
        reserveCHIP: poolState?.reserveCHIP || 0,
        totalLiquidity: poolState?.totalLiquidity || 0
      },
      price: {
        current: price?.price || 0,
        twap1h: twap?.price || 0
      },
      health: this.lastHealthCheck
    };
  }
}

module.exports = AMMMonitor;
