# 测试方案：锦标赛、NFT、CHIP、DAO

## 测试架构概览

```
tests/
├── unit/                          # 单元测试
│   ├── contracts/                 # 合约单元测试
│   │   ├── Tournament.test.js
│   │   ├── AchievementNFT.test.js
│   │   ├── ChipToken.test.js
│   │   ├── Staking.test.js
│   │   └── Governance.test.js
│   └── services/                  # 服务单元测试
│       ├── TournamentService.test.js
│       ├── NFTService.test.js
│       ├── ChipService.test.js
│       └── DAOService.test.js
│
├── integration/                   # 集成测试
│   ├── tournament.flow.test.js
│   ├── nft.mint.test.js
│   ├── staking.reward.test.js
│   └── dao.voting.test.js
│
├── e2e/                           # 端对端测试
│   ├── tournament.spec.js
│   ├── nft-gallery.spec.js
│   ├── chip-wallet.spec.js
│   ├── dao-governance.spec.js
│   └── blockchain-flow.spec.js    # 现有
│
├── mock/                          # 模拟数据
│   ├── poker-hands.js             # NFT牌型数据
│   ├── players.js                 # 模拟玩家
│   └── contracts.js               # Mock合约
│
├── helpers/                       # 测试辅助工具
│   ├── bot-player.js              # 机器人玩家
│   ├── test-utils.js              # 工具函数
│   └── contract-mock.js           # 合约Mock
│
└── fixtures/                      # 测试固件
    ├── tournament-fixtures.js
    └── nft-fixtures.js
```

---

## 一、NFT牌型模拟数据

### 1.1 牌型成就配置

