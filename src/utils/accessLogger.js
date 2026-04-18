/**
 * AccessLogger — Frontend pageview collection and batch upload
 *
 * Features:
 * - Auto session management (UUID v4 in sessionStorage)
 * - In-memory queue with batch flush (10s interval, max 100 items)
 * - Visibility change → immediate flush
 * - Page unload → sendBeacon fallback
 */

const FLUSH_INTERVAL_MS = 10 * 1000; // 10 seconds
const MAX_QUEUE_SIZE = 100;           // Force flush at this threshold
const API_ENDPOINT = '/api/analytics/log';

class AccessLogger {
    constructor() {
        this.queue = [];
        this.currentPath = null;
        this.entryTime = null;
        this.timer = null;
        this.initialized = false;
    }

    /**
     * Initialize the logger (call once on app mount)
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Ensure sessionId exists in sessionStorage
        if (!sessionStorage.getItem('accessLogSessionId')) {
            sessionStorage.setItem('accessLogSessionId', this._generateUUID());
        }

        // Start periodic flush timer
        this._startFlushTimer();

        // Bind visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.flush();
            }
        });

        // Bind beforeunload handler for sendBeacon fallback
        window.addEventListener('beforeunload', () => {
            this._sendBeacon();
        });

        // Also handle pagehide as a backup (especially for Safari)
        window.addEventListener('pagehide', () => {
            this._sendBeacon();
        });

        console.log('[AccessLogger] Initialized');
    }

    /**
     * Record a page view entry. Called on route change.
     * Calculates duration of the PREVIOUS page and queues it.
     *
     * @param {string} path — Current page pathname (e.g., "/play")
     * @param {string|null} walletAddress — Current connected wallet address
     */
    recordPageView(path, walletAddress) {
        const now = new Date();

        // If there was a previous page, calculate its duration and queue it
        if (this.currentPath && this.entryTime) {
            const duration = (now.getTime() - this.entryTime.getTime()) / 1000; // seconds
            const logEntry = this._buildLogEntry(
                this.currentPath,
                this.entryTime,
                now,
                Math.round(duration * 10) / 10,
                walletAddress
            );

            this.queue.push(logEntry);

            // Auto-force flush if queue exceeds limit
            if (this.queue.length >= MAX_QUEUE_SIZE) {
                this.flush();
            }
        }

        // Set current page state
        this.currentPath = path;
        this.entryTime = now;
    }

    /**
     * Flush queued logs to server via POST
     */
    async flush() {
        if (this.queue.length === 0) return;

        // Take all entries from queue (atomic swap)
        const logsToSend = [...this.queue];
        this.queue = [];

        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logs: logsToSend }),
                keepalive: true  // Allow request to outlive the page lifecycle
            });

            if (!response.ok) {
                // Re-queue failed logs (unless queue is getting too large)
                console.warn(`[AccessLogger] Flush failed (${response.status}), re-queuing ${logsToSend.length} logs`);
                this.queue = [...logsToSend, ...this.queue].slice(0, MAX_QUEUE_SIZE * 2);
            }
        } catch (err) {
            // Network error — re-queue
            console.warn('[AccessLogger] Flush network error:', err.message);
            this.queue = [...logsToSend, ...this.queue].slice(0, MAX_QUEUE_SIZE * 2);
        }
    }

    /**
     * Send remaining logs via navigator.sendBeacon (for page unload)
     * @private
     */
    _sendBeacon() {
        if (this.queue.length === 0) return;

        // Record current page's partial duration
        if (this.currentPath && this.entryTime) {
            const now = new Date();
            const duration = (now.getTime() - this.entryTime.getTime()) / 1000;
            this.queue.push(this._buildLogEntry(
                this.currentPath,
                this.entryTime,
                now,
                Math.round(duration * 10) / 10,
                null  // walletAddress may not be available during unload
            ));
        }

        const payload = JSON.stringify({ logs: this.queue });
        this.queue = []; // Clear immediately to avoid double-send

        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon(
                    API_ENDPOINT,
                    new Blob([payload], { type: 'application/json' })
                );
            } else {
                // Fallback for very old browsers: synchronous XHR
                const xhr = new XMLHttpRequest();
                xhr.open('POST', API_ENDPOINT, false); // synchronous!
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(payload);
            }
        } catch (e) {
            // Silently fail — can't do much during unload
            console.error('[AccessLogger] sendBeacon failed:', e);
        }
    }

    /**
     * Build a log entry object
     * @private
     */
    _buildLogEntry(path, entryTime, exitTime, duration, walletAddress) {
        return {
            sessionId: sessionStorage.getItem('accessLogSessionId'),
            walletAddress: walletAddress || null,
            path: path,
            entryTime: entryTime.toISOString(),
            exitTime: exitTime.toISOString(),
            duration: duration,
            referrer: typeof window !== 'undefined' ? window.location.pathname : null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            screenWidth: typeof window !== 'undefined' ? window.screen.width : null,
            screenHeight: typeof window !== 'undefined' ? window.screen.height : null
        };
    }

    /**
     * Generate UUID v4
     * @private
     */
    _generateUUID() {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback UUID v4 generation
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Start periodic flush timer
     * @private
     */
    _startFlushTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => {
            this.flush().catch(err => {
                console.warn('[AccessLogger] Periodic flush error:', err);
            });
        }, FLUSH_INTERVAL_MS);
    }

    /**
     * Stop the flush timer (for testing or cleanup)
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

// Singleton instance
const accessLogger = new AccessLogger();

export default accessLogger;
