# AMM Liquidity Pool - Technical Design

## Context

### 当前状态

项目已有完善的德州扑克游戏系统，包含：
- CHIP代币合约（`TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n`）
- TronLink钱包集成
- 游戏内余额系统
- 后端服务（Express + MongoDB）
- 前端应用（React 16）

**核心问题**：CHIP代币无法在链上自由兑换TRX，用户只能通过：
1. 游戏内转账（中心化，需要信任平台）
2. 场外交易（无流动性，存在信任风险）

### 约束条件

- **区块链平台**：TRON网络（Nile测试网 → 主网）
- **代币精度**：CHIP为6位小数（1 CHIP = 1,000,000 microCHIP）
- **现有合约**：不能修改已部署的CHIP合约（无mint权限）
- **钱包要求**：必须兼容TronLink钱包签名
- **性能要求**：交易确认时间 < 30秒
- **安全要求**：防止闪电贷攻击、价格操纵

### 技术栈

- **智能合约**：Solidity 0.8.x（TRON TVM兼容）
- **后端**：Node.js + Express + Mongoose
- **前端**：React 16 + styled-components
- **区块链交互**：TronWeb v6
- **图表库**：lightweight-charts（TradingView开源库）

---

## Goals / Non-Goals

### Goals

1. **实现去中心化交易**：用户可通过AMM在链上自由兑换CHIP/TRX
2. **提供流动性激励**：流动性提供者（LP）可获得交易手续费
3. **价格自动发现**：通过AMM算法自动调节价格，无需订单簿
4. **滑点保护**：防止用户因价格波动遭受过大损失
5. **数据实时同步**：后端缓存流动性池状态，提供快速查询
6. **用户友好界面**：直观的交易界面和流动性管理面板

### Non-Goals

1. **多交易对支持**：初期仅支持TRX/CHIP交易对
2. **跨链交易**：不支持跨链资产交换
3. **杠杆交易**：不支持保证金或杠杆
4. **订单簿模式**：不实现订单簿撮合交易
5. **治理功能**：不包含DAO治理（可后续扩展）
6. **移动端App**：仅Web端，暂不开发移动应用

---

## Decisions

### 决策1：AMM算法选择

**选择**：恒定乘积做市商（x*y=k，Uniswap V2模式）

**理由**：
- **简单可靠**：算法成熟，经过市场验证
- **TRON兼容**：TVM完全支持，无技术障碍
- **易于理解**：用户和开发者都能快速理解
- **手续费灵活**：可配置手续费率（默认0.3%）

**替代方案考虑**：
- ❌ **Uniswap V3（集中流动性）**：复杂度高，需要价格区间管理，Gas消耗大
- ❌ **Curve（StableSwap）**：适用于稳定币，CHIP/TRX不是稳定对
- ❌ **Balancer（加权池）**：过度设计，初期不需要多代币权重

**公式说明**：
```
恒定乘积: reserveTRX * reserveCHIP = k

交易计算:
- 买入CHIP: amountOut = (amountIn * reserveCHIP * 997) / (reserveTRX * 1000 + amountIn * 997)
- 卖出CHIP: amountOut = (amountIn * reserveTRX * 997) / (reserveCHIP * 1000 + amountIn * 997)
- 手续费: 0.3% (997/1000)

价格影响:
priceImpact = amountIn / (reserveIn + amountIn)
```

---

### 决策2：合约架构设计

**选择**：三合约架构（Pool + Router + Factory）

```
┌─────────────────────────────────────────────┐
│          AMMRouter (交易入口)                │
│  - swapTRXForCHIP()                         │
│  - swapCHIPForTRX()                         │
│  - addLiquidity()                           │
│  - removeLiquidity()                        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│          AMMPool (核心池)                    │
│  - reserveTRX / reserveCHIP                 │
│  - totalSupply (LP代币)                     │
│  - swap() / mint() / burn()                 │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│        CHIP Token (现有合约)                 │
│  - approve() → Router                       │
│  - transfer()                               │
└─────────────────────────────────────────────┘
```