```javascript
// tests/mock/poker-hands.js

/**
 * NFT牌型模拟数据
 * 用于测试成就检测和NFT铸造功能
 */

const AchievementTypes = {
  ROYAL_FLUSH: {
    id: 1,
    name: 'Royal Flush',
    rarity: 'LEGENDARY',
    monthlyLimit: 5,
    description: '皇家同花顺'
  },
  STRAIGHT_FLUSH: {
    id: 2,
    name: 'Straight Flush',
    rarity: 'EPIC',
    monthlyLimit: 10,
    description: '同花顺'
  },
  FOUR_OF_A_KIND: {
    id: 3,
    name: 'Four of a Kind',
    rarity: 'RARE',
    monthlyLimit: 50,
    description: '四条'
  },
  FULL_HOUSE: {
    id: 4,
    name: 'Full House',
    rarity: 'RARE',
    monthlyLimit: 100,
    description: '葫芦'
  },
  FLUSH: {
    id: 5,
    name: 'Flush',
    rarity: 'COMMON',
    monthlyLimit: 200,
    description: '同花'
  },
  STRAIGHT: {
    id: 6,
    name: 'Straight',
    rarity: 'COMMON',
    monthlyLimit: 300,
    description: '顺子'
  }
};

/**
 * 完整牌型测试数据
 * 每个牌型包含：玩家手牌、公共牌、预期结果
 */
const PokerHandTestData = {
  // ==================== 皇家同花顺 ====================
  royal_flush: [
    {
      name: '红桃皇家同花顺',
      holeCards: ['Ah', 'Kh'],  // 手牌
      board: ['Qh', 'Jh', 'Th', '2c', '3d'],  // 公共牌
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 红桃皇家同花顺'
    },
    {
      name: '黑桃皇家同花顺',
      holeCards: ['As', 'Ks'],
      board: ['Qs', 'Js', 'Ts', '4c', '5d'],
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 黑桃皇家同花顺'
    },
    {
      name: '梅花皇家同花顺',
      holeCards: ['Ac', 'Kc'],
      board: ['Qc', 'Jc', 'Tc', '6h', '7d'],
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 梅花皇家同花顺'
    },
    {
      name: '方块皇家同花顺',
      holeCards: ['Ad', 'Kd'],
      board: ['Qd', 'Jd', 'Td', '8h', '9s'],
      expectedType: 'ROYAL_FLUSH',
      description: 'A-K-Q-J-10 方块皇家同花顺'
    }
  ],

  // ==================== 同花顺 ====================
  straight_flush: [
    {
      name: '红桃9高同花顺',
      holeCards: ['5h', '6h'],
      board: ['7h', '8h', '9h', '2c', '3d'],
      expectedType: 'STRAIGHT_FLUSH',
      description: '5-6-7-8-9 红桃同花顺'
    },
    {
      name: '黑桃K高同花顺',
      holeCards: ['9s', 'Ts'],
      board: ['Js', 'Qs', 'Ks', '2c', '3d'],
      expectedType: 'STRAIGHT_FLUSH',
      description: '9-T-J-Q-K 黑桃同花顺'
    },
    {
      name: '梅花6高同花顺',
      holeCards: ['2c', '3c'],
      board: ['4c', '5c', '6c', 'Kh', 'Ad'],
      expectedType: 'STRAIGHT_FLUSH',
      description: '2-3-4-5-6 梅花同花顺'
    },
    {
      name: '车轮同花顺(A-2-3-4-5)',
      holeCards: ['Ad', '2d'],
      board: ['3d', '4d', '5d', 'Kh', 'Qs'],
      expectedType: 'STRAIGHT_FLUSH',
      description: 'A-2-3-4-5 方块同花顺(最小)'
    }
  ],

  // ==================== 四条 ====================
  four_of_a_kind: [
    {
      name: '四条A',
      holeCards: ['Ah', 'Ad'],
      board: ['As', 'Ac', 'Kh', '2c', '3d'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条A + K踢脚'
    },
    {
      name: '四条K',
      holeCards: ['Kh', 'Kd'],
      board: ['Ks', 'Kc', 'Ah', '2c', '3d'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条K + A踢脚'
    },
    {
      name: '四条2',
      holeCards: ['2h', '2d'],
      board: ['2s', '2c', 'Ah', 'Kc', 'Qd'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条2 + A踢脚(最小四条)'
    },
    {
      name: '四条J',
      holeCards: ['Jh', 'Jd'],
      board: ['Js', 'Jc', 'Ah', 'Kc', 'Qd'],
      expectedType: 'FOUR_OF_A_KIND',
      description: '四条J + A踢脚'
    }
  ],

  // ==================== 葫芦 ====================
  full_house: [
    {
      name: 'A葫芦K',
      holeCards: ['Ah', 'Ad'],
      board: ['As', 'Kh', 'Kc', '2c', '3d'],
      expectedType: 'FULL_HOUSE',
      description: '三条A + 对子K'
    },
    {
      name: 'K葫芦Q',
      holeCards: ['Kh', 'Kd'],
      board: ['Ks', 'Qh', 'Qc', '2c', '3d'],
      expectedType: 'FULL_HOUSE',
      description: '三条K + 对子Q'
    },
    {
      name: '2葫芦3',
      holeCards: ['2h', '2d'],
      board: ['2s', '3h', '3c', 'Ac', 'Kd'],
      expectedType: 'FULL_HOUSE',
      description: '三条2 + 对子3(最小葫芦)'
    },
    {
      name: 'J葫芦T',
      holeCards: ['Jh', 'Jd'],
      board: ['Js', 'Th', 'Tc', 'Ac', 'Kd'],
      expectedType: 'FULL_HOUSE',
      description: '三条J + 对子T'
    }
  ],

  // ==================== 同花 ====================
  flush: [
    {
      name: '红桃A高同花',
      holeCards: ['Ah', '2h'],
      board: ['5h', '7h', '9h', 'Kc', 'Qd'],
      expectedType: 'FLUSH',
      description: 'A-9-7-5-2 红桃同花'
    },
    {
      name: '黑桃K高同花',
      holeCards: ['Ks', '2s'],
      board: ['4s', '6s', '8s', 'Ah', 'Qd'],
      expectedType: 'FLUSH',
      description: 'K-8-6-4-2 黑桃同花'
    },
    {
      name: '梅花Q高同花',
      holeCards: ['Qc', '3c'],
      board: ['5c', '7c', 'Tc', 'Kh', 'Ad'],
      expectedType: 'FLUSH',
      description: 'Q-T-7-5-3 梅花同花'
    },
    {
      name: '方块J高同花',
      holeCards: ['Jd', '4d'],
      board: ['6d', '8d', 'Td', 'Ah', 'Ks'],
      expectedType: 'FLUSH',
      description: 'J-T-8-6-4 方块同花'
    }
  ],

  // ==================== 顺子 ====================
  straight: [
    {
      name: 'A高顺子',
      holeCards: ['Ah', 'Kh'],
      board: ['Qc', 'Jd', 'Ts', '2c', '3d'],
      expectedType: 'STRAIGHT',
      description: 'A-K-Q-J-T 顺子'
    },
    {
      name: '车轮顺子(A-2-3-4-5)',
      holeCards: ['Ah', '2h'],
      board: ['3c', '4d', '5s', 'Kc', 'Qd'],
      expectedType: 'STRAIGHT',
      description: 'A-2-3-4-5 最小顺子'
    },
    {
      name: '9高顺子',
      holeCards: ['5h', '6h'],
      board: ['7c', '8d', '9s', 'Kc', 'Ad'],
      expectedType: 'STRAIGHT',
      description: '5-6-7-8-9 顺子'
    },
    {
      name: 'K高顺子',
      holeCards: ['9h', 'Th'],
      board: ['Jc', 'Qd', 'Ks', '2c', '3d'],
      expectedType: 'STRAIGHT',
      description: '9-T-J-Q-K 顺子'
    }
  ],

  // ==================== 非成就牌型(用于负向测试) ====================
  non_achievement: [
    {
      name: '三条(非成就)',
      holeCards: ['Ah', 'Ad'],
      board: ['As', 'Kc', 'Qd', '2c', '3d'],
      expectedType: null,  // 不应触发NFT
      description: '三条A，不属于成就牌型'
    },
    {
      name: '两对(非成就)',
      holeCards: ['Ah', 'Ad'],
      board: ['Kc', 'Kd', 'Qs', '2c', '3d'],
      expectedType: null,
      description: '两对A-K，不属于成就牌型'
    },
    {
      name: '一对(非成就)',
      holeCards: ['Ah', 'Ad'],
      board: ['Kc', 'Qd', 'Js', '2c', '3d'],
      expectedType: null,
      description: '一对A，不属于成就牌型'
    },
    {
      name: '高牌(非成就)',
      holeCards: ['Ah', 'Kd'],
      board: ['Qc', 'Js', '9d', '2c', '3d'],
      expectedType: null,
      description: '高牌A-K，不属于成就牌型'
    }
  ]
};

/**
 * 扑克牌编码说明
 * s = Spades (黑桃)
 * h = Hearts (红桃)
 * d = Diamonds (方块)
 * c = Clubs (梅花)
 * 
 * A = Ace, K = King, Q = Queen, J = Jack
 * T = Ten (10)
 * 2-9 = 对应数字
 */

module.exports = {
  AchievementTypes,
  PokerHandTestData
};
```

