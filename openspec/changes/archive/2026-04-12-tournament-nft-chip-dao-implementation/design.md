# Design: Tournament, NFT, CHIP Token, and DAO Implementation

## Context

### 当前状态

项目已实现：
- 德州扑克核心游戏逻辑 (`server/pokergame/Table.js`)
- 基础资金托管合约 (`contracts/BridgeGameV2.sol`)
- Socket.io 实时通信
- 用户认证与钱包集成

### 约束条件

| 约束 | 说明 |
|------|------|
| 区块链 | TRON网络，Sun能量模型 |
| MVP周期 | 7周完成全部功能 |
| Gas成本 | MVP由玩家自付，后续可切换平台代付 |
| 现有合约 | BridgeGameV2.sol 不可修改（已部署） |

### 利益相关者

| 角色 | 关注点 |
|------|--------|
| 玩家 | 公平竞技、NFT收藏、代币奖励 |
| 平台运营 | 抽水收入、用户增长、系统稳定 |
| 开发团队 | 代码质量、可维护性、部署安全 |

---

## Goals / Non-Goals

### Goals

1. **锦标赛系统**
   - 支持2/3/6人满员即开，9人定时启动
   - 自动奖金分配，链上结算
   - 复用现有Table.js游戏逻辑

2. **NFT成就系统**
   - 6种牌型成就，月度限量刷新
   - 签名验证防作弊
   - TRC721标准，可交易

3. **CHIP代币与质押**
   - TRC20标准代币
   - 质押分红机制
   - VIP特权（抽水折扣）

4. **DAO治理**
   - CHIP持有者投票
   - 支持抽水比例调整提案
   - 法定人数机制

### Non-Goals

1. **盲注递增** - MVP版本固定盲注，后续版本实现
2. **多游戏并发** - 锦标赛期间不能玩普通游戏
3. **NFT市场** - 仅铸造，交易依赖第三方平台
4. **跨链桥** - 仅支持TRON网络
5. **移动端原生App** - Web端优先

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React/Vue)                      │
├─────────────────────────────────────────────────────────────────┤
│  Tournament Lobby  │  Game Table  │  NFT Gallery  │  DAO Vote   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Express)                        │
├─────────────────────────────────────────────────────────────────┤
│  REST API  │  Socket.io  │  Auth Middleware  │  Rate Limit      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
├─────────────────────────────────────────────────────────────────┤
│ TournamentService │ NFTService │ ChipService │ DAOService       │
├─────────────────────────────────────────────────────────────────┤
│              Game Engine (Table.js / TournamentTable.js)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Smart Contract Layer                          │
├─────────────────────────────────────────────────────────────────┤
│ Tournament │ AchievementNFT │ ChipToken │ Staking │ Governance  │
│                      (BridgeGameV2 - existing)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRON Blockchain                               │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Tournament Flow                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Player] ──报名──> [TournamentService] ──调用──> [Tournament.sol]
│                              │                               │
│                              ▼                               │
│                    [TournamentTable.js]                      │
│                    (游戏逻辑执行)                              │
│                              │                               │
│                              ▼                               │
│                    [TournamentService] ──提交排名──> [Tournament.sol]
│                              │                    ──奖金分配──> [Player]
│                              ▼                               │
│                    [ChipService] ──奖励CHIP──> [Player]      │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    NFT Mint Flow                             │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Player] ──达成牌型──> [Table.js] ──检测──> [NFTService]    │
│                                                    │         │
│                                                    ▼         │
│                                          [生成签名]           │
│                                                    │         │
│                                                    ▼         │
│  [Player] <──签名数据── [NFTService]               │         │
│     │                                              │         │
│     └──调用claimNFT──> [AchievementNFT.sol]        │         │
│                              │                              │
│                              ▼                              │
│                    [验证签名 + 月度限量]                      │
│                              │                              │
│                              ▼                              │
│                    [铸造NFT ──> Player]                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Staking Flow                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [Player] ──approve──> [ChipToken.sol]                      │
│     │                                                       │
│     └──stake──> [Staking.sol]                               │
│                     │                                       │
│                     ▼                                       │
│              [记录质押 + 锁定期]                              │
│                     │                                       │
│                     ▼                                       │
│  [Platform] ──addReward──> [Staking.sol]                    │
│                     │                                       │
│                     ▼                                       │
│              [计算累积奖励]                                   │
│                     │                                       │
│                     ▼                                       │
│  [Player] <──claimReward── [Staking.sol]                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    DAO Governance Flow                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [CHIP Holder] ──createProposal──> [Governance.sol]          │
│                       │                                     │
│                       ▼                                     │
│              [检查门槛(1000 CHIP)]                           │
│                       │                                     │
│                       ▼                                     │
│  [CHIP Holders] ──castVote──> [Governance.sol]              │
│                       │                                     │
│                       ▼                                     │
│              [记录投票权重]                                   │
│                       │                                     │
│                       ▼                                     │
│  [投票结束] ──检查法定人数(10%)──> [SUCCEEDED/DEFEATED]      │
│                       │                                     │
│                       ▼                                     │
│  [Anyone] ──executeProposal──> [目标合约.方法()]            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Decisions

