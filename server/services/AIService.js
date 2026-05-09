/**
 * AIService - AI Poker Agent System (Node.js Bridge)
 * Manages Python AI engine subprocess via stdin/stdout JSON protocol
 */

const { spawn } = require('child_process');
const config = require('../config');

class AIService {
    constructor() {
        this.process = null;
        this.pid = null;
        this.isRunning = false;
        this.pendingRequests = new Map(); // requestId -> { resolve, reject, timer }
        this.requestCounter = 0;
        this.buffer = '';
        this.restartCount = 0;
        this.maxRestartsPerHour = 3;
        this.restartTimestamps = [];
        this.stats = {
            totalHandsPlayed: 0,
            totalDecisionsMade: 0,
            averageDecisionTimeMs: 0,
            decisionTimes: [],
            errors: 0
        };
    }

    /**
     * Spawn Python AI engine subprocess
     */
    spawnAIProcess() {
        if (!config.AI_ENABLED) {
            console.log('[AIService] AI disabled (AI_ENABLED=false)');
            return false;
        }

        if (this.process && !this.process.killed) {
            console.log('[AIService] Process already running, PID:', this.pid);
            return true;
        }

        // Check restart rate limiting
        const now = Date.now();
        this.restartTimestamps = this.restartTimestamps.filter(t => now - t < 3600000);
        if (this.restartTimestamps.length >= this.maxRestartsPerHour) {
            console.warn(`[AIService] Max restarts (${this.maxRestartsPerHour}/h) exceeded, giving up`);
            return false;
        }

        const pythonPath = config.AI_PROCESS_PATH || 'python3';
        const scriptPath = config.AI_SCRIPT || 'ai_engine/decision_engine.py';

        console.log(`[AIService] Spawning AI process: ${pythonPath} ${scriptPath}`);

        try {
            this.process = spawn(pythonPath, [scriptPath, '--mode', 'stdio'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
                env: { ...process.env, PYTHONUNBUFFERED: '1' }
            });

            this.pid = this.process.pid;
            this.isRunning = true;

            // Handle stdout responses from AI
            this.process.stdout.on('data', (data) => {
                this.buffer += data.toString();
                this._parseResponses();
            });

            // Handle stderr (logs/errors)
            this.process.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.log(`[AI:stderr] ${msg}`);
            });

            // Handle process exit
            this.process.on('exit', (code, signal) => {
                this.isRunning = false;
                this.pid = null;
                
                if (code !== 0 && code !== null) {
                    console.warn(`[AIService] Process exited with code ${code}, signal: ${signal}`);
                    this.stats.errors++;
                    
                    // Auto-restart
                    setTimeout(() => this.spawnAIProcess(), 2000);
                } else {
                    console.log('[AIService] Process exited normally');
                }
            });

            // Handle process error
            this.process.on('error', (err) => {
                console.error('[AIService] Process error:', err.message);
                this.isRunning = false;
            });

            this.restartTimestamps.push(now);
            console.log(`[AIService] AI engine started, PID: ${this.pid}`);