### 1.2 NFT铸造测试用例

```javascript
// tests/integration/nft.mint.test.js

const { expect } = require('chai');
const { PokerHandTestData, AchievementTypes } = require('../mock/poker-hands');
const NFTService = require('../../server/services/NFTService');

describe('NFT Minting Integration Tests', () => {
  let nftService;
  let mockContract;

  beforeEach(() => {
    mockContract = createMockNFTContract();
    nftService = new NFTService(mockContract);
  });

  describe('牌型检测', () => {
    // 正向测试：所有成就牌型
    Object.entries(PokerHandTestData).forEach(([category, testCases]) => {
      if (category === 'non_achievement') return;
      
      describe(`${category} 牌型检测`, () => {
        testCases.forEach(testCase => {
          it(`应该正确检测 ${testCase.name}`, () => {
            const result = nftService.checkAchievement(
              testCase.holeCards,
              testCase.board
            );
            
            expect(result).to.not.be.null;
            expect(result.type).to.equal(testCase.expectedType);
            expect(result.description).to.equal(testCase.description);
          });
        });
      });
    });

    // 负向测试：非成就牌型
    describe('非成就牌型', () => {
      PokerHandTestData.non_achievement.forEach(testCase => {
        it(`不应触发NFT: ${testCase.name}`, () => {
          const result = nftService.checkAchievement(
            testCase.holeCards,
            testCase.board
          );
          
          expect(result).to.be.null;
        });
      });
    });
  });

  describe('月度限量机制', () => {
    it('应该在限量内允许铸造', async () => {
      // 设置月度剩余数量
      mockContract.getMonthlyRemaining.returns(10);
      
      const canMint = await nftService.canMintNFT(1); // Royal Flush
      
      expect(canMint).to.be.true;
    });

    it('应该在耗尽限量后拒绝铸造', async () => {
      mockContract.getMonthlyRemaining.returns(0);
      
      const canMint = await nftService.canMintNFT(1);
      
      expect(canMint).to.be.false;
    });
  });

  describe('签名验证', () => {
    it('应该正确生成铸造签名', async () => {
      const player = 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b';
      const achievementType = 3; // Four of a Kind
      
      const signature = await nftService.generateMintSignature(
        player,
        achievementType
      );
      
      expect(signature).to.have.property('v');
      expect(signature).to.have.property('r');
      expect(signature).to.have.property('s');
      expect(signature).to.have.property('deadline');
    });

    it('应该拒绝过期签名', async () => {
      const expiredSignature = {
        v: 27,
        r: '0x...',
        s: '0x...',
        deadline: Date.now() - 1000 // 1秒前过期
      };
      
      const isValid = nftService.verifySignature(expiredSignature);
      
      expect(isValid).to.be.false;
    });

    it('应该拒绝重放签名', async () => {
      const signature = await nftService.generateMintSignature(
        'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        3
      );
      
      // 第一次使用
      const result1 = await nftService.claimWithSignature(signature);
      expect(result1.success).to.be.true;
      
      // 重放攻击
      const result2 = await nftService.claimWithSignature(signature);
      expect(result2.success).to.be.false;
      expect(result2.error).to.include('already used');
    });
  });
});
```

---

## 二、模拟多人游戏机器人

### 2.1 机器人玩家实现