### D1: 锦标赛合约设计

**决策**: 独立Tournament合约，不复用BridgeGameV2

**理由**:
- BridgeGameV2已部署，不可修改
- 锦标赛逻辑（排名、奖金分配）与普通桌游不同
- 独立合约便于升级和维护

**备选方案**:
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 复用BridgeGameV2 | 减少合约数量 | 无法修改，逻辑耦合 | ❌ |
| 新建Tournament合约 | 独立逻辑，可升级 | 多一个合约 | ✅ 采用 |

### D2: NFT月度限量机制

**决策**: 月度刷新限量，非固定总量

**理由**:
- 皇家同花顺概率约0.000154%，固定总量会导致NFT极难获得
- 月度刷新保证稀有NFT的稀缺性，同时给新玩家机会
- 避免早期玩家垄断稀有NFT

**备选方案**:
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 固定总量 | 绝对稀缺 | 皇家同花顺需18年才能产生10个NFT | ❌ |
| 无限量 | 易获取 | 失去稀缺性 | ❌ |
| 月度限量 | 平衡稀缺与可获取 | 需要月度重置逻辑 | ✅ 采用 |

### D3: NFT铸造Gas支付

**决策**: MVP版本玩家自付Gas（约5 TRX）

**理由**:
- 降低平台初期运营成本
- 玩家对高价值NFT愿意支付Gas
- 后续可切换为平台代付

**切换路径**:
```solidity
// 当前实现
function claimNFT(...) external payable {
    require(msg.value >= mintPrice, "Insufficient payment");
    // ...
}

// 未来切换（平台代付）
function claimNFTRelayer(
    address player,
    uint256 typeId,
    bytes memory signature,
    bytes memory relayerSignature
) external {
    // 验证relayer签名
    // 平台钱包支付Gas
    // 玩家免费铸造
}
```

### D4: 锦标赛盲注策略

**决策**: MVP版本固定盲注，不实现递增

**理由**:
- 简化实现，减少MVP开发周期
- 2/3人锦标赛对盲注递增需求不高
- 可在后续版本通过合约升级实现

**后续实现预留**:
```javascript
class TournamentTable extends Table {
  // MVP: 固定盲注
  constructor(tournamentId, maxPlayers, initialChips) {
    super(tournamentId, `Tournament-${tournamentId}`, initialChips * 100, maxPlayers);
    this.minBet = Math.floor(initialChips / 100);
  }
  
  // Future: 盲注递增
  // startBlindIncrease(intervalMinutes, multiplier) {
  //   this.blindInterval = intervalMinutes * 60 * 1000;
  //   this.blindMultiplier = multiplier;
  //   this.blindIncreaseTime = Date.now() + this.blindInterval;
  // }
}
```

### D5: 断线与超时处理

**决策**: 断线自动Fold，超时使用时间银行

