# 完整技术方案 - 锦标赛/NFT/CHIP/DAO

## 一、锦标赛系统 (Phase 1)

### 1.1 Tournament.sol 合约

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title Tournament
 * @dev Sit & Go 锦标赛合约 - 支持2/3/6/9人
 * MVP版本: 固定盲注, 不递增
 */
contract Tournament is Ownable, ReentrancyGuard, Pausable {
    
    // ============ Enums ============
    
    enum TournamentType { HEADS_UP, SMALL, MEDIUM, LARGE }
    enum TournamentStatus { WAITING, IN_PROGRESS, COMPLETED, CANCELLED }
    enum StartMode { INSTANT, SCHEDULED }
    
    // ============ Structs ============
    
    struct TournamentConfig {
        TournamentType tournamentType;
        uint8 playerCount;        // 2, 3, 6, 9
        uint256 buyIn;            // TRX (sun)
        uint256 rakeRate;         // basis points, 500 = 5%
        uint256[] prizeDistribution; // [5000, 3000, 2000] = 50%, 30%, 20%
        uint256 initialChips;     // 初始筹码
        StartMode startMode;      // 满员即开 or 定时启动
        uint256 waitTimeout;      // 定时赛等待超时(秒), 0=满员即开
    }
    
    struct Tournament {
        uint256 configId;
        TournamentStatus status;
        address[] players;
        mapping(address => bool) isJoined;
        mapping(address => uint256) playerIndex;
        uint256 prizePool;
        uint256 rakeCollected;
        address[] finalRankings;
        uint256 startTime;
        uint256 createdAt;
    }
    
    // ============ State Variables ============
    
    address public serverWallet;
    uint256 public tournamentCounter;
    
    // 配置ID => 配置
    mapping(uint256 => TournamentConfig) public configs;
    uint256[] public configIds;
    
    // 锦标赛ID => 锦标赛
    mapping(uint256 => Tournament) public tournaments;
    
    // 玩家 => 当前参与的锦标赛ID (0表示未参与)
    mapping(address => uint256) public playerCurrentTournament;
    
    // 玩家 => 可领取奖金
    mapping(address => uint256) public pendingPrizes;
    
    // ============ Constants ============
    
    uint256 public constant MIN_BUY_IN = 10 * 1e6;    // 10 TRX
    uint256 public constant MAX_WAIT_TIMEOUT = 1 hours;
    uint256 public constant COMPENSATION_CHIP = 10 * 1e18; // 未开赛补偿10 CHIP
    
    // ============ Events ============
    
    event ConfigCreated(uint256 indexed configId, TournamentType tType, uint8 playerCount);
    event TournamentCreated(uint256 indexed tournamentId, uint256 indexed configId);
    event PlayerJoined(uint256 indexed tournamentId, address indexed player, uint8 currentCount);
    event TournamentStarted(uint256 indexed tournamentId, address[] players);
    event TournamentCancelled(uint256 indexed tournamentId, string reason);
    event TournamentFinished(uint256 indexed tournamentId, address[] rankings, uint256[] prizes);
    event PrizeClaimed(address indexed player, uint256 amount);
    
    // ============ Modifiers ============
    
    modifier onlyServer() {
        require(msg.sender == serverWallet, "Only server");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _serverWallet) {
        serverWallet = _serverWallet;
        
        // 初始化默认配置
        _createDefaultConfigs();
    }
    
    // ============ Config Functions ============
    
    function _createDefaultConfigs() internal {
        // 2人赛 - 满员即开
        _addConfig(TournamentType.HEADS_UP, 2, 10 * 1e6, 500, 
                   [uint256(5000), uint256(5000)], 1000, StartMode.INSTANT, 0);
        
        // 3人赛 - 满员即开
        _addConfig(TournamentType.SMALL, 3, 20 * 1e6, 500, 
                   [uint256(5000), uint256(3000), uint256(2000)], 1000, StartMode.INSTANT, 0);
        
        // 6人赛 - 满员即开
        _addConfig(TournamentType.MEDIUM, 6, 50 * 1e6, 500, 
                   [uint256(5000), uint256(3000), uint256(2000)], 2000, StartMode.INSTANT, 0);
        
        // 9人赛 - 定时启动 (5分钟等待窗口)
        _addConfig(TournamentType.LARGE, 9, 100 * 1e6, 500, 
                   [uint256(5000), uint256(3000), uint256(2000)], 3000, StartMode.SCHEDULED, 5 minutes);
    }
    
    function _addConfig(
        TournamentType tType,
        uint8 playerCount,
        uint256 buyIn,
        uint256 rakeRate,
        uint256[3] memory prizes,
        uint256 initialChips,
        StartMode startMode,
        uint256 waitTimeout
    ) internal {
        uint256 configId = configIds.length;
        
        uint256[] memory prizeArr = new uint256[](playerCount);
        for (uint8 i = 0; i < 3 && i < playerCount; i++) {
            prizeArr[i] = prizes[i];
        }
        
        configs[configId] = TournamentConfig({
            tournamentType: tType,
            playerCount: playerCount,
            buyIn: buyIn,
            rakeRate: rakeRate,
            prizeDistribution: prizeArr,
            initialChips: initialChips,
            startMode: startMode,
            waitTimeout: waitTimeout
        });
        
        configIds.push(configId);
        emit ConfigCreated(configId, tType, playerCount);
    }
    
    // ============ Tournament Functions ============
    
    /**
     * @dev 创建锦标赛 (服务端调用)
     */
    function createTournament(uint256 configId) external whenNotPaused returns (uint256) {
        require(configId < configIds.length, "Invalid config");
        
        uint256 tournamentId = ++tournamentCounter;
        Tournament storage t = tournaments[tournamentId];
        
        t.configId = configId;
        t.status = TournamentStatus.WAITING;
        t.createdAt = block.timestamp;
        
        emit TournamentCreated(tournamentId, configId);
        return tournamentId;
    }
    
    /**
     * @dev 玩家报名锦标赛
     * 要求:
     * 1. 玩家当前未参与其他锦标赛
     * 2. 锦标赛状态为WAITING
     * 3. 支付正确买入金额
     */
    function joinTournament(uint256 tournamentId) external payable whenNotPaused nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        TournamentConfig storage config = configs[t.configId];
        
        require(t.status == TournamentStatus.WAITING, "Not waiting");
        require(!t.isJoined[msg.sender], "Already joined");
        require(playerCurrentTournament[msg.sender] == 0, "Already in tournament");
        require(msg.value == config.buyIn, "Wrong buy-in amount");
        
        // 记录玩家
        t.players.push(msg.sender);
        t.isJoined[msg.sender] = true;
        t.playerIndex[msg.sender] = t.players.length - 1;
        t.prizePool += msg.value;
        
        // 标记玩家当前锦标赛
        playerCurrentTournament[msg.sender] = tournamentId;
        
        emit PlayerJoined(tournamentId, msg.sender, uint8(t.players.length));
        
        // 满员即开模式: 人满立即开始
        if (config.startMode == StartMode.INSTANT && t.players.length == config.playerCount) {
            _startTournament(tournamentId);
        }
    }
    
    /**
     * @dev 取消报名 (锦标赛未开始时)
     */
    function cancelJoin(uint256 tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        
        require(t.status == TournamentStatus.WAITING, "Already started");
        require(t.isJoined[msg.sender], "Not joined");
        
        // 退款
        TournamentConfig storage config = configs[t.configId];
        uint256 refund = config.buyIn;
        
        // 从玩家列表移除
        uint256 idx = t.playerIndex[msg.sender];
        t.players[idx] = t.players[t.players.length - 1];
        t.playerIndex[t.players[idx]] = idx;
        t.players.pop();
        
        t.isJoined[msg.sender] = false;
        t.prizePool -= refund;
        playerCurrentTournament[msg.sender] = 0;
        
        // 转账退款
        (bool ok,) = payable(msg.sender).call{value: refund}("");
        require(ok, "Refund failed");
    }
    
    /**
     * @dev 定时赛超时取消 (服务端调用)
     */
    function cancelTournament(uint256 tournamentId) external onlyServer {
        Tournament storage t = tournaments[tournamentId];
        TournamentConfig storage config = configs[t.configId];
        
        require(t.status == TournamentStatus.WAITING, "Not waiting");
        require(
            config.startMode == StartMode.SCHEDULED && 
            block.timestamp >= t.createdAt + config.waitTimeout,
            "Not timed out"
        );
        
        t.status = TournamentStatus.CANCELLED;
        
        // 退还所有玩家
        for (uint256 i = 0; i < t.players.length; i++) {
            address player = t.players[i];
            playerCurrentTournament[player] = 0;
            
            (bool ok,) = payable(player).call{value: config.buyIn}("");
            require(ok, "Refund failed");
            
            // TODO: 发放补偿CHIP (需要CHIP合约集成)
        }
        
        emit TournamentCancelled(tournamentId, "Timeout");
    }
    
    /**
     * @dev 开始锦标赛 (服务端调用)
     */
    function startTournament(uint256 tournamentId) external onlyServer {
        _startTournament(tournamentId);
    }
    
    function _startTournament(uint256 tournamentId) internal {
        Tournament storage t = tournaments[tournamentId];
        TournamentConfig storage config = configs[t.configId];
        
        require(t.status == TournamentStatus.WAITING, "Not waiting");
        require(t.players.length >= 2, "Not enough players");
        
        // 计算抽水
        uint256 totalBuyIn = config.buyIn * t.players.length;
        t.rakeCollected = (totalBuyIn * config.rakeRate) / 10000;
        t.prizePool = totalBuyIn - t.rakeCollected;
        
        t.status = TournamentStatus.IN_PROGRESS;
        t.startTime = block.timestamp;
        
        emit TournamentStarted(tournamentId, t.players);
    }
    
    /**
     * @dev 结束锦标赛 (服务端调用, 提交排名)
     * @param rankings 最终排名 (index 0 = 第1名)
     */
    function finishTournament(uint256 tournamentId, address[] calldata rankings) 
        external onlyServer nonReentrant 
    {
        Tournament storage t = tournaments[tournamentId];
        TournamentConfig storage config = configs[t.configId];
        
        require(t.status == TournamentStatus.IN_PROGRESS, "Not in progress");
        require(rankings.length <= config.playerCount, "Invalid rankings");
        
        t.status = TournamentStatus.COMPLETED;
        t.finalRankings = rankings;
        
        // 分配奖金
        uint256[] memory prizes = new uint256[](rankings.length);
        for (uint256 i = 0; i < rankings.length && i < config.prizeDistribution.length; i++) {
            uint256 prizeAmount = (t.prizePool * config.prizeDistribution[i]) / 10000;
            pendingPrizes[rankings[i]] += prizeAmount;
            prizes[i] = prizeAmount;
            
            // 清除玩家当前锦标赛标记
            playerCurrentTournament[rankings[i]] = 0;
        }
        
        // 发送抽水到服务端钱包
        if (t.rakeCollected > 0) {
            (bool ok,) = payable(serverWallet).call{value: t.rakeCollected}("");
            require(ok, "Rake transfer failed");
        }
        
        emit TournamentFinished(tournamentId, rankings, prizes);
    }
    
    /**
     * @dev 玩家领取奖金
     */
    function claimPrize() external nonReentrant {
        uint256 prize = pendingPrizes[msg.sender];
        require(prize > 0, "No prize");
        
        pendingPrizes[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: prize}("");
        require(ok, "Transfer failed");
        
        emit PrizeClaimed(msg.sender, prize);
    }
    
    // ============ View Functions ============
    
    function getConfig(uint256 configId) external view returns (
        TournamentType tType,
        uint8 playerCount,
        uint256 buyIn,
        uint256 rakeRate,
        uint256 initialChips,
        StartMode startMode,
        uint256 waitTimeout
    ) {
        TournamentConfig storage c = configs[configId];
        return (
            c.tournamentType,
            c.playerCount,
            c.buyIn,
            c.rakeRate,
            c.initialChips,
            c.startMode,
            c.waitTimeout
        );
    }
    
    function getTournamentPlayers(uint256 tournamentId) external view returns (address[] memory) {
        return tournaments[tournamentId].players;
    }
    
    function getTournamentStatus(uint256 tournamentId) external view returns (TournamentStatus) {
        return tournaments[tournamentId].status;
    }
    
    function getPlayerCount(uint256 tournamentId) external view returns (uint256) {
        return tournaments[tournamentId].players.length;
    }
    
    // ============ Admin Functions ============
    
    function setServerWallet(address _serverWallet) external onlyOwner {
        serverWallet = _serverWallet;
    }
    
    function addConfig(
        TournamentType tType,
        uint8 playerCount,
        uint256 buyIn,
        uint256 rakeRate,
        uint256[] calldata prizeDistribution,
        uint256 initialChips,
        StartMode startMode,
        uint256 waitTimeout
    ) external onlyOwner {
        require(playerCount >= 2 && playerCount <= 9, "Invalid player count");
        require(buyIn >= MIN_BUY_IN, "Buy-in too low");
        require(waitTimeout <= MAX_WAIT_TIMEOUT, "Timeout too long");
        
        uint256 configId = configIds.length;
        configs[configId] = TournamentConfig({
            tournamentType: tType,
            playerCount: playerCount,
            buyIn: buyIn,
            rakeRate: rakeRate,
            prizeDistribution: prizeDistribution,
            initialChips: initialChips,
            startMode: startMode,
            waitTimeout: waitTimeout
        });
        configIds.push(configId);
        
        emit ConfigCreated(configId, tType, playerCount);
    }
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

