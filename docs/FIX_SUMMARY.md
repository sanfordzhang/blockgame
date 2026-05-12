# QEntrix 问题修复总结

## 已修复的问题

### 1. Socket连接失败 ✅
**问题**: `ws://43.163.114.175/socket.io/` WebSocket连接失败
**根因**:
- 腾讯云安全组可能限制WebSocket协议
- socket.io默认先尝试WebSocket，失败后才降级到polling

**修复**:
- `WebsocketProvider.js`: 改为优先使用polling (`transports: ['polling', 'websocket']`)
- `upgrade: false`: 禁止自动升级到WebSocket
- 服务器`.env`添加`CORS_ORIGINS=http://43.163.114.175`

**验证**: Socket现在使用polling传输，连接成功 (`transport: "polling"`)

---

### 2. API硬编码地址 ✅
**问题**: 多个文件硬编码`http://127.0.0.1:7778`，部署后请求本地地址失败
**根因**: 开发时的本地地址没有改为环境变量

**修复文件**:
- `src/context/amm/AMMContext.js`
- `src/pages/Tournament.js`
- `src/pages/TournamentTable.js`
- `src/context/game/TournamentGameContext.js`

所有API请求现在使用`process.env.REACT_APP_SERVER_URI`（生产环境=`http://43.163.114.175`）

---

### 3. Register on Blockchain错误提示 ✅
**问题**: 没有TronLink时报"No contract or not a valid smart contract"
**根因**: 代码直接调用合约，没有先检查TronLink是否安装

**修复**: `Landing.js`的`handleRegister`先检查`isTronLinkInstalled()`，未安装显示友好提示

---

### 4. Enter Game socket等待 ✅
**问题**: 页面加载后立即点击"Enter Game"报"Socket not connected"
**根因**: Socket建立连接需要时间，React state更新有延迟

**修复**: `proceedToGame`改为:
1. 优先使用`window.socket`（全局引用）
2. 如未连接，监听`connect`事件等待最多5秒
3. 无钱包地址时自动生成`guest_xxxx`

---

## 测试步骤（用户需在真实Chrome中测试）

### 前提条件
- Chrome已安装TronLink扩展
- TronLink已解锁并连接到**Tron主网**（不是Nile测试网）
- 合约地址: `THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd` (主网)

### 测试1: Socket连接
1. 打开 http://43.163.114.175/
2. **硬刷新**: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
3. 打开开发者工具 (F12) → Console
4. 应该看到: `Socket connected successfully`
5. 不应该看到: `Socket connection error: websocket error`

### 测试2: Enter Game (Without Wallet)
1. 点击"Enter Game (Without Wallet)"按钮
2. 应该进入游戏大厅（/play页面）
3. 不应该看到"Socket not connected"错误

### 测试3: Register on Blockchain
1. 确保TronLink已解锁且连接到**主网**
2. 点击"Connect Wallet"连接钱包
3. 点击"Register on Blockchain"
4. TronLink应该弹出交易确认窗口
5. 如果看到"No contract or not a valid smart contract"，检查:
   - TronLink是否连接到主网（不是Nile测试网）
   - 合约地址是否为`THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd`

---

## 已知限制

### AMM API错误（预期内）
控制台会显示AMM相关错误:
```
[AMM Context] Fetch pool state error: 400
[AMM Context] Fetch price error: 503
```
**原因**: CHIP代币合约未部署，AMM服务未初始化
**影响**: 不影响游戏核心功能（扑克游戏、钱包连接、注册）

---

## 服务重启脚本

项目根目录的`restart.sh`可用于重启各个服务:

```bash
# 查看所有服务状态
bash restart.sh status

# 重启全部服务
bash restart.sh all

# 只重启后端
bash restart.sh backend

# 只重启MongoDB
bash restart.sh mongo

# 只重启Nginx
bash restart.sh nginx

# 重新构建前端（代码更新后）
bash restart.sh frontend
```

---

## 环境变量配置

服务器`.env`关键配置:
```bash
REACT_APP_SERVER_URI=http://43.163.114.175
REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd
REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c
TRON_NETWORK=mainnet
CORS_ORIGINS=http://43.163.114.175,http://43.163.114.175:7777
```

---

## 如果问题仍然存在

1. **硬刷新浏览器**: Ctrl+Shift+R 清除缓存
2. **检查TronLink网络**: 必须是主网，不是测试网
3. **检查控制台**: 查看具体错误信息
4. **重启后端**: `bash restart.sh backend`
5. **联系开发**: 提供控制台完整错误日志