**理由**：
- **Router模式**：统一交易入口，方便添加多跳交易
- **Pool分离**：核心逻辑与路由逻辑解耦，便于升级
- **Factory模式**：为未来支持多交易对预留扩展性

**替代方案考虑**：
- ❌ **单合约模式**：所有逻辑在一个合约，升级困难，Gas成本高
- ❌ **无Router模式**：用户直接调用Pool，不支持多跳交易

**合约职责**：

| 合约 | 职责 | 关键函数 |
|------|------|----------|
| AMMPool | 流动性池核心 | `swap()`, `mint()`, `burn()`, `getReserves()` |
| AMMRouter | 用户交互入口 | `addLiquidity()`, `removeLiquidity()`, `swap()` |
| AMMFactory | 创建交易对 | `createPool()` (可选，初期不实现) |

---

### 决策3：手续费机制

**选择**：固定0.3%手续费，全部分配给LP

**理由**：
- **行业标准**：Uniswap V2标准费率
- **激励LP**：全部分配给流动性提供者
- **简单透明**：用户容易理解

**替代方案考虑**：
- ❌ **动态手续费**：根据波动性调整（复杂，不适合初期）
- ❌ **协议分成**：部分手续费归项目方（降低LP收益）

**手续费分配**：
```
交易金额: 100 TRX
手续费: 0.3 TRX (0.3%)
实际交易: 99.7 TRX
LP收益: 0.3 TRX (增加池子储备)
```

---

### 决策4：滑点保护实现

**选择**：用户设置最小输出数量（amountOutMin）

**实现方式**：
```solidity
// 交易函数签名
function swapTRXForCHIP(
    uint256 amountOutMin,  // 最小输出CHIP数量
    uint256 deadline       // 交易截止时间
) external payable;

// 验证逻辑
uint256 amountOut = calculateOutput(msg.value);
require(amountOut >= amountOutMin, "Slippage too high");
```

**默认滑点设置**：
- 保守模式：0.5%（适合大额交易）
- 标准模式：1.0%（默认）
- 激进模式：3.0%（适合小额或快速交易）

**替代方案考虑**：
- ❌ **固定滑点**：无法适应不同市场情况
- ❌ **无保护**：用户可能遭受三明治攻击

---

### 决策5：后端数据同步策略

**选择**：事件监听 + 定时轮询混合模式

**架构**：
```
区块链事件 → AMMListener → MongoDB缓存
                ↓
            WebSocket推送 → 前端
```

**实现细节**：
1. **事件监听**（实时性）
   - `Swap` 事件：交易发生
   - `Mint` 事件：添加流动性
   - `Burn` 事件：移除流动性
   
2. **定时轮询**（数据校验）
   - 每30秒查询链上储备量
   - 与缓存数据对比，发现偏差则修正

3. **缓存数据结构**：
```javascript
{
  poolAddress: String,
  reserveTRX: Number,
  reserveCHIP: Number,
  totalSupply: Number,
  lastUpdateAt: Date,
  priceTRXPerCHIP: Number,
  priceCHIPPerTRX: Number
}
```

**替代方案考虑**：
- ❌ **纯事件监听**：可能漏掉事件，数据不一致
- ❌ **纯轮询**：实时性差，延迟高

---

### 决策6：前端图表方案

**选择**：lightweight-charts (TradingView开源库)

**理由**：
- **轻量级**：仅44KB，不影响性能
- **专业K线图**：支持蜡烛图、成交量图
- **响应式**：自动适配移动端
- **MIT开源**：无版权问题

**替代方案考虑**：
- ❌ **recharts**：适合统计图，不适合金融K线
- ❌ **echarts**：体积大（300KB+），过度设计
- ❌ **自定义Canvas**：开发成本高，维护困难

