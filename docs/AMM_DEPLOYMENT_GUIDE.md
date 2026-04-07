# AMM 部署指南

## 概述

本文档介绍如何部署优化后的 CHIP Token 和 AMM 流动性池。

## 优化方案

### 总供应量
- **CHIP 总供应量**: 1,000,000 CHIP（从原来的 10 亿销毁 99.9%）
- **价格比例**: 1 TRX ≈ 10 CHIP

### 流动性配置

| 环境 | TRX 数量 | CHIP 数量 | 成本估算 |
|------|---------|----------|---------|
| 测试网 | 500 TRX | 5,000 CHIP | 免费 |
| 正式网 Demo | 500 TRX | 5,000 CHIP | ~$40 USD |
| 正式网正式 | 2,000-10,000 TRX | 20,000-100,000 CHIP | 根据用户量扩展 |

### 奖励保障机制

1. **每日奖励上限**: 5,000 CHIP
2. **动态调整**: 储备 < 50% 时，奖励率降低 50%
3. **储备目标**: 500,000 CHIP
4. **DAO 治理**: 可投票增发或调整参数

## 部署步骤

### 1. 环境准备

确保已安装依赖：
```bash
npm install
```

确保 `.env.testnet` 或 `***REMOVED***` 文件包含以下配置：
```bash
# 测试网
TESTNET_PRIVATE_KEY=your_private_key_here

# 正式网
MAINNET_PRIVATE_KEY=your_private_key_here
```

### 2. 部署合约

#### 测试网部署
```bash
TRON_NETWORK=testnet node scripts/deploy-chip-amm.js
```

#### 正式网部署
```bash
TRON_NETWORK=mainnet node scripts/deploy-chip-amm.js
```

部署完成后，会在 `deployments/` 目录生成配置文件：
- `deployments/chip-amm-testnet.json`
- `deployments/chip-amm-mainnet.json`

### 3. 更新环境变量

将部署脚本输出的地址添加到 `.env.testnet` 或 `***REMOVED***`：

```bash
# CHIP Token
CHIP_TOKEN_ADDRESS=TXxxxx...

# AMM Pool
AMM_POOL_ADDRESS=TXxxxx...
AMM_ROUTER_ADDRESS=TXxxxx...

# CHIP 配置
CHIP_DAILY_REWARD_LIMIT=5000
CHIP_RESERVE_TARGET=500000
```

### 4. 添加额外流动性（可选）

如果需要添加更多流动性：

```bash
# 测试网
TRON_NETWORK=testnet node scripts/add-liquidity.js

# 正式网
TRON_NETWORK=mainnet node scripts/add-liquidity.js
```

或者在脚本中修改流动性数量：
```javascript
liquidity: {
  trxAmount: 2000 * 1e6, // 2000 TRX
  chipAmount: 20_000 * 1e6 // 20,000 CHIP
}
```

## 验证部署

### 1. 检查合约

```bash
# 检查 CHIP Token 总供应量
node scripts/check-chip-info.js

# 检查流动性池状态
node scripts/check-amm-pool.js
```

### 2. 测试交易

```bash
# 测试 TRX → CHIP 兑换
TRON_NETWORK=testnet node scripts/test-swap-trx-to-chip.js --amount 10

# 测试 CHIP → TRX 兑换
TRON_NETWORK=testnet node scripts/test-swap-chip-to-trx.js --amount 100
```

## 前端集成

### 1. 更新前端配置

编辑 `src/clientConfig.js`：

```javascript
const config = {
  // ... 其他配置
  
  // AMM 配置
  chipTokenAddress: process.env.REACT_APP_CHIP_TOKEN_ADDRESS,
  ammPoolAddress: process.env.REACT_APP_AMM_POOL_ADDRESS,
  ammRouterAddress: process.env.REACT_APP_AMM_ROUTER_ADDRESS
};
```

### 2. 添加前端环境变量

创建 `.env.testnet` 和 `***REMOVED***`：

```bash
# .env.testnet
REACT_APP_CHIP_TOKEN_ADDRESS=TXxxxx...
REACT_APP_AMM_POOL_ADDRESS=TXxxxx...
REACT_APP_AMM_ROUTER_ADDRESS=TXxxxx...
```

