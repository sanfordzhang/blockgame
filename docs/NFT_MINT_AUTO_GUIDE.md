# NFT 锻造自动化测试指南

## 概述

本文档描述如何使用自动化脚本完成 NFT 锻造的完整流程测试。按照 `docs/GAME_BOT_TEST_FLOW.md` 流程执行，包括：

1. 创建 Mock 模式锦标赛
2. 启动机器人
3. CDP 控制浏览器加入游戏
4. 完成一手牌（玩家1获得顺子）
5. 自动处理 NFT 锻造签名
6. 验证 NFT 是否锻造成功

## 前置条件

### 1. 服务必须运行

```bash
# 启动 MongoDB
brew services start mongodb-community

# 启动后端（端口 7778）
ENV_FILE=.env.testnet node server/server.js

# 启动前端（端口 3001）
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client
```

### 2. Chrome CDP 端口

确保 Chrome 浏览器以 CDP 调试模式运行（端口 9222）：

```bash
# 关闭现有 Chrome
osascript -e 'quit app "Google Chrome"'
sleep 2

# 启动 Chrome CDP
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/"
```

### 3. TronLink 钱包

- Chrome 浏览器需安装 TronLink 扩展
- 钱包需连接到 Nile 测试网
- 玩家1地址需有足够的 TRX 和 Energy

## 使用方法

### 方法1: 一键启动（推荐）

```bash
# 赋予执行权限
chmod +x start-nft-mint-test.sh

# 运行完整测试
./start-nft-mint-test.sh
```

这个脚本会自动：
- 检查所有服务状态
- 启动机器人
- 运行 CDP 自动化脚本
- 验证 NFT 锻造结果

### 方法2: 分步执行

如果需要更多控制，可以分步执行：

```bash
# Step 1: 启动机器人
node scripts/game-bot.js > bot.log 2>&1 &
BOT_PID=$!

# Step 2: 等待锦标赛创建
tail -f bot.log

# Step 3: 运行 CDP 脚本
node cdp-nft-mint-auto.js

# Step 4: 清理
kill $BOT_PID
```

### 方法3: 使用 Shell 脚本

```bash
# 赋予执行权限
chmod +x nft-mint-auto-flow.sh

# 运行
./nft-mint-auto-flow.sh
```

## 玩家信息

测试使用的玩家地址：

| 玩家 | 地址 | 角色 |
|------|------|------|
| 玩家1 | `TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv` | 浏览器玩家（获得顺子） |
| 玩家2 | `TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4` | 机器人 |

## NFT 合约信息

- **合约地址**: `TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC`
- **网络**: Nile 测试网
- **Tronscan**: https://nile.tronscan.org/#/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC

## 测试流程详解

### 1. 机器人创建锦标赛

机器人会自动：
- 连接到服务器 Socket
- 创建 2 人锦标赛（configId: 3）
- 启用 Mock 游戏模式（顺子牌型）
- 发送 `CS_TOURNAMENT_JOIN` 和 `CS_TOURNAMENT_ROOM_JOIN` 事件
- 等待其他玩家加入

### 2. CDP 自动化

CDP 脚本会自动：
- 导航到锦标赛页面
- 勾选 Mock 游戏开关
- 点击锦标赛卡片加入
- 点击 Confirm 按钮
- 等待游戏开始
- 自动进行游戏操作（Check > Call > Fold）
- 检测 NFT 成就弹窗
- 点击"锻造 NFT"按钮
- 处理 TronLink 签名

### 3. 游戏流程

Mock 模式下，玩家1会获得顺子牌型：

- **玩家1手牌**: 5♥ 6♥
- **公共牌**: 7♥ 8♥ 9♦ 2♣ 3♠
- **结果**: 玩家1有 5-6-7-8-9 顺子

### 4. NFT 锻造流程

1. 游戏结束，检测到顺子成就
2. 前端显示 NFT 成就弹窗
3. 点击"锻造 NFT"按钮
4. 发送 `CS_NFT_PREPARE_MINT` 到后端
5. 后端生成签名并返回 `SC_NFT_MINT_READY`
6. 前端调用合约的 `mintWithSignature` 方法
7. TronLink 弹出签名请求
8. 自动点击签名按钮
9. 合约执行锻造，NFT 到账

