/**
 * AI Memory System — MongoDB-backed persistent memory for AI agents
 * Stores opponent behavior patterns, updates profiles, generates evolution reports.
 */

const mongoose = require('mongoose');

// Schema for opponent behavior patterns
const AIMemorySchema = new mongoose.Schema({
    playerId: { type: String, index: true },
    opponentAddress: { type: String, index: true },
    
    // Behavior tracking
    handsPlayed: { type: Number, default: 0 },
    vpipPercent: { type: Number, default: 0 },     // Voluntarily Put $ In Pot
    pfrPercent: { type: Number, default: 0 },        // Pre-Flop Raise
    threeBetPercent: { type: Number, default: 0 },   // 3-bet frequency
    cbetPercent: { type: Number, default: 0 },       // Continuation bet
    foldToCbetPercent: { type: Number, default: 0 },
    aggressionFactor: { type: Number, default: 1.0 }, // Aggression factor
    
    // Hand preferences
    preflopRaiseRanges: { type: [String], default: [] },
    commonPostflopActions: { type: [String], default: [] },
    
    // Profile classification
    playerType: { 
        type: String, 
        enum: ['unknown', 'tight-passive', 'tight-aggressive', 'loose-passive', 'loose-aggressive', 'maniac', 'calling-station'],
        default: 'unknown'
    },
    confidenceScore: { type: Number, default: 0 },  // How confident we are in this classification
    
    // Meta
    lastUpdated: { type: Date, default: Date.now }
}, { collection: 'ai_memories' });

AIMemorySchema.index({ playerId: 1, opponentAddress: 1 }, { unique: true });

class AIMemorySystem {
    constructor() {
        this.model = null;
        this.initialized = false;
    }

    /**
     * Initialize with Mongoose connection
     */
    init(mongooseConnection) {
        if (mongooseConnection) {
            this.model = mongooseConnection.model('AIMemory', AIMemorySchema);
            this.initialized = true;
            console.log('[AIMemorySystem] ✅ Initialized');
        }
    }

    /**
     * Record a hand result and update opponent profile
     */
    async recordHand(playerId, opponentAddress, handData) {
        if (!this.initialized) return null;

        const { action, position, street, betSize, potSize } = handData;
        
        let memory = await this.model.findOne({ playerId, opponentAddress });
        
        if (!memory) {
            memory = new this.model({ playerId, opponentAddress });
        }

        // Update stats
        memory.handsPlayed += 1;

        // Track VPIP (voluntarily put money in pot)
        if (['raise', 'call', 'bet'].includes(action)) {
            memory.vpipPercent = this._runningAvg(memory.vpipPercent, memory.handsPlayed, 100);
        }

        // Track PFR (pre-flop raise)
        if (action === 'raise' && street === 'preflop') {
            memory.pfrPercent = this._runningAvg(memory.pfrPercent, memory.handsPlayed - 1, 100);
            
            if (betSize > potSize * 2) {
                memory.threeBetPercent = this._runningAvg(memory.threeBetPercent, memory.threeBetCount || 0, 100);
                memory.threeBetCount = (memory.threeBetCount || 0) + 1;
            }
        }

        // Track c-bet
        if (action === 'bet' && ['flop', 'turn'].includes(street)) {
            memory.cbetPercent = this._runningAvg(memory.cbetPercent, memory.cbetCount || 0, 100);
            memory.cbetCount = (memory.cbetCount || 0) + 1;
        }

        if (action === 'fold' && ['flop', 'turn'].includes(street)) {
            memory.foldToCbetPercent = this._runningAvg(memory.foldToCbetPercent, memory.foldToCbetCount || 0, 100);
            memory.foldToCbetCount = (memory.foldToCbetCount || 0) + 1;
        }

        // Update aggression factor
        const isAggressive = ['raise', 'bet'].includes(action);
        memory.aggressionFactor = this._runningAvg(
            memory.aggressionFactor,
            memory.handsPlayed - 1,
            isAggressive ? 3.0 : 0.5
        );

        // Reclassify player type based on updated stats
        memory.playerType = this._classifyPlayer(memory);
        memory.confidenceScore = Math.min(1.0, memory.handsPlayed / 50); // Confidence after 50+ hands
        memory.lastUpdated = new Date();

        return memory.save();
    }

