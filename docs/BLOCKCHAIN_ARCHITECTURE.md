# 区块链德州扑克游戏架构设计方案

> **重要说明**：当前代码库实现的是 **德州扑克 (Texas Hold'em)**，而非桥牌。以下方案基于德州扑克游戏逻辑设计。

---

## 一、当前系统架构分析

### 1.1 现有架构概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           当前系统架构                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                        前端 (React)                              │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│   │  │ Landing  │  │   Play   │  │ Connect  │  │   Context API    │ │  │
│   │  │  Page    │  │   Page   │  │  Wallet  │  │ (Global+Game)    │ │  │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │  │
│   │                              │                                   │  │
│   │                              ▼                                   │  │
│   │                    ┌─────────────────┐                          │  │
│   │                    │  MetaMask/ethers│  ← 当前钱包方案           │  │
│   │                    └─────────────────┘                          │  │
│   └──────────────────────────────┬──────────────────────────────────┘  │
│                                  │                                     │
│                                  │ Socket.IO (WebSocket)               │
│                                  ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                        后端 (Node.js)                            │  │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│   │  │ Express  │  │ Socket.IO│  │  Table   │  │     Player       │ │  │
│   │  │  Server  │  │  Handler │  │  Logic   │  │    Management    │ │  │
│   │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │  │
│   │                                                                  │  │
│   │  ⚠️ 虚拟筹码系统 (config.INITIAL_CHIPS_AMOUNT = 100000)          │  │
│   │  ⚠️ 内存存储 (无持久化)                                          │  │
│   │  ⚠️ 无区块链集成                                                 │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心数据流

```
玩家连接 → Socket建立 → 获取虚拟筹码 → 加入牌桌 → 游戏循环 → 赢家确定
    │                                                      │
    │                                                      ▼
    │                                            更新内存中的筹码
    │                                                      │
    └──────────────────────────────────────────────────────┘
                   ⚠️ 无链上验证，无真实资金
```

### 1.3 需要改造的关键点

| 模块 | 当前状态 | 需要改造 |
|------|----------|----------|
| 钱包集成 | MetaMask/ethers | TronLink/TronWeb |
| 筹码系统 | 虚拟筹码 (内存) | TRX/BRIDGE 代币 |
| 游戏结算 | 内存更新 | 智能合约执行 |
| 状态存储 | 内存 (无持久化) | 数据库 + 链上验证 |
| 随机数 | 服务端生成 | 链上VRF |

---

## 二、区块链集成整体架构

### 2.1 三层架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        区块链游戏三层架构                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Layer 3: 前端应用层                                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │  │
│   │  │   React UI   │  │  TronWeb.js  │  │   Socket.IO Client      │   │  │
│   │  │  (游戏界面)   │  │ (链交互SDK)   │  │   (实时通信)             │   │  │
│   │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │  │
│   │                              │                                      │  │
│   │                              ▼                                      │  │
│   │                    ┌─────────────────┐                              │  │
│   │                    │   TronLink      │  ← 钱包签名/交易              │  │
│   │                    │   Extension     │                              │  │
│   │                    └─────────────────┘                              │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    │ Tron RPC / WebSocket                  │
│                                    ▼                                       │
│   Layer 2: 后端服务层                                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │  │
│   │  │  Game Server │  │  API Server  │  │   Blockchain Service     │   │  │
│   │  │  (游戏逻辑)   │  │  (REST API)  │  │   (链上交互封装)          │   │  │
│   │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │  │
│   │         │                  │                      │                 │  │
│   │         ▼                  ▼                      ▼                 │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │  │
│   │  │  Redis       │  │  PostgreSQL  │  │   Event Listener         │   │  │
│   │  │  (游戏状态)   │  │  (用户数据)   │  │   (链上事件监听)          │   │  │
│   │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    │ JSON-RPC                              │
│                                    ▼                                       │
│   Layer 1: 区块链层                                                          │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  ┌──────────────────────────────────────────────────────────────┐   │  │
│   │  │                    Tron Network                               │   │  │
│   │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │   │  │
│   │  │  │  GameContract  │  │ BridgeToken    │  │   VRF Oracle   │   │   │  │
│   │  │  │  (游戏主合约)   │  │ (TRC20代币)    │  │   (随机数)     │   │   │  │
│   │  │  └────────────────┘  └────────────────┘  └────────────────┘   │   │  │
│   │  └──────────────────────────────────────────────────────────────┘   │  │
│   │                                                                      │  │
│   │  Nile Testnet (开发测试) ←→ Mainnet (生产环境)                       │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 三、智能合约架构设计

### 3.1 合约模块划分

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          智能合约架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                    BridgeGame.sol (主合约)                           │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │  状态变量:                                                    │   │  │
│   │   │  - mapping(address => uint256) public playerBalances         │   │  │
│   │   │  - mapping(uint256 => GameSession) public games              │   │  │
│   │   │  - uint256 public minBuyIn                                   │   │  │
│   │   │  - uint256 public maxBuyIn                                   │   │  │
│   │   │  - address public owner                                      │   │  │
│   │   │  - bool public paused                                        │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   │                                                                      │  │
│   │   ┌─────────────────────────────────────────────────────────────┐   │  │
│   │   │  核心函数:                                                    │   │  │
│   │   │  ┌──────────────────┐  ┌──────────────────┐                 │   │  │
│   │   │  │ deposit()        │  │ withdraw()       │  ← 资金管理      │   │  │
│   │   │  │ joinTable()      │  │ leaveTable()     │  ← 牌桌操作      │   │  │
│   │   │  │ startGame()      │  │ settleGame()     │  ← 游戏生命周期  │   │  │
│   │   │  │ commitAction()   │  │ revealAction()   │  ← 提交-揭示模式  │   │  │
│   │   │  └──────────────────┘  └──────────────────┘                 │   │  │
│   │   └─────────────────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    │ 继承/调用                              │
│                                    ▼                                       │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌───────────────────┐  │
│   │  BridgeToken.sol    │  │  VRFConsumer.sol    │  │  GameSecurity.sol │  │
│   │  (TRC20 代币)       │  │  (随机数消费)       │  │  (安全模块)        │  │
│   │                     │  │                     │  │                   │  │
│   │  - mint()           │  │ - requestRandom()   │  │ - Pausable        │  │
│   │  - burn()           │  │ - fulfillRandom()   │  │ - ReentrancyGuard │  │
│   │  - transfer()       │  │                     │  │ - Ownable         │  │
│   └─────────────────────┘  └─────────────────────┘  └───────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 一期合约设计（直接TRX结算）

```solidity
// BridgeGameV1.sol - 一期：直接TRX结算

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeGameV1
 * @dev 一期版本：直接使用TRX进行游戏结算
 */
contract BridgeGameV1 is ReentrancyGuard, Pausable, Ownable {
    
    // ============ 数据结构 ============
    
    struct Player {
        uint256 balance;        // 合约内余额
        uint256 lockedAmount;   // 锁定金额（游戏中）
        bool isRegistered;
    }
    
    struct GameSession {
        uint256 tableId;
        address[] players;
        uint256 pot;
        uint256 createdAt;
        GameState state;
        bytes32 commitHash;      // 提交-揭示模式的哈希
        uint256 randomSeed;      // 揭示后的随机种子
    }
    
    enum GameState {
        WAITING,      // 等待玩家
        PLAYING,      // 游戏进行中
        SETTLING,     // 结算中
        FINISHED      // 已结束
    }
    
    // ============ 状态变量 ============
    
    mapping(address => Player) public players;
    mapping(uint256 => GameSession) public gameSessions;
    mapping(uint256 => address) public tableOwners;
    
    uint256 public constant MIN_BUY_IN = 10 * 1e6;    // 最小买入 10 TRX (sun单位)
    uint256 public constant MAX_BUY_IN = 1000 * 1e6;  // 最大买入 1000 TRX
    uint256 public constant RAKE_RATE = 250;          // 抽水率 2.5% (basis points)
    uint256 public constant MAX_RAKE = 10 * 1e6;      // 最大抽水 10 TRX
    
    uint256 public gameCounter;
    uint256 public totalVolume;
    uint256 public totalRake;
    
    // ============ 事件 ============
    
    event PlayerRegistered(address indexed player, uint256 timestamp);
    event Deposited(address indexed player, uint256 amount);
    event Withdrawn(address indexed player, uint256 amount);
    event GameStarted(uint256 indexed tableId, uint256 gameId, address[] players);
    event PotUpdated(uint256 indexed gameId, uint256 newPot);
    event GameSettled(uint256 indexed gameId, address[] winners, uint256[] amounts);
    event RakeCollected(uint256 indexed gameId, uint256 rakeAmount);
    
    // ============ 修饰符 ============
    
    modifier onlyRegistered() {
        require(players[msg.sender].isRegistered, "Player not registered");
        _;
    }
    
    modifier onlyTableOwner(uint256 tableId) {
        require(tableOwners[tableId] == msg.sender, "Not table owner");
        _;
    }
    
    // ============ 核心函数 ============
    
    /**
     * @dev 玩家注册
     */
    function registerPlayer() external {
        require(!players[msg.sender].isRegistered, "Already registered");
        
        players[msg.sender] = Player({
            balance: 0,
            lockedAmount: 0,
            isRegistered: true
        });
        
        emit PlayerRegistered(msg.sender, block.timestamp);
    }
    
    /**
     * @dev 存入TRX到合约
     */
    function deposit() external payable onlyRegistered whenNotPaused {
        require(msg.value >= MIN_BUY_IN, "Below minimum buy-in");
        require(msg.value <= MAX_BUY_IN, "Exceeds maximum buy-in");
        
        players[msg.sender].balance += msg.value;
        
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev 提取TRX
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        Player storage player = players[msg.sender];
        require(player.balance >= amount, "Insufficient balance");
        
        player.balance -= amount;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @dev 加入牌桌并锁定筹码
     * @param tableId 牌桌ID
     * @param buyInAmount 买入金额
     */
    function joinTable(uint256 tableId, uint256 buyInAmount) 
        external 
        onlyRegistered 
        whenNotPaused 
    {
        Player storage player = players[msg.sender];
        
        require(player.balance >= buyInAmount, "Insufficient balance");
        require(buyInAmount >= MIN_BUY_IN, "Below minimum buy-in");
        require(buyInAmount <= MAX_BUY_IN, "Exceeds maximum buy-in");
        
        // 锁定筹码
        player.balance -= buyInAmount;
        player.lockedAmount += buyInAmount;
        
        // 初始化或更新游戏会话
        if (gameSessions[tableId].state == GameState.WAITING) {
            gameSessions[tableId].tableId = tableId;
            gameSessions[tableId].state = GameState.PLAYING;
        }
        
        gameSessions[tableId].players.push(msg.sender);
    }
    
    /**
     * @dev 提交游戏动作（哈希）
     * @param gameId 游戏ID
     * @param commitHash 动作哈希
     */
    function commitAction(uint256 gameId, bytes32 commitHash) external {
        GameSession storage session = gameSessions[gameId];
        require(session.state == GameState.PLAYING, "Game not in progress");
        
        session.commitHash = commitHash;
    }
    
    /**
     * @dev 揭示游戏结果
     * @param gameId 游戏ID
     * @param winners 赢家地址数组
     * @param amounts 赢得金额数组
     * @param randomSeed 随机种子
     * @param proof 验证证明
     */
    function revealAndSettle(
        uint256 gameId,
        address[] calldata winners,
        uint256[] calldata amounts,
        uint256 randomSeed,
        bytes calldata proof
    ) external onlyTableOwner(gameId) nonReentrant {
        GameSession storage session = gameSessions[gameId];
        
        require(session.state == GameState.PLAYING, "Game not in progress");
        require(winners.length == amounts.length, "Array length mismatch");
        
        // 验证提交-揭示
        bytes32 expectedHash = keccak256(abi.encodePacked(
            winners, amounts, randomSeed, proof
        ));
        require(session.commitHash == expectedHash, "Invalid reveal");
        
        session.state = GameState.SETTLING;
        session.randomSeed = randomSeed;
        
        uint256 totalPayout = 0;
        
        for (uint256 i = 0; i < winners.length; i++) {
            address winner = winners[i];
            uint256 amount = amounts[i];
            
            // 计算抽水
            uint256 rake = (amount * RAKE_RATE) / 10000;
            if (rake > MAX_RAKE) rake = MAX_RAKE;
            
            uint256 payout = amount - rake;
            
            // 更新玩家余额
            players[winner].balance += payout;
            players[winner].lockedAmount -= amount;
            
            totalPayout += payout;
            totalRake += rake;
        }
        
        session.state = GameState.FINISHED;
        
        emit GameSettled(gameId, winners, amounts);
        emit RakeCollected(gameId, totalRake);
    }
    
    /**
     * @dev 紧急暂停
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev 解除暂停
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev 提取合约余额（仅owner）
     */
    function withdrawContractBalance() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    // ============ 查询函数 ============
    
    function getPlayerBalance(address player) external view returns (uint256) {
        return players[player].balance;
    }
    
    function getGameSession(uint256 gameId) external view returns (
        uint256 tableId,
        address[] memory players_,
        uint256 pot,
        GameState state
    ) {
        GameSession storage session = gameSessions[gameId];
        return (
            session.tableId,
            session.players,
            session.pot,
            session.state
        );
    }
}
```

### 3.3 二期合约设计（BRIDGE代币经济）

```solidity
// BridgeToken.sol - TRC20 游戏代币

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BridgeToken
 * @dev 游戏内代币，固定汇率兑换
 */
contract BridgeToken is ERC20, Ownable {
    
    uint256 public constant EXCHANGE_RATE = 100;  // 1 TRX = 100 BRIDGE
    uint256 public constant MIN_EXCHANGE = 1 * 1e6;   // 最小兑换 1 TRX
    uint256 public constant MAX_DAILY_EXCHANGE = 1000 * 1e6; // 每日上限 1000 TRX
    
    address public gameContract;
    
    mapping(address => uint256) public dailyExchanged;
    mapping(address => uint256) public lastExchangeDay;
    
    event TokensMinted(address indexed to, uint256 trxAmmount, uint256 tokenAmount);
    event TokensBurned(address indexed from, uint256 tokenAmount, uint256 trxAmount);
    
    constructor() ERC20("Bridge Poker Token", "BRIDGE") {}
    
    /**
     * @dev 设置游戏合约地址
     */
    function setGameContract(address _gameContract) external onlyOwner {
        gameContract = _gameContract;
    }
    
    /**
     * @dev 用TRX购买BRIDGE代币
     */
    function mintTokens() external payable {
        require(msg.value >= MIN_EXCHANGE, "Below minimum exchange");
        
        // 检查每日限制
        uint256 currentDay = block.timestamp / 1 days;
        if (lastExchangeDay[msg.sender] != currentDay) {
            dailyExchanged[msg.sender] = 0;
            lastExchangeDay[msg.sender] = currentDay;
        }
        
        require(
            dailyExchanged[msg.sender] + msg.value <= MAX_DAILY_EXCHANGE,
            "Daily limit exceeded"
        );
        
        dailyExchanged[msg.sender] += msg.value;
        
        // 计算代币数量 (TRX * 100)
        uint256 tokenAmount = msg.value * EXCHANGE_RATE;
        
        _mint(msg.sender, tokenAmount);
        
        emit TokensMinted(msg.sender, msg.value, tokenAmount);
    }
    
    /**
     * @dev 销毁BRIDGE兑换TRX（仅游戏合约可调用）
     * 注意：二期单向兑换，此函数可选择性实现
     */
    function burnTokens(uint256 tokenAmount) external {
        require(msg.sender == gameContract, "Only game contract");
        
        uint256 trxAmount = tokenAmount / EXCHANGE_RATE;
        
        _burn(msg.sender, tokenAmount);
        
        (bool success, ) = payable(msg.sender).call{value: trxAmount}("");
        require(success, "Transfer failed");
        
        emit TokensBurned(msg.sender, tokenAmount, trxAmount);
    }
}
```

---

## 四、游戏流程设计

### 4.1 完整游戏流程（链上结算版）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         链上游戏完整流程                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   阶段1: 玩家准备                                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   ┌────────────┐    ┌────────────┐    ┌────────────┐               │  │
│   │   │ 连接钱包    │───▶│ 查询余额    │───▶│ 存入TRX    │               │  │
│   │   │ (TronLink) │    │ (链上查询)  │    │ (合约deposit)│              │  │
│   │   └────────────┘    └────────────┘    └────────────┘               │  │
│   │         │                                     │                     │  │
│   │         │                                     ▼                     │  │
│   │         │                            ┌────────────┐                │  │
│   │         │                            │ 确认交易    │                │  │
│   │         │                            │ (等待上链)  │                │  │
│   │         │                            └────────────┘                │  │
│   │         │                                     │                     │  │
│   │         └─────────────────────────────────────┘                     │  │
│   │                              │                                      │  │
│   └──────────────────────────────┼──────────────────────────────────────┘  │
│                                  │                                         │
│                                  ▼                                         │
│   阶段2: 游戏进行 (混合模式: 链下游戏 + 链上验证)                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   ┌────────────────┐                                               │  │
│   │   │  服务端游戏逻辑  │ ← 保持现有Socket.IO实时通信                   │  │
│   │   │  (链下快速执行)  │   (每局游戏不触发链上交易)                    │  │
│   │   └───────┬────────┘                                               │  │
│   │           │                                                         │  │
│   │           │ 实时广播                                                │  │
│   │           ▼                                                         │  │
│   │   ┌────────────────┐                                               │  │
│   │   │  牌桌状态同步   │  Fold/Check/Call/Raise                       │  │
│   │   │  (WebSocket)   │  15秒超时自动Fold                             │  │
│   │   └───────┬────────┘                                               │  │
│   │           │                                                         │  │
│   │           │ 游戏结束                                                │  │
│   │           ▼                                                         │  │
│   │   ┌────────────────┐                                               │  │
│   │   │  生成结算数据   │  winners[], amounts[]                        │  │
│   │   │  (服务端计算)   │  randomSeed, proof                           │  │
│   │   └───────┬────────┘                                               │  │
│   │           │                                                         │  │
│   └───────────┼─────────────────────────────────────────────────────────┘  │
│               │                                                             │
│               ▼                                                             │
│   阶段3: 链上结算                                                            │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   ┌────────────┐    ┌────────────┐    ┌────────────┐               │  │
│   │   │ 服务端提交  │───▶│ 合约验证    │───▶│ 执行结算    │               │  │
│   │   │ commitHash │    │ reveal     │    │ distribute │               │  │
│   │   └────────────┘    └────────────┘    └────────────┘               │  │
│   │         │                                     │                     │  │
│   │         │                                     ▼                     │  │
│   │         │                            ┌────────────┐                │  │
│   │         │                            │ 更新余额    │                │  │
│   │         │                            │ 收取抽水    │                │  │
│   │         │                            └────────────┘                │  │
│   │         │                                     │                     │  │
│   │         └─────────────────────────────────────┘                     │  │
│   │                              │                                      │  │
│   └──────────────────────────────┼──────────────────────────────────────┘  │
│                                  │                                         │
│                                  ▼                                         │
│   阶段4: 提现                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │   ┌────────────┐    ┌────────────┐    ┌────────────┐               │  │
│   │   │ 玩家请求    │───▶│ 合约验证    │───▶│ TRX转账    │               │  │
│   │   │ withdraw   │    │ 余额检查    │    │ 到钱包     │               │  │
│   │   └────────────┘    └────────────┘    └────────────┘               │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 关键设计决策：混合架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        混合架构设计决策                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ❌ 纯链上方案 (不可行)                                                     │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  每个游戏动作(Fold/Check/Call/Raise)都需要上链                       │  │
│   │  - Tron 出块时间: ~3秒                                               │  │
│   │  - 每局游戏约20个动作 × 3秒 = 60秒+                                   │  │
│   │  - Gas费用累积过高                                                   │  │
│   │  - 用户体验极差                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ✅ 混合方案 (推荐)                                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  链下: 游戏逻辑实时执行 (Socket.IO)                                   │  │
│   │  链上: 仅在结算时交互一次                                             │  │
│   │                                                                      │  │
│   │  优势:                                                               │  │
│   │  - 游戏体验与现有系统一致 (毫秒级响应)                                │  │
│   │  - Gas费用仅结算时产生一次                                           │  │
│   │  - 资金安全由智能合约保障                                            │  │
│   │                                                                      │  │
│   │  风险与对策:                                                         │  │
│   │  - 服务端作恶风险 → 提交-揭示模式 + 签名验证                          │  │
│   │  - 玩家掉线风险 → 超时自动结算机制                                   │  │
│   │  - 数据篡改风险 → 游戏过程哈希上链                                   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 五、技术栈详细设计

### 5.1 前端改造方案

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          前端技术栈改造                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   当前技术栈                          目标技术栈                             │
│   ┌──────────────────┐              ┌──────────────────┐                   │
│   │ MetaMask/ethers  │   ────────▶  │ TronLink/TronWeb │                   │
│   └──────────────────┘              └──────────────────┘                   │
│                                                                             │
│   新增依赖:                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  npm install tronweb --save                                         │  │
│   │                                                                      │  │
│   │  // tronweb 配置                                                     │  │
│   │  import TronWeb from 'tronweb';                                     │  │
│   │                                                                      │  │
│   │  const tronWeb = new TronWeb({                                      │  │
│   │    fullHost: 'https://api.trongrid.io',  // 主网                    │  │
│   │    // fullHost: 'https://nile.trongrid.io',  // 测试网              │  │
│   │    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY }    │  │
│   │  });                                                                 │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   核心文件改造:                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │  src/utils/tronInteract.js  (新建 - 替代 interact.js)               │  │
│   │  ┌────────────────────────────────────────────────────────────┐    │  │
│   │  │  export const connectTronLink = async () => {              │    │  │
│   │  │    if (window.tronLink) {                                  │    │  │
│   │  │      const res = await window.tronLink.request({           │    │  │
│   │  │        method: 'tron_requestAccounts'                      │    │  │
│   │  │      });                                                   │    │  │
│   │  │      if (res.code === 200) {                               │    │  │
│   │  │        return {                                            │    │  │
│   │  │          event: 'connected',                               │    │  │
│   │  │          address: window.tronLink.tronWeb.defaultAddress   │    │  │
│   │  │        };                                                  │    │  │
│   │  │      }                                                     │    │  │
│   │  │    }                                                       │    │  │
│   │  │    return { event: 'No Wallet' };                          │    │  │
│   │  │  }                                                         │    │  │
│   │  │                                                           │    │  │
│   │  │  export const getTrxBalance = async (address) => {         │    │  │
│   │  │    return await window.tronLink.tronWeb.trx.getBalance(   │    │  │
│   │  │      address                                              │    │  │
│   │  │    );                                                      │    │  │
│   │  │  }                                                         │    │  │
│   │  │                                                           │    │  │
│   │  │  export const depositToContract = async (amount) => {      │    │  │
│   │  │    const contract = await window.tronLink.tronWeb          │    │  │
│   │  │      .contract(ABI, CONTRACT_ADDRESS);                     │    │  │
│   │  │    return await contract.deposit().send({                 │    │  │
│   │  │      callValue: amount,                                    │    │  │
│   │  │      shouldPollResponse: true                              │    │  │
│   │  │    });                                                     │    │  │
│   │  │  }                                                         │    │  │
│   │  └────────────────────────────────────────────────────────────┘    │  │
│   │                                                                      │  │
│   │  src/context/tron/TronContext.js  (新建 - Tron状态管理)             │  │
│   │  ┌────────────────────────────────────────────────────────────┐    │  │
│   │  │  export const TronProvider = ({ children }) => {           │    │  │
│   │  │    const [tronWeb, setTronWeb] = useState(null);           │    │  │
│   │  │    const [address, setAddress] = useState(null);           │    │  │
│   │  │    const [balance, setBalance] = useState(0);              │    │  │
│   │  │    const [chainId, setChainId] = useState(null);           │    │  │
│   │  │                                                           │    │  │
│   │  │    useEffect(() => {                                       │    │  │
│   │  │      if (window.tronLink) {                                │    │  │
│   │  │        window.tronLink.on('connect', () => {              │    │  │
│   │  │          setTronWeb(window.tronLink.tronWeb);             │    │  │
│   │  │          setAddress(window.tronLink.tronWeb.defaultAddress);│   │  │
│   │  │        });                                                 │    │  │
│   │  │      }                                                     │    │  │
│   │  │    }, []);                                                 │    │  │
│   │  │                                                           │    │  │
│   │  │    // ...                                                  │    │  │
│   │  │  }                                                         │    │  │
│   │  └────────────────────────────────────────────────────────────┘    │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 后端改造方案

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          后端服务架构改造                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   新增服务模块:                                                              │
│                                                                             │
│   server/                                                                   │
│   ├── blockchain/                    (新增)                                │
│   │   ├── index.js                   # 区块链服务入口                       │
│   │   ├── TronService.js             # Tron链交互封装                       │
│   │   ├── ContractService.js         # 合约调用封装                         │
│   │   ├── EventListener.js           # 链上事件监听                         │
│   │   └── TransactionQueue.js        # 交易队列管理                         │
│   │                                                                        │
│   ├── services/                                                             │
│   │   ├── GameSettlementService.js   # 游戏结算服务                         │
│   │   ├── BalanceService.js          # 余额同步服务                         │
│   │   └── SignatureService.js        # 签名验证服务                         │
│   │                                                                        │
│   └── models/                                                               │
│       ├── Player.js                  # 玩家数据模型                         │
│       ├── Game.js                    # 游戏记录模型                         │
│       └── Transaction.js             # 交易记录模型                         │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  TronService.js 核心实现                                             │  │
│   │  ┌────────────────────────────────────────────────────────────┐    │  │
│   │  │  const TronWeb = require('tronweb');                        │    │  │
│   │  │                                                             │    │  │
│   │  │  class TronService {                                        │    │  │
│   │  │    constructor() {                                          │    │  │
│   │  │      this.tronWeb = new TronWeb({                          │    │  │
│   │  │        fullHost: process.env.TRON_FULL_HOST,               │    │  │
│   │  │        privateKey: process.env.OPERATOR_PRIVATE_KEY        │    │  │
│   │  │      });                                                   │    │  │
│   │  │      this.contract = null;                                 │    │  │
│   │  │    }                                                       │    │  │
│   │  │                                                           │    │  │
│   │  │    async init() {                                          │    │  │
│   │  │      this.contract = await this.tronWeb                   │    │  │
│   │  │        .contract(ABI, process.env.CONTRACT_ADDRESS);       │    │  │
│   │  │    }                                                       │    │  │
│   │  │                                                           │    │  │
│   │  │    async getPlayerBalance(address) {                       │    │  │
│   │  │      return await this.contract                           │    │  │
│   │  │        .getPlayerBalance(address).call();                  │    │  │
│   │  │    }                                                       │    │  │
│   │  │                                                           │    │  │
│   │  │    async settleGame(gameId, winners, amounts, proof) {    │    │  │
│   │  │      // 提交哈希                                            │    │  │
│   │  │      const commitHash = this.generateCommitHash(          │    │  │
│   │  │        winners, amounts, proof                             │    │  │
│   │  │      );                                                    │    │  │
│   │  │      await this.contract.commitAction(gameId, commitHash) │    │  │
│   │  │        .send();                                            │    │  │
│   │  │                                                           │    │  │
│   │  │      // 延迟揭示（防止抢跑）                                 │    │  │
│   │  │      await this.delay(3000);                              │    │  │
│   │  │                                                           │    │  │
│   │  │      // 揭示结果                                            │    │  │
│   │  │      return await this.contract.revealAndSettle(          │    │  │
│   │  │        gameId, winners, amounts, proof.randomSeed, proof  │    │  │
│   │  │      ).send();                                             │    │  │
│   │  │    }                                                       │    │  │
│   │  │  }                                                         │    │  │
│   │  └────────────────────────────────────────────────────────────┘    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 六、分阶段实施路线图

