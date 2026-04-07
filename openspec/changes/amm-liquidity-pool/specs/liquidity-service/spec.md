# Liquidity Service Specification

## ADDED Requirements

### Requirement: 流动性池状态同步
系统必须实时同步链上流动性池状态到数据库缓存。

#### Scenario: 初始同步流动性池状态
- **WHEN** 服务启动或检测到新的流动性池
- **THEN** 系统必须从链上读取储备量、总供应量等状态
- **AND** 存储到MongoDB的PoolState集合

#### Scenario: 增量更新流动性池状态
- **WHEN** 区块链上发生Swap、Mint或Burn事件
- **THEN** 系统必须更新数据库中的储备量
- **AND** 更新价格、总供应量等相关字段
- **AND** 记录更新时间戳和区块高度

#### Scenario: 定时校验数据一致性
- **WHEN** 定时任务每30秒执行一次
- **THEN** 系统必须从链上读取最新储备量
- **AND** 与数据库缓存对比
- **AND** 如果偏差超过阈值，修正缓存数据

### Requirement: 事件监听
系统必须监听AMM合约的关键事件。

#### Scenario: 监听Swap事件
- **WHEN** 流动性池触发Swap事件
- **THEN** 系统必须捕获事件数据
- **AND** 解析交易哈希、发送者、输入输出数量
- **AND** 存储到SwapEvent集合

#### Scenario: 监听Mint事件
- **WHEN** 流动性池触发Mint事件
- **THEN** 系统必须捕获事件数据
- **AND** 更新流动性池总供应量
- **AND** 更新用户流动性记录

#### Scenario: 监听Burn事件
- **WHEN** 流动性池触发Burn事件
- **THEN** 系统必须捕获事件数据
- **AND** 更新流动性池总供应量
- **AND** 更新用户流动性记录

#### Scenario: 事件监听失败重试
- **WHEN** 事件监听器断开连接或错过事件
- **THEN** 系统必须自动重连
- **AND** 回溯最近100个区块确保不遗漏事件

### Requirement: 汇率查询API
系统必须提供实时汇率查询接口。

#### Scenario: 查询当前汇率
- **WHEN** 客户端调用GET /api/amm/price
- **THEN** 系统必须返回当前TRX/CHIP和CHIP/TRX汇率
- **AND** 返回储备量、总供应量
- **AND** 响应时间必须 < 200ms

#### Scenario: 计算即时价格
- **WHEN** 系统计算价格
- **THEN** 价格 = 储备CHIP / 储备TRX
- **AND** 必须考虑代币精度（CHIP为6位小数）

### Requirement: 交易预估API
系统必须提供交易输出预估接口。

#### Scenario: 预估TRX到CHIP交换输出
- **WHEN** 客户端调用GET /api/amm/quote并指定输入TRX数量
- **THEN** 系统必须计算预期获得的CHIP数量
- **AND** 返回价格影响、最小输出建议

#### Scenario: 预估CHIP到TRX交换输出
- **WHEN** 客户端调用GET /api/amm/quote并指定输入CHIP数量
- **THEN** 系统必须计算预期获得的TRX数量
- **AND** 返回价格影响、最小输出建议

#### Scenario: 价格影响计算
- **WHEN** 计算交易输出
- **THEN** 系统必须计算价格影响 = 输入数量 / (源储备量 + 输入数量)
- **AND** 当价格影响 > 3%时，返回警告标志

### Requirement: 流动性查询API
系统必须提供流动性池信息查询接口。

#### Scenario: 查询所有流动性池
- **WHEN** 客户端调用GET /api/amm/pools
- **THEN** 系统必须返回所有流动性池列表
- **AND** 包含地址、储备量、总供应量、价格等信息

#### Scenario: 查询指定流动性池
- **WHEN** 客户端调用GET /api/amm/pool/:address
- **THEN** 系统必须返回指定池的详细信息
- **AND** 包含储备量、价格、24小时交易量等

### Requirement: 用户流动性查询API
系统必须提供用户流动性持仓查询接口。

#### Scenario: 查询用户流动性
- **WHEN** 客户端调用GET /api/amm/liquidity/:user
- **THEN** 系统必须返回用户在所有池的LP代币余额
- **AND** 计算用户占比（LP余额 / 总供应量）
- **AND** 计算用户对应储备量份额

#### Scenario: 计算用户收益
- **WHEN** 查询用户流动性
- **THEN** 系统必须计算用户的累计手续费收益
- **AND** 与简单持有策略对比，显示收益差异