```javascript
// tests/helpers/bot-player.js

const WebSocket = require('ws');
const { EventEmitter } = require('events');

/**
 * 机器人玩家 - 用于自动化测试
 * 可模拟真实玩家行为，无需人工介入
 */
class BotPlayer extends EventEmitter {
  constructor(config) {
    super();
    
    this.id = config.id || `bot_${Date.now()}`;
    this.name = config.name || `Bot_${this.id}`;
    this.address = config.address || this.generateMockAddress();
    this.socket = null;
    this.connected = false;
    
    // 游戏状态
    this.currentTable = null;
    this.seatId = null;
    this.stack = 0;
    this.cards = [];
    this.isMyTurn = false;
    
    // 行为配置
    this.strategy = config.strategy || 'random'; // random, aggressive, passive, optimal
    this.actionDelay = config.actionDelay || 500; // 思考时间
    this.autoReconnect = config.autoReconnect !== false;
  }

  /**
   * 生成模拟钱包地址
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
      this.socket = new WebSocket(serverUrl);
      
      this.socket.on('open', () => {
        this.connected = true;
        this.emit('connected');
        
        // 发送认证
        this.send('auth', {
          address: this.address,
          signature: 'mock_signature_for_test'
        });
        
        resolve();
      });

      this.socket.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        
        if (this.autoReconnect) {
          setTimeout(() => this.connect(serverUrl), 1000);
        }
      });

      this.socket.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * 处理服务器消息
   */
  handleMessage(message) {
    const { event, data } = message;

    switch (event) {
      case 'auth_success':
        this.emit('auth_success', data);
        break;

      case 'joined_table':
        this.currentTable = data.tableId;
        this.seatId = data.seatId;
        this.stack = data.stack;
        this.emit('joined', data);
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

      case 'hand_result':
        this.emit('hand_result', data);
        break;

      case 'nft_achievement':
        this.emit('nft_achievement', data);
        break;

      case 'tournament_started':
        this.emit('tournament_started', data);
        break;

      case 'tournament_ended':
        this.emit('tournament_ended', data);
        break;

      case 'player_eliminated':
        this.emit('player_eliminated', data);
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
    this.isMyTurn = data.turn === this.seatId;
  }

  /**
   * 自动行动（根据策略）
   */
  async autoAction(data) {
    await this.delay(this.actionDelay);

    const action = this.decideAction(data);
    
    this.send('game_action', action);
    this.isMyTurn = false;
  }

  /**
   * 决策行动
   */
  decideAction(data) {
    const { callAmount, minRaise, canRaise, canCheck } = data;
    const random = Math.random();

    switch (this.strategy) {
      case 'aggressive':
        // 激进策略：优先加注
        if (canRaise && this.stack > minRaise * 3) {
          return { action: 'raise', amount: minRaise * 3 };
        }
        return { action: 'call', amount: callAmount };

      case 'passive':
        // 被动策略：优先过牌/跟注
        if (canCheck) {
          return { action: 'check' };
        }
        return { action: 'call', amount: callAmount };

      case 'optimal':
        // 最优策略：基于手牌强度（简化版）
        const handStrength = this.evaluateHand();
        if (handStrength > 0.8 && canRaise) {
          return { action: 'raise', amount: minRaise * 2 };
        } else if (handStrength > 0.5 || canCheck) {
          return canCheck ? { action: 'check' } : { action: 'call', amount: callAmount };
        } else {
          return { action: 'fold' };
        }

      case 'random':
      default:
        // 随机策略
        if (canCheck && random < 0.7) {
          return { action: 'check' };
        }
        if (canRaise && random < 0.3 && this.stack > minRaise * 2) {
          return { action: 'raise', amount: minRaise * 2 };
        }
        if (random < 0.8) {
          return { action: 'call', amount: callAmount };
        }
        return { action: 'fold' };
    }
  }

  /**
   * 简化手牌评估
   */
  evaluateHand() {
    if (!this.cards || this.cards.length < 2) return 0.5;
    
    // 简化评分：基于牌面大小
    const ranks = this.cards.map(c => {
      const r = c.rank;
      if (r === 'A') return 14;
      if (r === 'K') return 13;
      if (r === 'Q') return 12;
      if (r === 'J') return 11;
      return parseInt(r);
    });
    
    const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    const isPair = ranks[0] === ranks[1];
    
    let score = avgRank / 14;
    if (isPair) score += 0.3;
    
    return Math.min(score, 1);
  }

  /**
   * 发送消息
   */
  send(event, data) {
    if (!this.connected) return;
    
    this.socket.send(JSON.stringify({ event, data }));
  }

  /**
   * 加入桌子
   */
  joinTable(tableId, seatId, buyIn) {
    this.send('join_table', {
      tableId,
      seatId,
      buyIn
    });
  }

  /**
   * 加入锦标赛
   */
  joinTournament(tournamentId) {
    this.send('join_tournament', {
      tournamentId
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
    }
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 机器人管理器 - 管理多个机器人玩家
 */
class BotManager {
  constructor() {
    this.bots = new Map();
  }

  /**
   * 创建机器人
   */
  createBot(config = {}) {
    const bot = new BotPlayer(config);
    this.bots.set(bot.id, bot);
    return bot;
  }

  /**
   * 创建多个机器人
   */
  createBots(count, baseConfig = {}) {
    const bots = [];
    for (let i = 0; i < count; i++) {
      const bot = this.createBot({
        ...baseConfig,
        id: `bot_${i}`,
        name: `Bot_${i + 1}`
      });
      bots.push(bot);
    }
    return bots;
  }

  /**
   * 批量连接
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
  async joinTable(tableId, buyIn) {
    const seatIds = [1, 2, 3, 4, 5, 6];
    const promises = [];
    let seatIndex = 0;
    
    this.bots.forEach(bot => {
      const seatId = seatIds[seatIndex++ % seatIds.length];
      promises.push(
        new Promise(resolve => {
          bot.once('joined', resolve);
          bot.joinTable(tableId, seatId, buyIn);
        })
      );
    });
    
    await Promise.all(promises);
  }

  /**
   * 批量加入锦标赛
   */
  async joinTournament(tournamentId) {
    const promises = [];
    this.bots.forEach(bot => {
      promises.push(
        new Promise(resolve => {
          bot.once('joined', resolve);
          bot.joinTournament(tournamentId);
        })
      );
    });
    await Promise.all(promises);
  }

  /**
   * 断开所有机器人
   */
  disconnectAll() {
    this.bots.forEach(bot => bot.disconnect());
    this.bots.clear();
  }

  /**
   * 等待游戏结束
   */
  async waitForGameEnd(timeout = 60000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Game end timeout'));
      }, timeout);

      let endedCount = 0;
      this.bots.forEach(bot => {
        bot.once('hand_result', () => {
          endedCount++;
          if (endedCount === this.bots.size) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    });
  }
}

module.exports = { BotPlayer, BotManager };
```

### 2.2 多人游戏测试用例