### 1.2 TournamentTable.js (锦标赛游戏桌)

```javascript
// server/pokergame/TournamentTable.js
const Table = require('./Table');

class TournamentTable extends Table {
  constructor(tournamentId, maxPlayers, initialChips) {
    // 锦标赛: 固定limit, 初始筹码由买入决定
    super(tournamentId, `Tournament-${tournamentId}`, initialChips * 100, maxPlayers);
    
    this.tournamentId = tournamentId;
    this.initialChips = initialChips;
    this.eliminatedPlayers = [];
    this.onElimination = null; // 淘汰回调
    this.onTournamentEnd = null; // 锦标赛结束回调
    
    // MVP: 固定盲注, 不递增
    this.minBet = Math.floor(initialChips / 100); // 小盲
    this.blindLevel = 1;
    this.blindIncreaseTime = null; // MVP版本不使用
    
    // 超时设置
    this.actionTimeout = 15000; // 15秒
    this.timeBank = 60000; // 60秒时间银行
  }

  /**
   * 玩家入座 - 锦标赛固定初始筹码
   */
  sitPlayer(player, seatId) {
    // 锦标赛玩家自动获得初始筹码
    super.sitPlayer(player, seatId, this.initialChips);
  }

  /**
   * 重写endHand - 检查淘汰玩家
   */
  endHand() {
    super.endHand();
    
    // 检查是否有玩家被淘汰 (stack === 0)
    const eliminated = this.checkEliminatedPlayers();
    
    if (eliminated.length > 0) {
      this.eliminatedPlayers.push(...eliminated);
      
      // 触发淘汰回调
      if (this.onElimination) {
        this.onElimination(eliminated, this.getRemainingPlayers());
      }
    }
    
    // 检查是否只剩1人
    const remaining = this.getRemainingPlayers();
    if (remaining.length === 1) {
      // 锦标赛结束
      if (this.onTournamentEnd) {
        const rankings = this.getFinalRankings();
        this.onTournamentEnd(rankings);
      }
    }
  }

  /**
   * 检查被淘汰的玩家
   */
  checkEliminatedPlayers() {
    const eliminated = [];
    for (let i = 1; i <= this.maxPlayers; i++) {
      const seat = this.seats[i];
      if (seat && seat.stack === 0 && !seat.sittingOut) {
        seat.sittingOut = true;
        eliminated.push({
          seatId: i,
          player: seat.player,
          finalPosition: 0 // 后续计算
        });
      }
    }
    return eliminated;
  }

  /**
   * 获取剩余玩家
   */
  getRemainingPlayers() {
    const remaining = [];
    for (let i = 1; i <= this.maxPlayers; i++) {
      const seat = this.seats[i];
      if (seat && seat.stack > 0) {
        remaining.push({
          seatId: i,
          player: seat.player,
          stack: seat.stack
        });
      }
    }
    return remaining;
  }

  /**
   * 获取最终排名
   */
  getFinalRankings() {
    // 淘汰顺序的逆序 = 最终排名
    // 最后被淘汰的 = 第2名
    // 剩余的 = 第1名
    const rankings = [];
    
    // 第1名: 剩余玩家
    const remaining = this.getRemainingPlayers();
    if (remaining.length === 1) {
      rankings.push(remaining[0].player);
    }
    
    // 第2名及以后: 淘汰顺序的逆序
    for (let i = this.eliminatedPlayers.length - 1; i >= 0; i--) {
      rankings.push(this.eliminatedPlayers[i].player);
    }
    
    return rankings;
  }

  /**
   * 处理断线 - 自动Fold
   */
  handleDisconnect(socketId) {
    const seat = this.findPlayerBySocketId(socketId);
    if (seat && !seat.folded && seat.turn) {
      // 自动Fold
      return this.handleFold(socketId);
    }
    return null;
  }

  /**
   * 处理超时
   */
  handleTimeout(socketId) {
    const seat = this.findPlayerBySocketId(socketId);
    if (seat && !seat.folded && seat.turn) {
      // 如果有time bank, 使用time bank
      if (seat.timeBank && seat.timeBank > 0) {
        seat.usingTimeBank = true;
        return null; // 等待time bank
      }
      
      // 否则自动Fold
      return this.handleFold(socketId);
    }
    return null;
  }
}

module.exports = TournamentTable;
```

