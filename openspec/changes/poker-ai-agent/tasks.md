# Poker AI Agent - Implementation Tasks

## Design Decisions (Updated)

- **RLCard 集成**: 使用 RLCard AI 模型，无需自研规则引擎
- **Python 模块**: Node.js 通过子进程调用 Python AI 引擎
- **模型训练**: 支持使用真实游戏数据持续训练优化模型
- **锦标赛支持**: 允许锦标赛中使用AI托管（展示AI能力）
- **NFT成就**: AI参与的手牌正常计入NFT成就，不标记AI辅助

## Implementation Phases

| Phase | 内容 | 预估时间 |
|-------|------|----------|
| Phase 1 | Python AI 模块 + 基础集成 | 1-2天 |
| Phase 2 | Node.js 服务 + Socket 集成 | 1-2天 |
| Phase 3 | 高级模型 + 前端集成 | 2-3天 |
| Phase 4 | 测试 + 数据收集 | 2-3天 |

---

## 1. Python AI 模块

- [ ] 1.1 Create `ai_engine/` directory structure
- [ ] 1.2 Create `ai_engine/requirements.txt` with dependencies:
  - rlcard>=1.0.7
  - torch>=1.10.0
  - numpy>=1.21.0
- [ ] 1.3 Install Python dependencies: `pip install -r requirements.txt`
- [ ] 1.4 Create `ai_engine/__init__.py`
- [ ] 1.5 Create `ai_engine/rlcard_agent.py` - RLCard Agent 封装
- [ ] 1.6 Create `ai_engine/decision_engine.py` - 决策引擎主入口
- [ ] 1.7 Create `ai_engine/game_converter.py` - 游戏状态转换
- [ ] 1.8 Test Python module: `python3 rlcard_agent.py init medium`

## 2. AI Agent 实现

- [ ] 2.1 Implement `RandomAgent` wrapper (easy difficulty)
- [ ] 2.2 Implement `RuleBasedAgent` (medium difficulty)
- [ ] 2.3 Implement `CFRPretrainedAgent` (hard difficulty)
- [ ] 2.4 Implement `DQNAgent` / `PPOAgent` (expert difficulty)
- [ ] 2.5 Implement game state converter (Node.js → RLCard format)
- [ ] 2.6 Implement action converter (RLCard → Node.js format)
- [ ] 2.7 Add fallback decision logic for errors/timeout

## 3. Node.js AI Service

- [ ] 3.1 Create `server/services/ai/AIService.js`
- [ ] 3.2 Implement `getAIDecision()` method with Python subprocess
- [ ] 3.3 Implement `enableAI()` and `disableAI()` methods
- [ ] 3.4 Implement `getSuggestion()` method
- [ ] 3.5 Implement `getStats()` method
- [ ] 3.6 Add decision caching for performance
- [ ] 3.7 Add timeout handling (50ms max)
- [ ] 3.8 Add fallback decision when Python unavailable
- [ ] 3.9 Add comprehensive logging for AI decisions

## 4. Socket 事件集成

- [ ] 4.1 Add AI events to `server/pokergame/actions.js`:
  - CS_AI托管_ENABLE / SC_AI托管_ENABLED
  - CS_AI托管_DISABLE / SC_AI托管_DISABLED
  - CS_AI托管_STATS / SC_AI托管_STATS
  - SC_AI托管_ACTION
  - CS_GET_SUGGESTION / SC_SUGGESTION
- [ ] 4.2 Create `server/socket/aiHandler.js`
- [ ] 4.3 Implement `initAIHandlers()` for socket events
- [ ] 4.4 Implement `executeAIAction()` for auto-play
- [ ] 4.5 Modify `server/socket/index.js` to integrate AI handlers
- [ ] 4.6 Add AI托管 check in `changeTurnAndBroadcast()`

## 5. 游戏集成

- [ ] 5.1 Modify `server/pokergame/Seat.js`:
  - Add `isAI` field
  - Add `aiLevel` field
  - Add `aiEnabledAt` timestamp