            return true;

        } catch (error) {
            console.error('[AIService] Failed to spawn process:', error.message);
            return false;
        }
    }

    /**
     * Request an action decision from the AI engine
     * @param {Object} gameState - Current game state
     * @returns {Promise<Object>} AI action response
     */
    async requestAction(gameState) {
        if (!this.isRunning || !this.process) {
            // If AI not available, auto-fold
            console.warn('[AIService] Not running, returning auto-fold');
            return { type: 'action', action: 'fold', amount: 0, confidence: 0, reasoning: 'AI unavailable' };
        }

        const requestId = ++this.requestCounter;
        const request = {
            type: 'request_action',
            id: requestId,
            ...gameState,
            timeout_ms: 10000 // Default timeout
        };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                resolve({
                    type: 'action',
                    action: 'fold',
                    amount: 0,
                    confidence: 0,
                    reasoning: 'Timeout - auto fold'
                });
            }, gameState.timeout_ms || 10000);

            this.pendingRequests.set(requestId, { resolve, reject, timer, startTime: Date.now() });

            try {
                this.process.stdin.write(JSON.stringify(request) + '\n');
            } catch (writeError) {
                clearTimeout(timer);
                this.pendingRequests.delete(requestId);
                resolve({ type: 'action', action: 'fold', amount: 0, confidence: 0, reasoning: 'Write error' });
            }
        });
    }

    /**
     * Parse buffered stdout data into complete JSON responses
     */
    _parseResponses() {
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
                const response = JSON.parse(trimmed);
                this._handleResponse(response);
            } catch (parseError) {
                console.warn(`[AIService] Failed to parse AI response: ${trimmed.slice(0, 100)}`);
            }
        }
    }

    /**
     * Handle a parsed AI response, routing it to the correct promise
     */
    _handleResponse(response) {
        const { id, type } = response;

        if (type === 'action') {
            const pending = this.pendingRequests.get(id);
            if (pending) {
                clearTimeout(pending.timer);
                this.pendingRequests.delete(id);
                
                // Track stats
                const elapsed = Date.now() - pending.startTime;
                this.stats.totalDecisionsMade++;
                this.stats.decisionTimes.push(elapsed);
                if (this.stats.decisionTimes.length > 100) {
                    this.stats.decisionTimes.shift();
                }
                this.stats.averageDecisionTimeMs = Math.round(
                    this.stats.decisionTimes.reduce((a, b) => a + b, 0) / this.stats.decisionTimes.length
                );

                pending.resolve(response);
            }
        } else if (type === 'error') {
            const pending = this.pendingRequests.get(id);
            if (pending) {
                clearTimeout(pending.timer);
                this.pendingRequests.delete(id);
                pending.resolve({
                    type: 'action',
                    action: 'fold',
                    amount: 0,
                    confidence: 0,
                    reasoning: `AI error: ${response.error || 'Unknown'}`
                });
            }
        }
    }

    /**
     * Gracefully shutdown AI process
     */
    shutdown() {
        if (this.process && !this.process.killed) {
            console.log('[AIService] Shutting down AI process...');
            
            // Send graceful shutdown signal
            try {
                this.process.stdin.write(JSON.stringify({ type: 'shutdown' }) + '\n');
            } catch (e) {}

            // Force kill after timeout
            setTimeout(() => {
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGTERM');
                }
            }, 5000);
        }

        this.isRunning = false;
        this.pid = null;
    }

    /**
     * AI Agent Socket Client - Simulates a socket player that uses AI decisions
     * Can be used to add AI players to tables
     */
    createSocketAgent(socketIO, tableId, agentName, difficulty) {
        const agent = {
            name: agentName || `AI_Bot_${Date.now().toString(36)}`,
            address: `ai_${agentName}_${Date.now().toString(36)}`,
            tableId,
            difficulty: difficulty || config.AI_DEFAULT_DIFFICULTY,
            isConnected: false,
            socket: null,

            join() {
                // Create a virtual socket connection
                // This would integrate with server/socket/index.js
                console.log(`[AISocketAgent] ${this.name} attempting to join table ${tableId}`);
                return this;
            },

            leave() {
                console.log(`[AISocketAgent] ${this.name} leaving table ${tableId}`);
                this.isConnected = false;
                return this;
            },

            async decide(gameState) {
                return requestAction({
                    ...gameState,
                    playerId: this.address,
                    difficulty: this.difficulty
                });
            }
        };

        return agent;
    }

    getStatus() {
        return {
            running: this.isRunning,
            pid: this.pid,
            uptime: this.isRunning ? process.uptime() : 0,
            activePlayers: 0, // Would track connected AI players
            totalHandsPlayed: this.stats.totalHandsPlayed,
            totalDecisionsMade: this.stats.totalDecisionsMade,
            averageDecisionTimeMs: this.stats.averageDecisionTimeMs,
            errors: this.stats.errors,
            restartCount: this.restartCount,
            modelLoaded: true // Placeholder - would check actual model loading
        };
    }
}

// Singleton
const instance = new AIService();
module.exports = instance;
module.exports.AIService = AIService;
