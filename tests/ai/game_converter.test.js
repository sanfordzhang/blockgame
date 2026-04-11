const { execSync } = require('child_process');
const path = require('path');

const ENGINE_DIR = path.join(__dirname, '..', '..', 'ai_engine');
const PYTHON = process.platform === 'darwin' ? 'arch -arm64 python3' : 'python3';

describe('Game Converter', () => {
  const testConverter = (testCode) => {
    const result = execSync(
      `${PYTHON} -c "${testCode}"`,
      { cwd: ENGINE_DIR, timeout: 5000, encoding: 'utf-8', shell: '/bin/bash' }
    );
    return result.trim();
  };

  test('should convert string cards', () => {
    const result = testConverter(
      "from game_converter import convert_card; print(convert_card('Ah'))"
    );
    expect(result).toBe('AH');
  });

  test('should convert 10 cards', () => {
    const result = testConverter(
      "from game_converter import convert_card; print(convert_card('10h'))"
    );
    expect(result).toBe('TH');
  });

  test('should convert object cards', () => {
    const result = testConverter(
      "from game_converter import convert_card; print(convert_card({'rank': 'A', 'suit': 'hearts'}))"
    );
    expect(result).toBe('AH');
  });

  test('should convert action to fold', () => {
    const result = testConverter(
      "from game_converter import convert_action_to_nodejs; import json; print(json.dumps(convert_action_to_nodejs(0, {'call_amount': 100, 'pot': 200, 'stack': 500, 'min_raise': 50})))"
    );
    const action = JSON.parse(result);
    expect(action.action).toBe('fold');
  });

  test('should convert action to check when free', () => {
    const result = testConverter(
      "from game_converter import convert_action_to_nodejs; import json; print(json.dumps(convert_action_to_nodejs(0, {'call_amount': 0, 'pot': 200, 'stack': 500, 'min_raise': 50})))"
    );
    const action = JSON.parse(result);
    expect(action.action).toBe('check');
  });

  test('should convert action to all-in', () => {
    const result = testConverter(
      "from game_converter import convert_action_to_nodejs; import json; print(json.dumps(convert_action_to_nodejs(4, {'call_amount': 0, 'pot': 200, 'stack': 500, 'min_raise': 50})))"
    );
    const action = JSON.parse(result);
    expect(action.action).toBe('raise');
    expect(action.amount).toBe(500);
  });
});
