# 游戏代码执行逻辑详细说明

## 1. 游戏代码执行逻辑

### 1.1 整体架构

```
前端 (React + Socket.io-client)
    ↓ WebSocket 连接
后端 (Node.js + Express + Socket.io)
    ↓ 游戏逻辑
扑克游戏引擎 (Table, Player, Seat, Deck)
```

### 1.2 启动流程

#### 前端启动流程：
1. **入口文件**: `src/index.js`
   - 加载 React 应用
   - 渲染 Providers 包装器
   - 等待 window.onload 显示应用

2. **路由初始化**: `src/components/routing/Routes.js`
   - `/` → ConnectWallet (连接钱包)
   - `/landing` → Landing (首页)
   - `/play` → Play (游戏页面)

3. **钱包连接**: `src/pages/ConnectWallet/ConnectWallet.js`
   ```javascript
   useEffect(() => {
     const walletAddress = query.get('walletAddress')
     const gameId = query.get('gameId')
     const username = query.get('username')

     if (!walletAddress || !gameId || !username) {
       setMissingParams(true)  // 重定向到 landing 页面
       return
     }

     if(socket && socket.connected) {
       setWalletAddress(walletAddress)
       socket.emit(CS_FETCH_LOBBY_INFO, { walletAddress, socketId, gameId, username })
       navigate('/play')
     }
   }, [socket])
   ```

#### 后端启动流程：
1. **服务器启动**: `server/server.js`
   - 初始化 Express 应用
   - 配置中间件
   - 设置路由
   - 启动 Socket.IO 监听

2. **WebSocket 连接**: `server/socket/index.js`
   ```javascript
   socket.on('connect', (socket) => gameSocket.init(socket, io))
   ```

### 1.3 游戏流程

#### 1.3.1 玩家加入游戏

**前端** (`src/pages/Play.js`):
```javascript
useEffect(() => {
  socket && walletAddress && joinTable(1)  // 加入第1张桌子
  return () => leaveTable()
}, [socket, walletAddress])
```

**后端** (`server/socket/index.js`):
```javascript
socket.on(CS_JOIN_TABLE, (tableId) => {
  const table = tables[tableId];
  const player = players[socket.id];
  table.addPlayer(player);
  socket.emit(SC_TABLE_JOINED, { tables: getCurrentTables(), tableId });
  sitDown(tableId, table.players.length, table.limit)  // 自动坐下
})
```

#### 1.3.2 玩家坐下
```javascript
socket.on(CS_SIT_DOWN, ({ tableId, seatId, amount }) => {
  table.sitPlayer(player, seatId, amount);
  updatePlayerBankroll(player, -amount);  // 扣除筹码
  if (table.activePlayers().length === 2) {
    initNewHand(table);  // 开始新手牌
  }
})
```

#### 1.3.3 开始新手牌 (`server/pokergame/Table.js`)

```javascript
startHand() {
  this.deck = new Deck();           // 洗牌
  this.resetBoardAndPot();          // 重置底池
  this.clearSeatHands();            // 清空手牌
  this.resetBetsAndActions();       // 重置下注
  this.unfoldPlayers();             // 取消弃牌
  this.button = this.nextActivePlayer(this.button, 1);
  this.setTurn();                   // 设置第一个行动玩家
  this.dealPreflop();               // 发底牌
  this.setBlinds();                 // 设置盲注
  this.handOver = false;
}
```

#### 1.3.4 下注流程

**玩家操作**:
- **弃牌** (Fold): `CS_FOLD`
- **过牌** (Check): `CS_CHECK`
- **跟注** (Call): `CS_CALL`
- **加注** (Raise): `CS_RAISE`

**处理示例** (`server/pokergame/Table.js`):
```javascript
handleCall(socketId) {
  let seat = this.findPlayerBySocketId(socketId);
  let addedToPot = this.callAmount - seat.bet;
  seat.callRaise(this.callAmount);
  this.pot += addedToPot;  // 增加底池
  return { message: `${seat.player.name} calls $${addedToPot.toFixed(2)}` };
}
```

