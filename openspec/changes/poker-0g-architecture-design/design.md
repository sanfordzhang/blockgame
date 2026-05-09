## Context

### 当前状态
game-core 是一个基于 TRON 链的 Web3 德州扑克游戏，采用 React 前端 + Express/Socket.io 后端 + Mongoose/MongoDB 的架构。区块链服务层 (`server/blockchain/`) 专属于 TRON，使用 tronWeb v6 SDK 进行合约交互。AI 引擎 (`ai_engine/`) 基于 Python NFSP (Neural Fictitious Self-Play) 模型，已具备 CFR 训练和决策能力。NFT 系统使用 TRON 链上的 `AchievementNFTOnChainV2` 合约。

### 约束条件
- **时间约束**：0G APAC 黑客松有明确截止日期（2025年3月），需在有限时间内交付可演示的完整方案
- **技术栈**：后端 Node.js（非 TypeScript）、前端 React 16、合约 Solidity、AI 引擎 Python
- **现有依赖**：ethers v5 已存在（用于 Hardhat 测试），tronweb v6 用于生产
- **向后兼容**：TRON 链功能必须保留，通过配置切换网络模式
- **存储**：MongoDB 作为主数据库，NFT 元数据当前使用中心化 URI

### 利益相关方
- 开发者：需清晰的集成路径和 API 设计
- 黑客松评委：关注创新性（0G 四大模块的利用程度）和可演示性
- 玩家用户：多链钱包支持、游戏公平性保证

---

## Goals / Non-Goals

**Goals:**
1. 在现有 game-core 项目基础上无缝集成 0G 全套基础设施（Storage / DA / Chain / Compute）
2. 实现可验证公平性的扑克游戏——洗牌种子承诺-揭示方案 + DA 层锚定
3. AI 智能体作为独立玩家参与对局，决策可运行于 0G Compute TEE 环境
4. NFT 牌型系统升级为 ERC-7857 INFT 标准，元数据存储至 0G Storage
5. 提供完整的端到端测试覆盖，确保黑客松演示稳定性
6. 支持双链运行模式：TRON（已有）+ 0G（新增）

**Non-Goals:**
- 不替换 MongoDB 数据库（0G Storage 仅补充去中心化文件存储）
- 不重写前端为 Vue 或其他框架
- 不实现完全去中心化的链上游戏逻辑（仍由服务器作为游戏引擎）
- 不迁移现有 TRON 链用户数据到 0G 链
- 不实现跨链桥接（TRON ↔ 0G 资产转移不在本次范围）
- 不做移动端适配优化

---

## Decisions

### D1: 多链服务层架构 —— 抽象接口 + 适配器模式

**选择**：定义统一的 `BlockchainService` 接口，`TronService` 和 `ZeroGService` 分别实现该接口。通过工厂函数根据配置创建对应实例。

```javascript
// server/blockchain/BlockchainServiceInterface.js
class BlockchainServiceInterface {
  init(network) {}           // 初始化连接
  getSignerAddress() {}      // 获取签名地址
  sendTransaction(to, data, value) {} // 发送交易
  callContract(method, args) {}       // 只读调用
  queryEvents(eventName, filter) {}   // 查询事件
}
```

**替代方案考虑**：
- A) 继承基类：JavaScript 原生不支持 interface/abstract class，需要额外约定 → **拒绝**
- B) 条件分支 if/else 散布各处：代码耦合度高，难维护 → **拒绝**
- C) 独立模块无抽象：两套独立代码路径，重复逻辑多 → **拒绝**

**理由**：适配器模式让现有 TronService 无需修改内部逻辑，ZeroGService 可独立开发。ContractService 通过注入的 service 实例工作，天然支持多链。

---

### D2: 0G Chain 合约使用 ethers.js v6（升级）

**选择**：新增 `ethers@^6.x` 作为 0G EVM 交互库，与现有 ethers v5 共存（Hardhat 内部使用 v5）。

```javascript
// server/blockchain/ZeroGService.js
const { ethers } = require('ethers'); // v6
class ZeroGService {
  init(network = 'testnet') {
    const rpcUrl = process.env.ZEROG_RPC_URL;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(process.env.ZEROG_PRIVATE_KEY, this.provider);
  }
}
```

**替代方案考虑**：
- A) 复用 ethers v5：v5 对 EVM cancun opcode 支持不完整，0G 链可能需要新特性 → **拒绝**
- B) 使用 web3.js：项目已有 ethers 依赖，引入新库增加学习成本 → **拒绝**
- C) 使用 0G 官方 SDK（如有）：目前 0G 主要提供 Storage/Compute SDK，EVM 交互仍需标准工具 → **拒绝**

