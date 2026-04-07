/**
 * AMM WebSocket Handler
 * Real-time price and event updates for DEX
 */

const AMM_SUBSCRIPTIONS = new Map(); // clientId -> Set of subscriptions
const PRICE_UPDATE_INTERVAL = 5000; // 5 seconds

class AMMWebSocketHandler {
  constructor(io, liquidityService, priceOracleService) {
    this.io = io;
    this.liquidityService = liquidityService;
    this.priceOracleService = priceOracleService;
    this.priceUpdateTimer = null;
    this.lastPrice = null;
  }

  /**
   * Initialize WebSocket handlers
   */
  init() {
    // Handle new connections
    this.io.on('connection', (socket) => {
      console.log(`[AMM WS] Client connected: ${socket.id}`);
      
      // Initialize subscription set for this client
      AMM_SUBSCRIPTIONS.set(socket.id, new Set());

      // Handle subscription requests
      socket.on('amm:subscribe', (data) => this.handleSubscribe(socket, data));
      
      // Handle unsubscription requests
      socket.on('amm:unsubscribe', (data) => this.handleUnsubscribe(socket, data));
      
      // Handle disconnect
      socket.on('disconnect', () => this.handleDisconnect(socket));
      
      // Handle price request
      socket.on('amm:getPrice', () => this.handleGetPrice(socket));
      
      // Handle pool info request
      socket.on('amm:getPoolInfo', () => this.handleGetPoolInfo(socket));
    });

    // Start price update loop
    this.startPriceUpdates();
  }

  /**
   * Handle subscription request
   */
  async handleSubscribe(socket, data) {
    const { channels = [] } = data;
    const subscriptions = AMM_SUBSCRIPTIONS.get(socket.id);
    
    for (const channel of channels) {
      switch (channel) {
        case 'price':
          subscriptions.add('price');
          socket.join('amm:price');
          // Send current price immediately
          const price = await this.getCurrentPrice();
          socket.emit('amm:price', price);
          break;
          
        case 'pool':
          subscriptions.add('pool');
          socket.join('amm:pool');
          const poolInfo = await this.getPoolInfo();
          socket.emit('amm:pool', poolInfo);
          break;
          
        case 'events':
          subscriptions.add('events');
          socket.join('amm:events');
          break;
          
        case 'liquidity':
          subscriptions.add('liquidity');
          socket.join('amm:liquidity');
          break;
          
        default:
          console.warn(`[AMM WS] Unknown channel: ${channel}`);
      }
    }
    
    console.log(`[AMM WS] Client ${socket.id} subscribed to:`, Array.from(subscriptions));
    socket.emit('amm:subscribed', { channels: Array.from(subscriptions) });
  }

  /**
   * Handle unsubscription request
   */
  handleUnsubscribe(socket, data) {
    const { channels = [] } = data;
    const subscriptions = AMM_SUBSCRIPTIONS.get(socket.id);
    
    for (const channel of channels) {
      subscriptions.delete(channel);
      socket.leave(`amm:${channel}`);
    }
    
    socket.emit('amm:unsubscribed', { channels });
  }

  /**
   * Handle disconnect
   */
  handleDisconnect(socket) {
    AMM_SUBSCRIPTIONS.delete(socket.id);
    console.log(`[AMM WS] Client disconnected: ${socket.id}`);
  }

  /**
   * Handle price request
   */
  async handleGetPrice(socket) {
    const price = await this.getCurrentPrice();
    socket.emit('amm:price', price);
  }

  /**
   * Handle pool info request
   */
  async handleGetPoolInfo(socket) {
    const poolInfo = await this.getPoolInfo();
    socket.emit('amm:pool', poolInfo);
  }

  /**
   * Get current price from oracle
   */
  async getCurrentPrice() {
    try {
      const price = await this.priceOracleService.getInstantPrice();
      return {
        price,
        timestamp: Date.now(),
        reserveTRX: price.reserveTRX,
        reserveCHIP: price.reserveCHIP
      };
    } catch (error) {
      console.error('[AMM WS] Error getting price:', error);
      return { error: 'Failed to get price', timestamp: Date.now() };
    }
  }

  /**
   * Get pool info
   */
  async getPoolInfo() {
    try {
      const state = await this.liquidityService.getPoolState();
      const price = await this.priceOracleService.getInstantPrice();
      
      return {
        reserveTRX: state.reserveTRX,
        reserveCHIP: state.reserveCHIP,
        totalLiquidity: state.totalLiquidity,
        price: price.price,
        volume24h: state.volume24h || 0,
        txCount24h: state.txCount24h || 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('[AMM WS] Error getting pool info:', error);
      return { error: 'Failed to get pool info', timestamp: Date.now() };
    }
  }

  /**
   * Start periodic price updates
   */
  startPriceUpdates() {
    if (this.priceUpdateTimer) {
      clearInterval(this.priceUpdateTimer);
    }
    
    this.priceUpdateTimer = setInterval(async () => {
      const price = await this.getCurrentPrice();
      
      // Only emit if price changed significantly
      if (!this.lastPrice || Math.abs(price.price - this.lastPrice.price) > 0.0001) {
        this.io.to('amm:price').emit('amm:price', price);
        this.lastPrice = price;
      }
    }, PRICE_UPDATE_INTERVAL);
  }

  /**
   * Stop price updates
   */
  stopPriceUpdates() {
    if (this.priceUpdateTimer) {
      clearInterval(this.priceUpdateTimer);
      this.priceUpdateTimer = null;
    }
  }

  /**
   * Broadcast swap event
   */
  broadcastSwap(event) {
    this.io.to('amm:events').emit('amm:swap', {
      type: 'swap',
      txHash: event.txHash,
      sender: event.sender,
      tokenIn: event.tokenIn,
      amountIn: event.amountIn,
      amountOut: event.amountOut,
      timestamp: event.timestamp || Date.now()
    });
  }

  /**
   * Broadcast liquidity add event
   */
  broadcastLiquidityAdd(event) {
    this.io.to('amm:liquidity').emit('amm:liquidityAdd', {
      type: 'add_liquidity',
      txHash: event.txHash,
      sender: event.sender,
      amountTRX: event.amountTRX,
      amountCHIP: event.amountCHIP,
      liquidity: event.liquidity,
      timestamp: event.timestamp || Date.now()
    });
  }

  /**
   * Broadcast liquidity remove event
   */
  broadcastLiquidityRemove(event) {
    this.io.to('amm:liquidity').emit('amm:liquidityRemove', {
      type: 'remove_liquidity',
      txHash: event.txHash,
      sender: event.sender,
      amountTRX: event.amountTRX,
      amountCHIP: event.amountCHIP,
      liquidity: event.liquidity,
      timestamp: event.timestamp || Date.now()
    });
  }

  /**
   * Broadcast pool state update
   */
  async broadcastPoolUpdate() {
    const poolInfo = await this.getPoolInfo();
    this.io.to('amm:pool').emit('amm:pool', poolInfo);
  }

  /**
   * Get connected clients count
   */
  getClientCount() {
    return AMM_SUBSCRIPTIONS.size;
  }

  /**
   * Get subscription stats
   */
  getStats() {
    const stats = {
      totalClients: AMM_SUBSCRIPTIONS.size,
      channels: {
        price: 0,
        pool: 0,
        events: 0,
        liquidity: 0
      }
    };
    
    for (const [, subs] of AMM_SUBSCRIPTIONS) {
      for (const channel of subs) {
        stats.channels[channel] = (stats.channels[channel] || 0) + 1;
      }
    }
    
    return stats;
  }
}

module.exports = AMMWebSocketHandler;