**图表功能**：
- 价格K线图（1分钟/5分钟/1小时/1天）
- 成交量柱状图
- 移动平均线（MA7, MA25）
- 实时价格线
- 深度图（可选）

---

### 决策7：数据库Schema设计

**选择**：MongoDB文档模型

**核心表设计**：

```javascript
// PoolState - 流动性池状态缓存
{
  _id: ObjectId,
  poolAddress: String,          // 合约地址
  token0: String,               // TRX地址（address(0)）
  token1: String,               // CHIP地址
  reserve0: String,             // TRX储备量（wei）
  reserve1: String,             // CHIP储备量（microCHIP）
  totalSupply: String,          // LP代币总量
  price0: Number,               // 1 TRX = ? CHIP
  price1: Number,               // 1 CHIP = ? TRX
  blockNumber: Number,          // 区块高度
  timestamp: Date,              // 更新时间
  createdAt: Date,
  updatedAt: Date
}

// SwapEvent - 交易记录
{
  _id: ObjectId,
  txHash: String,               // 交易哈希
  poolAddress: String,
  sender: String,               // 交易发起者
  amount0In: String,            // 输入TRX
  amount1In: String,            // 输入CHIP
  amount0Out: String,           // 输出TRX
  amount1Out: String,           // 输出CHIP
  priceImpact: Number,          // 价格影响
  blockNumber: Number,
  timestamp: Date,
  createdAt: Date
}

// UserLiquidity - 用户流动性
{
  _id: ObjectId,
  userAddress: String,
  poolAddress: String,
  lpBalance: String,            // LP代币余额
  share: Number,                // 占比（百分比）
  depositedTRX: String,         // 累计存入TRX
  depositedCHIP: String,        // 累计存入CHIP
  earnedTRX: String,            // 累计收益TRX
  earnedCHIP: String,           // 累计收益CHIP
  updatedAt: Date
}
```

**索引设计**：
```javascript
// PoolState
db.poolstates.createIndex({ poolAddress: 1 }, { unique: true });
db.poolstates.createIndex({ timestamp: -1 });

// SwapEvent
db.swapevents.createIndex({ poolAddress: 1, timestamp: -1 });
db.swapevents.createIndex({ sender: 1, timestamp: -1 });
db.swapevents.createIndex({ txHash: 1 }, { unique: true });

// UserLiquidity
db.userliquidities.createIndex({ userAddress: 1, poolAddress: 1 }, { unique: true });
```

---

### 决策8：安全防护措施

**选择**：多层安全防护

**防护措施**：

1. **重入攻击防护**
```solidity
// 使用ReentrancyGuard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AMMPool is ReentrancyGuard {
    function swap() external nonReentrant {
        // 交易逻辑
    }
}
```

2. **闪电贷攻击防护**
```solidity
// 检查K值在交易前后是否增加（手续费累积）
uint256 kBefore = reserve0 * reserve1;
// ... 执行交易 ...
uint256 kAfter = reserve0 * reserve1;
require(kAfter >= kBefore, "K value decreased");
```

3. **价格操纵防护**
```solidity
// TWAP时间加权平均价格
uint256 public price0CumulativeLast;
uint256 public price1CumulativeLast;
uint32 public blockTimestampLast;

function updateCumulativePrice() internal {
    uint32 timeElapsed = block.timestamp - blockTimestampLast;
    price0CumulativeLast += uint256(reserve1 / reserve0) * timeElapsed;
    price1CumulativeLast += uint256(reserve0 / reserve1) * timeElapsed;
    blockTimestampLast = uint32(block.timestamp);
}
```

4. **整数溢出防护**
```solidity
// Solidity 0.8.x 内置溢出检查
pragma solidity ^0.8.0;
```

5. **权限控制**
```solidity
// 管理员仅限紧急暂停
address public owner;
bool public paused;

modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

modifier whenNotPaused() {
    require(!paused, "Paused");
    _;
}

function setPause(bool _paused) external onlyOwner {
    paused = _paused;
}
```

---