**规则**:
| 场景 | 行为 |
|------|------|
| 断线 | 立即自动Fold当前手牌 |
| 行动超时(15s内) | 使用时间银行（共60s） |
| 时间银行耗尽 | 自动Fold |

**实现**:
```javascript
handleDisconnect(socketId) {
  const seat = this.findPlayerBySocketId(socketId);
  if (seat && !seat.folded && seat.turn) {
    return this.handleFold(socketId); // 立即Fold
  }
}

handleTimeout(socketId) {
  const seat = this.findPlayerBySocketId(socketId);
  if (seat && seat.timeBank > 0) {
    seat.usingTimeBank = true;
    return null; // 等待时间银行
  }
  return this.handleFold(socketId);
}
```

### D6: CHIP代币精度

**决策**: 6位小数（与TRX一致）

**理由**:
- 与TRX精度一致，便于计算和展示
- 避免精度问题导致的显示错误
- 与TRON生态工具兼容

### D7: DAO投票权重

**决策**: 1 CHIP = 1 票，无委托

**理由**:
- MVP简化实现
- 避免委托机制的复杂性
- 后续可添加委托功能

**备选方案**:
| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| 1 CHIP = 1 票 | 简单直接 | 大户优势 | ✅ MVP采用 |
| 时间加权 | 鼓励长期持有 | 计算复杂 | 后续版本 |
| 委托投票 | 专业治理 | 实现复杂 | 后续版本 |

### D8: 服务层架构

**决策**: 独立Service类，不修改现有server.js结构

**理由**:
- 保持现有代码稳定
- 便于测试和维护
- 支持依赖注入

**目录结构**:
```
server/
├── services/
│   ├── TournamentService.js
│   ├── NFTService.js
│   ├── ChipService.js
│   └── DAOService.js
├── pokergame/
│   ├── Table.js (现有)
│   ├── TournamentTable.js (新增)
│   └── ...
└── socket/
    └── index.js (修改: 添加事件处理)
```

---

## Component Design

### C1: Tournament.sol 合约结构

```
Tournament
├── State Variables
│   ├── serverWallet: address
│   ├── tournamentCounter: uint256
│   ├── configs: mapping(uint256 => TournamentConfig)
│   ├── tournaments: mapping(uint256 => Tournament)
│   └── playerCurrentTournament: mapping(address => uint256)
├── Structs
│   ├── TournamentConfig
│   │   ├── tournamentType: TournamentType
│   │   ├── playerCount: uint8
│   │   ├── buyIn: uint256
│   │   ├── rakeRate: uint256
│   │   ├── prizeDistribution: uint256[]
│   │   ├── initialChips: uint256
│   │   ├── startMode: StartMode
│   │   └── waitTimeout: uint256
│   └── Tournament
│       ├── configId: uint256
│       ├── status: TournamentStatus
│       ├── players: address[]
│       ├── prizePool: uint256
│       └── finalRankings: address[]
├── Core Functions
│   ├── createTournament(configId) → tournamentId
│   ├── joinTournament(tournamentId) [payable]
│   ├── cancelJoin(tournamentId)
│   ├── startTournament(tournamentId) [onlyServer]
│   ├── finishTournament(tournamentId, rankings) [onlyServer]
│   └── claimPrize()
└── Events
    ├── TournamentCreated
    ├── PlayerJoined
    ├── TournamentStarted
    ├── TournamentFinished
    └── PrizeClaimed
```

### C2: TournamentTable.js 类设计

```javascript
class TournamentTable extends Table {
  // 构造
  constructor(tournamentId, maxPlayers, initialChips)
  
  // 新增属性
  tournamentId: string
  initialChips: number
  eliminatedPlayers: Array<{seatId, player, finalPosition}>
  onElimination: Function
  onTournamentEnd: Function
  actionTimeout: number (15000ms)
  timeBank: number (60000ms)
  
  // 重写方法
  endHand() // 增加淘汰检测
  sitPlayer(player, seatId) // 固定初始筹码
  
  // 新增方法
  checkEliminatedPlayers(): Array
  getRemainingPlayers(): Array
  getFinalRankings(): Array
  handleDisconnect(socketId): Object
  handleTimeout(socketId): Object
}
```

