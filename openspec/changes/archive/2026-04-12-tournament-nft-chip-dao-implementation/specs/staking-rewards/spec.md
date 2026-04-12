# Specification: Staking Rewards

## Overview

CHIP质押系统，玩家质押CHIP获得平台分红，支持锁定期和提前解押罚金。

---

## ADDED Requirements

### Requirement: Stake CHIP

系统 SHALL 允许玩家质押CHIP代币。

#### Scenario: Successful stake with valid parameters
- **WHEN** 玩家调用 `stake(amount, lockDuration)`
- **AND** amount >= 最小质押量（100 CHIP）
- **AND** lockDuration在7天-365天之间
- **AND** 玩家已授权合约足够CHIP
- **THEN** CHIP从玩家转入质押合约
- **AND** 记录质押信息（金额、开始时间、锁定期）
- **AND** 总质押量增加
- **AND** 触发 `Staked` 事件

#### Scenario: Reject stake below minimum
- **WHEN** 玩家质押金额小于100 CHIP
- **THEN** 交易失败并返回错误 "Below minimum"

#### Scenario: Reject lock duration too short
- **WHEN** lockDuration < 7天
- **THEN** 交易失败并返回错误 "Lock too short"

#### Scenario: Reject lock duration too long
- **WHEN** lockDuration > 365天
- **THEN** 交易失败并返回错误 "Lock too long"

---

### Requirement: Unstake CHIP

系统 SHALL 允许玩家解除质押。

#### Scenario: Unstake after lock period
- **WHEN** 玩家调用 `unstake(amount)`
- **AND** 当前时间超过锁定到期时间
- **AND** 质押金额充足
- **THEN** CHIP退还给玩家
- **AND** 无罚金
- **AND** 总质押量减少
- **AND** 触发 `Unstaked` 事件（penalty=0）

#### Scenario: Early unstake with penalty
- **WHEN** 玩家调用 `unstake(amount)`
- **AND** 当前时间未超过锁定到期时间
- **THEN** 10%罚金从解押金额扣除
- **AND** 剩余90%退还给玩家
- **AND** 罚金进入奖励池
- **AND** 触发 `Unstaked` 事件（penalty=10%）

#### Scenario: Unstake insufficient stake
- **WHEN** 玩家尝试解押金额超过质押余额
- **THEN** 交易失败并返回错误 "Insufficient stake"

---

### Requirement: Reward Distribution

系统 SHALL 分配质押奖励给质押者。

#### Scenario: Platform adds reward
- **WHEN** 平台调用 `addReward(amount)`
- **AND** 已授权合约足够CHIP
- **THEN** CHIP进入奖励池
- **AND** 更新每代币累积奖励
- **AND** 触发 `RewardAdded` 事件

#### Scenario: Reward calculation
- **GIVEN** 奖励池有新奖励注入
- **WHEN** 计算累积奖励
- **THEN** `rewardPerToken += (奖励金额 * 10^18) / 总质押量`

---

### Requirement: Claim Reward

系统 SHALL 允许质押者领取累积奖励。

#### Scenario: Successful claim
- **WHEN** 质押者调用 `claimReward()`
- **AND** 有待领取奖励
- **THEN** 奖励CHIP转账给质押者
- **AND** 清零待领取奖励
- **AND** 触发 `RewardClaimed` 事件

#### Scenario: No reward to claim
- **WHEN** 质押者调用 `claimReward()`
- **AND** 无待领取奖励
- **THEN** 交易失败并返回错误 "No reward"

---

### Requirement: Pending Reward Query

系统 SHALL 提供待领取奖励查询。

#### Scenario: Query pending reward
- **WHEN** 查询 `getPendingReward(address)`
- **THEN** 返回该地址的待领取奖励金额（包括已累积但未领取部分）

#### Scenario: Query with no stake
- **WHEN** 查询未质押地址的待领取奖励
- **THEN** 返回0

---

### Requirement: Stake Info Query

系统 SHALL 提供质押信息查询。

#### Scenario: Query stake info
- **WHEN** 查询 `getStakeInfo(address)`
- **THEN** 返回：
  - amount: 质押金额
  - startTime: 开始时间
  - lockedUntil: 锁定到期时间
  - isLocked: 是否仍在锁定期

---

### Requirement: Reward Update on Action

系统 SHALL 在质押/解押/领取时更新奖励状态。

#### Scenario: Update reward on stake
- **WHEN** 玩家质押CHIP
- **THEN** 先更新玩家的累积奖励
- **AND** 记录当前 `rewardPerToken` 作为基准

#### Scenario: Update reward on unstake
- **WHEN** 玩家解押CHIP
- **THEN** 先更新玩家的累积奖励
- **AND** 减少质押金额

#### Scenario: Update reward on claim
- **WHEN** 玩家领取奖励
- **THEN** 计算并支付所有待领取奖励
- **AND** 重置待领取奖励为0

---

### Requirement: VIP Status from Staking

系统 SHALL 根据质押状态授予VIP特权。

#### Scenario: VIP from staking
- **GIVEN** 玩家质押10,000 CHIP以上
- **WHEN** 查询VIP状态
- **THEN** 玩家被视为VIP
- **AND** 获得20%抽水折扣

#### Scenario: VIP lost after unstake
- **GIVEN** 玩家原为VIP（质押>=10,000 CHIP）
- **WHEN** 玩家解押导致质押余额低于10,000 CHIP
- **THEN** 玩家失去VIP身份

---

### Requirement: Multiple Stakes

**Note**: MVP版本每个地址只支持单笔质押。

#### Scenario: Single stake per address
- **WHEN** 玩家已有质押记录时再次质押
- **THEN** 新金额累加到现有质押
- **AND** 锁定期重置为新的设置

---

### Requirement: Contract Pause

系统 SHALL 支持质押合约紧急暂停。

#### Scenario: Pause staking
- **WHEN** 所有者调用 `pause()`
- **THEN** 新质押操作被阻止
- **AND** 解押和领取奖励仍可执行
