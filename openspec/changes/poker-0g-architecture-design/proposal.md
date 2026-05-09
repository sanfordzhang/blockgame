## Why

参加 0G APAC 黑客松比赛（[hackquest.io/zh-cn/hackathons/0G-APAC-Hackathon](https://www.hackquest.io/zh-cn/hackathons/0G-APAC-Hackathon)），基于现有德州扑克游戏项目（game-core），利用 0G 的模块化 AI 基础设施（Storage / Data Availability / Compute / INFT）将其扩展为可验证的 AI 扑克平台。当前项目仅支持 TRON 链，存在 NFT 图片存储成本高、游戏日志无法上链验证、AI 智能体缺乏链上基础设施支撑三大痛点。0G 提供了 EVM 兼容链 + 高吞吐去中心化存储 + 数据可用性层 + 可验证 AI 推理的完整解决方案。

## What Changes

### 新增能力
- **0G Storage 集成**：将 NFT 牌型图片、游戏完整历史日志从中心化存储迁移至 0G 去中心化存储网络，支持 Merkle proof 验证和端到端加密
- **0G Data Availability 层**：将洗牌种子、游戏状态哈希值、结算证明提交到 0G DA 层，实现游戏公平性的链下可验证
- **0G Chain 智能合约部署**：在 0G EVM 兼容链（Chain ID: 16602 testnet / 16661 mainnet）上部署资金托管、游戏结算、NFT 铸造合约，元数据引用 0G Storage root hash
- **AI 扑克智能体**：实现自主 AI 玩家参与游戏，决策逻辑可运行于 0G Compute Network（TEE 可验证推理），具备持久记忆和策略进化能力
- **INFT（ERC-7857）智能 NFT**：稀有牌型 NFT 升级为 INFT 标准，支持加密元数据的安全转移和 AI Agent tokenization
- **可验证公平性系统**：洗牌种子承诺-揭示方案 + 状态哈希链上锚定 + 0G DA 存储，任何人可离线验证无操纵

### 修改内容
- **区块链服务层抽象**：`server/blockchain/` 从 TRON 专属扩展为多链架构，新增 `ZeroGService.js` 作为 0G 链服务适配器（EVM/ethers.js）
- **前端钱包连接**：`src/context/tron/` 扩展为支持 MetaMask（0G Chain 使用 EVM 钱包）
- **NFT 服务升级**：`server/services/NFTService.js` 的铸造流程增加 0G Storage 上传步骤和 INFT 元数据格式
- **事件监听器扩展**：`server/blockchain/EventListener.js` 新增 0G Chain 合约事件监听（使用 ethers.js queryFilter 替代 tronWeb getEventResult）

### 移除/降级内容（黑客松演示期间）
- TRON 链作为主链的功能在 0G 演示模式下可选降级，但保留代码不删除（**非 BREAKING**，通过配置切换网络模式）

---

## Capabilities

### New Capabilities

- **`0g-storage-integration`**: 0G Storage SDK 集成，覆盖文件上传/下载/Merkle验证/KV存储/加密功能。NFT 图片和游戏日志的去中心化存储方案。
- **`0g-data-availability`**: 0G DA 层集成，覆盖洗牌种子提交、状态哈希锚定、公平性证明生成与验证的数据可用性保障。
- **`0g-chain-contracts`**: 0G EVM 链上的智能合约体系，包括 PokerGame 主合约（托管/结算/NFT）、CHIP 代币适配、以及 Precompile 交互。
- **`ai-poker-agent`**: AI 扑克智能体系统，覆盖规则引擎/ML模型接口/AI玩家入座/决策执行/持久记忆/策略进化。
- **`inft-poker-hands`**: 基于 ERC-7857 标准的智能 NFT 牌型系统，覆盖动态铸造/加密元数据/安全转移/克隆功能/AI Agent 关联。
- **`verifiable-fairness`**: 游戏公平性可验证系统，覆盖洗牌种子承诺方案/状态哈希链/离线验证工具/证明存储。

### Modified Capabilities

- **`nft-achievement`**: 现有成就 NFT 需要升级元数据格式以引用 0G Storage root hash，并兼容 ERC-7857 INFT 接口
- **`game-settlement`**: 结算流程需要新增 0G Chain 合约调用路径（ethers.js sendTx），同时保留 TRON 路径作为 fallback
- **`tron-wallet`**: 钱包连接模块需扩展支持 EVM 钱包（MetaMask/OKX），0G Chain 使用 secp256k1 签名而非 Ed25519

---

## Impact

| 影响范围 | 具体内容 |
|---------|---------|
| **后端新增** | `server/blockchain/ZeroGService.js`（0G链连接）、`server/blockchain/ZeroGContractService.js`（合约交互）、`server/services/ZeroGStorageService.js`（存储服务）、`server/services/ZeroGAIService.js`（AI推理）、`server/blockchain/ZeroGEventListener.js` |
| **后端修改** | `server/server.js`（初始化 0G 服务）、`server/config.js`（新增 0G 网络配置）、`server/socket/index.js`（AI 玩家 socket 处理）、`services/NFTService.js`（0G 存储上传） |
| **前端新增** | `src/context/zero-g/ZeroGContext.js`（EVM 钱包状态管理）、`src/utils/zeroGInteract.js`（0G 链交互工具库） |
| **前端修改** | `src/context/Providers.js`（添加 ZeroGProvider）、钱包页面（多链切换 UI）、NFT 页面（INFT 展示） |
| **合约新增** | `contracts/0g/PokerGame0G.sol`（0G 版本主合约，EVM cancun）、`contracts/0g/PokerHandINFT.sol`（ERC-7857 INFT 合约） |
| **依赖新增** | `@0gfoundation/0g-storage-ts-sdk`（Storage SDK）、`@0gfoundation/0g-compute-ts-sdk`（Compute SDK）、`ethers@^6.x`（EVM 交互，若版本不匹配则升级） |
| **测试新增** | `tests/0g/` 目录下的端到端测试套件：用户连接→入桌→AI 对局→NFT 铸造→结算→公平性验证全流程 |
| **配置新增** | `.env.0g`（0G 网络环境变量：RPC_URL、PRIVATE_KEY、STORAGE_INDEXER_RPC 等） |
