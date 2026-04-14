/**
 * EventListener - Blockchain Event Subscription
 * Listens for contract events and triggers callbacks
 */

class EventListener {
    constructor() {
        this.tronService = null;
        this.contractService = null;
        this.running = false;
        this.pollInterval = null;
        this.lastBlockNumber = 0;
        this.processedTxIds = new Set(); // Track processed transactions
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
        console.log('[EventListener] Started polling for events');

        // Start polling immediately
        this.pollEvents();
    }

    /**
     * Stop listening for events
     */
    stop() {
        this.running = false;

        if (this.pollInterval) {
            clearTimeout(this.pollInterval);
            this.pollInterval = null;
        }

        console.log('[EventListener] Stopped');
    }

    /**
     * Poll for events using TronWeb's getEventResult
     */
    async pollEvents() {
        if (!this.running) return;

        try {
            const contractAddress = this.contractService.getContractAddress();
            if (!contractAddress) {
                console.warn('[EventListener] No contract address');
                this.pollInterval = setTimeout(() => this.pollEvents(), 10000);
                return;
            }

            const tronWeb = this.tronService.getTronWeb();

            // Get events - returns {data: [...], success: true}
            const result = await tronWeb.getEventResult(contractAddress, {
                size: 20,
                sort: 'block_timestamp'
            });

            const events = result?.data || [];
            console.log(`[EventListener] Polled ${events.length} events from contract ${contractAddress}`);

            if (events.length > 0) {
                for (const event of events) {
                    // Skip already processed events
                    if (this.processedTxIds.has(event.transaction_id)) {
                        continue;
                    }

                    console.log(`[EventListener] Event: ${event.event_name}`, event);
                    this.handleEvent(event);

                    // Mark as processed
                    this.processedTxIds.add(event.transaction_id);

                    // Limit set size to prevent memory leak (keep last 1000)
                    if (this.processedTxIds.size > 1000) {
                        const firstItem = this.processedTxIds.values().next().value;
                        this.processedTxIds.delete(firstItem);
                    }
                }
            }

            // Reset backoff on success, poll every 15 seconds to avoid rate limiting
            this._backoffMs = 0;
            this.pollInterval = setTimeout(() => this.pollEvents(), 15000);

        } catch (error) {
            // Exponential backoff on rate limit (429) or network errors
            if (!this._backoffMs) this._backoffMs = 15000;
            else this._backoffMs = Math.min(this._backoffMs * 2, 120000); // max 2 min

            if (error.message && error.message.includes('429')) {
                console.warn(`[EventListener] Rate limited (429). Backing off ${this._backoffMs / 1000}s`);
            } else {
                console.error('[EventListener] Poll error:', error.message);
            }
            this.pollInterval = setTimeout(() => this.pollEvents(), this._backoffMs);
        }
    }

