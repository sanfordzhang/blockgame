# Poker AI Agent - 技术设计文档

## Context

### 背景
当前游戏系统已有完整的德州扑克逻辑实现（`Table.js`, `Seat.js`, `Deck.js`），支持基本的游戏操作（fold/check/call/raise）。玩家通过 Socket.io 发送操作指令，服务端处理游戏状态。

### 现有架构
```
客户端 (React) <--Socket.io--> 服务端 (Express)
                                     |
                                     +-- Table.js (游戏状态)
                                     +-- Seat.js (座位/玩家状态)
                                     +-- Deck.js (牌组)
                                     +-- pokersolver (牌型判断)
```

### 约束条件
- AI决策延迟需 < 100ms（不影响游戏流畅度）
- 不能修改现有游戏核心逻辑
- 需支持多种AI难度级别
- 区块链交互部分不应由AI触发

## Goals / Non-Goals

**Goals:**
- 实现可配置的AI决策引擎，支持多种策略模型
- 提供玩家托管功能，AI可代理玩家执行操作
- 提供决策建议功能，辅助新手学习
- AI决策过程透明可解释
- 支持扩展新的AI策略模型
- **使用 RLCard AI 模型**：集成开源 AI 模型，无需自研规则引擎

**Non-Goals:**
- 不实现多账号自动游戏（防止作弊）
- 不实现AI参与区块链交易签名
- 不修改现有锦标赛结算逻辑

## Decisions

### Decision 1: AI决策引擎架构

**选择**: RLCard + Python 子进程集成

**理由**:
- **RLCard 是成熟的德州扑克AI框架**：包含预训练模型和多种算法
- **MIT 许可证**：商业友好，无法律风险
- **支持多种模型**：Random、Rule-based、NFSP、DQN等
- **NFSP 算法**：通过自我对弈收敛到近似纳什均衡，GPU加速，几小时可训练
- **Python 生态**：可直接使用 PyTorch 训练和推理
- **活跃维护**：3.4k stars，持续更新

**架构设计**:
```
┌──────────────────────────────────────────────────────────────────┐
│                          Node.js Server                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  server/services/ai/AIService.js                           │ │
│  │  - AI托管管理                                               │ │
│  │  - 子进程调用 Python                                        │ │
│  │  - 决策缓存                                                 │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │ spawn                             │
│  ┌──────────────────────────▼─────────────────────────────────┐ │
│  │  ai_engine/ (Python模块)                                    │ │
│  │  ├── rlcard_agent.py      # RLCard Agent封装               │ │
│  │  ├── decision_engine.py   # 决策引擎                       │ │
│  │  ├── models/              # 预训练模型存储                  │ │
│  │  │   └── nfsp_v1/         # NFSP预训练模型                  │ │
│  │  ├── training/            # 模型训练脚本                   │ │
│  │  │   ├── train_nfsp.py    # NFSP训练 (本地)                │ │
│  │  │   ├── train_nfsp_colab.ipynb # NFSP训练 (Colab GPU)    │ │
│  │  │   ├── train_cfr.py     # CFR训练 (备选,极慢)            │ │
│  │  │   ├── evaluate.py      # 模型评估                       │ │
│  │  │   └── test_speed.py    # 训练速度测试                   │ │
│  │  └── requirements.txt     # Python依赖                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**目录结构**:
```
game-core/
├── ai_engine/                          # Python AI 模块 (新增)
│   ├── __init__.py
│   ├── rlcard_agent.py                 # RLCard Agent 封装
│   ├── decision_engine.py              # 决策引擎主入口
│   ├── game_converter.py               # 游戏状态转换
│   ├── models/                         # 预训练模型
│   │   └── nfsp_v1/
│   │       ├── agent_0_checkpoint.pt   # NFSP Player 0 模型
│   │       ├── agent_1_checkpoint.pt   # NFSP Player 1 模型
│   │       └── training_metrics.json   # 训练指标
│   ├── training/                       # 模型训练
│   │   ├── train_nfsp.py              # NFSP训练 (本地/服务器)
│   │   ├── train_nfsp_colab.ipynb     # NFSP训练 (Colab GPU)
│   │   ├── train_cfr.py              # CFR训练 (备选)
│   │   ├── evaluate.py               # 模型评估
│   │   └── test_speed.py             # 速度测试
│   └── requirements.txt
├── server/
│   ├── services/ai/
│   │   ├── AIService.js               # AI服务入口
│   │   └── AIModelManager.js          # 模型管理
│   └── socket/
│       └── aiHandler.js               # AI Socket处理
└── tests/
    ├── ai/
    │   ├── rlcard_agent.test.js       # RLCard Agent测试
    │   └── integration.test.js        # 集成测试
    └── e2e/
        └── ai_gameplay.e2e.js         # E2E测试