- [ ] 5.2 Modify `server/pokergame/Table.js`:
  - Add AI player check in turn management
  - Add AI action execution logic
- [ ] 5.3 Ensure AI actions don't trigger blockchain operations
- [ ] 5.4 Add AI decision logging to game history

## 6. 前端 AI 控制面板

- [ ] 6.1 Create `src/components/game/AIControlPanel.js`
- [ ] 6.2 Add AI enable/disable toggle button
- [ ] 6.3 Add AI difficulty selector dropdown
- [ ] 6.4 Add AI status indicator (enabled/disabled)
- [ ] 6.5 Add max hands input field
- [ ] 6.6 Add CSS styling for AI control panel
- [ ] 6.7 Integrate with GameState context

## 7. 前端决策建议组件

- [ ] 7.1 Create `src/components/game/DecisionSuggestion.js`
- [ ] 7.2 Display recommended action with confidence
- [ ] 7.3 Display win probability estimate
- [ ] 7.4 Display reasoning text (optional)
- [ ] 7.5 Add "Get Suggestion" button to game UI
- [ ] 7.6 Add styling for suggestion display

## 8. 前端状态管理

- [ ] 8.1 Add AI state to GameState context:
  ```javascript
  {
    enabled: false,
    difficulty: 'medium',
    handsPlayed: 0,
    maxHands: 100
  }
  ```
- [ ] 8.2 Implement `enableAI托管()` action
- [ ] 8.3 Implement `disableAI托管()` action
- [ ] 8.4 Handle `SC_AI托管_ENABLED` event
- [ ] 8.5 Handle `SC_AI托管_DISABLED` event
- [ ] 8.6 Handle `SC_AI托管_ACTION` notification
- [ ] 8.7 Handle `SC_SUGGESTION` event

## 9. 数据库模型

- [ ] 9.1 Create `server/models/AIConfig.js` schema:
  - playerId
  - difficulty
  - enabled
  - maxHands
  - handsPlayed
  - createdAt / updatedAt
- [ ] 9.2 Create `server/models/AIGameStats.js` schema:
  - playerId
  - handsPlayed
  - winRate
  - avgDecisionTime
  - lastPlayedAt
- [ ] 9.3 Create `server/models/AIDecisionLog.js` schema:
  - gameId
  - handId
  - playerId
  - decision
  - reasoning
  - confidence
  - timestamp
- [ ] 9.4 Add AI fields to existing Player model

## 10. 模型训练相关

- [ ] 10.1 Create `ai_engine/training/` directory
- [ ] 10.2 Create `ai_engine/training/collect_data.py` - 数据收集脚本
- [ ] 10.3 Create `ai_engine/training/train_cfr.py` - CFR 训练脚本
- [ ] 10.4 Create `ai_engine/training/train_dqn.py` - DQN 训练脚本
- [ ] 10.5 Create `ai_engine/training/evaluate.py` - 模型评估脚本
- [ ] 10.6 Create `ai_engine/training/analyze_game_data.py` - 数据分析
- [ ] 10.7 Create `ai_engine/models/` directory for pre-trained models
- [ ] 10.8 Download/create initial pre-trained models

## 11. 数据收集集成

- [ ] 11.1 Create `server/config/ai_training.js` configuration
- [ ] 11.2 Add game data collection hooks in Table.js
- [ ] 11.3 Implement data anonymization
- [ ] 11.4 Set up training_data/ directory
- [ ] 11.5 Add data collection toggle in server config

## 12. 单元测试

- [ ] 12.1 Create `tests/ai/rlcard_agent.test.js`
  - Test action output format
  - Test timeout handling
  - Test fallback decision
- [ ] 12.2 Create `tests/ai/game_converter.test.js`
  - Test state conversion
  - Test action conversion
- [ ] 12.3 Create `tests/ai/AIService.test.js`
  - Test enable/disable AI
  - Test getAIDecision
  - Test getSuggestion
  - Test statistics tracking

