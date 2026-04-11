const mongoose = require('mongoose');

const aiConfigSchema = new mongoose.Schema({
    playerId: { type: String, required: true, index: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'expert'], default: 'medium' },
    enabled: { type: Boolean, default: false },
    maxHands: { type: Number, default: 100 },
    handsPlayed: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('AIConfig', aiConfigSchema);
