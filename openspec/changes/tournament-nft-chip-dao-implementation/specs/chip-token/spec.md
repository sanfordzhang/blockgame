# Specification: CHIP Token

## Overview

CHIP平台代币，TRC20标准实现，总量10亿，用于游戏奖励、质押分红、VIP特权和DAO治理。

---

## ADDED Requirements

### Requirement: Token Basic Properties

系统 SHALL 实现TRC20标准的CHIP代币。

#### Scenario: Token metadata
- **WHEN** 查询代币信息
- **THEN** 返回：
  - name: "CHIP Token"
  - symbol: "CHIP"
  - decimals: 6
  - max supply: 1,000,000,000 CHIP

#### Scenario: Initial supply
- **WHEN** 合约部署完成
- **THEN** 初始供应量为100,000,000 CHIP（10%）
- **AND** 分配给合约部署者

---

### Requirement: TRC20 Transfer

系统 SHALL 实现标准的转账功能。

#### Scenario: Successful transfer
- **WHEN** 持有者调用 `transfer(to, amount)`
- **AND** 余额充足
- **AND** 合约未暂停
- **THEN** 代币从调用者转移到目标地址
- **AND** 触发 `Transfer` 事件
- **AND** 返回 true

#### Scenario: Transfer when paused
- **WHEN** 持有者调用 `transfer(to, amount)`
- **AND** 合约已暂停
- **THEN** 交易失败并返回错误 "Paused"

#### Scenario: Transfer insufficient balance
- **WHEN** 持有者调用 `transfer(to, amount)`
- **AND** 余额不足
- **THEN** 交易失败并返回错误 "Insufficient balance"

#### Scenario: Transfer to zero address
- **WHEN** 调用 `transfer(address(0), amount)`
- **THEN** 交易失败

---

### Requirement: TRC20 Approve

系统 SHALL 实现标准的授权功能。

#### Scenario: Successful approve
- **WHEN** 持有者调用 `approve(spender, amount)`
- **AND** 合约未暂停
- **THEN** 设置spender的授权额度
- **AND** 触发 `Approval` 事件
- **AND** 返回 true

#### Scenario: Approve when paused
- **WHEN** 持有者调用 `approve(spender, amount)`
- **AND** 合约已暂停
- **THEN** 交易失败并返回错误 "Paused"

---

### Requirement: TRC20 TransferFrom

系统 SHALL 实现标准的授权转账功能。

#### Scenario: Successful transferFrom
- **WHEN** 授权者调用 `transferFrom(from, to, amount)`
- **AND** from余额充足
- **AND** 授权额度充足
- **AND** 合约未暂停
- **THEN** 代币从from转移到to
- **AND** 扣减授权额度
- **AND** 触发 `Transfer` 事件
- **AND** 返回 true

#### Scenario: TransferFrom insufficient allowance
- **WHEN** 调用 `transferFrom(from, to, amount)`
- **AND** 授权额度不足
- **THEN** 交易失败

---

### Requirement: Token Minting

系统 SHALL 允许授权的铸造者铸造新代币。

#### Scenario: Minter mints tokens
- **WHEN** 授权的minter调用 `mint(to, amount)`
- **AND** 铸造后总量不超过MAX_SUPPLY
- **THEN** 新代币铸造给目标地址
- **AND** 触发 `Minted` 事件

#### Scenario: Non-minter cannot mint
- **WHEN** 非授权地址调用 `mint(to, amount)`
- **THEN** 交易失败并返回错误 "Not minter"

#### Scenario: Mint exceeds max supply
- **WHEN** 铸造会导致总量超过MAX_SUPPLY
- **THEN** 交易失败并返回错误 "Exceeds max supply"

---

### Requirement: Token Burning

系统 SHALL 允许持有者销毁代币。

#### Scenario: Burn own tokens
- **WHEN** 持有者调用 `burn(amount)`
- **AND** 余额充足
- **THEN** 代币被销毁
- **AND** 触发 `Burned` 事件

#### Scenario: BurnFrom with allowance
- **WHEN** 授权者调用 `burnFrom(from, amount)`
- **AND** from余额充足
- **AND** 授权额度充足
- **THEN** 代币被销毁
- **AND** 扣减授权额度

---

### Requirement: Minter Management

系统 SHALL 允许所有者管理铸造者白名单。

#### Scenario: Add minter
- **WHEN** 所有者调用 `addMinter(address)`
- **THEN** 地址被添加到minter白名单
- **AND** 触发 `MinterAdded` 事件

#### Scenario: Remove minter
- **WHEN** 所有者调用 `removeMinter(address)`
- **THEN** 地址从minter白名单移除
- **AND** 触发 `MinterRemoved` 事件

#### Scenario: Query minter status
- **WHEN** 查询 `isMinter(address)`
- **THEN** 返回该地址是否为授权铸造者

---

### Requirement: Token Pause

系统 SHALL 支持紧急暂停功能。

#### Scenario: Pause contract
- **WHEN** 所有者调用 `pause()`
- **THEN** 合约进入暂停状态
- **AND** 所有转账、授权操作被阻止

#### Scenario: Unpause contract
- **WHEN** 所有者调用 `unpause()`
- **THEN** 合约恢复正常
- **AND** 转账、授权操作可正常执行

---

### Requirement: Game Reward Distribution

系统 SHALL 通过ChipService向玩家发放游戏奖励。

#### Scenario: Reward for normal game
- **WHEN** 玩家完成一局普通游戏
- **THEN** 系统铸造10 CHIP奖励给玩家

#### Scenario: Reward for tournament
- **WHEN** 玩家参与锦标赛
- **THEN** 系统铸造20 CHIP奖励给玩家（锦标赛奖励翻倍）

#### Scenario: VIP discount calculation
- **WHEN** 玩家持有或质押超过10,000 CHIP
- **THEN** 玩家获得VIP身份
- **AND** 享受20%抽水折扣

---

### Requirement: Balance Query

系统 SHALL 提供余额查询接口。

#### Scenario: Query balance
- **WHEN** 查询 `balanceOf(address)`
- **THEN** 返回该地址的CHIP余额

#### Scenario: Query total supply
- **WHEN** 查询 `totalSupply()`
- **THEN** 返回当前CHIP总供应量
