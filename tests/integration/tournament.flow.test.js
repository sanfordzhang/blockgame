/**
 * 锦标赛完整流程集成测试
 * 使用机器人玩家模拟多人游戏
 */

const { expect } = require('chai');
const { BotManager, BotPlayer } = require('../helpers/bot-player');

// Mock Server for testing
class MockGameServer {
  constructor() {
    this.tables = new Map();
    this.tournaments = new Map();
    this.players = new Map();
    this.tournamentId = 0;
  }

  createTournament(config) {
    const id = `tournament_${++this.tournamentId}`;
    const tournament = {
      id,
      config,
      players: [],
      status: 'WAITING',
      prizePool: 0,
      startTime: null
    };
    this.tournaments.set(id, tournament);
    return tournament;
  }

  joinTournament(tournamentId, player) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) throw new Error('Tournament not found');
    if (tournament.status !== 'WAITING') throw new Error('Tournament already started');
    if (tournament.players.length >= tournament.config.maxPlayers) {
      throw new Error('Tournament full');
    }

    tournament.players.push(player);
    tournament.prizePool += tournament.config.buyIn;

    // 检查是否可以开始
    if (tournament.players.length >= tournament.config.minPlayers) {
      this.maybeStartTournament(tournamentId);
    }

    return { success: true, tournamentId, seatId: tournament.players.length };
  }

  maybeStartTournament(tournamentId) {
    const tournament = this.tournaments.get(tournamentId);
    // 模拟满员即开
    if (tournament.players.length === tournament.config.maxPlayers) {
      tournament.status = 'IN_PROGRESS';
      tournament.startTime = Date.now();
    }
  }

  simulateTournamentEnd(tournamentId, rankings) {
    const tournament = this.tournaments.get(tournamentId);
    tournament.status = 'COMPLETED';
    tournament.rankings = rankings;

    // 计算奖金分配
    const prizePool = tournament.prizePool * (1 - tournament.config.rakeRate / 10000);
    tournament.prizes = rankings.map((player, index) => ({
      player,
      prize: Math.floor(prizePool * tournament.config.prizeDistribution[index] / 100)
    }));

    return tournament;
  }
}

