/**
 * Proposal Model
 * DAO governance proposals
 */

const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
    // On-chain proposal ID
    onchainId: {
        type: Number,
        required: true,
        index: true
    },
    
    // Proposal type
    proposalType: {
        type: String,
        enum: ['RAKE_RATE', 'NFT_LIMIT', 'NEW_ACHIEVEMENT', 'EMERGENCY_PAUSE', 'OTHER'],
        required: true
    },
    
    // Proposal description
    description: {
        type: String,
        required: true,
        maxlength: 1000
    },
    
    // Proposer wallet address
    proposerAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    
    // Target contract for execution
    targetContract: {
        type: String,
        default: null
    },
    
    // Encoded call data for execution
    callData: {
        type: String,
        default: null
    },
    
    // Proposal parameters (flexible for different types)
    parameters: {
        newRakeRate: { type: Number, default: null },
        achievementTypeId: { type: Number, default: null },
        newLimit: { type: Number, default: null },
        custom: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    
    // Voting state
    state: {
        type: String,
        enum: ['PENDING', 'ACTIVE', 'SUCCEEDED', 'DEFEATED', 'EXECUTED', 'EXPIRED'],
        default: 'PENDING',
        index: true
    },
    
    // Vote counts
    forVotes: {
        type: Number,
        default: 0
    },
    againstVotes: {
        type: Number,
        default: 0
    },
    abstainVotes: {
        type: Number,
        default: 0
    },
    
    // Total voting power at snapshot
    totalVotingPower: {
        type: Number,
        default: 0
    },
    
    // Quorum check
    quorumReached: {
        type: Boolean,
        default: false
    },
    
    // Timestamps
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    executedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // Transaction hash for execution
    txHash: {
        type: String,
        default: null
    }
});

// Indexes
proposalSchema.index({ state: 1, endTime: 1 });
proposalSchema.index({ proposerAddress: 1, createdAt: -1 });

// Static methods
proposalSchema.statics.findActive = function() {
    const now = new Date();
    return this.find({
        state: 'ACTIVE',
        startTime: { $lte: now },
        endTime: { $gt: now }
    }).sort({ endTime: 1 });
};

proposalSchema.statics.findPending = function() {
    return this.find({ state: 'PENDING' }).sort({ startTime: 1 });
};

proposalSchema.statics.findExecutable = function() {
    const now = new Date();
    return this.find({
        state: 'SUCCEEDED',
        endTime: { $lt: now }
    });
};

proposalSchema.statics.findByProposer = function(address) {
    return this.find({ proposerAddress: address.toLowerCase() })
        .sort({ createdAt: -1 });
};

// Methods
proposalSchema.methods.isActive = function() {
    const now = new Date();
    return this.state === 'ACTIVE' && 
           this.startTime <= now && 
           this.endTime > now;
};

proposalSchema.methods.isPending = function() {
    return this.state === 'PENDING';
};

proposalSchema.methods.canExecute = function() {
    return this.state === 'SUCCEEDED' && new Date() > this.endTime;
};

proposalSchema.methods.hasEnded = function() {
    return new Date() >= this.endTime;
};

proposalSchema.methods.updateState = function(quorumPercent = 10) {
    if (this.state !== 'ACTIVE') return this;
    
    if (this.hasEnded()) {
        const totalVotes = this.forVotes + this.againstVotes + this.abstainVotes;
        const quorum = this.totalVotingPower * quorumPercent / 100;
        
        this.quorumReached = totalVotes >= quorum;
        
        if (!this.quorumReached) {
            this.state = 'DEFEATED';
        } else if (this.forVotes > this.againstVotes) {
            this.state = 'SUCCEEDED';
        } else {
            this.state = 'DEFEATED';
        }
    }
    
    return this;
};

proposalSchema.methods.castVote = function(support, weight) {
    switch (support) {
        case 0: // Against
            this.againstVotes += weight;
            break;
        case 1: // For
            this.forVotes += weight;
            break;
        case 2: // Abstain
            this.abstainVotes += weight;
            break;
    }
    return this;
};

proposalSchema.methods.execute = function(txHash) {
    this.state = 'EXECUTED';
    this.executedAt = new Date();
    this.txHash = txHash;
    return this;
};

// Virtuals
proposalSchema.virtual('totalVotes').get(function() {
    return this.forVotes + this.againstVotes + this.abstainVotes;
});

proposalSchema.virtual('passRate').get(function() {
    const total = this.forVotes + this.againstVotes;
    if (total === 0) return 0;
    return (this.forVotes / total * 100).toFixed(1);
});

proposalSchema.virtual('quorumPercent').get(function() {
    if (this.totalVotingPower === 0) return 0;
    return (this.totalVotes / this.totalVotingPower * 100).toFixed(1);
});

proposalSchema.virtual('timeRemaining').get(function() {
    if (this.state !== 'ACTIVE') return 0;
    const diff = this.endTime - new Date();
    return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60)) : 0; // Hours remaining
});

// Ensure virtuals are included
proposalSchema.set('toJSON', { virtuals: true });
proposalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Proposal', proposalSchema);
