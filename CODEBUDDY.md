# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目概述

基于 Web3 的多人在线德州扑克游戏，支持锦标赛、NFT成就（ERC-7857 INFT）、DAO治理等功能。前端 React + 后端 Express/Socket.io，支持 **TRON + 0G (ZeroGravity) EVM** 双链架构。

## 常用命令

```bash
# 安装依赖
npm install

# 启动后端（端口7778，需要MongoDB）
brew services start mongodb-community && ENV_FILE=.env.testnet node server/server.js

# 启动前端（端口3001）
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client

# 重新启动MongoDB
brew services restart mongodb-community

# 同时启动前后端
npm start

# 运行单元测试
npm test

# 运行合约测试
npm run test:contracts

# 运行服务层测试
npm run test:services

# 运行API测试
npm run test:api

# 运行E2E测试（需要先启动Chrome CDP端口9222）
npm run test:e2e

# 运行单个测试文件
node tests/e2e/tournament-two-players.js
mocha tests/services/ChipService.test.js --timeout 10000

# 构建生产版本
npm run build

# ============ 0G (ZeroGravity) 模式命令 ============

# 启动 0G 后端（使用 .env.0g 配置）
ENV_FILE=.env.0g node server/server.js

# 编译 0G 合约（Solidity ^0.8.20, EVM Paris fork）
npx hardhat compile

# 部署到 0G Testnet (Chain ID: 16602)
ENV_FILE=.env.0g npx hardhat run deploy-0g.js --network zerogTestnet

# 部署到 0G Mainnet (Chain ID: 16661)
ENV_FILE=.env.0g npx hardhat run deploy-0g.js --network zerogMainnet

# 运行 0G 测试套件
mocha tests/0g/e2e-full-flow.test.js --timeout 60000
mocha tests/0g/inft-flow.test.js --timeout 30000

# Playwright E2E 浏览器测试
npx playwright test tests/e2e/0g-poker.spec.ts

# 离线公平性验证
node scripts/verify-fairness.js <handId>
```

## 端口配置

- 前端: `http://127.0.0.1:3001`
- 后端 API: `http://127.0.0.1:7778`
- Chrome CDP: `9222`（E2E测试需要）
- MongoDB: `27017`

## 架构概览

### 前后端通信

Socket.io 实时通信，事件命名约定：
- `CS_*` - Client to Server（客户端发送）
- `SC_*` - Server to Client（服务端发送）

事件定义位于 `server/pokergame/actions.js` 和 `src/pokergame/actions.js`（镜像文件）。

### 服务端架构 (`server/`)

**核心模块**:
- `server.js` - 入口，初始化 Express 和 Socket.io
- `socket/index.js` - Socket 事件处理，管理 `tables` 和 `players` 对象
- `config.js` - 服务配置（端口、初始筹码、区块链设置）

**扑克游戏逻辑** (`pokergame/`):
- `Table.js` - 牌桌状态管理、发牌、下注轮次、胜负判定
- `TournamentTable.js` - 锦标赛专用牌桌
- `Player.js` - 玩家模型
- `Seat.js` - 座位状态
- `Deck.js` - 牌组
- `SidePot.js` - 边池计算

**区块链服务** (`blockchain/`):
- `TronService.js` - TRON 网络连接、钱包管理
- `ContractService.js` - TRON 智能合约交互（存款、提款、结算）
- `EventListener.js` - TRON 区块链事件监听
- `TransactionQueue.js` - 交易队列管理
- **0G 多链扩展**:
  - `BlockchainServiceInterface.js` - 统一接口定义
  - `ZeroGService.js` - 0G EVM 链服务适配器 (ethers v6, chainId 16602/16661)
  - `ZeroGContractService.js` - 0G 合约交互层
  - `ZeroGEventListener.js` - 0G 链事件监听
  - `blockchainFactory.js` - 工厂函数，根据 BLOCKCHAIN_MODE 返回对应 service

**业务服务** (`services/`):
- `TournamentService.js` - 锦标赛逻辑
- `ChipService.js` - CHIP 代币管理
- `NFTService.js` - NFT 成就系统（含 0G Storage 集成: uploadImageToStorage / prepareMintWithStorage）
- `DAOService.js` - DAO 治理
- `GameFlowIntegration.js` - 游戏流程与区块链集成
- **0G 扩展服务**:
  - `ZeroGStorageService.js` - 0G 去中心化存储 (文件上传/查询)
  - `ZeroGDAService.js` - Data Availability 服务 (洗牌种子 commit-reveal)
  - `SettlementRouter.js` - 双链结算路由器 (TRON vs 0G)
  - `AIService.js` - AI 引擎通信 (Node ↔ Python)
  - `AIMemoryService.js` - AI 持久记忆 (MongoDB 对手画像)

