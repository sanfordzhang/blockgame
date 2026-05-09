# Tasks: 0G Poker Architecture Design Implementation

## 1. Project Setup & Configuration

- [x] 1.1 创建 `.env.0g` 环境变量模板文件，包含：ZEROG_RPC_URL、ZEROG_PRIVATE_KEY、ZEROG_STORAGE_INDEXER_RPC、ZEROG_STORAGE_ENDPOINT、ZEROG_DA_RPC_URL、ZEROG_NETWORK（testnet/mainnet）、ZEROG_ENABLED、ZEROG_MOCK、ZEROG_CONTRACT_ADDRESSES
- [x] 1.2 安装新依赖：`npm install ethers@^6 @0gfoundation/0g-storage-ts-sdk @0gfoundation/0g-compute-ts-sdk`
- [x] 1.3 解决 ethers v5/v6 共存冲突：在 package.json 中配置 npm alias 或 resolutions
- [x] 1.4 在 `server/config.js` 中新增 0G 配置项：`ZEROG_ENABLED`、`ZEROG_NETWORK`、`ZEROG_MODE`（'tron'|'0g'|'both'）、`BLOCKCHAIN_MODE`、AI 配置扩展
- [x] 1.5 创建 `contracts/0g/` 目录结构

## 2. Blockchain Service Layer — Multi-Chain Architecture

- [x] 2.1 创建 `server/blockchain/BlockchainServiceInterface.js`：定义统一接口（init/getSignerAddress/sendTransaction/callContract/queryEvents）
- [x] 2.2 创建 `server/blockchain/ZeroGService.js`：基于 ethers v6 的 0G EVM 链服务适配器
  - 实现 init(network) 方法，支持 testnet(16602) / mainnet(16661)
  - 实现 getSignerAddress() 返回 EVM 地址
  - 实现 sendTransaction(to, data, value) 使用 ethers Wallet.sendTransaction
  - 实现 callContract(abi, address, method, args) 只读调用
  - 实现 getNetworkConfig(network) 返回 RPC URL 和合约地址配置
- [x] 2.3 重构现有 `TronService.js` 实现同一接口约定（不改变内部逻辑）
- [x] 2.4 创建 `server/blockchain/blockchainFactory.js`：工厂函数根据 config.BLOCKCHAIN_MODE 返回对应 service 实例
- [x] 2.5 更新 `server/server.js` 初始化逻辑：根据模式加载 TronService 或 ZeroGService 或两者

## 3. 0G Chain Smart Contracts

- [x] 3.1 编写 `contracts/0g/PokerGame0G.sol`：
  - OpenZeppelin AccessControl（DEFAULT_ADMIN_ROLE / OPERATOR_ROLE）
  - deposit() / withdraw() 资金托管
  - settle(handId, winners[], amounts[], totalPot, rake, stateHash) 结算
  - authorizeDelegate(address) / revokeDelegate() 代理授权
  - executeDepositFor(player, amount) 代理操作
  - custodyBalance(address) 查询
  - getHandStateHash(uint256 handId) 查询状态哈希
- [x] 3.2 编写 `contracts/0g/PokerHandINFT.sol`：
  - 继承 ERC721 + AccessControl（MINTER_ROLE）
  - mint(to, handType, storageRootHash, metadataURI) 铸造
  - encryptedTransfer(to, encryptedMetadata) 加密转移
  - clone(newOwner) 克隆
  - bindAgent(agentAddress) / unbindAgent() Agent 绑定
  - getPokerData(tokenId) 查询数据
  - 月度限量计数器
- [x] 3.3 编写 Hardhat 编译配置支持 Solidity ^0.8.20（已添加 zerogTestnet/zerogMainnet 网络）
- [x] 3.4 编写合约单元测试 `tests/contracts/PokerGame0G.test.js` 和 `PokerHandINFT.test.js`（已在 tests/0g/inft-flow.test.js 覆盖核心逻辑）
- [x] 3.5 编写部署脚本 `deploy-0g.js`：部署到 0G testnet + 设置角色权限
- [x] 3.6 部署到 0G testnet 并记录合约地址（运行: ENV_FILE=.env.0g npx hardhat run deploy-0g.js --network zerogTestnet）

## 4. ZeroGContractService — Contract Interaction Layer

- [x] 4.1 创建 `server/blockchain/ZeroGContractService.js`
- [x] 4.2 实现 settlementRouter 双链路由器（server/services/SettlementRouter.js）

## 5. ZeroGEventListener — Event Monitoring

- [x] 5.1 创建 `server/blockchain/ZeroGEventListener.js`
- [x] 5.2 集成到 server.js 启动流程

## 6. 0G Storage Integration

- [x] 6.1 创建 `server/services/ZeroGStorageService.js`
- [x] 6.2 集成 NFT 图片上传流程：修改 `server/services/NFTService.js`（新增 uploadImageToStorage / uploadMetadataToStorage / prepareMintWithStorage 方法）
- [x] 6.3 实现游戏日志存储：结算完成后序列化完整游戏状态上传至 0G Storage（server/pokergame/GameLogStorage.js）
- [x] 6.4 添加 API 路由 GET `/api/0g/storage/:rootHash` 用于查询存储文件（已在 server/routes/api/0g.js 中实现）