```javascript
// tests/integration/multiplayer.test.js

const { expect } = require('chai');
const { BotManager } = require('../helpers/bot-player');

describe('多人游戏集成测试', () => {
  let botManager;
  const serverUrl = 'ws://localhost:3000';

  beforeEach(() => {
    botManager = new BotManager();
  });

  afterEach(() => {
    botManager.disconnectAll();
  });

  describe('2人游戏', () => {
    it('应该正确完成2人对局', async () => {
      // 创建2个机器人
      const bots = botManager.createBots(2, {
        strategy: 'random',
        actionDelay: 200
      });

      // 连接服务器
      await botManager.connectAll(serverUrl);

      // 加入桌子
      await botManager.joinTable('test_table_2p', 1000);

      // 等待游戏结束
      await botManager.waitForGameEnd(30000);

      // 验证结果
      const results = bots.map(bot => bot.lastResult);
      expect(results.length).to.equal(2);
    });

    it('应该正确分配筹码', async () => {
      const bots = botManager.createBots(2);
      await botManager.connectAll(serverUrl);
      await botManager.joinTable('test_table_2p', 1000);

      await botManager.waitForGameEnd();

      // 总筹码应该守恒
      const totalStack = bots.reduce((sum, bot) => sum + bot.stack, 0);
      expect(totalStack).to.be.closeTo(2000, 5); // 允许抽水误差
    });
  });

  describe('6人满桌游戏', () => {
    it('应该正确处理6人满桌', async () => {
      const bots = botManager.createBots(6, {
        strategy: 'random',
        actionDelay: 300
      });

      await botManager.connectAll(serverUrl);
      await botManager.joinTable('test_table_6p', 1000);

      // 等待几手牌
      for (let i = 0; i < 3; i++) {
        await botManager.waitForGameEnd(60000);
      }

      // 验证所有机器人都有参与
      const allParticipated = bots.every(bot => bot.handsPlayed > 0);
      expect(allParticipated).to.be.true;
    });
  });

  describe('玩家断线处理', () => {
    it('断线玩家应该自动Fold', async () => {
      const bots = botManager.createBots(2);
      await botManager.connectAll(serverUrl);
      await botManager.joinTable('test_table_disconnect', 1000);

      // 一个机器人断线
      bots[0].disconnect();

      // 另一个机器人应该赢得底池
      await new Promise(resolve => {
        bots[1].once('hand_result', (result) => {
          expect(result.winners).to.include(bots[1].seatId);
          resolve();
        });
      });
    });
  });
});
```

---

## 三、端对端测试方案

### 3.1 锦标赛E2E测试

```javascript
// tests/e2e/tournament.spec.js

const { test, expect } = require('@playwright/test');
const { BotManager } = require('../helpers/bot-player');

test.describe('锦标赛系统 E2E测试', () => {
  let botManager;

  test.beforeEach(async ({ page }) => {
    botManager = new BotManager();
    await page.goto('/');
  });

  test.afterEach(() => {
    botManager.disconnectAll();
  });

  test('应该显示锦标赛大厅', async ({ page }) => {
    await page.goto('/tournament');
    
    // 检查锦标赛列表
    await expect(page.locator('.tournament-list')).toBeVisible();
    
    // 检查筛选器
    await expect(page.locator('.tournament-filter')).toBeVisible();
  });

  test('应该能创建和加入锦标赛', async ({ page }) => {
    // 模拟钱包连接
    await page.evaluate(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true
      };
    });

    await page.goto('/tournament');
    
    // 点击加入按钮
    const joinButton = page.locator('.tournament-join-btn').first();
    await joinButton.click();
    
    // 确认支付
    await expect(page.locator('.payment-confirm')).toBeVisible();
    await page.locator('.confirm-btn').click();
    
    // 等待加入成功
    await expect(page.locator('.waiting-room')).toBeVisible();
  });

  test('2人锦标赛完整流程', async ({ page }) => {
    // 创建2个机器人
    const bots = botManager.createBots(2, {
      strategy: 'random',
      actionDelay: 500
    });
    await botManager.connectAll('ws://localhost:3000');

    // 机器人加入锦标赛
    await botManager.joinTournament('test_tournament_2p');

    // 人类玩家通过UI加入
    await page.goto('/tournament/test_tournament_2p');
    await page.locator('.join-btn').click();
    await page.locator('.confirm-btn').click();

    // 等待锦标赛开始
    await expect(page.locator('.tournament-started')).toBeVisible({ timeout: 10000 });

    // 游戏进行中...
    await expect(page.locator('.game-table')).toBeVisible();

    // 等待锦标赛结束
    await expect(page.locator('.tournament-result')).toBeVisible({ timeout: 60000 });
  });

  test('6人锦标赛完整流程', async ({ page }) => {
    // 创建6个机器人
    const bots = botManager.createBots(6, {
      strategy: 'random',
      actionDelay: 400
    });
    await botManager.connectAll('ws://localhost:3000');

    // 批量加入
    await botManager.joinTournament('test_tournament_6p');

    // 等待锦标赛完成
    const results = await Promise.race([
      // 等待任一机器人获得第一名
      new Promise(resolve => {
        bots.forEach(bot => {
          bot.once('tournament_ended', (data) => {
            if (data.finalPosition === 1) {
              resolve({ winner: bot.id });
            }
          });
        });
      }),
      // 超时
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tournament timeout')), 120000)
      )
    ]);

    expect(results.winner).to.exist;
  });

  test('锦标赛奖金分配正确', async ({ page }) => {
    const bots = botManager.createBots(3);
    await botManager.connectAll('ws://localhost:3000');
    await botManager.joinTournament('test_tournament_prize');

    // 等待锦标赛结束
    const results = await new Promise(resolve => {
      const finalResults = [];
      bots.forEach(bot => {
        bot.once('tournament_ended', (data) => {
          finalResults.push({
            bot: bot.id,
            position: data.finalPosition,
            prize: data.prize
          });
          if (finalResults.length === 3) {
            resolve(finalResults);
          }
        });
      });
    });

    // 验证奖金分配
    const buyIn = 100;
    const totalPrize = buyIn * 3 * 0.95; // 5% 抽水
    
    const first = results.find(r => r.position === 1);
    const second = results.find(r => r.position === 2);
    
    // 第一名应得70%
    expect(first.prize).toBeCloseTo(totalPrize * 0.7, 1);
    // 第二名应得30%
    expect(second.prize).toBeCloseTo(totalPrize * 0.3, 1);
  });
});

test.describe('锦标赛后台管理', () => {
  test('管理员能创建锦标赛配置', async ({ page }) => {
    // 模拟管理员登录
    await page.addInitScript(() => {
      window.localStorage.setItem('isAdmin', 'true');
      window.localStorage.setItem('adminAddress', 'ADMIN_ADDRESS');
    });

    await page.goto('/admin/tournament');
    
    // 创建新配置
    await page.locator('.create-config-btn').click();
    
    await page.locator('#playerCount').fill('2');
    await page.locator('#buyIn').fill('100');
    await page.locator('#initialChips').fill('1000');
    
    await page.locator('.save-btn').click();
    
    // 验证创建成功
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

### 3.2 NFT画廊E2E测试

```javascript
// tests/e2e/nft-gallery.spec.js