### 1.3 锦标赛服务

```javascript
// server/services/TournamentService.js
const TronWeb = require('tronweb');
const TournamentTable = require('../pokergame/TournamentTable');

class TournamentService {
  constructor(io, tronWeb, contractAddress) {
    this.io = io;
    this.tronWeb = tronWeb;
    this.contractAddress = contractAddress;
    this.contract = null;
    
    // 活跃锦标赛
    this.activeTournaments = new Map();
    // 等待中的锦标赛
    this.waitingTournaments = new Map();
    
    this.init();
  }

  async init() {
    this.contract = await this.tronWeb.contract().at(this.contractAddress);
    this.setupEventListeners();
    this.startWaitingCheck();
  }

  /**
   * 创建锦标赛
   */
  async createTournament(configId) {
    try {
      const tx = await this.contract.createTournament(configId).send();
      const tournamentId = await this.getTournamentIdFromTx(tx);
      
      const config = await this.getConfig(configId);
      
      this.waitingTournaments.set(tournamentId, {
        id: tournamentId,
        configId,
        config,
        createdAt: Date.now(),
        players: []
      });
      
      return tournamentId;
    } catch (error) {
      console.error('[TournamentService] Create error:', error);
      throw error;
    }
  }

  /**
   * 玩家报名
   */
  async joinTournament(tournamentId, playerAddress, socket) {
    try {
      const tournament = this.waitingTournaments.get(tournamentId);
      if (!tournament) {
        throw new Error('Tournament not found');
      }
      
      // 调用合约报名
      const config = tournament.config;
      await this.contract.joinTournament(tournamentId).send({
        callValue: config.buyIn
      });
      
      // 更新本地状态
      tournament.players.push({
        address: playerAddress,
        socket,
        joinedAt: Date.now()
      });
      
      // 广播更新
      this.io.to(`tournament:${tournamentId}`).emit('tournament:player_joined', {
        tournamentId,
        playerCount: tournament.players.length,
        maxPlayers: config.playerCount
      });
      
      // 检查是否满员
      if (tournament.players.length >= config.playerCount) {
        await this.startTournament(tournamentId);
      }
      
    } catch (error) {
      console.error('[TournamentService] Join error:', error);
      throw error;
    }
  }

  /**
   * 开始锦标赛
   */
  async startTournament(tournamentId) {
    const tournament = this.waitingTournaments.get(tournamentId);
    if (!tournament) return;
    
    // 调用合约开始
    await this.contract.startTournament(tournamentId).send();
    
    // 创建游戏桌
    const table = new TournamentTable(
      tournamentId,
      tournament.config.playerCount,
      tournament.config.initialChips
    );
    
    // 设置淘汰回调
    table.onElimination = (eliminated, remaining) => {
      this.handleElimination(tournamentId, eliminated, remaining);
    };
    
    // 设置结束回调
    table.onTournamentEnd = (rankings) => {
      this.handleTournamentEnd(tournamentId, rankings);
    };
    
    // 让玩家入座
    tournament.players.forEach((player, index) => {
      table.sitPlayer({
        id: player.address,
        name: player.address.slice(0, 8),
        socketId: player.socket.id
      }, index + 1);
      
      // 加入房间
      player.socket.join(`table:${tournamentId}`);
    });
    
    // 移动到活跃锦标赛
    this.activeTournaments.set(tournamentId, {
      ...tournament,
      table,
      startTime: Date.now()
    });
    this.waitingTournaments.delete(tournamentId);
    
    // 通知所有玩家
    this.io.to(`tournament:${tournamentId}`).emit('tournament:started', {
      tournamentId,
      players: tournament.players.map(p => p.address)
    });
    
    // 开始第一手牌
    table.startHand();
    this.broadcastTableState(tournamentId, table);
  }

  /**
   * 处理淘汰
   */
  handleElimination(tournamentId, eliminated, remaining) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;
    
    const config = tournament.config;
    
    // 计算淘汰名次
    const eliminatedCount = tournament.table.eliminatedPlayers.length;
    
    eliminated.forEach(e => {
      const position = config.playerCount - eliminatedCount + 1;
      
      // 通知淘汰
      this.io.to(`table:${tournamentId}`).emit('tournament:elimination', {
        player: e.player.id,
        position,
        remaining: remaining.length
      });
    });
  }

  /**
   * 处理锦标赛结束
   */
  async handleTournamentEnd(tournamentId, rankings) {
    const tournament = this.activeTournaments.get(tournamentId);
    if (!tournament) return;
    
    try {
      // 提交排名到合约
      const rankingAddresses = rankings.map(r => r.id);
      await this.contract.finishTournament(tournamentId, rankingAddresses).send();
      
      // 通知所有玩家
      this.io.to(`table:${tournamentId}`).emit('tournament:finished', {
        tournamentId,
        rankings: rankingAddresses
      });
      
      // 清理
      this.activeTournaments.delete(tournamentId);
      
    } catch (error) {
      console.error('[TournamentService] Finish error:', error);
    }
  }

  /**
   * 定时检查等待超时
   */
  startWaitingCheck() {
    setInterval(() => {
      const now = Date.now();
      
      this.waitingTournaments.forEach(async (tournament, id) => {
        const elapsed = (now - tournament.createdAt) / 1000;
        
        if (elapsed >= tournament.config.waitTimeout) {
          // 超时取消
          if (tournament.config.startMode === 1) { // SCHEDULED
            await this.contract.cancelTournament(id).send();
            this.waitingTournaments.delete(id);
            
            this.io.to(`tournament:${id}`).emit('tournament:cancelled', {
              tournamentId: id,
              reason: 'timeout'
            });
          }
        }
      });
    }, 10000); // 每10秒检查
  }

  /**
   * 广播游戏桌状态
   */
  broadcastTableState(tournamentId, table) {
    const state = {
      pot: table.pot,
      board: table.board,
      turn: table.turn,
      button: table.button,
      seats: this.serializeSeats(table),
      winMessages: table.winMessages
    };
    
    this.io.to(`table:${tournamentId}`).emit('game:state', state);
  }

  serializeSeats(table) {
    const seats = {};
    for (let i = 1; i <= table.maxPlayers; i++) {
      const seat = table.seats[i];
      if (seat) {
        seats[i] = {
          player: { id: seat.player.id, name: seat.player.name },
          stack: seat.stack,
          bet: seat.bet,
          folded: seat.folded,
          turn: seat.turn,
          hand: seat.hand.length > 0 && !table.handOver ? ['**', '**'] : seat.hand
        };
      }
    }
    return seats;
  }

  async getConfig(configId) {
    const result = await this.contract.getConfig(configId).call();
    return {
      tournamentType: result.tType,
      playerCount: result.playerCount.toNumber(),
      buyIn: result.buyIn.toNumber(),
      rakeRate: result.rakeRate.toNumber(),
      initialChips: result.initialChips.toNumber(),
      startMode: result.startMode,
      waitTimeout: result.waitTimeout.toNumber()
    };
  }
}

module.exports = TournamentService;
```

