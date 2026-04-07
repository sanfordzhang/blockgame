# AMM 快速开始指南

## 一键部署测试网

```bash
# 1. 部署 CHIP Token 和 AMM Pool
TRON_NETWORK=testnet node scripts/deploy-chip-amm.js

# 2. 复制输出的地址到 .env.testnet
# 例如：
# CHIP_TOKEN_ADDRESS=TXxxxx...
# AMM_POOL_ADDRESS=TXxxxx...
# AMM_ROUTER_ADDRESS=TXxxxx...

# 3. 验证配置
TRON_NETWORK=testnet node scripts/verify-chip-amm-config.js

# 4. 重启后端服务
brew services restart mongodb-community
ENV_FILE=.env.testnet node server/server.js

# 5. 启动前端
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client
```

## 配置说明

### 测试网配置
- CHIP 总供应量: 1,000,000 CHIP
- 初始流动性: 500 TRX + 5,000 CHIP
- 价格比例: 1 TRX ≈ 10 CHIP

### 正式网配置
- CHIP 总供应量: 1,000,000 CHIP
- 初始流动性 (Demo): 500 TRX + 5,000 CHIP (~$40)
- 初始流动性 (正式): 2,000-10,000 TRX (~$160-$800)

## 奖励机制

### VIP 等级（基于质押）
| 等级 | 质押 CHIP | 奖励倍数 |
|------|----------|---------|
| Bronze | 0 | 1.0x |
| Silver | 1,000 | 1.5x |
| Gold | 10,000 | 2.0x |
| Platinum | 100,000 | 3.0x |

### 奖励限制
- 每日上限: 5,000 CHIP
- 储备保护: < 50% 时奖励降低 50%
- 储备目标: 500,000 CHIP

## 常用命令

### 检查状态
```bash
# 验证配置
TRON_NETWORK=testnet node scripts/verify-chip-amm-config.js

# 查看 CHIP 信息
node scripts/check-chip-info.js
```

### 添加流动性
```bash
# 为现有池添加流动性
TRON_NETWORK=testnet node scripts/add-liquidity.js
```

### 测试功能
```bash
# 测试兑换
TRON_NETWORK=testnet node scripts/test-swap-trx-to-chip.js --amount 10

# 测试奖励
node scripts/test-chip-reward.js
```

## 监控指标

建议每日检查：
- 服务器 CHIP 余额
- 每日奖励发放量
- 流动性池储备
- 交易量和用户活跃度

## 告警阈值

- 储备 < 100,000 CHIP: 暂停奖励
- 储备 < 250,000 CHIP: 降低奖励 50%
- 流动性 < 200 TRX: 补充流动性

## 升级路径

根据用户量增长逐步扩展流动性：

```
Demo:      500 TRX + 5,000 CHIP     (~$40)
阶段 1:   2,000 TRX + 20,000 CHIP   (~$160)
阶段 2:   5,000 TRX + 50,000 CHIP   (~$400)
阶段 3:  10,000 TRX + 100,000 CHIP  (~$800)
```

建议：
- 日活 < 100: Demo 配置
- 日活 100-500: 阶段 1
- 日活 500-1000: 阶段 2
- 日活 > 1000: 阶段 3

## 相关文档

- [部署指南](./AMM_DEPLOYMENT_GUIDE.md) - 详细部署说明
- [优化总结](./AMM_OPTIMIZATION_SUMMARY.md) - 改动总结
- [用户指南](./AMM_USER_GUIDE.md) - 用户使用说明
