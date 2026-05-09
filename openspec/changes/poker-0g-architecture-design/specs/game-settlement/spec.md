# Spec: Game Settlement (0G Enhanced)

## MODIFIED Requirements

### Requirement: Settlement Execution

The system SHALL execute game settlement via smart contract transaction，**支持双路径：TRON 和 0G**。

#### Scenario: Settlement triggered on 0G chain
- **WHEN** game ends with winner determination
- **AND** current blockchain mode is "0g" (`config.BLOCKCHAIN_MODE === '0g'`)
- **THEN** system generates settlement data (winners, amounts, proof)
- **AND** submits transaction via ZeroGContractService (ethers.js v6) to PokerGame0G contract
- **AND** includes stateHash in settlement parameters for DA anchoring reference
- **AND** waits for 0G blockchain confirmation

#### Scenario: Settlement triggered on TRON chain (unchanged)
- **WHEN** game ends with winner determination
- **AND** current blockchain mode is "tron" (default)
- **THEN** system behavior unchanged: uses TronWeb/ContractService to submit to BridgeGameV2/V3
- **AND** waits for TRON blockchain confirmation

#### Scenario: Settlement confirmed on 0G
- **WHEN** settlement transaction is confirmed on 0G blockchain
- **THEN** system updates player custody balances on 0G chain
- **AND** collects rake to PokerGame0G contract balance
- **AND** notifies winners of their winnings
- **AND** triggers DA layer submission for state hash anchoring

---

## ADDED Requirements

### Requirement: Dual-Chain Settlement Router

系统 SHALL 提供统一的结算路由器，根据配置选择链上路径。

#### Route to correct chain
- **WHEN** `settlementRouter.settle(gameResult)` 被调用
- **THEN** router 检查 `config.BLOCKCHAIN_MODE`
- **IF** value is `"0g"` → delegate to `ZeroGContractService.settle()`
- **IF** value is `"tron"` → delegate to existing `ContractService.settle()`
- **IF** value is `"both"` → 同时提交两条链（高级模式，用于跨链备份）
- **AND** 返回统一的 SettlementResult 对象：

```javascript
{
  chain: "0g" | "tron" | "both",
  txHash: "0x..." | "trx hash",
  status: "pending" | "confirmed" | "failed",
  blockNumber: 12345,
  gasUsed: 65000,
  timestamp: Date.now()
}
```

#### Scenario: Fallback settlement
- **WHEN** 主链结算失败（0G RPC 超时）
- **AND** config.SETTLEMENT_FALLBACK_ENABLED === true
- **THEN** 系统自动切换到备用链（TRON）尝试结算
- **AND** 记录日志 `[SettlementRouter] Primary failed, fallback to TRON`
- **AND** 最终至少保证一条链上结算成功

---

### Requirement: 0G Settlement Data Format

系统 SHALL 为 0G 链结算构造符合 PokerGame0G 合约要求的数据结构。

#### Scenario: Build 0G settlement params
- **WHEN** 构造 0G 链结算参数
- **THEN** 参数格式如下：
```javascript
const settlementParams = {
  handId: `h_${Date.now()}_${tableId}`,
  winners: ['0xPlayer1Addr', '0xAIAddr'],     // 0G EVM 地址数组
  amounts: [ethers.parseEther("0.5"), ethers.parseEther("0.3")], // ETH 单位
  totalPot: ethers.parseEther("0.85"),
  rake: ethers.parseEther("0.05"),
  stateHash: computedStateHash,                   // 来自公平性模块
  deadline: Math.floor(Date.now() / 1000) + 3600  // 1 小时截止
};
```

#### Scenario: Address conversion for 0G
- **WHEN** 玩家使用 0G 钱包（EVM 地址 0x...）
- **THEN** 结算直接使用其 EVM 地址
- **WHEN** 玩家使用 TRON 钱包（T 地址）
- **THEN** 系统需要在 0G 结算时映射或提示切换钱包
- **BECAUSE** 0G Chain 使用 secp256k1 地址格式

---

### Requirement: 0G Gas Optimization

系统 SHALL 优化 0G 链上结算的 gas 消耗。

#### Scenario: Batch settlements
- **WHEN** 多手牌结算在同一区块窗口内
- **THEN** 系统 batch 多个 settle 调用（若合约支持 batchSettle）
- **OR** 按优先级排队串行提交但共享 nonce 管理
- **AND** 目标: 平均单笔结算 gas < 100,000

#### Scenario: Dynamic gas price
- **WHEN** 提交 0G 结算交易
- **THEN** 使用 `ethers.FeeData` 获取当前 gas 价格
- **AND** 设定合理的 gas limit（预估 + 20% buffer）
- **AND** 避免 gas 不足导致的交易失败
