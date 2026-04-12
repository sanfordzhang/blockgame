# Poker AI Agent - 德州扑克智能代理

## Why

玩家在长时间游戏中需要休息或暂时离开，但无法中途退出牌局导致筹码损失。同时，新手玩家缺乏策略指导，难以做出最优决策。引入AI代理可以：
1. 提供托管功能，让玩家暂时离开时AI代为操作
2. 为新手提供决策建议，学习德州扑克策略
3. 填充空位，保证牌局流畅进行

## What Changes

### 新增功能
- **AI决策引擎**: 基于规则引擎的智能决策系统（非机器学习）
- **玩家托管模式**: 玩家可开启/关闭AI自动操作
- **决策建议系统**: 实时提供fold/check/call/raise建议及胜率估算
- **AI难度等级**: 支持多种难度（简单/中等/困难/专家）
- **锦标赛支持**: 允许在锦标赛中使用AI托管（展示AI能力）

### 技术实现
- **规则引擎**: 使用基于规则的决策系统，不使用机器学习模型训练
- 实现基于概率的牌力评估算法
- 实现基于GTO（Game Theory Optimal）的决策模型
- 支持蒙特卡洛模拟计算胜率
- 集成Pot Odds、Implied Odds计算
- 实现位置感知（Position Awareness）策略
- **参考算法**: 参考 fedden/poker_ai 的 CFR 算法思路（但使用规则引擎实现）

### 不涉及变更
- 不修改现有游戏核心逻辑
- 不修改筹码结算流程
- 不修改区块链交互
- 不实现机器学习模型训练

## Capabilities

### New Capabilities

- `ai-decision-engine`: AI决策引擎核心模块，负责牌力评估、胜率计算、策略推理
- `player-auto-play`: 玩家托管功能，允许AI代理执行游戏操作
- `ai-strategy-config`: AI策略配置，支持不同难度和风格调整

### Modified Capabilities

- `game-actions`: 扩展现有游戏操作处理，支持AI代理触发（非破坏性扩展）

## Impact

### 服务端
- `server/services/AIService.js` - 新增AI决策服务
- `server/services/PokerEvaluator.js` - 新增牌力评估服务
- `server/pokergame/Table.js` - 扩展支持AI玩家操作
- `server/pokergame/Seat.js` - 添加isAI、aiLevel等属性

### 前端
- `src/components/game/AIControlPanel.js` - 新增AI控制面板组件
- `src/components/game/DecisionSuggestion.js` - 新增决策建议组件
- `src/context/game/GameState.js` - 扩展AI状态管理

### 数据模型
- `server/models/Player.js` - 添加aiMode, aiLevel字段
- 新增 `server/models/AIGameStats.js` - AI游戏统计

### Socket事件
- 新增 `CS_ENABLE_AI` / `SC_AI_ENABLED` - 开启AI托管
- 新增 `CS_DISABLE_AI` / `SC_AI_DISABLED` - 关闭AI托管
- 新增 `SC_AI_DECISION` - AI决策通知
- 新增 `CS_GET_SUGGESTION` / `SC_SUGGESTION` - 获取决策建议

### 依赖
- 可能引入 `@chenyanxing/poker-ai` 或自研决策引擎
- 使用现有的 `pokersolver` 库进行牌型判断

## AI决策模型设计（概要）

### 牌力评估阶段
1. **Pre-flop**: 基于起始手牌强度表（Starting Hand Chart）
2. **Flop/Turn/River**: 计算Outs、补牌概率、成牌概率

### 决策因子
- 手牌强度（Hand Strength）
- 位置优势（Position: BTN/SB/BB/UTG/CO）
- 下注历史（Betting History）
- 底池赔率（Pot Odds）
- 隐含赔率（Implied Odds）
- 对手风格分析（Opponent Modeling）
- 筹码深度（Stack Depth）

### 决策输出
```javascript
{
  action: 'raise' | 'call' | 'check' | 'fold',
  amount?: number,  // raise时的金额
  confidence: number, // 决策置信度 0-1
  winProbability: number, // 胜率估算
  reasoning: string // 决策理由（可选显示）
}
```

### 难度等级
| 等级 | 策略特点 | 适用场景 |
|------|----------|----------|
| 简单 | 基础手牌强度，简单跟注/弃牌 | 新手学习 |
| 中等 | 位置感知，Pot Odds计算 | 一般玩家 |
| 困难 | 对手建模，诈唬策略 | 有经验玩家 |
| 专家 | GTO近似，平衡策略 | 高级玩家/锦标赛 |

## 风险评估

### 技术风险
- AI响应时间需控制在100ms内，避免影响游戏体验
- AI决策的确定性可能导致被利用，需引入随机化

### 业务风险
- AI托管可能导致玩家活跃度下降
- 需明确AI不能用于作弊或多账号操作

### 合规风险
- 需确保AI不违反在线扑克平台规则
- 区块链游戏中AI参与需透明公示