## Risks / Trade-offs

### 风险1：流动性不足导致高滑点

**风险描述**：初期流动性池较小，大额交易会导致高滑点

**影响等级**：高

**缓解措施**：
- [ ] 项目方提供初始流动性（建议1000 TRX + 10000 CHIP）
- [ ] 前端显示价格影响警告（>3%时提示）
- [ ] 设置单笔交易上限（如池子储备的10%）
- [ ] 考虑流动性挖矿激励（后续迭代）

---

### 风险2：无偿损失（Impermanent Loss）

**风险描述**：LP在价格剧烈波动时可能遭受损失

**影响等级**：中

**缓解措施**：
- [ ] 前端教育用户了解无偿损失风险
- [ ] 显示历史收益vs持有对比图表
- [ ] 提供退出策略建议
- [ ] 考虑保险机制（后续迭代）

---

### 风险3：智能合约漏洞

**风险描述**：合约代码存在漏洞，导致资金损失

**影响等级**：高

**缓解措施**：
- [ ] 使用OpenZeppelin安全库
- [ ] 内部代码审查
- [ ] 第三方安全审计（上线前）
- [ ] Bug赏金计划
- [ ] 设置交易额度限制（初期）
- [ ] 多签钱包管理管理员权限

---

### 风险4：前端性能问题

**风险描述**：实时图表更新可能导致性能问题

**影响等级**：低

**缓解措施**：
- [ ] 使用Web Worker处理图表数据
- [ ] 数据节流（最多每秒更新1次）
- [ ] 历史数据分页加载
- [ ] 虚拟滚动优化

---

### 风险5：TRON网络拥堵

**风险描述**：网络拥堵导致交易延迟或失败

**影响等级**：中

**缓解措施**：
- [ ] 设置合理的Gas费用（Energy + Bandwidth）
- [ ] 交易失败重试机制
- [ ] 显示交易确认状态
- [ ] 支持加速交易（提高Gas）

---

### Trade-off 1：中心化数据缓存 vs 完全去中心化

**选择**：使用后端缓存池状态

**权衡**：
- ✅ **优点**：查询速度快，减少链上调用，用户体验好
- ❌ **缺点**：缓存可能暂时不一致，依赖后端服务

**应对**：
- 定时轮询校验数据
- 关键操作（交易）仍读取链上数据

---

### Trade-off 2：简单AMM vs 高级功能

**选择**：初期仅实现基础AMM功能

**权衡**：
- ✅ **优点**：快速上线，代码简洁，易于维护
- ❌ **缺点**：功能相对简单，缺少高级交易功能

**未来扩展**：
- 多交易对支持
- 集中流动性（类似Uniswap V3）
- 限价单功能
- 流动性挖矿激励

---

## Migration Plan

### 阶段1：合约部署与测试（1周）

**步骤**：
1. 部署AMMPool合约到Nile测试网
2. 部署AMMRouter合约
3. 单元测试（Mocha + Chai）
4. 集成测试（模拟交易流程）
5. 安全审计（内部审查）

**验证标准**：
- ✅ 所有测试用例通过
- ✅ 添加/移除流动性功能正常
- ✅ TRX ↔ CHIP 交换功能正常
- ✅ 滑点保护生效

---

### 阶段2：后端服务开发（1周）

**步骤**：
1. 实现LiquidityService（数据同步）
2. 实现PriceOracleService（汇率计算）
3. 实现AMM API路由
4. 实现事件监听器
5. 集成测试

**验证标准**：
- ✅ 流动性池数据实时同步
- ✅ 汇率查询准确
- ✅ API响应时间 < 200ms
- ✅ 事件监听稳定运行

---

### 阶段3：前端界面开发（1周）

**步骤**：
1. 实现DEX页面布局
2. 实现交易面板组件
3. 实现流动性管理组件
4. 集成图表库
5. TronLink钱包集成
6. E2E测试