## 13. 集成测试

- [ ] 13.1 Create `tests/ai/integration.test.js`
  - Test AI托管 enable/disable flow
  - Test auto-play when AI托管 enabled
  - Test max hands auto-disable
  - Test Node.js ↔ Python communication
- [ ] 13.2 Test Socket events integration
- [ ] 13.3 Test game flow with AI player
- [ ] 13.4 Test multiple AI players at same table

## 14. E2E 测试

- [ ] 14.1 Create `tests/e2e/ai_gameplay.e2e.js`
- [ ] 14.2 Test: Player1 enables AI托管
- [ ] 14.3 Test: Player2 joins and plays against AI
- [ ] 14.4 Test: Complete game with AI player
- [ ] 14.5 Test: AI decision suggestion feature
- [ ] 14.6 Test: AI statistics display
- [ ] 14.7 Test: AI托管 auto-disable after max hands
- [ ] 14.8 Test: AI in tournament mode
- [ ] 14.9 Take screenshots and verify logs

## 15. 性能测试

- [ ] 15.1 Measure Python subprocess latency
- [ ] 15.2 Test decision time < 100ms requirement
- [ ] 15.3 Test concurrent AI players (50+)
- [ ] 15.4 Test memory usage with multiple AI players
- [ ] 15.5 Profile and optimize if needed

## 16. 文档

- [ ] 16.1 Write Python AI Engine README
- [ ] 16.2 Write installation guide for Python dependencies
- [ ] 16.3 Write API documentation for AIService
- [ ] 16.4 Write training guide for model fine-tuning
- [ ] 16.5 Write sample preparation guide
- [ ] 16.6 Update project README with AI feature

## 17. 部署准备

- [ ] 17.1 Add feature flag for AI functionality
- [ ] 17.2 Create Python virtual environment setup script
- [ ] 17.3 Update environment configuration
- [ ] 17.4 Test deployment on testnet
- [ ] 17.5 Monitor AI performance metrics
- [ ] 17.6 Set up model versioning

## 18. 上线后监控

- [ ] 18.1 Monitor AI decision logs
- [ ] 18.2 Collect user feedback on AI托管
- [ ] 18.3 Track AI win rate statistics
- [ ] 18.4 Monitor Python process health
- [ ] 18.5 Tune AI parameters based on real games
- [ ] 18.6 Schedule periodic model retraining

---

## Test Case Details

### Unit Tests

```javascript
// tests/ai/rlcard_agent.test.js
describe('RLCard Agent', () => {
  test('should return valid action for pre-flop', async () => {
    const state = {
      hand: ['Ah', 'Kd'],
      board: [],
      pot: 100,
      callAmount: 0,
      stack: 1000,
      position: 'button',
      numPlayers: 2
    };
    const decision = await aiService.getAIDecision('test-player', state);
    expect(['fold', 'check', 'call', 'raise']).toContain(decision.action);
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
    expect(decision.confidence).toBeLessThanOrEqual(1);
    expect(decision.reason).toBeDefined();
  });
  
  test('should handle post-flop scenario', async () => {
    const state = {
      hand: ['Qh', 'Jh'],
      board: ['Th', '9h', '2c'],
      pot: 300,
      callAmount: 100,
      stack: 800,
      position: 'sb',
      numPlayers: 2
    };
    const decision = await aiService.getAIDecision('test-player', state);
    expect(decision.action).toBeDefined();
  });
  
  test('should return fallback on timeout', async () => {
    // Simulate timeout
    const decision = await aiService.getAIDecision('timeout-test', {
      hand: ['2c', '7d'],
      board: [],
      pot: 1000,
      callAmount: 500,
      stack: 100
    }, { timeout: 1 }); // 1ms timeout
    expect(['check', 'fold']).toContain(decision.action);
  });
  
  test('should handle Python errors gracefully', async () => {
    // Mock Python error
    const decision = await aiService.getAIDecision('error-test', invalidState);
    expect(decision.action).toBeDefined();
    expect(decision.reason).toContain('fallback');
  });
});
```

