# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 Web3 的多人在线德州扑克游戏，使用 React 前端 + Express/Socket.io 后端架构。玩家通过钱包连接进入游戏。

## 常用命令

```bash
# 安装依赖
npm install

# 启动开发服务器（同时启动前端和后端）
npm start

# 构建生产版本
npm build

# 运行测试
npm test
```

- 前端运行在 `http://localhost:3000`
- 后端 API/Socket 服务运行在端口 `7777`

## 架构概览

### 前后端通信

使用 Socket.io 进行实时通信，事件命名约定：
- `CS_*` - Client to Server（客户端发送）
- `SC_*` - Server to Client（服务端发送）

事件定义位于：
- 服务端: `server/pokergame/actions.js`
- 客户端: `src/pokergame/actions.js`（镜像文件）

### 服务端核心模块 (`server/`)

- `server.js` - 入口，初始化 Express 和 Socket.io
- `socket/index.js` - Socket 事件处理，管理 `tables` 和 `players` 对象
- `pokergame/` - 扑克游戏核心逻辑
  - `Table.js` - 牌桌状态管理、发牌、下注轮次、胜负判定
  - `Player.js` - 玩家模型
  - `Seat.js` - 座位状态
  - `Deck.js` - 牌组
  - `SidePot.js` - 边池计算
- `config.js` - 服务配置（端口、初始筹码等）

### 客户端核心模块 (`src/`)

**Context 状态管理** (`src/context/`):
- `Providers.js` - 组合所有 Provider
- `websocket/WebsocketProvider.js` - Socket 连接管理
- `game/GameState.js` - 游戏状态和操作（join/leave/fold/check/call/raise）
- `global/GlobalState.js` - 全局状态（tables/players/chips）
- `modal/ModalProvider.js` - 弹窗管理

**页面路由** (`src/pages/`):
- `/` → `ConnectWallet` - 钱包连接页
- `/play` → `Play` - 游戏主页面

**游戏组件** (`src/components/game/`):
- `PokerTable.js` - 牌桌渲染
- `Seat/` - 座位组件
- `Hand.js` - 手牌显示
- `BetSlider/` - 下注滑块

### 配置文件

- `server/config.js` - 服务端配置，`INITIAL_CHIPS_AMOUNT` 控制初始筹码
- `src/clientConfig.js` - 客户端配置，`socketURI` 控制 Socket 连接地址
- 环境变量文件: `server/config/local.env`（开发环境）

## 游戏流程

1. 玩家连接钱包后发送 `CS_FETCH_LOBBY_INFO` 获取大厅信息
2. 发送 `CS_JOIN_TABLE` 加入牌桌，自动入座
3. 当有 2+ 玩家时自动开始新一手牌
4. 玩家通过 `CS_FOLD/CS_CHECK/CS_CALL/CS_RAISE` 进行操作
5. 每个操作有 15 秒超时，超时自动弃牌

## 技术栈

- **前端**: React 16, React Router 6, styled-components, zustand, Bootstrap 5
- **后端**: Express, Socket.io 4
- **扑克逻辑**: pokersolver（手牌评估）
- **区块链**: ethers.js（钱包连接）

## 调试自测方法
### 配置
通过以下方法先启动chrome调试版本,连接这个chrome实例调试
osascript -e 'quit app "Google Chrome"' 2>/dev/null; sleep 1
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
--remote-debugging-port=9222 \
--user-data-dir="/tmp/chrome-debug" \
"http://127.0.0.1:3001/" &

