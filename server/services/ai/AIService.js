const { spawn } = require('child_process');
const path = require('path');

class AIService {
  constructor() {
    this.aiPlayers = new Map(); // playerId -> { difficulty, handsPlayed, maxHands, stats }
    // On macOS with mixed architectures, prefer arch -arm64 python3
    this.pythonPath = process.platform === 'darwin' ? '/usr/bin/arch' : 'python3';
    this.pythonArgs = process.platform === 'darwin' ? ['-arm64', 'python3'] : [];
    this.enginePath = path.join(__dirname, '..', '..', '..', 'ai_engine', 'decision_engine.py');
  }

  enableAI(playerId, difficulty = 'medium', maxHands = 100) {
    this.aiPlayers.set(playerId, {
      difficulty,
      handsPlayed: 0,
      maxHands,
      enabled: true,
      enabledAt: Date.now(),
      stats: { wins: 0, losses: 0, folds: 0, raises: 0, calls: 0, checks: 0 }
    });
    console.log(`[AI] Enabled for player ${playerId}, difficulty: ${difficulty}`);
    return { success: true, playerId, difficulty };
  }

  disableAI(playerId) {
    const config = this.aiPlayers.get(playerId);
    this.aiPlayers.delete(playerId);
    console.log(`[AI] Disabled for player ${playerId}`);
    return { success: true, playerId, stats: config?.stats || {} };
  }

  isAIEnabled(playerId) {
    const config = this.aiPlayers.get(playerId);
    return config?.enabled || false;
  }

  getDifficulty(playerId) {
    return this.aiPlayers.get(playerId)?.difficulty || 'medium';
  }

  incrementHands(playerId) {
    const config = this.aiPlayers.get(playerId);
    if (!config) return false;
    config.handsPlayed++;
    if (config.handsPlayed >= config.maxHands) {
      console.log(`[AI] Auto-disabling for ${playerId} after ${config.handsPlayed} hands`);
      config.enabled = false;
      return false; // signal to disable
    }
    return true;
  }

  updateStats(playerId, action) {
    const config = this.aiPlayers.get(playerId);
    if (!config) return;
    const key = action + 's'; // fold->folds, raise->raises
    if (config.stats[key] !== undefined) config.stats[key]++;
  }

  getStats(playerId) {
    const config = this.aiPlayers.get(playerId);
    if (!config) return null;
    return {
      playerId,
      difficulty: config.difficulty,
      handsPlayed: config.handsPlayed,
      maxHands: config.maxHands,
      enabled: config.enabled,
      enabledAt: config.enabledAt,
      ...config.stats
    };
  }

  async getAIDecision(playerId, gameState, timeout = 5000) {
    const difficulty = this.getDifficulty(playerId);
    const input = JSON.stringify({ ...gameState, difficulty });

    try {
      const result = await this._callPython(input, timeout);
      const decision = JSON.parse(result);
      this.updateStats(playerId, decision.action);
      console.log(`[AI] Decision for ${playerId}: ${decision.action} (${decision.confidence})`);
      return decision;
    } catch (err) {
      console.error(`[AI] Error getting decision: ${err.message}`);
      return this._fallbackDecision(gameState);
    }
  }

  async getSuggestion(gameState, difficulty = 'hard') {
    const input = JSON.stringify({ ...gameState, difficulty });
    try {
      const result = await this._callPython(input, 5000);
      return JSON.parse(result);
    } catch (err) {
      return this._fallbackDecision(gameState);
    }
  }

  _callPython(input, timeout) {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [...this.pythonArgs, this.enginePath], {
        cwd: path.dirname(this.enginePath),
        timeout
      });

      let stdout = '';
      let stderr = '';

      python.stdin.write(input);
      python.stdin.end();

      python.stdout.on('data', (data) => { stdout += data.toString(); });
      python.stderr.on('data', (data) => { stderr += data.toString(); });

      const timer = setTimeout(() => {
        python.kill();
        reject(new Error('Python timeout'));
      }, timeout);

      python.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0 && stdout.trim()) {
          // Filter out INFO lines from rlcard
          const lines = stdout.trim().split('\n');
          const jsonLine = lines.filter(l => l.startsWith('{'))[0] || lines[lines.length - 1];
          resolve(jsonLine);
        } else {
          reject(new Error(`Python exit ${code}: ${stderr.slice(0, 200)}`));
        }
      });

      python.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  _fallbackDecision(gameState) {
    const callAmount = gameState.callAmount || gameState.call_amount || 0;
    return {
      action: callAmount === 0 ? 'check' : 'fold',
      amount: 0,
      confidence: 0,
      reason: 'Fallback: Python unavailable'
    };
  }
}

module.exports = new AIService();
