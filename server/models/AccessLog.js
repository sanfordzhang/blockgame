/**
 * AccessLog Model
 * Records frontend user pageview events for analytics
 */

const mongoose = require('mongoose');

const accessLogSchema = new mongoose.Schema({
    // Session identifier (UUID v4, per browser tab)
    sessionId: {
        type: String,
        required: true,
        index: true
    },

    // TRON wallet address (lowercase, null if not connected)
    walletAddress: {
        type: String,
        default: null,
        index: true
    },

    // Page path visited (e.g., "/play", "/tournament")
    path: {
        type: String,
        required: true,
        index: true
    },

    // Page entry timestamp
    entryTime: {
        type: Date,
        required: true,
        index: true
    },

    // Page exit timestamp
    exitTime: {
        type: Date,
        default: null
    },

    // Duration on page (seconds, 1 decimal precision)
    duration: {
        type: Number,
        default: null
    },

    // Referrer page path (internal)
    referrer: {
        type: String,
        default: null
    },

    // Browser user agent string
    userAgent: {
        type: String,
        default: null
    },

    // Screen dimensions
    screenWidth: {
        type: Number,
        default: null
    },
    screenHeight: {
        type: Number,
        default: null
    }
});

// Compound indexes for common query patterns
accessLogSchema.index({ walletAddress: 1, entryTime: -1 });
accessLogSchema.index({ path: 1, entryTime: -1 });
accessLogSchema.index({ sessionId: 1, entryTime: -1 });

// TTL index: auto-expire documents after 90 days
accessLogSchema.index(
    { entryTime: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

// Static method: cleanup old documents (fallback for environments without TTL support)
accessLogSchema.statics.cleanup = async function() {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.deleteMany({
        entryTime: { $lt: cutoffDate }
    });
    console.log(`[AccessLog] Cleaned up ${result.deletedCount} expired documents`);
    return result.deletedCount;
};

// Static method: bulk save logs with validation
accessLogSchema.statics.bulkSaveValidated = async function(logsArray) {
    if (!Array.isArray(logsArray) || logsArray.length === 0) {
        return { success: false, received: 0, error: 'logs array is empty or invalid' };
    }

    // Validate each log entry
    const validLogs = [];
    const errors = [];
    logsArray.forEach((log, index) => {
        if (!log.sessionId || !log.path || !log.entryTime) {
            errors.push(`Log at index ${index} missing required field(s): sessionId=${!!log.sessionId}, path=${!!log.path}, entryTime=${!!log.entryTime}`);
            return;
        }

        // Normalize wallet address to lowercase
        if (log.walletAddress && typeof log.walletAddress === 'string') {
            log.walletAddress = log.walletAddress.toLowerCase();
        }

        validLogs.push({
            sessionId: log.sessionId,
            walletAddress: log.walletAddress || null,
            path: log.path,
            entryTime: new Date(log.entryTime),
            exitTime: log.exitTime ? new Date(log.exitTime) : null,
            duration: log.duration != null ? parseFloat(log.duration) : null,
            referrer: log.referrer || null,
            userAgent: log.userAgent || null,
            screenWidth: log.screenWidth || null,
            screenHeight: log.screenHeight || null
        });
    });

    if (validLogs.length === 0) {
        return { success: false, received: 0, error: 'No valid logs after validation', details: errors };
    }

    try {
        const result = await this.insertMany(validLogs, { ordered: false });
        const insertedCount = Array.isArray(result) ? result.length : (result.insertedCount || validLogs.length);
        return {
            success: true,
            received: insertedCount,
            totalSubmitted: logsArray.length,
            validationErrors: errors.length > 0 ? errors : undefined
        };
    } catch (err) {
        console.error('[AccessLog] Bulk insert error:', err.message);
        throw err;
    }
};

module.exports = mongoose.model('AccessLog', accessLogSchema);