### C3: AchievementNFT.sol 合约结构

```
AchievementNFT (TRC721)
├── State Variables
│   ├── signer: address
│   ├── achievements: mapping(uint256 => AchievementInfo)
│   ├── monthlyMinted: mapping(uint256 => mapping(uint256 => uint256))
│   └── claimRecord: mapping(bytes32 => bool)
├── Enums
│   ├── AchievementType: ROYAL_FLUSH, STRAIGHT_FLUSH, FOUR_OF_A_KIND, ...
│   └── Rarity: COMMON, RARE, EPIC, LEGENDARY
├── Core Functions
│   └── claimNFT(achievementTypeId, timestamp, signature) [payable]
├── Helper Functions
│   ├── _getYearMonth(): uint256
│   ├── _verifySignature(hash, signature): bool
│   └── _recoverSigner(hash, signature): address
└── Events
    └── AchievementMinted
```

### C4: Staking.sol 合约结构

```
Staking
├── State Variables
│   ├── chipToken: ChipToken
│   ├── stakes: mapping(address => StakeInfo)
│   ├── totalStaked: uint256
│   ├── rewardPool: RewardPool
│   └── pendingRewards: mapping(address => uint256)
├── Constants
│   ├── MIN_STAKE: 100 CHIP
│   ├── MIN_LOCK_DURATION: 7 days
│   ├── MAX_LOCK_DURATION: 365 days
│   └── EARLY_UNSTAKE_PENALTY: 10%
├── Core Functions
│   ├── stake(amount, lockDuration)
│   ├── unstake(amount)
│   ├── claimReward()
│   └── addReward(amount) [external]
├── View Functions
│   ├── getPendingReward(user): uint256
│   └── getStakeInfo(user): (amount, startTime, lockedUntil, isLocked)
└── Events
    ├── Staked
    ├── Unstaked
    └── RewardClaimed
```

---

## Database Schema

### D1: tournaments 表