### Integration Tests

```javascript
// tests/ai/integration.test.js
describe('AI托管 Integration', () => {
  beforeEach(async () => {
    // Setup test table and players
  });
  
  test('should auto-play when AI托管 enabled', async () => {
    // 1. Player joins table
    const player = await joinTable('player1');
    
    // 2. Enable AI托管
    socket.emit('CS_AI托管_ENABLE', { difficulty: 'medium', maxHands: 10 });
    
    // 3. Wait for AI to make decision
    const action = await waitForEvent('SC_AI托管_ACTION');
    expect(action.action).toBeDefined();
  });
  
  test('should stop AI托管 after max hands', async () => {
    // 1. Enable AI托管 with maxHands = 2
    socket.emit('CS_AI托管_ENABLE', { difficulty: 'easy', maxHands: 2 });
    
    // 2. Play 2 hands
    await playHand();
    await playHand();
    
    // 3. Verify AI托管 is disabled
    const stats = await getAIStats();
    expect(stats.enabled).toBe(false);
  });
  
  test('should work with multiple AI players', async () => {
    // 1. Two players enable AI托管
    await enableAI('player1', 'medium');
    await enableAI('player2', 'hard');
    
    // 2. Verify both AI players make decisions
    const actions = await playFullGame();
    expect(actions.length).toBeGreaterThan(0);
  });
});
```

### E2E Tests

```javascript
// tests/e2e/ai_gameplay.e2e.js
describe('AI Gameplay E2E', () => {
  let browser, page1, page2;
  
  beforeAll(async () => {
    // Connect to Chrome CDP
    browser = await connectToChrome(9222);
  });
  
  test('AI vs Human game flow', async () => {
    // 1. Player1 connects wallet, joins table
    await page1.goto('http://127.0.0.1:3001/play');
    await connectWallet(page1, PLAYER1_PRIVATE_KEY);
    await joinTable(page1);
    
    // 2. Player1 enables AI托管
    await clickAIControlButton(page1);
    await selectDifficulty(page1, 'medium');
    await clickEnableAI(page1);
    
    // 3. Verify AI托管 enabled
    const status = await getAIStatus(page1);
    expect(status.enabled).toBe(true);
    
    // 4. Player2 joins table
    await page2.goto('http://127.0.0.1:3001/play');
    await connectWallet(page2, PLAYER2_PRIVATE_KEY);
    await joinTable(page2);
    
    // 5. Verify AI makes automatic decisions
    await waitForAIToPlay(page1);
    
    // 6. Player2 makes manual decision
    await clickCall(page2);
    
    // 7. Complete the hand
    await completeHand(page1, page2);
    
    // 8. Take screenshot and verify
    const screenshot = await takeScreenshot(page1);
    expect(screenshot).toBeDefined();
    
    // 9. Check server logs for AI decisions
    const logs = await getServerLogs();
    expect(logs).toContain('[AI]');
  });
  
  test('AI decision suggestion feature', async () => {
    // 1. Player joins table
    await joinTable(page1);
    
    // 2. Click "Get Suggestion" button
    await clickGetSuggestion(page1);
    
    // 3. Verify suggestion displayed
    const suggestion = await getSuggestionText(page1);
    expect(suggestion.action).toBeDefined();
    expect(suggestion.winProbability).toBeDefined();
    expect(suggestion.reasoning).toBeDefined();
  });
});
```

---

## Success Criteria

| 指标 | 目标 | 验证方式 |
|------|------|----------|
| 决策延迟 | < 100ms | 性能测试 |
| 内存占用 | < 200MB | 监控系统 |
| 测试覆盖率 | > 80% | Jest coverage |
| E2E测试 | 全部通过 | Playwright |
| AI胜率 | > 55% (vs random) | 评估脚本 |