```

**备选方案**:
- ❌ 自研规则引擎：开发成本高，策略有限
- ❌ TexasSolver：AGPL许可证，商业使用受限
- ❌ OpenSpiel：C++为主，集成复杂

### Decision 2: RLCard 模型选择

**选择**: NFSP 为核心 + 多难度模型架构

**为何选择 NFSP 而非 CFR**:
- **CFR 问题**: CFR 需遍历完整博弈树，No-Limit Hold'em 单次迭代需数分钟（deepcopy 开销），10000次迭代需 96小时+，本地不可行
- **NFSP 优势**: 通过自我对弈采样学习，GPU 加速，100万局约 1.5小时（Colab T4）
- **NFSP 理论基础**: 两个网络（Best Response + Average Policy），收敛到近似纳什均衡，策略不易被剥削
- **实测数据**: 3000局训练即可获得正收益 (+2.11 vs Random)，100万局可达业余玩家水平

| 难度 | 模型类型 | 特点 | 适用场景 |
|------|----------|------|----------|
| easy | RandomAgent | 随机操作 | 测试、填充空位 |
| medium | RuleBasedAgent | 规则策略 | 新手学习 |
| hard | NFSPAgent | NFSP预训练模型 | 一般玩家 |
| expert | NFSPAgent (深度训练) | 500万局+训练 | 高级玩家/锦标赛 |

**RLCard Agent 实现**:

```python
# ai_engine/rlcard_agent.py
import torch
import rlcard
from rlcard.agents import RandomAgent, NFSPAgent

class RLCardsAgent:
    def __init__(self, difficulty='medium'):
        self.env = rlcard.make('no-limit-holdem')

        if difficulty == 'easy':
            self.agent = RandomAgent(num_actions=self.env.num_actions)
        elif difficulty == 'medium':
            self.agent = RuleBasedAgent()
        elif difficulty in ('hard', 'expert'):
            # Load pre-trained NFSP model
            model_path = f'./models/nfsp_{difficulty}'
            checkpoint = torch.load(
                f'{model_path}/agent_0_checkpoint.pt',
                map_location='cpu'
            )
            self.agent = NFSPAgent.from_checkpoint(checkpoint)

    def get_action(self, game_state):
        state = self._convert_state(game_state)
        action_id, _ = self.agent.eval_step(state)
        return self._convert_action(action_id, game_state)
