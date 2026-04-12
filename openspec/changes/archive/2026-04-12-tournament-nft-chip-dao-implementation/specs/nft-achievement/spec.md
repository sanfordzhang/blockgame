# Specification: NFT Achievement System

## Overview

NFT成就徽章系统，玩家在游戏中达成特定牌型时可铸造链上NFT徽章，月度限量机制保证稀缺性。

---

## ADDED Requirements

### Requirement: NFT Achievement Types

系统 SHALL 支持6种牌型成就NFT，每种对应不同的稀有度和月度限量。

#### Scenario: Achievement type configuration
- **GIVEN** 系统初始化完成
- **WHEN** 查询成就类型配置
- **THEN** 存在以下成就类型：

| Type ID | 名称 | 稀有度 | 月限量 | 铸造价格 |
|---------|------|--------|--------|----------|
| 0 | 皇家同花顺 | 传说 | 10 | 5 TRX |
| 1 | 同花顺 | 史诗 | 50 | 5 TRX |
| 2 | 四条 | 稀有 | 200 | 5 TRX |
| 3 | 葫芦 | 普通 | 500 | 5 TRX |
| 4 | 同花 | 普通 | 1000 | 5 TRX |
| 5 | 顺子 | 普通 | 2000 | 5 TRX |

---

### Requirement: Achievement Detection

系统 SHALL 在游戏结束时检测玩家是否达成牌型成就。

#### Scenario: Detect Royal Flush achievement
- **WHEN** 玩家赢得一手牌
- **AND** 牌型为 "Royal Flush"
- **THEN** 系统识别为成就类型 0 (ROYAL_FLUSH)

#### Scenario: Detect Straight Flush achievement
- **WHEN** 玩家赢得一手牌
- **AND** 牌型为 "Straight Flush"
- **THEN** 系统识别为成就类型 1 (STRAIGHT_FLUSH)

#### Scenario: Detect Four of a Kind achievement
- **WHEN** 玩家赢得一手牌
- **AND** 牌型为 "Four of a Kind"
- **THEN** 系统识别为成就类型 2 (FOUR_OF_A_KIND)

#### Scenario: Detect Full House achievement
- **WHEN** 玩家赢得一手牌
- **AND** 牌型为 "Full House"
- **THEN** 系统识别为成就类型 3 (FULL_HOUSE)

#### Scenario: Detect Flush achievement
- **WHEN** 玩家赢得一手牌
- **AND** 牌型为 "Flush"
- **THEN** 系统识别为成就类型 4 (FLUSH)

#### Scenario: Detect Straight achievement
- **WHEN** 玩家赢得一手牌
- **AND** 牌型为 "Straight"
- **THEN** 系统识别为成就类型 5 (STRAIGHT)

#### Scenario: No achievement for other hands
- **WHEN** 玩家赢得一手牌
- **AND** 牌型为其他类型（如三条、两对等）
- **THEN** 系统不触发成就检测

---

### Requirement: Signature Generation

系统 SHALL 为符合条件的玩家生成NFT铸造签名。

#### Scenario: Generate signature for qualified player
- **WHEN** 玩家达成某牌型成就
- **AND** 该成就类型的月度限量未达上限
- **THEN** 系统生成签名数据包含：
  - achievementTypeId
  - timestamp
  - signature
- **AND** 签名有效期为7天

#### Scenario: Reject when monthly limit reached
- **WHEN** 玩家达成某牌型成就
- **AND** 该成就类型的月度限量已达上限
- **THEN** 系统通知玩家 "本月该成就NFT已发完"
- **AND** 不生成签名

---

### Requirement: NFT Minting with Signature

系统 SHALL 验证签名后铸造NFT。

#### Scenario: Successful NFT minting
- **WHEN** 玩家调用 `claimNFT(achievementTypeId, timestamp, signature)`
- **AND** 签名有效（未过期、签名正确）
- **AND** 月度限量未达上限
- **AND** 玩家支付足够的铸造价格（5 TRX）
- **THEN** 系统铸造NFT给玩家
- **AND** 月度铸造计数+1
- **AND** 记录该签名已使用（防止重复铸造）
- **AND** 触发 `AchievementMinted` 事件