---

## 二、NFT成就系统 (Phase 2)

### 2.1 AchievementNFT.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/TRC721/TRC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title AchievementNFT
 * @dev 玩家成就NFT徽章
 * MVP版本: 玩家自付Gas (~5 TRX)
 */
contract AchievementNFT is TRC721, Ownable, Pausable {
    using Counters for Counters.Counter;
    
    // ============ Enums ============
    
    enum AchievementType { 
        ROYAL_FLUSH,      // 皇家同花顺 - 传说
        STRAIGHT_FLUSH,   // 同花顺 - 史诗
        FOUR_OF_A_KIND,   // 四条 - 稀有
        FULL_HOUSE,       // 葫芦 - 普通
        FLUSH,            // 同花 - 普通
        STRAIGHT          // 顺子 - 普通
    }
    
    enum Rarity { COMMON, RARE, EPIC, LEGENDARY }
    
    // ============ Structs ============
    
    struct AchievementInfo {
        AchievementType achievementType;
        Rarity rarity;
        string name;
        uint256 monthlyLimit;      // 每月限量
        uint256 mintPrice;         // 铸造价格 (sun)
        bool isActive;
    }
    
    // ============ State Variables ============
    
    Counters.Counter private _tokenIdCounter;
    
    address public signer; // 服务端签名地址
    uint256 public constant SIGNATURE_VALIDITY = 7 days;
    
    // 成就类型ID => 成就信息
    mapping(uint256 => AchievementInfo) public achievements;
    uint256[] public achievementTypes;
    
    // 每月铸造计数
    // achievementTypeId => yearMonth => count
    mapping(uint256 => mapping(uint256 => uint256)) public monthlyMinted;
    
    // 防止重复铸造
    // keccak256(player, achievementTypeId, timestamp) => claimed
    mapping(bytes32 => bool) public claimRecord;
    
    // tokenId => 成就信息
    mapping(uint256 => AchievementType) public tokenAchievement;
    
    // ============ Events ============
    
    event AchievementMinted(
        address indexed player,
        uint256 indexed tokenId,
        uint256 achievementTypeId,
        Rarity rarity
    );
    event AchievementAdded(uint256 indexed typeId, AchievementType aType, Rarity rarity);
    
    // ============ Constructor ============
    
    constructor(address _signer) TRC721("Poker Achievement NFT", "PANFT") {
        signer = _signer;
        _initializeAchievements();
    }
    
    // ============ Initialize ============
    
    function _initializeAchievements() internal {
        // 皇家同花顺 - 传说, 每月限量10个
        _addAchievement(AchievementType.ROYAL_FLUSH, Rarity.LEGENDARY, 
                        "Royal Flush", 10, 5 * 1e6);
        
        // 同花顺 - 史诗, 每月限量50个
        _addAchievement(AchievementType.STRAIGHT_FLUSH, Rarity.EPIC, 
                        "Straight Flush", 50, 5 * 1e6);
        
        // 四条 - 稀有, 每月限量200个
        _addAchievement(AchievementType.FOUR_OF_A_KIND, Rarity.RARE, 
                        "Four of a Kind", 200, 5 * 1e6);
        
        // 葫芦 - 普通, 每月限量500个
        _addAchievement(AchievementType.FULL_HOUSE, Rarity.COMMON, 
                        "Full House", 500, 5 * 1e6);
        
        // 同花 - 普通
        _addAchievement(AchievementType.FLUSH, Rarity.COMMON, 
                        "Flush", 1000, 5 * 1e6);
        
        // 顺子 - 普通
        _addAchievement(AchievementType.STRAIGHT, Rarity.COMMON, 
                        "Straight", 2000, 5 * 1e6);
    }
    
    function _addAchievement(
        AchievementType aType,
        Rarity rarity,
        string memory name,
        uint256 monthlyLimit,
        uint256 mintPrice
    ) internal {
        uint256 typeId = uint256(aType);
        
        achievements[typeId] = AchievementInfo({
            achievementType: aType,
            rarity: rarity,
            name: name,
            monthlyLimit: monthlyLimit,
            mintPrice: mintPrice,
            isActive: true
        });
        
        achievementTypes.push(typeId);
        emit AchievementAdded(typeId, aType, rarity);
    }
    
    // ============ Mint Functions ============
    
    /**
     * @dev 铸造NFT
     * @param achievementTypeId 成就类型ID
     * @param timestamp 时间戳
     * @param signature 服务端签名
     */
    function claimNFT(
        uint256 achievementTypeId,
        uint256 timestamp,
        bytes memory signature
    ) external payable whenNotPaused {
        AchievementInfo storage achievement = achievements[achievementTypeId];
        
        require(achievement.isActive, "Achievement not active");
        require(msg.value >= achievement.mintPrice, "Insufficient payment");
        
        // 检查签名时效性
        require(block.timestamp <= timestamp + SIGNATURE_VALIDITY, "Signature expired");
        
        // 验证签名
        bytes32 hash = keccak256(abi.encodePacked(
            msg.sender,
            achievementTypeId,
            timestamp
        ));
        require(!claimRecord[hash], "Already claimed");
        
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19TRON Signed Message:\n32", hash));
        require(_verifySignature(ethSignedHash, signature), "Invalid signature");
        
        // 检查月度限量
        uint256 yearMonth = _getYearMonth();
        require(
            monthlyMinted[achievementTypeId][yearMonth] < achievement.monthlyLimit,
            "Monthly limit reached"
        );
        
        // 记录已领取
        claimRecord[hash] = true;
        monthlyMinted[achievementTypeId][yearMonth]++;
        
        // 铸造NFT
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(msg.sender, tokenId);
        tokenAchievement[tokenId] = achievement.achievementType;
        
        // 退款多余
        if (msg.value > achievement.mintPrice) {
            (bool ok,) = payable(msg.sender).call{value: msg.value - achievement.mintPrice}("");
            require(ok, "Refund failed");
        }
        
        emit AchievementMinted(msg.sender, tokenId, achievementTypeId, achievement.rarity);
    }
    
    // ============ View Functions ============
    
    function getAchievementInfo(uint256 typeId) external view returns (
        AchievementType aType,
        Rarity rarity,
        string memory name,
        uint256 monthlyLimit,
        uint256 mintPrice,
        bool isActive
    ) {
        AchievementInfo storage a = achievements[typeId];
        return (
            a.achievementType,
            a.rarity,
            a.name,
            a.monthlyLimit,
            a.mintPrice,
            a.isActive
        );
    }
    
    function getMonthlyMinted(uint256 typeId, uint256 yearMonth) external view returns (uint256) {
        return monthlyMinted[typeId][yearMonth];
    }
    
    function getCurrentMonthMinted(uint256 typeId) external view returns (uint256) {
        return monthlyMinted[typeId][_getYearMonth()];
    }
    
    // ============ Helper Functions ============
    
    function _getYearMonth() internal view returns (uint256) {
        // 简化: 使用区块时间戳计算年月
        // 实际: year * 100 + month
        uint256 timestamp = block.timestamp;
        uint256 year = (timestamp / 31536000) + 1970;
        uint256 month = ((timestamp % 31536000) / 2592000) + 1;
        return year * 100 + month;
    }
    
    function _verifySignature(bytes32 hash, bytes memory signature) internal view returns (bool) {
        // TRON签名验证
        address recovered = _recoverSigner(hash, signature);
        return recovered == signer;
    }
    
    function _recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(signature);
        return ecrecover(hash, v, r, s);
    }
    
    function _splitSignature(bytes memory sig) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65, "Invalid signature length");
        
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        
        return (v, r, s);
    }
    
    // ============ Admin Functions ============
    
    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
    }
    
    function setAchievementActive(uint256 typeId, bool active) external onlyOwner {
        achievements[typeId].isActive = active;
    }
    
    function setAchievementLimit(uint256 typeId, uint256 limit) external onlyOwner {
        achievements[typeId].monthlyLimit = limit;
    }
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    
    // ============ Overrides ============
    
    function _baseURI() internal pure override returns (string memory) {
        return "https://api.poker-game.com/nft/";
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token not exist");
        AchievementType aType = tokenAchievement[tokenId];
        return string(abi.encodePacked(_baseURI(), uint256(aType).toString(), "/", tokenId.toString()));
    }
}
```

### 2.2 NFT服务

```javascript
// server/services/NFTService.js
const crypto = require('crypto');

