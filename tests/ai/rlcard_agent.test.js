const { execSync } = require('child_process');
const path = require('path');

const ENGINE_DIR = path.join(__dirname, '..', '..', 'ai_engine');
const PYTHON = process.platform === 'darwin' ? 'arch -arm64 python3' : 'python3';

describe('RLCard Agent', () => {
  const runPython = (input, args = '') => {
    const result = execSync(
      `echo '${JSON.stringify(input)}' | ${PYTHON} decision_engine.py ${args}`,
      { cwd: ENGINE_DIR, timeout: 15000, encoding: 'utf-8', shell: '/bin/bash', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } }
    );
    // Filter out INFO lines from rlcard
    const lines = result.trim().split('\n');
    const jsonLine = lines.filter(l => l.startsWith('{')).pop() || lines.pop();
    return JSON.parse(jsonLine);
  };

  test('should return valid action for pre-flop (easy)', () => {
    const state = {
      hand: ['Ah', 'Kd'], board: [], pot: 100,
      callAmount: 0, stack: 1000, numPlayers: 2, difficulty: 'easy'
    };
    const decision = runPython(state);
    expect(['fold', 'check', 'call', 'raise']).toContain(decision.action);
    expect(decision.confidence).toBeDefined();
    expect(decision.reason).toBeDefined();
  });

  test('should return valid action for pre-flop (medium)', () => {
    const state = {
      hand: ['Ah', 'Kd'], board: [], pot: 100,
      callAmount: 0, stack: 1000, numPlayers: 2, difficulty: 'medium'
    };
    const decision = runPython(state);
    expect(['check', 'raise']).toContain(decision.action);
    expect(decision.confidence).toBeGreaterThan(0);
  });

  test('should fold weak hand facing large bet (medium)', () => {
    const state = {
      hand: ['2c', '7d'], board: ['Qs', 'Jc', 'Th'], pot: 500,
      callAmount: 400, stack: 800, numPlayers: 2, difficulty: 'medium'
    };
    const decision = runPython(state);
    expect(decision.action).toBe('fold');
  });

  test('should handle post-flop scenario', () => {
    const state = {
      hand: ['Qh', 'Jh'], board: ['Th', '9h', '2c'], pot: 300,
      callAmount: 100, stack: 800, numPlayers: 2, difficulty: 'medium'
    };
    const decision = runPython(state);
    expect(decision.action).toBeDefined();
  });

  test('should handle empty input gracefully', () => {
    const result = execSync(
      `echo '' | ${PYTHON} decision_engine.py`,
      { cwd: ENGINE_DIR, timeout: 10000, encoding: 'utf-8', shell: '/bin/bash' }
    );
    const decision = JSON.parse(result.trim().split('\n').pop());
    expect(['check', 'fold']).toContain(decision.action);
    expect(decision.reason).toContain('Fallback');
  });

  test('should handle invalid JSON gracefully', () => {
    const result = execSync(
      `echo 'not json' | ${PYTHON} decision_engine.py`,
      { cwd: ENGINE_DIR, timeout: 10000, encoding: 'utf-8', shell: '/bin/bash' }
    );
    const decision = JSON.parse(result.trim().split('\n').pop());
    expect(decision.action).toBeDefined();
    expect(decision.reason).toContain('Fallback');
  });

  test('should include decision_time_ms in output', () => {
    const state = {
      hand: ['Ah', 'Kd'], board: [], pot: 100,
      callAmount: 0, stack: 1000, difficulty: 'easy'
    };
    const decision = runPython(state);
    expect(decision.decision_time_ms).toBeDefined();
    expect(typeof decision.decision_time_ms).toBe('number');
  });

  test('init command should return agent info', () => {
    const result = execSync(
      `${PYTHON} rlcard_agent.py init --difficulty medium`,
      { cwd: ENGINE_DIR, timeout: 10000, encoding: 'utf-8', shell: '/bin/bash' }
    );
    const info = JSON.parse(result.trim());
    expect(info.status).toBe('ok');
    expect(info.difficulty).toBe('medium');
    expect(info.agent_type).toBe('RuleBasedAgent');
  });
});
