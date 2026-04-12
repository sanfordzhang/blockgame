# Specification: User Wallet (Modified)

## Overview

扩展现有钱包功能，集成CHIP代币余额、质押状态和VIP特权查询。

---

## ADDED Requirements

### Requirement: CHIP Balance Query

系统 SHALL 支持查询用户CHIP代币余额。

#### Scenario: Query CHIP balance
- **WHEN** 调用钱包查询接口 `/api/wallet/balance`
- **THEN** 返回：
  - trx: TRX余额
  - chip: CHIP代币余额
  - chipStaked: 质押中的CHIP

#### Scenario: Real-time balance update
- **WHEN** 用户CHIP余额变化
- **THEN** 通过Socket推送 `wallet:balance_update`
- **AND** 包含最新的CHIP余额

---

### Requirement: Staking Status Query

系统 SHALL 支持查询用户质押状态。

#### Scenario: Query staking info
- **WHEN** 调用 `/api/stake/info`
- **THEN** 返回：
  - amount: 质押金额
  - startTime: 开始时间
  - lockedUntil: 锁定到期时间
  - isLocked: 是否仍在锁定期
  - pendingReward: 待领取奖励

#### Scenario: No active stake
- **WHEN** 用户无质押记录
- **THEN** 返回空数据：
  - amount: 0
  - pendingReward: 0

---

### Requirement: VIP Status Query

系统 SHALL 支持查询用户VIP状态。

#### Scenario: Query VIP status
- **WHEN** 调用 `/api/user/vip`
- **THEN** 返回：
  - isVIP: 是否为VIP
  - reason: VIP来源 (chip_balance/staking)
  - discount: 抽水折扣比例 (0-20%)

#### Scenario: VIP from CHIP holding
- **WHEN** 用户CHIP余额 >= 10,000
- **THEN** isVIP = true
- **AND** reason = "chip_balance"
- **AND** discount = 20%

#### Scenario: VIP from staking
- **WHEN** 用户质押CHIP >= 10,000
- **THEN** isVIP = true
- **AND** reason = "staking"
- **AND** discount = 20%

#### Scenario: Non-VIP user
- **WHEN** 用户CHIP余额 < 10,000 且质押 < 10,000
- **THEN** isVIP = false
- **AND** discount = 0%

---

### Requirement: NFT Collection Query

系统 SHALL 支持查询用户NFT收藏。

#### Scenario: Query user NFTs
- **WHEN** 调用 `/api/nft/user/{address}`
- **THEN** 返回NFT列表，每项包含：
  - tokenId: NFT ID
  - achievementType: 成就类型
  - rarity: 稀有度
  - mintedAt: 铸造时间
  - tokenURI: 元数据链接

#### Scenario: No NFTs owned
- **WHEN** 用户无NFT
- **THEN** 返回空列表

---

### Requirement: Transaction History

系统 SHALL 支持查询用户交易历史。

#### Scenario: Query CHIP transactions
- **WHEN** 调用 `/api/chip/transactions`
- **THEN** 返回CHIP相关交易记录：
  - type: 交易类型 (reward/stake/unstake/claim)
  - amount: 金额
  - timestamp: 时间
  - txHash: 链上交易哈希

#### Scenario: Query tournament history
- **WHEN** 调用 `/api/tournament/history`
- **THEN** 返回锦标赛参与记录：
  - tournamentId
  - buyIn: 买入金额
  - position: 最终排名
  - prize: 奖金
  - timestamp

---

### Requirement: Wallet Overview

系统 SHALL 提供钱包总览接口。

#### Scenario: Wallet overview
- **WHEN** 调用 `/api/wallet/overview`
- **THEN** 返回完整钱包信息：
  ```json
  {
    "trx": "123.45",
    "chip": "10000",
    "chipStaked": "5000",
    "pendingReward": "150",
    "isVIP": true,
    "nftCount": 5,
    "tournamentWins": 3
  }
  ```

---

## MODIFIED Requirements

### Requirement: Balance Display

系统 SHALL 在前端统一展示所有资产。

#### Scenario: Header balance display
- **WHEN** 用户登录后
- **THEN** 页面头部显示：
  - TRX余额
  - CHIP余额
  - VIP徽章（如果是VIP）

#### Scenario: Wallet page display
- **WHEN** 用户访问钱包页面
- **THEN** 显示详细资产信息：
  - TRX余额与充值/提现按钮
  - CHIP余额
  - 质押中的CHIP
  - 待领取奖励
  - NFT收藏入口
  - 交易历史入口

---

### Requirement: Deposit Flow (Enhanced)

系统 SHALL 增强充值流程，支持CHIP显示。

#### Scenario: Deposit TRX
- **WHEN** 用户充值TRX
- **THEN** 更新TRX余额
- **AND** 推送余额更新事件

#### Scenario: Receive CHIP reward
- **WHEN** 用户通过游戏获得CHIP奖励
- **THEN** 更新CHIP余额
- **AND** 推送 `chip:reward` 事件
