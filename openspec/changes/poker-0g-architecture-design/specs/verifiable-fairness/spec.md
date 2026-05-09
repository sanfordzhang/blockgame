# Spec: Verifiable Fairness System

## ADDED Requirements

### Requirement: Seed Commitment Scheme

系统 SHALL 在每手牌开始前生成洗牌种子承诺。

#### Scenario: Generate and commit seed
- **WHEN** 新一手牌即将发牌
- **THEN** 服务器执行：
  1. 生成加密安全随机种子 S（32 bytes）：`crypto.randomBytes(32)`
  2. 生成随机 salt（16 bytes）：`crypto.randomBytes(16)`
  3. 计算承诺 H = SHA256(S + salt + tableId + handNumber)
  4. 将 H 存入 MongoDB `hands.{handId}.seedCommitment`
  5. **不暴露** S 和 salt 值

#### Scenario: Use committed seed for shuffling
- **WHEN** 需要洗牌时
- **THEN** 使用种子 S 初始化确定性伪随机数生成器（PRNG）
- **AND** PRNG 输出序列决定牌组 shuffle 顺序
- **AND** 保证相同的 S 总是产生相同的发牌结果

#### Scenario: Reveal seed after game
- **WHEN** 一手牌完全结束（包括结算完成）
- **THEN** 服务器揭示 S 和 salt
- **AND** 存入 `hands.{handId}.seedReveal`
- **AND** 任何第三方可验证：SHA256(reveal.seed + reveal.salt + tableId + handNumber) === stored.commitment

---

### Requirement: State Hash Chain

系统 SHALL 为每手牌生成不可变的状态哈希。

#### Scenario: Generate state hash
- **WHEN** 一手牌结算完成
- **THEN** 构建规范化状态对象：
```json
{
  "tableId": "string",
  "handNumber": number,
  "seedCommitment": "hex",
  "seedReveal": "hex",
  "deck": ["Ah","2c",..., "Ts"], // 完整牌组顺序
  "players": [
    {
      "address": "hex",
      "holeCards": ["string","string"],
      "finalHand": "string",
      "chipsWon": number,
      "actions": [{"round":"preflop","action":"raise","amount":number}]
    }
  ],
  "board": ["string","string","string","string","string"],
  "pot": number,
  "rake": number,
  "timestamp": number
}
```
- **AND** JSON.stringify(state) 后计算 SHA-256 得到 stateHash

#### Scenario: Include previous hand hash (hash chain)
- **WHEN** 生成第 N 手牌的 stateHash
- **AND** 第 N-1 手牌已有 stateHash
- **THEN** 将 prevStateHash 加入状态对象
- **AND** 形成 hash chain：H(N) = SHA256(state_N + H(N-1))
- **AND** 确保整个游戏历史不能被篡改插入或删除中间记录

#### Scenario: Deterministic serialization
- **WHEN** 序列化状态对象用于哈希计算
- **THEN** 键按字母序排序
- **AND** 数组元素保持固定顺序
- **AND** 确保相同状态总是产生相同字符串（无论 JS 对象属性遍历顺序）

---

### Requirement: DA Anchor for State Hash

系统 SHALL 将 stateHash 提交到 0G DA 层锚定。

#### Scenario: Anchor to DA layer
- **WHEN** stateHash 生成完成
- **AND** 0G DA 功能已启用
- **THEN** 调用 DA SDK 提交 stateHash
- **AND** 获得 DA receipt（batchIndex + commitmentHash）
- **AND** receipt 存入 MongoDB `hands.{handId}.daProof`

#### Scenario: DA anchor verification
- **WHEN** 第三方需要验证某手牌未被篡改
- **THEN** 从 DA receipt 获取 commitmentHash
- **AND** 从 0G DA 层查询确认该 batch 确实存在
- **AND** 用公开的游戏数据重算 stateHash
- **AND** 确认一致性

