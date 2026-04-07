# AMM Liquidity Pool Implementation

## Why

当前项目中的CHIP代币无法在链上进行自动兑换，用户只能通过场外交易或游戏内转账进行CHIP/TRX交换，缺乏流动性支持且存在信任风险。实现AMM流动性池将为CHIP/TRX交易对提供去中心化、自动化的交易机制，使汇率由市场供需决定，提升代币的流动性和用户体验。

## What Changes

### 新增功能

- **AMM智能合约**：部署基于恒定乘积公式（x*y=k）的自动做市商合约，支持TRX/CHIP交易对的自动交易
- **流动性管理**：用户可添加/移除流动性，成为流动性提供者（LP）并获得交易手续费收益
- **价格自动调节**：基于AMM算法，价格随买卖自动调整，无需订单簿撮合
- **滑点保护**：交易时设置最小输出数量，防止价格剧烈波动导致的损失
- **后端数据同步**：实时同步链上交易数据，缓存流动性池状态
- **汇率查询服务**：提供实时汇率、流动性深度、价格影响等查询接口
- **前端交易界面**：直观展示交易对信息、K线图表、流动性管理面板
- **钱包集成**：与现有TronLink钱包集成，支持一键交易和流动性操作

### 修改内容

- 扩展现有钱包页面，添加DEX入口
- 更新CHIP代币文档，说明流动性池使用方式

## Capabilities

### New Capabilities

- `amm-contract`: AMM流动性池智能合约，包含流动性管理、交易执行、价格计算、手续费分配等功能
- `liquidity-service`: 后端流动性服务，提供链上数据同步、汇率查询、流动性监控、交易历史记录等API
- `trading-interface`: 前端交易界面，包含交易面板、流动性管理、图表展示、资产连接等用户交互功能
- `price-oracle`: 价格预言机服务，提供实时汇率查询、滑点计算、价格影响预估等计算功能

### Modified Capabilities

无现有能力需要修改。这是全新功能模块，不涉及现有规格的变更。

## Impact

### 受影响的代码模块

- **新增合约** (`contracts/`)
  - `AMMPool.sol` - AMM流动性池合约
  - `AMMFactory.sol` - 工厂合约（可选，支持多交易对）
  - `AMMRouter.sol` - 路由合约（交易入口）

- **新增后端服务** (`server/`)
  - `services/LiquidityService.js` - 流动性数据服务
  - `services/PriceOracleService.js` - 价格预言机服务
  - `routes/api/amm.js` - AMM API路由
  - `blockchain/AMMListener.js` - 链上事件监听

- **新增前端页面** (`src/`)
  - `pages/DEX.js` - DEX交易页面
  - `components/amm/TradingPanel.js` - 交易面板组件
  - `components/amm/LiquidityPanel.js` - 流动性管理组件
  - `components/amm/Chart.js` - K线图组件
  - `context/amm/AMMContext.js` - AMM状态管理

### API变更

**新增API端点**：
- `GET /api/amm/pools` - 查询所有流动性池
- `GET /api/amm/pool/:address` - 查询指定池状态
- `GET /api/amm/price` - 查询实时汇率
- `GET /api/amm/quote` - 预估交易输出
- `GET /api/amm/liquidity/:user` - 查询用户流动性
- `POST /api/amm/tx/add-liquidity` - 添加流动性交易数据
- `POST /api/amm/tx/remove-liquidity` - 移除流动性交易数据
- `POST /api/amm/tx/swap` - 兑换交易数据

### 依赖关系

- **区块链依赖**：TRON Nile测试网（已支持）
- **外部库**：
  - 前端图表：`lightweight-charts` 或 `recharts`
  - 智能合约：基于Uniswap V2模式的AMM实现
- **现有依赖**：
  - TronWeb v6（已安装）
  - React 16（已安装）
  - Express（已安装）

### 系统影响

- **数据库**：新增流动性池状态缓存表
- **事件监听**：新增AMM合约事件监听器
- **前端路由**：新增 `/dex` 路由
- **钱包集成**：复用现有TronLink连接逻辑

### 兼容性

- **向后兼容**：不影响现有游戏、NFT、DAO功能
- **部署方式**：独立合约，可与现有合约并行运行
- **迁移成本**：低，无数据迁移需求
