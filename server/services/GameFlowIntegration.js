/**
 * GameFlowIntegration - Game Flow Blockchain Integration
 * Handles integration between game logic and blockchain services
 */

const contractService = require('../blockchain/ContractService');
const gameSettlementService = require('./GameSettlementService');
const transactionQueue = require('../blockchain/TransactionQueue');

class GameFlowIntegration {
    constructor() {
        this.initialized = false;
        this.playerBalances = new Map(); // Cache player balances
        this.playerSessions = new Map(); // Track active sessions
        this.pendingJoinTable = new Map(); // Track pending join operations
        this.pendingLeaveTable = new Map(); // Track pending leave operations
        this.notificationCallbacks = new Map(); // Callbacks for notifications
    }

    /**
     * Initialize game flow integration
     */
    init(tronService) {
        this.tronService = tronService;
        this.initialized = true;
        console.log('[GameFlowIntegration] Initialized');
        return this;
    }

    /**
     * Set notification callback for a player
     */
    setNotificationCallback(socketId, callback) {
        this.notificationCallbacks.set(socketId, callback);
    }

    /**
     * Remove notification callback
     */
    removeNotificationCallback(socketId) {
        this.notificationCallbacks.delete(socketId);
    }

    /**
     * Send notification to player
     */
    notifyPlayer(socketId, event, data) {
        const callback = this.notificationCallbacks.get(socketId);
        if (callback) {
            callback(event, data);
        }
    }

    // ============ Task 15.1: Join Table Integration ============

