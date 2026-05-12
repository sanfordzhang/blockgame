# Poker Game Project

## Quick Start

```bash
npm install
npm start
```

访问: http://localhost:3000

## 游戏访问方式

### 方式 1: URL 参数
```
http://localhost:3000/?walletAddress=0x123...&gameId=1&username=player1
```

### 方式 2: 自动生成（本地开发）
直接访问 http://localhost:3000，系统会自动生成钱包地址和用户名

### 方式 3: MetaMask（需要实现）
- 需要集成 MetaMask 扩展
- 请查看 `GAME_ANALYSIS.md` 第5章

## 调试

### 前端调试
1. 打开浏览器开发者工具 (F12)
2. 切换到 Sources 标签
3. 在 `webpack://` → `src` 中找到文件
4. 点击行号设置断点

**关键文件：**
- `src/pages/ConnectWallet/ConnectWallet.js` - 钱包连接
- `src/pages/Play.js` - 游戏页面
- `src/context/game/GameState.js` - 游戏状态

### 后端调试
1. 在 VS Code 中按 F5
2. 选择 "Debug Server" 配置
3. 在 `server/socket/index.js` 或 `server/pokergame/Table.js` 中设置断点

### WebSocket 调试
- 打开开发者工具 → Network → WS 过滤
- 查看消息发送和接收

## 测试

```bash
# 安装 Playwright
npm install -D @playwright/test
npx playwright install

# 运行测试
npm run test
```

## 项目结构

```
game-core/
├── src/                    # 前端代码
│   ├── pages/             # 页面组件
│   │   ├── ConnectWallet/ # 钱包连接
│   │   ├── Play.js        # 游戏页面
│   │   ├── Landing.js     # 首页
│   │   ├── Register.js    # 注册页
│   │   └── Login.js      # 登录页
│   ├── context/           # Context 状态管理
│   │   ├── global/       # 全局状态
│   │   ├── game/         # 游戏状态
│   │   └── websocket/    # WebSocket 连接
│   └── pokergame/        # 游戏逻辑（前端）
├── server/                # 后端代码
│   ├── pokergame/        # 游戏逻辑（后端）
│   │   ├── Table.js      # 桌子逻辑
│   │   ├── Player.js     # 玩家逻辑
│   │   ├── Seat.js       # 座位逻辑
│   │   └── Deck.js       # 牌堆逻辑
│   ├── socket/           # Socket.IO 处理
│   └── server.js         # 服务器入口
└── tests/               # Playwright 测试
```

## 游戏机制

### 筹码系统
- **虚拟筹码**：游戏使用虚拟筹码，不涉及真实数字货币
- **初始筹码**：100,000
- **筹码流动**：
  - 坐下时扣除
  - 下注时进入底池
  - 胜利时获得底池
  - 离开时返还

### 游戏流程
1. 玩家连接 → 2. 加入桌子 → 3. 坐下 → 4. 发牌 → 5. 下注 → 6. 决定胜负 → 7. 结算

### Socket 事件

**客户端 → 服务器**:
- `CS_FETCH_LOBBY_INFO` - 获取大厅信息
- `CS_JOIN_TABLE` - 加入桌子
- `CS_SIT_DOWN` - 坐下
- `CS_FOLD` - 弃牌
- `CS_CHECK` - 过牌
- `CS_CALL` - 跟注
- `CS_RAISE` - 加注
- `CS_STAND_UP` - 站起
- `CS_LEAVE_TABLE` - 离开桌子

**服务器 → 客户端**:
- `SC_RECEIVE_LOBBY_INFO` - 大厅信息
- `SC_TABLE_JOINED` - 已加入桌子
- `SC_TABLE_UPDATED` - 桌子状态更新
- `SC_PLAYERS_UPDATED` - 玩家列表更新
- `SC_TABLES_UPDATED` - 桌子列表更新

## 详细文档

请查看 `GAME_ANALYSIS.md` 获取：
1. 完整的代码执行逻辑
2. 筹码机制详解
3. player2 问题分析
4. 调试指南
5. Playwright + MetaMask 配置

## 常见问题

### Q: 为什么本机登录总是显示 player2？
**A:** 已修复！现在会自动生成唯一的钱包地址和用户名，并保存到 localStorage。

### Q: 游戏支持 MetaMask 吗？
**A:** 目前版本需要通过 URL 参数传递玩家信息。要集成 MetaMask，需要修改 ConnectWallet 组件（详见 GAME_ANALYSIS.md）。

### Q: 游戏输赢会有真实的数字货币交易吗？
**A:** 不会。游戏使用虚拟筹码系统，不涉及真实的区块链交易。

## 技术栈

- **前端**: React 16, Socket.io-client, React Router, Styled-components
- **后端**: Node.js, Express, Socket.io
- **游戏逻辑**: pokersolver (扑克牌型计算)
- **测试**: Playwright
