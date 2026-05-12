# NFT 锻造问题解决方案

## 问题分析

根据用户反馈，NFT锻造不成功的原因在于：
1. **流程不完整**：之前使用独立脚本（如`cdp-play-game-with-mint.js`）来锻造NFT，没有按照完整的游戏流程
2. **缺少自动化签名**：需要类似`deposit-auto-final.sh`的自动签名确认流程
3. **验证不足**：缺少对NFT锻造结果的完整验证

## 解决方案

我已经创建了一套完整的自动化测试方案，按照 `docs/GAME_BOT_TEST_FLOW.md` 流程执行：

### 核心脚本

1. **`start-nft-mint-test.sh`** - 一键启动脚本（推荐）
   - 自动检查服务状态
   - 启动机器人
   - 运行CDP自动化
   - 验证NFT锻造结果

2. **`cdp-nft-mint-auto.js`** - CDP自动化脚本
   - 导航到锦标赛页面
   - 加入Mock模式游戏
   - 自动游戏操作
   - 检测NFT成就弹窗
   - 自动点击锻造按钮
   - 处理TronLink签名

3. **`nft-mint-auto-flow.sh`** - Shell流程脚本
   - 完整的Bash脚本版本
   - 适合需要更多控制的场景

4. **`NFT_MINT_AUTO_GUIDE.md`** - 详细使用指南
   - 前置条件
   - 使用方法
   - 验证方法
   - 常见问题

## 使用方法

### 快速开始

```bash
# 1. 确保服务运行
brew services start mongodb-community
ENV_FILE=.env.testnet node server/server.js &
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client &

# 2. 启动Chrome CDP（端口9222）
osascript -e 'quit app "Google Chrome"'
sleep 2
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/" &

# 3. 等待服务就绪
sleep 10

# 4. 运行NFT锻造测试
./start-nft-mint-test.sh
```

### 详细步骤

详见 `NFT_MINT_AUTO_GUIDE.md` 文档。

## 流程详解

### 1. 创建锦标赛（Mock模式）

机器人自动创建锦标赛，启用Mock游戏模式：
- 玩家1获得顺子牌型（5♥ 6♥ + 7♥ 8♥ 9♦）
- 确保能够触发NFT成就

### 2. CDP自动化

使用Chrome DevTools Protocol控制浏览器：
```javascript
// 勾选Mock开关
document.querySelector('input[data-testid="mock-game-checkbox"]').click();

// 点击锦标赛卡片
document.querySelector('.sc-bypJrT.ilegoF').click();

// 点击Confirm加入
document.querySelector('button').click();
```

### 3. 游戏操作

自动进行游戏操作（Check > Call > Fold）：
```javascript
// 优先级: Check > Call > Fold
if (buttons.includes('Check')) {
    clickButton('Check');
} else if (buttons.includes('Call')) {
    clickButton('Call');
} else if (buttons.includes('Fold')) {
    clickButton('Fold');
}
```

### 4. NFT锻造

检测到NFT成就后自动处理：
```javascript
// 检测NFT弹窗
const modal = document.querySelector('.swal2-popup');

// 点击锻造按钮
document.querySelector('.swal2-confirm').click();

// 处理TronLink签名
cliclick c:1414,635  // 签名按钮坐标
```

### 5. 验证结果

多维度验证NFT锻造成功：
- **数据库**: 查询NFTClaim集合
- **链上**: 通过Tronscan API查询
- **前端**: NFT画廊页面显示

## 关键改进

### 1. 完整的游戏流程

不再使用独立脚本，而是完整模拟真实玩家流程：
```
创建锦标赛 → 启动机器人 → CDP加入游戏 → 游戏操作 → NFT锻造 → 验证
```

### 2. 自动化签名确认

类似`deposit-auto-final.sh`，使用`cliclick`自动点击TronLink签名按钮：
```bash
# 检查TronLink窗口
osascript -e 'tell application "Google Chrome" to get name of every window'

# 点击签名按钮（多次确保）
cliclick c:1414,635
cliclick c:1414,635
cliclick c:1414,635
```

### 3. 完整的验证流程

三重验证确保NFT锻造成功：
1. **数据库验证**: MongoDB NFTClaim集合
2. **链上验证**: Tronscan API查询
3. **前端验证**: NFT画廊页面

### 4. 详细的日志和截图

- **日志**: bot.log, CDP控制台输出
- **截图**: test-results/nft-*.png
- **错误处理**: 详细的错误信息和排查建议

## NFT合约信息

- **合约地址**: `TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC`
- **网络**: Nile测试网
- **Tronscan**: https://nile.tronscan.org/#/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC

## 玩家信息