```

### Decision 3: AI触发机制

**选择**: 事件驱动 + 超时触发

**实现方式**:
1. 玩家开启AI托管时，标记 `seat.isAI = true`
2. 轮到该玩家操作时，触发AI决策
3. 设置决策超时（50ms），超时使用默认操作
4. 决策完成后通过现有操作接口执行

```javascript
// server/socket/aiHandler.js
async function executeAIAction(socket, io, table, seat) {
  const playerId = seat.player.id;
  
  // 准备游戏状态
  const gameState = {
    hand: seat.hand.map(c => `${c.rank}${c.suit}`),
    board: table.board.map(c => `${c.rank}${c.suit}`),
    pot: table.pot,
    callAmount: table.callAmount || 0,
    minRaise: table.minRaise || 0,
    stack: seat.stack,
    position: getPositionName(table, seat.id),
    numPlayers: table.unfoldedPlayers().length
  };
  
  // 调用 Python AI 引擎
  const decision = await aiService.getAIDecision(playerId, gameState);
  
  // 执行决策
  switch (decision.action) {
    case 'fold': table.handleFold(socket.id); break;
    case 'check': table.handleCheck(socket.id); break;
    case 'call': table.handleCall(socket.id); break;
    case 'raise': table.handleRaise(socket.id, decision.amount); break;
  }
}
```

### Decision 4: 模型训练策略

**选择**: NFSP 自我对弈训练 + Colab GPU 加速

#### 4.1 为何放弃 CFR

**CFR 的根本问题** (实测数据):
```
游戏类型          | 每次迭代 | 10,000次预估 | 可行性
------------------|----------|-------------|------
leduc-holdem      | ~0.01s   | ~1 分钟     | ✅ 但博弈太简单
limit-holdem      | ~35s     | ~96 小时    | ❌ 本地不可行
no-limit-holdem   | 数分钟+  | 数周+      | ❌ 完全不可行
```

- CFR 需要 `allow_step_back=True`，每个节点做 `deepcopy`
- No-Limit Hold'em 博弈树有 5^depth 个节点（指数级）
- **GPU 对 CFR 无加速效果**（纯递归+字典操作，非矩阵运算）

#### 4.2 NFSP 训练方案

**NFSP (Neural Fictitious Self-Play)**:
- 两个神经网络：Best Response (DQN) + Average Policy (SL)
- 通过自我对弈采样学习，无需遍历博弈树
- **GPU 可大幅加速**（神经网络训练是矩阵运算）
- 收敛到近似纳什均衡

**训练速度** (实测):
```
设备              | 10万局  | 100万局 | 效果
------------------|---------|---------|------
MacBook CPU       | ~15分钟 | ~2.5小时| 可用
Colab T4 GPU      | ~10分钟 | ~1.5小时| 推荐
Colab A100 GPU    | ~5分钟  | ~40分钟 | 最佳
```

**推荐训练流程**:
1. Colab GPU 训练 100万局 NFSP (~1.5小时)
2. 下载模型文件 (`agent_0_checkpoint.pt`, ~6MB)
3. 放入 `ai_engine/models/nfsp_v1/`
4. 服务端加载模型推理

#### 4.3 训练脚本

**本地训练** (`ai_engine/training/train_nfsp.py`):
```bash
# 快速验证 (10万局, CPU ~15分钟)
python3 train_nfsp.py --episodes 100000

# 标准训练 (100万局)
python3 train_nfsp.py --episodes 1000000

# 深度训练 (500万局, 更强模型)
python3 train_nfsp.py --episodes 5000000
```

**Colab GPU 训练** (`ai_engine/training/train_nfsp_colab.ipynb`):
```
1. 上传 notebook 到 Google Colab
2. 选择 GPU 运行时 (T4)
3. 运行所有 Cell
4. 下载 nfsp_model.zip
```

**训练输出**:
```
=================================================================
训练完成!
=================================================================
  游戏类型:       no-limit-holdem
  算法:           NFSP
  设备:           cuda (GPU加速)
  完成局数:       1,000,000/1,000,000
  总耗时:         1h32m
  平均速度:       181 局/秒
  最终收益:       +2.1105 (vs Random)
=================================================================
```

#### 4.4 模型加载

```python
# 在服务端加载 NFSP 模型
import torch
from rlcard.agents import NFSPAgent

checkpoint = torch.load(
    'ai_engine/models/nfsp_v1/agent_0_checkpoint.pt',
    map_location='cpu'  # 推理不需要GPU
)
agent = NFSPAgent.from_checkpoint(checkpoint)

