# 钱包页面自动化测试流程

## 概述

本文档描述钱包页面 `http://127.0.0.1:3001/wallet` 的自动化测试方案，使用 CDP（Chrome DevTools Protocol）进行端到端测试。

## 测试范围

### 1. 页面加载测试
- 访问钱包页面
- 检查页面是否正确渲染
- 验证钱包连接提示

### 2. Balance Tab 测试
- CHIP 余额显示
- 转账按钮功能测试
- 历史按钮
- 待领取奖励显示

### 3. Staking Tab 测试
- 质押总额显示
- 质押按钮功能
- 活跃质押列表
- 解除质押按钮
- 领取奖励按钮

### 4. VIP Status Tab 测试
- VIP 等级徽章显示
- 折扣百分比
- 升级所需质押量
- VIP 等级说明

### 5. History Tab 测试
- 交易历史列表
- 交易类型显示（reward/stake/transfer/claim等）
- 金额和时间显示

### 6. 转账功能测试
- 转账按钮点击
- 转账对话框显示
- API 转账接口调用

## 前置条件

1. 后端服务运行在 `http://127.0.0.1:7778`
2. 前端服务运行在 `http://127.0.0.1:3001`
3. MongoDB 运行
4. Chrome 浏览器开启 CDP 调试端口 9222
5. 测试钱包地址已连接

## 测试钱包地址

```
PLAYER1.address = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
PLAYER2.address = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/chip/balance/:address` | GET | 获取 CHIP 余额 |
| `/api/chip/vip-status/:address` | GET | 获取 VIP 状态 |
| `/api/stake/history/:address` | GET | 获取质押历史 |
| `/api/chip/transactions/:address` | GET | 获取交易历史 |
| `/api/stake/create` | POST | 创建质押 |
| `/api/stake/unstake` | POST | 解除质押 |
| `/api/stake/claim-reward` | POST | 领取奖励 |
| `/api/chip/transfer` | POST | 转账 CHIP |
| `/api/chip/test/create-transactions` | POST | 创建测试交易数据 |

## 测试步骤

### 步骤0: 准备测试数据
测试脚本会自动创建以下测试数据：
- 8条不同类型的交易记录（reward/stake/transfer/receive/vip_discount/claim）
- 1个活跃质押记录
- 1笔转账记录

### 步骤1: 导航到钱包页面
```javascript
await Page.navigate({ url: 'http://127.0.0.1:3001/wallet?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' });
await Page.loadEventFired();
```

### 步骤2: 测试 Balance Tab
- 检查余额显示
- 验证按钮存在
- 测试转账按钮
- 截图记录

### 步骤3: 测试 Staking Tab
- 点击 Staking Tab
- 检查质押信息
- 测试质押按钮点击

### 步骤4: 测试 VIP Status Tab
- 点击 VIP Status Tab
- 检查 VIP 等级徽章
- 验证折扣信息

### 步骤5: 测试 History Tab
- 点击 History Tab
- 检查交易列表
- 验证交易类型显示

### 步骤6: API 验证
- 验证余额 API
- 验证 VIP 状态 API
- 验证质押历史 API
- 验证交易历史 API

### 步骤7: 转账功能测试
- 点击转账按钮
- 检查转账对话框
- 截图记录

## 截图命名规范

| 截图文件 | 说明 |
|----------|------|
| `wallet-01-initial.png` | 初始页面加载 |
| `wallet-02-balance-tab.png` | Balance Tab |
| `wallet-03-staking-tab.png` | Staking Tab |
| `wallet-04-after-stake-click.png` | 点击质押后 |
| `wallet-05-vip-tab.png` | VIP Status Tab |
| `wallet-06-history-tab.png` | History Tab |
| `wallet-07-transfer-dialog.png` | 转账对话框 |
| `wallet-08-final.png` | 最终状态 |

## 交易类型说明

| 类型 | 说明 | 金额正负 |
|------|------|----------|
| `reward` | 游戏奖励 | 正数 |
| `stake` | 质押 | 负数 |
| `unstake` | 解除质押 | 正数 |
| `claim` | 领取奖励 | 正数 |
| `transfer` | 转出 | 负数 |
| `receive` | 收到 | 正数 |
| `vip_discount` | VIP折扣 | 正数 |
| `deposit` | 充值 | 正数 |
| `withdraw` | 提现 | 负数 |