### Requirement: 交易数据生成API
系统必须生成链上交易所需的参数和签名数据。

#### Scenario: 生成添加流动性交易数据
- **WHEN** 客户端调用POST /api/amm/tx/add-liquidity
- **THEN** 系统必须返回Router合约地址和调用数据
- **AND** 包含函数选择器、编码参数
- **AND** 估算所需Gas费用

#### Scenario: 生成移除流动性交易数据
- **WHEN** 客户端调用POST /api/amm/tx/remove-liquidity
- **THEN** 系统必须返回Router合约地址和调用数据
- **AND** 包含燃烧LP数量、最小输出参数

#### Scenario: 生成交换交易数据
- **WHEN** 客户端调用POST /api/amm/tx/swap
- **THEN** 系统必须返回Router合约地址和调用数据
- **AND** 包含输入代币、最小输出、截止时间参数

### Requirement: 交易历史查询API
系统必须提供交易历史记录查询接口。

#### Scenario: 查询池交易历史
- **WHEN** 客户端调用GET /api/amm/pool/:address/history
- **THEN** 系统必须返回该池的最近交易记录
- **AND** 支持分页查询
- **AND** 按时间倒序排列

#### Scenario: 查询用户交易历史
- **WHEN** 客户端调用GET /api/amm/user/:address/history
- **THEN** 系统必须返回该用户的所有交易记录
- **AND** 包含交换、添加流动性、移除流动性操作

### Requirement: 价格图表数据API
系统必须提供价格历史数据用于K线图展示。

#### Scenario: 查询价格历史
- **WHEN** 客户端调用GET /api/amm/price/history
- **THEN** 系统必须返回指定时间范围的价格数据点
- **AND** 支持不同时间粒度（1分钟、5分钟、1小时、1天）
- **AND** 包含开盘价、收盘价、最高价、最低价、成交量

#### Scenario: 聚合价格数据
- **WHEN** 系统存储交易事件
- **THEN** 系统必须按时间窗口聚合价格数据
- **AND** 计算OHLCV（开高低收量）指标

### Requirement: WebSocket实时推送
系统必须通过WebSocket实时推送流动性池状态更新。

#### Scenario: 推送价格更新
- **WHEN** 流动性池储备量发生变化
- **THEN** 系统必须通过WebSocket推送新价格
- **AND** 推送给所有订阅该池的客户端

#### Scenario: 推送交易事件
- **WHEN** 新交易发生
- **THEN** 系统必须推送交易事件到订阅客户端
- **AND** 包含交易类型、数量、时间等信息

### Requirement: 数据库索引优化
系统必须为高频查询建立索引。

#### Scenario: PoolState索引
- **WHEN** 创建PoolState集合
- **THEN** 系统必须为poolAddress字段创建唯一索引
- **AND** 为timestamp字段创建降序索引

#### Scenario: SwapEvent索引
- **WHEN** 创建SwapEvent集合
- **THEN** 系统必须为txHash字段创建唯一索引
- **AND** 为poolAddress + timestamp创建复合索引
- **AND** 为sender + timestamp创建复合索引

### Requirement: 错误处理
系统必须正确处理各类错误情况。

#### Scenario: 合约调用失败
- **WHEN** 链上合约调用失败
- **THEN** 系统必须捕获错误并记录日志
- **AND** 返回友好的错误消息给客户端

#### Scenario: 数据不一致检测
- **WHEN** 检测到数据库缓存与链上数据不一致
- **THEN** 系统必须记录警告日志
- **AND** 自动修正缓存数据
- **AND** 通知监控系统

### Requirement: 性能优化
系统必须满足性能要求。

#### Scenario: API响应时间
- **WHEN** 客户端调用任何API
- **THEN** 响应时间必须 < 200ms
- **AND** 使用数据库缓存减少链上调用

#### Scenario: 批量查询优化
- **WHEN** 查询多个流动性池状态
- **THEN** 系统必须使用批量查询减少数据库往返次数
- **AND** 使用投影只返回必要字段

### Requirement: 监控与告警
系统必须提供监控和告警机制。

#### Scenario: 监控流动性池健康
- **WHEN** 流动性池储备量过低
- **THEN** 系统必须触发告警
- **AND** 发送通知给管理员

#### Scenario: 监控事件监听器状态
- **WHEN** 事件监听器停止工作超过1分钟
- **THEN** 系统必须触发告警
- **AND** 尝试自动重启监听器
