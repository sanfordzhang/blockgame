/**
 * GameFlowIntegration - Game Flow Blockchain Integration
 * Handles integration between game logic and blockchain services
 */

const contractService = require('../blockchain/ContractService');
const gameSettlementService = require('./GameSettlementService');
const transactionQueue = require('../blockchain/TransactionQueue');
const { SC_BALANCE_SYNCED } = require('../pokergame/actions');
const config = require('../config');
const { getZeroGService } = require('../blockchain/blockchainFactory');
const ZeroGContractService = require('../blockchain/ZeroGContractService');

// Lazy-load SettlementRouter for 0G mode support
let _settlementRouter = null;
function getSettlementRouter() {
    if (!_settlementRouter) {
        try {
            _settlementRouter = require('./SettlementRouter');
        } catch (e) {
            console.warn('[GameFlowIntegration] SettlementRouter not available:', e.message);
        }
    }
    return _settlementRouter;
}

// ⚠️ TESTNET exchange rate constant: how many SUN per 0.001 of 0G token
// Derived from: 0.1 0G deposit ≡ 100M SUN game balance → 1 SUN ≡ 1e-9 0G
// PRODUCTION: change to market rate (~1 SUN ≡ 6e-7 0G)
const ZEROG_EXCHANGE_RATE = 1e9; // SUN → 0G divisor

class GameFlowIntegration {
    constructor() {
        this.initialized = false;
        this.playerBalances = new Map(); // Cache player balances
        this.playerSessions = new Map(); // Track active sessions
        this.pendingJoinTable = new Map(); // Track pending join operations
        this.pendingLeaveTable = new Map(); // Track pending leave operations
        this.notificationCallbacks = new Map(); // Callbacks for notifications
        this.asyncRetryTasks = new Map(); // Track async retry tasks
        this.retryIntervals = new Map(); // Track retry intervals
    }

    /**
     * Start async retry task for failed contract calls
     * 【要求5】异步重试机制
     */
    startAsyncRetry(operationType, playerAddress, tableId, amount, socketId, operationId) {
        const taskId = `${operationType}_${playerAddress}_${Date.now()}`;

        console.log(`[GameFlowIntegration] Starting async retry task: ${taskId}`);

        // 每30秒重试一次，最多重试10次
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 30000; // 30秒

        const intervalId = setInterval(async () => {
            retryCount++;
            console.log(`[GameFlowIntegration] Async retry ${retryCount}/${maxRetries} for ${taskId}`);

            if (retryCount > maxRetries) {
                console.error(`[GameFlowIntegration] Async retry exhausted for ${taskId}`);
                clearInterval(intervalId);
                this.retryIntervals.delete(taskId);
                this.asyncRetryTasks.delete(taskId);
                return;
            }

            try {
                let result;
                if (operationType === 'joinTable') {
                    result = await contractService.joinTable(tableId, amount);
                } else if (operationType === 'leaveTable') {
                    result = await contractService.leaveTableSession(tableId, amount);
                }

                console.log(`[GameFlowIntegration] ✅ Async retry SUCCESS for ${taskId}`);

                // 成功后同步状态
                clearInterval(intervalId);
                this.retryIntervals.delete(taskId);
                this.asyncRetryTasks.delete(taskId);

                // 从合约同步最新状态
                await this.syncPlayerBalance(playerAddress);
                const cachedBalance = this.getPlayerBalanceCache(playerAddress);

                // 通知客户端
                this.notifyPlayer(socketId, SC_BALANCE_SYNCED, {
                    balance: cachedBalance?.balance || 0,
                    locked: cachedBalance?.lockedAmount || 0,
                    available: cachedBalance?.balance || 0,
                    message: `${operationType} completed successfully (async retry)`
                });

            } catch (error) {
                console.error(`[GameFlowIntegration] Async retry failed for ${taskId}:`, error.message);
                // 继续重试
            }
        }, retryInterval);

        this.retryIntervals.set(taskId, intervalId);
        this.asyncRetryTasks.set(taskId, { operationType, playerAddress, tableId, amount, socketId, operationId, retryCount: 0 });
    }

