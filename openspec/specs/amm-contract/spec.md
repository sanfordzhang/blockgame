# AMM Contract Specification

## ADDED Requirements

### Requirement: 恒定乘积做市商算法
系统必须实现基于恒定乘积公式（x*y=k）的自动做市商算法，确保TRX/CHIP交易对的储备量乘积恒定。

#### Scenario: 验证恒定乘积公式
- **WHEN** 用户执行TRX与CHIP之间的任意交换操作
- **THEN** 系统必须确保reserveTRX * reserveCHIP的乘积在交易前后保持不变或增加（考虑手续费累积）

#### Scenario: 计算交易输出
- **WHEN** 用户输入指定数量的TRX或CHIP进行交换
- **THEN** 系统必须根据恒定乘积公式准确计算输出代币数量
- **AND** 输出数量 = (输入数量 * 目标储备量 * 997) / (源储备量 * 1000 + 输入数量 * 997)

### Requirement: 流动性添加功能
系统必须允许用户添加TRX和CHIP流动性到池中，并铸造LP代币作为流动性凭证。

#### Scenario: 首次添加流动性
- **WHEN** 用户首次向池中添加流动性（池余额为0）
- **THEN** 系统必须铸造LP代币给用户
- **AND** LP代币数量 = sqrt(存入TRX数量 * 存入CHIP数量)

#### Scenario: 后续添加流动性
- **WHEN** 用户向已有流动性的池中添加流动性
- **THEN** 系统必须按当前储备比例接收TRX和CHIP
- **AND** 铸造LP代币数量 = (存入TRX数量 / TRX储备量) * LP总供应量

#### Scenario: 添加流动性滑点保护
- **WHEN** 用户添加流动性时指定最小LP代币数量
- **THEN** 系统必须验证实际铸造的LP代币数量 >= 最小数量
- **AND** 如果验证失败，交易必须回滚

### Requirement: 流动性移除功能
系统必须允许LP代币持有者移除流动性，并取回相应比例的TRX和CHIP。

#### Scenario: 移除流动性计算
- **WHEN** 用户燃烧指定数量的LP代币
- **THEN** 系统必须计算用户可取回的TRX和CHIP数量
- **AND** 取回TRX = (LP数量 / LP总供应量) * TRX储备量
- **AND** 取回CHIP = (LP数量 / LP总供应量) * CHIP储备量

#### Scenario: 移除流动性执行
- **WHEN** 用户执行移除流动性操作
- **THEN** 系统必须燃烧用户的LP代币
- **AND** 转账对应比例的TRX和CHIP到用户地址

### Requirement: TRX到CHIP交换
系统必须允许用户使用TRX购买CHIP代币。

#### Scenario: 使用TRX购买CHIP
- **WHEN** 用户发送TRX到交换函数并指定最小输出CHIP数量
- **THEN** 系统必须计算可获得的CHIP数量
- **AND** 验证输出数量 >= 最小输出数量
- **AND** 转账CHIP到用户地址

#### Scenario: 交换手续费扣除
- **WHEN** 用户执行TRX到CHIP的交换
- **THEN** 系统必须扣除0.3%的交易金额作为手续费
- **AND** 手续费保留在池中，增加储备量

### Requirement: CHIP到TRX交换
系统必须允许用户使用CHIP购买TRX。

#### Scenario: 使用CHIP购买TRX
- **WHEN** 用户授权并调用CHIP到TRX的交换函数，指定最小输出TRX数量
- **THEN** 系统必须验证用户CHIP授权额度充足
- **AND** 转账CHIP从用户到池
- **AND** 计算并转账TRX到用户地址

#### Scenario: CHIP授权检查
- **WHEN** 用户尝试交换CHIP但未授权Router合约
- **THEN** 交易必须失败并返回授权不足错误

### Requirement: 滑点保护机制
系统必须实现滑点保护，防止用户因价格波动遭受过大损失。

#### Scenario: 滑点验证
- **WHEN** 用户设置最小输出数量参数进行交易
- **THEN** 系统必须在交易执行前验证实际输出 >= 最小输出
- **AND** 如果验证失败，交易必须回滚

#### Scenario: 默认滑点设置
- **WHEN** 用户未指定最小输出数量或指定为0
- **THEN** 系统应接受任意输出数量（不推荐，但允许）

