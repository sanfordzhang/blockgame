# 游戏机器人测试流程

## 概述

本文档描述如何使用游戏机器人和CDP（Chrome DevTools Protocol）进行端到端游戏测试，包括 Mock 游戏模式（测试顺子 NFT 成就）。

## 前置条件

1. 后端服务运行在 `http://127.0.0.1:7778`
2. 前端服务运行在 `http://127.0.0.1:3001`
3. MongoDB 运行
4. Chrome 浏览器开启 CDP 调试端口 9222

## 启动命令

### 1. 启动后端
```bash
brew services start mongodb-community
ENV_FILE=.env.testnet node server/server.js
```

### 2. 启动前端
```bash
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client
```

### 3. 启动 Chrome CDP
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
--remote-debugging-port=9222 \
--user-data-dir="/tmp/chrome-debug" \
"http://127.0.0.1:3001/"
```

### 4. 启动游戏机器人
```bash
node scripts/game-bot.js
# 或使用启动脚本
./start-bot.sh
```

## 机器人配置

机器人配置位于 `scripts/game-bot.js`：

```javascript
const BOT_CONFIG = {
    name: 'Bot_Alice',
    address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',  // 机器人钱包地址
    addressLower: 'tx27ljdqk64d4nvbxkt1taayx5dpf4jpl4',  // 小写地址用于匹配
    serverUrl: 'http://127.0.0.1:7778'
};
```

## Mock 游戏模式

### 功能说明
Mock 游戏模式用于测试 NFT 成就系统。开启后，玩家1（seat 1）将获得顺子牌型：

- **玩家1手牌**: 5♥ 6♥
- **公共牌**: 7♥ 8♥ 9♦ 2♣ 3♠
- **结果**: 玩家1有 5-6-7-8-9 顺子

### 使用方法

1. **在锦标赛页面勾选 Mock 游戏开关**
2. **创建新的锦标赛**（点击"双人赛"按钮）
3. **等待机器人加入**
4. **加入游戏并完成一手牌**

### 代码修改

#### 前端 (`src/pages/Tournament.js`)
- 添加 Mock 游戏开关 UI
- 创建锦标赛时传递 `mockGame` 参数
- 状态保存在 `localStorage`

#### 后端
- `server/routes/api/tournament.js`: 接收 `mockGame` 参数
- `server/services/TournamentService.js`: 保存 `mockGame` 到锦标赛记录
- `server/pokergame/TournamentTable.js`: Mock 模式下设置顺子牌组
- `server/models/Tournament.js`: 添加 `mockGame` 字段

## 测试流程

### 自动化测试脚本

运行 `cdp-play-game.js` 进行完整测试：

```bash
node cdp-play-game.js
```

### 手动测试步骤

#### 步骤1: 启动机器人
机器人会自动：
1. 连接到服务器 Socket
2. 创建2人锦标赛 (configId: 3)
3. 发送 `CS_TOURNAMENT_JOIN` 和 `CS_TOURNAMENT_ROOM_JOIN` 事件
4. 等待其他玩家加入

#### 步骤2: CDP 连接浏览器
```javascript
const CDP = require('chrome-remote-interface');
const client = await CDP({ port: 9222 });
const { Page, Runtime } = client;
```

#### 步骤3: 导航到锦标赛页面
```javascript
await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
await Page.loadEventFired();
```

#### 步骤4: 勾选 Mock 游戏开关（可选）
```javascript
const checkbox = document.querySelector('input[data-testid="mock-game-checkbox"]');
if (checkbox && !checkbox.checked) {
    checkbox.click();
}
```

#### 步骤5: 点击锦标赛卡片
找到带有 `1 / 2` 玩家的锦标赛卡片：
```javascript
// 卡片选择器: .sc-bypJrT.ilegoF
const cards = document.querySelectorAll('.sc-bypJrT.ilegoF');
for (const card of cards) {
    if ((card.innerText || '').includes('1 / 2')) {
        card.click();
        break;
    }
}
```

#### 步骤6: 点击 Confirm 加入
```javascript
// 查找并点击 Confirm 按钮
const buttons = document.querySelectorAll('button');
for (const btn of buttons) {
    if (btn.textContent.trim() === 'Confirm') {
        btn.click();
        break;
    }
}
```

#### 步骤7: 游戏操作
游戏开始后，根据按钮状态执行操作：
```javascript
// 检查可用按钮
const buttons = Array.from(document.querySelectorAll('button'))
    .filter(b => !b.disabled)
    .map(b => b.textContent.trim());