#### 1.3.5 发牌流程

```javascript
dealNextStreet() {
  const length = this.board.length;
  if (length === 0) {
    this.dealFlop();      // 翻牌（3张）
  } else if (length === 3 || length === 4) {
    this.dealTurnOrRiver(); // 转牌或河牌（1张）
  } else if (length === 5) {
    this.determineSidePotWinners();
    this.determineMainPotWinner();  // 决定胜负
  }
}
```

#### 1.3.6 胜负判定

```javascript
determineWinner(amount, seats) {
  const participants = seats
    .filter((seat) => seat && !seat.folded)
    .map((seat) => {
      const cards = seat.hand.slice().concat(this.board.slice());
      const solverCards = this.mapCardsForPokerSolver(cards);
      return { seatId: seat.id, solverCards };
    });

  const solverWinners = Hand.winners(
    participants.map((p) => Hand.solve(p.solverCards))
  );

  const winners = solverWinners.map((winner) => {
    const winningCards = winner.cardPool.map((card) => card.value + card.suit);
    const seatId = findHandOwner(winningCards);
    return [seatId, winner.descr];
  });

  for (let i = 0; i < winners.length; i++) {
    const seat = this.seats[winners[i][0]];
    const winAmount = amount / winners.length;
    seat.winHand(winAmount);  // 增加筹码
    this.winMessages.push(
      `${seat.player.name} wins $${winAmount.toFixed(2)} with ${winners[i][1]}`
    );
  }
}
```

#### 1.3.7 玩家离开

```javascript
socket.on(CS_LEAVE_TABLE, (tableId) => {
  const seat = Object.values(table.seats).find(
    (seat) => seat && seat.player.socketId === socket.id
  );
  if (seat && player) {
    updatePlayerBankroll(player, seat.stack);  // 返还筹码到账户
  }
  table.removePlayer(socket.id);
})
```

### 1.4 状态管理

#### 前端 Context:
- **GlobalState**: 玩家基本信息（用户名、邮箱、筹码、钱包地址等）
- **GameState**: 游戏状态（当前桌子、座位ID、消息等）
- **SocketContext**: WebSocket 连接

#### 后端状态:
- **tables**: 游戏桌子列表
- **players**: 在线玩家列表
- **Table**: 桌子状态（座位、底池、公共牌等）

---

## 2. 游戏输赢后的数字货币变化

### 2.1 当前实现：虚拟筹码系统

**重要发现**：当前游戏使用的是虚拟筹码系统，**不涉及真实的数字货币交易**。

### 2.2 筹码流动机制

#### 2.2.1 初始筹码
```javascript
// server/config.js
INITIAL_CHIPS_AMOUNT: 100000
```

#### 2.2.2 坐下时扣除筹码
```javascript
// server/socket/index.js
const sitDown = (tableId, seatId, amount) => {
  table.sitPlayer(player, seatId, amount);
  updatePlayerBankroll(player, -amount);  // 从账户扣除
}
```

#### 2.2.3 下注时增加底池
```javascript
// server/pokergame/Table.js
handleCall(socketId) {
  let addedToPot = this.callAmount - seat.bet;
  seat.callRaise(this.callAmount);
  this.pot += addedToPot;  // 底池增加
}
```

#### 2.2.4 胜利时获得底池
```javascript
// server/pokergame/Table.js
determineWinner(amount, seats) {
  for (let i = 0; i < winners.length; i++) {
    const winAmount = amount / winners.length;
    seat.winHand(winAmount);  // 座位筹码增加
  }
}

// server/pokergame/Seat.js
winHand(amount) {
  this.bet = 0;
  this.stack += amount;  // 座位筹码增加
}
```