## 验证方法

### 1. 数据库验证

```bash
# 查询数据库中的 NFT
node -e "
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

async function check() {
    await mongoose.connect('mongodb://localhost:27017/poker-game');
    const nfts = await NFTClaim.findByPlayer('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
    console.log('NFT 数量:', nfts.length);
    nfts.forEach(nft => {
        console.log('  -', nft.achievementType, nft.handDescription);
    });
    await mongoose.disconnect();
}

check();
"
```

### 2. 链上验证

访问 Tronscan 查看钱包中的 NFT：
https://nile.tronscan.org/#/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC

或使用 API：

```bash
curl -s "https://nile.tronscan.org/api/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC/holders?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
console.log('链上 NFT 数量:', data.data?.[0]?.balance || 0);
"
```

### 3. 前端验证

访问 NFT 画廊页面：
http://127.0.0.1:3001/nft

## 常见问题

### Q: NFT 弹窗没有出现？

A: 检查：
1. Mock 开关是否已勾选
2. 锦标赛是否在勾选后创建
3. 服务器日志是否显示 `mockGame=true`
4. 游戏是否到达 showdown（摊牌）

### Q: TronLink 签名窗口没有出现？

A: 检查：
1. TronLink 扩展是否已安装并解锁
2. 钱包是否连接到 Nile 测试网
3. 是否选择了正确的钱包地址
4. 查看 `test-results/` 目录中的截图

### Q: 签名后 NFT 没有到账？

A: 检查：
1. 后端日志是否有 NFT 相关错误
2. 前端控制台是否有合约调用错误
3. 钱包是否有足够的 Energy
4. 查询合约事件确认交易是否成功

### Q: 游戏卡住不动？

A: 检查：
1. 机器人是否正常运行（`ps aux | grep game-bot`）
2. 服务器日志是否有错误
3. 前端控制台是否有 Socket 连接问题
4. 尝试重启服务和机器人

## 日志文件

- **机器人日志**: `bot.log`
- **后端日志**: 控制台输出或 `server.log`
- **前端日志**: 浏览器控制台（开发者工具）
- **CDP 日志**: CDP 脚本控制台输出

## 截图位置

测试过程中会自动截图保存到 `test-results/` 目录：

- `nft-01-tournament-page.png` - 锦标赛页面
- `nft-02-joined-game.png` - 加入游戏后
- `nft-03-game-ended.png` - 游戏结束
- `nft-04-nft-modal.png` - NFT 成就弹窗
- `nft-05-mint-completed.png` - 锻造完成

## 手动操作指南

如果自动化脚本失败，可以手动执行：

### 1. 启动机器人

```bash
node scripts/game-bot.js
```

### 2. 浏览器操作

1. 打开 Chrome（CDP 端口 9222）
2. 访问 http://127.0.0.1:3001/tournament
3. 勾选 "Mock 游戏" 开关
4. 点击机器人创建的锦标赛卡片（显示 "1 / 2"）
5. 点击 "Confirm" 加入
6. 等待游戏开始
7. 自动或手动进行游戏操作
8. 等待游戏结束

### 3. NFT 锻造

1. 看到 NFT 成就弹窗
2. 点击 "锻造 NFT" 按钮
3. TronLink 弹出签名请求
4. 点击 "签名" 或 "确认"
5. 等待交易确认
6. NFT 锻造成功

## 清理环境

```bash
# 停止所有服务
brew services stop mongodb-community
pkill -f "node server/server.js"
pkill -f "node scripts/start.js"
pkill -f "node scripts/game-bot.js"

# 清理临时文件
rm -rf /tmp/chrome-debug
rm -f bot.log
rm -f test-results/nft-*.png
```

## 相关文档

- [游戏机器人测试流程](docs/GAME_BOT_TEST_FLOW.md)
- [NFT 成就系统](docs/NFT_ACHIEVEMENTS.md)
- [部署指南](DEPLOYMENT_STATUS.md)
- [测试用例指南](CODEBUDDY.md#测试用例guide)

## 支持

如有问题，请查看：
1. 本文档的常见问题部分
2. 项目根目录的 `CODEBUDDY.md`
3. `docs/` 目录下的相关文档