**理由**：ethers v6 是当前 EVM 开发的事实标准，TypeScript 友好（虽项目是 JS），API 更简洁。v5/v6 可通过别名共存。

---

### D3: 0G Storage 集成策略 —— 服务层封装 + 异步上传队列

**选择**：新建 `server/services/ZeroGStorageService.js` 封装 `@0gfoundation/0g-storage-ts-sdk`，提供：
- `uploadFile(buffer, options)` — 上传文件返回 root hash + merkle proof
- `downloadFile(rootHash)` — 下载并验证完整性
- `uploadMetadata(json)` — 上传 JSON 元数据（NFT 用）
- `getErasureCode(rootHash)` — 获取纠删编码信息

关键设计点：
- **异步队列**：上传操作放入内存队列，避免阻塞游戏主循环
- **自动重试**：网络失败时指数退避重试（最多3次）
- **缓存机制**：常用文件（NFT 图片）本地缓存，减少重复请求

**替代方案考虑**：
- A) 直接在前端调用 0G Storage SDK：安全性差（私钥暴露）、浏览器兼容性问题 → **拒绝**
- B) 仅用 HTTP API 手动调用：SDK 已封装 Merkle tree 构建和 erasure coding，手写易出错 → **拒绝**

**理由**：服务端封装统一管理加密、上传、验证逻辑。SDK 自动处理 Erasure Coding（纠删编码）和 Merkle Tree 构建，降低集成复杂度。

---

### D4: Data Availability 层集成 —— 游戏状态哈希锚定

**选择**：每手牌的关键状态哈希提交至 0G DA 层，实现不可篡改的游戏记录。

**数据流**：
```
游戏结束 → 生成状态摘要(洗牌种子揭示 + 最终牌面 + 结算结果)
         → SHA-256 哈希
         → 调用 0G DA SDK submitTransaction()
         → 返回 DA 层确认（batch index + commitment hash）
         → 存入 MongoDB game_records.da_proof 字段
```

**DA 提交内容格式**：
```json
{
  "tableId": "tbl_xxx",
  "handNumber": 42,
  "seedCommitment": "0xabc...",
  "seedReveal": "0xdef...",
  "boardCards": ["Ah","Kd","Qs","Jc","Th"],
  "playerResults": [
    {"address": "0x...", "hand": "Royal Flush", "chipsWon": 1000}
  ],
  "timestamp": 1709251200,
  "stateHash": "0xsha256..."
}
```

**替代方案考虑**：
- A) 直接上链存入 0G 合约：每笔交易 gas 成本高，不适合高频游戏 → **拒绝**
- B) 不使用 DA 层仅存 MongoDB：无法提供去中心化可验证证明 → **拒绝**
- C) 使用 Arweave/IPFS 替代：与 0G 生态不匹配，黑客松评分标准要求使用 0G 技术 → **拒绝**

**理由**：DA 层专为高吞吐数据可用性设计，成本低廉且提供密码学保证，完美契合游戏日志审计场景。

---

### D5: AI 扑克智能体 —— Python 子进程 + Socket Bridge

**选择**：保留现有 Python AI 引擎（NFSP/CFR 模型），通过子进程通信桥接到 Node.js 游戏服务器。

**架构**：
```
[Node.js Game Server]
        ↓ spawn child process
[Python AI Engine] ← ai_engine/decision_engine.py
        ↓ stdin/stdout JSON protocol
[Game Table] ← AI Player as socket client
```

**通信协议（JSON over stdio）**：
```json
// Server → AI
{"type": "request_action", "hand_id": "xxx", "hole_cards": ["Ah","Kd"], 
 "community_cards": [], "pot": 500, "to_call": 100, 
 "stack": 10000, "position": 0, "num_players": 2,
 "action_history": [{"player": "p1", "action": "raise", "amount": 200}]}
// AI → Server  
{"type": "action", "action": "raise", "amount": 300, "confidence": 0.85, "reasoning": "strong hand"}
```

**0G Compute 集成路径（Phase 2 / 演示增强）**：
- 将 AI 决策模型部署为 0G Compute Function
- 通过 Router API 调用 TEE 内推理
- 返回可验证的执行结果（attestation proof）

**替代方案考虑**：
- A) 用 JavaScript 重写 AI 模型：损失已训练的 Python 模型和训练管线 → **拒绝**
- B) 用 HTTP REST 通信：增加网络开销和延迟，本地子进程更高效 → **拒绝**
- C) 纯规则引擎无 ML：无法展示 0G Compute 能力，黑客松竞争力不足 → **拒绝**