#### 2.2.5 离开桌子时返还筹码
```javascript
// server/socket/index.js
socket.on(CS_LEAVE_TABLE, (tableId) => {
  const seat = Object.values(table.seats).find(
    (seat) => seat && seat.player.socketId === socket.id
  );
  if (seat && player) {
    updatePlayerBankroll(player, seat.stack);  // 筹码返回账户
  }
})

function updatePlayerBankroll(player, amount) {
  players[socket.id].bankroll += amount;  // 更新玩家余额
  io.to(socket.id).emit(SC_PLAYERS_UPDATED, getCurrentPlayers());
}
```

### 2.3 答案：**没有真实的数字货币交易**

当前游戏使用的是虚拟筹码系统，所有的筹码变化仅限于游戏内，不涉及任何区块链数字货币的转账、扣除或增加。

---

## 3. 为什么本机登录玩家名总是 player2

### 3.1 问题原因分析

#### 3.1.1 URL 参数要求

根据 `src/pages/ConnectWallet/ConnectWallet.js`：
```javascript
useEffect(() => {
  const walletAddress = query.get('walletAddress')
  const gameId = query.get('gameId')
  const username = query.get('username')

  if (!walletAddress || !gameId || !username) {
    setMissingParams(true)
    return  // 重定向到 landing 页面
  }
}, [socket])
```

**游戏需要通过 URL 参数传递玩家信息**，例如：
```
http://localhost:3000/?walletAddress=0x123...&gameId=1&username=player1
```

### 3.2 为什么其他机器正常

其他机器可能通过以下方式传递了正确的 URL 参数：

1. **外部链接跳转**: 通过带有参数的链接进入游戏
2. **游戏平台集成**: 游戏平台在跳转时自动附加参数
3. **本地存储**: 使用 localStorage 存储了参数

### 3.3 为什么本机显示 player2

**可能原因**：

1. **浏览器缓存**: 之前访问时使用了 `username=player2`
2. **默认参数**: 某处代码设置了默认值
3. **URL 残留**: 浏览器地址栏保留了之前的参数

### 3.4 解决方案

#### 方案 1: 添加默认参数处理

修改 `src/pages/ConnectWallet/ConnectWallet.js`:
```javascript
useEffect(() => {
  const walletAddress = query.get('walletAddress') || 'default_wallet_' + Math.random().toString(36).substring(7)
  const gameId = query.get('gameId') || '1'
  const username = query.get('username') || `player_${Math.floor(Math.random() * 1000)}`

  if(socket && socket.connected) {
    setWalletAddress(walletAddress)
    socket.emit(CS_FETCH_LOBBY_INFO, { walletAddress, socketId: socket.id, gameId, username })
    navigate('/play')
  }
}, [socket])
```

#### 方案 2: 添加 MetaMask 集成

创建钱包连接功能：
```javascript
// 添加 MetaMask 连接
const connectMetaMask = async () => {
  if (typeof window.ethereum !== 'undefined') {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
    const walletAddress = accounts[0]
    const username = walletAddress.slice(0, 8)
    const gameId = '1'

    setWalletAddress(walletAddress)
    socket.emit(CS_FETCH_LOBBY_INFO, { walletAddress, socketId: socket.id, gameId, username })
    navigate('/play')
  }
}
```

#### 方案 3: 使用 localStorage 保存

```javascript
useEffect(() => {
  const savedUsername = localStorage.getItem('game_username')
  const username = query.get('username') || savedUsername || `player_${Math.floor(Math.random() * 1000)}`

  localStorage.setItem('game_username', username)
  // ...
}, [])
```

### 3.5 当前没有 MetaMask 集成

通过代码搜索发现，项目中**没有找到 MetaMask 相关代码**，说明游戏目前不支持真正的钱包连接，仅依赖 URL 参数传递玩家信息。

---

## 4. 启动调试模式并打断点

### 4.1 启动开发服务器

```bash
npm start
```

