# Spec: AI Poker Agent

## ADDED Requirements

### Requirement: AI Engine Process Management

系统 SHALL 管理 Python AI 引擎子进程的生命周期。

#### Scenario: Spawn AI process on startup
- **WHEN** 游戏服务启动且 `AI_ENABLED=true`
- **THEN** 系统通过 `child_process.spawn()` 启动 Python AI 引擎
- **AND** 传入 `--mode stdio` 参数启用 JSON 通信协议
- **AND** 日志输出 `[AIService] Python AI engine started, PID: {pid}`

#### Scenario: Graceful shutdown
- **WHEN** 收到 SIGTERM/SIGINT 信号
- **THEN** 系统向 AI 子进程发送优雅关闭信号
- **AND** 等待最多 5 秒让进程完成当前决策
- **AND** 强制终止如果超时

#### Scenario: AI process crash recovery
- **WHEN** AI 子进程意外崩溃（exit code != 0）
- **THEN** 系统检测到 stderr 输出或 exit event
- **AND** 日志输出错误信息 `[AIService] AI process crashed: {error}`
- **AND** 自动重启 AI 进程（最多 3 次/小时）
- **AND** 期间 AI 玩家自动 fold 以避免阻塞游戏

#### Scenario: AI disabled
- **WHEN** `AI_ENABLED=false` 或 AI 进程启动失败超过重试上限
- **THEN** 系统不启动 AI 子进程
- **AND** 牌桌不添加 AI 玩家
- **AND** 仅真人玩家参与游戏

---

### Requirement: AI Communication Protocol

系统 SHALL 通过标准化 JSON 协议与 AI 引擎通信（stdin/stdout）。

#### Scenario: Request action from AI
- **WHEN** 轮到 AI 玩家行动
- **THEN** 系统向 AI stdin 写入 JSON：
```json
{
  "type": "request_action",
  "hand_id": "h_20260309_001",
  "hole_cards": ["Ah", "Kd"],
  "community_cards": ["Qh", "Js", "Tc"],
  "pot": 1500,
  "to_call": 200,
  "stack": 8500,
  "position": 0,
  "num_players": 2,
  "action_history": [
    {"player": "p1", "action": "raise", "amount": 200},
    {"player": "ai_bot_1", "action": "call", "amount": 200}
  ],
  "game_phase": "turn",
  "blinds": {"small": 50, "big": 100},
  "timeout_ms": 10000
}
```

#### Scenario: AI responds with action decision
- **WHEN** AI 处理完毕后向 stdout 输出
- **THEN** 返回格式为：
```json
{
  "type": "action",
  "hand_id": "h_20260309_001",
  "action": "raise",
  "amount": 600,
  "confidence": 0.85,
  "reasoning": "strong draw with overcards",
  "processing_time_ms": 120
}
```
- **AND** action 必须是合法扑克操作之一：fold | check | call | raise | all-in
- **AND** amount 在 raise/all-in 时必须 >= minRaise 且 <= stack

#### Scenario: AI response timeout
- **WHEN** AI 在 `timeout_ms`（默认 10s）内无响应
- **THEN** 系统自动对该 AI 玩家执行 fold 操作
- **AND** 记录日志 `[AIService] Timeout for AI player {id}, auto-folding`
- **AND** 不等待后续响应（丢弃迟到的消息）

#### Scenario: Invalid AI response
- **WHEN** AI 返回无法解析的 JSON 或非法 action
- **THEN** 系统记录错误日志并自动 fold
- **AND** 发送 `error` 类型消息给 AI 引擎反馈问题

---

### Requirement: AI Player as Socket Client

系统 SHALL 让 AI 玩家作为虚拟 socket 客户端加入牌桌参与游戏。

#### Scenario: AI joins table
- **WHEN** 牌桌空位 >= 1 且 AI 功能启用
- **THEN** 系统创建虚拟 socket 连接代表 AI 玩家
- **AND** 发送 CS_JOIN_TABLE 请求加入指定牌桌
- **AND** AI 玩家显示名称如 "AI_Bot_Alpha"、"AI_Bot_Beta"
- **AND** 使用预设的钱包地址（来自 config）