    /**
     * Get opponent profile for AI decision making
     */
    async getOpponentProfile(opponentAddress) {
        if (!this.initialized) {
            return { playerType: 'unknown', confidenceScore: 0 };
        }

        const memories = await this.model.find({ opponentAddress }).sort('-lastUpdated').limit(10);

        if (memories.length === 0) {
            return { playerType: 'unknown', confidenceScore: 0 };
        }

        // Aggregate across all AI players who've seen this opponent
        const aggregated = {
            handsPlayed: 0,
            vpipPercent: 0,
            pfrPercent: 0,
            aggressionFactor: 0,
            playerTypes: {},
            confidenceScore: 0
        };

        for (const m of memories) {
            aggregated.handsPlayed += m.handsPlayed;
            aggregated.vpipPercent += m.vpipPercent;
            aggregated.pfrPercent += m.pfrPercent;
            aggregated.aggressionFactor += m.aggressionFactor;
            aggregated.playerTypes[m.playerType] = (aggregated.playerTypes[m.playerType] || 0) + 1;
        }

        const count = memories.length;
        aggregated.vpipPercent /= count;
        aggregated.pfrPercent /= count;
        aggregated.aggressionFactor /= count;

        // Most common classification
        const bestType = Object.entries(aggregated.playerTypes).sort((a, b) => b[1] - a[1])[0];
        aggregated.playerType = bestType ? bestType[0] : 'unknown';
        aggregated.confidenceScore = Math.min(1.0, aggregated.handsPlayed / 50);

        return aggregated;
    }

    /**
     * Generate strategy evolution report for an AI agent
     */
    async generateEvolutionReport(playerId, daysBack = 7) {
        if (!this.initialized) return null;

        const since = new Date(Date.now() - daysBack * 86400000);
        const records = await this.model.find({
            playerId,
            lastUpdated: { $gte: since }
        });

        const totalHands = records.reduce((sum, r) => sum + r.handsPlayed, 0);
        const opponentsTracked = records.length;
        const classified = records.filter(r => r.playerType !== 'unknown').length;

        const report = {
            playerId,
            periodDays: daysBack,
            generatedAt: new Date(),
            summary: {
                totalHandsAnalyzed: totalHands,
                uniqueOpponents: opponentsTracked,
                opponentsClassified: classified,
                classificationRate: opponentsTracked > 0 ? (classified / opponentsTracked * 100).toFixed(1) + '%' : 'N/A'
            },
            opponentProfiles: records.map(r => ({
                address: r.opponentAddress.slice(0, 10) + '...',
                type: r.playerType,
                confidence: (r.confidenceScore * 100).toFixed(0) + '%',
                handsVs: r.handsPlayed,
                vpip: r.vpipPercent.toFixed(0) + '%',
                aggression: r.aggressionFactor.toFixed(1)
            }))
        };

        return report;
    }

    // ========== Private Helpers ==========

    _runningAvg(currentValue, count, newValue) {
        if (count <= 0) return newValue;
        return (currentValue * count + newValue) / (count + 1);
    }

    _classifyPlayer(mem) {
        const v = mem.vpipPercent;
        const a = mem.aggregationFactor || mem.aggressionFactor;

        if (v < 20 && a < 1.5) return 'tight-passive';
        if (v < 25 && a >= 1.5) return 'tight-aggressive';
        if (v >= 40 && a < 1.2) return 'loose-passive';
        if (v >= 35 && a >= 1.8) return 'loose-aggressive';
        if (v >= 50 && a >= 2.5) return 'maniac';
        if (v >= 45 && a < 1.0) return 'calling-station';
        return 'unknown';
    }
}

module.exports = new AIMemorySystem();