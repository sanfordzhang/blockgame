# Specification: Tournament System

## Overview

Sit & Go 锦标赛系统，支持2/3/6人满员即开和9人定时启动模式，实现链上奖金自动分配。

---

## ADDED Requirements

### Requirement: Tournament Creation

系统 SHALL 允许服务端创建锦标赛实例，指定锦标赛配置。

#### Scenario: Create tournament with valid config
- **WHEN** 服务端调用 `createTournament(configId)` 创建锦标赛
- **THEN** 系统返回新的 tournamentId
- **AND** 锦标赛状态设置为 WAITING

#### Scenario: Create tournament with invalid config
- **WHEN** 服务端使用不存在的 configId 创建锦标赛
- **THEN** 系统拒绝创建并返回错误 "Invalid config"

---

### Requirement: Player Join Tournament

系统 SHALL 允许注册玩家报名参与锦标赛，支付买入金额。

#### Scenario: Successful join with correct buy-in
- **WHEN** 玩家调用 `joinTournament(tournamentId)` 并支付正确的买入金额
- **THEN** 玩家被添加到锦标赛参与者列表
- **AND** 玩家的买入金额加入奖池
- **AND** 触发 `PlayerJoined` 事件

#### Scenario: Reject join when already in tournament
- **WHEN** 玩家已参与某个锦标赛时尝试报名另一个锦标赛
- **THEN** 系统拒绝报名并返回错误 "Already in tournament"

#### Scenario: Reject join with wrong buy-in
- **WHEN** 玩家支付的金额与配置的买入金额不符
- **THEN** 系统拒绝报名并返回错误 "Wrong buy-in amount"

#### Scenario: Reject join when tournament not waiting
- **WHEN** 锦标赛状态不是 WAITING 时玩家尝试报名
- **THEN** 系统拒绝报名并返回错误 "Not waiting"

---

### Requirement: Tournament Auto-Start (Instant Mode)

系统 SHALL 在满员即开模式下，当报名人数达到配置的人数时自动开始锦标赛。

#### Scenario: Auto-start when full (2-player)
- **WHEN** 2人锦标赛的报名人数达到2人
- **THEN** 锦标赛状态变更为 IN_PROGRESS
- **AND** 触发 `TournamentStarted` 事件
- **AND** 计算抽水并从奖池扣除

#### Scenario: Auto-start when full (6-player)
- **WHEN** 6人锦标赛的报名人数达到6人
- **THEN** 锦标赛状态变更为 IN_PROGRESS
- **AND** 触发 `TournamentStarted` 事件

#### Scenario: Auto-start when full (9-player)
- **WHEN** 9人锦标赛的报名人数达到9人
- **THEN** 锦标赛状态变更为 IN_PROGRESS
- **AND** 触发 `TournamentStarted` 事件

---

### Requirement: Tournament Scheduled Start (Timed Mode)

系统 SHALL 在定时启动模式下，支持服务端手动开始或超时取消锦标赛。

#### Scenario: Manual start by server
- **WHEN** 服务端调用 `startTournament(tournamentId)`
- **AND** 锦标赛至少有2名玩家
- **THEN** 锦标赛状态变更为 IN_PROGRESS

#### Scenario: Reject start with insufficient players
- **WHEN** 服务端尝试开始只有1名玩家的锦标赛
- **THEN** 系统拒绝开始并返回错误 "Not enough players"

#### Scenario: Timeout cancellation
- **WHEN** 定时赛等待时间超过 waitTimeout（如5分钟）
- **AND** 报名人数未满
- **THEN** 服务端调用 `cancelTournament(tournamentId)`
- **AND** 所有已报名玩家获得退款
- **AND** 锦标赛状态变更为 CANCELLED
- **AND** 触发 `TournamentCancelled` 事件

---

### Requirement: Cancel Tournament Join

系统 SHALL 允许玩家在锦标赛开始前取消报名并获退款。

#### Scenario: Successful cancel before start
- **WHEN** 玩家调用 `cancelJoin(tournamentId)`
- **AND** 锦标赛状态为 WAITING
- **AND** 玩家已报名
- **THEN** 玩家从参与者列表移除
- **AND** 买入金额退还给玩家
- **AND** 奖池减去该玩家的买入金额

#### Scenario: Reject cancel after tournament started
- **WHEN** 玩家尝试取消已开始锦标赛的报名
- **THEN** 系统拒绝取消并返回错误 "Already started"

---

### Requirement: Tournament Gameplay

系统 SHALL 使用 TournamentTable 执行锦标赛游戏，继承现有 Table.js 游戏逻辑。

