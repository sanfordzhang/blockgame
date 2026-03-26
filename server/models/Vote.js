/**
 * Vote Model
 * Individual votes on DAO proposals
 */

const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
    // Reference to proposal
    proposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proposal',
        required: true,
        index: true
    },
    
    // Voter wallet address
    voterAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    
    // Vote: 0 = Against, 1 = For, 2 = Abstain
    support: {
        type: Number,
        enum: [0, 1, 2],
        required: true
    },
    
    // Voting weight (CHIP balance at snapshot)
    weight: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Reason for vote (optional)
    reason: {
        type: String,
        maxlength: 280,
        default: null
    },
    
    // Timestamps
    votedAt: {
        type: Date,
        default: Date.now
    },
    
    // Transaction hash
    txHash: {
        type: String,
        default: null
    }
});

// Compound unique index - one vote per address per proposal
voteSchema.index({ proposalId: 1, voterAddress: 1 }, { unique: true });

// Static methods
voteSchema.statics.findByProposal = function(proposalId) {
    return this.find({ proposalId }).sort({ weight: -1 });
};

voteSchema.statics.findByVoter = function(address) {
    return this.find({ voterAddress: address.toLowerCase() })
        .populate('proposalId')
        .sort({ votedAt: -1 });
};

voteSchema.statics.hasVoted = async function(proposalId, address) {
    const vote = await this.findOne({
        proposalId,
        voterAddress: address.toLowerCase()
    });
    return !!vote;
};

voteSchema.statics.getVoteStats = async function(proposalId) {
    const result = await this.aggregate([
        { $match: { proposalId: mongoose.Types.ObjectId(proposalId) } },
        {
            $group: {
                _id: '$support',
                totalWeight: { $sum: '$weight' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    const stats = { against: { weight: 0, count: 0 }, for: { weight: 0, count: 0 }, abstain: { weight: 0, count: 0 } };
    
    result.forEach(r => {
        if (r._id === 0) stats.against = { weight: r.totalWeight, count: r.count };
        if (r._id === 1) stats.for = { weight: r.totalWeight, count: r.count };
        if (r._id === 2) stats.abstain = { weight: r.totalWeight, count: r.count };
    });
    
    return stats;
};

// Virtual for support display
voteSchema.virtual('supportDisplay').get(function() {
    const displays = { 0: 'Against', 1: 'For', 2: 'Abstain' };
    return displays[this.support];
});

// Ensure virtuals are included
voteSchema.set('toJSON', { virtuals: true });
voteSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Vote', voteSchema);