### 4.2 浏览器开发者工具

#### 4.2.1 打开开发者工具

- **Chrome/Edge**: `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Firefox**: `F12` 或 `Ctrl+Shift+K`

#### 4.2.2 Sources 面板（调试前端）

1. 打开 **Sources** 标签
2. 在左侧文件树中找到要调试的文件：
   - `webpack://` → `src` → 选择文件
3. 点击行号设置断点
4. 触发相应操作，调试器会在断点处暂停

#### 4.2.3 调试关键位置

**前端关键断点位置**:

1. **ConnectWallet.js:23-38** - 钱包连接逻辑
   ```javascript
   const walletAddress = query.get('walletAddress')  // 断点1
   socket.emit(CS_FETCH_LOBBY_INFO, {...})          // 断点2
   ```

2. **Play.js:59-71** - 游戏加入逻辑
   ```javascript
   joinTable(1)  // 断点3
   ```

3. **GameState.js:59-63** - Socket 事件监听
   ```javascript
   socket.on(SC_TABLE_UPDATED, ({ table, message, from }) => {  // 断点4
     console.log(SC_TABLE_UPDATED, { table, message, from })
   })
   ```

4. **Play.js:227-240** - 玩家操作处理
   ```javascript
   <GameUI
     raise={raise}
     fold={fold}     // 断点5
     check={check}
     call={call}
   />
   ```

### 4.3 后端调试

#### 4.3.1 VS Code 调试配置

创建 `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/server/server.js",
      "env": {
        "NODE_ENV": "development"
      }
    }
  ]
}
```

#### 4.3.2 后端关键断点位置

**后端关键断点位置**:

1. **server/socket/index.js:76-103** - 玩家连接
   ```javascript
   socket.on(CS_FETCH_LOBBY_INFO, ({walletAddress, socketId, gameId, username}) => {
     // 断点1
     players[socketId] = new Player(...)
   })
   ```

2. **server/socket/index.js:105-122** - 加入桌子
   ```javascript
   socket.on(CS_JOIN_TABLE, (tableId) => {
     table.addPlayer(player);  // 断点2
   })
   ```

3. **server/pokergame/Table.js:134-154** - 开始新手牌
   ```javascript
   startHand() {
     this.deck = new Deck();  // 断点3
     this.dealPreflop();
   }
   ```

4. **server/pokergame/Table.js:506-519** - 处理弃牌
   ```javascript
   handleFold(socketId) {
     let seat = this.findPlayerBySocketId(socketId);  // 断点4
   }
   ```

5. **server/pokergame/Table.js:410-453** - 决定胜负
   ```javascript
   determineWinner(amount, seats) {
     const solverWinners = Hand.winners(...);  // 断点5
     seat.winHand(winAmount);
   }
   ```

### 4.4 WebSocket 调试

#### 4.4.1 浏览器 WebSocket 面板

1. 打开开发者工具 → **Network** 标签
2. 过滤选择 **WS** (WebSocket)
3. 查看消息发送和接收

#### 4.4.2 服务器端日志

在 `server/socket/index.js` 中添加更多日志：
```javascript
socket.on(CS_JOIN_TABLE, (tableId) => {
  console.log('=== CS_JOIN_TABLE ===')
  console.log('tableId:', tableId)
  console.log('player:', player)
  console.log('tables:', tables)
  // ...
})
```

### 4.5 React DevTools

1. 安装 React Developer Tools 扩展
2. 打开开发者工具 → **React** 标签
3. 查看组件树和 Props/State

### 4.6 调试技巧

1. **Console.log 调试**:
   ```javascript
   console.log('=== Debug ===', { walletAddress, gameId, username })
   ```

2. **条件断点**:
   ```javascript
   // 右键断点 → Edit Breakpoint → 添加条件
   walletAddress === '0x123...'
   ```

3. **Watch 监控变量**:
   - 在断点处暂停时，添加变量到 Watch 面板

