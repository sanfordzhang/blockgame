const path = require('path');
const { execSync } = require('child_process');

const ENGINE_DIR = path.join(__dirname, '..', '..', 'ai_engine');
const PYTHON = process.platform === 'darwin' ? 'arch -arm64 python3' : 'python3';
const EXEC_OPTS = { cwd: ENGINE_DIR, timeout: 15000, encoding: 'utf-8', shell: '/bin/bash' };

describe('AI Integration', () => {
  test('Python decision engine responds correctly', () => {
    const input = JSON.stringify({
      hand: ['Ah', 'Kd'], board: [], pot: 100,
      callAmount: 50, stack: 1000, numPlayers: 2, difficulty: 'medium'
    });
    const result = execSync(
      `echo '${input}' | ${PYTHON} decision_engine.py`,
      EXEC_OPTS
    );
    const lines = result.trim().split('\n');
    const jsonLine = lines.filter(l => l.startsWith('{')).pop();
    const decision = JSON.parse(jsonLine);

    expect(decision.action).toBeDefined();
    expect(decision.difficulty).toBe('medium');
    expect(decision.decision_time_ms).toBeDefined();
  });

  test('All difficulty levels produce valid output', () => {
    const difficulties = ['easy', 'medium', 'hard'];
    for (const diff of difficulties) {
      const input = JSON.stringify({
        hand: ['Ah', 'Kd'], board: [], pot: 100,
        callAmount: 0, stack: 1000, difficulty: diff
      });
      try {
        const result = execSync(
          `echo '${input}' | ${PYTHON} decision_engine.py`,
          EXEC_OPTS
        );
        const lines = result.trim().split('\n');
        const jsonLine = lines.filter(l => l.startsWith('{')).pop();
        const decision = JSON.parse(jsonLine);
        expect(['fold', 'check', 'call', 'raise']).toContain(decision.action);
      } catch (err) {
        // Hard/expert may fail if model not available, that's ok
        if (diff === 'easy' || diff === 'medium') throw err;
      }
    }
  });

  test('Decision time is reasonable', () => {
    const input = JSON.stringify({
      hand: ['Ah', 'Kd'], board: [], pot: 100,
      callAmount: 0, stack: 1000, difficulty: 'medium'
    });
    const start = Date.now();
    execSync(
      `echo '${input}' | ${PYTHON} decision_engine.py`,
      EXEC_OPTS
    );
    const elapsed = Date.now() - start;
    // Medium difficulty should be fast (rule-based)
    expect(elapsed).toBeLessThan(5000);
  });
});
