/**
 * Tournament Model
 * Represents a poker tournament
 */

const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    // Unique tournament ID (from contract)
    tournamentId: {
        type: String,
        required: true,
        unique: true
    },
    
    // Configuration ID (references tournament config in contract)
    configId: {
        type: Number,
        required: true
    },
    
    // Tournament status
    status: {
        type: String,
        enum: ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'WAITING',
        index: true
    },
    
    // Transaction hash for creation
    txHash: {
        type: String,
        default: null
    },
    
    // Prize pool in SUN
    prizePool: {
        type: Number,
        default: 0
    },
    
    // Rake amount in SUN
    rakeAmount: {
        type: Number,
        default: 0
    },
    
    // Players participating
    players: [{
        address: {
            type: String,
            required: true,
            lowercase: true
        },
        socketId: {
            type: String,
            default: null
        },
        seatId: {
            type: Number,
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
    }],
    
    // Final rankings
    finalRankings: [{
        type: String,
        lowercase: true
    }],
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    startedAt: {
        type: Date,
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    }
});

// Indexes
tournamentSchema.index({ status: 1, createdAt: -1 });
tournamentSchema.index({ 'players.address': 1 });

// Static methods
tournamentSchema.statics.findActive = function() {
    return this.find({ status: { $in: ['WAITING', 'IN_PROGRESS'] } })
        .sort({ createdAt: -1 });
};

tournamentSchema.statics.findWaiting = function() {
    return this.find({ status: 'WAITING' })
        .sort({ createdAt: -1 });
};

tournamentSchema.statics.findByPlayer = function(address) {
    return this.find({ 'players.address': address.toLowerCase() })
        .sort({ createdAt: -1 });
};

// Methods
tournamentSchema.methods.addPlayer = function(address, socketId = null) {
    const existingPlayer = this.players.find(p => p.address === address.toLowerCase());
    if (existingPlayer) {
        return false;
    }
    
    this.players.push({
        address: address.toLowerCase(),
        socketId
    });
    return true;
};

tournamentSchema.methods.removePlayer = function(address) {
    const index = this.players.findIndex(p => p.address === address.toLowerCase());
    if (index === -1) return false;
    
    this.players.splice(index, 1);
    return true;
};

tournamentSchema.methods.start = function() {
    this.status = 'IN_PROGRESS';
    this.startedAt = new Date();
    return this;
};

tournamentSchema.methods.finish = function(rankings, prizeDistribution, rakeRate) {
    this.status = 'COMPLETED';
    this.endedAt = new Date();
    this.finalRankings = rankings.map(r => r.toLowerCase());
    
    // Calculate prizes
    const totalBuyIn = this.players.length * this.getBuyIn();
    this.rakeAmount = Math.floor(totalBuyIn * rakeRate / 10000);
    this.prizePool = totalBuyIn - this.rakeAmount;
    
    // Assign prizes to players
    rankings.forEach((address, index) => {
        const player = this.players.find(p => p.address === address.toLowerCase());
        if (player && prizeDistribution[index]) {
            player.finalPosition = index + 1;
            player.prizeAmount = Math.floor(this.prizePool * prizeDistribution[index] / 100);
        }
    });
    
    return this;
};

tournamentSchema.methods.cancel = function() {
    this.status = 'CANCELLED';
    this.endedAt = new Date();
    return this;
};

// Virtual for player count
tournamentSchema.virtual('playerCount').get(function() {
    return this.players.length;
});

// Ensure virtuals are included
tournamentSchema.set('toJSON', { virtuals: true });
tournamentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Tournament', tournamentSchema);
