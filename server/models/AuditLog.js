/**
 * AuditLog Model
 * Records admin and system actions for audit trail
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    // Action type
    action: {
        type: String,
        required: true,
        enum: [
            // Player actions
            'register', 'deposit', 'withdraw', 'join_table', 'leave_table',
            
            // Game actions
            'game_start', 'game_end', 'game_settle', 'game_cancel',
            
            // Admin actions
            'admin_login', 'admin_logout',
            'rake_change_schedule', 'rake_change_apply', 'rake_change_cancel',
            'rake_withdraw', 'emergency_pause', 'emergency_unpause',
            'admin_add', 'admin_remove',
            
            // System actions
            'contract_deploy', 'config_change', 'system_error'
        ]
    },
    
    // Who performed the action
    actor: {
        type: String,  // Wallet address or 'system'
        required: true,
        index: true
    },
    
    // Actor type
    actorType: {
        type: String,
        enum: ['player', 'admin', 'system'],
        required: true
    },
    
    // What was affected
    target: {
        type: String,  // Address, tableId, or other identifier
        default: null,
        index: true
    },
    
    // Detailed information
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Transaction hash (if blockchain action)
    txHash: {
        type: String,
        default: null
    },
    
    // Network
    network: {
        type: String,
        enum: ['testnet', 'mainnet', 'development', 'system'],
        default: 'system'
    },
    
    // Result
    success: {
        type: Boolean,
        default: true
    },
    errorMessage: {
        type: String,
        default: null
    },
    
    // IP address (for admin actions)
    ipAddress: {
        type: String,
        default: null
    },
    
    // User agent
    userAgent: {
        type: String,
        default: null
    },
    
    // Timestamp
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound indexes
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ target: 1, createdAt: -1 });

// Static methods
auditLogSchema.statics.log = function(data) {
    const log = new this(data);
    return log.save();
};

auditLogSchema.statics.findByActor = function(actor, limit = 100) {
    return this.find({ actor })
        .sort({ createdAt: -1 })
        .limit(limit);
};

auditLogSchema.statics.findByAction = function(action, limit = 100) {
    return this.find({ action })
        .sort({ createdAt: -1 })
        .limit(limit);
};

auditLogSchema.statics.findByTarget = function(target, limit = 100) {
    return this.find({ target })
        .sort({ createdAt: -1 })
        .limit(limit);
};

auditLogSchema.statics.getAdminLogs = function(limit = 100) {
    return this.find({ actorType: 'admin' })
        .sort({ createdAt: -1 })
        .limit(limit);
};

auditLogSchema.statics.getFailedActions = function(since = Date.now() - 24 * 60 * 60 * 1000) {
    return this.find({
        success: false,
        createdAt: { $gte: new Date(since) }
    }).sort({ createdAt: -1 });
};

auditLogSchema.statics.getDailyStats = async function(date = new Date()) {
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    
    const result = await this.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: '$action',
                count: { $sum: 1 },
                successCount: {
                    $sum: { $cond: ['$success', 1, 0] }
                },
                failCount: {
                    $sum: { $cond: ['$success', 0, 1] }
                }
            }
        }
    ]);
    
    return result;
};

// Cleanup old logs (keep last 100000)
auditLogSchema.statics.cleanup = async function() {
    const count = await this.countDocuments();
    if (count > 100000) {
        const oldest = await this.find()
            .sort({ createdAt: 1 })
            .skip(100000)
            .limit(1)
            .select('createdAt');
        
        if (oldest.length > 0) {
            await this.deleteMany({
                createdAt: { $lt: oldest[0].createdAt }
            });
        }
    }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