class NFTService {
  constructor(tronWeb, contractAddress, signerPrivateKey) {
    this.tronWeb = tronWeb;
    this.contractAddress = contractAddress;
    this.signerPrivateKey = signerPrivateKey;
    this.contract = null;
    
    // 牌型到成就类型的映射
    this.handToAchievement = {
      'Royal Flush': 0,      // ROYAL_FLUSH
      'Straight Flush': 1,   // STRAIGHT_FLUSH
      'Four of a Kind': 2,   // FOUR_OF_A_KIND
      'Full House': 3,       // FULL_HOUSE
      'Flush': 4,            // FLUSH
      'Straight': 5          // STRAIGHT
    };
  }

  async init() {
    this.contract = await this.tronWeb.contract().at(this.contractAddress);
  }

  /**
   * 检查是否达成成就
   */
  checkAchievement(handDescription) {
    return this.handToAchievement[handDescription] !== undefined;
  }

  /**
   * 生成铸造签名
   */
  async generateMintSignature(playerAddress, achievementTypeId) {
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 构造消息
    const message = this.tronWeb.utils.bytes.bytesToHex(
      this.tronWeb.utils.code.hexStr2ByteArray(
        this.tronWeb.utils.ethersUtils.solidityPack(
          ['address', 'uint256', 'uint256'],
          [playerAddress, achievementTypeId, timestamp]
        )
      )
    );
    
    // 签名
    const signature = await this.tronWeb.trx.sign(
      message,
      this.signerPrivateKey
    );
    
    return {
      achievementTypeId,
      timestamp,
      signature
    };
  }

  /**
   * 处理游戏结束 - 检查成就
   */
  async processGameEnd(playerAddress, handDescription, socket) {
    const achievementTypeId = this.handToAchievement[handDescription];
    
    if (achievementTypeId === undefined) {
      return null;
    }
    
    // 检查月度限量
    const canMint = await this.checkMonthlyLimit(achievementTypeId);
    
    if (!canMint) {
      socket.emit('nft:limit_reached', {
        achievementType: achievementTypeId,
        message: '本月该成就NFT已发完'
      });
      return null;
    }
    
    // 生成签名
    const signatureData = await this.generateMintSignature(playerAddress, achievementTypeId);
    
    // 发送给客户端
    socket.emit('nft:achievement_unlocked', {
      achievementType: achievementTypeId,
      handDescription,
      signatureData,
      mintPrice: '5 TRX',
      expiresIn: '7 days'
    });
    
    return signatureData;
  }

  /**
   * 检查月度限量
   */
  async checkMonthlyLimit(achievementTypeId) {
    try {
      const info = await this.contract.getAchievementInfo(achievementTypeId).call();
      const currentMinted = await this.contract.getCurrentMonthMinted(achievementTypeId).call();
      
      return currentMinted.toNumber() < info.monthlyLimit.toNumber();
    } catch (error) {
      console.error('[NFTService] Check limit error:', error);
      return false;
    }
  }