**理由**：Python AI 引擎已成熟（NFSP 训练完成，有 checkpoint 文件），子进程桥接风险最低。0G Compute 作为增强层可选接入。

---

### D6: INFT（ERC-7857）智能合约设计

**选择**：新建 `contracts/0g/PokerHandINFT.sol`，继承 OpenZeppelin ERC721 + 自定义 ERC-7857 接口。

**核心功能**：
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IERC7857 {
    // 加密元数据的安全转移
    function encryptedTransfer(address to, bytes calldata encryptedMetadata) external;
    // 克隆 INFT（复制元数据结构）
    function clone(address owner) external returns (uint256);
    // 关联 AI Agent
    function bindAgent(address agent) external;
}

contract PokerHandINFT is ERC721, IERC7857 {
    struct PokerHandData {
        string handType;          // "Royal Flush", "Straight Flush"...
        string[] cards;           // ["Ah","Kh","Qh","Jh","Th"]
        string storageRootHash;   // 0G Storage root hash for image
        string metadataURI;       // 完整 metadata JSON URI
        uint256 timestamp;
        address aiAgent;          // 绑定的 AI Agent 地址（可选）
        bool isEncrypted;         // 是否加密
    }

    // 铸造时引用 0G Storage root hash
    function mint(
        address to, 
        string calldata handType,
        string calldata storageRootHash,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256);
}
```

**替代方案考虑**：
- A) 复用现有 AchievementNFT 合约扩展：TRON 合约不支持 EVM，无法部署到 0G 链 → **拒绝**
- B) 纯 ERC721 无 INFT 功能：无法展示 0G INFT 创新能力，黑客松评分低 → **拒绝**
- C) 使用 ERC1155 多代币标准：扑克手牌 NFT 是唯一资产，ERC721 更合适 → **拒绝**

**理由**：ERC-7857 INFT 是 0G 生态的特色能力，配合加密元数据和 Agent 绑定能突出技术创新。

---

### D7: 可验证公平性系统 —— 承诺-揭示 + 哈希链

**选择**：实现三阶段公平性保障：

**Phase 1 — 洗牌种子承诺（每手牌开始前）**：
```
Server 生成随机种子 S → 计算 H = SHA256(S + salt)
→ 存储 H 到 MongoDB（不可逆）
→ 游戏结束后揭示 S
→ 任何人可验证 H == SHA256(S + salt)
```

**Phase 2 — 状态哈希锚定到 0G DA（每手牌结束时）**：
```
完整游戏状态 → 序列化 JSON → SHA-256 哈希
→ 提交到 0G DA 层 → 获得 DA receipt
→ receipt 存入合约或 MongoDB
```

**Phase 3 — 离线验证工具（公开）**：
```
玩家获取: seedReveal + boardCards + results + daReceipt
→ 本地执行: 重算 stateHash === daReceipt.stateHash
→ 验证: DA 层确认数据未被篡改
```

**替代方案考虑**：
- A) 完全链上确定性随机数（Chainlink VRF）：0G 链可能未部署 VRF，依赖外部预言机增加复杂性 → **暂缓**
- B) 不做公平性验证：黑客松评审会质疑游戏可信度 → **拒绝**
- C) 使用 Intel SGX TEE 信任根：需要特殊硬件，演示环境不可控 → **拒绝**

**理由**：承诺-揭示方案实现简单、密码学严谨、无需外部依赖。结合 DA 层锚定形成完整的可验证闭环。

---

### D8: 前端多链钱包管理 —— 并行 Provider 架构

**选择**：新建 `src/context/zero-g/ZeroGContext.js`，与现有 `TronContext` 并行。通过 `Providers.js` 统一包装。

```jsx
// src/context/Providers.js（修改）
<TronProvider>
  <ZeroGProvider>     {/* 新增 */}
    <GameStateProvider>
      <ModalProvider>{children}</ModalProvider>
    </GameStateProvider>
  </ZeroGProvider>
