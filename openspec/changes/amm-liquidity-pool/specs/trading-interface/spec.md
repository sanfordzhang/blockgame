# Trading Interface Specification

## ADDED Requirements

### Requirement: DEX交易页面
系统必须提供独立的DEX交易页面，路径为 /dex。

#### Scenario: 访问DEX页面
- **WHEN** 用户访问 /dex 路径
- **THEN** 系统必须显示DEX交易界面
- **AND** 显示TRX/CHIP交易对信息
- **AND** 显示钱包连接状态

#### Scenario: 钱包未连接提示
- **WHEN** 用户未连接TronLink钱包
- **THEN** 系统必须显示"连接钱包"按钮
- **AND** 禁用交易和流动性操作

### Requirement: 钱包集成
系统必须与现有TronLink钱包集成。

#### Scenario: 连接TronLink钱包
- **WHEN** 用户点击"连接钱包"按钮
- **THEN** 系统必须检测TronLink是否已安装
- **AND** 如果已安装，请求用户授权连接
- **AND** 显示用户TRX和CHIP余额

#### Scenario: TronLink未安装
- **WHEN** 检测到TronLink未安装
- **THEN** 系统必须显示安装引导
- **AND** 提供TronLink下载链接

#### Scenario: 显示钱包余额
- **WHEN** 钱包已连接
- **THEN** 系统必须显示用户的TRX余额和CHIP余额
- **AND** 实时更新余额（通过定时查询或事件监听）

### Requirement: 交易面板
系统必须提供直观的交易面板组件。

#### Scenario: 显示交易对信息
- **WHEN** 用户打开交易面板
- **THEN** 系统必须显示当前TRX/CHIP价格
- **AND** 显示储备量、24小时交易量、价格变化等

#### Scenario: 选择交易方向
- **WHEN** 用户点击切换按钮
- **THEN** 系统必须切换TRX → CHIP和CHIP → TRX方向
- **AND** 清空已输入的数量

#### Scenario: 输入交易数量
- **WHEN** 用户输入要交易的TRX或CHIP数量
- **THEN** 系统必须实时计算并显示预期获得的代币数量
- **AND** 显示当前汇率和价格影响

### Requirement: 滑点设置
系统必须允许用户设置滑点容忍度。

#### Scenario: 选择预设滑点
- **WHEN** 用户点击滑点设置
- **THEN** 系统必须提供预设选项：0.5%、1.0%、3.0%
- **AND** 默认选择1.0%

#### Scenario: 自定义滑点
- **WHEN** 用户输入自定义滑点值
- **THEN** 系统必须验证滑点在合理范围（0.1% - 50%）
- **AND** 显示最小输出数量

#### Scenario: 高滑点警告
- **WHEN** 价格影响 > 设置的滑点容忍度
- **THEN** 系统必须显示警告提示
- **AND** 建议用户调整交易数量或滑点设置

### Requirement: 交易执行
系统必须执行链上交换交易。

#### Scenario: 确认交易
- **WHEN** 用户点击"交换"按钮
- **THEN** 系统必须显示交易确认弹窗
- **AND** 显示输入数量、输出数量、汇率、价格影响、手续费等信息

#### Scenario: CHIP授权检查
- **WHEN** 用户交易CHIP（卖出CHIP）
- **THEN** 系统必须检查CHIP授权额度是否充足
- **AND** 如果不足，先引导用户授权Router合约

#### Scenario: 发送交易
- **WHEN** 用户确认交易
- **THEN** 系统必须调用Router合约的交换函数
- **AND** 通过TronLink请求用户签名
- **AND** 显示交易处理中状态

#### Scenario: 交易成功
- **WHEN** 交易成功上链
- **THEN** 系统必须显示成功提示
- **AND** 更新用户余额显示
- **AND** 显示交易哈希和区块浏览器链接

#### Scenario: 交易失败
- **WHEN** 交易失败（用户取消、滑点过大、Gas不足等）
- **THEN** 系统必须显示失败原因
- **AND** 提供重试选项

### Requirement: 流动性管理面板
系统必须提供流动性管理界面。

#### Scenario: 添加流动性入口
- **WHEN** 用户点击"流动性"标签
- **THEN** 系统必须显示流动性管理界面
- **AND** 显示当前池的储备量和用户LP余额

#### Scenario: 输入添加流动性数量
- **WHEN** 用户输入TRX或CHIP数量
- **THEN** 系统必须自动计算并填充另一个代币数量（保持比例）
- **AND** 显示将获得的LP代币数量