## 错误处理

1. 如果钱包未连接，显示连接提示
2. 如果 API 返回错误，显示错误信息
3. 如果数据加载失败，显示加载状态

## 测试验证点

### 功能验证
- [x] 页面正确加载
- [x] 四个 Tab 切换正常
- [x] 余额正确显示
- [x] 质押信息正确显示
- [x] VIP 状态正确显示
- [x] 交易历史正确显示
- [x] 转账按钮功能正常

### UI 验证
- [x] VIP 徽章样式正确
- [x] 按钮状态正确（enabled/disabled）
- [x] 颜色和样式符合设计

### 数据验证
- [x] API 返回数据正确
- [x] 数据格式正确
- [x] 交易记录显示正确

## 常见问题

### Q: 页面显示"Connect your wallet"
A: 需要确保钱包已连接，可通过 URL 参数 `?address=xxx` 或 localStorage 设置

### Q: History Tab 没有数据
A: 运行测试脚本会自动创建测试数据，或手动调用 `/api/chip/test/create-transactions`

### Q: API 返回 401 错误
A: 检查 x-wallet-address header 是否正确设置

### Q: 截图为空白
A: 确保页面已完全加载，增加等待时间

## 运行测试

```bash
# 启动后端
brew services start mongodb-community
ENV_FILE=.env.testnet node server/server.js

# 启动前端
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client

# 启动 Chrome CDP
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
--remote-debugging-port=9222 \
--user-data-dir="/tmp/chrome-debug" \
"http://127.0.0.1:3001/wallet" &

# 运行测试
node cdp-wallet-test.js
```

## 测试结果示例

```
========================================
💰 钱包页面自动化测试 (完整版)
========================================

--- 步骤0: 准备测试数据 ---
创建测试交易: Created 8 test transactions
创建质押: ✅
执行转账: ✅

--- 步骤1: 导航到钱包页面 ---
📸 wallet-01-initial
页面标题: CHIP Wallet
钱包卡片: ✅ 显示
CHIP余额: 0 CHIP

--- 步骤2: 测试 Balance Tab ---
📸 wallet-02-balance-tab
Balance Tab:
  - 钱包卡片: ✅
  - CHIP余额: 0 CHIP
  - 按钮: { transfer: true, history: true, claim: false }

--- 步骤3: 测试 Staking Tab ---
📸 wallet-03-staking-tab
Staking Tab:
  - 质押卡片: ✅
  - 质押总额: 0 CHIP
  - 质押按钮: ✅
  - 显示质押信息: ✅
  - 测试点击质押按钮...
  - 点击结果: { success: true }
📸 wallet-04-after-stake-click

--- 步骤4: 测试 VIP Status Tab ---
📸 wallet-05-vip-tab
VIP Status Tab:
  - VIP卡片: ✅
  - VIP等级: BRONZE VIP
  - 折扣: 0% Rake Discount
  - VIP等级说明: ✅ 显示

--- 步骤5: 测试 History Tab ---
📸 wallet-06-history-tab
History Tab:
  - 标题: ✅
  - 有交易记录: ✅
  - 交易类型数量: 16

--- 步骤6: 通过API验证数据 ---
API余额: { success: true, balance: 0, stakedAmount: 0, pendingReward: 0, isVip: false }
API VIP状态: { success: true, isVip: false, isSuperVip: false, discount: 0, level: 0 }
API质押历史: ✅ 0 条记录
API交易历史: ✅ 20 条记录

--- 步骤7: 测试转账功能 ---
点击转账按钮: { success: true }
📸 wallet-07-transfer-dialog
转账对话框: ✅ 显示
📸 wallet-08-final

========================================
✅ 钱包页面测试完成!
========================================

📋 测试结果汇总:
  1. 页面加载: ✅
  2. Balance Tab: ✅
  3. Staking Tab: ✅
  4. VIP Status Tab: ✅
  5. History Tab: ✅
  6. 转账功能: ✅
```
