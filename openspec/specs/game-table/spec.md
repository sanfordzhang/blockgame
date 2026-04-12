# Specification: Game Table (Modified)

## Overview

扩展现有游戏桌功能，支持锦标赛模式和增强的断线/超时处理。

---

## MODIFIED Requirements

### Requirement: Table Class Inheritance

系统 SHALL 支持TournamentTable继承Table类，复用现有游戏逻辑。

#### Scenario: TournamentTable extends Table
- **WHEN** 创建锦标赛游戏桌
- **THEN** TournamentTable继承Table的所有方法
- **AND** 可重写特定方法（如endHand）

#### Scenario: Reuse core game logic
- **WHEN** TournamentTable执行游戏逻辑
- **THEN** 复用Table的以下方法：
  - startHand()
  - handleFold()
  - handleCall()
  - handleCheck()
  - handleRaise()
  - determineWinner()

---

### Requirement: Player Elimination Detection

系统 SHALL 在每手牌结束时检测淘汰玩家。

#### Scenario: Detect eliminated player
- **WHEN** 手牌结束（endHand被调用）
- **AND** 某玩家stack降为0
- **THEN** 该玩家被标记为淘汰
- **AND** 记录淘汰时间和位置

#### Scenario: Multiple players eliminated same hand
- **WHEN** 多名玩家在同手牌中被淘汰
- **THEN** 所有淘汰玩家被记录
- **AND** 按筹码排序确定淘汰顺序

---

### Requirement: Timeout and Time Bank

系统 SHALL 支持行动超时和时间银行机制。

#### Scenario: Action timeout trigger
- **WHEN** 玩家在15秒内未行动
- **AND** 玩家有时间银行余额
- **THEN** 开始使用时间银行

#### Scenario: Time bank countdown
- **WHEN** 玩家正在使用时间银行
- **THEN** 时间银行余额按秒递减
- **AND** 若玩家在时间内行动，停止计时

#### Scenario: Auto-fold after time bank exhausted
- **WHEN** 玩家时间银行余额降为0
- **AND** 仍未行动
- **THEN** 自动执行Fold操作

#### Scenario: Time bank initialization
- **WHEN** 玩家入座
- **THEN** 时间银行初始化为60秒

---

### Requirement: Disconnect Auto-Fold

系统 SHALL 在玩家断线时自动Fold。

#### Scenario: Immediate fold on disconnect
- **WHEN** 玩家断开Socket连接
- **AND** 当前轮到该玩家行动
- **THEN** 立即执行Fold操作
- **AND** 不使用时间银行

#### Scenario: Disconnect when not player's turn
- **WHEN** 玩家断开Socket连接
- **AND** 当前不是该玩家的行动回合
- **THEN** 不立即Fold
- **AND** 轮到该玩家时触发超时流程

---

## ADDED Requirements

### Requirement: Tournament Table State

系统 SHALL 为锦标赛桌维护额外状态。

#### Scenario: Tournament table properties
- **WHEN** 创建TournamentTable实例
- **THEN** 初始化以下属性：
  - tournamentId: 锦标赛ID
  - initialChips: 初始筹码
  - eliminatedPlayers: 淘汰玩家列表
  - actionTimeout: 行动超时（15秒）
  - timeBank: 时间银行（60秒）

#### Scenario: Fixed blinds (MVP)
- **WHEN** 锦标赛进行中
- **THEN** 盲注保持固定值
- **AND** 不随时间递增

---

### Requirement: Elimination Callback

系统 SHALL 支持淘汰事件回调。

#### Scenario: On elimination callback
- **WHEN** 玩家被淘汰
- **THEN** 触发 onElimination 回调
- **AND** 传递淘汰玩家信息和剩余玩家列表

#### Scenario: On tournament end callback
- **WHEN** 锦标赛只剩1名玩家
- **THEN** 触发 onTournamentEnd 回调
- **AND** 传递最终排名

---

### Requirement: Final Rankings Calculation

系统 SHALL 计算锦标赛最终排名。

#### Scenario: Calculate rankings
- **WHEN** 锦标赛结束
- **THEN** 按淘汰顺序的逆序计算排名：
  - 最后剩余玩家 = 第1名
  - 最后被淘汰 = 第2名
  - 倒数第二被淘汰 = 第3名
  - 以此类推

#### Scenario: Tie-breaking for same-hand elimination
- **WHEN** 多名玩家在同手牌被淘汰
- **THEN** 按该手牌开始时的筹码量排序
- **AND** 筹码少的排名靠后
