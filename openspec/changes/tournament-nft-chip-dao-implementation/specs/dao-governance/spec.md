# Specification: DAO Governance

## Overview

DAO治理系统，CHIP持有者可创建提案、投票决策，实现社区自治。

---

## ADDED Requirements

### Requirement: Proposal Creation

系统 SHALL 允许CHIP持有者创建治理提案。

#### Scenario: Create proposal with sufficient CHIP
- **WHEN** CHIP持有者调用 `createProposal(pType, description, target, callData)`
- **AND** 持有量 >= 提案门槛（1000 CHIP）
- **THEN** 创建新提案
- **AND** 提案状态为 PENDING
- **AND** 投票开始时间 = 当前时间 + 投票延迟（1天）
- **AND** 投票结束时间 = 投票开始时间 + 投票期（3天）
- **AND** 触发 `ProposalCreated` 事件

#### Scenario: Reject proposal below threshold
- **WHEN** CHIP持有量 < 1000 CHIP
- **AND** 尝试创建提案
- **THEN** 交易失败并返回错误 "Below threshold"

---

### Requirement: Proposal Types

系统 SHALL 支持多种提案类型。

#### Scenario: Supported proposal types
- **GIVEN** 系统定义的提案类型
- **WHEN** 创建提案时选择类型
- **THEN** 可选择以下类型：
  - RAKE_RATE (0): 抽水比例调整
  - NFT_LIMIT (1): NFT限量调整
  - NEW_ACHIEVEMENT (2): 新增成就类型
  - EMERGENCY_PAUSE (3): 紧急暂停

---

### Requirement: Voting

系统 SHALL 允许CHIP持有者对提案投票。

#### Scenario: Cast vote during voting period
- **WHEN** CHIP持有者调用 `castVote(proposalId, support)`
- **AND** 提案状态为 ACTIVE
- **AND** 持有者未对该提案投票
- **AND** 持有者有CHIP余额
- **THEN** 记录投票：
  - support: 0=反对, 1=支持, 2=弃权
  - weight: 持有者的CHIP余额
- **AND** 更新提案的赞成/反对/弃权票数
- **AND** 触发 `Voted` 事件

#### Scenario: Reject vote before voting starts
- **WHEN** 投票期尚未开始
- **THEN** 交易失败并返回错误 "Not started"

#### Scenario: Reject vote after voting ends
- **WHEN** 投票期已结束
- **THEN** 交易失败并返回错误 "Ended"

#### Scenario: Reject duplicate vote
- **WHEN** 持有者已对该提案投票
- **AND** 尝试再次投票
- **THEN** 交易失败并返回错误 "Already voted"

#### Scenario: Reject vote with no CHIP
- **WHEN** 持有者CHIP余额为0
- **AND** 尝试投票
- **THEN** 交易失败并返回错误 "No voting power"

#### Scenario: Reject invalid support value
- **WHEN** support参数不在0-2范围内
- **THEN** 交易失败并返回错误 "Invalid support"

---

### Requirement: Quorum Requirement

系统 SHALL 要求提案达到法定人数才能通过。

#### Scenario: Check quorum on voting end
- **WHEN** 投票期结束
- **AND** 总票数（赞成+反对+弃权）>= 总供应量 * 10%
- **THEN** 法定人数达标

#### Scenario: Proposal fails without quorum
- **WHEN** 投票期结束
- **AND** 总票数 < 法定人数要求
- **THEN** 提案状态变为 DEFEATED

---

### Requirement: Proposal State Transitions

系统 SHALL 管理提案状态流转。

#### Scenario: Pending state
- **WHEN** 提案刚创建
- **AND** 当前时间 < 投票开始时间
- **THEN** 提案状态为 PENDING

#### Scenario: Active state
- **WHEN** 当前时间 >= 投票开始时间
- **AND** 当前时间 < 投票结束时间
- **THEN** 提案状态为 ACTIVE

#### Scenario: Succeeded state
- **WHEN** 投票期结束
- **AND** 法定人数达标
- **AND** 赞成票 > 反对票
- **THEN** 提案状态为 SUCCEEDED

#### Scenario: Defeated state
- **WHEN** 投票期结束
- **AND** （法定人数未达标 OR 赞成票 <= 反对票）
- **THEN** 提案状态为 DEFEATED