# 决策
action, info = agent.eval_step(game_state)
# action: 0=fold, 1=check/call, 2=raise_half_pot, 3=raise_pot, 4=all_in
```

#### 4.5 数据收集 (可选，用于持续优化)

**数据来源**:
```
1. 真实游戏日志（匿名化处理）
   - 玩家操作记录
   - 游戏结果数据
   - 时间戳和下注历史

2. 自我对弈生成
   - AI vs AI 对局
   - 多策略混合对战
   - 边缘案例探索

3. 公开数据集
   - PokerHand 数据集
   - 策略标注数据
```

**数据收集脚本**:
```python
# ai_engine/training/collect_data.py
import json
from datetime import datetime

class GameDataCollector:
    """收集游戏数据用于模型训练"""
    
    def __init__(self, output_file='game_data.jsonl'):
        self.output_file = output_file
        self.buffer = []
    
    def record_hand(self, game_state, action, outcome):
        """记录一手牌的完整过程"""
        record = {
            'timestamp': datetime.now().isoformat(),
            'game_state': game_state,  # 手牌、公共牌、底池等
            'player_action': action,    # 玩家实际操作
            'outcome': outcome,         # 最终结果
            'hand_strength': self._evaluate_hand(game_state),
            'pot_odds': self._calculate_pot_odds(game_state),
            'position': game_state.get('position'),
            'num_players': game_state.get('num_players')
        }
        self.buffer.append(record)
        self._flush_if_needed()
    
    def _flush_if_needed(self):
        if len(self.buffer) >= 1000:
            with open(self.output_file, 'a') as f:
                for record in self.buffer:
                    f.write(json.dumps(record) + '\n')
            self.buffer = []
```

#### 4.6 样本准备指南

**样本格式**:
```json
{
  "timestamp": "2026-04-08T10:30:00Z",
  "game_state": {
    "hand": ["Ah", "Kd"],
    "board": ["Qs", "Jc", "Th", "2d", "5c"],
    "pot": 500,
    "call_amount": 100,
    "min_raise": 200,
    "stack": 1000,
    "position": "button",
    "num_players": 2,
    "betting_history": [
      {"player": "sb", "action": "raise", "amount": 50},
      {"player": "button", "action": "call", "amount": 50}
    ]
  },
  "player_action": {"action": "raise", "amount": 300},
  "outcome": {"result": "win", "amount": 800},
  "hand_strength": 0.95,
  "pot_odds": 0.2,
  "is_bluff": false,
  "is_optimal": true
}
```

**样本收集配置**:
```javascript
// server/config/ai_training.js
module.exports = {
  // 数据收集开关
  dataCollection: {
    enabled: true,
    anonymize: true,  // 匿名化玩家数据
    sampleRate: 1.0,  // 收集比例
    outputPath: './ai_engine/training_data/'
  },
  
  // 训练触发条件
  trainingTrigger: {
    minSamples: 10000,       // 最少样本数
    retrainInterval: 7 * 24 * 3600000,  // 每周重训练
    performanceThreshold: 0.55  // 性能低于此值时触发训练
  },
  
  // 模型版本管理
  modelVersioning: {
    keepVersions: 5,
    rollbackThreshold: 0.5  // 性能低于此值回滚
  }
};
```

### Decision 5: 数据存储

**选择**: 内存缓存 + MongoDB持久化 + 文件存储

**存储内容**:
- AI配置: `{ playerId, aiLevel, aiEnabled, aiStyle }` → MongoDB
- 游戏统计: `{ playerId, handsPlayed, winRate, avgDecision }` → MongoDB
- 决策日志: `{ gameId, handId, decision, reasoning, timestamp }` → MongoDB + 文件
- 训练数据: `{ game_state, action, outcome }` → JSONL 文件

### Decision 6: Socket事件设计

**新增事件**:
```javascript
// AI托管控制
CS_AI托管_ENABLE { difficulty, maxHands } → SC_AI托管_ENABLED { success, playerId, difficulty }
CS_AI托管_DISABLE → SC_AI托管_DISABLED { success, playerId }
CS_AI托管_STATS → SC_AI托管_STATS { handsPlayed, winRate, ... }