### Requirement: 交易截止时间
系统必须支持交易截止时间，防止交易在延迟确认后执行。

#### Scenario: 截止时间验证
- **WHEN** 用户指定交易截止时间戳
- **THEN** 系统必须在交易执行前验证当前区块时间 <= 截止时间
- **AND** 如果超过截止时间，交易必须回滚

#### Scenario: 默认截止时间
- **WHEN** 用户未指定截止时间
- **THEN** 系统应设置默认截止时间为交易发起时间 + 20分钟

### Requirement: 储备量查询
系统必须提供查询当前TRX和CHIP储备量的功能。

#### Scenario: 查询储备量
- **WHEN** 用户或合约调用储备量查询函数
- **THEN** 系统必须返回当前TRX储备量和CHIP储备量
- **AND** 返回最近更新区块时间戳

### Requirement: 价格计算
系统必须提供实时价格计算功能。

#### Scenario: 计算即时价格
- **WHEN** 查询TRX/CHIP价格
- **THEN** 系统必须返回 price = CHIP储备量 / TRX储备量

#### Scenario: 计算时间加权平均价格
- **WHEN** 查询TWAP价格
- **THEN** 系统必须返回基于历史累积价格的加权平均价格
- **AND** 用于防范价格操纵攻击

### Requirement: 重入攻击防护
系统必须防止重入攻击。

#### Scenario: 重入攻击拦截
- **WHEN** 恶意合约尝试在交易执行过程中重入AMM合约
- **THEN** 系统必须检测并拒绝重入调用
- **AND** 交易必须回滚

### Requirement: 闪电贷攻击防护
系统必须防止闪电贷攻击导致的K值操纵。

#### Scenario: K值验证
- **WHEN** 每次交易执行后
- **THEN** 系统必须验证 K值 >= 交易前K值
- **AND** 如果K值减少，交易必须回滚

### Requirement: 紧急暂停功能
系统必须支持管理员在紧急情况下暂停合约。

#### Scenario: 暂停合约
- **WHEN** 管理员调用暂停函数
- **THEN** 系统必须设置暂停状态为true
- **AND** 后续所有交易操作必须被拒绝

#### Scenario: 恢复合约
- **WHEN** 管理员调用恢复函数
- **THEN** 系统必须设置暂停状态为false
- **AND** 恢复正常交易功能

### Requirement: 手续费分配
系统必须将交易手续费分配给流动性提供者。

#### Scenario: 手续费自动分配
- **WHEN** 用户执行交换操作
- **THEN** 系统必须保留0.3%的输入代币在池中
- **AND** 增加储备量，提高LP代币价值

#### Scenario: 手续费累积
- **WHEN** 多次交易发生后
- **THEN** 手续费必须累积在池中
- **AND** LP代币持有者移除流动性时获得累积的手续费收益

### Requirement: LP代币标准
系统必须实现TRC20标准的LP代币。

#### Scenario: LP代币转账
- **WHEN** LP代币持有者发起转账
- **THEN** 系统必须允许LP代币自由转账
- **AND** 不影响流动性池储备量

#### Scenario: LP代币授权
- **WHEN** LP代币持有者授权第三方合约
- **THEN** 系统必须记录授权额度
- **AND** 允许第三方在授权额度内操作LP代币

### Requirement: Router集成
系统必须通过Router合约统一管理用户交互。

#### Scenario: Router交换路由
- **WHEN** 用户通过Router执行交换
- **THEN** Router必须验证参数并调用Pool合约
- **AND** 执行必要的安全检查

#### Scenario: Router流动性管理
- **WHEN** 用户通过Router添加或移除流动性
- **THEN** Router必须处理代币转账和授权
- **AND** 调用Pool合约执行核心逻辑

### Requirement: 事件日志
系统必须在关键操作时触发事件日志。

#### Scenario: 交换事件
- **WHEN** 交换操作成功执行
- **THEN** 系统必须触发Swap事件
- **AND** 包含发送者、输入代币数量、输出代币数量等信息

#### Scenario: 流动性添加事件
- **WHEN** 流动性添加成功
- **THEN** 系统必须触发Mint事件
- **AND** 包含发送者、铸造LP数量、存入代币数量等信息

#### Scenario: 流动性移除事件
- **WHEN** 流动性移除成功
- **THEN** 系统必须触发Burn事件
- **AND** 包含发送者、燃烧LP数量、取回代币数量等信息