### 通过puppeteer 模拟点击测试验证
const puppeteer = require('puppeteer');
     (async () => {
         const browser = await puppeteer.launch({headless: false});
         const page = await browser.newPage();
         const logs = [];

### 让我使用原生 Node.js 模块通过 CDP 操作浏览器：
⏺ Write(cdp-deposit.js)
⎿  Wrote 64 lines to cdp-deposit.js
const http = require('http');
const WebSocket = require('ws');
 async function triggerDeposit() {                            
     console.log('🔌 Connecting to Chrome CDP...');                                                                                                    
                                                              
     // Get page info
     const pages = await new Promise((resolve, reject) => {
         http.get('http://localhost:9222/json', (res) => {
             let data = '';
 … +54 lines (ctrl+o to expand)
⏺ 运行 CDP 脚本：
⏺ Bash(node cdp-deposit.js)
⎿  🔌 Connecting to Chrome CDP...
✅ Found page: http://192.168.10.46:3000/
💰 Filling deposit amount...
… +3 lines (ctrl+o to expand)
⏺ 完美！充值操作已触发。现在让我检查服务器日志看是否捕获到充值事件：
⏺ Searched for 1 pattern (ctrl+o to expand)
⏺ 充值按钮已成功触发！现在需要在TronLink 钱包中确认交易。让我持续监控服务器日志：
⏺ Bash(echo "👀 Monitoring for deposit event (30 seconds)..." && for i in {1..10}; do sleep 3; tail -5 /tmp/server.log | grep -E "(DEPOSIT EVENT|Polled
[1-9])" && brea…)
⎿  👀 Monitoring for deposit event (30 seconds)...
✅ Monitoring complete
⎿  (timeout 35s)
⏺ 让我检查最新的服务器状态和日志：
⏺ Read 1 file (ctrl+o to expand)
⏺ 我发现了关键信息！日志显示：
[ContractService] Joined table 1 with 100000000 SUN
这说明合约调用成功了，但 EventListener 没有捕获到 Deposit 事件。问题在于 tronWeb.getEventResult() 的使用方式。
让我创建一个测试脚本验证事件获取：
⏺ Write(test-event-fetch.js)

### 还可以尝试使用playwright测试验证
ash(node -e "
const { chromium } = require('playwright')…)
⎿  Opening editor...
Adding photos via auto-layout...
Checking page thumbnails...
… +4 lines (ctrl+o to expand)


## 测试用例guide
1.测试用例需要全面，端对端测试，各个界面按钮事件需要触发，进入游戏，模拟fold，call，raise等操作，根据前端、后台、浏览器日志确定是否有错误，确定所有测试用例通过
2.玩家1连接浏览器后，测试用例模拟点击按钮操作，截图看游戏状态和日志，如果一直不动，需要分析解决，直到测试流程完成
3.玩家2模拟点击操作，保证游戏可继续
4.完善相关测试用例，自动完成所有流程操作，而不仅仅是通过接口测试验证。
5.UI\逻辑\合约调用，端对端集成测试流程走一遍，解决相关问题

## 自动化测试guide
1.不要启动新的chrome浏览器，连接现有已启动的调试chrome浏览器
2.请参考按docs/GAME_BOT_TEST_FLOW.md文档内的测试流程进行测试，间断性的截图看状态分析，不要卡死
3.按照docs/GAME_BOT_TEST_FLOW.md 运行游戏自测流程，启动机器人，CDP 控制浏览器 UI 真实操作，让浏览器完整走这个流程，执行cdp-play-game.js

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


tests/e2e/nft-straight-e2e.js  NFT顺子牌型端对端完整测试
TUNNEL_TEST_REPORT.md 云隧道方案测试报告

1.重启mongoDB
brew services restart mongodb-community    

2.杀掉现有服务,并重启后端服务
kill -9 $(lsof -ti:7777)
kill -9 $(lsof -ti:7778)
kill -9 $(lsof -ti:3000)
kill -9 $(lsof -ti:3001)

ENV_FILE=.env.testnet node server/server.js

3.重启前端服务
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client

4.重启调试chrome：
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
--remote-debugging-port=9222 \
--user-data-dir="/tmp/chrome-debug" \
"http://127.0.0.1:3001/"

5.启动云隧道
./quick-start-tunnel.sh - 快速启动脚本

cloudflared tunnel --url http://localhost:7778


https://lil-query-starring-determination.trycloudflare.com

node set-nft-baseuri-public.js https://infants-freelance-laugh-corners.trycloudflare.com/api/nft/metadata/

  元数据验证通过：
  - name: Straight #18
  - description: Hello world cards 10h 9d 8c 7s 6h  ✅
  - Cards: 10h 9d 8c 7s 6h ✅

  TronLink 刷新方法：打开 TronLink → NFT → 找到 #18 → 下拉刷新（或删除后重新导入合约地址 TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC）。


## 文件新建存放规则
所有测试脚本文件放在tests目录
所有log文件放入logs目录
所有CDP脚本文件放入cdp-scripts目录

## 自动化测试，截图，模拟点击操作，包括签名、充值、游戏流程等，参考以下文档
docs/Tronlink_Deposit_AutoSign.md

## 0G配置信息：
 
服务器钱包地址:
0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc

玩家地址：0x8808ff950b9bfddde445fd099262e80cee858eb5


## 钱包相关操作的鼠标点击位置信息
钱包断开连接两次点击操作位置：
  [ 60] [CLICK] (1464, 883) [P] t=  21.98s
  [ 74] [CLICK] (1362, 380) [P] t=  27.80s

点击0G/EVM 按钮：
  [ 19] [CLICK] ( 492, 758) [P] t=   4.64s

钱包选择钱包MetaMask：
  [ 20] [CLICK] (1208, 271) [P] t=   5.08s

钱包连接网络Connect：
  [ 41] [CLICK] (1425, 875) [P] t=  13.47s

钱包确认连接：
  [ 41] [CLICK] (1425, 875) [P] t=  13.47s

浏览器刷新页面操作：
  [ 16] [CLICK] (  93,  96) [P] t=   4.20s

以上是钱包相关操作的鼠标点击位置,参考mouse-operations.json.replay.py回放执行相关操作完成钱包选择，连接网络，确认，断开网络等操作，配合CDP完成整个连接网络，Deposit，WithDraw，Authorize Sever等功能测试，同时检查浏览器日志是否有错误