## 流动性管理

### 提供流动性

用户可以通过前端界面或合约调用添加流动性：

```javascript
// 1. Approve CHIP to pool
await chipToken.approve(poolAddress, chipAmount);

// 2. Add liquidity
await pool.addLiquidity(chipAmount, { value: trxAmount });
```

### 移除流动性

```javascript
// 移除流动性
await pool.removeLiquidity(lpTokenAmount);
```

## 奖励机制

### VIP 等级（基于质押 CHIP）

| 等级 | 质押数量 | 奖励倍数 | 折扣 |
|------|---------|---------|------|
| Bronze | 0 CHIP | 1.0x | 0% |
| Silver | 1,000 CHIP | 1.5x | 5% |
| Gold | 10,000 CHIP | 2.0x | 10% |
| Platinum | 100,000 CHIP | 3.0x | 20% |

### 奖励计算公式

```
CHIP奖励 = 抽水(TRX) × VIP倍数 × 位置系数
```

示例：
- 5 TRX 抽水 × 2.0 (Gold VIP) × 1.0 (第一名) = 10 CHIP

### 奖励限制

1. **每日上限**: 5,000 CHIP
2. **储备保护**: 当储备 < 250,000 CHIP 时，奖励降低 50%
3. **储备耗尽**: 当储备 = 0 时，停止发放奖励

## 监控与维护

### 监控指标

建议监控以下指标：

1. **流动性池状态**
   - TRX 储备量
   - CHIP 储备量
   - 价格偏离度

2. **奖励系统**
   - 每日奖励发放量
   - 储备余额
   - 奖励调整事件

3. **交易活动**
   - 交易量
   - 滑点统计
   - 用户活跃度

### 应急措施

如果储备过低（< 100,000 CHIP）：

1. 暂停奖励发放
2. 通过 DAO 投票增发 CHIP
3. 从团队资金注入流动性

## 升级路径

### 从 Demo 到正式运营

当用户量增长时，可以逐步增加流动性：

```
Demo:     500 TRX + 5,000 CHIP    (~$40)
阶段 1:   2,000 TRX + 20,000 CHIP  (~$160)
阶段 2:   5,000 TRX + 50,000 CHIP  (~$400)
阶段 3:  10,000 TRX + 100,000 CHIP (~$800)
```

### 扩展建议

- 日活跃用户 < 100: Demo 配置
- 日活跃用户 100-500: 阶段 1
- 日活跃用户 500-1000: 阶段 2
- 日活跃用户 > 1000: 阶段 3

## 成本分析

### 测试网成本
- 部署合约: ~50 TRX (能量租赁)
- 添加流动性: 500 TRX (可提取)
- 总计: ~550 TRX (测试网免费)

### 正式网成本

| 操作 | TRX 成本 | USD 成本 |
|------|---------|---------|
| 部署合约 | ~200 TRX | ~$16 |
| 添加流动性 (Demo) | 500 TRX | ~$40 |
| 添加流动性 (正式) | 5,000 TRX | ~$400 |
| 月度维护 | ~50 TRX | ~$4 |

注：TRX 价格按 $0.08 计算

## 常见问题

### Q: 如何调整每日奖励上限？
A: 修改 `.env` 文件中的 `CHIP_DAILY_REWARD_LIMIT`，重启服务器生效。

### Q: 如何查看当前储备余额？
A: 运行 `node scripts/check-chip-info.js` 查看服务器钱包的 CHIP 余额。

### Q: 流动性池的价格为什么会偏离？
A: AMM 使用恒定乘积公式，交易会改变储备比例导致价格变化。套利者会修正价格偏离。

### Q: 用户如何获得 CHIP？
A: 
1. 通过 AMM 用 TRX 购买
2. 游戏奖励（需质押 CHIP 获得 VIP 等级）
3. 其他用户转账

## 相关文档

- [AMM 用户指南](./AMM_USER_GUIDE.md)
- [CHIP Token 指南](../CHIP_TOKEN_GUIDE.md)
- [流动性池设计](../openspec/changes/amm-liquidity-pool/design.md)