  /**
   * 获取玩家NFT列表
   */
  async getPlayerNFTs(playerAddress) {
    try {
      const balance = await this.contract.balanceOf(playerAddress).call();
      const tokens = [];
      
      for (let i = 0; i < balance.toNumber(); i++) {
        const tokenId = await this.contract.tokenOfOwnerByIndex(playerAddress, i).call();
        const uri = await this.contract.tokenURI(tokenId).call();
        const achievementType = await this.contract.tokenAchievement(tokenId).call();
        
        tokens.push({
          tokenId: tokenId.toNumber(),
          uri,
          achievementType: achievementType.toNumber()
        });
      }
      
      return tokens;
    } catch (error) {
      console.error('[NFTService] Get NFTs error:', error);
      return [];
    }
  }
}

module.exports = NFTService;
```

---

## 三、CHIP代币 + 质押系统 (Phase 3)

### 3.1 ChipToken.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/TRC20/TRC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title ChipToken
 * @dev 平台代币 CHIP - TRC20
 * 总量: 10亿
 */
contract ChipToken is TRC20, Ownable, Pausable {
    
    uint8 private constant _decimals = 6;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**6; // 10亿
    
    // 铸造者白名单
    mapping(address => bool) public isMinter;
    
    // ============ Events ============
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Minted(address indexed to, uint256 amount, address indexed minter);
    event Burned(address indexed from, uint256 amount);
    
    // ============ Constructor ============
    
    constructor() TRC20("CHIP Token", "CHIP") {
        _mint(msg.sender, 100_000_000 * 10**6); // 初始铸造10%给部署者
    }
    
    // ============ TRC20 Overrides ============
    
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }
    
    function approve(address spender, uint256 amount) public override whenNotPaused returns (bool) {
        return super.approve(spender, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
    
    // ============ Mint/Burn ============
    
    function mint(address to, uint256 amount) external {
        require(isMinter[msg.sender], "Not minter");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit Minted(to, amount, msg.sender);
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Burned(msg.sender, amount);
    }
    
    function burnFrom(address from, uint256 amount) external {
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        emit Burned(from, amount);
    }
    
    // ============ Admin ============
    
    function addMinter(address minter) external onlyOwner {
        isMinter[minter] = true;
        emit MinterAdded(minter);
    }
    
    function removeMinter(address minter) external onlyOwner {
        isMinter[minter] = false;
        emit MinterRemoved(minter);
    }
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

### 3.2 Staking.sol (质押合约)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ChipToken.sol";

/**
 * @title Staking
 * @dev CHIP质押合约 - 质押CHIP获得平台分红
 */
contract Staking is Ownable, ReentrancyGuard, Pausable {
    
    // ============ Structs ============
    
    struct StakeInfo {
        uint256 amount;          // 质押数量
        uint256 startTime;       // 开始时间
        uint256 lastClaimTime;   // 上次领取时间
        uint256 lockedUntil;     // 锁定到期时间
    }
    
    struct RewardPool {
        uint256 totalRewards;    // 总奖励
        uint256 lastUpdateTime;  // 上次更新时间
        uint256 rewardPerToken;  // 每代币累积奖励
    }
    
    // ============ State Variables ============
    
    ChipToken public chipToken;
    
    // 质押信息
    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;
    
    // 奖励池
    RewardPool public rewardPool;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public pendingRewards;
    
    // 参数
    uint256 public constant MIN_STAKE = 100 * 10**6;      // 最小质押 100 CHIP
    uint256 public constant MIN_LOCK_DURATION = 7 days;   // 最小锁定期
    uint256 public constant MAX_LOCK_DURATION = 365 days; // 最大锁期
    uint256 public constant EARLY_UNSTAKE_PENALTY = 1000; // 提前解押罚金 10%
    
    // ============ Events ============
    
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount, uint256 penalty);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount);
    
    // ============ Constructor ============
    
    constructor(address _chipToken) {
        chipToken = ChipToken(_chipToken);
        rewardPool.lastUpdateTime = block.timestamp;
    }
    
    // ============ Stake Functions ============
    
    /**
     * @dev 质押CHIP
     * @param amount 质押数量
     * @param lockDuration 锁定时长(秒)
     */
    function stake(uint256 amount, uint256 lockDuration) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(amount >= MIN_STAKE, "Below minimum");
        require(lockDuration >= MIN_LOCK_DURATION, "Lock too short");
        require(lockDuration <= MAX_LOCK_DURATION, "Lock too long");
        
        // 更新奖励
        _updateReward(msg.sender);
        
        // 转入CHIP
        chipToken.transferFrom(msg.sender, address(this), amount);
        
        // 记录质押
        StakeInfo storage stakeInfo = stakes[msg.sender];
        stakeInfo.amount += amount;
        stakeInfo.startTime = block.timestamp;
        stakeInfo.lockedUntil = block.timestamp + lockDuration;
        
        totalStaked += amount;
        
        emit Staked(msg.sender, amount, lockDuration);
    }
    
    /**
     * @dev 解除质押
     * @param amount 解押数量
     */
    function unstake(uint256 amount) external nonReentrant {
        StakeInfo storage stakeInfo = stakes[msg.sender];
        require(stakeInfo.amount >= amount, "Insufficient stake");
        
        // 更新奖励
        _updateReward(msg.sender);
        
        uint256 penalty = 0;
        
        // 检查是否提前解押
        if (block.timestamp < stakeInfo.lockedUntil) {
            penalty = (amount * EARLY_UNSTAKE_PENALTY) / 10000;
        }
        
        uint256 returnAmount = amount - penalty;
        
        // 更新质押
        stakeInfo.amount -= amount;
        totalStaked -= amount;
        
        // 转出CHIP
        chipToken.transfer(msg.sender, returnAmount);
        
        // 罚金进入奖励池
        if (penalty > 0) {
            _addReward(penalty);
        }
        
        emit Unstaked(msg.sender, amount, penalty);
    }
    
    /**
     * @dev 领取奖励
     */
    function claimReward() external nonReentrant {
        _updateReward(msg.sender);
        
        uint256 reward = pendingRewards[msg.sender];
        require(reward > 0, "No reward");
        
        pendingRewards[msg.sender] = 0;
        chipToken.transfer(msg.sender, reward);
        
        emit RewardClaimed(msg.sender, reward);
    }
    
    // ============ Reward Functions ============
    
    /**
     * @dev 添加奖励 (平台抽水注入)
     */
    function addReward(uint256 amount) external {
        chipToken.transferFrom(msg.sender, address(this), amount);
        _addReward(amount);
    }
    
    function _addReward(uint256 amount) internal {
        _updateReward(address(0));
        
        rewardPool.totalRewards += amount;
        
        if (totalStaked > 0) {
            rewardPool.rewardPerToken += (amount * 10**18) / totalStaked;
        }
        
        emit RewardAdded(amount);
    }
    
    function _updateReward(address user) internal {
        uint256 rewardPerToken = rewardPool.rewardPerToken;
        
        if (user != address(0) && stakes[user].amount > 0) {
            uint256 pending = (stakes[user].amount * (rewardPerToken - userRewardPerTokenPaid[user])) / 10**18;
            pendingRewards[user] += pending;
        }
        
        if (user != address(0)) {
            userRewardPerTokenPaid[user] = rewardPerToken;
        }
        
        rewardPool.lastUpdateTime = block.timestamp;
    }
    
    // ============ View Functions ============
    
    function getPendingReward(address user) external view returns (uint256) {
        StakeInfo storage stakeInfo = stakes[user];
        if (stakeInfo.amount == 0) return pendingRewards[user];
        
        uint256 rewardPerToken = rewardPool.rewardPerToken;
        uint256 pending = (stakeInfo.amount * (rewardPerToken - userRewardPerTokenPaid[user])) / 10**18;
        
        return pendingRewards[user] + pending;
    }
    
    function getStakeInfo(address user) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 lockedUntil,
        bool isLocked
    ) {
        StakeInfo storage stakeInfo = stakes[user];
        return (
            stakeInfo.amount,
            stakeInfo.startTime,
            stakeInfo.lockedUntil,
            block.timestamp < stakeInfo.lockedUntil
        );
    }
    
    // ============ Admin ============
    
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
```