| 玩家 | 地址 | 角色 |
|------|------|------|
| 玩家1 | `TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv` | 浏览器玩家（顺子成就） |
| 玩家2 | `TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4` | 机器人 |

## 后端NFT流程说明

### TournamentTable.js

在游戏结束时检测NFT成就：
```javascript
// TournamentTable.js endHand()
if (this.wentToShowdown) {
    const achievement = NFTService.checkAchievement(seat.hand, this.board);
    if (achievement && achievement.type) {
        this.pendingAchievements.push({
            playerAddress: seat.player.id,
            achievementType: achievement.type,
            cards: achievement.cards,
            typeId: achievement.typeId
        });
    }
}
```

### TournamentService.js

在游戏操作后发送NFT成就事件：
```javascript
// TournamentService.js handleGameAction()
if (table.pendingAchievements && table.pendingAchievements.length > 0) {
    for (const achievement of table.pendingAchievements) {
        // 找到玩家的socket
        const socket = findPlayerSocket(achievement.playerAddress);
        
        // 发送SC_NFT_ACHIEVEMENT_EARNED事件
        socket.emit(SC_NFT_ACHIEVEMENT_EARNED, {
            achievementType: achievement.achievementType,
            cards: achievement.cards,
            gameId: `tournament-${tournamentId}`
        });
    }
    
    // 清空pending achievements
    table.pendingAchievements = [];
}
```

### NFTService.js

处理NFT锻造请求：
```javascript
// NFTService.js prepareMint()
async prepareMint(walletAddress, data) {
    const { achievementType, gameSessionId, handData } = data;
    
    // 生成tokenId
    const tokenId = Date.now();
    
    // 保存到数据库
    const claim = new NFTClaim({
        playerAddress: walletAddress.toLowerCase(),
        achievementType,
        tokenId,
        cards: handData.cards,
        gameId: gameSessionId
    });
    await claim.save();
    
    // 生成签名
    const signature = await generateMintSignature(walletAddress, achievementType, gameSessionId);
    
    return {
        success: true,
        signature,
        tokenId,
        onchainContractAddress: process.env.NFT_CONTRACT_ONCHAIN
    };
}
```

### 前端处理

 TournamentTable.js监听NFT成就事件：
```javascript
// TournamentGameContext.js
socket.on(SC_NFT_ACHIEVEMENT_EARNED, (data) => {
    console.log('🎉 NFT Achievement earned:', data);
    setNftAchievement(data);
});

// TournamentTable.js 显示弹窗
if (nftAchievement) {
    // 显示NFT成就弹窗
    // 用户点击"锻造 NFT"按钮
    socket.emit('CS_NFT_PREPARE_MINT', {
        walletAddress,
        achievementType: nftAchievement.achievementType,
        gameSessionId: nftAchievement.gameId,
        handData: {
            cards: nftAchievement.cards,
            hand: nftAchievement.hand,
            board: nftAchievement.board
        }
    });
}
```

## 测试结果

运行测试后，应该能看到：

```
========================================
  ✅ 测试流程完成
========================================
  数据库 NFT: 1
  链上 NFT: 1

🎉 NFT 锻造成功！

最新 NFT 详情:
  类型: STRAIGHT
  描述: 9高顺子
  牌型: 5h 6h 7h 8h 9d 2c 3s
  Token ID: 1234567890
  交易哈希: 0x...
  创建时间: 2026-04-06T...
========================================
```

## 排查建议

如果NFT锻造失败，按以下步骤排查：

1. **检查服务状态**
   - MongoDB是否运行
   - 后端是否运行（端口7778）
   - 前端是否运行（端口3001）
   - Chrome CDP是否运行（端口9222）

2. **检查游戏流程**
   - 机器人是否创建锦标赛
   - 玩家是否成功加入
   - 游戏是否完成
   - 是否到达showdown

3. **检查NFT触发**
   - 是否检测到顺子成就
   - 是否发送SC_NFT_ACHIEVEMENT_EARNED事件
   - 前端是否收到事件

4. **检查锻造流程**
   - TronLink是否弹出签名请求
   - 签名是否成功
   - 合约调用是否成功
   - 交易是否确认

5. **查看日志**
   - bot.log（机器人日志）
   - CDP脚本输出
   - 后端日志
   - 前端控制台

## 相关文档

- [NFT锻造自动化指南](NFT_MINT_AUTO_GUIDE.md)
- [游戏机器人测试流程](docs/GAME_BOT_TEST_FLOW.md)
- [项目总览](CODEBUDDY.md)

## 联系支持

如有其他问题，请查看：
1. 项目根目录的 `CODEBUDDY.md`
2. `docs/` 目录下的相关文档
3. GitHub Issues（如有）