#### Scenario: Fixed initial chips
- **WHEN** 锦标赛开始时玩家入座
- **THEN** 每位玩家获得配置的初始筹码（如1000）
- **AND** 筹码不可添加（不可rebuy）

#### Scenario: Fixed blinds (MVP)
- **WHEN** 锦标赛进行中
- **THEN** 盲注保持固定，不随时间递增

#### Scenario: Player elimination detection
- **WHEN** 玩家的筹码降至0
- **THEN** 该玩家被标记为淘汰
- **AND** 从剩余玩家中移除
- **AND** 记录淘汰顺序

#### Scenario: Tournament ends with one player remaining
- **WHEN** 只剩1名玩家有筹码
- **THEN** 锦标赛游戏结束
- **AND** 该玩家为冠军

---

### Requirement: Tournament Timeout and Disconnect

系统 SHALL 处理玩家超时和断线情况。

#### Scenario: Action timeout uses time bank
- **WHEN** 玩家在15秒内未行动
- **AND** 玩家仍有时间银行余额（60秒）
- **THEN** 开始使用时间银行

#### Scenario: Auto-fold after time bank exhausted
- **WHEN** 玩家时间银行耗尽后仍未行动
- **THEN** 系统自动执行 Fold 操作

#### Scenario: Disconnect auto-fold
- **WHEN** 玩家断开连接
- **AND** 当前轮到该玩家行动
- **THEN** 系统立即执行 Fold 操作（不使用时间银行）

---

### Requirement: Tournament Finish

系统 SHALL 允许服务端提交最终排名并分配奖金。

#### Scenario: Submit rankings and distribute prizes
- **WHEN** 服务端调用 `finishTournament(tournamentId, rankings)`
- **AND** 锦标赛状态为 IN_PROGRESS
- **THEN** 锦标赛状态变更为 COMPLETED
- **AND** 根据配置的奖金分配比例计算每位玩家的奖金
- **AND** 奖金记录到玩家的 `pendingPrizes`
- **AND** 抽水发送到服务端钱包
- **AND** 触发 `TournamentFinished` 事件

#### Scenario: Prize distribution for 2-player tournament
- **GIVEN** 2人锦标赛配置奖金比例为 [50%, 50%]
- **WHEN** 锦标赛结束
- **THEN** 第1名获得50%奖池
- **AND** 第2名获得50%奖池

#### Scenario: Prize distribution for 9-player tournament
- **GIVEN** 9人锦标赛配置奖金比例为 [50%, 30%, 20%]
- **WHEN** 锦标赛结束
- **THEN** 第1名获得50%奖池
- **AND** 第2名获得30%奖池
- **AND** 第3名获得20%奖池
- **AND** 第4-9名无奖金

---

### Requirement: Claim Prize

系统 SHALL 允许玩家领取锦标赛奖金。

#### Scenario: Successful prize claim
- **WHEN** 玩家调用 `claimPrize()`
- **AND** 玩家有待领取奖金
- **THEN** 奖金转账到玩家地址
- **AND** 清零玩家的 `pendingPrizes`
- **AND** 触发 `PrizeClaimed` 事件

#### Scenario: No prize to claim
- **WHEN** 玩家调用 `claimPrize()`
- **AND** 玩家无待领取奖金
- **THEN** 系统返回错误 "No prize"

---

### Requirement: Tournament Configuration

系统 SHALL 预设多种锦标赛配置，支持不同人数和买入级别。

#### Scenario: Default configurations on deployment
- **WHEN** 合约部署完成
- **THEN** 系统创建以下默认配置：
  - 2人赛：买入10 TRX，满员即开
  - 3人赛：买入20 TRX，满员即开
  - 6人赛：买入50 TRX，满员即开
  - 9人赛：买入100 TRX，定时启动（5分钟等待）

#### Scenario: Admin adds new configuration
- **WHEN** 合约所有者调用 `addConfig(...)`
- **THEN** 新配置被添加到配置列表
- **AND** 触发 `ConfigCreated` 事件

---

### Requirement: Player Cannot Join Normal Game During Tournament

系统 SHALL 阻止锦标赛参与者同时参与普通游戏。

#### Scenario: Block normal game join during tournament
- **WHEN** 玩家当前参与某个锦标赛
- **AND** 玩家尝试加入普通游戏桌
- **THEN** 系统拒绝并返回错误 "Already in tournament"

#### Scenario: Allow normal game after tournament ends
- **WHEN** 玩家的锦标赛已结束（COMPLETED 或 CANCELLED）
- **THEN** 玩家可以正常加入普通游戏桌
