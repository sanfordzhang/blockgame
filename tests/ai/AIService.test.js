const path = require('path');

// Mock the AI Service
jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    const EventEmitter = require('events');
    const proc = new EventEmitter();
    proc.stdin = { write: jest.fn(), end: jest.fn() };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();

    // Simulate Python response
    setTimeout(() => {
      proc.stdout.emit('data', JSON.stringify({
        action: 'call', amount: 100, confidence: 0.7, reason: 'Test'
      }));
      proc.emit('close', 0);
    }, 10);

    return proc;
  })
}));

const AIService = require('../../server/services/ai/AIService');

describe('AIService', () => {
  beforeEach(() => {
    // Reset AI players
    AIService.aiPlayers.clear();
  });

  test('should enable AI for a player', () => {
    const result = AIService.enableAI('player1', 'hard', 50);
    expect(result.success).toBe(true);
    expect(result.difficulty).toBe('hard');
    expect(AIService.isAIEnabled('player1')).toBe(true);
  });

  test('should disable AI for a player', () => {
    AIService.enableAI('player1', 'medium');
    const result = AIService.disableAI('player1');
    expect(result.success).toBe(true);
    expect(AIService.isAIEnabled('player1')).toBe(false);
  });

  test('should track hands played', () => {
    AIService.enableAI('player1', 'medium', 3);
    expect(AIService.incrementHands('player1')).toBe(true);
    expect(AIService.incrementHands('player1')).toBe(true);
    expect(AIService.incrementHands('player1')).toBe(false); // max reached
  });

  test('should return stats', () => {
    AIService.enableAI('player1', 'hard', 100);
    AIService.updateStats('player1', 'fold');
    AIService.updateStats('player1', 'raise');
    const stats = AIService.getStats('player1');
    expect(stats.difficulty).toBe('hard');
    expect(stats.folds).toBe(1);
    expect(stats.raises).toBe(1);
  });

  test('should return null stats for unknown player', () => {
    expect(AIService.getStats('unknown')).toBeNull();
  });

  test('should return fallback when Python unavailable', () => {
    const fallback = AIService._fallbackDecision({ callAmount: 0 });
    expect(fallback.action).toBe('check');
    expect(fallback.confidence).toBe(0);
  });

  test('should return fold fallback when facing bet', () => {
    const fallback = AIService._fallbackDecision({ callAmount: 100 });
    expect(fallback.action).toBe('fold');
  });

  test('should get difficulty for enabled player', () => {
    AIService.enableAI('player1', 'expert');
    expect(AIService.getDifficulty('player1')).toBe('expert');
  });
});