#### Scenario: Executed state
- **WHEN** 成功提案被执行
- **THEN** 提案状态为 EXECUTED

#### Scenario: Expired state
- **WHEN** 提案执行失败
- **THEN** 提案状态为 EXPIRED

---

### Requirement: Proposal Execution

系统 SHALL 允许任何人执行成功的提案。

#### Scenario: Execute successful proposal
- **WHEN** 任何人调用 `executeProposal(proposalId)`
- **AND** 提案状态为 SUCCEEDED
- **THEN** 执行提案的 callData 调用目标合约
- **AND** 提案状态变为 EXECUTED
- **AND** 触发 `ProposalExecuted` 事件

#### Scenario: Reject execution of defeated proposal
- **WHEN** 尝试执行 DEFEATED 状态的提案
- **THEN** 交易失败并返回错误 "Proposal not passed"

#### Scenario: Reject duplicate execution
- **WHEN** 尝试执行已执行的提案
- **THEN** 交易失败并返回错误 "Already executed"

---

### Requirement: Proposal Query

系统 SHALL 提供提案信息查询。

#### Scenario: Query proposal info
- **WHEN** 查询 `getProposalInfo(proposalId)`
- **THEN** 返回：
  - pType: 提案类型
  - description: 描述
  - startTime: 投票开始时间
  - endTime: 投票结束时间
  - forVotes: 赞成票数
  - againstVotes: 反对票数
  - abstainVotes: 弃权票数
  - state: 当前状态
  - executed: 是否已执行

#### Scenario: Query proposal state
- **WHEN** 查询 `getProposalState(proposalId)`
- **THEN** 返回当前状态

#### Scenario: Query vote record
- **WHEN** 查询 `hasVoted(proposalId, voter)`
- **THEN** 返回：
  - hasVoted: 是否已投票
  - support: 投票立场
  - weight: 投票权重

---

### Requirement: Rake Rate Adjustment Proposal

系统 SHALL 通过DAO治理调整抽水比例。

#### Scenario: Create rake rate proposal
- **GIVEN** 当前抽水比例为5%
- **WHEN** CHIP持有者创建 RAKE_RATE 类型提案
- **AND** 描述为 "Adjust rake rate to 3%"
- **AND** callData 编码为 `setRakeRate(300)` 调用
- **THEN** 提案创建成功

#### Scenario: Execute rake rate change
- **WHEN** 抽水调整提案通过并执行
- **THEN** 调用目标合约的 setRakeRate 方法
- **AND** 抽水比例更新为新值

#### Scenario: Reject rake rate above 10%
- **GIVEN** 抽水上限为10%
- **WHEN** 提案尝试将抽水设为15%
- **THEN** 目标合约拒绝设置

---

### Requirement: Governance Parameters

系统 SHALL 可配置治理参数。

#### Scenario: Default parameters
- **GIVEN** 系统初始化
- **WHEN** 查询治理参数
- **THEN** 默认值为：
  - votingDelay: 1天
  - votingPeriod: 3天
  - quorumThreshold: 10%
  - proposalThreshold: 1000 CHIP

#### Scenario: Admin update parameters
- **WHEN** 所有者调用参数设置方法
- **THEN** 参数更新为新值

#### Scenario: Quorum threshold limit
- **WHEN** 尝试设置 quorumThreshold > 50%
- **THEN** 交易失败并返回错误 "Max 50%"

---

### Requirement: Vote Weighting

系统 SHALL 按CHIP余额计算投票权重。

#### Scenario: Vote weight equals CHIP balance
- **WHEN** 玩家投票时
- **THEN** 投票权重 = 该玩家的CHIP余额

#### Scenario: No delegation
- **GIVEN** MVP版本不支持委托
- **WHEN** 玩家A尝试委托给玩家B
- **THEN** 操作不可用

---

### Requirement: DAO Service Events

系统 SHALL 通过Socket推送DAO相关事件。

#### Scenario: Notify new proposal
- **WHEN** 新提案创建
- **THEN** 推送 `dao:proposal_created` 事件给所有CHIP持有者

#### Scenario: Notify voting period start
- **WHEN** 提案进入投票期
- **THEN** 推送 `dao:voting_started` 事件

#### Scenario: Notify proposal result
- **WHEN** 投票期结束
- **THEN** 推送 `dao:proposal_result` 事件
- **AND** 包含最终票数和状态
