# Proposal: Tournament, NFT, CHIP Token, and DAO Implementation

## Why

当前德州扑克游戏系统仅支持普通桌游模式，缺乏竞技性、用户激励机制和社区治理能力。为提升用户粘性、增加平台收入来源、并构建完整的区块链游戏生态，需要引入锦标赛系统、NFT成就徽章、平台代币CHIP及DAO治理功能。

**核心驱动力**：
1. **用户留存**：锦标赛和NFT收集提供持续游戏动力
2. **收入多元化**：锦标赛抽水、NFT交易手续费、代币经济
3. **社区自治**：DAO让用户参与决策，增强归属感
4. **技术展示**：完整的DeFi+GameFi+NFT应用demo

---

## What Changes

### Phase 1: 锦标赛系统

- **新增** Sit & Go 锦标赛合约 (`Tournament.sol`)
  - 支持 2/3/6 人满员即开模式
  - 支持 9 人定时启动模式（5分钟等待窗口）
  - 自动奖金分配与抽水结算
- **新增** 锦标赛游戏桌类 (`TournamentTable.js`) 继承现有 `Table.js`
  - 淘汰检测机制
  - 固定盲注（MVP版本不递增）
  - 断线自动Fold处理
  - 15秒行动超时 + 60秒时间银行
- **新增** 锦标赛服务层 (`TournamentService.js`)
  - 锦标赛创建、报名、开始、结束全流程管理
  - 与合约交互的封装
- **修改** Socket事件处理，新增锦标赛相关事件

### Phase 2: NFT 成就系统

- **新增** NFT成就合约 (`AchievementNFT.sol`)
  - TRC721 标准实现
  - 6种牌型成就：皇家同花顺、同花顺、四条、葫芦、同花、顺子
  - 月度限量机制（每月刷新，非固定总量）
  - 服务端签名验证防作弊
  - 玩家自付Gas铸造（约5 TRX）
- **新增** NFT服务层 (`NFTService.js`)
  - 牌型成就检测
  - 签名生成
  - 月度限量检查

### Phase 3: CHIP 代币与质押系统

- **新增** CHIP代币合约 (`ChipToken.sol`)
  - TRC20 标准实现
  - 总量10亿，6位小数
  - Minter白名单机制
- **新增** 质押合约 (`Staking.sol`)
  - CHIP质押获得平台分红
  - 锁定期：7天-365天
  - 提前解押罚金10%
- **新增** 代币服务层 (`ChipService.js`)
  - 游戏奖励分发
  - VIP折扣计算
  - 质押奖励管理

### Phase 4: DAO 治理系统

- **新增** DAO治理合约 (`Governance.sol`)
  - 提案创建（门槛：持有1000 CHIP）
  - 投票机制（1 CHIP = 1票）
  - 提案执行（抽水比例调整等）
  - 法定人数：10%
- **新增** DAO服务层 (`DAOService.js`)
  - 提案管理
  - 投票状态同步

### MVP版本限制

- 盲注不递增（固定盲注）
- 锦标赛进行中不能同时玩普通游戏
- NFT铸造由玩家支付Gas
- DAO仅支持抽水比例调整提案

---

## Capabilities

### New Capabilities

以下能力将创建独立的规格文档：

| Capability | 描述 | 优先级 |
|------------|------|--------|
| `tournament-system` | Sit & Go 锦标赛系统：创建、报名、游戏流程、奖金分配 | P0 |
| `nft-achievement` | NFT成就徽章系统：牌型成就、月度限量、签名验证 | P1 |
| `chip-token` | CHIP平台代币：TRC20实现、铸造、销毁、Minter管理 | P2 |
| `staking-rewards` | 质押分红系统：CHIP质押、锁定期、奖励分配 | P2 |
| `dao-governance` | DAO治理系统：提案、投票、执行 | P3 |

### Modified Capabilities

以下现有能力将被修改：

| Capability | 变更内容 |
|------------|----------|
| `game-table` | 扩展支持锦标赛模式，新增淘汰检测、断线处理 |
| `socket-events` | 新增锦标赛、NFT、代币相关事件类型 |
| `user-wallet` | 集成CHIP代币余额、质押状态查询 |

---

## Impact

### 智能合约层

| 合约 | 文件 | 操作 |
|------|------|------|
| Tournament | `contracts/Tournament.sol` | 新增 |
| AchievementNFT | `contracts/AchievementNFT.sol` | 新增 |
| ChipToken | `contracts/ChipToken.sol` | 新增 |
| Staking | `contracts/Staking.sol` | 新增 |
| Governance | `contracts/Governance.sol` | 新增 |
| BridgeGameV2 | `contracts/BridgeGameV2.sol` | 无修改 |

### 后端服务层

| 服务 | 文件 | 操作 |
|------|------|------|
| TournamentService | `server/services/TournamentService.js` | 新增 |
| NFTService | `server/services/NFTService.js` | 新增 |
| ChipService | `server/services/ChipService.js` | 新增 |
| DAOService | `server/services/DAOService.js` | 新增 |
| TournamentTable | `server/pokergame/TournamentTable.js` | 新增 |
| Table | `server/pokergame/Table.js` | 小改（继承支持） |
| Socket Handler | `server/socket/index.js` | 修改 |

### 前端层

| 组件 | 操作 |
|------|------|
| 锦标赛大厅 | 新增 |
| 锦标赛游戏桌 | 新增 |
| NFT展示页 | 新增 |
| CHIP钱包 | 新增 |
| 质押界面 | 新增 |
| DAO投票页 | 新增 |

### 数据库

| 表 | 操作 |
|------|------|
| tournaments | 新增 |
| nft_claims | 新增 |
| chip_transactions | 新增 |
| stakes | 新增 |
| proposals | 新增 |
| votes | 新增 |

### 外部依赖

- OpenZeppelin Contracts (TRC20, TRC721, Ownable, Pausable, ReentrancyGuard)
- TronWeb SDK
- 已部署的 BridgeGameV2 合约（无修改）

### API端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/tournament` | GET | 获取锦标赛列表 |
| `/api/tournament/:id` | GET | 获取锦标赛详情 |
| `/api/tournament/:id/join` | POST | 报名锦标赛 |
| `/api/nft/user/:address` | GET | 获取用户NFT列表 |
| `/api/chip/balance/:address` | GET | 获取CHIP余额 |
| `/api/stake/info/:address` | GET | 获取质押信息 |
| `/api/dao/proposals` | GET | 获取提案列表 |
| `/api/dao/proposal/:id` | GET | 获取提案详情 |
| `/api/dao/vote` | POST | 投票 |

---

## Success Metrics

| 指标 | 目标 |
|------|------|
| 锦标赛日均场次 | ≥10场 |
| NFT月度铸造量 | 达到月度限量80% |
| CHIP质押率 | ≥总供应量5% |
| DAO提案参与率 | ≥法定人数 |

---

## Timeline

| Phase | 周期 | 交付物 |
|-------|------|--------|
| Phase 1: 锦标赛 | 2周 | Tournament.sol + TournamentTable.js + TournamentService.js |
| Phase 2: NFT | 1.5周 | AchievementNFT.sol + NFTService.js |
| Phase 3: CHIP+质押 | 2周 | ChipToken.sol + Staking.sol + ChipService.js |
| Phase 4: DAO | 1.5周 | Governance.sol + DAOService.js |
| **总计** | **7周** | 完整系统 |