**API 路由** (`routes/api/`):
- `auth.js` - 认证
- `tournament.js` - 锦标赛 API
- `chips.js` - 筹码管理
- `nft.js` - NFT API
- `dao.js` - DAO API
- `chip.js` - CHIP 代币 API

### 客户端架构 (`src/`)

**Context 状态管理** (`context/`):
- `Providers.js` - 组合所有 Provider（含 ZeroGProvider）
- `websocket/WebsocketProvider.js` - Socket 连接管理
- `game/GameState.js` - 游戏状态和操作（join/leave/fold/check/call/raise）
- `global/GlobalState.js` - 全局状态（tables/players/chips）
- `modal/ModalProvider.js` - 弹窗管理
- `tron/TronContext.js` - TronLink 钱包连接
- **0G 扩展**: `zero-g/ZeroGContext.js` - MetaMask / EVM 钱包连接 (ethers v6)

**页面路由** (`pages/`):
- `/` → `Landing.js` - 首页/钱包连接（TRON + 0G/EVM 双按钮）
- `/play` → `Play.js` - 游戏主页面（含 🛡️ 公平性指示器 + Verify Fairness 按钮）
- `/tournament` → `Tournament.js` - 锦标赛列表
- `/tournament/:id` → `TournamentTable.js` - 锦标赛牌桌
- `/wallet` → `CHIPWallet.js` - 钱包页面（多链 Tab: TRON | 0G）
- `/dao` → `DAO.js` - DAO 治理
- `/nft` → `NFTGallery.js` - NFT 画廊（TRON NFT | 0G INFT 双 Tab）
- **新增**: `/fairness-verify` → `FairnessVerify.js` - 公平性验证页面

### 智能合约 (`contracts/`)

**TRON 合约**:
- `BridgeGameV1/V2/V3.sol` - 游戏主合约（存款、提款、结算）
- `Tournament.sol` - 锦标赛合约
- `ChipToken.sol` - CHIP 代币合约
- `AchievementNFT.sol` - NFT 成就合约
- `Staking.sol` - 质押合约
- `Governance.sol` - DAO 治理合约

**0G EVM 合约** (`contracts/0g/`):
- `PokerGame0G.sol` - 0G 游戏主合约（AccessControl + deposit/withdraw/settle/delegate）
- `PokerHandINFT.sol` - ERC-7857 Interactive NFT（mint/encryptedTransfer/clone/bindAgent）

### 配置文件

- `server/config.js` - 服务端配置，`INITIAL_CHIPS_AMOUNT` 控制初始筹码（默认 100 TRX）
- `src/clientConfig.js` - 客户端配置，`socketURI` 控制 Socket 连接地址
- `hardhat.config.js` - Hardhat 编译配置（含 zerogTestnet/zerogMainnet 网络）
- 环境变量: `.env.testnet` / `***REMOVED***`
- **新增**: `.env.0g` - 0G 模式环境变量（ZEROG_RPC_URL, ZEROG_PRIVATE_KEY, ZEROG_STORAGE_ENDPOINT 等）

## 游戏流程

1. 玩家连接钱包后发送 `CS_FETCH_LOBBY_INFO` 获取大厅信息
2. 发送 `CS_JOIN_TABLE` 加入牌桌，自动入座
3. 当有 2+ 玩家时自动开始新一手牌
4. 玩家通过 `CS_FOLD/CS_CHECK/CS_CALL/CS_RAISE` 进行操作
5. 每个操作有 15 秒超时，超时自动弃牌
6. 锦标赛满员后自动开始，结算时调用智能合约发放奖金

## 区块链集成

**双链架构**: TRON + 0G (ZeroGravity) EVM

**TRON 网络**（原有）:
- Testnet: Nile (`https://nile.trongrid.io`, ChainId: 3448148188)
- Mainnet: (`https://api.trongrid.io`, ChainId: 728126428)