    /**
     * Sync player balance from contract (with retry on 429)
     */
    async syncPlayerBalance(playerAddress) {
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const contractBalance = await contractService.getPlayerInfo(playerAddress);
                const newBalance = this.toNumber(contractBalance.balance);
                const newLocked = this.toNumber(contractBalance.lockedAmount);

                console.log(`[GameFlowIntegration] Syncing balance for ${playerAddress}`);
                console.log(`[GameFlowIntegration]   Contract: balance=${newBalance/1e6} TRX, locked=${newLocked/1e6} TRX`);

                this.setPlayerBalanceCache(playerAddress, newBalance, newLocked, {
                    pendingSync: false,
                    isRegistered: true
                });

                return { balance: newBalance, lockedAmount: newLocked };
            } catch (error) {
                const is429 = error.message && error.message.includes('429');
                if (is429 && attempt < maxRetries) {
                    const wait = attempt * 3000; // 3s, 6s
                    console.warn(`[GameFlowIntegration] Rate limited (429), retry ${attempt}/${maxRetries} in ${wait/1000}s`);
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                console.error('[GameFlowIntegration] Failed to sync balance:', error.message);
                throw error;
            }
        }
    }

    toNumber(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'string') return parseInt(value, 10);
        if (typeof value.toNumber === 'function') return value.toNumber();
        return Number(value);
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
    async handleJoinTable(playerAddress, tableId, buyInAmount, socketId, currentBankroll = 0) {
        console.log(`[GameFlowIntegration] Player ${playerAddress} joining table ${tableId}`);

        try {
            // Check if player is registered on contract
            const isRegistered = await this.checkPlayerRegistration(playerAddress);

            // 【要求3】注册失败不让进入游戏 - 抛出错误而不是回退到开发模式
            if (!isRegistered) {
                console.log(`[GameFlowIntegration] Player ${playerAddress} not registered`);

                // Try to auto-register on contract
                try {
                    console.log('[GameFlowIntegration] Attempting auto-registration...');
                    await this.registerPlayer(playerAddress);
                    console.log('[GameFlowIntegration] Auto-registration successful!');
                } catch (registerError) {
                    console.error('[GameFlowIntegration] Auto-registration FAILED:', registerError.message);
                    // 【要求3】不回退到开发模式，直接拒绝进入
                    throw new Error(`Registration required. Please register on the smart contract first. Error: ${registerError.message}`);
                }
            }

            // Get cached balance first (fast)
            let cachedBalance = this.getPlayerBalanceCache(playerAddress);

            // Log balance info BEFORE join
            const gameBalanceBefore = cachedBalance ? cachedBalance.balance : 0;
            const lockedBefore = cachedBalance ? cachedBalance.lockedAmount : 0;
            console.log(`[GameFlowIntegration] ========== JOIN TABLE BEFORE ==========`);
            console.log(`[GameFlowIntegration] Player: ${playerAddress}`);
            console.log(`[GameFlowIntegration] Game Balance (balance): ${gameBalanceBefore / 1e6} TRX`);
            console.log(`[GameFlowIntegration] Game Balance (locked): ${lockedBefore / 1e6} TRX`);
            console.log(`[GameFlowIntegration] Buy-in amount: ${buyInAmount / 1e6} TRX`);
            console.log(`[GameFlowIntegration] ============================================`);

            // Get player balance (from cache first, then contract)
            let playerInfo = cachedBalance;
            if (!cachedBalance) {
                try {
                    playerInfo = await this.getPlayerBalance(playerAddress);
                } catch (e) {
                    console.error('[GameFlowIntegration] Failed to get balance:', e.message);
                    throw new Error('Failed to get player balance from contract');
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

            // 【要求5】先更新本地缓存，确保用户可以继续操作
            // 这样即使合约调用还在进行，用户也能看到本地状态
            const cachedBeforeUpdate = this.getPlayerBalanceCache(playerAddress);
            const localBalance = cachedBeforeUpdate ? cachedBeforeUpdate.balance : (playerInfo?.balance || 0);
            const localLocked = cachedBeforeUpdate ? cachedBeforeUpdate.lockedAmount : (playerInfo?.lockedAmount || 0);

            // 更新本地缓存：balance 不变，locked 增加
            this.setPlayerBalanceCache(playerAddress, localBalance, localLocked + buyInAmount, {
                balance: localBalance,
                lockedAmount: localLocked + buyInAmount,
                pendingSync: true,  // 标记为待同步
                pendingTxType: 'joinTable',
                pendingTxData: { tableId, buyInAmount }
            });

            console.log(`[GameFlowIntegration] Local cache updated: balance=${localBalance/1e6} TRX, locked=${(localLocked + buyInAmount)/1e6} TRX`);

            // 【要求4和5】合约调用，加入重试机制
            const MAX_RETRIES = 3;
            const RETRY_DELAY = 2000; // 2秒
            let result = null;
            let lastError = null;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                try {
                    console.log(`[GameFlowIntegration] Contract joinTable attempt ${attempt}/${MAX_RETRIES}`);
                    result = await Promise.race([
                        contractService.joinTable(tableId, buyInAmount),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Transaction timeout')), 30000)  // 30秒超时
                        )
                    ]);
                    console.log(`[GameFlowIntegration] ✅ Contract joinTable SUCCESS on attempt ${attempt}`);
                    break; // 成功则退出循环
                } catch (contractError) {
                    lastError = contractError;
                    console.error(`[GameFlowIntegration] ❌ Contract joinTable FAILED attempt ${attempt}: ${contractError.message}`);

                    if (attempt < MAX_RETRIES) {
                        console.log(`[GameFlowIntegration] Retrying in ${RETRY_DELAY/1000}s...`);
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    }
                }
            }

            if (!result) {
                // 【要求5】所有重试都失败，启动异步重试任务
                console.error(`[GameFlowIntegration] All ${MAX_RETRIES} attempts failed, starting async retry task`);
                this.startAsyncRetry('joinTable', playerAddress, tableId, buyInAmount, socketId, joinId);

                // 暂时返回成功（使用本地缓存），用户可以继续游戏
                // 异步重试成功后会同步状态
                result = {
                    txId: `pending_${Date.now()}_${playerAddress.slice(0, 8)}`,
                    pending: true,
                    message: 'Transaction pending, will retry in background'
                };
            }

            // Update pending join status
            this.pendingJoinTable.set(joinId, {
                ...this.pendingJoinTable.get(joinId),
                status: result?.pending ? 'pending_retry' : 'completed',
                txId: result?.txId || result,
                completedAt: Date.now()
            });

            // 【要求5】如果合约调用成功，从合约同步最新状态
            if (result && !result.pending) {
                try {
                    console.log('[GameFlowIntegration] Syncing balance from contract after successful join...');
                    const freshBalance = await this.syncPlayerBalance(playerAddress);
                    console.log(`[GameFlowIntegration] Synced from contract: balance=${freshBalance.balance/1e6} TRX, locked=${freshBalance.lockedAmount/1e6} TRX`);
                } catch (syncError) {
                    console.warn('[GameFlowIntegration] Failed to sync from contract, keeping local cache:', syncError.message);
                }
            }

            // Log balance info AFTER join
            const updatedCache = this.getPlayerBalanceCache(playerAddress);
            const gameBalanceAfter = updatedCache ? updatedCache.balance : 0;
            const lockedAfter = updatedCache ? updatedCache.lockedAmount : 0;
            console.log(`[GameFlowIntegration] ========== JOIN TABLE AFTER ==========`);
            console.log(`[GameFlowIntegration] Player: ${playerAddress}`);
            console.log(`[GameFlowIntegration] Game Balance (balance): ${gameBalanceAfter / 1e6} TRX`);
            console.log(`[GameFlowIntegration] Game Balance (locked): ${lockedAfter / 1e6} TRX`);
            console.log(`[GameFlowIntegration] Pending sync: ${updatedCache?.pendingSync || false}`);
            console.log(`[GameFlowIntegration] ============================================`);

            // Notify player about success
            this.notifyPlayer(socketId, 'blockchain:joinTable', {
                status: result?.pending ? 'pending' : 'completed',
                message: result?.pending ? 'Join table pending, retrying in background' : 'Successfully joined table',
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
     * Rule e: On leaving, stack returns to balance, then sync bankroll
     * Rule j: Session mode - final settlement happens here
     * @param {string} playerAddress - Player wallet address
     * @param {number} tableId - Table ID
     * @param {string} socketId - Socket ID for notifications
     * @param {number} stack - Player's remaining stack on table
     * @returns {Promise<object>} Leave result
     */
    async handleLeaveTable(playerAddress, tableId, socketId, stack = 0, currentBankroll = 0) {
        console.log(`[GameFlowIntegration] Player ${playerAddress} leaving table ${tableId}, stack: ${stack}`);

        // Get cached balance BEFORE leave
        const cachedBefore = this.getPlayerBalanceCache(playerAddress);
        const gameBalanceBefore = cachedBefore ? cachedBefore.balance : 0;
        const lockedBefore = cachedBefore ? cachedBefore.lockedAmount : 0;
        console.log(`[GameFlowIntegration] ========== LEAVE TABLE BEFORE ==========`);
        console.log(`[GameFlowIntegration] Player: ${playerAddress}`);
        console.log(`[GameFlowIntegration] Game Balance (balance): ${gameBalanceBefore / 1e6} TRX`);
        console.log(`[GameFlowIntegration] Game Balance (locked): ${lockedBefore / 1e6} TRX`);
        console.log(`[GameFlowIntegration] Stack to return: ${stack / 1e6} TRX`);
        console.log(`[GameFlowIntegration] ============================================`);

        // Track pending leave
        const leaveId = `${playerAddress}_${tableId}_${Date.now()}`;
        this.pendingLeaveTable.set(leaveId, {
            playerAddress,
            tableId,
            stack,
            status: 'pending',
            createdAt: Date.now()
        });

        // 【要求5】先更新本地缓存
        // locked 清零，balance 增加 stack（stack 是玩家在桌上的筹码）
        const localBalance = cachedBefore ? cachedBefore.balance : 0;
        const localLocked = cachedBefore ? cachedBefore.lockedAmount : 0;

        // 注意：根据合约逻辑，leaveTableSession 会：
        // 1. 清除 locked
        // 2. 将 finalStack 加到 balance
        // 所以本地缓存应该：balance = balance + stack, locked = 0
        this.setPlayerBalanceCache(playerAddress, localBalance + stack, 0, {
            balance: localBalance + stack,
            lockedAmount: 0,  // 清除 locked
            pendingSync: true,
            pendingTxType: 'leaveTable',
            pendingTxData: { tableId, stack }
        });

        console.log(`[GameFlowIntegration] Local cache updated: balance=${(localBalance + stack)/1e6} TRX, locked=0 TRX`);

        // 通知玩家本地状态已更新
        this.notifyPlayer(socketId, SC_BALANCE_SYNCED, {
            balance: localBalance + stack,
            locked: 0,
            available: localBalance + stack,
            message: 'Local balance updated, confirming on blockchain...'
        });

        // 【要求4和5】合约调用，加入重试机制
        // 根据区块链模式选择结算路径：TRON 用 leaveTableSession，0G 用 settle（含 SUN→0G 转换）
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000;
        let result = null;
        let lastError = null;
        const isZeroGMode = (config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both');

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (isZeroGMode) {
                    // 0G MODE: use leaveTableSession (mirrors TRON's leaveTableSession)
                    const router = getSettlementRouter();
                    if (router && router.zerogContractService) {
                        const stackWei = BigInt(stack);  // SUN-equivalent → wei for 0G
                        console.log(`[GameFlowIntegration] 0G leaveTableSession attempt ${attempt}/${MAX_RETRIES}, stack=${stack} SUN (${stackWei} wei)`);
                        result = await router.zerogContractService.leaveTableSession(playerAddress, stackWei);
                        console.log(`[GameFlowIntegration] OK 0G leaveTableSession SUCCESS on attempt ${attempt}`);
                    } else {
                        console.warn('[GameFlowIntegration] ZeroGContractService not available, skipping on-chain settlement');
                        result = { fallback: true, message: 'ZeroG service not initialized' };
                    }
                } else {
                    console.log(`[GameFlowIntegration] leaveTableSession attempt ${attempt}/${MAX_RETRIES}`);
                    result = await Promise.race([
                        contractService.leaveTableSession(tableId, stack),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Transaction timeout')), 30000)
                        )
                    ]);
                    console.log(`[GameFlowIntegration] OK leaveTableSession SUCCESS on attempt ${attempt}`);
                }
                break;
            } catch (err) {
                lastError = err;
                console.error(`[GameFlowIntegration] X leaveTable FAILED attempt ${attempt}: ${err.message}`);

                if (!isZeroGMode && attempt === 1) {
                    try {
                        console.log('[GameFlowIntegration] Trying fallback: regular leaveTable');
                        result = await contractService.leaveTable(tableId);
                        console.log('[GameFlowIntegration] OK regular leaveTable SUCCESS');
                        break;
                    } catch (regularError) {
                        console.error(`[GameFlowIntegration] Regular leaveTable also failed: ${regularError.message}`);
                    }
                }

                if (attempt < MAX_RETRIES) {
                    console.log(`[GameFlowIntegration] Retrying in ${RETRY_DELAY/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
            }
        }
        if (!result) {
            // 【要求5】所有重试都失败，启动异步重试任务
            console.error(`[GameFlowIntegration] All ${MAX_RETRIES} attempts failed, starting async retry task`);
            this.startAsyncRetry('leaveTable', playerAddress, tableId, stack, socketId, leaveId);

            // 返回成功（本地缓存已更新），异步重试会同步状态
            result = {
                txId: `pending_${Date.now()}_${playerAddress.slice(0, 8)}`,
                pending: true,
                message: 'Transaction pending, will retry in background'
            };
        }

        // Update pending leave status
        this.pendingLeaveTable.set(leaveId, {
            ...this.pendingLeaveTable.get(leaveId),
            status: result?.pending ? 'pending_retry' : 'completed',
            txId: result?.txId || result,
            completedAt: Date.now()
        });

        // 【要求5】如果合约调用成功，从合约同步最新状态
        if (result && !result.pending) {
            try {
                console.log('[GameFlowIntegration] Syncing balance from contract after successful leave...');
                const freshBalance = await this.syncPlayerBalance(playerAddress);
                console.log(`[GameFlowIntegration] Synced from contract: balance=${freshBalance.balance/1e6} TRX, locked=${freshBalance.lockedAmount/1e6} TRX`);
            } catch (syncError) {
                console.warn('[GameFlowIntegration] Failed to sync from contract, keeping local cache:', syncError.message);
            }
        }

        // Notify player about result
        this.notifyPlayer(socketId, 'blockchain:leaveTable', {
            status: result?.pending ? 'pending' : 'completed',
            message: result?.pending ? 'Leave table pending, retrying in background' : 'Successfully left table',
            tableId,
            txId: result?.txId || result,
            stackReturned: stack
        });

        // Log balance info AFTER leave
        const cachedAfter = this.getPlayerBalanceCache(playerAddress);
        const gameBalanceAfter = cachedAfter ? cachedAfter.balance : 0;
        const lockedAfter = cachedAfter ? cachedAfter.lockedAmount : 0;
        console.log(`[GameFlowIntegration] ========== LEAVE TABLE AFTER ==========`);
        console.log(`[GameFlowIntegration] Player: ${playerAddress}`);
        console.log(`[GameFlowIntegration] Game Balance (balance): ${gameBalanceAfter / 1e6} TRX`);
        console.log(`[GameFlowIntegration] Game Balance (locked): ${lockedAfter / 1e6} TRX`);
        console.log(`[GameFlowIntegration] Pending sync: ${cachedAfter?.pendingSync || false}`);
        console.log(`[GameFlowIntegration] ============================================`);

        return {
            success: true,
            txId: result?.txId || result,
            tableId,
            stackReturned: stack,
            pending: result?.pending || false
        };
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

        // Guest players bypass blockchain validation — they use demo balance
        const isGuest = !playerAddress || playerAddress.startsWith('guest_');
        if (isGuest) {
            return {
                valid: true,
                available: 100000000,
                required: requiredAmount,
                balance: 100000000,
                locked: 0,
                source: 'guest_demo'
            };
        }

        try {
            // Check cache first - if it was just optimistically updated (pendingSync), use it
            const pendingCache = this.getPlayerBalanceCache(playerAddress);
            if (pendingCache && pendingCache.pendingSync && (Date.now() - pendingCache.lastSync) < 30000) {
                console.log(`[GameFlowIntegration] Using optimistic cache (pendingSync): balance=${pendingCache.balance/1e6} TRX, locked=${pendingCache.lockedAmount/1e6} TRX`);
                // After joinTableFor, funds are locked in contract - use locked amount for validation
                const pendingJoinWei = this.toBigIntBalance(pendingCache.pendingJoinBuyInWei || 0);
                const lockedWei = this.toBigIntBalance(pendingCache.rawLockedWei ?? pendingCache.lockedAmount ?? 0);
                const balanceWei = this.toBigIntBalance(pendingCache.rawBalanceWei ?? pendingCache.balance ?? 0);
                const requiredWei = BigInt(Math.max(0, Math.trunc(Number(requiredAmount || 0)))) * 1000000000n;
                const hasPendingZeroGJoin = pendingJoinWei > 0n && lockedWei >= pendingJoinWei && pendingJoinWei >= requiredWei;
                const availableBalance = hasPendingZeroGJoin ? Number(pendingJoinWei) : (pendingCache.lockedAmount || pendingCache.balance);

                if (hasPendingZeroGJoin || availableBalance >= requiredAmount) {
                    console.log(`[GameFlowIntegration] ✅ VALIDATION PASSED (cache): pendingJoin=${hasPendingZeroGJoin}, balanceWei=${balanceWei}, lockedWei=${lockedWei}, requiredWei=${requiredWei}`);
                    console.log(`[GameFlowIntegration] ========== BALANCE VALIDATION END ==========`);
                    return { valid: true, available: availableBalance, required: requiredAmount, balance: pendingCache.balance, locked: pendingCache.lockedAmount, source: 'cache' };
                }
            }

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

                // Rule a: bankroll = balance (don't subtract locked)
                // Rule c: Don't subtract locked locally, wait for contract sync
                // Player can use their full balance for sit-down if not at table
                // If at table, check if balance (not locked) is enough for rebuy
                const pendingCacheForContract = this.getPlayerBalanceCache(playerAddress);
                const pendingJoinWei = this.toBigIntBalance(pendingCacheForContract?.pendingJoinBuyInWei || 0);
                const lockedWei = this.toBigIntBalance(pendingCacheForContract?.rawLockedWei ?? locked ?? 0);
                const requiredWei = BigInt(Math.max(0, Math.trunc(Number(requiredAmount || 0)))) * 1000000000n;
                const hasPendingZeroGJoin = pendingCacheForContract?.pendingSync &&
                    (Date.now() - pendingCacheForContract.lastSync) < 30000 &&
                    pendingJoinWei > 0n &&
                    lockedWei >= pendingJoinWei &&
                    pendingJoinWei >= requiredWei;

                if (!isPlayerAtTable && locked > 0 && !hasPendingZeroGJoin) {
                    console.log(`[GameFlowIntegration] ⚠️  ISSUE DETECTED: Player not at table but contract has locked=${locked} (${locked/1000000} TRX)`);
                    console.log(`[GameFlowIntegration] This suggests deposit went into lockedAmount instead of balance`);
                    console.log(`[GameFlowIntegration] Resetting locked to 0 for validation`);
                    locked = 0;
                }
                
                // Rule a: availableBalance = balance (bankroll = balance)
                // For sit-down validation: player needs to have enough balance
                const availableBalance = hasPendingZeroGJoin ? Number(pendingJoinWei) : balance;  // Rule a: bankroll = balance

                console.log(`[GameFlowIntegration] Calculated: balance=${balance} (${balance/1000000} TRX), locked=${locked} (${locked/1000000} TRX), available=${availableBalance} (${availableBalance/1000000} TRX)`);

                // Update cache with fresh data
                this.setPlayerBalanceCache(playerAddress, balance, locked, {
                    ...(pendingCacheForContract || {}),
                    pendingSync: hasPendingZeroGJoin,
                    pendingJoinBuyInWei: hasPendingZeroGJoin ? pendingJoinWei.toString() : undefined
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
            const cached = this.getPlayerBalanceCache(playerAddress);
            if (cached && !isNaN(cached.balance) && !isNaN(cached.lockedAmount)) {
                // Sanity check: if player is not at any table, locked should be 0
                let locked = cached.lockedAmount || 0;
                if (!isPlayerAtTable && locked > 0) {
                    console.log(`[GameFlowIntegration] Player not at table but cache has locked=${locked}, resetting to 0`);
                    locked = 0;
                    // Update cache
                    this.setPlayerBalanceCache(playerAddress, cached.balance, 0, {
                        ...cached,
                        lockedAmount: 0,
                    });
                }
                // Rule a: availableBalance = balance (bankroll = balance)
                const availableBalance = cached.balance;  // Rule a: bankroll = balance
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
     * Handle game settlement with blockchain (Legacy mode)
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
     * Handle game settlement in Session mode
     * Rule j: settleGameSession only updates stack, locked unchanged
     * @param {object} gameResult - Game result from Table.determineWinner
     * @param {Array} playerStacks - Array of {address, stackBefore, stackAfter} for all players
     * @returns {Promise<object>} Settlement result
     */
    async handleGameSettlementSession(gameResult, playerStacks = []) {
        console.log(`[GameFlowIntegration] Processing SESSION MODE settlement for table ${gameResult.tableId}`);

        try {
            // Prepare data for settleGameSession
            const playersToUpdate = [];
            const stackDeltas = [];

            // Calculate stack delta for each player
            // Only include players with non-zero delta to save gas and avoid contract revert
            for (const playerStack of playerStacks) {
                // Delta = stackAfter - stackBefore (positive = win, negative = lose)
                const delta = playerStack.stackAfter - playerStack.stackBefore;
                console.log(`[GameFlowIntegration] Player ${playerStack.address}: stack ${playerStack.stackBefore} -> ${playerStack.stackAfter}, delta=${delta}`);

                // Skip players with no stack change
                if (delta === 0) {
                    console.log(`[GameFlowIntegration] Skipping player ${playerStack.address} (delta=0)`);
                    continue;
                }

                playersToUpdate.push(playerStack.address);
                stackDeltas.push(delta);
            }

            console.log(`[GameFlowIntegration] Session settlement: ${playersToUpdate.length} players with stack changes`);
            console.log(`[GameFlowIntegration] Stack deltas:`, stackDeltas);

            // If no players have stack changes, skip contract call
            if (playersToUpdate.length === 0) {
                console.log(`[GameFlowIntegration] No stack changes to settle, skipping contract call`);
                return { txId: null, mode: 'session', skipped: true };
            }

            // Generate result hash for verification
            const crypto = require('crypto');
            const resultHash = '0x' + crypto
                .createHash('sha256')
                .update(JSON.stringify({ playersToUpdate, stackDeltas, tableId: gameResult.tableId }))
                .digest('hex');

            // Call contract settleGameSession
            const result = await contractService.settleGameSession(
                gameResult.tableId,
                playersToUpdate,
                stackDeltas,
                resultHash
            );

            // Notify all players involved
            for (const winner of gameResult.winners) {
                this.notifyPlayer(winner.socketId, 'blockchain:settlement', {
                    status: 'completed',
                    tableId: gameResult.tableId,
                    amount: winner.amount,
                    txId: result,
                    mode: 'session'
                });
            }

            return { txId: result, mode: 'session' };

        } catch (error) {
            console.error('[GameFlowIntegration] Session settlement error:', error.message);

            // Notify players about settlement failure
            for (const player of gameResult.players || []) {
                this.notifyPlayer(player.socketId, 'blockchain:settlement', {
                    status: 'failed',
                    tableId: gameResult.tableId,
                    message: error.message,
                    mode: 'session'
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
            this.setPlayerBalanceCache(playerAddress, playerInfo.balance, playerInfo.lockedAmount, {
                pendingSync: false
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

        // Use cached balance as fallback when API is rate-limited (429)
        const cached = this.getPlayerBalanceCache(playerAddress);
        const cachedFallback = cached && cached.balance > 0 ? cached : null;

        if (this.isZeroGAddress(playerAddress) && (config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both')) {
            try {
                const balance = await this.syncZeroGPlayerBalance(playerAddress);
                this.playerSessions.set(socketId, {
                    address: playerAddress,
                    connectedAt: Date.now(),
                    balance: balance.balance
                });
                this.notifyPlayer(socketId, 'blockchain:status', {
                    registered: balance.isRegistered,
                    balance: balance.rawBalanceWei,
                    locked: balance.rawLockedWei,
                    available: balance.rawBalanceWei,
                    chain: '0G'
                });
                return balance;
            } catch (error) {
                console.warn('[GameFlowIntegration] 0G connect sync failed:', error.message);
                if (cachedFallback) return cachedFallback;
                return {
                    balance: 0,
                    lockedAmount: 0,
                    rawBalanceWei: '0',
                    rawLockedWei: '0',
                    isRegistered: false,
                    chain: '0G'
                };
            }
        }

        try {
            // Check registration with timeout
            let isRegistered = false;
            try {
                isRegistered = await Promise.race([
                    this.checkPlayerRegistration(playerAddress),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Registration check timeout')), 10000)
                    )
                ]);
            } catch (e) {
                console.warn('[GameFlowIntegration] Registration check failed:', e.message);
                // If we have a cached balance, the player was registered before
                if (cachedFallback) {
                    console.log('[GameFlowIntegration] Using cached balance as fallback:', cachedFallback.balance / 1e6, 'TRX');
                    return cachedFallback;
                }
                isRegistered = false;
            }

            if (!isRegistered) {
                // If cached balance exists, player was registered before — API just failed
                if (cachedFallback) {
                    console.log(`[GameFlowIntegration] API failed but player has cached balance: ${cachedFallback.balance / 1e6} TRX`);
                    return cachedFallback;
                }

                console.log(`[GameFlowIntegration] Player ${playerAddress} not registered`);

                const defaultBalance = { balance: 0, lockedAmount: 0, isRegistered: false };
                this.setPlayerBalanceCache(playerAddress, 0, 0, { isRegistered: false, pendingSync: false });
                this.playerSessions.set(socketId, {
                    address: playerAddress, connectedAt: Date.now(), balance: 0
                });
                this.notifyPlayer(socketId, 'blockchain:status', {
                    registered: false, balance: 0, locked: 0, available: 0, devMode: true
                });
                return defaultBalance;
            }

            // Sync balance with timeout (allow for retries: 3 attempts × 6s max = 18s)
            let balance;
            try {
                balance = await Promise.race([
                    this.syncPlayerBalance(playerAddress),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Balance sync timeout')), 25000)
                    )
                ]);
            } catch (e) {
                console.warn('[GameFlowIntegration] Balance sync failed:', e.message);
                // Use cached balance if available, otherwise 0
                if (cachedFallback) {
                    console.log('[GameFlowIntegration] Using cached balance fallback:', cachedFallback.balance / 1e6, 'TRX');
                    balance = cachedFallback;
                } else {
                    balance = { balance: 0, lockedAmount: 0 };
                }
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

            // Use cached balance if available
            if (cachedFallback) {
                console.log('[GameFlowIntegration] Error fallback: using cached balance:', cachedFallback.balance / 1e6, 'TRX');
                return cachedFallback;
            }

            return { balance: 0, lockedAmount: 0 };
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
        if (this.isZeroGAddress(playerAddress) && (config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both')) {
            const info = await this.getZeroGPlayerBalance(playerAddress);
            return info.isRegistered;
        }

        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await Promise.race([
                    contractService.isPlayerRegistered(playerAddress),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Registration check timeout')), 5000)
                    )
                ]);
                return result;
            } catch (error) {
                const is429 = error.message && error.message.includes('429');
                if (is429 && attempt < maxRetries) {
                    const wait = attempt * 3000;
                    console.warn(`[GameFlowIntegration] Registration check 429, retry ${attempt}/${maxRetries} in ${wait/1000}s`);
                    await new Promise(r => setTimeout(r, wait));
                    continue;
                }
                console.warn('[GameFlowIntegration] Registration check failed:', error.message);
                return false;
            }
        }
        return false;
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
        if (this.isZeroGAddress(playerAddress) && (config.BLOCKCHAIN_MODE === '0g' || config.BLOCKCHAIN_MODE === 'both')) {
            return await this.syncZeroGPlayerBalance(playerAddress);
        }

        try {
            return await contractService.getPlayerInfo(playerAddress);
        } catch (error) {
            // Do NOT return fake balance - rethrow so caller can handle properly
            console.warn('[GameFlowIntegration] Balance fetch failed:', error.message);
            throw error;
        }
    }

    /**
     * Update player balance cache
     */
    updatePlayerBalanceCache(playerAddress, balanceDelta, lockedDelta, devMode = false) {
        const key = this.normalizeAddress(playerAddress);
        const cached = this.playerBalances.get(key) || {
            balance: 0,
            lockedAmount: 0,
            lastSync: Date.now(),
            devMode: false
        };

        const next = {
            ...cached,
            balance: cached.balance + balanceDelta,
            lockedAmount: (cached.lockedAmount || 0) + lockedDelta,
            devMode: devMode || cached.devMode || false,
            lastSync: Date.now(),
            pendingSync: true
        };

        this.playerBalances.set(key, next);
        return next;
    }

    /**
     * Get player balance cache
     */
    getPlayerBalanceCache(playerAddress) {
        const key = this.normalizeAddress(playerAddress);
        return this.playerBalances.get(key) || null;
    }

    normalizeAddress(playerAddress) {
        return typeof playerAddress === 'string' ? playerAddress.toLowerCase() : playerAddress;
    }

    isZeroGAddress(playerAddress) {
        return typeof playerAddress === 'string' && playerAddress.startsWith('0x');
    }

    getZeroGContractService() {
        const zgService = getZeroGService();
        if (!zgService || !zgService.initialized) {
            throw new Error('0G service not initialized');
        }
        const svc = new ZeroGContractService();
        svc.init(zgService, config.ZEROG_NETWORK || 'testnet');
        return svc;
    }

    async getZeroGPlayerBalance(playerAddress) {
        const svc = this.getZeroGContractService();
        const [custodyRaw, lockedRaw] = await Promise.all([
            svc.getCustodyBalance(playerAddress),
            svc.getLockedBalance(playerAddress)
        ]);
        const rawBalanceWei = BigInt(custodyRaw || '0').toString();
        const rawLockedWei = BigInt(lockedRaw || '0').toString();
        const balance = Number(BigInt(rawBalanceWei));
        const lockedAmount = Number(BigInt(rawLockedWei));

        return {
            balance,
            lockedAmount,
            rawBalanceWei,
            rawLockedWei,
            isRegistered: BigInt(rawBalanceWei) + BigInt(rawLockedWei) > 0n,
            chain: '0G'
        };
    }

    async syncZeroGPlayerBalance(playerAddress) {
        const info = await this.getZeroGPlayerBalance(playerAddress);
        this.setPlayerBalanceCache(playerAddress, info.balance, info.lockedAmount, {
            rawBalanceWei: info.rawBalanceWei,
            rawLockedWei: info.rawLockedWei,
            isRegistered: info.isRegistered,
            chain: '0G',
            pendingSync: false,
            source: 'zerog-sync'
        });
        return info;
    }

    setPlayerBalanceCache(playerAddress, balance, lockedAmount = 0, extra = {}) {
        const key = this.normalizeAddress(playerAddress);
        const next = {
            ...extra,
            balance,
            lockedAmount,
            lastSync: Date.now(),
            pendingSync: extra.pendingSync ?? true
        };
        this.playerBalances.set(key, next);
        return next;
    }

    toBigIntBalance(value) {
        if (typeof value === 'bigint') return value;
        if (typeof value === 'number') {
            if (!Number.isFinite(value)) return 0n;
            return BigInt(Math.trunc(value));
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return 0n;
            if (trimmed.includes('.')) {
                return BigInt(Math.trunc(Number(trimmed)));
            }
            return BigInt(trimmed);
        }
        return 0n;
    }

    applyLocalZeroGBalance(playerAddress, deltaWei, baseBalanceWei = 0, extra = {}) {
        const key = this.normalizeAddress(playerAddress);
        const cached = this.playerBalances.get(key);
        const currentWei = this.toBigIntBalance(cached?.rawBalanceWei ?? cached?.balance ?? baseBalanceWei);
        const nextWei = currentWei + this.toBigIntBalance(deltaWei);

        if (nextWei < 0n) {
            throw new Error('Insufficient 0G game balance');
        }

        const nextLockedWei = extra.rawLockedWei ?? cached?.rawLockedWei ?? extra.lockedAmount ?? cached?.lockedAmount ?? 0;

        return this.setPlayerBalanceCache(playerAddress, Number(nextWei), Number(this.toBigIntBalance(nextLockedWei)), {
            ...cached,
            ...extra,
            rawBalanceWei: nextWei.toString(),
            rawLockedWei: this.toBigIntBalance(nextLockedWei).toString(),
            chain: '0G',
            source: extra.source || cached?.source || 'tournament-local-0g'
        });
    }

    /**
     * Add balance instantly for development/testing (bypasses blockchain)
     */
    addBalanceInstant(playerAddress, amount) {
        console.log(`[GameFlowIntegration] 💰 DEV MODE: Adding ${amount} SUN (${amount/1000000} TRX) to ${playerAddress}`);

        const key = this.normalizeAddress(playerAddress);
        const cached = this.playerBalances.get(key) || {
            balance: 0,
            lockedAmount: 0,
            lastSync: Date.now()
        };

        const newBalance = cached.balance + amount;
        this.playerBalances.set(key, {
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
