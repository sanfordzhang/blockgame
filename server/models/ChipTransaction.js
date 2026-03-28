/**
 * ChipTransaction Model
 * Records CHIP token transactions (transfer, stake, reward, etc.)
 */

const mongoose = require('mongoose');

const chipTransactionSchema = new mongoose.Schema({
    // Player wallet address
    walletAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    
    // Transaction type
    type: {
        type: String,
        required: true,
        enum: [
            'reward',        // Game reward
            'stake',         // Staked tokens
            'unstake',       // Unstaked tokens
            'claim',         // Claimed staking reward
            'transfer',      // Transfer to another address
            'receive',       // Received from another address
            'vip_discount',  // VIP discount applied
            'deposit',       // Deposit from blockchain
            'withdraw'       // Withdraw to blockchain
        ]
    },
    
    // Amount (positive = credit, negative = debit)
    amount: {
        type: Number,
        required: true
    },
    
    // Balance after transaction
    balanceAfter: {
        type: Number,
        default: 0
    },
    
    // Related game/tournament
    gameId: {
        type: String,
        default: null
    },
    
    tournamentId: {
        type: String,
        default: null
    },
    
    // For transfers
    toAddress: {
        type: String,
        default: null
    },
    
    fromAddress: {
        type: String,
        default: null
    },
    
    // Stake info
    stakeId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    
    lockDays: {
        type: Number,
        default: null
    },
    
    // Transaction hash (if on-chain)
    txHash: {
        type: String,
        default: null
    },
    
    // Description
    description: {
        type: String,
        default: ''
    },
    
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Timestamps
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound indexes
chipTransactionSchema.index({ walletAddress: 1, timestamp: -1 });
chipTransactionSchema.index({ type: 1, timestamp: -1 });
chipTransactionSchema.index({ gameId: 1 });

// Static methods
chipTransactionSchema.statics.findByWallet = function(address, limit = 50) {
    return this.find({ walletAddress: address.toLowerCase() })
        .sort({ timestamp: -1 })
        .limit(limit);
};

chipTransactionSchema.statics.findByWalletPaginated = async function(address, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
        this.find({ walletAddress: address.toLowerCase() })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit),
        this.countDocuments({ walletAddress: address.toLowerCase() })
    ]);
    
    return {
        transactions,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

chipTransactionSchema.statics.getBalanceAt = async function(address, date) {
    const result = await this.aggregate([
        {
            $match: {
                walletAddress: address.toLowerCase(),
                timestamp: { $lte: date }
            }
        },
        {
            $sort: { timestamp: -1 }
        },
        {
            $limit: 1
        }
    ]);
    
    return result.length > 0 ? result[0].balanceAfter : 0;
};

// Create a transaction record
chipTransactionSchema.statics.createTransaction = async function(data) {
    const tx = new this({
        walletAddress: data.walletAddress.toLowerCase(),
        type: data.type,
        amount: data.amount,
        balanceAfter: data.balanceAfter || 0,
        gameId: data.gameId,
        tournamentId: data.tournamentId,
        toAddress: data.toAddress,
        fromAddress: data.fromAddress,
        stakeId: data.stakeId,
        lockDays: data.lockDays,
        txHash: data.txHash,
        description: data.description,
        metadata: data.metadata
    });
    
    await tx.save();
    return tx;
};

module.exports = mongoose.model('ChipTransaction', chipTransactionSchema);