**验证标准**：
- ✅ 交易流程顺畅
- ✅ 流动性操作正常
- ✅ 图表实时更新
- ✅ 响应式适配

---

### 阶段4：主网部署（3天）

**步骤**：
1. 合约部署到TRON主网
2. 初始化流动性池（1000 TRX + 10000 CHIP）
3. 部署后端服务
4. 部署前端应用
5. 监控与告警配置

**验证标准**：
- ✅ 主网合约地址可访问
- ✅ 初始流动性已注入
- ✅ 生产环境功能正常
- ✅ 监控系统运行

---

### Rollback策略

**触发条件**：
- 发现严重安全漏洞
- 大量用户资金异常
- 合约逻辑错误

**回滚步骤**：
1. 暂停Router合约（设置paused=true）
2. 前端显示维护通知
3. 导出用户流动性数据
4. 修复问题并重新部署
5. 迁移用户流动性到新合约

**数据备份**：
- 每小时备份MongoDB数据
- 保留链上事件日志
- 用户LP代币余额可从链上恢复

---

## Open Questions

### Q1: 是否需要实现多交易对支持？

**背景**：初期仅支持TRX/CHIP，但未来可能需要其他代币对

**选项**：
- A. 暂不实现，使用单池模式（简单）
- B. 实现Factory模式，预留扩展性（复杂）

**建议**：选择A，初期简单实现，后续根据需求重构

**决策时间**：开发前

---

### Q2: 是否需要流动性挖矿激励？

**背景**：通过CHIP奖励吸引流动性提供者

**选项**：
- A. 不实现，仅靠交易手续费激励（简单）
- B. 实现CHIP质押奖励（复杂，需要修改CHIP合约）

**建议**：选择A，观察流动性情况后再决定

**决策时间**：上线运营1个月后

---

### Q3: 前端托管方案？

**背景**：生产环境前端需要稳定托管

**选项**：
- A. IPFS + ENS域名（去中心化）
- B. 传统云托管（中心化，性能好）
- C. CloudBase（腾讯云，与现有系统一致）

**建议**：选择C，与现有部署架构一致

**决策时间**：主网部署前

---

### Q4: 价格图表数据来源？

**背景**：K线图需要历史价格数据

**选项**：
- A. 自建数据库存储历史价格（可控）
- B. 从链上事件重建（去中心化，但慢）
- C. 使用第三方API（依赖外部服务）

**建议**：选择A，后端同步并存储交易历史

**决策时间**：后端开发阶段

---

### Q5: Gas费用估算策略？

**背景**：TRON网络需要Energy和Bandwidth

**选项**：
- A. 用户自付Gas（标准模式）
- B. 服务器代付Gas（提升体验，但成本高）
- C. 混合模式（小额代付，大额自付）

**建议**：选择A，与现有系统一致

**决策时间**：合约开发阶段

---

## Implementation Timeline

| 阶段 | 任务 | 时间 | 负责人 |
|------|------|------|--------|
| 阶段1 | 智能合约开发与测试 | 1周 | 区块链工程师 |
| 阶段2 | 后端服务开发 | 1周 | 后端工程师 |
| 阶段3 | 前端界面开发 | 1周 | 前端工程师 |
| 阶段4 | 集成测试 | 3天 | QA工程师 |
| 阶段5 | 主网部署 | 3天 | DevOps |
| 阶段6 | 监控与运营 | 持续 | 运维团队 |

**总计**：约3-4周完成开发和部署

---

## Success Metrics

### 技术指标

- 合约部署成功率：100%
- API响应时间：< 200ms
- 前端加载时间：< 3秒
- 系统可用性：> 99.5%

### 业务指标

- 初始流动性：> 1000 TRX
- 日交易量：> 100笔（上线1个月后）
- 流动性提供者：> 10人（上线1个月后）
- 用户满意度：> 4.0/5.0

### 安全指标

- 安全漏洞：0个高危
- 资金损失：0
- 异常交易：及时拦截率 > 95%
