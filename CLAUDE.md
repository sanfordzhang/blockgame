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
"http://192.168.10.46:3000/" &

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
2.玩家1连接浏览器后，测试用例模拟点击按钮操作，截图看游戏状态和日志，如果一直不动，需要分析解决，直到锦标赛整个游戏过程完成
3.玩家2模拟点击操作，保证游戏可继续
4.完善相关测试用例，自动完成所有流程操作，而不仅仅是通过接口测试验证。

PLAYER1.address = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
PLAYER2.address = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