const { test, expect } = require('@playwright/test');

test.describe('NFT画廊 E2E测试', () => {
  test('应该显示用户NFT列表', async ({ page }) => {
    // 模拟钱包连接
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true
      };
    });

    await page.goto('/nft');
    
    // 检查NFT列表
    await expect(page.locator('.nft-gallery')).toBeVisible();
  });

  test('应该显示NFT详情', async ({ page }) => {
    await page.goto('/nft');
    
    // 点击第一个NFT
    const nftCard = page.locator('.nft-card').first();
    await nftCard.click();
    
    // 验证详情弹窗
    await expect(page.locator('.nft-detail-modal')).toBeVisible();
    await expect(page.locator('.nft-rarity')).toBeVisible();
    await expect(page.locator('.nft-achievement-type')).toBeVisible();
  });

  test('应该能铸造新NFT', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true
      };
    });

    await page.goto('/nft/mint');
    
    // 选择成就类型
    await page.locator('.achievement-option[data-type="straight"]').click();
    
    // 点击铸造
    await page.locator('.mint-btn').click();
    
    // 确认支付
    await page.locator('.confirm-payment').click();
    
    // 等待铸造成功
    await expect(page.locator('.mint-success')).toBeVisible({ timeout: 30000 });
  });

  test('应该显示月度限量进度', async ({ page }) => {
    await page.goto('/nft');
    
    // 检查限量显示
    const limitIndicator = page.locator('.monthly-limit');
    await expect(limitIndicator).toBeVisible();
    
    // 应该显示剩余数量
    await expect(limitIndicator).toContainText(/剩余/);
  });
});
```

### 3.3 CHIP钱包E2E测试

```javascript
// tests/e2e/chip-wallet.spec.js

const { test, expect } = require('@playwright/test');

test.describe('CHIP钱包 E2E测试', () => {
  test('应该显示CHIP余额', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true,
        chipBalance: 1000
      };
    });

    await page.goto('/wallet');
    
    await expect(page.locator('.chip-balance')).toBeVisible();
    await expect(page.locator('.chip-balance')).toContainText('1,000');
  });

  test('应该能质押CHIP', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true,
        chipBalance: 1000
      };
    });

    await page.goto('/wallet/stake');
    
    // 输入质押金额
    await page.locator('#stakeAmount').fill('100');
    
    // 选择锁定期
    await page.locator('#lockDuration').selectOption('30');
    
    // 确认质押
    await page.locator('.stake-btn').click();
    await page.locator('.confirm-btn').click();
    
    // 等待成功
    await expect(page.locator('.stake-success')).toBeVisible({ timeout: 30000 });
  });

  test('应该显示VIP状态', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true,
        stakedAmount: 10000 // VIP门槛
      };
    });

    await page.goto('/wallet');
    
    // 检查VIP徽章
    await expect(page.locator('.vip-badge')).toBeVisible();
    
    // 检查VIP特权说明
    await expect(page.locator('.vip-benefits')).toBeVisible();
  });

  test('应该能领取质押奖励', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true,
        pendingReward: 50
      };
    });

    await page.goto('/wallet');
    
    // 检查待领取奖励
    await expect(page.locator('.pending-reward')).toContainText('50');
    
    // 领取奖励
    await page.locator('.claim-reward-btn').click();
    
    // 确认
    await page.locator('.confirm-btn').click();
    
    // 等待成功
    await expect(page.locator('.claim-success')).toBeVisible({ timeout: 30000 });
  });
});
```

### 3.4 DAO治理E2E测试

```javascript
// tests/e2e/dao-governance.spec.js

const { test, expect } = require('@playwright/test');

