/**
 * Stake Model
 * Tracks CHIP token staking positions
 */

const mongoose = require('mongoose');

const stakeSchema = new mongoose.Schema({
    // Player wallet address
    playerAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    
    // Staked amount (in smallest unit - CHIP with 6 decimals)
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Lock duration in days
    lockDuration: {
        type: Number,
        required: true,
        min: 7,
        max: 365
    },
    
    // Timestamps
    startTime: {
        type: Date,
        default: Date.now
    },
    
    lockedUntil: {
        type: Date,
        required: true
    },
    
    // Status
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Unstake info
    unstakedAt: {
        type: Date,
        default: null
    },
    
    unstakeAmount: {
        type: Number,
        default: 0
    },
    
    penalty: {
        type: Number,
        default: 0
    },
    
    // Transaction hashes
    stakeTxHash: {
        type: String,
        default: null
    },
    
    unstakeTxHash: {
        type: String,
        default: null
    },
    
    // Reward tracking
    rewardDebt: {
        type: Number,
        default: 0
    },
    
    pendingReward: {
        type: Number,
        default: 0
    },
    
    lastRewardClaim: {
        type: Date,
        default: null
    },
    
    totalRewardsClaimed: {
        type: Number,
        default: 0
    }
});

// Compound indexes
stakeSchema.index({ playerAddress: 1, isActive: 1 });
stakeSchema.index({ isActive: 1, lockedUntil: 1 });

// Static methods
stakeSchema.statics.findActive = function() {
    return this.find({ isActive: true });
};

stakeSchema.statics.findByPlayer = function(address) {
    return this.find({ playerAddress: address.toLowerCase() })
        .sort({ startTime: -1 });
};

stakeSchema.statics.findActiveByPlayer = function(address) {
    return this.find({ 
        playerAddress: address.toLowerCase(),
        isActive: true
    }).sort({ startTime: -1 });
};

stakeSchema.statics.getTotalStaked = async function() {
    const result = await this.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    return result.length > 0 ? result[0].total : 0;
};

stakeSchema.statics.getTotalStakedByPlayer = async function(address) {
    const result = await this.aggregate([
        { 
            $match: { 
                playerAddress: address.toLowerCase(),
                isActive: true 
            } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    return result.length > 0 ? result[0].total : 0;
};

// Methods
stakeSchema.methods.isLocked = function() {
    return new Date() < this.lockedUntil;
};

stakeSchema.methods.getRemainingLockDays = function() {
    if (!this.isLocked()) return 0;
    const diff = this.lockedUntil - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

stakeSchema.methods.calculatePenalty = function(penaltyRate = 0.1) {
    if (!this.isLocked()) return 0;
    return Math.floor(this.amount * penaltyRate);
};

stakeSchema.methods.unstake = function(penaltyRate = 0.1) {
    this.isActive = false;
    this.unstakedAt = new Date();
    this.unstakeAmount = this.amount;
    
    if (this.isLocked()) {
        this.penalty = this.calculatePenalty(penaltyRate);
        this.unstakeAmount = this.amount - this.penalty;
    }
    
    return this;
};

// Pre-save hook to set lockedUntil
stakeSchema.pre('save', function(next) {
    if (this.isNew && !this.lockedUntil) {
        const lockMs = this.lockDuration * 24 * 60 * 60 * 1000;
        this.lockedUntil = new Date(this.startTime.getTime() + lockMs);
    }
    next();
});

// Virtual for display
stakeSchema.virtual('displayAmount').get(function() {
    return (this.amount / 1e6).toFixed(2) + ' CHIP';
});

stakeSchema.virtual('isVIP').get(function() {
    return this.isActive && this.amount >= 10000 * 1e6; // 10,000 CHIP for VIP
});

// Ensure virtuals are included
stakeSchema.set('toJSON', { virtuals: true });
stakeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Stake', stakeSchema);
