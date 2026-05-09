# Spec: 0G Chain Smart Contracts

## ADDED Requirements

### Requirement: PokerGame0G Contract — Fund Custody

系统 SHALL 部署 PokerGame0G 合约用于资金托管、存款、提款和游戏结算。

#### Scenario: Player deposit
- **WHEN** 玩家调用 `deposit()` 并发送 ETH/0G 代币
- **THEN** 合约增加玩家的托管余额（custody balance）
- **AND** 触发 `Deposited(address player, uint256 amount)` 事件
- **AND** 余额仅可通过游戏结算或 withdraw 提取

#### Scenario: Player withdraw
- **WHEN** 玩家调用 `withdraw(uint256 amount)`
- **AND** 其托管余额 >= amount
- **THEN** 合约转账 ETH 给玩家
- **AND** 减少托管余额
- **AND** 触发 `Withdrawn(address player, uint256 amount)` 事件

#### Scenario: Withdraw insufficient balance
- **WHEN** 玩家尝试提取超过托管余额的金额
- **THEN** 合约 revert 并返回 `"Insufficient custody balance"`

#### Scenario: Only owner can settle games
- **WHEN** 非合约 owner 地址调用 `settle(...)` 结算函数
- **THEN** 合约 revert 并返回 `"Only operator"`

---

### Requirement: PokerGame0G Contract — Game Settlement

系统 SHALL 通过 PokerGame0G 合约执行链上游戏结算。

#### Scenario: Single winner settlement
- **WHEN** 合约 owner 调用 `settle(handId, winners[], amounts[], totalPot, rake, stateHash)`
- **AND** 所有参数有效（amounts 总和 + rake <= totalPot）
- **THEN** 合约从各输家托管余额扣款
- **AND** 向赢家分配对应金额
- **AND** 将 rake 转入合约 fee 账户
- **AND** 触发 `Settled(uint256 handId, address[] winners, uint256[] amounts)` 事件

#### Scenario: Multi-winner split pot
- **WHEN** 结算参数包含多个赢家（平局场景）
- **THEN** 合约按 amounts 数组分别分配给每个赢家
- **AND** 总分配金额不超过底池总额

#### Scenario: Invalid settlement rejected
- **WHEN** owner 尝试提交无效结算（amounts 总和 > pot）
- **THEN** 合约 revert 并返回 `"Invalid settlement: amounts exceed pot"`

#### Scenario: State hash anchoring
- **WHEN** 调用 `settle(...)` 时传入 `stateHash`
- **THEN** 合约记录该 handId 对应的 stateHash
- **AND** 可通过 `getHandStateHash(uint256 handId)` 查询

---

### Requirement: PokerGame0G Contract — Authorization System

系统 SHALL 实现代理授权机制，允许服务器代理玩家执行合约操作。

#### Scenario: Player authorize server delegate
- **WHEN** 玩家调用 `authorizeDelegate(address serverAddress)`
- **THEN** 合约记录该玩家已授权 serverAddress 为代理
- **AND** 触发 `DelegateAuthorized(address player, address delegate)` 事件

#### Scenario: Revoke authorization
- **WHEN** 玩家调用 `revokeDelegate()`
- **THEN** 移除代理授权
- **AND** 之后服务器无法代理该玩家操作

#### Scenario: Server executes on behalf
- **WHEN** 已授权的服务器调用 `executeDepositFor(player, amount)`
- **AND** 玩家当前已授权
- **THEN** 合约视为玩家本人操作执行存款
- **AND** 扣款来源为玩家地址（需提前 approve）

---

### Requirement: PokerHandINFT Contract — ERC-721 Base

系统 SHALL 部署 PokerHandINFT 合约实现 ERC-721 标准 NFT。

#### Scenario: Mint INFT
- **WHEN** MINTER_ROLE 角色调用 `mint(to, handType, storageRootHash, metadataURI)`
- **THEN** 合约铸造一个新的 ERC-721 token 给 `to` 地址
- **AND** tokenId 自增（从 1 开始）
- **AND** 存储 PokerHandData 结构体
- **AND** 触发 `Transfer(address(0), to, tokenId)` 事件
- **AND** 触发 `PokerHandMinted(tokenId, handType, to)` 事件