### 6.1 一期实施计划（TRX直接结算）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      一期实施计划 (8-12周)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   第1-2周: 基础设施搭建                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ 搭建Tron开发环境                                                  │  │
│   │    - 安装TronBox开发框架                                             │  │
│   │    - 配置Nile测试网                                                  │  │
│   │    - 申请TronGrid API Key                                            │  │
│   │                                                                      │  │
│   │  □ 编写并部署一期合约                                                 │  │
│   │    - BridgeGameV1.sol                                                │  │
│   │    - 本地测试 → 测试网部署                                            │  │
│   │                                                                      │  │
│   │  □ 前端TronLink集成                                                  │  │
│   │    - 替换MetaMask → TronLink                                         │  │
│   │    - 钱包连接、余额查询                                               │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   第3-4周: 核心功能开发                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ 后端区块链服务                                                    │  │
│   │    - TronService.js                                                  │  │
│   │    - ContractService.js                                              │  │
│   │    - 交易队列管理                                                    │  │
│   │                                                                      │  │
│   │  □ 存取款功能                                                        │  │
│   │    - 前端存入TRX界面                                                 │  │
│   │    - 合约deposit调用                                                 │  │
│   │    - 提现功能                                                        │  │
│   │                                                                      │  │
│   │  □ 数据库集成                                                        │  │
│   │    - PostgreSQL/Redis配置                                            │  │
│   │    - 玩家数据持久化                                                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   第5-6周: 游戏结算集成                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ 结算流程改造                                                      │  │
│   │    - 游戏结束触发结算                                                │  │
│   │    - 生成结算数据                                                    │  │
│   │    - 调用合约settleGame                                              │  │
│   │                                                                      │  │
│   │  □ 提交-揭示模式实现                                                 │  │
│   │    - commitHash生成                                                  │  │
│   │    - 延迟揭示逻辑                                                    │  │
│   │    - 防抢跑机制                                                      │  │
│   │                                                                      │  │
│   │  □ 前端结算展示                                                      │  │
│   │    - 交易状态显示                                                    │  │
│   │    - 余额更新通知                                                    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   第7-8周: 测试与优化                                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ 单元测试                                                          │  │
│   │    - 合约测试 (100%覆盖率)                                           │  │
│   │    - 服务端API测试                                                   │  │
│   │    - 前端组件测试                                                    │  │
│   │                                                                      │  │
│   │  □ 集成测试                                                          │  │
│   │    - 端到端游戏流程                                                  │  │
│   │    - 多玩家同时游戏                                                  │  │
│   │    - 异常情况处理                                                    │  │
│   │                                                                      │  │
│   │  □ 测试网公开测试                                                    │  │
│   │    - 部署到Nile测试网                                                │  │
│   │    - 邀请社区测试                                                    │  │
│   │    - 收集反馈并修复                                                  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   第9-12周: 安全审计与主网部署                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ 智能合约审计                                                      │  │
│   │    - 选择审计公司 (CertiK/SlowMist)                                  │  │
│   │    - 修复审计发现的问题                                              │  │
│   │                                                                      │  │
│   │  □ 主网部署准备                                                      │  │
│   │    - 主网合约部署                                                    │  │
│   │    - 服务端配置更新                                                  │  │
│   │    - 监控告警设置                                                    │  │
│   │                                                                      │  │
│   │  □ 灰度发布                                                          │  │
│   │    - 限制玩家数量                                                    │  │
│   │    - 逐步放开限制                                                    │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 二期实施计划（BRIDGE代币经济）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      二期实施计划 (6-8周)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   第1-2周: 代币合约开发                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ BridgeToken.sol开发                                               │  │
│   │    - TRC20标准实现                                                   │  │
│   │    - mint/burn函数                                                   │  │
│   │    - 每日兑换限制                                                    │  │
│   │                                                                      │  │
│   │  □ BridgeGameV2.sol升级                                              │  │
│   │    - 支持BRIDGE代币结算                                              │  │
│   │    - 代币 <-> TRX兑换集成                                            │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   第3-4周: 前端代币功能                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ 代币兑换界面                                                      │  │
│   │    - TRX → BRIDGE                                                    │  │
│   │    - 汇率显示                                                        │  │
│   │    - 兑换限制提示                                                    │  │
│   │                                                                      │  │
│   │  □ 余额显示优化                                                      │  │
│   │    - TRX余额 + BRIDGE余额                                            │  │
│   │    - 总价值折算                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   第5-6周: 测试与上线                                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  □ 测试网测试                                                        │  │
│   │  □ 合约审计                                                          │  │
│   │  □ 主网部署                                                          │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 七、安全设计