// AI决策通知
SC_AI托管_ACTION { action, amount, reason, confidence }

// 决策建议（不执行）
CS_GET_SUGGESTION → SC_SUGGESTION { action, amount, winProbability, reasoning }
```

### Decision 7: Node.js 与 Python 通信

**选择**: 子进程 stdin/stdout JSON 通信

```javascript
// server/services/ai/AIService.js
const { spawn } = require('child_process');

async getAIDecision(playerId, gameState) {
  return new Promise((resolve) => {
    const python = spawn('python3', [
      './ai_engine/rlcard_agent.py',
      'get_action'
    ]);
    
    let output = '';
    
    python.stdin.write(JSON.stringify({
      ...gameState,
      difficulty: this.getDifficulty(playerId)
    }));
    python.stdin.end();
    
    python.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    python.on('close', (code) => {
      try {
        resolve(JSON.parse(output));
      } catch {
        resolve(this._fallbackDecision(gameState));
      }
    });
  });
}
```

## Risks / Trade-offs

### Risk 1: Python 子进程延迟
**风险**: Python 启动和推理可能超过100ms
**缓解**: 
- 使用常驻 Python 进程（可选）
- 预加载模型到内存
- 设置超时，超时使用安全操作（check/fold）
- 考虑使用 PyPy 加速 Python

### Risk 2: AI可预测性
**风险**: 玩家可能识破AI策略并利用
**缓解**:
- 引入随机化因子（±10%变异）
- 困难/专家级别使用混合策略
- 定期重新训练模型
- 使用 Dropout 增加不确定性

### Risk 3: AI影响游戏公平性
**风险**: AI可能被用于不当目的
**缓解**:
- 限制AI托管时间（最长30分钟）
- 记录所有AI决策日志
- **允许锦标赛使用AI**（展示系统AI能力）
- AI参与的手牌正常计入NFT成就（不标记AI辅助）

### Risk 4: Python 环境依赖
**风险**: Python 依赖版本冲突或安装问题
**缓解**:
- 使用虚拟环境（venv/conda）
- 固定依赖版本（requirements.txt）
- 提供安装脚本和文档
- 纯 JS fallback 决策逻辑

## Migration Plan

### Phase 1: 基础框架（1-2天）
1. 创建 Python AI 模块目录结构
2. 安装 RLCard 和依赖
3. 实现 `rlcard_agent.py` 基础版本
4. 创建 `AIService.js` Node.js 服务
5. 添加 AI托管事件处理
6. 前端 AI 控制面板

### Phase 2: 集成测试（1-2天）
1. 实现 Node.js ↔ Python 通信
2. Socket 事件集成
3. 游戏流程集成测试
4. E2E 测试用例

### Phase 3: 高级模型（2-3天）
1. 在 Colab GPU 上训练 NFSP 模型 (100万局, ~1.5小时)
2. 下载模型并集成到项目
3. 实现 difficulty 切换 (RandomAgent / RuleBasedAgent / NFSPAgent)
4. 性能优化和缓存

### Phase 4: 数据收集与持续训练（持续）
1. 部署数据收集脚本 (可选)
2. 收集真实游戏数据
3. 用真实数据在 Colab 上重新训练 NFSP 模型
4. 模型版本管理和回滚

### Rollback Strategy
- AI功能可通过配置开关完全禁用
- Python模块可选，纯JS fallback决策
- 所有AI相关代码独立模块，不影响核心游戏
- 数据库变更使用可选字段，无破坏性修改

## Open Questions

1. **AI参与的手牌是否计入NFT成就？**
   - ✅ 已决定：正常计入NFT成就，不标记AI辅助（展示AI能力）

2. **AI托管是否收取费用？**
   - 建议：基础功能免费，高级策略收费

3. **是否需要常驻Python进程？**
   - 建议：初期使用子进程，如有性能问题再优化

4. **模型更新频率？**
   - 建议：每周或达到样本阈值时自动训练

5. **锦标赛中使用AI的配置？**
   - ✅ 已决定：默认允许，用于展示游戏系统的AI能力

## API Reference

### AIService (Node.js)

```javascript
class AIService {
  // 获取AI决策
  async getAIDecision(playerId, gameState)
  
