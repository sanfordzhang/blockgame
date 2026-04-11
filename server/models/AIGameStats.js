const mongoose = require('mongoose');

const aiGameStatsSchema = new mongoose.Schema({
    playerId: { type: String, required: true, index: true },
    handsPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    folds: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
    raises: { type: Number, default: 0 },
    checks: { type: Number, default: 0 },
    avgDecisionTimeMs: { type: Number, default: 0 },
    lastPlayedAt: { type: Date, default: null },
}, { timestamps: true });

aiGameStatsSchema.virtual('winRate').get(function() {
    if (this.handsPlayed === 0) return 0;
    return (this.wins / this.handsPlayed * 100).toFixed(1);
});

aiGameStatsSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('AIGameStats', aiGameStatsSchema);