#### Scenario: 添加流动性执行
- **WHEN** 用户点击"添加流动性"按钮
- **THEN** 系统必须检查CHIP授权
- **AND** 调用Router的addLiquidity函数
- **AND** 显示交易处理状态

#### Scenario: 移除流动性
- **WHEN** 用户输入要移除的LP代币数量或百分比
- **THEN** 系统必须计算并显示可取回的TRX和CHIP数量
- **AND** 调用Router的removeLiquidity函数

### Requirement: 价格图表
系统必须显示价格K线图表。

#### Scenario: 加载价格图表
- **WHEN** 用户打开交易界面
- **THEN** 系统必须加载并显示K线图
- **AND** 默认显示最近24小时的1小时K线

#### Scenario: 切换时间周期
- **WHEN** 用户选择不同时间周期（1分钟、5分钟、1小时、1天）
- **THEN** 系统必须重新加载对应周期的K线数据
- **AND** 更新图表显示

#### Scenario: 实时更新价格
- **WHEN** 新交易发生
- **THEN** 系统必须通过WebSocket接收价格更新
- **AND** 实时更新K线图和当前价格

#### Scenario: 图表交互
- **WHEN** 用户在图表上移动鼠标或缩放
- **THEN** 系统必须显示对应时间点的价格信息
- **AND** 支持缩放和平移操作

### Requirement: 交易历史
系统必须显示用户的交易历史。

#### Scenario: 查看交易历史
- **WHEN** 用户点击"历史"标签
- **THEN** 系统必须显示用户的最近交易记录
- **AND** 包含交换、添加流动性、移除流动性操作

#### Scenario: 交易记录详情
- **WHEN** 用户点击某条交易记录
- **THEN** 系统必须显示交易详细信息
- **AND** 提供区块链浏览器链接

### Requirement: 深度图（可选）
系统可以显示流动性深度图。

#### Scenario: 显示深度图
- **WHEN** 用户切换到深度图视图
- **THEN** 系统必须显示买单和卖单深度曲线
- **AND** 显示不同价格区间的流动性分布

### Requirement: 响应式设计
系统必须支持响应式布局。

#### Scenario: 桌面端显示
- **WHEN** 用户在桌面浏览器访问
- **THEN** 系统必须显示双栏布局
- **AND** 左侧显示图表，右侧显示交易面板

#### Scenario: 移动端显示
- **WHEN** 用户在移动设备访问
- **THEN** 系统必须显示单栏布局
- **AND** 图表和交易面板垂直排列
- **AND** 保持良好的触控交互体验

### Requirement: 加载状态
系统必须显示适当的加载状态。

#### Scenario: 初始加载
- **WHEN** 页面首次加载
- **THEN** 系统必须显示骨架屏或加载动画
- **AND** 避免内容跳动

#### Scenario: 数据刷新
- **WHEN** 数据正在刷新
- **THEN** 系统必须显示加载指示器
- **AND** 保持上次数据可见直到新数据到达

### Requirement: 错误处理
系统必须正确处理错误情况。

#### Scenario: API调用失败
- **WHEN** 后端API调用失败
- **THEN** 系统必须显示错误提示
- **AND** 提供重试选项

#### Scenario: 网络断开
- **WHEN** WebSocket连接断开
- **THEN** 系统必须显示离线提示
- **AND** 尝试自动重连

### Requirement: 用户引导
系统必须提供新用户引导。

#### Scenario: 首次访问引导
- **WHEN** 用户首次访问DEX页面
- **THEN** 系统可以显示简短的引导说明
- **AND** 解释AMM、流动性、滑点等概念

#### Scenario: 工具提示
- **WHEN** 用户鼠标悬停在专业术语上
- **THEN** 系统必须显示解释性工具提示
- **AND** 帮助用户理解各项指标含义

### Requirement: 性能优化
系统必须保证前端性能。

#### Scenario: 图表数据懒加载
- **WHEN** 用户切换到历史数据视图
- **THEN** 系统必须按需加载历史数据
- **AND** 不阻塞界面交互

#### Scenario: 组件代码分割
- **WHEN** 用户访问DEX页面
- **THEN** 系统必须使用代码分割
- **AND** 只加载必要的组件和库

### Requirement: 可访问性
系统必须满足基本的可访问性要求。

#### Scenario: 键盘导航
- **WHEN** 用户使用键盘操作
- **THEN** 所有交互元素必须可聚焦
- **AND** 支持Tab键导航和Enter键确认

#### Scenario: 屏幕阅读器支持
- **WHEN** 用户使用屏幕阅读器
- **THEN** 所有关键信息必须有适当的ARIA标签
- **AND** 状态变化必须有语音提示