    /**
     * Handle a single event
     */
    handleEvent(event) {
        const eventName = event.event_name;

        switch (eventName) {
            case 'PlayerRegistered':
                this.onPlayerRegistered(event);
                break;
            case 'Deposited':
                this.onDeposited(event);
                break;
            case 'Withdrawn':
                this.onWithdrawn(event);
                break;
            case 'JoinedTable':
                this.onJoinedTable(event);
                break;
            case 'JoinedTableFor':
                this.onJoinedTableFor(event);
                break;
            case 'LeftTable':
                this.onLeftTable(event);
                break;
            case 'LeftTableFor':
                this.onLeftTableFor(event);
                break;
                break;
            case 'GameStarted':
                this.onGameStarted(event);
                break;
            case 'GameSettled':
                this.onGameSettled(event);
                break;
            case 'RakeRateChanged':
                this.onRakeRateChanged(event);
                break;
            case 'RakeRateChangeScheduled':
                this.onRakeRateChangeScheduled(event);
                break;
            case 'RakeWithdrawn':
                this.onRakeWithdrawn(event);
                break;
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
        const player = event.result.player || event.result[0];
        const amount = event.result.amount || event.result[1];
        const amountNum = typeof amount === 'object' && amount.toNumber ? amount.toNumber() : parseInt(amount);
        console.log(`[EventListener] ✅ DEPOSIT EVENT: ${player} deposited ${amountNum} SUN (${amountNum/1000000} TRX)`);
        console.log(`[EventListener] Event details:`, JSON.stringify(event.result, null, 2));

        if (global.io) {
            global.io.to(player).emit('balance:updated', {
                type: 'deposit',
                amount: amountNum
            });
        }
    }

    onWithdrawn(event) {
        const player = event.result.player || event.result[0];
        const amount = event.result.amount || event.result[1];
        const amountNum = typeof amount === 'object' && amount.toNumber ? amount.toNumber() : parseInt(amount);
        console.log(`[EventListener] Withdrawal: ${player} withdrew ${amountNum} SUN`);

        if (global.io) {
            global.io.to(player).emit('balance:updated', {
                type: 'withdraw',
                amount: amountNum
            });
        }
    }

    onJoinedTable(event) {
        const { player, tableId, buyIn } = event.result;
        console.log(`[EventListener] ${player} joined table ${tableId} with ${buyIn} SUN`);
    }

    // Find the socket ID for a player by wallet address
    _findPlayerSocket(walletAddress) {
        if (!global.players) return null;
        const normalizedAddress = walletAddress?.toLowerCase();
        for (const [socketId, player] of Object.entries(global.players)) {
            if (player.id?.toLowerCase() === normalizedAddress) {
                return socketId;
            }
        }
        return null;
    }

    onJoinedTableFor(event) {
        const player = event.result.player || event.result[0];
        const tableId = event.result.tableId || event.result[1];
        console.log(`[EventListener] JoinedTableFor: ${player} joined table ${tableId}`);

        // Sync balance from contract after join confirmed on-chain
        if (global.gameFlowIntegration && player) {
            const tronPlayer = this.tronService.hexToAddress(player);
            global.gameFlowIntegration.syncPlayerBalance(tronPlayer).then(balance => {
                console.log(`[EventListener] Balance synced after JoinedTableFor: locked=${balance.lockedAmount/1e6} TRX`);
                if (global.io) {
                    // Find the socket for this specific player, don't broadcast to everyone
                    const playerSocket = this._findPlayerSocket(tronPlayer);
                    if (playerSocket) {
                        global.io.to(playerSocket).emit('SC_BALANCE_SYNCED', {
                            walletAddress: tronPlayer,
                            balance: balance.balance,
                            locked: balance.lockedAmount,
                            available: balance.balance,
                            reason: 'join_confirmed'
                        });
                    }
                }
            }).catch(e => console.warn('[EventListener] Failed to sync after JoinedTableFor:', e.message));
        }
    }

    onLeftTable(event) {
        const { player, tableId, amount } = event.result;
        console.log(`[EventListener] ${player} left table ${tableId}, refunded ${amount} SUN`);
    }

    onLeftTableFor(event) {
        const player = event.result.player || event.result[0];
        const tableId = event.result.tableId || event.result[1];
        console.log(`[EventListener] LeftTableFor: ${player} left table ${tableId}`);

        // Sync real balance from contract after leave confirmed on-chain
        if (global.gameFlowIntegration && player) {
            const tronPlayer = this.tronService.hexToAddress(player);
            global.gameFlowIntegration.syncPlayerBalance(tronPlayer).then(balance => {
                console.log(`[EventListener] Balance synced after LeftTableFor: locked=${balance.lockedAmount/1e6} TRX`);
                if (global.io) {
                    // Find the socket for this specific player, don't broadcast to everyone
                    const playerSocket = this._findPlayerSocket(tronPlayer);
                    if (playerSocket) {
                        global.io.to(playerSocket).emit('SC_BALANCE_SYNCED', {
                            walletAddress: tronPlayer,
                            balance: balance.balance,
                            locked: balance.lockedAmount,
                            available: balance.balance,
                            reason: 'leave_confirmed'
                        });
                    }
                }
            }).catch(e => console.warn('[EventListener] Failed to sync after LeftTableFor:', e.message));
        }
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