// 操作优先级: Check > Call > Fold
if (buttons.includes('Check')) {
    clickButton('Check');
} else if (buttons.includes('Call')) {
    clickButton('Call');
} else if (buttons.includes('Fold')) {
    clickButton('Fold');
}
```

## Socket 事件

### 客户端发送 (CS_*)
| 事件 | 参数 | 说明 |
|------|------|------|
| `CS_TOURNAMENT_JOIN` | `{ tournamentId, walletAddress }` | 加入锦标赛 |
| `CS_TOURNAMENT_ROOM_JOIN` | `{ tournamentId, walletAddress }` | 更新 socketId 到 table |
| `CS_TOURNAMENT_CHECK` | `{ tournamentId }` | Check 操作 |
| `CS_TOURNAMENT_CALL` | `{ tournamentId }` | Call 操作 |
| `CS_TOURNAMENT_RAISE` | `{ tournamentId, amount }` | Raise 操作 |
| `CS_TOURNAMENT_FOLD` | `{ tournamentId }` | Fold 操作 |

### 服务端发送 (SC_*)
| 事件 | 数据 | 说明 |
|------|------|------|
| `SC_TOURNAMENT_STARTED` | `{ tournamentId, status, prizePool }` | 锦标赛开始 |
| `tournament_game_state` | 游戏状态对象 | 游戏状态更新 |

## 游戏状态对象

```javascript
{
    id: "tournamentId",
    turn: 1,  // 当前轮到哪个座位 (1 或 2)
    pot: 150000,  // 底池
    street: "flop",  // 游戏阶段: preflop/flop/turn/river
    board: [  // 公共牌
        { rank: "A", suit: "h" },
        { rank: "K", suit: "h" },
        { rank: "Q", suit: "h" }
    ],
    seats: {
        "1": {
            player: { id: "tx27...", name: "Bot_Alice", socketId: "..." },
            hand: [{ rank: "J", suit: "h" }, { rank: "10", suit: "h" }],
            stack: 1900000,
            turn: true,  // 是否轮到该座位
            folded: false
        },
        "2": {
            player: { id: "tu8r...", name: "Player", socketId: "..." },
            hand: [...],
            stack: 1950000,
            turn: false,
            folded: false
        }
    },
    callAmount: 0,  // 需要跟注的金额
    bigBlind: 100000  // 大盲注
}
```

## 常见问题

### Q: 机器人创建了锦标赛但没有加入？
A: 确保同时发送 `CS_TOURNAMENT_JOIN` 和 `CS_TOURNAMENT_ROOM_JOIN` 两个事件，后者会更新 socketId 到 table 中。

### Q: 游戏卡住不动？
A: 检查：
1. 机器人是否正常运行（`ps aux | grep game-bot`）
2. RAISE 操作需要 `amount` 参数
3. 检查服务器日志 `/tmp/server.log`

### Q: 座位地址匹配失败？
A: `seat.player` 可能是对象 `{id: "address"}` 或字符串，需要正确处理：
```javascript
const playerAddr = typeof seat.player === 'string' 
    ? seat.player.toLowerCase() 
    : (seat.player.id || '').toLowerCase();
```

### Q: Mock 游戏模式不生效？
A: 检查：
1. Mock 开关是否已勾选
2. 锦标赛是否在勾选后创建（之前的锦标赛不受影响）
3. 服务器日志是否显示 `mockGame=true`

## 测试截图

测试脚本会自动保存截图到 `test-results/` 目录：
- `cdp-game-01-initial.png` - 初始页面
- `cdp-game-02-mock-enabled.png` - Mock 开关开启后
- `cdp-game-03-tournament-created.png` - 创建锦标赛后
- `cdp-game-round-N.png` - 每个回合的操作
- `cdp-game-final.png` - 最终状态