```sql
CREATE TABLE tournaments (
  id VARCHAR(64) PRIMARY KEY,
  config_id INTEGER NOT NULL,
  status ENUM('WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
  tx_hash VARCHAR(128),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### D2: tournament_players 表

```sql
CREATE TABLE tournament_players (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  tournament_id VARCHAR(64) NOT NULL,
  player_address VARCHAR(64) NOT NULL,
  socket_id VARCHAR(64),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  final_position INTEGER NULL,
  prize_amount BIGINT NULL,
  
  INDEX idx_tournament (tournament_id),
  INDEX idx_player (player_address),
  UNIQUE KEY uk_tournament_player (tournament_id, player_address)
);
```

### D3: nft_claims 表

```sql
CREATE TABLE nft_claims (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  player_address VARCHAR(64) NOT NULL,
  achievement_type_id INTEGER NOT NULL,
  token_id BIGINT NOT NULL,
  tx_hash VARCHAR(128),
  hand_description VARCHAR(64),
  game_id VARCHAR(64),
  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_player (player_address),
  INDEX idx_achievement (achievement_type_id)
);
```

### D4: stakes 表

```sql
CREATE TABLE stakes (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  player_address VARCHAR(64) NOT NULL,
  amount BIGINT NOT NULL,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  locked_until TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  
  INDEX idx_player (player_address),
  INDEX idx_active (is_active)
);
```

### D5: proposals 表

```sql
CREATE TABLE proposals (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  onchain_id INTEGER NOT NULL,
  proposal_type ENUM('RAKE_RATE', 'NFT_LIMIT', 'NEW_ACHIEVEMENT', 'EMERGENCY_PAUSE'),
  description TEXT,
  proposer_address VARCHAR(64) NOT NULL,
  target_contract VARCHAR(64),
  call_data TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  state ENUM('PENDING', 'ACTIVE', 'SUCCEEDED', 'DEFEATED', 'EXECUTED', 'EXPIRED'),
  executed BOOLEAN DEFAULT FALSE,
  tx_hash VARCHAR(128),
  
  INDEX idx_state (state),
  INDEX idx_onchain_id (onchain_id)
);
```

### D6: votes 表

```sql
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  proposal_id INTEGER NOT NULL,
  voter_address VARCHAR(64) NOT NULL,
  support TINYINT NOT NULL, -- 0=against, 1=for, 2=abstain
  weight BIGINT NOT NULL,
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tx_hash VARCHAR(128),
  
  INDEX idx_proposal (proposal_id),
  UNIQUE KEY uk_proposal_voter (proposal_id, voter_address)
);
```

---

## Risks / Trade-offs

### R1: 智能合约安全风险

**风险**: 合约漏洞可能导致资金损失

**缓解措施**:
- [ ] 使用OpenZeppelin安全库
- [ ] 内部代码审查
- [ ] MVP上线前第三方审计
- [ ] 设置紧急暂停开关
- [ ] 限制单日提现上限

### R2: TRON网络拥堵

**风险**: 网络拥堵导致交易延迟，影响游戏体验

**缓解措施**:
- 服务端缓存关键状态，减少链上操作
- 锦标赛结算可延迟上链
- 提供交易状态查询接口

### R3: NFT月度限量耗尽

**风险**: 月初NFT被快速抢光，月底玩家无NFT可获取

**缓解措施**:
- 月度限量设置合理上限
- 显示剩余可铸造数量
- 考虑动态调整机制（DAO投票）

### R4: CHIP代币通胀

**风险**: 游戏挖矿导致CHIP大量增发，价值下跌

**缓解措施**:
- 设置总量上限（10亿）
- 游戏奖励递减机制
- 销毁机制（提前解押罚金销毁）

### R5: 大户治理攻击

**风险**: 大户持有大量CHIP，垄断治理

**缓解措施**:
- 法定人数要求（10%）
- 投票延迟期（1天）
- 投票期足够长（3天）
- 后续版本实现时间加权或委托

### R6: 断线恶意利用

**风险**: 玩家故意断线获取信息优势

**缓解措施**:
- 断线立即Fold，无时间银行
- 记录断线次数，频繁断线警告
- 后续版本实现重连机制

### R7: 9人锦标赛凑人困难

**风险**: 游戏初期用户少，9人锦标赛难以启动

**缓解措施**:
- 优先推广2/3人锦标赛
- 9人锦标赛采用定时启动（每小时整点）
- 未开赛发放补偿CHIP

---

## Migration Plan

### 阶段1: 合约部署

```bash
# 1. 部署新合约
tronbox migrate --network shasta  # 测试网
tronbox migrate --network mainnet # 主网

# 2. 配置权限
# 调用 ChipToken.addMinter(Staking.address)
# 调用 ChipToken.addMinter(serverWallet)
```

### 阶段2: 服务部署

```bash
# 1. 更新环境变量
TOURNAMENT_CONTRACT=TXxx...
NFT_CONTRACT=TXxx...
CHIP_CONTRACT=TXxx...
STAKING_CONTRACT=TXxx...
DAO_CONTRACT=TXxx...

# 2. 重启服务
pm2 restart game-server

# 3. 数据库迁移
npm run migrate
```

### 阶段3: 前端发布

```bash
# 1. 构建前端
npm run build