**0G EVM 网络**（新增，`contracts/0g/`）:
- Testnet: `https://evmrpc-galileo.0g.ai`, ChainId: **16602**, Explorer: `https://chainscan-galileo.0g.ai`
- Mainnet: `https://rpc.0g.ai`, ChainId: **16661**
- **已部署合约 (testnet)**:
  - PokerGame0G: `0xc6F5495D411405630dF5d5ad32225d7F51dC1645`
  - PokerHandINFT: `0xC96368bbE503a13BCDBE0d38E06c167486d9ccC3`

**多链模式** (server/config.js `BLOCKCHAIN_MODE`):
- `'tron'` - 仅使用 TRON（默认）
- `'zerog'` - 仅使用 0G EVM
- `'both'` - 双链并行

**TRON 关键流程**:
1. 玩家通过 TronLink 连接钱包
2. 玩家授权服务器代理地址（Delegate）进行合约操作
3. 存款: 玩家调用合约 deposit() → EventListener 监听事件 → 更新数据库余额
4. 游戏: 服务器代理玩家进行合约调用
5. 结算: 服务器调用合约分配奖金

**0G 新增能力**:
- **去中心化存储**: NFT 图片/元数据上传至 0G Storage（rootHash 永久锚定）
- **Data Availability**: 洗牌种子 commit-reveal 方案，DA 锚定到 0G 链
- **ERC-7857 INFT**: Interactive NFT，支持加密转移、克隆、Agent 绑定
- **公平性验证**: 每手牌的 stateHash 可在链上查询和离线验证

**测试私钥模式**: 使用私钥直接调用 API，无需浏览器钱包连接：
```javascript
const PLAYER1_PRIVATE_KEY = '...';
const PLAYER2_PRIVATE_KEY = '...';
// 直接调用 API: x-wallet-address header
```

## 调试方法

### Chrome CDP 调试

```bash
# 启动 Chrome 调试实例
osascript -e 'quit app "Google Chrome"' 2>/dev/null; sleep 1
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
--remote-debugging-port=9222 \
--user-data-dir="/tmp/chrome-debug" \
"http://127.0.0.1:3001/" &
```

### CDP 脚本测试

```javascript
const CDP = require('chrome-remote-interface');
const client = await CDP({ port: 9222 });
const { Page, Runtime } = client;
// 通过 Runtime.evaluate 执行页面操作
```

### Puppeteer/Playwright 测试

Playwright 配置已设置为连接现有 Chrome 实例（CDP 端口 9222）。

## 技术栈

- **前端**: React 16, React Router 6, styled-components, zustand, Bootstrap 5
- **后端**: Express, Socket.io 4, Mongoose
- **区块链**: TronWeb v6, ethers.js
- **测试**: Playwright, Mocha, Chai, Hardhat
- **扑克逻辑**: pokersolver

## 测试用例guide
1.测试用例需要全面，端对端测试，各个界面按钮事件需要触发，进入游戏，模拟fold，call，raise等操作，根据前端、后台、浏览器日志确定是否有错误，确定所有测试用例通过
2.玩家1连接浏览器后，测试用例模拟点击按钮操作，截图看游戏状态和日志，如果一直不动，需要分析解决，直到测试流程完成
3.玩家2模拟点击操作，保证游戏可继续
4.完善相关测试用例，自动完成所有流程操作，而不仅仅是通过接口测试验证。
5.UI\逻辑\合约调用，端对端集成测试流程走一遍，解决相关问题
6.不要启动新的chrome浏览器，连接现有已启动的调试chrome浏览器
7.请参考按docs/GAME_BOT_TEST_FLOW.md文档内的测试流程进行测试，间断性的截图看状态分析，不要卡死
8.按照docs/GAME_BOT_TEST_FLOW.md 运行游戏自测流程，启动机器人，CDP 控制浏览器 UI 真实操作，让浏览器完整走这个流程，执行cdp-play-game.js，mock 顺子牌型，重新生成NFT


## 自动化测试guide
1.不要启动新的chrome浏览器，连接现有已启动的调试chrome浏览器
2.按照docs/GAME_BOT_TEST_FLOW.md 运行游戏自测流程，启动机器人，CDP 控制浏览器 UI 真实操作，让浏览器完整走这个流程，执行cdp-play-game.js，间断性的截图看状态分析，不要卡死

PLAYER1.address = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
PLAYER2.address = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';

// 测试玩家
const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};

const PLAYER2 = {
    address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};