test.describe('DAO治理 E2E测试', () => {
  test('应该显示提案列表', async ({ page }) => {
    await page.goto('/dao');
    
    await expect(page.locator('.proposal-list')).toBeVisible();
    
    // 应该有状态筛选
    await expect(page.locator('.status-filter')).toBeVisible();
  });

  test('应该能创建提案', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true,
        chipBalance: 1000 // 超过提案门槛
      };
    });

    await page.goto('/dao/create');
    
    // 选择提案类型
    await page.locator('#proposalType').selectOption('RAKE_RATE');
    
    // 输入描述
    await page.locator('#description').fill('建议将抽水比例从5%降低到3%');
    
    // 输入新参数
    await page.locator('#newRate').fill('300'); // 3%
    
    // 提交
    await page.locator('.submit-btn').click();
    
    // 等待成功
    await expect(page.locator('.proposal-created')).toBeVisible({ timeout: 30000 });
  });

  test('应该能投票', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
        connected: true,
        chipBalance: 500
      };
    });

    await page.goto('/dao/proposal/1');
    
    // 检查提案详情
    await expect(page.locator('.proposal-detail')).toBeVisible();
    
    // 投票
    await page.locator('.vote-for-btn').click();
    
    // 确认
    await page.locator('.confirm-vote').click();
    
    // 等待成功
    await expect(page.locator('.vote-success')).toBeVisible({ timeout: 30000 });
  });

  test('应该显示投票进度', async ({ page }) => {
    await page.goto('/dao/proposal/1');
    
    // 检查投票进度条
    await expect(page.locator('.vote-progress')).toBeVisible();
    
    // 检查法定人数进度
    await expect(page.locator('.quorum-progress')).toBeVisible();
    
    // 检查投票数
    await expect(page.locator('.vote-count')).toBeVisible();
  });
});
```

---

## 四、API接口测试

### 4.1 锦标赛API测试

```javascript
// tests/api/tournament.api.test.js

const request = require('supertest');
const app = require('../../server/server');