#### Scenario: DA anchor failure handling
- **WHEN** DA 层提交失败（网络/服务不可用）
- **THEN** stateHash 仍存入 MongoDB 本地记录
- **AND** 标记 daProof.status = "pending"
- **AND** 后台任务定期重试提交
- **AND** 游戏正常进行不被阻塞

---

### Requirement: Public Verification Tool

系统 SHALL 提供公开的离线验证工具。

#### Scenario: Command-line verification
- **WHEN** 执行 `node scripts/verify-fairness.js --handId h_20260309_042`
- **THEN** 工具执行以下步骤：
  1. 从 MongoDB/DA 层获取该 handId 的完整数据
  2. 验证 seed commitment: SHA256(seed+salt+tableId+handNum) === storedCommitment
  3. 用 seed 重放 PRNG + 洗牌，确认牌面一致
  4. 重算 stateHash，与存储值对比
  5. 如有 DA receipt，验证 DA 层确认
  6. 输出完整报告：
```
=== Fairness Verification Report ===
Hand ID: h_20260309_042
Table: tbl_0g_001

[✓] Seed commitment valid
[✓] Shuffle deterministic (replay matched)
[✓] State hash matches
[✓] DA layer anchored (batch #12345)
[✓] Hash chain intact (prev: 0xabc...)

RESULT: VALID - No tampering detected
```

#### Scenario: Web-based verification
- **WHEN** 用户在前端访问公平性验证页面
- **AND** 输入 handId
- **THEN** 前端调用 GET `/api/0g/fairness-verify/:handId`
- **AND** 服务端执行上述验证逻辑
- **AND** 前端展示可视化验证报告（绿 ✓ / 红 ✗）

#### Scenario: Batch verification
- **WHEN** 执行 `node scripts/verify-fairness.js --tableId tbl_0g_001 --range 1..100`
- **THEN** 工具连续验证指定范围内所有 handId
- **AND** 输出汇总：通过数/失败数/异常列表
- **AND** 适用于审计人员批量检查

---

### Requirement: Fairness Proof Display

系统 SHALL 在前端展示公平性证明入口和状态。

#### Scenario: In-game fairness indicator
- **WHEN** 用户正在游戏中（0G 模式）
- **THEN** 游戏界面右上角显示盾牌图标 🛡️
- **AND** hover 提示："本局游戏由 0G DA 层保护，可验证公平性"

#### Scenario: Post-game fairness link
- **WHEN** 一手牌结束，显示结算弹窗
- **THEN** 弹窗底部包含"验证公平性"按钮
- **AND** 点击后跳转到公平性验证页面（带上 handId 参数）

#### Scenario: DA proof status indicator
- **WHEN** 查看某手牌的历史记录
- **THEN** 如果 DA 证明已确认：显示绿色 ✅ "已锚定 0G DA 层"
- **AND** 如果 DA 证明待确认：显示黄色 ⏳ "验证中..."
- **AND** 如果无 DA 证明（TRON 模式下的对局）：显示灰色 ⚪ "传统模式"

---

### Requirement: Anti-Cheating Guarantees

系统 SHALL 通过密码学手段防止常见作弊行为。

#### Scenario: Prevent server from favoring specific players
- **WHEN** 种子在发牌前就已承诺（commitment）
- **THEN** 服务器无法在知道玩家 hole cards 后更改发牌结果
- **因为** 修改 seed 会导致 reveal 时 commitment 验证失败

#### Scenario: Prevent post-hoc card changes
- **WHEN** stateHash 包含完整的牌组和所有 actions
- **AND** hash chain 链接到上一手牌
- **THEN** 服务器无法在游戏结束后篡改任何玩家的牌面或行动记录
- **因为** 任何改动都会导致 stateHash 不匹配

#### Scenario: Prevent DA layer tampering
- **WHEN** stateHash 已锚定到 0G DA 层
- **THEN** 即使数据库被入侵修改了存储的数据
- **AND** DA 层的 commitment 仍保持不变
- **THEN** 验证工具会检测到不一致并报 INVALID