describe('锦标赛流程集成测试', function() {
  this.timeout(60000);

  let botManager;
  let mockServer;

  beforeEach(() => {
    botManager = new BotManager();
    mockServer = new MockGameServer();
  });

  afterEach(() => {
    botManager.disconnectAll();
  });

  // ==================== 2人锦标赛测试 ====================
  describe('2人锦标赛', () => {
    const tournamentConfig = {
      maxPlayers: 2,
      minPlayers: 2,
      buyIn: 100,
      rakeRate: 500, // 5%
      prizeDistribution: [70, 30],
      initialChips: 1000
    };

    it('应该成功创建锦标赛', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      
      expect(tournament.id).to.exist;
      expect(tournament.status).to.equal('WAITING');
    });

    it('2人应该能成功加入', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      
      // 创建2个机器人
      const bots = botManager.createBots(2, { strategy: 'random' });
      
      // 模拟加入
      const results = bots.map(bot => 
        mockServer.joinTournament(tournament.id, { id: bot.id, address: bot.address })
      );

      expect(results.every(r => r.success)).to.be.true;
      expect(mockServer.tournaments.get(tournament.id).players.length).to.equal(2);
    });

    it('满员后自动开始', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      const bots = botManager.createBots(2);
      
      bots.forEach(bot => {
        mockServer.joinTournament(tournament.id, { id: bot.id });
      });

      const updated = mockServer.tournaments.get(tournament.id);
      expect(updated.status).to.equal('IN_PROGRESS');
    });

    it('应该正确分配奖金', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      const bots = botManager.createBots(2);
      
      bots.forEach(bot => {
        mockServer.joinTournament(tournament.id, { id: bot.id, address: bot.address });
      });

      // 模拟锦标赛结束
      const rankings = [bots[0].id, bots[1].id];
      const result = mockServer.simulateTournamentEnd(tournament.id, rankings);

      // 验证奖金
      // 奖池 = 100 * 2 * 0.95 = 190
      // 第一名 = 190 * 0.7 = 133
      // 第二名 = 190 * 0.3 = 57
      expect(result.prizes[0].prize).to.be.closeTo(133, 1);
      expect(result.prizes[1].prize).to.be.closeTo(57, 1);
    });

    it('第3人应该无法加入满员锦标赛', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      const bots = botManager.createBots(3);
      
      // 前2人加入
      bots.slice(0, 2).forEach(bot => {
        mockServer.joinTournament(tournament.id, { id: bot.id });
      });

      // 第3人加入应该失败
      expect(() => {
        mockServer.joinTournament(tournament.id, { id: bots[2].id });
      }).to.throw('Tournament full');
    });
  });

  // ==================== 6人锦标赛测试 ====================
  describe('6人锦标赛', () => {
    const tournamentConfig = {
      maxPlayers: 6,
      minPlayers: 6,
      buyIn: 50,
      rakeRate: 500,
      prizeDistribution: [50, 30, 20], // 前三名获奖
      initialChips: 1500
    };

    it('6人应该能成功加入', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      const bots = botManager.createBots(6, { strategy: 'random' });
      
      bots.forEach(bot => {
        mockServer.joinTournament(tournament.id, { id: bot.id });
      });

      const updated = mockServer.tournaments.get(tournament.id);
      expect(updated.players.length).to.equal(6);
      expect(updated.status).to.equal('IN_PROGRESS');
    });

    it('应该正确分配前三名奖金', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      const bots = botManager.createBots(6);
      
      bots.forEach(bot => {
        mockServer.joinTournament(tournament.id, { id: bot.id });
      });

      // 模拟排名
      const rankings = [
        bots[0].id, // 第1
        bots[1].id, // 第2
        bots[2].id, // 第3
        bots[3].id,
        bots[4].id,
        bots[5].id
      ];

      const result = mockServer.simulateTournamentEnd(tournament.id, rankings);

      // 奖池 = 50 * 6 * 0.95 = 285
      // 第1 = 285 * 0.5 = 142.5
      // 第2 = 285 * 0.3 = 85.5
      // 第3 = 285 * 0.2 = 57
      expect(result.prizes[0].prize).to.be.closeTo(142, 1);
      expect(result.prizes[1].prize).to.be.closeTo(85, 1);
      expect(result.prizes[2].prize).to.be.closeTo(57, 1);
    });

    it('未满6人不应自动开始', () => {
      const tournament = mockServer.createTournament(tournamentConfig);
      const bots = botManager.createBots(5);
      
      bots.forEach(bot => {
        mockServer.joinTournament(tournament.id, { id: bot.id });
      });

      const updated = mockServer.tournaments.get(tournament.id);
      expect(updated.status).to.equal('WAITING');
    });
  });

  // ==================== 策略测试 ====================
  describe('不同策略测试', () => {
    it('激进策略应该更多加注', async () => {
      const aggressiveBot = new BotPlayer({ strategy: 'aggressive' });
      
      let raiseCount = 0;
      const actions = [];
      
      for (let i = 0; i < 100; i++) {
        const action = aggressiveBot.decideAction({
          callAmount: 10,
          minRaise: 20,
          canRaise: true,
          canCheck: false,
          pot: 50
        });
        actions.push(action.action);
        if (action.action === 'raise') raiseCount++;
      }

      // 激进策略加注率应该较高
      expect(raiseCount).to.be.greaterThan(30);
    });

    it('被动策略应该更多跟注/过牌', async () => {
      const passiveBot = new BotPlayer({ strategy: 'passive' });
      
      const actions = [];
      
      for (let i = 0; i < 100; i++) {
        const action = passiveBot.decideAction({
          callAmount: 10,
          minRaise: 20,
          canRaise: true,
          canCheck: true,
          pot: 50
        });
        actions.push(action.action);
      }

      // 被动策略主要check和call
      const passiveActions = actions.filter(a => a === 'check' || a === 'call');
      expect(passiveActions.length).to.be.greaterThan(70);
    });

    it('弃牌策略应该很少跟注', async () => {
      const folderBot = new BotPlayer({ strategy: 'folder' });
      
      const actions = [];
      
      for (let i = 0; i < 100; i++) {
        const action = folderBot.decideAction({
          callAmount: 50,
          minRaise: 100,
          canRaise: true,
          canCheck: false,
          pot: 100
        });
        actions.push(action.action);
      }

      // 弃牌策略主要fold
      const folds = actions.filter(a => a === 'fold');
      expect(folds.length).to.be.greaterThan(90);
    });
  });

  // ==================== 机器人管理器测试 ====================
  describe('机器人管理器', () => {
    it('应该正确创建多个机器人', () => {
      const bots = botManager.createBots(5);
      
      expect(bots.length).to.equal(5);
      expect(botManager.getAllBots().length).to.equal(5);
    });

    it('每个机器人应该有唯一ID', () => {
      const bots = botManager.createBots(10);
      const ids = bots.map(b => b.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).to.equal(10);
    });

    it('应该正确统计游戏数据', () => {
      const bots = botManager.createBots(2);
      
      // 模拟游戏统计
      bots[0].stats.handsPlayed = 10;
      bots[0].stats.handsWon = 3;
      bots[1].stats.handsPlayed = 10;
      bots[1].stats.handsWon = 5;

      const summary = botManager.getStatsSummary();
      
      expect(summary.botCount).to.equal(2);
      expect(summary.totalHands).to.equal(20);
      expect(summary.totalWins).to.equal(8);
    });

    it('disconnectAll应该断开所有机器人', () => {
      const bots = botManager.createBots(3);
      bots.forEach(b => b.connected = true);
      
      botManager.disconnectAll();
      
      expect(botManager.getAllBots().length).to.equal(0);
    });
  });

  // ==================== 断线处理测试 ====================
  describe('断线处理', () => {
    it('断线机器人应该停止行动', () => {
      const bot = botManager.createBot({ strategy: 'random' });
      bot.connected = true;
      
      // 断开
      bot.disconnect();
      
      expect(bot.connected).to.be.false;
    });

    it('应该能获取机器人状态', () => {
      const bot = botManager.createBot();
      bot.stack = 1000;
      bot.currentTable = 'table_1';
      
      const status = bot.getStatus();
      
      expect(status.stack).to.equal(1000);
      expect(status.currentTable).to.equal('table_1');
    });
  });

  // ==================== 压力测试 ====================
  describe('压力测试', () => {
    it('应该能处理大量机器人创建', () => {
      const start = Date.now();
      const bots = botManager.createBots(100);
      const elapsed = Date.now() - start;
      
      expect(bots.length).to.equal(100);
      expect(elapsed).to.be.lessThan(1000); // 1秒内完成
    });

    it('手牌评估应该快速完成', () => {
      const bot = new BotPlayer();
      
      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        bot.evaluateHand();
      }
      const elapsed = Date.now() - start;
      
      expect(elapsed).to.be.lessThan(100); // 10000次 < 100ms
    });
  });
});