#### Scenario: Query token data
- **WHEN** 调用 `getPokerData(tokenId)`
- **THEN** 返回 `(handType, storageRootHash, metadataURI, timestamp, aiAgent, isEncrypted)`

#### Scenario: Token URI references 0G Storage
- **WHEN** 调用 `tokenURI(tokenId)`
- **THEN** 返回该 token 对应的 metadataURI
- **AND** URI 格式支持 0G Storage 引用或 HTTP(S) URL

---

### Requirement: PokerHandINFT Contract — ERC-7857 INFT Features

系统 SHALL 实现 INFT（智能 NFT）标准功能：加密转移、克隆、Agent 绑定。

#### Scenario: Encrypted transfer
- **WHEN** token 持有者调用 `encryptedTransfer(to, encryptedMetadata)`
- **AND** `to` 地址有效
- **THEN** token 所有权转移至 `to`
- **AND** 加密元数据存储在合约内
- **AND** 只有 `to` 能用私钥解密查看
- **AND** 触发 `EncryptedTransfer(from, to, tokenId)` 事件

#### Scenario: Clone INFT
- **WHEN** token 持有者或授权地址调用 `clone(newOwner)`
- **THEN** 创建新的 token（新 tokenId）给 `newOwner`
- **AND** 新 token 复制原 token 的 handType 和 metadata 结构
- **AND** 保持原 token 不变
- **AND** 触发 `Cloned(originalTokenId, newTokenId, newOwner)` 事件

#### Scenario: Bind AI Agent
- **WHEN** token 持有者调用 `bindAgent(agentAddress)`
- **AND** `agentAddress` 是有效地址
- **THEN** 将该 token 关联到指定的 AI Agent 地址
- **AND** AI Agent 可代表该 NFT 参与特定游戏活动
- **AND** 触发 `AgentBound(tokenId, agentAddress)` 事件

#### Scenario: Unbind AI Agent
- **WHEN** token 持有者调用 `unbindAgent()`
- **THEN** 移除该 token 的 AI Agent 绑定
- **AND** `aiAgent` 字段设为 `address(0)`

---

### Requirement: Contract Deployment and Configuration

系统 SHALL 提供部署脚本和配置管理工具。

#### Scenario: Deploy to 0G testnet
- **WHEN** 执行 `node deploy-0g.js --network testnet`
- **THEN** 部署 PokerGame0G 到 0G testnet（Chain ID: 16602）
- **AND** 部署 PokerHandINFT 到同一网络
- **AND** 设置初始 MINTER_ROLE 和 OPERATOR_ROLE
- **AND** 输出合约地址和部署 TX hash 到控制台和 deployments/ 目录

#### Scenario: Verify contracts
- **WHEN** 执行配置的 verify 脚本
- **THEN** 在 0G 区块链浏览器上验证合约源码
- **AND** 显示绿色 verified 标识

#### Scenario: Environment-based addresses
- **WHEN** ZeroGContractService.init() 被调用
- **THEN** 根据 `ZEROG_NETWORK` 环境变量选择合约地址：
  - `testnet`: 使用 `ZEROG_TESTNET_CONTRACT_ADDRESSES`
  - `mainnet`: 使用 `ZEROG_MAINNET_CONTRACT_ADDRESSES`

---

### Requirement: Contract Event Listening

系统 SHALL 监听 0G 链上合约事件并更新数据库状态。

#### Scenario: Listen to Deposit events
- **WHEN** PokerGame0G 合约触发 Deposited 事件
- **THEN** ZeroGEventListener 自动捕获
- **AND** 更新 MongoDB 中对应玩家的余额记录

#### Scenario: Listen to Settlement events
- **WHEN** PokerGame0G 合约触发 Settled 事件
- **THEN** 更新对应 handId 的结算状态为 `confirmed_onchain`
- **AND** 推送通知给受影响玩家

#### Scenario: Listen to NFT Mint events
- **WHEN** PokerHandINFT 合约触发 PokerHandMinted 事件
- **THEN** 更新 MongoDB nft_claims 记录的 onchain_status 为 `minted`
- **AND** 记录实际的 tokenId
