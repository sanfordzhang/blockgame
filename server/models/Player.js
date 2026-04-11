/**
 * Player Model
 * Represents a player in the game with blockchain integration
 */

const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    // Wallet address (primary identifier)
    address: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true
    },
    
    // Display name (optional)
    displayName: {
        type: String,
        maxlength: 32,
        default: null
    },
    
    // Registration status
    isRegistered: {
        type: Boolean,
        default: false
    },
    registeredAt: {
        type: Date,
        default: null
    },
    
    // Balance tracking (synced from blockchain)
    contractBalance: {
        type: Number,
        default: 0
    },
    lockedBalance: {
        type: Number,
        default: 0
    },
    balanceLastSynced: {
        type: Date,
        default: null
    },
    
    // Statistics
    totalGamesPlayed: {
        type: Number,
        default: 0
    },
    totalWins: {
        type: Number,
        default: 0
    },
    totalEarnings: {
        type: Number,
        default: 0  // In SUN
    },
    totalLosses: {
        type: Number,
        default: 0  // In SUN
    },
    
    // Current game state
    currentTableId: {
        type: Number,
        default: null
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    },
    
    // Settings
    settings: {
        soundEnabled: { type: Boolean, default: true },
        autoFoldEnabled: { type: Boolean, default: false },
        preferredMode: { type: String, enum: ['fun', 'real'], default: 'fun' }
    },

    // AI fields
    aiMode: { type: Boolean, default: false },
    aiLevel: { type: String, enum: ['easy', 'medium', 'hard', 'expert'], default: null },
    aiLastUsedAt: { type: Date, default: null }
});

// Indexes
playerSchema.index({ createdAt: -1 });
playerSchema.index({ lastActiveAt: -1 });

// Methods
playerSchema.methods.updateBalance = function(contractBalance, lockedBalance) {
    this.contractBalance = contractBalance;
    this.lockedBalance = lockedBalance;
    this.balanceLastSynced = new Date();
    return this.save();
};

playerSchema.methods.recordGame = function(won, amount) {
    this.totalGamesPlayed += 1;
    if (won) {
        this.totalWins += 1;
        this.totalEarnings += amount;
    } else {
        this.totalLosses += amount;
    }
    return this.save();
};

playerSchema.methods.setActive = function() {
    this.lastActiveAt = new Date();
    return this.save();
};

// Static methods
playerSchema.statics.findByAddress = function(address) {
    return this.findOne({ address: address.toLowerCase() });
};

playerSchema.statics.findOrCreate = async function(address) {
    let player = await this.findByAddress(address);
    
    if (!player) {
        player = new this({ address: address.toLowerCase() });
        await player.save();
    }
    
    return player;
};

// Virtual for total balance
playerSchema.virtual('availableBalance').get(function() {
    return this.contractBalance - this.lockedBalance;
});

// Virtual for win rate
playerSchema.virtual('winRate').get(function() {
    if (this.totalGamesPlayed === 0) return 0;
    return (this.totalWins / this.totalGamesPlayed * 100).toFixed(1);
});

// Ensure virtuals are included in JSON
playerSchema.set('toJSON', { virtuals: true });
playerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Player', playerSchema);
