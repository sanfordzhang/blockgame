/**
 * EventListener - Blockchain Event Subscription
 * Listens for contract events and triggers callbacks
 */

class EventListener {
    constructor() {
        this.tronService = null;
        this.contractService = null;
        this.subscriptions = new Map();
        this.running = false;
    }

    /**
     * Initialize event listener
     */
    init(tronService, contractService) {
        this.tronService = tronService;
        this.contractService = contractService;
        console.log('[EventListener] Initialized');
        return this;
    }

    /**
     * Start listening for events
     */
    start() {
        if (this.running) {
            console.warn('[EventListener] Already running');
            return;
        }

        this.running = true;
        this.subscribeToEvents();
        console.log('[EventListener] Started listening for events');
    }

    /**
     * Stop listening for events
     */
    stop() {
        this.running = false;
        
        // Clear all subscriptions
        for (const [name, sub] of this.subscriptions) {
            if (sub && sub.unsubscribe) {
                sub.unsubscribe();
            }
        }
        this.subscriptions.clear();
        
        console.log('[EventListener] Stopped');
    }

    /**
     * Subscribe to all relevant events
     */
    subscribeToEvents() {
        const contract = this.contractService.contract;
        if (!contract) {
            console.warn('[EventListener] No contract to subscribe to');
            return;
        }

        // Player events
        this.subscribe('PlayerRegistered', this.onPlayerRegistered.bind(this));
        this.subscribe('Deposited', this.onDeposited.bind(this));
        this.subscribe('Withdrawn', this.onWithdrawn.bind(this));
        
        // Game events
        this.subscribe('JoinedTable', this.onJoinedTable.bind(this));
        this.subscribe('LeftTable', this.onLeftTable.bind(this));
        this.subscribe('GameStarted', this.onGameStarted.bind(this));
        this.subscribe('GameSettled', this.onGameSettled.bind(this));
        
        // Admin events
        this.subscribe('RakeRateChanged', this.onRakeRateChanged.bind(this));
        this.subscribe('RakeRateChangeScheduled', this.onRakeRateChangeScheduled.bind(this));
        this.subscribe('RakeWithdrawn', this.onRakeWithdrawn.bind(this));
    }

    /**
     * Subscribe to a specific event
     */
    subscribe(eventName, callback) {
        try {
            const contract = this.contractService.contract;
            
            // Use TronWeb's event watching
            const subscription = contract[eventName]().watch((err, event) => {
                if (err) {
                    console.error(`[EventListener] Error in ${eventName}:`, err);
                    return;
                }
                
                if (event) {
                    console.log(`[EventListener] ${eventName}:`, event);
                    callback(event);
                }
            });
            
            this.subscriptions.set(eventName, subscription);
            console.log(`[EventListener] Subscribed to ${eventName}`);
        } catch (error) {
            console.error(`[EventListener] Failed to subscribe to ${eventName}:`, error.message);
        }
    }

    // ============ Event Handlers ============

    onPlayerRegistered(event) {
        const { player, timestamp } = event.result;
        console.log(`[EventListener] Player registered: ${player} at ${timestamp}`);
        
        // Emit to socket clients
        if (global.io) {
            global.io.emit('blockchain:event', {
                type: 'PlayerRegistered',
                data: { player, timestamp }
            });
        }
    }

    onDeposited(event) {
        const { player, amount } = event.result;
        console.log(`[EventListener] Deposit: ${player} deposited ${amount} SUN`);
        
        if (global.io) {
            global.io.to(player).emit('balance:updated', {
                type: 'deposit',
                amount: amount.toNumber()
            });
        }
    }

    onWithdrawn(event) {
        const { player, amount } = event.result;
        console.log(`[EventListener] Withdrawal: ${player} withdrew ${amount} SUN`);
        
        if (global.io) {
            global.io.to(player).emit('balance:updated', {
                type: 'withdraw',
                amount: amount.toNumber()
            });
        }
    }

    onJoinedTable(event) {
        const { player, tableId, buyIn } = event.result;
        console.log(`[EventListener] ${player} joined table ${tableId} with ${buyIn} SUN`);
    }

    onLeftTable(event) {
        const { player, tableId, amount } = event.result;
        console.log(`[EventListener] ${player} left table ${tableId}, refunded ${amount} SUN`);
    }

    onGameStarted(event) {
        const { tableId, gameId, players } = event.result;
        console.log(`[EventListener] Game ${gameId} started at table ${tableId}`);
        
        if (global.io) {
            global.io.emit('game:started', {
                tableId: tableId.toNumber(),
                gameId: gameId.toNumber(),
                players
            });
        }
    }

    onGameSettled(event) {
        const { gameId, winners, amounts, rakeCollected } = event.result;
        console.log(`[EventListener] Game ${gameId} settled, rake: ${rakeCollected} SUN`);
        
        if (global.io) {
            // Notify winners
            winners.forEach((winner, i) => {
                global.io.to(winner).emit('game:settled', {
                    gameId: gameId.toNumber(),
                    won: true,
                    amount: amounts[i].toNumber()
                });
            });
        }
    }

    onRakeRateChanged(event) {
        const { oldRate, newRate, effectiveTime } = event.result;
        console.log(`[EventListener] Rake rate changed: ${oldRate} -> ${newRate}`);
        
        if (global.io) {
            global.io.emit('config:updated', {
                type: 'rakeRate',
                oldRate: oldRate.toNumber(),
                newRate: newRate.toNumber()
            });
        }
    }

    onRakeRateChangeScheduled(event) {
        const { newRate, effectiveTime } = event.result;
        console.log(`[EventListener] Rake rate change scheduled: ${newRate} at ${effectiveTime}`);
    }

    onRakeWithdrawn(event) {
        const { to, amount } = event.result;
        console.log(`[EventListener] Rake withdrawn: ${amount} SUN to ${to}`);
    }

    /**
     * Get subscription status
     */
    getSubscriptionStatus() {
        const status = {};
        for (const [name, sub] of this.subscriptions) {
            status[name] = sub ? 'active' : 'inactive';
        }
        return status;
    }
}

// Export singleton instance
module.exports = new EventListener();
