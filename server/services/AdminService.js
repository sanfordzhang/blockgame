/**
 * AdminService - Admin Panel Service
 * Provides admin functionality for game management
 */

class AdminService {
    constructor() {
        this.contractService = null;
        this.tronService = null;
        this.adminAddresses = new Set();
        this.auditLog = [];
    }

    /**
     * Initialize service
     */
    init(contractService, tronService) {
        this.contractService = contractService;
        this.tronService = tronService;
        
        // Load admin addresses from env
        if (process.env.ADMIN_ADDRESS) {
            this.adminAddresses.add(process.env.ADMIN_ADDRESS);
        }
        
        console.log('[AdminService] Initialized with', this.adminAddresses.size, 'admins');
        return this;
    }

    /**
     * Check if address is admin
     */
    isAdmin(address) {
        return this.adminAddresses.has(address);
    }

    /**
     * Add admin address
     */
    addAdmin(address, addedBy) {
        this.adminAddresses.add(address);
        this.logAction('addAdmin', addedBy, { address });
        console.log(`[AdminService] Admin added: ${address}`);
    }

    /**
     * Remove admin address
     */
    removeAdmin(address, removedBy) {
        this.adminAddresses.delete(address);
        this.logAction('removeAdmin', removedBy, { address });
        console.log(`[AdminService] Admin removed: ${address}`);
    }

    /**
     * Get all admin addresses
     */
    getAdmins() {
        return Array.from(this.adminAddresses);
    }

    // ============ Rake Management ============

    /**
     * Get current rake rate
     */
    async getRakeRate() {
        return await this.contractService.getRakeRate();
    }

    /**
     * Get pending rake change
     */
    async getPendingRakeChange() {
        return await this.contractService.getPendingRakeChange();
    }

    /**
     * Schedule rake rate change
     */
    async scheduleRakeRateChange(newRate, adminAddress) {
        // Validate new rate
        if (newRate < 100 || newRate > 1000) {
            throw new Error('Rake rate must be between 1% and 10%');
        }
        
        // Check change amplitude (max 2% per change)
        const currentRate = await this.getRakeRate();
        const change = Math.abs(newRate - currentRate);
        if (change > 200) {
            throw new Error('Rake rate change cannot exceed 2% per adjustment');
        }
        
        const result = await this.contractService.scheduleRakeRateChange(newRate);
        
        this.logAction('scheduleRakeRateChange', adminAddress, {
            oldRate: currentRate,
            newRate,
            txId: result.txid || result
        });
        
        return result;
    }

    /**
     * Apply pending rake rate change
     */
    async applyRakeRateChange(adminAddress) {
        const pending = await this.getPendingRakeChange();
        
        if (!pending.exists) {
            throw new Error('No pending rake rate change');
        }
        
        if (Date.now() / 1000 < pending.effectiveTime) {
            throw new Error('Time lock not yet expired');
        }
        
        const result = await this.contractService.applyRakeRateChange();
        
        this.logAction('applyRakeRateChange', adminAddress, {
            newRate: pending.newRate,
            txId: result.txid || result
        });
        
        return result;
    }

    /**
     * Cancel pending rake rate change
     */
    async cancelRakeRateChange(adminAddress) {
        const result = await this.contractService.cancelRakeRateChange();
        
        this.logAction('cancelRakeRateChange', adminAddress, {});
        
        return result;
    }

    // ============ Rake Withdrawal ============

    /**
     * Get accumulated rake
     */
    async getAccumulatedRake() {
        const stats = await this.contractService.getStatistics();
        return stats.accumulatedRake;
    }

    /**
     * Withdraw accumulated rake
     */
    async withdrawRake(to, amount, adminAddress) {
        const accumulated = await this.getAccumulatedRake();
        
        if (amount > accumulated) {
            throw new Error('Insufficient accumulated rake');
        }
        
        const result = await this.contractService.withdrawRake(to, amount);
        
        this.logAction('withdrawRake', adminAddress, {
            to,
            amount,
            txId: result.txid || result
        });
        
        return result;
    }

    // ============ Emergency Controls ============

    /**
     * Pause contract
     */
    async pauseContract(adminAddress) {
        const result = await this.contractService.pause();
        
        this.logAction('pauseContract', adminAddress, {
            txId: result.txid || result
        });
        
        // Notify all clients
        if (global.io) {
            global.io.emit('emergency:pause', {
                pausedBy: adminAddress,
                timestamp: Date.now()
            });
        }
        
        return result;
    }

    /**
     * Unpause contract
     */
    async unpauseContract(adminAddress) {
        const result = await this.contractService.unpause();
        
        this.logAction('unpauseContract', adminAddress, {
            txId: result.txid || result
        });
        
        // Notify all clients
        if (global.io) {
            global.io.emit('emergency:unpause', {
                unpausedBy: adminAddress,
                timestamp: Date.now()
            });
        }
        
        return result;
    }

    /**
     * Check if contract is paused
     */
    async isPaused() {
        // This would call the contract's paused() function
        // For now, we'll assume it's implemented
        return false;
    }

    // ============ Statistics ============

    /**
     * Get operational statistics
     */
    async getStatistics() {
        return await this.contractService.getStatistics();
    }

    /**
     * Get transaction history
     */
    async getTransactionHistory(limit = 100) {
        // This would query a database or blockchain events
        // For now, return mock data
        return {
            transactions: [],
            total: 0
        };
    }

    // ============ Audit Log ============

    /**
     * Log an admin action
     */
    logAction(action, adminAddress, details) {
        this.auditLog.push({
            action,
            admin: adminAddress,
            details,
            timestamp: Date.now()
        });
        
        // Keep only last 1000 entries
        if (this.auditLog.length > 1000) {
            this.auditLog = this.auditLog.slice(-1000);
        }
        
        console.log(`[AdminService] Audit: ${action} by ${adminAddress}`);
    }

    /**
     * Get audit log
     */
    getAuditLog(limit = 100) {
        return this.auditLog.slice(-limit);
    }

    /**
     * Get audit log for specific admin
     */
    getAuditLogByAdmin(adminAddress, limit = 100) {
        return this.auditLog
            .filter(entry => entry.admin === adminAddress)
            .slice(-limit);
    }
}

// Export singleton instance
module.exports = new AdminService();
