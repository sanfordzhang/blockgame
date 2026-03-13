/**
 * Transaction Model
 * Records blockchain transactions
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Transaction hash on blockchain
    txHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Transaction type
    type: {
        type: String,
        required: true,
        enum: ['deposit', 'withdraw', 'join_table', 'leave_table', 'settlement', 'rake_withdraw', 'admin']
    },
    
    // Player address (if applicable)
    player: {
        type: String,
        lowercase: true,
        index: true
    },
    
    // Amount in SUN
    amount: {
        type: Number,
        default: 0
    },
    
    // Transaction status
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'failed'],
        default: 'pending'
    },
    
    // Block number (when confirmed)
    blockNumber: {
        type: Number,
        default: null
    },
    
    // Gas used
    gasUsed: {
        type: Number,
        default: null
    },
    
    // Fee paid (in SUN)
    fee: {
        type: Number,
        default: null
    },
    
    // Additional data (JSON)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Error message (if failed)
    error: {
        type: String,
        default: null
    },
    
    // Network (testnet/mainnet)
    network: {
        type: String,
        enum: ['testnet', 'mainnet', 'development'],
        required: true
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    confirmedAt: {
        type: Date,
        default: null
    }
});

// Indexes
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ player: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });

// Static methods
transactionSchema.statics.findByPlayer = function(address, limit = 50) {
    return this.find({ player: address.toLowerCase() })
        .sort({ createdAt: -1 })
        .limit(limit);
};

transactionSchema.statics.findPending = function() {
    return this.find({ status: 'pending' })
        .sort({ createdAt: 1 });
};

transactionSchema.statics.getDailyVolume = async function(date = new Date()) {
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    
    const result = await this.aggregate([
        {
            $match: {
                type: 'settlement',
                status: 'confirmed',
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                totalVolume: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    return result[0] || { totalVolume: 0, count: 0 };
};

module.exports = mongoose.model('Transaction', transactionSchema);
