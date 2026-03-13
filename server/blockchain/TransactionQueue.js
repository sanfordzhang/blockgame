/**
 * TransactionQueue - Transaction Queue Management
 * Handles queuing and processing of blockchain transactions
 */

class TransactionQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.paused = false;
        this.concurrencyLimit = 1; // Process one at a time
        this.retryAttempts = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    /**
     * Add transaction to queue
     * @param {object} txData - Transaction data
     * @param {function} processor - Function to process transaction
     * @returns {Promise} - Resolves when transaction completes
     */
    add(txData, processor) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                data: txData,
                processor,
                resolve,
                reject,
                attempts: 0,
                addedAt: Date.now()
            });
            
            console.log(`[TransactionQueue] Added transaction, queue length: ${this.queue.length}`);
            
            // Start processing if not already
            if (!this.processing && !this.paused) {
                this.process();
            }
        });
    }

    /**
     * Process queue
     */
    async process() {
        if (this.processing || this.paused) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            
            try {
                console.log(`[TransactionQueue] Processing: ${item.data.type || 'unknown'}`);
                
                const result = await this.executeWithRetry(item);
                item.resolve(result);
                
            } catch (error) {
                console.error(`[TransactionQueue] Failed: ${error.message}`);
                item.reject(error);
            }
        }
        
        this.processing = false;
        console.log('[TransactionQueue] Queue empty, processing stopped');
    }

    /**
     * Execute with retry logic
     */
    async executeWithRetry(item) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                const result = await item.processor(item.data);
                return result;
                
            } catch (error) {
                lastError = error;
                item.attempts = attempt;
                
                console.warn(`[TransactionQueue] Attempt ${attempt}/${this.retryAttempts} failed:`, error.message);
                
                if (attempt < this.retryAttempts) {
                    await this.delay(this.retryDelay * attempt); // Exponential backoff
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Pause queue processing
     */
    pause() {
        this.paused = true;
        console.log('[TransactionQueue] Paused');
    }

    /**
     * Resume queue processing
     */
    resume() {
        this.paused = false;
        console.log('[TransactionQueue] Resumed');
        
        if (!this.processing && this.queue.length > 0) {
            this.process();
        }
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            length: this.queue.length,
            processing: this.processing,
            paused: this.paused,
            items: this.queue.map(item => ({
                type: item.data.type,
                attempts: item.attempts,
                addedAt: item.addedAt
            }))
        };
    }

    /**
     * Clear queue
     */
    clear() {
        // Reject all pending items
        for (const item of this.queue) {
            item.reject(new Error('Queue cleared'));
        }
        
        this.queue = [];
        console.log('[TransactionQueue] Cleared');
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
module.exports = new TransactionQueue();
