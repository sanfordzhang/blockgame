const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');

class AIService {
  constructor() {
    this.aiPlayers = new Map(); // playerId -> { difficulty, handsPlayed, maxHands, stats }
    // On macOS with mixed architectures, prefer arch -arm64 python3
    // On Linux, use venv python if available
    const venvPython = path.join(__dirname, '..', '..', '..', 'ai_venv', 'bin', 'python3');
    if (process.platform === 'darwin') {
      this.pythonPath = '/usr/bin/arch';
      this.pythonArgs = ['-arm64', 'python3'];
    } else if (require('fs').existsSync(venvPython)) {
      this.pythonPath = venvPython;
      this.pythonArgs = [];
    } else {
      this.pythonPath = 'python3';
      this.pythonArgs = [];
    }
    this.enginePath = path.join(__dirname, '..', '..', '..', 'ai_engine', 'decision_engine.py');

    this.worker = null;
    this.workerReady = false;
    this.workerStartPromise = null;
    this.pendingRequests = new Map();
    this.responseBuffer = '';
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartTimer = null;
    this.startTimeoutHandle = null;
    this.shuttingDown = false;
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
      return false;
    }
    return true;
  }

  updateStats(playerId, action) {
    const config = this.aiPlayers.get(playerId);
    if (!config) return;
    const key = action + 's';
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

  async getAIDecision(playerId, gameState, timeout = 8000) {
    const difficulty = this.getDifficulty(playerId);
    // Give more time for NFSP model (hard/expert) on first load
    const effectiveTimeout = (difficulty === 'hard' || difficulty === 'expert') ? Math.max(timeout, 15000) : timeout;

    try {
      const decision = await this._sendRequest({ ...gameState, difficulty }, effectiveTimeout);
      this.updateStats(playerId, decision.action);
      console.log(`[AI] Decision for ${playerId}: ${decision.action} (${decision.confidence}) in ${decision.decision_time_ms}ms`);
      return decision;
    } catch (err) {
      console.error(`[AI] Error getting decision: ${err.message}`);
      return this._fallbackDecision(gameState, err.message);
    }
  }

  async getSuggestion(gameState, difficulty = 'hard') {
    try {
      // NFSP model needs more time, especially on first load
      const timeout = (difficulty === 'hard' || difficulty === 'expert') ? 15000 : 5000;
      return await this._sendRequest({ ...gameState, difficulty }, timeout);
    } catch (err) {
      return this._fallbackDecision(gameState, err.message);
    }
  }

  async preload() {
    await this._ensureWorker();
  }

  async shutdown() {
    this.shuttingDown = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const worker = this.worker;
    this.worker = null;
    this.workerReady = false;
    this.workerStartPromise = null;

    if (!worker) return;

    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('AI worker shutting down'));
      this.pendingRequests.delete(requestId);
    }

    try {
      worker.stdin.write(JSON.stringify({ command: 'shutdown', request_id: crypto.randomUUID() }) + '\n');
    } catch (err) {
      // Ignore and fall through to kill.
    }

    await new Promise((resolve) => {
      const forceKill = setTimeout(() => {
        if (!worker.killed) worker.kill();
        resolve();
      }, 1000);

      worker.once('close', () => {
        clearTimeout(forceKill);
        resolve();
      });
    });
  }

  _ensureWorker() {
    if (this.worker && this.workerReady) {
      return Promise.resolve();
    }

    if (this.workerStartPromise) {
      return this.workerStartPromise;
    }

    this.shuttingDown = false;
    this.workerStartPromise = new Promise((resolve, reject) => {
      console.log('[AI Worker] Starting persistent Python worker...');

      const worker = spawn(this.pythonPath, [...this.pythonArgs, this.enginePath, '--worker'], {
        cwd: path.dirname(this.enginePath),
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.worker = worker;
      this.workerReady = false;
      this.responseBuffer = '';

      const cleanupStart = () => {
        if (this.startTimeoutHandle) {
          clearTimeout(this.startTimeoutHandle);
          this.startTimeoutHandle = null;
        }
      };

      this.startTimeoutHandle = setTimeout(() => {
        cleanupStart();
        this.workerStartPromise = null;
        if (this.worker === worker && !this.workerReady) {
          worker.kill();
        }
        reject(new Error('AI worker startup timeout'));
      }, 30000);

      worker.stdout.on('data', (data) => this._processStdout(data, resolve, cleanupStart));

      worker.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) console.error(`[AI Worker] ${message}`);
      });

      worker.on('error', (err) => {
        cleanupStart();
        if (this.worker === worker) {
          this.worker = null;
          this.workerReady = false;
        }
        this.workerStartPromise = null;
        reject(err);
      });

      worker.on('close', (code, signal) => {
        cleanupStart();
        const wasStarting = this.workerStartPromise !== null;
        if (this.worker === worker) {
          this.worker = null;
          this.workerReady = false;
        }
        this.workerStartPromise = null;

        for (const [requestId, pending] of this.pendingRequests) {
          clearTimeout(pending.timer);
          pending.reject(new Error(`AI worker exited (${code ?? 'null'}${signal ? `, ${signal}` : ''})`));
          this.pendingRequests.delete(requestId);
        }

        if (!this.shuttingDown) {
          console.warn(`[AI Worker] exited with code=${code} signal=${signal || 'none'}`);
          this._scheduleRestart();
        }

        if (wasStarting && !this.shuttingDown && code !== 0) {
          reject(new Error(`AI worker failed during startup (${code ?? 'null'})`));
        }
      });
    });

    return this.workerStartPromise;
  }

  _processStdout(data, resolveStart, cleanupStart) {
    this.responseBuffer += data.toString();
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let response;
      try {
        response = JSON.parse(line);
      } catch (err) {
        console.warn('[AI Worker] Ignoring non-JSON stdout:', line);
        continue;
      }

      if (response.status === 'loading') {
        console.log('[AI Worker] Loading model:', response.message || '');
        continue;
      }

      if (response.status === 'ready') {
        cleanupStart();
        this.workerReady = true;
        this.restartAttempts = 0;
        this.workerStartPromise = null;
        if (response.preloaded) {
          console.log(`[AI Worker] Ready with preloaded model: ${response.preloaded}`);
        } else {
          console.log('[AI Worker] Ready');
        }
        if (response.preload_error) {
          console.warn(`[AI Worker] Preload warning: ${response.preload_error}`);
        }
        resolveStart();
        continue;
      }

      const requestId = response.request_id;
      if (!requestId) {
        console.warn('[AI Worker] Response missing request_id:', response);
        continue;
      }

      const pending = this.pendingRequests.get(requestId);
      if (!pending) continue;

      clearTimeout(pending.timer);
      this.pendingRequests.delete(requestId);

      if (response.error) {
        pending.reject(new Error(response.error));
      } else {
        delete response.request_id;
        pending.resolve(response);
      }
    }
  }

  _scheduleRestart() {
    if (this.shuttingDown || this.restartTimer) return;
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error('[AI Worker] Max restart attempts reached');
      return;
    }

    const delay = Math.min(1000 * (2 ** this.restartAttempts), 10000);
    this.restartAttempts += 1;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this._ensureWorker().catch((err) => {
        console.error(`[AI Worker] Restart failed: ${err.message}`);
      });
    }, delay);
  }

  async _sendRequest(payload, timeout) {
    await this._ensureWorker();

    if (!this.worker || !this.workerReady) {
      throw new Error('AI worker unavailable');
    }

    const requestId = crypto.randomUUID();
    const request = JSON.stringify({ ...payload, request_id: requestId }) + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('AI worker request timeout'));
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      try {
        this.worker.stdin.write(request);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }

  _fallbackDecision(gameState, errorMessage = 'Python unavailable') {
    const callAmount = gameState.callAmount || gameState.call_amount || 0;
    console.warn(`[AI] Using fallback decision: ${errorMessage}`);
    return {
      action: callAmount === 0 ? 'check' : 'fold',
      amount: 0,
      confidence: 0,
      reason: `AI engine unavailable: ${errorMessage}`,
      fallback: true
    };
  }
}

module.exports = new AIService();