# 2. 部署CDN
# 上传到TRON托管或EdgeOne Pages
```

### 回滚策略

| 组件 | 回滚方式 |
|------|----------|
| 智能合约 | 调用pause()暂停，用户可提现 |
| 后端服务 | `git revert` + `pm2 restart` |
| 数据库 | 保留旧表，新表可清空 |
| 前端 | CDN回滚到上一版本 |

---

## Testing Strategy

### 单元测试

| 模块 | 测试文件 | 覆盖率目标 |
|------|----------|-----------|
| Tournament.sol | `test/Tournament.test.js` | 90% |
| AchievementNFT.sol | `test/AchievementNFT.test.js` | 90% |
| ChipToken.sol | `test/ChipToken.test.js` | 95% |
| Staking.sol | `test/Staking.test.js` | 90% |
| Governance.sol | `test/Governance.test.js` | 85% |
| TournamentTable.js | `test/TournamentTable.test.js` | 80% |

### 集成测试

```javascript
// test/integration/tournament.flow.test.js
describe('Tournament Full Flow', () => {
  it('should complete a 2-player tournament', async () => {
    // 1. 创建锦标赛
    // 2. 2个玩家报名
    // 3. 开始锦标赛
    // 4. 游戏直到结束
    // 5. 提交排名
    // 6. 领取奖金
  });
});
```

### 压力测试

| 场景 | 目标 |
|------|------|
| 并发报名 | 100人同时报名无阻塞 |
| 游戏延迟 | 单手牌处理 < 100ms |
| 合约调用 | 单次交易确认 < 3s (正常网络) |

---

## Open Questions

### ✅ 已确认决策

| 问题 | 决策 | 理由 |
|------|------|------|
| **盲注递增时机** | 等有用户反馈再定，目前只是demo | MVP简化，优先验证核心玩法 |
| **NFT二级市场** | 完全依赖第三方平台 | 零开发成本，借助现有流动性 |
| **CHIP团队分配** | 一次性释放 | 简化实现，demo阶段无需复杂锁仓 |
| **DAO执行权限** | 简单处理，不需要多重签名 | MVP阶段简化流程，自动执行 |
| **跨链扩展** | 后续考虑 | 先聚焦TRON生态 |

---

### 决策详情

#### Q1: 盲注递增时机
**决策**: 等有用户反馈再定，目前只是demo

MVP阶段使用固定盲注，后续根据用户反馈决定是否实现递增机制。

#### Q2: NFT二级市场
**决策**: 完全依赖第三方平台

- 零开发成本
- 借助TRON生态现有NFT平台（如Apenft.io）
- MVP阶段专注核心游戏功能

#### Q3: CHIP团队15%分配
**决策**: 一次性释放

demo阶段简化实现，无需Vesting合约。正式上线后可考虑分期释放。

#### Q4: DAO执行权限
**决策**: 简单处理，不需要多重签名

提案通过后自动执行，使用时间锁（如48小时）作为安全缓冲，无需多签确认。

#### Q5: 跨链扩展
**决策**: 后续考虑

MVP阶段专注TRON网络，未来根据用户需求考虑支持以太坊、BSC等链。

---

## Appendix

### A. 合约依赖图

```
Governance ──依赖──> ChipToken
                              │
Staking ──依赖──> ChipToken <─┘
                              │
Tournament ──无依赖           │
                              │
AchievementNFT ──无依赖 ──────┘
                              │
BridgeGameV2 (existing) ─────┘
```

### B. 服务依赖图

```
TournamentService ──> Tournament.sol
                   ──> TournamentTable.js
                   ──> ChipService

NFTService ──> AchievementNFT.sol
            ──> Table.js (检测牌型)

ChipService ──> ChipToken.sol
             ──> Staking.sol

DAOService ──> Governance.sol
            ──> ChipToken.sol
```

### C. 关键配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| TOURNAMENT_RAKE_RATE | 500 (5%) | 锦标赛抽水比例 |
| NFT_MINT_PRICE | 5 TRX | NFT铸造价格 |
| NFT_SIGNATURE_VALIDITY | 7 days | 签名有效期 |
| CHIP_MAX_SUPPLY | 1,000,000,000 | CHIP总量上限 |
| STAKING_MIN_LOCK | 7 days | 最小质押锁定期 |
| STAKING_PENALTY | 10% | 提前解押罚金 |
| DAO_QUORUM | 10% | 法定人数比例 |
| DAO_VOTING_PERIOD | 3 days | 投票期 |
| ACTION_TIMEOUT | 15s | 行动超时 |
| TIME_BANK | 60s | 时间银行 |
