/**
 * 机器人玩家 - 用于自动化多人游戏测试
 * 可模拟真实玩家行为，无需人工介入
 * 
 * 使用方法:
 * const { BotManager } = require('./tests/helpers/bot-player');
 * const manager = new BotManager();
 * const bots = manager.createBots(6, { strategy: 'random' });
 * await manager.connectAll('ws://localhost:3000');
 * await manager.joinTournament('tournament_123');
 */

const WebSocket = require('ws');
const { EventEmitter } = require('events');

/**
 * 单个机器人玩家
 */
class BotPlayer extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.id = config.id || `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = config.name || `Bot_${this.id.slice(-4)}`;
    this.address = config.address || this.generateMockAddress();
    this.socket = null;
    this.connected = false;
    
    // 游戏状态
    this.currentTable = null;
    this.currentTournament = null;
    this.seatId = null;
    this.stack = 0;
    this.cards = [];
    this.isMyTurn = false;
    this.pot = 0;
    
    // 统计数据
    this.stats = {
      handsPlayed: 0,
      handsWon: 0,
      totalBet: 0,
      biggestWin: 0,
      nftsEarned: 0
    };
    
    // 行为配置
    this.strategy = config.strategy || 'random'; // random, aggressive, passive, optimal
    this.actionDelay = config.actionDelay || 500; // 思考时间(ms)
    this.autoReconnect = config.autoReconnect !== false;
    this.verbose = config.verbose || false;
    
    // 等待队列
    this._pendingActions = new Map();
    this._actionId = 0;
  }

  /**
   * 生成模拟TRON地址
   */
  generateMockAddress() {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let address = 'T';
    for (let i = 0; i < 33; i++) {
      address += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return address;
  }

  /**
   * 连接到游戏服务器
   */
  async connect(serverUrl) {
    return new Promise((resolve, reject) => {
      this.log(`Connecting to ${serverUrl}...`);
      
      this.socket = new WebSocket(serverUrl);
      
      this.socket.on('open', () => {
        this.connected = true;
        this.log('Connected');
        this.emit('connected');
        
        // 发送认证
        this.send('auth', {
          address: this.address,
          signature: `mock_sig_${this.id}`,
          timestamp: Date.now()
        });
        
        // 等待认证成功
        this.once('auth_success', () => {
          resolve();
        });
        
        // 超时处理
        setTimeout(() => {
          if (!this._authSuccess) {
            resolve(); // 即使没收到auth_success也继续
          }
        }, 2000);
      });

      this.socket.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          this.log('Error parsing message:', err.message);
        }
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.log('Disconnected');
        this.emit('disconnected');
        
        if (this.autoReconnect && this._serverUrl) {
          setTimeout(() => this.connect(this._serverUrl), 2000);
        }
      });

      this.socket.on('error', (error) => {
        this.log('Socket error:', error.message);
        this.emit('error', error);
        reject(error);
      });

      this._serverUrl = serverUrl;
    });
  }

  /**
   * 处理服务器消息
   */
  handleMessage(message) {
    const { event, data, actionId } = message;

    this.log(`Received: ${event}`);

    // 处理等待中的action响应
    if (actionId && this._pendingActions.has(actionId)) {
      const { resolve } = this._pendingActions.get(actionId);
      this._pendingActions.delete(actionId);
      resolve(data);
    }

    switch (event) {
      case 'auth_success':
        this._authSuccess = true;
        this.emit('auth_success', data);
        break;

      case 'auth_failed':
        this.emit('auth_failed', data);
        break;

      case 'joined_table':
        this.currentTable = data.tableId;
        this.seatId = data.seatId;
        this.stack = data.stack;
        this.emit('joined', data);
        break;

      case 'joined_tournament':
        this.currentTournament = data.tournamentId;
        this.seatId = data.seatId;
        this.emit('joined_tournament', data);
        break;

      case 'game_state':
        this.updateGameState(data);
        this.emit('game_state', data);
        break;

      case 'your_turn':
        this.isMyTurn = true;
        this.emit('my_turn', data);
        this.autoAction(data);
        break;

      case 'hand_dealt':
        this.cards = data.cards || [];
        this.emit('hand_dealt', data);
        break;

      case 'hand_result':
        this.stats.handsPlayed++;
        if (data.winners && data.winners.includes(this.seatId)) {
          this.stats.handsWon++;
          if (data.winAmount > this.stats.biggestWin) {
            this.stats.biggestWin = data.winAmount;
          }
        }
        this.emit('hand_result', data);
        break;

      case 'nft_achievement':
        this.stats.nftsEarned++;
        this.emit('nft_achievement', data);
        break;

      case 'tournament_started':
        this.emit('tournament_started', data);
        break;

      case 'tournament_ended':
        this.emit('tournament_ended', data);
        break;

      case 'player_eliminated':
        if (data.playerId === this.seatId) {
          this.log('I was eliminated!');
        }
        this.emit('player_eliminated', data);
        break;

      case 'error':
        this.emit('error', new Error(data.message));
        break;

      case 'action_result':
        // 行动结果
        break;
    }
  }

  /**
   * 更新游戏状态
   */
  updateGameState(data) {
    if (data.cards) {
      this.cards = data.cards;
    }
    if (data.stack !== undefined) {
      this.stack = data.stack;
    }
    if (data.pot !== undefined) {
      this.pot = data.pot;
    }
    this.isMyTurn = data.turn === this.seatId || data.currentPlayer === this.seatId;
  }

  /**
   * 自动行动（根据策略）
   */
  async autoAction(data) {
    if (!this.isMyTurn) return;

    await this.delay(this.actionDelay + Math.random() * 200);

    const action = this.decideAction(data);
    this.log(`Action: ${action.action}${action.amount ? ' ' + action.amount : ''}`);
    
    await this.sendAction(action.action, action.amount);
    this.isMyTurn = false;
  }

  /**
   * 决策行动
   */
  decideAction(data) {
    const { callAmount = 0, minRaise = 0, canRaise = true, canCheck = true, pot = 0 } = data;
    const random = Math.random();

    switch (this.strategy) {
      case 'aggressive':
        // 激进策略：优先加注
        if (canRaise && this.stack > minRaise * 3) {
          const raiseAmount = Math.min(minRaise * (2 + Math.floor(random * 3)), this.stack);
          return { action: 'raise', amount: raiseAmount };
        }
        if (callAmount > 0) {
          return { action: 'call', amount: callAmount };
        }
        return { action: 'check' };

      case 'passive':
        // 被动策略：优先过牌/跟注，很少加注
        if (canCheck) {
          return { action: 'check' };
        }
        if (callAmount <= this.stack * 0.1) {
          return { action: 'call', amount: callAmount };
        }
        // 大额下注时考虑弃牌
        if (random < 0.3) {
          return { action: 'fold' };
        }
        return { action: 'call', amount: callAmount };

      case 'optimal':
        // 最优策略：基于手牌强度（简化版）
        return this.optimalDecision(data);

      case 'caller':
        // 跟注机器：只跟注或弃牌
        if (canCheck) {
          return { action: 'check' };
        }
        if (callAmount <= this.stack) {
          return { action: 'call', amount: callAmount };
        }
        return { action: 'fold' };

      case 'folder':
        // 弃牌机器：只过牌或弃牌
        if (canCheck) {
          return { action: 'check' };
        }
        return { action: 'fold' };

      case 'random':
      default:
        // 随机策略
        return this.randomDecision(data);
    }
  }

  /**
   * 随机决策
   */
  randomDecision(data) {
    const { callAmount = 0, minRaise = 0, canRaise = true, canCheck = true } = data;
    const random = Math.random();

    if (canCheck && random < 0.6) {
      return { action: 'check' };
    }
    if (canRaise && random < 0.25 && this.stack > minRaise * 2) {
      const raiseAmount = minRaise * (1 + Math.floor(Math.random() * 3));
      return { action: 'raise', amount: Math.min(raiseAmount, this.stack) };
    }
    if (random < 0.85 || callAmount === 0) {
      return canCheck ? { action: 'check' } : { action: 'call', amount: callAmount };
    }
    return { action: 'fold' };
  }

  /**
   * 最优决策（简化版）
   */
  optimalDecision(data) {
    const { callAmount = 0, minRaise = 0, canRaise = true, canCheck = true, pot = 0 } = data;
    const handStrength = this.evaluateHand();
    const potOdds = callAmount / (pot + callAmount);

    if (handStrength > 0.85) {
      // 超强牌：加注
      if (canRaise && this.stack > minRaise * 2) {
        return { action: 'raise', amount: minRaise * 3 };
      }
      return { action: 'call', amount: callAmount };
    } else if (handStrength > 0.65) {
      // 强牌：跟注或小加注
      if (canRaise && Math.random() < 0.4 && this.stack > minRaise * 2) {
        return { action: 'raise', amount: minRaise * 2 };
      }
      return { action: 'call', amount: callAmount };
    } else if (handStrength > 0.4) {
      // 中等牌：看情况
      if (canCheck) {
        return { action: 'check' };
      }
      if (potOdds < 0.3) {
        return { action: 'call', amount: callAmount };
      }
      return { action: 'fold' };
    } else {
      // 弱牌：谨慎
      if (canCheck) {
        return { action: 'check' };
      }
      // 偶尔诈唬
      if (Math.random() < 0.1 && canRaise) {
        return { action: 'raise', amount: minRaise * 2 };
      }
      return { action: 'fold' };
    }
  }

  /**
   * 简化手牌评估 (0-1)
   */
  evaluateHand() {
    if (!this.cards || this.cards.length < 2) return 0.5;
    
    // 简化评分：基于牌面大小和是否成对
    const ranks = this.cards.map(c => {
      const r = typeof c === 'string' ? c.slice(0, -1) : c.rank;
      if (r === 'A') return 14;
      if (r === 'K') return 13;
      if (r === 'Q') return 12;
      if (r === 'J') return 11;
      if (r === 'T' || r === '10') return 10;
      return parseInt(r);
    });
    
    const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    const isPair = ranks[0] === ranks[1];
    const isSuited = this.cards.length === 2 && 
      (typeof this.cards[0] === 'string' && this.cards[0][1] === this.cards[1][1]);
    
    let score = avgRank / 14;
    if (isPair) score += 0.3;
    if (isSuited) score += 0.1;
    if (ranks.includes(14)) score += 0.1; // 有A
    
    return Math.min(score, 1);
  }

  /**
   * 发送消息
   */
  send(event, data) {
    if (!this.connected || !this.socket) {
      this.log('Cannot send: not connected');
      return;
    }
    
    const message = JSON.stringify({ event, data });
    this.socket.send(message);
  }

  /**
   * 发送行动并等待响应
   */
  async sendAction(action, amount = 0) {
    return new Promise((resolve) => {
      const actionId = ++this._actionId;
      this._pendingActions.set(actionId, { resolve });
      
      this.send('game_action', { action, amount, actionId });
      
      // 超时处理
      setTimeout(() => {
        if (this._pendingActions.has(actionId)) {
          this._pendingActions.delete(actionId);
          resolve({ success: false, error: 'timeout' });
        }
      }, 5000);
    });
  }

  /**
   * 加入桌子
   */
  async joinTable(tableId, seatId, buyIn) {
    return new Promise((resolve) => {
      this.once('joined', (data) => {
        resolve(data);
      });
      
      this.send('join_table', {
        tableId,
        seatId,
        buyIn
      });
      
      // 超时
      setTimeout(() => resolve(null), 5000);
    });
  }

  /**
   * 加入锦标赛
   */
  async joinTournament(tournamentId) {
    return new Promise((resolve) => {
      this.once('joined_tournament', (data) => {
        resolve(data);
      });
      
      this.send('join_tournament', {
        tournamentId
      });
      
      // 超时
      setTimeout(() => resolve(null), 5000);
    });
  }

  /**
   * 离开桌子
   */
  leaveTable() {
    this.send('leave_table', {});
    this.currentTable = null;
    this.seatId = null;
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.autoReconnect = false;
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 日志输出
   */
  log(...args) {
    if (this.verbose) {
      console.log(`[${this.name}]`, ...args);
    }
  }

  /**
   * 获取状态摘要
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      address: this.address,
      connected: this.connected,
      currentTable: this.currentTable,
      currentTournament: this.currentTournament,
      seatId: this.seatId,
      stack: this.stack,
      cards: this.cards,
      stats: this.stats
    };
  }
}

/**
 * 机器人管理器 - 管理多个机器人玩家
 */
class BotManager {
  constructor() {
    this.bots = new Map();
    this.verbose = false;
  }

  /**
   * 创建单个机器人
   */
  createBot(config = {}) {
    const bot = new BotPlayer({
      ...config,
      verbose: config.verbose !== undefined ? config.verbose : this.verbose
    });
    this.bots.set(bot.id, bot);
    return bot;
  }

  /**
   * 批量创建机器人
   */
  createBots(count, baseConfig = {}) {
    const bots = [];
    for (let i = 0; i < count; i++) {
      const bot = this.createBot({
        ...baseConfig,
        id: `bot_${Date.now()}_${i}`,
        name: baseConfig.namePrefix ? `${baseConfig.namePrefix}_${i + 1}` : `Bot_${i + 1}`
      });
      bots.push(bot);
    }
    return bots;
  }

  /**
   * 获取机器人
   */
  getBot(id) {
    return this.bots.get(id);
  }

  /**
   * 获取所有机器人
   */
  getAllBots() {
    return Array.from(this.bots.values());
  }

  /**
   * 批量连接服务器
   */
  async connectAll(serverUrl) {
    const promises = [];
    this.bots.forEach(bot => {
      promises.push(bot.connect(serverUrl));
    });
    await Promise.all(promises);
  }

  /**
   * 批量加入桌子
   */
  async joinTable(tableId, buyIn, seatIds = null) {
    const defaultSeats = [1, 2, 3, 4, 5, 6];
    const seats = seatIds || defaultSeats;
    
    const promises = [];
    let seatIndex = 0;
    
    this.bots.forEach(bot => {
      const seatId = seats[seatIndex++ % seats.length];
      promises.push(bot.joinTable(tableId, seatId, buyIn));
    });
    
    return Promise.all(promises);
  }

  /**
   * 批量加入锦标赛
   */
  async joinTournament(tournamentId) {
    const promises = [];
    this.bots.forEach(bot => {
      promises.push(bot.joinTournament(tournamentId));
    });
    return Promise.all(promises);
  }

  /**
   * 等待所有机器人完成一手牌
   */
  async waitForHandEnd(timeout = 60000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Hand end timeout'));
      }, timeout);

      let finishedCount = 0;
      const total = this.bots.size;
      
      const checkDone = () => {
        finishedCount++;
        if (finishedCount >= total) {
          clearTimeout(timer);
          resolve();
        }
      };

      this.bots.forEach(bot => {
        bot.once('hand_result', checkDone);
      });
    });
  }

  /**
   * 等待锦标赛结束
   */
  async waitForTournamentEnd(timeout = 300000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Tournament end timeout'));
      }, timeout);

      // 任一机器人收到tournament_ended即算完成
      this.bots.forEach(bot => {
        bot.once('tournament_ended', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });
    });
  }

  /**
   * 等待NFT成就
   */
  async waitForNFTAchievement(timeout = 60000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('NFT achievement timeout'));
      }, timeout);

      this.bots.forEach(bot => {
        bot.once('nft_achievement', (data) => {
          clearTimeout(timer);
          resolve({ bot, data });
        });
      });
    });
  }

  /**
   * 批量断开连接
   */
  disconnectAll() {
    this.bots.forEach(bot => bot.disconnect());
    this.bots.clear();
  }

  /**
   * 获取所有机器人状态
   */
  getAllStatus() {
    const statuses = [];
    this.bots.forEach(bot => {
      statuses.push(bot.getStatus());
    });
    return statuses;
  }

  /**
   * 获取统计摘要
   */
  getStatsSummary() {
    let totalHands = 0;
    let totalWins = 0;
    let totalNFTs = 0;

    this.bots.forEach(bot => {
      totalHands += bot.stats.handsPlayed;
      totalWins += bot.stats.handsWon;
      totalNFTs += bot.stats.nftsEarned;
    });

    return {
      botCount: this.bots.size,
      totalHands,
      totalWins,
      winRate: totalHands > 0 ? (totalWins / totalHands * 100).toFixed(1) + '%' : '0%',
      totalNFTs
    };
  }

  /**
   * 设置日志级别
   */
  setVerbose(verbose) {
    this.verbose = verbose;
    this.bots.forEach(bot => {
      bot.verbose = verbose;
    });
  }
}

module.exports = { BotPlayer, BotManager };