#### Scenario: AI receives game events
- **WHEN** 牌桌发生状态变化（发牌、其他玩家行动等）
- **THEN** 系统通过 SC_* 事件推送给 AI 玩家的虚拟 socket
- **AND** AI 引擎据此更新内部状态

#### Scenario: AI executes decided action
- **WHEN** AI 引擎返回 action 决策
- **THEN** 系统将该决策转换为对应的 CS_* 事件发送
- **如 raise**: 发送 CS_RAISE 并携带 amount
- **如 fold**: 发送 CS_FOLD
- **AND** 游戏逻辑正常处理该操作（与真人玩家一致）

#### Scenario: Multiple AI players at same table
- **WHEN** 牌桌有多余空位
- **THEN** 系统可为每个空位创建独立的 AI 玩家
- **AND** 每个 AI 有独立的名字和决策实例
- **AND** 默认限制每桌最多 3 个 AI 玩家（可配置）

---

### Requirement: AI Difficulty Levels

系统 SHALL 支持 AI 难度等级配置。

#### Scenario: Easy mode (rule-based)
- **GIVEN** `AI_DEFAULT_DIFFICULTY=easy` 或牌桌配置 easy
- **WHEN** AI 做决策
- **THEN** AI 主要使用规则引擎（基于手牌强度表 + 位置策略）
- **AND** 偶尔做出次优决策模拟新手行为
- **AND** 响应速度 < 500ms

#### Scenario: Medium mode (mixed)
- **GIVEN** `AI_DEFAULT_DIFFICULTY=medium`
- **WHEN** AI 做决策
- **THEN** AI 结合规则引擎和简化 ML 模型
- **AND** 70% 时间做出合理决策，30% 加入随机扰动
- **AND** 响应速度 < 2000ms

#### Scenario: Hard mode (NFSP model inference)
- **GIVEN** `AI_DEFAULT_DIFFICULTY=hard`
- **WHEN** AI 做决策
- **THEN** AI 使用训练好的 NFSP 模型推理（加载 checkpoint）
- **AND** 接近 GTO（博弈论最优）策略水平
- **AND** 响应速度可能达到 3000-5000ms（模型加载时间）

#### Scenario: Per-table difficulty override
- **WHEN** 创建牌桌时指定 `aiDifficulty: 'hard'`
- **THEN** 该桌的 AI 玩家覆盖全局难度设置
- **AND** 其他桌不受影响

---

### Requirement: AI Persistent Memory

系统 SHALL 为 AI 玩家维护持久记忆，用于跨局策略进化。

#### Scenario: Store opponent patterns
- **WHEN** AI 玩家完成一局游戏
- **THEN** 系统记录对手的行为模式：
  - VPIP（主动入池率）
  - PFR（翻前加注率）
  - AF（攻击频率）
  - 特殊倾向（如喜欢 bluff）
- **AND** 存入 MongoDB `ai_memories` collection

#### Scenario: Load memory before new game
- **WHEN** AI 玩家加入有对手历史记录的牌桌
- **THEN** 系统加载该对手的历史行为统计
- **AND** 作为附加特征输入 AI 决策模型

#### Scenario: Strategy evolution tracking
- **WHEN** AI 玩家累计完成 N 局游戏（默认 N=100）
- **THEN** 系统生成策略进化报告：
  - 胜率趋势图
  - 各位置收益（EV）
  - 常见失误分析
- **AND** 可选地触发模型再训练

---

### Requirement: AI Statistics and Monitoring

系统 SHALL 提供 AI 玩家的运行监控和统计数据。

#### Scenario: Query AI status
- **WHEN** GET `/api/ai/status`
- **THEN** 返回：
```json
{
  "running": true,
  "pid": 12345,
  "uptime_seconds": 3600,
  "activePlayers": 2,
  "totalHandsPlayed": 150,
  "winRate": 0.42,
  "averageDecisionTimeMs": 850,
  "modelLoaded": "nfsp_v1_checkpoint.pt"
}
```

#### Scenario: AI decision log
- **WHEN** 每次AI做决策后
- **THEN** 系统记录决策日志（含 confidence、reasoning、hand_state 快照）
- **AND** 存入 MongoDB `ai_decisions` collection
- **AND** 可用于事后分析和调试
