# TRON Blockchain Integration

## Why

当前德州扑克游戏使用虚拟筹码系统（内存存储），无法实现真实价值流转。为了构建可信的去中心化游戏平台，需要接入 TRON 区块链，实现真实资金托管与结算。

**核心目标**：
1. 将虚拟筹码改为真实的 TRX 结算
2. 建立可信的资金托管机制
3. 支持娱乐模式（测试网）与真实模式（主网）切换
4. 提供动态可调的抽水率管理

## What Changes

- **BREAKING**: 钱包集成从 MetaMask/ethers 切换到 TronLink/TronWeb
- **NEW**: 智能合约 `BridgeGameV1.sol` 实现资金托管与结算
- **NEW**: 动态抽水率功能，管理员可通过后台调整
- **NEW**: 娱乐模式（测试网 TRX）与真实模式（主网 TRX）
- **NEW**: 管理后台（调整抽水率、提取累积抽水、紧急暂停）
- **MODIFY**: 后端新增区块链服务层（TronService、ContractService）
- **MODIFY**: 前端新增钱包连接、存取款、模式切换功能

## Capabilities

### New Capabilities

- `tron-wallet`: TronLink 钱包连接、地址获取、余额查询、交易签名
- `game-fund-custody`: TRX 资金托管：存入、锁定、结算、提现全流程
- `dynamic-rake-rate`: 动态抽水率：管理员可调整，带安全边界和时间锁
- `game-mode-switch`: 游戏模式切换：娱乐模式（测试网）↔ 真实模式（主网）
- `admin-panel`: 管理后台：抽水率调整、资金提取、紧急暂停

### Modified Capabilities

- `player-balance`: 从虚拟筹码改为合约内 TRX 余额
- `game-settlement`: 从内存更新改为链上结算

## Impact

### 前端

- 新增 `TronContext` 替代现有钱包集成
- 新增存取款界面、模式切换开关
- 新增管理后台页面

### 后端

- 新增 `server/blockchain/` 目录（TronService、ContractService、EventListener）
- 新增 `AdminService` 管理服务
- 游戏结算流程改造

### 区块链

- 部署 `BridgeGameV1.sol` 到测试网和主网
- 测试网合约用于娱乐模式
- 主网合约用于真实资金

### 依赖

- tronweb (前端 + 后端)
- PostgreSQL (用户数据持久化)
- Redis (游戏状态缓存)
