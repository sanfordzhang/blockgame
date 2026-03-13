/**
 * Game Model
 * Records game sessions and results
 */

const mongoose = require('mongoose');

const playerResultSchema = new mongoose.Schema({
    address: { type: String, required: true, lowercase: true },
    buyIn: { type: Number, required: true },     // Amount bought in (SUN)
    won: { type: Boolean, default: false },
    winAmount: { type: Number, default: 0 },     // Gross win amount (SUN)
    netAmount: { type: Number, default: 0 },     // Net gain/loss (SUN)
    rakePaid: { type: Number, default: 0 },      // Rake deducted (SUN)
    finalHand: { type: String, default: null },  // Best hand description
    foldedAt: { type: Number, default: null }    // Round when folded (null = didn't fold)
}, { _id: false });

const gameSchema = new mongoose.Schema({
    // Table identifier
    tableId: {
        type: Number,
        required: true,
        index: true
    },
    
    // Unique game ID
    gameId: {
        type: String,
        required: true,
        unique: true
    },
    
    // Game state
    state: {
        type: String,
        enum: ['waiting', 'playing', 'settling', 'finished', 'cancelled'],
        default: 'waiting'
    },
    
    // Players
    players: [playerResultSchema],
    
    // Total pot
    totalPot: {
        type: Number,
        required: true
    },
    
    // Community cards
    communityCards: [{
        type: String  // e.g., "Ah", "Kd", "Tc"
    }],
    
    // Winner(s)
    winners: [{
        address: { type: String, lowercase: true },
        amount: { type: Number },
        hand: { type: String }
    }],
    
    // Rake
    rakeRate: {
        type: Number,
        required: true
    },
    rakeCollected: {
        type: Number,
        default: 0
    },
    
    // Settlement
    settlementTxHash: {
        type: String,
        default: null
    },
    resultHash: {
        type: String,
        default: null
    },
    
    // Timing
    startedAt: {
        type: Date,
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    },
    settledAt: {
        type: Date,
        default: null
    },
    duration: {
        type: Number,  // in seconds
        default: null
    },
    
    // Network
    network: {
        type: String,
        enum: ['testnet', 'mainnet'],
        required: true
    },
    
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes
gameSchema.index({ createdAt: -1 });
gameSchema.index({ 'players.address': 1, createdAt: -1 });
gameSchema.index({ state: 1, createdAt: -1 });

// Methods
gameSchema.methods.start = function() {
    this.state = 'playing';
    this.startedAt = new Date();
    return this.save();
};

gameSchema.methods.end = function(winners, communityCards, rakeCollected) {
    this.state = 'settling';
    this.endedAt = new Date();
    this.winners = winners;
    this.communityCards = communityCards;
    this.rakeCollected = rakeCollected;
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
    return this.save();
};

gameSchema.methods.settle = function(txHash, resultHash) {
    this.state = 'finished';
    this.settledAt = new Date();
    this.settlementTxHash = txHash;
    this.resultHash = resultHash;
    return this.save();
};

gameSchema.methods.cancel = function(reason) {
    this.state = 'cancelled';
    this.metadata.cancelReason = reason;
    return this.save();
};

// Static methods
gameSchema.statics.findByTable = function(tableId, limit = 10) {
    return this.find({ tableId })
        .sort({ createdAt: -1 })
        .limit(limit);
};

gameSchema.statics.findByPlayer = function(address, limit = 20) {
    return this.find({ 'players.address': address.toLowerCase() })
        .sort({ createdAt: -1 })
        .limit(limit);
};

gameSchema.statics.getRecentGames = function(limit = 50) {
    return this.find({ state: 'finished' })
        .sort({ settledAt: -1 })
        .limit(limit);
};

gameSchema.statics.getDailyStats = async function(date = new Date()) {
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    
    const result = await this.aggregate([
        {
            $match: {
                state: 'finished',
                settledAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                totalGames: { $sum: 1 },
                totalPot: { $sum: '$totalPot' },
                totalRake: { $sum: '$rakeCollected' },
                avgDuration: { $avg: '$duration' }
            }
        }
    ]);
    
    return result[0] || { totalGames: 0, totalPot: 0, totalRake: 0, avgDuration: 0 };
};

// Virtual for player count
gameSchema.virtual('playerCount').get(function() {
    return this.players ? this.players.length : 0;
});

gameSchema.set('toJSON', { virtuals: true });
gameSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Game', gameSchema);
