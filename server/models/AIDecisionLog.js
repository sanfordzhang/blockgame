const mongoose = require('mongoose');

const aiDecisionLogSchema = new mongoose.Schema({
    gameId: { type: String, index: true },
    handId: { type: String },
    playerId: { type: String, required: true, index: true },
    decision: {
        action: { type: String, enum: ['fold', 'check', 'call', 'raise'] },
        amount: { type: Number, default: 0 },
        confidence: { type: Number, default: 0 },
        reason: { type: String },
    },
    gameState: {
        hand: [String],
        board: [String],
        pot: Number,
        callAmount: Number,
        stack: Number,
    },
    decisionTimeMs: { type: Number },
    difficulty: { type: String },
}, { timestamps: true });

aiDecisionLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AIDecisionLog', aiDecisionLogSchema);
