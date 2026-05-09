# Spec: 0G Data Availability Layer

## ADDED Requirements

### Requirement: DA Service Initialization

系统 SHALL 初始化 0G Data Availability 客户端用于提交和查询数据可用性证明。

#### Scenario: Successful DA client init
- **GIVEN** `.env` 配置了 `ZEROG_DA_RPC_URL`
- **WHEN** 服务启动
- **THEN** 创建 DA 层客户端实例
- **AND** 日志输出 `[ZeroGDAService] DA client initialized`

#### Scenario: DA disabled
- **GIVEN** `ZEROG_DA_ENABLED=false` 或配置缺失
- **WHEN** 游戏结束需要提交 DA
- **THEN** 系统跳过 DA 提交步骤
- **AND** 记录日志 `[ZeroGDAService] DA disabled, skipping submission`

---

### Requirement: Game State Hash Submission

系统 SHALL 在每手牌结束时将游戏状态哈希提交至 0G DA 层。

#### Scenario: Submit state hash to DA
- **WHEN** 一手牌完成结算
- **AND** DA 功能已启用
- **THEN** 系统构建状态摘要对象：
```json
{
  "tableId": "string",
  "handNumber": "number",
  "seedCommitment": "hex string",
  "seedReveal": "hex string",
  "boardCards": ["string"],
  "playerResults": [{"address":"hex","hand":"string","chipsWon":"number"}],
  "timestamp": "unix timestamp",
  "stateHash": "SHA256 hex"
}
```
- **AND** 计算 SHA-256 哈希值
- **AND** 调用 DA SDK 提交哈希至 0G DA 层
- **AND** 获得 DA receipt（包含 batch index + commitment hash）

#### Scenario: DA receipt storage
- **WHEN** DA 层确认接收数据并返回 receipt
- **THEN** 系统将 receipt 存储到 MongoDB `game_records.da_proof` 字段：
```json
{
  "batchIndex": 12345,
  "commitmentHash": "0x...",
  "timestamp": 1709251200,
  "stateHash": "0x...",
  "status": "confirmed"
}
```

#### Scenario: Asynchronous DA submission
- **WHEN** DA 提交可能耗时较长（网络延迟）
- **THEN** 系统以异步方式提交（不阻塞游戏流程）
- **AND** 前端显示"公平性验证中..."状态
- **AND** DA 确认后推送 `da_proof_ready` Socket 事件

---

### Requirement: Seed Commit-Reveal via DA

系统 SHALL 利用 DA 层保障洗牌种子的承诺-揭示方案不可篡改。

#### Scenario: Commit seed before deal
- **WHEN** 新一手牌开始发牌前
- **THEN** 服务器生成随机种子 S 和 salt
- **AND** 计算 commitment H = SHA256(S + salt)
- **AND** 将 H 存入 MongoDB 该 hand 记录
- **AND** （可选）同时提交 H 到 DA 层作为预承诺

#### Scenario: Reveal seed after game ends
- **WHEN** 一手牌完全结束
- **THEN** 服务器揭示种子 S 和 salt
- **AND** 任何人可验证 H == SHA256(S + salt)
- **AND** 将 reveal 数据包含在最终 DA 提交的状态摘要中

#### Scenario: Verify seed integrity
- **WHEN** 第三方（评委/审计者）验证某手牌公平性
- **THEN** 从 DA receipt 获取 stateHash
- **AND** 用公开的种子重新计算
- **AND** 对比哈希值确认未被篡改

---

### Requirement: DA Proof Query and Verification

系统 SHALL 提供 API 接口供用户查询和验证 DA 公平性证明。

#### Scenario: Query DA proof by hand ID
- **WHEN** GET `/api/0g/da-proof/:handId`
- **AND** 该 handId 存在 DA 证明
- **THEN** 返回：
```json
{
  "handId": "xxx",
  "stateHash": "0x...",
  "daProof": {
    "batchIndex": 12345,
    "commitmentHash": "0x...",
    "status": "confirmed",
    "timestamp": 1709251200
  },
  "gameData": {
    "boardCards": ["Ah","Kd","..."],
    "seedReveal": "0xabc...",
    "results": [...]
  }
}
```

#### Scenario: No DA proof available
- **WHEN** GET `/api/0g/da-proof/:handId`
- **AND** 该 hand 没有 DA 证明（如 0G 未启用时的对局）
- **THEN** 返回 404 + `{ error: "No DA proof for this hand", reason: "0G mode was not active" }`

#### Scenario: Offline verification script
- **WHEN** 执行 `node scripts/verify-da-proof.js --handId xxx`
- **THEN** 脚本从本地/DA 层获取数据
- **AND** 重新计算 stateHash
- **AND** 与链上/DA receipt 对比
- **AND** 输出 `VALID` 或 `INVALID` 及详细原因

---

### Requirement: DA Submission Error Handling

系统 SHALL 妥善处理 DA 提交过程中的各种错误情况。

#### Scenario: DA network timeout
- **WHEN** DA 提交请求超时（>30s）
- **THEN** 系统标记该记录为 `pending_retry`
- **AND** 加入后台重试队列
- **AND** 不影响游戏正常进行

#### Scenario: DA service unavailable
- **WHEN** 0G DA 层完全不可达
- **THEN** 系统降级为本地 MongoDB 存储模式
- **AND** 记录错误日志 `[ZeroGDAService] DA unavailable, storing locally only`
- **AND** 前端显示"公平性证明待同步"

#### Scenario: Batch submission for efficiency
- **WHEN** 多手牌几乎同时结束
- **THEN** 系统将多个状态哈希打包批量提交至 DA 层
- **AND** 减少网络请求数量
- **AND** 每个 hash 保持独立可验证