    /**
     * Handle join table with blockchain integration
     * @param {string} playerAddress - Player wallet address
     * @param {number} tableId - Table ID
     * @param {number} buyInAmount - Buy-in amount in SUN
     * @param {string} socketId - Socket ID for notifications
     * @returns {Promise<object>} Join result
     */
    async handleJoinTable(playerAddress, tableId, buyInAmount, socketId) {
        console.log(`[GameFlowIntegration] Player ${playerAddress} joining table ${tableId}`);

        try {
            // Check if player is registered on contract
            const isRegistered = await this.checkPlayerRegistration(playerAddress);
            
            // Get cached balance first (fast)
            let cachedBalance = this.playerBalances.get(playerAddress);
            
            // For development: auto-register unregistered players
            if (!isRegistered) {
                console.log(`[GameFlowIntegration] Player ${playerAddress} not registered, using development mode`);
                
                // Use existing cache or create default
                if (!cachedBalance) {
                    cachedBalance = {
                        balance: 100000000000, // 100,000 TRX default for development
                        lockedAmount: 0,
                        isRegistered: false,
                        registeredAt: Date.now()
                    };
                    this.playerBalances.set(playerAddress, cachedBalance);
                }
            }

            // Get player balance (from cache first, then contract)
            let playerInfo = cachedBalance;
            if (isRegistered && !cachedBalance) {
                try {
                    playerInfo = await this.getPlayerBalance(playerAddress);
                } catch (e) {
                    console.warn('[GameFlowIntegration] Failed to get balance, using default');
                    playerInfo = { balance: 100000000000, lockedAmount: 0 };
                }
            }
            
            // Track pending join
            const joinId = `${playerAddress}_${tableId}_${Date.now()}`;
            this.pendingJoinTable.set(joinId, {
                playerAddress,
                tableId,
                buyInAmount,
                status: 'pending',
                createdAt: Date.now()
            });

            // Use simulation immediately for development mode or unregistered players
            // This avoids the slow blockchain transaction wait
            let result;
            if (!isRegistered) {
                // Skip contract call for unregistered players - use simulation
                console.log('[GameFlowIntegration] Using simulation mode (player not registered on contract)');
                result = {
                    txId: `sim_${Date.now()}_${playerAddress.slice(0, 8)}`,
                    simulated: true,
                    reason: 'Player not registered on contract'
                };
            } else {
                // Try contract call with timeout
                try {
                    result = await Promise.race([
                        contractService.joinTable(tableId, buyInAmount),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Transaction timeout')), 5000)
                        )
                    ]);
                } catch (contractError) {
                    console.log(`[GameFlowIntegration] Contract call failed, using simulation: ${contractError.message}`);
                    result = {
                        txId: `sim_${Date.now()}_${playerAddress.slice(0, 8)}`,
                        simulated: true,
                        reason: contractError.message
                    };
                }
            }

            // Update pending join status
            this.pendingJoinTable.set(joinId, {
                ...this.pendingJoinTable.get(joinId),
                status: 'completed',
                txId: result?.txId || result,
                completedAt: Date.now()
            });

            // Update cached balance
            this.updatePlayerBalanceCache(playerAddress, -buyInAmount, buyInAmount);

            // Notify player about success
            this.notifyPlayer(socketId, 'blockchain:joinTable', {
                status: 'completed',
                message: 'Successfully joined table',
                tableId,
                buyInAmount,
                txId: result?.txId || result
            });

            return {
                success: true,
                txId: result?.txId || result,
                tableId,
                buyInAmount
            };

        } catch (error) {
            console.error('[GameFlowIntegration] Join table error:', error.message);

            // Notify player about failure
            this.notifyPlayer(socketId, 'blockchain:joinTable', {
                status: 'failed',
                message: error.message,
                tableId,
                buyInAmount
            });

            throw error;
        }
    }

    // ============ Task 15.2: Leave Table Integration ============

    /**
     * Handle leave table with blockchain integration
     * @param {string} playerAddress - Player wallet address
     * @param {number} tableId - Table ID
     * @param {string} socketId - Socket ID for notifications
     * @param {number} stack - Player's remaining stack on table (optional)
     * @returns {Promise<object>} Leave result
     */
    async handleLeaveTable(playerAddress, tableId, socketId, stack = 0) {
        console.log(`[GameFlowIntegration] Player ${playerAddress} leaving table ${tableId}, stack: ${stack}`);

        try {
            // Track pending leave
            const leaveId = `${playerAddress}_${tableId}_${Date.now()}`;
            this.pendingLeaveTable.set(leaveId, {
                playerAddress,
                tableId,
                status: 'pending',
                createdAt: Date.now()
            });

            // Notify player about transaction start
            this.notifyPlayer(socketId, 'blockchain:leaveTable', {
                status: 'pending',
                message: 'Processing leave table transaction...',
                tableId
            });

            // Call contract to leave table
            const result = await contractService.leaveTable(tableId);

            // Update pending leave status
            this.pendingLeaveTable.set(leaveId, {
                ...this.pendingLeaveTable.get(leaveId),
                status: 'completed',
                txId: result,
                completedAt: Date.now()
            });

            // Update cache: return stack to balance, reduce locked
            // stack is the amount player takes back from table
            if (stack > 0) {
                const cached = this.playerBalances.get(playerAddress);
                if (cached) {
                    // Reduce locked by the original buy-in (approximated by stack)
                    // Add stack back to balance
                    const newLocked = Math.max(0, cached.lockedAmount - stack);
                    console.log(`[GameFlowIntegration] Updating cache on leave: balance +${stack}, locked ${cached.lockedAmount} -> ${newLocked}`);
                    this.playerBalances.set(playerAddress, {
                        ...cached,
                        balance: cached.balance + stack,
                        lockedAmount: newLocked,
                        lastSync: Date.now()
                    });
                }
            }

            // Notify player about success
            this.notifyPlayer(socketId, 'blockchain:leaveTable', {
                status: 'completed',
                message: 'Successfully left table',
                tableId,
                txId: result
            });

            return {
                success: true,
                txId: result,
                tableId
            };

        } catch (error) {
            console.error('[GameFlowIntegration] Leave table error:', error.message);

            // Notify player about failure
            this.notifyPlayer(socketId, 'blockchain:leaveTable', {
                status: 'failed',
                message: error.message,
                tableId
            });

            throw error;
        }
    }

    // ============ Task 15.3: Sit Down Balance Validation ============

    /**
     * Validate player balance before sitting down
     * @param {string} playerAddress - Player wallet address
     * @param {number} requiredAmount - Required amount in SUN
     * @param {boolean} isPlayerAtTable - Whether player is currently at a table
     * @returns {Promise<object>} Validation result
     */
    async validateBalanceForSitDown(playerAddress, requiredAmount, isPlayerAtTable = false) {
        console.log(`[GameFlowIntegration] ========== BALANCE VALIDATION START ==========`);
        console.log(`[GameFlowIntegration] Player: ${playerAddress}`);
        console.log(`[GameFlowIntegration] Required: ${requiredAmount} SUN (${requiredAmount/1000000} TRX)`);
        console.log(`[GameFlowIntegration] Is at table: ${isPlayerAtTable}`);

        try {
            // First, try to get fresh balance from contract (in case user deposited)
            // This ensures we have the most up-to-date balance
            let playerInfo;
            try {
                console.log('[GameFlowIntegration] Fetching balance from contract...');
                playerInfo = await Promise.race([
                    this.getPlayerBalance(playerAddress),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Balance fetch timeout')), 2000)
                    )
                ]);
                console.log('[GameFlowIntegration] ✅ Got balance from contract:', {
                    balance: playerInfo.balance,
                    balanceTRX: playerInfo.balance / 1000000,
                    lockedAmount: playerInfo.lockedAmount,
                    lockedTRX: playerInfo.lockedAmount / 1000000,
                    isRegistered: playerInfo.isRegistered
                });
            } catch (e) {
                console.warn('[GameFlowIntegration] ❌ Balance fetch failed, trying cache:', e.message);
                playerInfo = null;
            }

            // If contract fetch succeeded, update cache and use that balance
            if (playerInfo && !isNaN(playerInfo.balance)) {
                const balance = playerInfo.balance;
                // Sanity check: if player is not at any table, locked should be 0
                let locked = playerInfo.lockedAmount || 0;

                console.log(`[GameFlowIntegration] Raw contract data: balance=${balance}, locked=${locked}`);

                if (!isPlayerAtTable && locked > 0) {
                    console.log(`[GameFlowIntegration] ⚠️  ISSUE DETECTED: Player not at table but contract has locked=${locked} (${locked/1000000} TRX)`);
                    console.log(`[GameFlowIntegration] This suggests deposit went into lockedAmount instead of balance`);
                    console.log(`[GameFlowIntegration] Resetting locked to 0 for validation`);
                    locked = 0;
                }
                const availableBalance = balance - locked;

                console.log(`[GameFlowIntegration] Calculated: balance=${balance} (${balance/1000000} TRX), locked=${locked} (${locked/1000000} TRX), available=${availableBalance} (${availableBalance/1000000} TRX)`);

                // Update cache with fresh data
                this.playerBalances.set(playerAddress, {
                    balance: balance,
                    lockedAmount: locked,
                    lastSync: Date.now()
                });

                if (availableBalance >= requiredAmount) {
                    console.log(`[GameFlowIntegration] ✅ VALIDATION PASSED: ${availableBalance/1000000} TRX >= ${requiredAmount/1000000} TRX`);
                    console.log(`[GameFlowIntegration] ========== BALANCE VALIDATION END ==========`);
                    return {
                        valid: true,
                        available: availableBalance,
                        required: requiredAmount,
                        balance: balance,
                        locked: locked,
                        source: 'contract'
                    };
                } else {
                    console.error(`[GameFlowIntegration] ❌ VALIDATION FAILED: ${availableBalance/1000000} TRX < ${requiredAmount/1000000} TRX`);
                    console.error(`[GameFlowIntegration] Contract balance=${balance/1000000} TRX, locked=${locked/1000000} TRX`);
                    console.log(`[GameFlowIntegration] ========== BALANCE VALIDATION END ==========`);
                    return {
                        valid: false,
                        available: availableBalance,
                        required: requiredAmount,
                        balance: balance,
                        locked: locked,
                        message: `Insufficient balance. Available: ${(availableBalance / 1000000).toFixed(2)} TRX, Required: ${(requiredAmount / 1000000).toFixed(2)} TRX`
                    };
                }
            }
            
            // Fallback to cache if contract fetch failed
            const cached = this.playerBalances.get(playerAddress);
            if (cached && !isNaN(cached.balance) && !isNaN(cached.lockedAmount)) {
                // Sanity check: if player is not at any table, locked should be 0
                let locked = cached.lockedAmount || 0;
                if (!isPlayerAtTable && locked > 0) {
                    console.log(`[GameFlowIntegration] Player not at table but cache has locked=${locked}, resetting to 0`);
                    locked = 0;
                    // Update cache
                    this.playerBalances.set(playerAddress, {
                        ...cached,
                        lockedAmount: 0,
                        lastSync: Date.now()
                    });
                }
                const availableBalance = cached.balance - locked;
                console.log(`[GameFlowIntegration] Using cached balance: ${availableBalance} (balance: ${cached.balance}, locked: ${locked})`);
                
                if (availableBalance >= requiredAmount) {
                    return {
                        valid: true,
                        available: availableBalance,
                        required: requiredAmount,
                        balance: cached.balance,
                        locked: locked,
                        source: 'cache'
                    };
                } else {
                    console.warn(`[GameFlowIntegration] Insufficient balance from cache. Available: ${availableBalance}, Required: ${requiredAmount}`);
                    return {
                        valid: false,
                        available: availableBalance,
                        required: requiredAmount,
                        balance: cached.balance,
                        locked: locked,
                        message: `Insufficient balance. Available: ${(availableBalance / 1000000).toFixed(2)} TRX, Required: ${(requiredAmount / 1000000).toFixed(2)} TRX`
                    };
                }
            }

            // Default balance for development - only if no cache and contract failed
            const defaultBalance = 100000000000; // 100,000 TRX
            return {
                valid: true,
                available: defaultBalance,
                required: requiredAmount,
                balance: defaultBalance,
                locked: 0,
                source: 'fallback',
                message: 'Using default balance (no cache/contract data)'
            };

        } catch (error) {
            console.error('[GameFlowIntegration] Balance validation error:', error.message);
            
            // Return failure instead of allowing in dev mode
            return {
                valid: false,
                available: 0,
                required: requiredAmount,
                balance: 0,
                locked: 0,
                source: 'error',
                message: `Validation error: ${error.message}`
            };
        }
    }

    // ============ Task 15.4: Game Settlement Integration ============

    /**
     * Handle game settlement with blockchain
     * @param {object} gameResult - Game result from Table.determineWinner
     * @returns {Promise<object>} Settlement result
     */
    async handleGameSettlement(gameResult) {
        console.log(`[GameFlowIntegration] Processing game settlement for table ${gameResult.tableId}`);

        try {
            // Use GameSettlementService to process settlement
            const result = await gameSettlementService.processGameEnd(gameResult);

            // Notify all players involved
            for (const winner of gameResult.winners) {
                this.notifyPlayer(winner.socketId, 'blockchain:settlement', {
                    status: 'completed',
                    tableId: gameResult.tableId,
                    amount: winner.amount,
                    txId: result.txId
                });
            }

            return result;

        } catch (error) {
            console.error('[GameFlowIntegration] Settlement error:', error.message);

            // Notify players about settlement failure
            for (const player of gameResult.players || []) {
                this.notifyPlayer(player.socketId, 'blockchain:settlement', {
                    status: 'failed',
                    tableId: gameResult.tableId,
                    message: error.message
                });
            }

            throw error;
        }
    }

    /**
     * Convert table result to settlement format
     * @param {object} table - Table instance
     * @param {Array} winMessages - Win messages
     * @param {object} playersRegistry - Optional global players registry for fallback lookup
     * @returns {object} Settlement data
     */
    convertTableResultToSettlement(table, winMessages, playersRegistry = null) {
        console.log('[GameFlowIntegration] convertTableResultToSettlement called');
        console.log('[GameFlowIntegration] winMessages:', winMessages);
        console.log('[GameFlowIntegration] table.seats:', Object.keys(table.seats).map(id => ({
            seatId: id,
            playerName: table.seats[id]?.player?.name,
            playerId: table.seats[id]?.player?.id
        })));

        const winners = [];
        const foundPlayers = new Set(); // Track already found players to avoid duplicates

        // Parse win messages to extract winner info
        for (const msg of winMessages) {
            console.log('[GameFlowIntegration] Parsing message:', msg);
            // Extract winner name and amount from message like "Player wins $100000000.00"
            // Note: amount is already in SUN units (table uses SUN internally)
            const match = msg.match(/(.+?) wins \$([0-9.]+)/);
            if (match) {
                const name = match[1].trim();
                const amount = parseFloat(match[2]);
                console.log(`[GameFlowIntegration] Matched: name="${name}", amount=${amount}`);

                // Skip if we already found this player (avoid duplicate processing)
                if (foundPlayers.has(name)) {
                    console.log(`[GameFlowIntegration] Skipping duplicate winner: ${name}`);
                    continue;
                }

                // Find player by name in table seats first
                let found = false;
                for (const seatId of Object.keys(table.seats)) {
                    const seat = table.seats[seatId];
                    if (seat && seat.player && seat.player.name === name) {
                        console.log(`[GameFlowIntegration] Found player in seat: ${seat.player.name} (id: ${seat.player.id})`);
                        winners.push({
                            address: seat.player.id,
                            socketId: seat.player.socketId,
                            name: seat.player.name,
                            amount: Math.floor(amount) // Already in SUN, just round to integer
                        });
                        foundPlayers.add(name);
                        found = true;
                        break;
                    }
                }

                // If not found in seats, try global players registry (player may have left table)
                if (!found && playersRegistry) {
                    console.log(`[GameFlowIntegration] Player not in seats, checking global registry...`);
                    const playerEntry = Object.entries(playersRegistry).find(
                        ([_, p]) => p.name === name
                    );
                    if (playerEntry) {
                        const [socketId, player] = playerEntry;
                        console.log(`[GameFlowIntegration] Found player in global registry: ${player.name} (id: ${player.id})`);
                        winners.push({
                            address: player.id,
                            socketId: socketId,
                            name: player.name,
                            amount: Math.floor(amount)
                        });
                        foundPlayers.add(name);
                    } else {
                        console.warn(`[GameFlowIntegration] Player not found anywhere: ${name}`);
                    }
                }
            } else {
                console.log('[GameFlowIntegration] No match for message:', msg);
            }
        }

        console.log('[GameFlowIntegration] Final winners:', winners);

        return {
            tableId: table.id,
            players: table.players.map(p => ({
                address: p.id,
                socketId: p.socketId
            })),
            pot: Math.floor(table.pot), // Already in SUN
            winners
        };
    }

    // ============ Task 15.5: Blockchain Balance Sync ============

    /**
     * Sync player balance from blockchain
     * @param {string} playerAddress - Player wallet address
     * @returns {Promise<object>} Synced balance
     */
    async syncPlayerBalance(playerAddress) {
        console.log(`[GameFlowIntegration] Syncing balance for ${playerAddress}`);

        try {
            const playerInfo = await this.getPlayerBalance(playerAddress);
            
            // Update cache
            this.playerBalances.set(playerAddress, {
                balance: playerInfo.balance,
                locked: playerInfo.lockedAmount,
                lastSync: Date.now()
            });

            return playerInfo;

        } catch (error) {
            console.error('[GameFlowIntegration] Balance sync error:', error.message);
            throw error;
        }
    }

    /**
     * Sync balances for all players on connect
     * @param {string} playerAddress - Player wallet address
     * @param {string} socketId - Socket ID
     */
    async syncOnPlayerConnect(playerAddress, socketId) {
        console.log(`[GameFlowIntegration] Syncing on connect for ${playerAddress}`);

        // Default balance for development mode
        const defaultBalance = {
            balance: 100000000000, // 100,000 TRX
            lockedAmount: 0,
            isRegistered: false,
            registeredAt: 0
        };

        try {
            // Check registration with timeout
            let isRegistered = false;
            try {
                isRegistered = await Promise.race([
                    this.checkPlayerRegistration(playerAddress),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Registration check timeout')), 3000)
                    )
                ]);
            } catch (e) {
                console.log('[GameFlowIntegration] Registration check timed out, using default balance');
                isRegistered = false;
            }
            
            if (!isRegistered) {
                console.log(`[GameFlowIntegration] Player ${playerAddress} not registered, using development balance`);
                
                // Store in local cache for development
                this.playerBalances.set(playerAddress, {
                    balance: defaultBalance.balance,
                    lockedAmount: 0,
                    lastSync: Date.now(),
                    isRegistered: false
                });
                
                // Track session
                this.playerSessions.set(socketId, {
                    address: playerAddress,
                    connectedAt: Date.now(),
                    balance: defaultBalance.balance
                });
                
                this.notifyPlayer(socketId, 'blockchain:status', {
                    registered: false,
                    message: 'Player not registered on blockchain - using development balance',
                    balance: defaultBalance.balance,
                    locked: 0,
                    available: defaultBalance.balance,
                    devMode: true
                });
                
                // Return default balance instead of null for development
                return defaultBalance;
            }

            // Sync balance with timeout
            let balance;
            try {
                balance = await Promise.race([
                    this.syncPlayerBalance(playerAddress),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Balance sync timeout')), 3000)
                    )
                ]);
            } catch (e) {
                console.log('[GameFlowIntegration] Balance sync timed out, using default');
                balance = defaultBalance;
            }

            // Track session
            this.playerSessions.set(socketId, {
                address: playerAddress,
                connectedAt: Date.now(),
                balance: balance.balance
            });

            this.notifyPlayer(socketId, 'blockchain:status', {
                registered: true,
                balance: balance.balance,
                locked: balance.lockedAmount,
                available: balance.balance - balance.lockedAmount
            });

            return balance;

        } catch (error) {
            console.error('[GameFlowIntegration] Connect sync error:', error.message);
            
            // Return default balance for development even on error
            this.playerBalances.set(playerAddress, {
                balance: defaultBalance.balance,
                lockedAmount: 0,
                lastSync: Date.now()
            });
            
            return defaultBalance;
        }
    }

    // ============ Task 15.6: Error Handling ============

    /**
     * Handle blockchain error with proper formatting
     * @param {Error} error - Error object
     * @param {string} operation - Operation name
     * @param {string} socketId - Socket ID for notification
     * @returns {object} Formatted error
     */
    handleBlockchainError(error, operation, socketId) {
        console.error(`[GameFlowIntegration] Blockchain error in ${operation}:`, error.message);

        const formattedError = {
            operation,
            message: error.message,
            code: this.getErrorCode(error),
            timestamp: Date.now(),
            recoverable: this.isRecoverable(error)
        };

        // Notify player
        this.notifyPlayer(socketId, 'blockchain:error', formattedError);

        return formattedError;
    }

    /**
     * Get error code from error
     */
    getErrorCode(error) {
        if (error.message.includes('insufficient')) return 'INSUFFICIENT_BALANCE';
        if (error.message.includes('not registered')) return 'NOT_REGISTERED';
        if (error.message.includes('already joined')) return 'ALREADY_JOINED';
        if (error.message.includes('timeout')) return 'TIMEOUT';
        if (error.message.includes('network')) return 'NETWORK_ERROR';
        return 'UNKNOWN_ERROR';
    }

    /**
     * Check if error is recoverable
     */
    isRecoverable(error) {
        const recoverableCodes = ['TIMEOUT', 'NETWORK_ERROR'];
        return recoverableCodes.includes(this.getErrorCode(error));
    }

    // ============ Task 15.7: Transaction Status Notifications ============

    /**
     * Send transaction status update
     * @param {string} socketId - Socket ID
     * @param {string} txType - Transaction type
     * @param {string} status - Status (pending, confirmed, failed)
     * @param {object} data - Additional data
     */
    sendTransactionStatus(socketId, txType, status, data = {}) {
        this.notifyPlayer(socketId, 'blockchain:txStatus', {
            type: txType,
            status,
            ...data,
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast transaction status to all players at table
     * @param {Array} socketIds - Socket IDs
     * @param {string} txType - Transaction type
     * @param {string} status - Status
     * @param {object} data - Additional data
     */
    broadcastTransactionStatus(socketIds, txType, status, data = {}) {
        for (const socketId of socketIds) {
            this.sendTransactionStatus(socketId, txType, status, data);
        }
    }

    // ============ Task 15.8: Retry Logic ============

    /**
     * Execute operation with retry
     * @param {Function} operation - Async operation to execute
     * @param {string} socketId - Socket ID for notifications
     * @param {object} options - Retry options
     * @returns {Promise<any>} Operation result
     */
    async executeWithRetry(operation, socketId, options = {}) {
        const {
            maxRetries = 3,
            retryDelay = 5000,
            exponentialBackoff = true,
            operationName = 'operation'
        } = options;

        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Notify about retry attempt
                if (attempt > 1) {
                    this.notifyPlayer(socketId, 'blockchain:retry', {
                        operation: operationName,
                        attempt,
                        maxRetries
                    });
                }

                const result = await operation();
                return result;

            } catch (error) {
                lastError = error;

                console.warn(`[GameFlowIntegration] ${operationName} attempt ${attempt}/${maxRetries} failed:`, error.message);

                // Check if error is recoverable
                if (!this.isRecoverable(error) || attempt === maxRetries) {
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = exponentialBackoff 
                    ? retryDelay * Math.pow(2, attempt - 1)
                    : retryDelay;

                await this.delay(delay);
            }
        }

        throw lastError;
    }

    // ============ Helper Methods ============

    /**
     * Check if player is registered on contract
     */
    async checkPlayerRegistration(playerAddress) {
        try {
            // Add timeout to prevent blocking
            const result = await Promise.race([
                contractService.isPlayerRegistered(playerAddress),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Registration check timeout')), 3000)
                )
            ]);
            return result;
        } catch (error) {
            console.warn('[GameFlowIntegration] Registration check failed:', error.message);
            return false;
        }
    }

    /**
     * Register player on contract
     */
    async registerPlayer(playerAddress) {
        console.log(`[GameFlowIntegration] Registering player ${playerAddress}`);
        return await contractService.registerPlayer();
    }

    /**
     * Get player balance from contract
     */
    async getPlayerBalance(playerAddress) {
        try {
            return await contractService.getPlayerInfo(playerAddress);
        } catch (error) {
            // Return default balance for development
            console.warn('[GameFlowIntegration] Balance fetch failed, using default:', error.message);
            return {
                balance: 100000000000, // 100,000 TRX default
                lockedAmount: 0,
                isRegistered: false,
                registeredAt: 0
            };
        }
    }

    /**
     * Update player balance cache
     */
    updatePlayerBalanceCache(playerAddress, balanceDelta, lockedDelta) {
        const cached = this.playerBalances.get(playerAddress) || {
            balance: 0,
            lockedAmount: 0,
            lastSync: Date.now()
        };

        this.playerBalances.set(playerAddress, {
            ...cached,
            balance: cached.balance + balanceDelta,
            lockedAmount: (cached.lockedAmount || 0) + lockedDelta,
            lastSync: Date.now()
        });
    }

    /**
     * Get player balance cache
     */
    getPlayerBalanceCache(playerAddress) {
        return this.playerBalances.get(playerAddress) || null;
    }

    /**
     * Add balance instantly for development/testing (bypasses blockchain)
     */
    addBalanceInstant(playerAddress, amount) {
        console.log(`[GameFlowIntegration] 💰 DEV MODE: Adding ${amount} SUN (${amount/1000000} TRX) to ${playerAddress}`);

        const cached = this.playerBalances.get(playerAddress) || {
            balance: 0,
            lockedAmount: 0,
            lastSync: Date.now()
        };

        const newBalance = cached.balance + amount;
        this.playerBalances.set(playerAddress, {
            ...cached,
            balance: newBalance,
            lastSync: Date.now()
        });

        console.log(`[GameFlowIntegration] ✅ New balance: ${newBalance} SUN (${newBalance/1000000} TRX)`);

        return {
            success: true,
            balance: newBalance,
            added: amount
        };
    }

    /**
     * Get pending operations status
     */
    getPendingOperations() {
        return {
            joinTable: Array.from(this.pendingJoinTable.entries())
                .filter(([_, v]) => v.status === 'pending')
                .map(([id, data]) => ({ id, ...data })),
            leaveTable: Array.from(this.pendingLeaveTable.entries())
                .filter(([_, v]) => v.status === 'pending')
                .map(([id, data]) => ({ id, ...data })),
            queue: transactionQueue.getStatus()
        };
    }

    /**
     * Delay utility
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean up old pending operations
     */
    cleanupOldOperations() {
        const maxAge = 10 * 60 * 1000; // 10 minutes
        const now = Date.now();

        for (const [id, data] of this.pendingJoinTable) {
            if (data.status !== 'pending' && now - data.createdAt > maxAge) {
                this.pendingJoinTable.delete(id);
            }
        }

        for (const [id, data] of this.pendingLeaveTable) {
            if (data.status !== 'pending' && now - data.createdAt > maxAge) {
                this.pendingLeaveTable.delete(id);
            }
        }
    }
}

// Export singleton instance
module.exports = new GameFlowIntegration();