### 3.3 代币分发服务

```javascript
// server/services/ChipService.js
class ChipService {
  constructor(tronWeb, chipAddress, stakingAddress) {
    this.tronWeb = tronWeb;
    this.chipAddress = chipAddress;
    this.stakingAddress = stakingAddress;
    this.chipContract = null;
    this.stakingContract = null;
    
    // 分发参数
    this.gameRewardRate = 10 * 1e6; // 每局奖励 10 CHIP
    this.vipDiscountRate = 2000;    // VIP免除20%抽水
  }

  async init() {
    this.chipContract = await this.tronWeb.contract().at(this.chipAddress);
    this.stakingContract = await this.tronWeb.contract().at(this.stakingAddress);
  }

  /**
   * 游戏结束 - 发放CHIP奖励
   */
  async rewardGameplay(playerAddress, gameType, result) {
    try {
      // 根据游戏类型计算奖励
      let reward = this.gameRewardRate;
      
      // 锦标赛奖励更多
      if (gameType === 'tournament') {
        reward *= 2;
      }
      
      // 铸造CHIP奖励
      await this.chipContract.mint(playerAddress, reward).send();
      
      return reward;
    } catch (error) {
      console.error('[ChipService] Reward error:', error);
      return 0;
    }
  }

  /**
   * 计算VIP抽水折扣
   */
  async calculateVIPDiscount(playerAddress) {
    try {
      const balance = await this.chipContract.balanceOf(playerAddress).call();
      const stakeInfo = await this.stakingContract.getStakeInfo(playerAddress).call();
      
      // 持有或质押超过10000 CHIP = VIP
      const vipThreshold = 10000 * 1e6;
      const isVIP = balance.toNumber() >= vipThreshold || 
                    stakeInfo.amount.toNumber() >= vipThreshold;
      
      return isVIP ? this.vipDiscountRate : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取用户CHIP信息
   */
  async getUserInfo(playerAddress) {
    const balance = await this.chipContract.balanceOf(playerAddress).call();
    const stakeInfo = await this.stakingContract.getStakeInfo(playerAddress).call();
    const pendingReward = await this.stakingContract.getPendingReward(playerAddress).call();
    
    return {
      balance: balance.toNumber(),
      staked: stakeInfo.amount.toNumber(),
      pendingReward: pendingReward.toNumber(),
      isLocked: stakeInfo.isLocked
    };
  }

  /**
   * 将平台抽水注入质押奖励池
   */
  async distributeRakeToStakers(amount) {
    try {
      // 将TRX转换为CHIP (假设有兑换机制)
      // 或直接用平台CHIP注入
      
      await this.chipContract.approve(this.stakingAddress, amount).send();
      await this.stakingContract.addReward(amount).send();
      
      return true;
    } catch (error) {
      console.error('[ChipService] Distribute error:', error);
      return false;
    }
  }
}

module.exports = ChipService;
```

---

## 四、DAO治理系统 (Phase 4)

### 4.1 Governance.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ChipToken.sol";

/**
 * @title Governance
 * @dev DAO治理合约 - CHIP持有者投票
 */
