# Poker Game - Updated

## 🚀 快速开始

```bash
npm install
npm start
```

访问: http://localhost:3000

## 📚 详细文档

### 重要文档
- **[GAME_ANALYSIS.md](GAME_ANALYSIS.md)** - 完整的游戏分析（强烈推荐阅读）
  - 代码执行逻辑详解
  - 游戏流程说明
  - 筹码机制
  - 调试指南
  - Playwright + MetaMask 教程

- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - 开发者指南
  - 快速开始
  - 调试方法
  - 测试指南
  - 常见问题

- **[CHANGES_SUMMARY.md](CHANGES_SUMMARY.md)** - 最近修改总结

## 🎮 游戏访问方式

### 方式 1: 直接访问（推荐）
直接访问 http://localhost:3000，系统会自动生成钱包地址和用户名

### 方式 2: URL 参数
```
http://localhost:3000/?walletAddress=0x123...&gameId=1&username=player1
```

### 方式 3: MetaMask（需要实现）
详见 [GAME_ANALYSIS.md](GAME_ANALYSIS.md) 第5章

## 🛠️ 调试

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

## 🧪 测试

```bash
# 安装 Playwright
npm install -D @playwright/test
npx playwright install

# 运行测试
npm run test:e2e

# UI 模式
npm run test:e2e:ui

# 调试模式
npm run test:e2e:debug
```

## ❓ 常见问题

### Q: 为什么本机登录总是显示 player2？
**A:** 已修复！现在会自动生成唯一的钱包地址和用户名。

### Q: 游戏支持 MetaMask 吗？
**A:** 目前版本需要通过 URL 参数传递玩家信息。要集成 MetaMask，请查看 [GAME_ANALYSIS.md](GAME_ANALYSIS.md) 第5章。

### Q: 游戏输赢会有真实的数字货币交易吗？
**A:** 不会。游戏使用虚拟筹码系统，不涉及真实的区块链交易。

## 📁 项目结构

```
game-core/
├── src/                    # 前端代码
│   ├── pages/             # 页面组件
│   ├── context/           # Context 状态管理
│   └── components/        # UI 组件
├── server/                # 后端代码
│   ├── pokergame/        # 游戏逻辑
│   ├── socket/           # Socket.IO 处理
│   └── server.js         # 服务器入口
├── tests/               # Playwright 测试
├── GAME_ANALYSIS.md     # 详细分析文档
├── DEVELOPER_GUIDE.md   # 开发者指南
└── CHANGES_SUMMARY.md   # 修改总结
```

## 🎯 游戏机制

### 筹码系统
- **虚拟筹码**：游戏使用虚拟筹码，不涉及真实数字货币
- **初始筹码**：100,000
- **筹码流动**：
  - 坐下时扣除
  - 下注时进入底池
  - 胜利时获得底池
  - 离开时返还

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

## 🔧 技术栈

- **前端**: React 16, Socket.io-client, React Router, Styled-components
- **后端**: Node.js, Express, Socket.io
- **游戏逻辑**: pokersolver (扑克牌型计算)
- **测试**: Playwright

## 📝 最近更新

### 已完成的修改 ✅

1. **修复首页一直转圈的问题**
   - 修改 `ConnectWallet` 组件
   - 添加自动生成钱包地址和用户名的逻辑
   - 使用 localStorage 保存用户信息

2. **创建 Register 和 Login 页面**
   - 添加 `/register` 路由
   - 添加 `/login` 路由

3. **修复 player2 问题**
   - 自动生成唯一的钱包地址和用户名
   - 使用 localStorage 保存

4. **创建详细文档**
   - GAME_ANALYSIS.md (940行)
   - DEVELOPER_GUIDE.md
   - CHANGES_SUMMARY.md
   - Playwright 配置和测试

5. **添加调试配置**
   - VS Code launch.json
   - Playwright 配置
   - 测试用例

详见 [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md)

## 🎉 下一步

- [ ] 集成 MetaMask
- [ ] 添加用户认证
- [ ] 添加更多测试
- [ ] 优化 UI/UX
- [ ] 添加真实区块链集成（可选）

## 📞 支持

如有问题，请查看：
1. [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - 快速指南
2. [GAME_ANALYSIS.md](GAME_ANALYSIS.md) - 详细分析
3. [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) - 修改总结

---

**注意**: 请仔细阅读 [GAME_ANALYSIS.md](GAME_ANALYSIS.md) 以获得完整的项目理解和问题解答。