</TronProvider>
```

**ZeroGProvider 核心能力**：
- MetaMask / OKX 钱包检测和连接（`window.ethereum`）
- 0G Chain 切换（Chain ID: 16602 testnet, 16661 mainnet）
- ETH/TRX 双余额显示
- 签名验证（personalSign → recoverAddress）

**UI 交互**：
- 登录页增加「连接 0G 钱包」按钮（MetaMask 图标）
- 钱包页面顶部增加 Tab：「TRON」|「0G」切换
- 设置中可选择默认链

**替代方案考虑**：
- A) 统一 WalletContext 抽象两种链：改动范围大，TronLink 和 MetaMask 差异太大 → **拒绝**
- B) 仅支持 0G 放弃 TRON：丢失现有用户基础和已部署合约 → **拒绝**
- C) 使用 Web3Modal 统一入口：引入新依赖，但体验更优 → **备选方案**，如时间允许可采用

**理由**：并行 Provider 最小化对现有代码的影响。TronContext 完全不动，ZeroGContext 独立开发。

---

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| **0G SDK 兼容性问题** | Storage/Compute SDK 可能与 Node.js 版本或项目构建工具有冲突 | 提前 PoC 验证；准备 fallback 方案（直接调 HTTP API） |
| **0G Testnet 不稳定** | RPC 节点宕机或 DA 层延迟高导致演示失败 | 准备 Mock 模式（`.env` 中 `ZEROG_MOCK=true`）；录制 Demo 视频 |
| **ethers v5/v6 版本冲突** | Hardhat 依赖 v5，0G Service 需要 v6 | 使用 npm alias 解析（`ethers6: npm:ethers@^6`） |
| **AI 子进程性能** | Python 子进程启动延迟（~2s）影响首局响应 | 预加载 AI 进程；首次请求时 warm-up |
| **INFT 合约审核时间** | 新合约可能有安全漏洞被评委质疑 | 使用 OpenZeppelin 标准库；限制 mint 权限为 MINTER_ROLE |
| **DA 层提交延迟** | 高并发时 DA 确认可能滞后（~秒级） | 异步提交，不阻塞游戏流程；前端显示"验证中"状态 |
| **黑客单时间紧迫** | 6 个新能力 + 9 个 spec + 完整测试，工作量巨大 | MVP 优先：先跑通主流程（连接→游戏→NFT→结算→验证），再完善细节 |

---

## Migration Plan

### Phase 1: 基础设施搭建（Day 1-2）
1. 安装 0G SDK 依赖，解决版本冲突
2. 创建 `.env.0g` 配置文件模板
3. 实现 `ZeroGService.js`（EVM 连接 + 基础查询）
4. 实现 `ZeroGContext.js`（MetaMask 连接 + 余额显示）
5. 验证 0G testnet 连通性（余额查询、基础交易）

### Phase 2: 核心合约部署（Day 2-3）
1. 编写并编译 `PokerGame0G.sol`（托管 + 结算）
2. 编写并编译 `PokerHandINFT.sol`（ERC-7857）
3. 部署到 0G testnet
4. 编写合约单元测试
5. 实现 `ZeroGContractService.js`（合约交互方法）

### Phase 3: Storage + DA 集成（Day 3-4）
1. 实现 `ZeroGStorageService.js`（上传/下载/验证）
2. NFT 图片上传至 0G Storage（替换中心化 URI）
3. 实现 DA 层提交服务（游戏状态哈希锚定）
4. 公平性验证工具（离线脚本）

### Phase 4: AI 智能体接入（Day 4-5）
1. 完善 `decision_engine.py` 输出标准化
2. 实现 Node-Python 桥接（child_process + JSON 协议）
3. AI 玩家加入牌桌（Socket 模拟客户端）
4. 0G Compute 集成（可选增强）

### Phase 5: 前端 UI 适配（Day 5-6）
1. 登录页增加 0G 钱包按钮
2. 钱包页面多链 Tab 切换
3. INFT 展示页面（加密元数据预览）
4. 公平性验证页面（输入 hand ID 查看证明）
5. i18n 中英文支持（0G 相关文案）

### Phase 6: 测试 + 演示打磨（Day 6-7）
1. 端到端测试套件（`tests/0g/`）
2. Playwright/E2E 全流程自动化
3. 性能压力测试（多人同时在线）
4. Demo 录制 + README 文档
5. 黑客松提交材料准备

### Rollback 策略
- 所有 0G 功能通过 `config.ZEROG_ENABLED` 开关控制
- 设为 `false` 时回退为纯 TRON 模式，零影响
- Git 分支隔离：`0g` 分支独立开发，不影响 `main` 分支

---

## Open Questions

1. **0G Storage SDK 具体安装方式**：`@0gfoundation/0g-storage-ts-sdk` 是否已在 npm 发布？如果需要从源码构建，需要提前确认构建步骤。
2. **0G Compute TEE 推理的具体 API 格式**：Router API 的请求/响应格式、支持的模型列表、计费方式需要在开发前确认。
3. **0G Testnet Faucet 额度限制**：Testnet 代币获取是否有频率限制？需要多少 0G 代币用于合约部署和测试？
4. **INFT ERC-7857 标准最终规范**：0G 官方的 INFT 标准是否已经 finalized？是否参考了 EIP-7857 或自定义？
5. **黑客松演示环境**：是否需要自备 0G 节点？还是使用官方公共节点即可？演示时的网络稳定性如何保障？
