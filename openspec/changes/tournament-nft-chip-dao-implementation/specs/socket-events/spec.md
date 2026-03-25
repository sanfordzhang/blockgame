# Specification: Socket Events (Modified)

## Overview

扩展现有Socket事件系统，支持锦标赛、NFT、CHIP和DAO相关事件。

---

## ADDED Requirements

### Requirement: Tournament Socket Events

系统 SHALL 支持锦标赛相关的Socket事件。

#### Scenario: Tournament player joined
- **WHEN** 玩家报名锦标赛成功
- **THEN** 向锦标赛房间广播 `tournament:player_joined`
- **AND** 数据包含：tournamentId, playerCount, maxPlayers

#### Scenario: Tournament started
- **WHEN** 锦标赛开始
- **THEN** 向所有参与者广播 `tournament:started`
- **AND** 数据包含：tournamentId, players

#### Scenario: Tournament player eliminated
- **WHEN** 玩家被淘汰
- **THEN** 广播 `tournament:elimination`
- **AND** 数据包含：player, position, remaining

#### Scenario: Tournament finished
- **WHEN** 锦标赛结束
- **THEN** 广播 `tournament:finished`
- **AND** 数据包含：tournamentId, rankings, prizes

#### Scenario: Tournament cancelled
- **WHEN** 定时赛超时取消
- **THEN** 广播 `tournament:cancelled`
- **AND** 数据包含：tournamentId, reason

---

### Requirement: NFT Socket Events

系统 SHALL 支持NFT相关的Socket事件。

#### Scenario: Achievement unlocked
- **WHEN** 玩家达成牌型成就
- **THEN** 向该玩家推送 `nft:achievement_unlocked`
- **AND** 数据包含：
  - achievementType: 成就类型ID
  - handDescription: 牌型描述
  - signatureData: 签名数据（用于铸造）
  - mintPrice: 铸造价格
  - expiresIn: 签名有效期

#### Scenario: Monthly limit reached
- **WHEN** 玩家达成成就但月度限量已满
- **THEN** 向该玩家推送 `nft:limit_reached`
- **AND** 数据包含：achievementType, message

#### Scenario: NFT minted successfully
- **WHEN** 玩家成功铸造NFT
- **THEN** 向该玩家推送 `nft:minted`
- **AND** 数据包含：tokenId, achievementType

---

### Requirement: CHIP Socket Events

系统 SHALL 支持CHIP代币相关的Socket事件。

#### Scenario: Game reward received
- **WHEN** 玩家获得游戏CHIP奖励
- **THEN** 向该玩家推送 `chip:reward`
- **AND** 数据包含：amount, reason (game/tournament)

#### Scenario: Staked CHIP
- **WHEN** 玩家质押CHIP成功
- **THEN** 向该玩家推送 `chip:staked`
- **AND** 数据包含：amount, lockedUntil

#### Scenario: Unstaked CHIP
- **WHEN** 玩家解押CHIP成功
- **THEN** 向该玩家推送 `chip:unstaked`
- **AND** 数据包含：amount, penalty

#### Scenario: Reward claimed
- **WHEN** 玩家领取质押奖励
- **THEN** 向该玩家推送 `chip:reward_claimed`
- **AND** 数据包含：amount

#### Scenario: VIP status change
- **WHEN** 玩家VIP状态变化
- **THEN** 向该玩家推送 `chip:vip_status`
- **AND** 数据包含：isVIP, reason

---

### Requirement: DAO Socket Events

系统 SHALL 支持DAO治理相关的Socket事件。

#### Scenario: New proposal created
- **WHEN** 新提案创建
- **THEN** 向所有CHIP持有者推送 `dao:proposal_created`
- **AND** 数据包含：proposalId, type, description

#### Scenario: Voting period started
- **WHEN** 提案进入投票期
- **THEN** 推送 `dao:voting_started`
- **AND** 数据包含：proposalId, startTime, endTime

#### Scenario: Vote cast
- **WHEN** 玩家投票成功
- **THEN** 向该玩家推送 `dao:voted`
- **AND** 数据包含：proposalId, support, weight

#### Scenario: Proposal result
- **WHEN** 投票期结束
- **THEN** 推送 `dao:proposal_result`
- **AND** 数据包含：
  - proposalId
  - forVotes, againstVotes, abstainVotes
  - state (SUCCEEDED/DEFEATED)

#### Scenario: Proposal executed
- **WHEN** 提案被执行
- **THEN** 推送 `dao:proposal_executed`
- **AND** 数据包含：proposalId, success

---

### Requirement: Game State Events (Enhanced)

系统 SHALL 增强现有游戏状态事件，支持锦标赛模式。

#### Scenario: Game state with tournament info
- **WHEN** 广播游戏状态 `game:state`
- **AND** 当前为锦标赛模式
- **THEN** 数据额外包含：
  - isTournament: true
  - tournamentId
  - initialChips
  - eliminatedPlayers

#### Scenario: Player timeout warning
- **WHEN** 玩家行动超时即将触发
- **THEN** 向该玩家推送 `game:timeout_warning`
- **AND** 数据包含：remainingTime

---

## MODIFIED Requirements

### Requirement: Room Management

系统 SHALL 支持新的房间类型。

#### Scenario: Tournament room
- **WHEN** 玩家报名锦标赛
- **THEN** 玩家加入房间 `tournament:{tournamentId}`

#### Scenario: Table room (existing)
- **WHEN** 玩家入座游戏桌
- **THEN** 玩家加入房间 `table:{tableId}`

#### Scenario: Leave rooms on tournament end
- **WHEN** 锦标赛结束
- **THEN** 所有玩家离开 `tournament:{tournamentId}` 房间
