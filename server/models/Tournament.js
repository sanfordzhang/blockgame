/**
 * Tournament Model - MongoDB Mongoose Schema
 * Persistent storage for tournament data
 */

const mongoose = require('mongoose');

// Player subdocument schema
const TournamentPlayerSchema = new mongoose.Schema({
    address: {
        type: String,
        required: true,
        lowercase: true
    },
    socketId: {
        type: String,
        default: null
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    finalPosition: {
        type: Number,
        default: null
    },
    prizeAmount: {
        type: Number,
        default: null
    },
    claimed: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Ranking subdocument schema
const RankingSchema = new mongoose.Schema({
    address: {
        type: String,
        required: true,
        lowercase: true
    },
    position: {
        type: Number,
        required: true
    },
    prize: {
        type: Number,
        default: 0
    },
    claimed: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Config subdocument schema
const TournamentConfigSchema = new mongoose.Schema({
    playerCount: { type: Number, default: 6 },
    buyIn: { type: Number, default: 100000000 },        // 100 TRX in SUN
    rakeRate: { type: Number, default: 500 },           // 5% = 500 basis points
    initialChips: { type: Number, default: 10000000 },  // Starting chips
    prizeDistribution: { type: [Number], default: [50, 30, 20] },
    tournamentType: { type: String, default: 'SNG' },
    startMode: { type: String, default: 'INSTANT' },
    name: { type: String, default: '6人赛 (100 TRX)' }
}, { _id: false });

// Main Tournament Schema
const tournamentSchema = new mongoose.Schema({
    // Unique tournament ID (can be from contract or generated)
    tournamentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Configuration ID (references tournament config in contract)
    configId: {
        type: Number,
        default: 1
    },
    
    // Tournament status
    status: {
        type: String,
        enum: ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'WAITING',
        index: true
    },
    
    // Players joined
    players: [TournamentPlayerSchema],
    
    // Final rankings (when completed)
    rankings: [RankingSchema],
    
    // Configuration snapshot at creation time
    config: {
        type: TournamentConfigSchema,
        default: () => ({})
    },
    
    // Denormalized fields for quick access
    buyIn: { type: Number, default: 100000000 },
    playerCount: { type: Number, default: 6 },
    rakeRate: { type: Number, default: 500 },
    prizePool: { type: Number, default: 0 },
    rakeAmount: { type: Number, default: 0 },
    
    // Transaction hash (from contract if used)
    txHash: { type: String, default: null },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    
    // End reason (for cancelled/completed tournaments)
    endReason: { type: String, default: null },
    cancelReason: { type: String, default: null },
    
    // Statistics
    totalHands: { type: Number, default: 0 },
    
    // Mock game mode (for testing NFT achievements)
    mockGame: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Indexes
tournamentSchema.index({ status: 1, createdAt: -1 });
tournamentSchema.index({ 'players.address': 1 });
tournamentSchema.index({ createdAt: -1 });

// ============ Instance Methods ============

/**
 * Add a player to the tournament
 * @param {string} address - Player wallet address
 * @param {string} socketId - Socket ID
 * @returns {boolean} - Whether player was added
 */
tournamentSchema.methods.addPlayer = function(address, socketId = null) {
    const normalizedAddress = address.toLowerCase();
    const existingPlayer = this.players.find(p => p.address === normalizedAddress);
    if (existingPlayer) {
        console.log(`[Tournament] Player ${normalizedAddress} already in tournament ${this.tournamentId}`);
        return false;
    }

    this.players.push({
        address: normalizedAddress,
        socketId,
        joinedAt: new Date(),
        finalPosition: null,
        prizeAmount: null,
        claimed: false
    });

    console.log(`[Tournament] Added player ${normalizedAddress} to tournament ${this.tournamentId}`);
    return true;
};

/**
 * Remove a player from the tournament
 * @param {string} address - Player wallet address
 * @returns {boolean} - Whether player was removed
 */
tournamentSchema.methods.removePlayer = function(address) {
    const index = this.players.findIndex(p => p.address === address.toLowerCase());
    if (index === -1) return false;
    this.players.splice(index, 1);
    return true;
};

/**
 * Start the tournament
 * @returns {this}
 */
tournamentSchema.methods.start = function() {
    this.status = 'IN_PROGRESS';
    this.startedAt = new Date();
    return this;
};

/**
 * Finish the tournament with rankings
 * @param {string[]} rankings - Array of player addresses in finishing order
 * @param {number[]} prizeDistribution - Prize distribution percentages
 * @param {number} rakeRate - Rake rate in basis points
 * @returns {this}
 */
tournamentSchema.methods.finish = function(rankings, prizeDistribution, rakeRate) {
    this.status = 'COMPLETED';
    this.endedAt = new Date();
    
    const totalBuyIn = this.players.length * this.buyIn;
    this.rakeAmount = Math.floor(totalBuyIn * rakeRate / 10000);
    this.prizePool = totalBuyIn - this.rakeAmount;
    
    rankings.forEach((address, index) => {
        const player = this.players.find(p => p.address === address.toLowerCase());
        if (player && prizeDistribution[index]) {
            player.finalPosition = index + 1;
            player.prizeAmount = Math.floor(this.prizePool * prizeDistribution[index] / 100);
        }
    });
    
    return this;
};

// ============ Custom Static Methods ============
// Note: We don't override Mongoose's built-in find() and findOne()
// Use the built-in methods directly with await

/**
 * Find active tournaments (WAITING or IN_PROGRESS)
 * @returns {Promise<Tournament[]>}
 */
tournamentSchema.statics.findActive = function() {
    return this.find({
        status: { $in: ['WAITING', 'IN_PROGRESS'] }
    }).sort({ createdAt: -1 });
};

/**
 * Find waiting tournaments
 * @returns {Promise<Tournament[]>}
 */
tournamentSchema.statics.findWaiting = function() {
    return this.find({
        status: 'WAITING'
    }).sort({ createdAt: -1 });
};

/**
 * Find tournaments by player address
 * @param {string} address - Player wallet address
 * @returns {Promise<Tournament[]>}
 */
tournamentSchema.statics.findByPlayer = function(address) {
    return this.find({
        'players.address': address.toLowerCase()
    }).sort({ createdAt: -1 });
};

/**
 * Clear all tournaments (for testing)
 * @returns {Promise}
 */
tournamentSchema.statics.clearAll = function() {
    return this.deleteMany({});
};

// Ensure virtuals are included in JSON
tournamentSchema.set('toJSON', { virtuals: true });
tournamentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Tournament', tournamentSchema);