4. **Call Stack 调用栈**:
   - 查看函数调用链，理解执行流程

---

## 5. Playwright 启动 Chrome 并加载 MetaMask 插件

### 5.1 安装 Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 5.2 下载 MetaMask 插件

1. 访问 [Chrome Web Store - MetaMask](https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn)
2. 下载 CRX 文件（使用第三方工具如 CRX Extractor）
3. 或使用开发版 MetaMask

### 5.3 Playwright 配置

#### 5.3.1 基础配置

创建 `playwright.config.js`:
```javascript
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    launchOptions: {
      args: [
        '--disable-extensions-except=/path/to/metamask-extension',
        '--load-extension=/path/to/metamask-extension'
      ],
      headless: false,  // 必须使用非无头模式
    },
  },
});
```

#### 5.3.2 完整测试示例

创建 `tests/metaMaskGame.spec.js`:
```javascript
const { test, expect } = require('@playwright/test');
const path = require('path');

// MetaMask 扩展路径
const EXTENSION_PATH = path.join(__dirname, '../extensions/metamask-chrome-10.25.0');

test.describe('Game with MetaMask', () => {
  test.beforeAll(async ({ browser }) => {
    // 预先安装扩展
    const context = await browser.newContext({
      viewport: null,
      launchOptions: {
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`
        ]
      }
    });
    await context.close();
  });

  test('Connect MetaMask and Play Game', async ({ page, context }) => {
    // 创建带有 MetaMask 的上下文
    const metamaskContext = await browser.newContext({
      viewport: null,
      launchOptions: {
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`
        ]
      }
    });

    // 获取 MetaMask 页面
    const [metamaskPage] = await Promise.all([
      metamaskContext.waitForEvent('page'),
      metamaskContext.pages()[0].waitForSelector('body')
    ]);

    // 配置 MetaMask
    await configureMetaMask(metamaskPage);

    // 创建游戏页面
    const gamePage = await metamaskContext.newPage();
    await gamePage.goto('http://localhost:3000/landing');

    // 连接钱包
    await gamePage.click('button:has-text("Connect Wallet")');

    // 授权 MetaMask
    await authorizeMetaMask(metamaskPage);

    // 验证连接
    await expect(gamePage.locator('text=Welcome')).toBeVisible();
  });
});

async function configureMetaMask(page) {
  // 打开 MetaMask
  await page.goto('chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/home.html');

  // 点击"开始"
  await page.click('button:has-text("Get Started")');
  await page.click('button:has-text("Import wallet")');

  // 输入助记词（测试账户）
  await page.fill('input[type="password"]', 'test test test test test test test test test test test junk');
  await page.fill('input[type="password"]:nth-of-type(2)', 'Test1234!');
  await page.fill('input[type="password"]:nth-of-type(3)', 'Test1234!');

  // 点击"导入"
  await page.click('button:has-text("Import")');
  await page.waitForSelector('button:has-text("All Done")', { timeout: 10000 });
  await page.click('button:has-text("All Done")');
}

async function authorizeMetaMask(page) {
  // 等待授权弹窗
  await page.waitForTimeout(2000);

  const pages = page.context().pages();
  const popup = pages.find(p => p.url().includes('extension'));

  if (popup) {
    // 点击"连接"
    await popup.click('button:has-text("Next")');
    await popup.click('button:has-text("Connect")');
  }
}
```

### 5.4 使用 Puppeteer（替代方案）

如果 Playwright 不支持，可以使用 Puppeteer:

```javascript
const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, './metamask-extension');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--load-extension=${EXTENSION_PATH}`,
      '--disable-extensions-except=' + EXTENSION_PATH,
    ],
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/?walletAddress=0x123...&gameId=1&username=player1');

  // ... 测试逻辑
})();
```

### 5.5 注意事项

1. **必须使用非无头模式** (`headless: false`)，因为扩展需要 UI

2. **MetaMask 版本兼容性**:
   - 测试环境建议使用开发版 MetaMask
   - 检查扩展路径是否正确

3. **等待扩展加载**:
   ```javascript
   await page.waitForTimeout(5000);  // 等待扩展初始化
   ```

4. **多页面处理**:
   ```javascript
   const pages = context.pages();
   const metamaskPage = pages[0];   // MetaMask 页面
   const gamePage = pages[1];       // 游戏页面
   ```

5. **网络拦截**（可选）:
   ```javascript
   await page.route('**', route => {
     console.log('Request:', route.request().url());
     route.continue();
   });
   ```

### 5.6 测试游戏流程

```javascript
test('Complete Game Flow', async ({ page }) => {
  // 1. 访问游戏页面
  await page.goto('http://localhost:3000/?walletAddress=0x123...&gameId=1&username=player1');

  // 2. 等待加载
  await page.waitForSelector('.poker-table', { timeout: 10000 });

  // 3. 坐下
  await page.click('button:has-text("Sit Down")');

  // 4. 等待发牌
  await page.waitForSelector('.poker-card', { timeout: 10000 });

  // 5. 检查手牌
  const cards = await page.locator('.poker-card').count();
  expect(cards).toBe(2);

  // 6. 执行操作
  await page.click('button:has-text("Call")');

  // 7. 验证结果
  await expect(page.locator('text=You won')).toBeVisible({ timeout: 30000 });
});
```

---

## 总结

1. **游戏使用虚拟筹码系统**，不涉及真实数字货币交易
2. **本机显示 player2 的原因**：缺少 URL 参数或缓存问题
3. **调试方法**：
   - 前端：浏览器开发者工具 Sources 面板
   - 后端：VS Code 调试配置
   - WebSocket：Network 面板 WS 过滤
4. **Playwright + MetaMask**：需要加载扩展，必须非无头模式
5. **关键代码位置**：
   - 前端：`ConnectWallet.js`, `Play.js`, `GameState.js`
   - 后端：`server/socket/index.js`, `server/pokergame/Table.js`

6. **游戏规则**:
服务器本地跟踪的玩家余额
从 Game Balance 同步而来
用于快速响应游戏操作（避免每次都查区块链）
四者关系总结
概念	存储位置	用途
Wallet Balance	TronLink 钱包	用户原始资金
Game Balance	区块链合约	游戏内资金池
Bankroll	游戏服务器内存	服务器端跟踪的可用余额
Stack	牌桌	当前手牌中的筹码
资金流转示例
code
1. 用户有 1000 TRX 在 TronLink 钱包
walletBalance = 1000 TRX
gameBalance = 0
bankroll = 0
stack = 0
2. 存款 500 TRX 到游戏合约
walletBalance = 500 TRX (减少)
gameBalance = 500 TRX (增加)
bankroll = 500 TRX (同步)
stack = 0
3. 加入牌桌，买入 100 TRX
bankroll = 400 TRX (减少)
stack = 100 TRX (增加)
locked = 100 TRX (gameBalance 的 locked 部分)
4. 游戏结束，赢了 50 TRX
stack = 150 TRX
5. 离开牌桌
bankroll = 550 TRX (stack 返回)
stack = 0
locked = 0
6. 提现 300 TRX
gameBalance = 250 TRX (减少)
walletBalance = 800 TRX (增加)

关键区别
对比项	Bankroll	Game Balance
存储位置	服务器内存	区块链合约
安全性	服务器重启可能丢失	链上永久存储
响应速度	快（本地操作）	慢（需要区块链确认）
数据来源	从合约同步	链上真实数据
用途	服务器端游戏逻辑验证	前端展示、提现操作

规则调整如下:
a.gameBalance = bankroll， gameBalance定义就是合约balance字段
b.合约gameBalance 减了locked后，同步bankroll，不要用bankroll减locked
c.前端、后端gameBalance，bankroll都不减locked，等合约扣减后同步
d.游戏过程中扣减stack，locked不变
e.游戏结束后将剩余stack加回gamebalance，然后同步bankroll
f. 游戏没退出，stack为0，可以从balance补充， stack = 0 → 允许 rebuy（从 balance 补充）→ balance 不足时才退出
j.settleGame采用会话模式，本局结算（不改变 locked，只更新桌上的 stack），玩家离开桌子（最终结算）
k.乐观模式有些复杂，暂时先不实现，毕竟只是退出游戏后需要更新，游戏过程中只更新stack

---

## 6. Session 模式实现 (2024-03-16)

### 6.1 核心规则

已实现的 Session 模式规则：

| 规则 | 描述 | 实现位置 |
|------|------|----------|
| a | `gameBalance = bankroll = 合约balance字段` | GameFlowIntegration.js |
| b | 合约直接同步 bankroll，不要再减去 locked | GameFlowIntegration.js |
| c | 前端/后端不要在本地减去 locked，等待合约同步 | GameFlowIntegration.js, socket/index.js |
| d | 游戏中：只有 stack 变化，locked 不变 | handleGameEnd() |
| e | 离开时：stack 返回到 balance，然后同步 bankroll | handleLeaveTable() |
| f | stack=0 时允许从 balance rebuy；balance 不足则退出 | CS_REBUY handler |
| j | Session模式：settleGame 只更新 stack，最终结算在 leaveTable | handleGameEnd(), settleGameSession() |
| k | 跳过乐观更新，以后需要时再实现 | N/A |

### 6.2 资金流转流程

```
1. 加入牌桌 (joinTable)
   balance -= buyInAmount
   locked += buyInAmount
   stack = buyInAmount

2. 游戏过程 (Session Mode)
   - 只有 stack 变化（输赢）
   - locked 保持不变
   
3. Rebuy (stack=0 时)
   balance -= rebuyAmount
   locked += rebuyAmount
   stack += rebuyAmount

4. 离开牌桌 (leaveTableSession)
   locked = 0
   balance += stack (最终剩余筹码)
```

### 6.3 合约新增函数

```solidity
// Session 模式离开牌桌 - 带最终 stack 结算
function leaveTableSession(uint256 tableId, uint256 finalStack)

// Rebuy - 从 balance 补充筹码
function rebuy(uint256 tableId, uint256 rebuyAmount)

// Session 模式结算 - 只更新 stack，不改变 locked
function settleGameSession(
    uint256 tableId,
    address[] calldata playersToUpdate,
    int256[] calldata stackDeltas,
    bytes32 resultHash
)
```

### 6.4 关键代码位置

- **GameFlowIntegration.js**: 
  - `handleJoinTable()`: 规则 a, b 实现
  - `handleLeaveTable()`: 规则 e, j 实现（Session 模式）
  - `validateBalanceForSitDown()`: 规则 a, c 实现

- **socket/index.js**:
  - `CS_REBUY handler`: 规则 f 实现
  - `handleGameEnd()`: 规则 d, j 实现
  - `CS_FETCH_LOBBY_INFO handler`: 规则 a 实现

- **BridgeGameV1.sol**:
  - `leaveTableSession()`: Session 模式离开
  - `rebuy()`: Rebuy 功能
  - `settleGameSession()`: Session 模式结算

### 6.5 变量语义对照

| 变量 | 合约字段 | 含义 | Session 模式行为 |
|------|----------|------|------------------|
| balance | `Player.balance` | 可用余额 | joinTable/rebuy 时减少 |
| locked | `Player.lockedAmount` | 锁定金额 | joinTable 时增加，leaveTable 时清零 |
| stack | 游戏引擎管理 | 桌上筹码 | 游戏过程中变化，leaveTable 时返回 balance |
| bankroll | 后端缓存 | = balance | 用于快速验证，从合约同步 |