describe('锦标赛 API', () => {
  
  describe('GET /api/tournament', () => {
    it('应该返回锦标赛列表', async () => {
      const res = await request(app)
        .get('/api/tournament')
        .expect(200);
      
      expect(res.body).to.have.property('tournaments');
      expect(res.body.tournaments).to.be.an('array');
    });

    it('应该支持状态筛选', async () => {
      const res = await request(app)
        .get('/api/tournament?status=WAITING')
        .expect(200);
      
      res.body.tournaments.forEach(t => {
        expect(t.status).to.equal('WAITING');
      });
    });
  });

  describe('GET /api/tournament/:id', () => {
    it('应该返回锦标赛详情', async () => {
      const res = await request(app)
        .get('/api/tournament/test_tournament_1')
        .expect(200);
      
      expect(res.body).to.have.property('id');
      expect(res.body).to.have.property('config');
      expect(res.body).to.have.property('players');
    });

    it('不存在的锦标赛应返回404', async () => {
      await request(app)
        .get('/api/tournament/nonexistent')
        .expect(404);
    });
  });

  describe('POST /api/tournament/:id/join', () => {
    it('应该成功加入锦标赛', async () => {
      const res = await request(app)
        .post('/api/tournament/test_tournament_1/join')
        .set('Authorization', 'Bearer test_token')
        .send({ address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' })
        .expect(200);
      
      expect(res.body).to.have.property('success', true);
      expect(res.body).to.have.property('seatId');
    });

    it('未授权应返回401', async () => {
      await request(app)
        .post('/api/tournament/test_tournament_1/join')
        .send({ address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' })
        .expect(401);
    });

    it('已满的锦标赛应返回400', async () => {
      const res = await request(app)
        .post('/api/tournament/full_tournament/join')
        .set('Authorization', 'Bearer test_token')
        .send({ address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b' })
        .expect(400);
      
      expect(res.body.error).to.include('full');
    });
  });
});
```

### 4.2 NFT API测试

```javascript
// tests/api/nft.api.test.js

const request = require('supertest');
const app = require('../../server/server');

describe('NFT API', () => {
  
  describe('GET /api/nft/user/:address', () => {
    it('应该返回用户NFT列表', async () => {
      const res = await request(app)
        .get('/api/nft/user/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b')
        .expect(200);
      
      expect(res.body).to.have.property('nfts');
      expect(res.body.nfts).to.be.an('array');
    });
  });

  describe('POST /api/nft/mint-signature', () => {
    it('应该生成铸造签名', async () => {
      const res = await request(app)
        .post('/api/nft/mint-signature')
        .set('Authorization', 'Bearer test_token')
        .send({
          address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
          achievementType: 3, // Four of a Kind
          gameId: 'game_123'
        })
        .expect(200);
      
      expect(res.body).to.have.property('signature');
      expect(res.body.signature).to.have.property('v');
      expect(res.body.signature).to.have.property('r');
      expect(res.body.signature).to.have.property('s');
    });

    it('无效成就类型应返回400', async () => {
      await request(app)
        .post('/api/nft/mint-signature')
        .set('Authorization', 'Bearer test_token')
        .send({
          address: 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b',
          achievementType: 999, // 无效类型
          gameId: 'game_123'
        })
        .expect(400);
    });
  });

  describe('GET /api/nft/monthly-limit', () => {
    it('应该返回月度限量信息', async () => {
      const res = await request(app)
        .get('/api/nft/monthly-limit')
        .expect(200);
      
      expect(res.body).to.have.property('limits');
      expect(res.body.limits).to.be.an('object');
    });
  });
});
```

---

## 五、合约单元测试

### 5.1 Tournament合约测试

```javascript
// tests/unit/contracts/Tournament.test.js

const { expect } = require('chai');
const { deployContract, getAccounts, getBalance } = require('tronbox-test-helpers');

describe('Tournament 合约', () => {
  let tournament;
  let chipToken;
  let accounts;
  let owner;
  let server;
  let player1;
  let player2;

  before(async () => {
    accounts = await getAccounts();
    owner = accounts[0];
    server = accounts[1];
    player1 = accounts[2];
    player2 = accounts[3];

    // 部署CHIP代币
    chipToken = await deployContract('ChipToken', [owner, 1000000000]);
    
    // 部署锦标赛合约
    tournament = await deployContract('Tournament', [server, chipToken.address]);
  });

  describe('创建锦标赛', () => {
    it('管理员应该能创建锦标赛配置', async () => {
      const result = await tournament.createTournamentConfig(
        0, // SNG类型
        2, // 2人
        100, // buyIn
        500, // 5% rake
        [70, 30], // 奖金分配
        1000, // 初始筹码
        0, // 满员即开
        0,
        { from: owner }
      );

      expect(result).to.emit('TournamentConfigCreated');
    });

    it('非管理员不能创建配置', async () => {
      await expect(
        tournament.createTournamentConfig(0, 2, 100, 500, [70, 30], 1000, 0, 0, {
          from: player1
        })
      ).to.be.rejected;
    });
  });

  describe('加入锦标赛', () => {
    let tournamentId;

    beforeEach(async () => {
      const result = await tournament.createTournament(1, { from: server });
      tournamentId = result.logs[0].args.tournamentId;
    });

    it('玩家应该能加入锦标赛', async () => {
      const result = await tournament.joinTournament(tournamentId, {
        from: player1,
        value: 100
      });

      expect(result).to.emit('PlayerJoined');
      expect(result.logs[0].args.player).to.equal(player1);
    });

    it('买金不足应拒绝加入', async () => {
      await expect(
        tournament.joinTournament(tournamentId, {
          from: player1,
          value: 50 // 不足100
        })
      ).to.be.rejected;
    });

    it('已加入玩家不能重复加入', async () => {
      await tournament.joinTournament(tournamentId, {
        from: player1,
        value: 100
      });

      await expect(
        tournament.joinTournament(tournamentId, {
          from: player1,
          value: 100
        })
      ).to.be.rejected;
    });
  });

  describe('开始锦标赛', () => {
    it('服务器应该能开始锦标赛', async () => {
      // 创建并加入玩家
      const result = await tournament.createTournament(1, { from: server });
      const tournamentId = result.logs[0].args.tournamentId;

      await tournament.joinTournament(tournamentId, {
        from: player1,
        value: 100
      });
      await tournament.joinTournament(tournamentId, {
        from: player2,
        value: 100
      });

      // 开始
      const startResult = await tournament.startTournament(tournamentId, {
        from: server
      });

      expect(startResult).to.emit('TournamentStarted');
    });

    it('人满前不能开始', async () => {
      const result = await tournament.createTournament(1, { from: server });
      const tournamentId = result.logs[0].args.tournamentId;

      await tournament.joinTournament(tournamentId, {
        from: player1,
        value: 100
      });
      // 只加入1人，2人锦标赛不能开始

      await expect(
        tournament.startTournament(tournamentId, { from: server })
      ).to.be.rejected;
    });
  });

  describe('结束锦标赛', () => {
    it('应该正确分配奖金', async () => {
      // 准备锦标赛
      const result = await tournament.createTournament(1, { from: server });
      const tournamentId = result.logs[0].args.tournamentId;

      await tournament.joinTournament(tournamentId, {
        from: player1,
        value: 100
      });
      await tournament.joinTournament(tournamentId, {
        from: player2,
        value: 100
      });
      await tournament.startTournament(tournamentId, { from: server });

      // 结束锦标赛
      const endResult = await tournament.finishTournament(
        tournamentId,
        [player1, player2], // player1第一，player2第二
        { from: server }
      );

      expect(endResult).to.emit('TournamentFinished');

      // 验证奖金
      const prize1 = await tournament.getPrize(tournamentId, player1);
      const prize2 = await tournament.getPrize(tournamentId, player2);

      // 总奖池 = 100 * 2 * 0.95 = 190
      // 第一名 70% = 133
      // 第二名 30% = 57
      expect(prize1.toNumber()).to.be.closeTo(133, 1);
      expect(prize2.toNumber()).to.be.closeTo(57, 1);
    });
  });
});
```

---

## 六、测试执行脚本

### 6.1 运行所有测试

```bash
#!/bin/bash
# tests/run-all-tests.sh

echo "========== 开始测试 =========="

# 1. 单元测试
echo ">>> 运行单元测试..."
npm run test:unit

# 2. 集成测试
echo ">>> 运行集成测试..."
npm run test:integration

# 3. E2E测试
echo ">>> 运行E2E测试..."
npm run test:e2e

# 4. 合约测试
echo ">>> 运行合约测试..."
npm run test:contracts

echo "========== 测试完成 =========="
```

### 6.2 package.json 脚本

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "mocha tests/unit/**/*.test.js --timeout 10000",
    "test:integration": "mocha tests/integration/**/*.test.js --timeout 30000",
    "test:e2e": "playwright test tests/e2e",
    "test:contracts": "tronbox test tests/unit/contracts/*.test.js",
    "test:coverage": "nyc npm run test",
    "test:watch": "mocha tests/**/*.test.js --watch"
  }
}
```

---

## 七、测试覆盖率目标

| 模块 | 覆盖率目标 | 说明 |
|------|-----------|------|
| Tournament.sol | 90% | 核心资金逻辑 |
| AchievementNFT.sol | 90% | NFT铸造逻辑 |
| ChipToken.sol | 95% | 代币核心功能 |
| Staking.sol | 90% | 质押逻辑 |
| Governance.sol | 85% | 治理逻辑 |
| TournamentTable.js | 80% | 游戏逻辑 |
| 服务层 | 75% | 业务逻辑 |
| API端点 | 80% | 接口测试 |
| E2E流程 | 主要流程 | 关键用户路径 |
