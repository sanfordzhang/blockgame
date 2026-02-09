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