contract Governance is Ownable, ReentrancyGuard {
    
    // ============ Enums ============
    
    enum ProposalState { PENDING, ACTIVE, SUCCEEDED, DEFEATED, EXECUTED, EXPIRED }
    enum ProposalType { RAKE_RATE, NFT_LIMIT, NEW_ACHIEVEMENT, EMERGENCY_PAUSE }
    
    // ============ Structs ============
    
    struct Proposal {
        uint256 id;
        ProposalType pType;
        string description;
        bytes callData;         // 执行数据
        address target;         // 目标合约
        
        uint256 startTime;
        uint256 endTime;
        uint256 quorum;         // 法定人数 (basis points)
        
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        
        mapping(address => Vote) votes;
        ProposalState state;
        
        address proposer;
        bool executed;
    }
    
    struct Vote {
        bool hasVoted;
        uint8 support;          // 0=against, 1=for, 2=abstain
        uint256 weight;
    }
    
    // ============ State Variables ============
    
    ChipToken public chipToken;
    
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    
    // 参数
    uint256 public votingDelay = 1 days;      // 投票延迟
    uint256 public votingPeriod = 3 days;     // 投票期
    uint256 public quorumThreshold = 1000;    // 10% 法定人数
    uint256 public proposalThreshold = 1000 * 10**6; // 提案门槛 1000 CHIP
    
    // ============ Events ============
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        ProposalType pType,
        string description
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        uint8 support,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event ProposalStateChanged(uint256 indexed proposalId, ProposalState newState);
    
    // ============ Constructor ============
    
    constructor(address _chipToken) {
        chipToken = ChipToken(_chipToken);
    }
    
    // ============ Proposal Functions ============
    
    /**
     * @dev 创建提案
     */
    function createProposal(
        ProposalType pType,
        string calldata description,
        address target,
        bytes calldata callData
    ) external returns (uint256) {
        // 检查提案门槛
        uint256 balance = chipToken.balanceOf(msg.sender);
        require(balance >= proposalThreshold, "Below threshold");
        
        uint256 proposalId = ++proposalCount;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.pType = pType;
        proposal.description = description;
        proposal.target = target;
        proposal.callData = callData;
        proposal.proposer = msg.sender;
        proposal.startTime = block.timestamp + votingDelay;
        proposal.endTime = block.timestamp + votingDelay + votingPeriod;
        proposal.quorum = quorumThreshold;
        proposal.state = ProposalState.PENDING;
        
        emit ProposalCreated(proposalId, msg.sender, pType, description);
        
        return proposalId;
    }
    
    /**
     * @dev 投票
     */
    function castVote(uint256 proposalId, uint8 support) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id != 0, "Proposal not exist");
        require(block.timestamp >= proposal.startTime, "Not started");
        require(block.timestamp < proposal.endTime, "Ended");
        require(!proposal.votes[msg.sender].hasVoted, "Already voted");
        require(support <= 2, "Invalid support");
        
        // 获取投票权重 (CHIP余额快照)
        uint256 weight = chipToken.balanceOf(msg.sender);
        require(weight > 0, "No voting power");
        
        // 记录投票
        proposal.votes[msg.sender] = Vote({
            hasVoted: true,
            support: support,
            weight: weight
        });
        
        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }
        
        emit Voted(proposalId, msg.sender, support, weight);
    }
    
    /**
     * @dev 执行提案
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.id != 0, "Proposal not exist");
        require(block.timestamp >= proposal.endTime, "Not ended");
        require(!proposal.executed, "Already executed");
        
        // 更新状态
        _updateState(proposalId);
        
        require(proposal.state == ProposalState.SUCCEEDED, "Proposal not passed");
        
        // 执行
        proposal.executed = true;
        
        (bool success,) = proposal.target.call(proposal.callData);
        
        proposal.state = success ? ProposalState.EXECUTED : ProposalState.EXPIRED;
        
        emit ProposalExecuted(proposalId, success);
    }
    
    // ============ State Functions ============
    
    function _updateState(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        if (block.timestamp < proposal.startTime) {
            proposal.state = ProposalState.PENDING;
        } else if (block.timestamp < proposal.endTime) {
            proposal.state = ProposalState.ACTIVE;
        } else {
            // 检查是否通过
            uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
            uint256 totalSupply = chipToken.totalSupply();
            
            bool quorumReached = (totalVotes * 10000) >= (totalSupply * proposal.quorum);
            bool forWins = proposal.forVotes > proposal.againstVotes;
            
            if (quorumReached && forWins) {
                proposal.state = ProposalState.SUCCEEDED;
            } else {
                proposal.state = ProposalState.DEFEATED;
            }
        }
        
        emit ProposalStateChanged(proposalId, proposal.state);
    }
    
    // ============ View Functions ============
    
    function getProposalState(uint256 proposalId) external view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.executed) return ProposalState.EXECUTED;
        if (block.timestamp < proposal.startTime) return ProposalState.PENDING;
        if (block.timestamp < proposal.endTime) return ProposalState.ACTIVE;
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalSupply = chipToken.totalSupply();
        
        bool quorumReached = (totalVotes * 10000) >= (totalSupply * proposal.quorum);
        bool forWins = proposal.forVotes > proposal.againstVotes;
        
        if (quorumReached && forWins) {
            return ProposalState.SUCCEEDED;
        } else {
            return ProposalState.DEFEATED;
        }
    }
    
    function getProposalInfo(uint256 proposalId) external view returns (
        ProposalType pType,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        ProposalState state,
        bool executed
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.pType,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            this.getProposalState(proposalId),
            proposal.executed
        );
    }
    
    function hasVoted(uint256 proposalId, address voter) external view returns (bool, uint8, uint256) {
        Vote storage v = proposals[proposalId].votes[voter];
        return (v.hasVoted, v.support, v.weight);
    }
    
    // ============ Admin Functions ============
    
    function setVotingDelay(uint256 delay) external onlyOwner {
        votingDelay = delay;
    }
    
    function setVotingPeriod(uint256 period) external onlyOwner {
        votingPeriod = period;
    }
    
    function setQuorumThreshold(uint256 threshold) external onlyOwner {
        require(threshold <= 5000, "Max 50%");
        quorumThreshold = threshold;
    }
    
    function setProposalThreshold(uint256 threshold) external onlyOwner {
        proposalThreshold = threshold;
    }
}
```

### 4.2 DAO服务

```javascript
// server/services/DAOService.js
class DAOService {
  constructor(tronWeb, governanceAddress) {
    this.tronWeb = tronWeb;
    this.governanceAddress = governanceAddress;
    this.contract = null;
  }

  async init() {
    this.contract = await this.tronWeb.contract().at(this.governanceAddress);
  }

  /**
   * 创建提案
   */
  async createProposal(proposer, type, description, target, callData) {
    try {
      const tx = await this.contract.createProposal(
        type,
        description,
        target,
        callData
      ).send({ from: proposer });
      
      return tx;
    } catch (error) {
      console.error('[DAOService] Create proposal error:', error);
      throw error;
    }
  }

  /**
   * 创建抽水调整提案
   */
  async createRakeRateProposal(proposer, newRate) {
    const target = this.gameContractAddress;
    const callData = this.encodeSetRakeRate(newRate);
    
    return this.createProposal(
      proposer,
      0, // RAKE_RATE
      `Adjust rake rate to ${newRate / 100}%`,
      target,
      callData
    );
  }

  /**
   * 获取活跃提案
   */
  async getActiveProposals() {
    const count = await this.contract.proposalCount().call();
    const proposals = [];
    
    for (let i = 1; i <= count.toNumber(); i++) {
      const state = await this.contract.getProposalState(i).call();
      
      if (state === 1) { // ACTIVE
        const info = await this.contract.getProposalInfo(i).call();
        proposals.push({
          id: i,
          type: info.pType,
          description: info.description,
          forVotes: info.forVotes.toNumber(),
          againstVotes: info.againstVotes.toNumber(),
          endTime: info.endTime.toNumber() * 1000
        });
      }
    }
    
    return proposals;
  }

  /**
   * 编码函数调用
   */
  encodeSetRakeRate(rate) {
    return this.tronWeb.utils.abi.encodeParams(
      ['uint256'],
      [rate]
    );
  }
}

module.exports = DAOService;
```

---

## 五、部署配置

### 5.1 部署脚本

```javascript
// migrations/2_deploy_features.js
const Tournament = artifacts.require("Tournament");
const AchievementNFT = artifacts.require("AchievementNFT");
const ChipToken = artifacts.require("ChipToken");
const Staking = artifacts.require("Staking");
const Governance = artifacts.require("Governance");

module.exports = async function(deployer, network) {
  
  // 获取配置
  const serverWallet = "TXxx..."; // 服务端钱包
  const signerPK = "xxx...";       // NFT签名私钥
  
  // 1. 部署锦标赛合约
  await deployer.deploy(Tournament, serverWallet);
  const tournament = await Tournament.deployed();
  console.log("Tournament:", tournament.address);
  
  // 2. 部署NFT合约
  const signer = tronWeb.address.fromPrivateKey(signerPK);
  await deployer.deploy(AchievementNFT, signer);
  const nft = await AchievementNFT.deployed();
  console.log("AchievementNFT:", nft.address);
  
  // 3. 部署CHIP代币
  await deployer.deploy(ChipToken);
  const chip = await ChipToken.deployed();
  console.log("ChipToken:", chip.address);
  
  // 4. 部署质押合约
  await deployer.deploy(Staking, chip.address);
  const staking = await Staking.deployed();
  console.log("Staking:", staking.address);
  
  // 5. 部署DAO
  await deployer.deploy(Governance, chip.address);
  const governance = await Governance.deployed();
  console.log("Governance:", governance.address);
  
  // 6. 配置权限
  await chip.addMinter(staking.address);
  await chip.addMinter(serverWallet);
  
  console.log("\n=== Deployment Complete ===");
  console.log("Tournament:", tournament.address);
  console.log("AchievementNFT:", nft.address);
  console.log("ChipToken:", chip.address);
  console.log("Staking:", staking.address);
  console.log("Governance:", governance.address);
};
```

---

## 六、实现优先级

| 阶段 | 功能 | 合约 | 后端服务 | 预计时间 |
|------|------|------|---------|---------|
| **Phase 1** | 锦标赛 | Tournament.sol | TournamentService.js | 2周 |
| **Phase 2** | NFT | AchievementNFT.sol | NFTService.js | 1.5周 |
| **Phase 3** | CHIP+质押 | ChipToken.sol, Staking.sol | ChipService.js | 2周 |
| **Phase 4** | DAO | Governance.sol | DAOService.js | 1.5周 |

**总计: 约7周完成全部功能**