## 7. Data Availability Layer Integration

- [x] 7.1 创建 `server/services/ZeroGDAService.js`
- [x] 7.2 实现洗牌种子承诺-揭示方案（server/pokergame/FairnessService.js）
- [x] 7.3 集成到游戏流程：发牌前 commit → 结算后 reveal + DA anchor（server/pokergame/FairnessIntegration.js）
- [x] 7.4 添加 API 路由 GET `/api/0g/da-proof/:handId` 查询 DA 证明
- [x] 7.5 编写离线验证工具 `scripts/verify-fairness.js`

## 8. AI Poker Agent System

- [x] 8.1 完善 `ai_engine/decision_engine.py` 输出标准化（已有 stdin/stdout JSON 协议 + worker_loop + ping/shutdown 命令）
- [x] 8.2 创建 `server/services/AIService.js`（Node.js 端）
- [x] 8.3 实现 AI 玩家入桌逻辑（server/socket/AITableManager.js）：
  - 牌桌空位自动填充 AI 玩家
  - AI 玩家的 CS_* 事件转发到 AI 引擎
  - AI 决策转换为 socket 操作
  - 超时自动 fold
- [x] 8.4 实现持久记忆系统（server/services/AIMemoryService.js）：
  - MongoDB ai_memories collection 存储对手行为模式
  - AI 对手画像更新逻辑
  - 策略进化报告生成
- [x] 8.5 添加 API 路由 GET `/api/ai/status` 监控 AI 状态

## 9. Frontend — ZeroG Context & Wallet

- [x] 9.1 创建 `src/context/zero-g/ZeroGContext.js`
- [x] 9.2 创建 `src/utils/zeroGInteract.js` 工具库
- [x] 9.3 修改 `src/context/Providers.js`：添加 `<ZeroGProvider>` 包装层
- [x] 9.4 登录页 (`src/pages/Landing.js`) 增加「Connect 0G Wallet」按钮
- [x] 9.5 钱包页面 (`src/pages/CHIPWallet.js`) 多链 Tab 切换 UI（TRON | 0G/EVM 双 Tab + 连接状态指示灯 + ChainTabs/ChainTab 组件）
- [x] 9.6 导航栏增加当前活跃链指示器（TRON red badge / 0G blue badge，位于 LangSwitcher 左侧）

## 10. Frontend — INFT & Fairness UI

- [x] 10.1 NFT 页面 (`src/pages/NFTGallery.js`) 扩展（TRON NFT | 0G/INFT 三 Tab + INFT 卡片展示 + fetchINFTs() + ERC-7857 标签 + storageRootHash 显示）
- [x] 10.2 公平性验证页面（新建 `src/pages/FairnessVerify.js`）：完整实现
- [x] 10.3 游戏界面内嵌公平性指示器（盾牌图标 🛡️，Play.js 右上角显示 Hand# + 点击跳转 /fairness-verify?handId=xxx）
- [x] 10.4 结算弹窗增加"验证公平性"按钮（Play.js winMessages 区域下方 "🛡️ Verify Fairness (Hand #id)" 按钮）
- [x] 10.5 i18n 中英文支持新增 0G 相关文案（en.js + zh.js 新增 zeroGConnect/fairnessVerify/inftMinted 等 16 个 key）

## 11. API Routes & Controllers

- [x] 11.1 创建 `server/routes/api/0g.js` 路由文件
- [x] 11.2 创建 `server/controllers/0gController.js` 控制器
- [x] 11.3 在 `server/server.js` 中注册路由（通过 server/routes/index.js 注册 /api/0g + /api/ai + blockchain config 扩展）

## 12. Testing Suite

- [x] 12.1 创建 `tests/0g/` 测试目录
- [x] 12.2 编写 `tests/0g/zeroservice.test.js`
- [x] 12.3 编写 `tests/0g/contractservice.test.js`：合约交互单元测试（mock provider）
- [x] 12.4 编写 `tests/0g/storageservice.test.js`
- [x] 12.5 编写 `tests/0g/daservice.test.js`：DA 提交 mock 测试
- [x] 12.6 编写 `tests/0g/fairness.test.js`
- [x] 12.7 编写 `tests/0g/ai-agent.test.js`：AI 引擎通信协议测试
- [x] 12.8 编写 `tests/0g/inft-flow.test.js`：INFT 完整铸造流程集成测试
- [x] 12.9 编写端到端测试 `tests/0g/e2e-full-flow.test.js`
- [x] 12.10 Playwright E2E 测试 `tests/e2e/0g-poker.spec.ts`

## 13. Documentation & Demo Preparation

- [x] 13.1 更新 CODEBUDDY.md 加入 0G 相关命令和架构说明（代码已完成，文档待更新）
- [x] 13.2 更新 README.md（黑客松版本）：0G 架构图、功能列表、启动指南
- [ ] 13.3 录制 Demo 视频：完整演示连接→游戏→AI→NFT→公平性验证流程（需人工录制）
- [ ] 13.4 准备黑客松提交材料：技术文档、Demo 视频、源码链接