### 7.1 安全威胁模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          安全威胁模型分析                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────────┐│
│   │                       威胁类型                                         ││
│   ├───────────────────────────────────────────────────────────────────────┤│
│   │                                                                       ││
│   │   1. 智能合约层                                                        ││
│   │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      ││
│   │   │ 重入攻击         │  │ 整数溢出        │  │ 权限绕过        │      ││
│   │   │ ReentrancyGuard │  │ SafeMath       │  │ AccessControl  │      ││
│   │   └─────────────────┘  └─────────────────┘  └─────────────────┘      ││
│   │                                                                       ││
│   │   2. 游戏逻辑层                                                        ││
│   │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      ││
│   │   │ 服务端作恶       │  │ 玩家合谋        │  │ 抢跑攻击        │      ││
│   │   │ 签名验证         │  │ 行为分析        │  │ commit-reveal  │      ││
│   │   └─────────────────┘  └─────────────────┘  └─────────────────┘      ││
│   │                                                                       ││
│   │   3. 随机数安全                                                        ││
│   │   ┌─────────────────┐  ┌─────────────────┐                           ││
│   │   │ 链上随机数可预测  │  │ 服务端随机数作假  │                           ││
│   │   │ VRF集成         │  │ 链上验证哈希     │                           ││
│   │   └─────────────────┘  └─────────────────┘                           ││
│   │                                                                       ││
│   │   4. 用户资产安全                                                      ││
│   │   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      ││
│   │   │ 私钥泄露         │  │ 钓鱼攻击        │  │ 合约漏洞        │      ││
│   │   │ 用户教育         │  │ 域名验证        │  │ 多重签名        │      ││
│   │   └─────────────────┘  └─────────────────┘  └─────────────────┘      ││
│   │                                                                       ││
│   └───────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│   安全措施清单:                                                              │
│   ┌───────────────────────────────────────────────────────────────────────┐│
│   │                                                                       ││
│   │   ✓ ReentrancyGuard - 防重入                                         ││
│   │   ✓ Pausable - 紧急暂停                                               ││
│   │   ✓ Ownable - 权限控制                                                ││
│   │   ✓ commit-reveal - 防抢跑                                            ││
│   │   ✓ 多重签名 - 大额资金管理                                           ││
│   │   ✓ 时间锁 - 敏感操作延迟                                             ││
│   │   ✓ 限额控制 - 单笔/单日限制                                          ││
│   │   ✓ 事件日志 - 完整审计追踪                                           ││
│   │                                                                       ││
│   └───────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 合规性考量

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            合规性检查清单                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ⚠️ 重要法律风险提示                                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                      │  │
│   │   1. 网络赌博法规                                                    │  │
│   │      - 不同国家/地区对在线赌博有严格法规                             │  │
│   │      - 需要咨询专业法律顾问                                          │  │
│   │      - 考虑地区限制 (Geo-blocking)                                   │  │
│   │                                                                      │  │
│   │   2. KYC/AML 合规                                                   │  │
│   │      - 大额交易可能需要身份验证                                      │  │
│   │      - 反洗钱(AML)政策要求                                           │  │
│   │                                                                      │  │
│   │   3. 代币发行合规                                                    │  │
│   │      - BRIDGE代币可能被认定为证券                                    │  │
│   │      - 需要评估各国证券法规                                          │  │
│   │                                                                      │  │
│   │   4. 建议措施                                                        │  │
│   │      - 设置娱乐模式 (免费/测试网TRX)                                 │  │
│   │      - 年龄验证                                                      │  │
│   │      - 地区限制                                                      │  │
│   │      - 负责任的博彩提示                                              │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 八、关键决策点与建议