  // 获取决策建议（不执行）
  async getSuggestion(gameState)
  
  // 启用AI托管
  enableAI(playerId, difficulty, options)
  
  // 禁用AI托管
  disableAI(playerId)
  
  // 获取AI统计
  getStats(playerId)
}
```

### Python AI Engine

```python
# CLI 调用方式
python3 rlcard_agent.py init <difficulty>
python3 rlcard_agent.py get_action < game_state.json

# 输出格式
{
  "action": "raise",      # fold/check/call/raise
  "amount": 100,          # raise 金额
  "confidence": 0.85,     # 置信度 0-1
  "reason": "Strong hand, raising for value",
  "win_probability": 0.72 # 预估胜率
}
```

### 训练脚本

```bash
# NFSP 训练 (推荐, 本地 CPU)
python3 training/train_nfsp.py --episodes 1000000 --save models/nfsp_v1

# NFSP 训练 (Colab GPU, 上传 notebook 运行)
# training/train_nfsp_colab.ipynb

# CFR 训练 (备选, 仅适用于 leduc-holdem)
python3 training/train_cfr.py --game leduc-holdem --iterations 10000

# 评估模型性能
python3 training/evaluate.py --model models/nfsp_v1 --games 1000

# 查看训练进度 (另一个终端)
cat models/nfsp_v1/training_progress.json | python3 -m json.tool
```

## Performance Targets

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 决策延迟 | < 100ms | Python 进程调用到返回 |
| 内存占用 | < 200MB | Python 进程内存 |
| CPU使用 | < 20% 单核 | 游戏运行时 |
| 并发支持 | 50+ AI玩家 | 同时托管玩家数 |
| 模型准确率 | > +0.5 payoff | 对 RandomAgent 平均收益 |

## Test Cases

### Unit Tests

```javascript
// tests/ai/rlcard_agent.test.js
describe('RLCard Agent', () => {
  test('should return valid action', async () => {
    const state = {
      hand: ['Ah', 'Kd'],
      board: [],
      pot: 100,
      callAmount: 0,
      stack: 1000
    };
    const decision = await aiService.getAIDecision('test-player', state);
    expect(['fold', 'check', 'call', 'raise']).toContain(decision.action);
  });
  
  test('should handle timeout gracefully', async () => {
    // 模拟超时场景
    const decision = await aiService.getAIDecision('timeout-test', hugeState);
    expect(decision.action).toBeDefined();
  });
});
```

### Integration Tests

```javascript
// tests/ai/integration.test.js
describe('AI托管 Integration', () => {
  test('should auto-play when AI托管 enabled', async () => {
    // 1. 玩家加入游戏
    // 2. 开启AI托管
    // 3. 验证AI自动执行操作
  });
  
  test('should stop AI托管 after max hands', async () => {
    // 1. 设置 maxHands = 5
    // 2. 玩家完成 5 手牌
    // 3. 验证 AI托管 自动关闭
  });
});
```

### E2E Tests

```javascript
// tests/e2e/ai_gameplay.e2e.js
describe('AI Gameplay E2E', () => {
  test('AI vs Human game flow', async () => {
    // 1. 启动浏览器
    // 2. 玩家1 连接钱包，加入牌桌
    // 3. 玩家1 开启 AI托管
    // 4. 玩家2 加入牌桌
    // 5. 验证 AI 自动操作
    // 6. 完成一局游戏
    // 7. 验证结算正确
  });
});
```