#### Scenario: Reject expired signature
- **WHEN** 玩家提交的签名已超过7天有效期
- **THEN** 系统拒绝铸造并返回错误 "Signature expired"

#### Scenario: Reject invalid signature
- **WHEN** 玩家提交的签名验证失败
- **THEN** 系统拒绝铸造并返回错误 "Invalid signature"

#### Scenario: Reject duplicate claim
- **WHEN** 玩家使用相同的签名数据再次铸造
- **THEN** 系统拒绝铸造并返回错误 "Already claimed"

#### Scenario: Reject insufficient payment
- **WHEN** 玩家支付的金额少于铸造价格
- **THEN** 系统拒绝铸造并返回错误 "Insufficient payment"

#### Scenario: Refund excess payment
- **WHEN** 玩家支付的金额超过铸造价格
- **THEN** 系统铸造NFT
- **AND** 退还多余金额给玩家

---

### Requirement: Monthly Limit Mechanism

系统 SHALL 对每种成就类型实施月度限量机制。

#### Scenario: Monthly limit check
- **WHEN** 玩家尝试铸造NFT
- **THEN** 系统检查当前月份该成就类型已铸造数量
- **AND** 若已达月度限量，拒绝铸造

#### Scenario: Monthly limit reset
- **WHEN** 新的月份开始
- **THEN** 所有成就类型的月度计数器重置为0
- **AND** 玩家可以再次铸造该类型NFT

#### Scenario: Query monthly minted count
- **WHEN** 查询 `getCurrentMonthMinted(achievementTypeId)`
- **THEN** 返回当前月份该成就类型已铸造数量

---

### Requirement: NFT Metadata

系统 SHALL 为每个NFT提供元数据URI。

#### Scenario: Token URI generation
- **WHEN** 查询 `tokenURI(tokenId)`
- **THEN** 返回格式为 `https://api.poker-game.com/nft/{achievementTypeId}/{tokenId}`

#### Scenario: Metadata content
- **GIVEN** NFT元数据API
- **WHEN** 访问tokenURI
- **THEN** 返回JSON包含：
  - name: 成就名称
  - description: 成就描述
  - image: NFT图片URL
  - attributes: 稀有度、达成时间等

---

### Requirement: NFT Ownership and Transfer

系统 SHALL 遵循TRC721标准，支持NFT查询和转账。

#### Scenario: Query player NFTs
- **WHEN** 查询玩家的NFT列表
- **THEN** 返回玩家持有的所有NFT tokenId

#### Scenario: Transfer NFT
- **WHEN** NFT持有者调用 `transferFrom(from, to, tokenId)`
- **THEN** NFT所有权转移给新地址
- **AND** 触发 `Transfer` 事件

#### Scenario: Query NFT achievement type
- **WHEN** 查询 `tokenAchievement(tokenId)`
- **THEN** 返回该NFT对应的成就类型

---

### Requirement: Test Mode Support

系统 SHALL 支持测试模式，方便开发者测试NFT铸造。

#### Scenario: Test mode with mock hands
- **GIVEN** 测试模式启用
- **WHEN** 开发者通过测试接口提交特定牌型
- **THEN** 系统触发对应的成就检测
- **AND** 可生成测试签名用于铸造

#### Scenario: Test mode disabled in production
- **GIVEN** 生产环境
- **WHEN** 检测到测试模式请求
- **THEN** 系统拒绝请求

---

### Requirement: NFT Service Events

系统 SHALL 通过Socket推送NFT相关事件给客户端。

#### Scenario: Notify achievement unlocked
- **WHEN** 玩家达成成就
- **THEN** 系统推送 `nft:achievement_unlocked` 事件
- **AND** 包含成就类型、签名数据、铸造价格、有效期

#### Scenario: Notify monthly limit reached
- **WHEN** 玩家达成成就但月度限量已满
- **THEN** 系统推送 `nft:limit_reached` 事件
- **AND** 包含成就类型和提示消息