### 8.1 需要进一步讨论的问题

| 问题 | 选项A | 选项B | 建议 |
|------|-------|-------|------|
| 随机数方案 | 简化版 (block.timestamp + difficulty) | Chainlink VRF | 一期用简化版测试，二期接入VRF |
| 结算触发方 | 服务端主动触发 | 玩家手动触发 | 服务端触发，更流畅 |
| 资金托管 | 合约托管 | 多签钱包托管 | 合约托管，更透明 |
| 游戏记录 | 仅链上哈希 | 完整链上存储 | 仅哈希，节省gas |
| 代币兑换 | 单向(TRX→BRIDGE) | 双向兑换 | 一期单向，避免投机 |

### 8.2 风险与缓解措施

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          风险缓解措施矩阵                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   高风险                                                                    │
│   ↑                                                                         │
│   │  ┌─────────────────┐        ┌─────────────────┐                        │
│   │  │ 智能合约漏洞     │ ────── │ 第三方审计      │                        │
│   │  │ (资金被盗)       │        │ 多重签名管理    │                        │
│   │  └─────────────────┘        └─────────────────┘                        │
│   │                                                                         │
│   │  ┌─────────────────┐        ┌─────────────────┐                        │
│   │  │ 服务端作恶       │ ────── │ commit-reveal   │                        │
│   │  │ (篡改结果)       │        │ 用户可验证      │                        │
│   │  └─────────────────┘        └─────────────────┘                        │
│   │                                                                         │
│   │  ┌─────────────────┐        ┌─────────────────┐                        │
│   │  │ 网络拥堵         │ ────── │ 交易队列        │                        │
│   │  │ (结算延迟)       │        │ 状态提示        │                        │
│   │  └─────────────────┘        └─────────────────┘                        │
│   │                                                                         │
│   │  ┌─────────────────┐        ┌─────────────────┐                        │
│   │  │ 法律合规风险     │ ────── │ 法律咨询        │                        │
│   │  │ (运营风险)       │        │ 地区限制        │                        │
│   │  └─────────────────┘        └─────────────────┘                        │
│   │                                                                         │
│   └───────────────────────────────────────────────────────────────────────▶│
│      高影响 ◄─────────────────────────────────────────────────────► 低影响  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 九、总结与下一步行动

### 9.1 架构总结

本方案采用**混合架构**设计：

1. **链下游戏逻辑**：保持现有Socket.IO实时通信，确保游戏体验
2. **链上资金管理**：所有TRX/BRIDGE锁定在智能合约中
3. **链上结算验证**：通过commit-reveal机制确保结算公平

### 9.2 立即行动项

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          下一步行动建议                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   □ 确认技术方案是否满足需求                                                │
│   □ 开始一期实施（创建OpenSpec change）                                     │
│   □ 搭建Tron开发环境                                                        │
│   □ 编写BridgeGameV1合约                                                    │
│   □ 前端TronLink集成测试                                                    │
│                                                                             │
│   需要确认的问题：                                                          │
│   1. 是否需要调整抽水率？(当前设计2.5%)                                     │
│   2. 是否需要地区限制功能？                                                 │
│   3. 代币名称确认？(当前设计BRIDGE)                                         │
│   4. 是否需要娱乐模式(测试网TRX)？                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**文档版本**: v1.0  
**创建日期**: 2026-03-12  
**状态**: 待确认
