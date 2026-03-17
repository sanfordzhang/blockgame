/**
 * ContractService - Smart Contract Interaction
 * Provides high-level methods for game contract operations
 */

const path = require('path');
const fs = require('fs');

class ContractService {
    constructor() {
        this.tronService = null;
        this.contract = null;
        this.contractAddress = null;
        this.abi = null;
        this.initialized = false;
    }

    /**
     * Initialize contract service
     * @param {object} tronService - TronService instance
     * @param {string} network - Network name
     */
    init(tronService, network = 'testnet') {
        this.tronService = tronService;
        
        // Load contract ABI
        this.loadAbi();
        
        // Get contract address for network
        const config = this.tronService.getNetworkConfig(network);
        this.contractAddress = config.contractAddress;
        
        if (this.contractAddress) {
            this.loadContract(this.contractAddress);
        } else {
            console.warn('[ContractService] No contract address configured for', network);
        }
        
        this.initialized = true;
        console.log(`[ContractService] Initialized for ${network}`);
        return this;
    }

    /**
     * Load contract ABI from build artifacts
     */
    loadAbi() {
        try {
            const buildPath = path.join(
                __dirname, 
                '../../build/contracts/BridgeGameV1.json'
            );
            
            if (fs.existsSync(buildPath)) {
                const artifact = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
                this.abi = artifact.abi;
                console.log('[ContractService] ABI loaded from build artifacts');
            } else {
                // Use embedded ABI for development
                this.abi = this.getDefaultAbi();
                console.log('[ContractService] Using default ABI');
            }
        } catch (error) {
            console.warn('[ContractService] Error loading ABI, using default:', error.message);
            this.abi = this.getDefaultAbi();
        }
    }

    /**
     * Load contract instance
     */
    loadContract(address) {
        if (!this.tronService || !this.tronService.initialized) {
            throw new Error('TronService must be initialized first');
        }
        
        this.contract = this.tronService.getTronWeb().contract(this.abi, address);
        console.log(`[ContractService] Contract loaded at ${address}`);
    }

    /**
     * Set contract address (after deployment)
     */
    setContractAddress(address) {
        this.contractAddress = address;
        this.loadContract(address);
    }

    // ============ Player Functions ============

    /**
     * Register a new player
     */
    async registerPlayer() {
        this.ensureContract();
        
        try {
            const tx = await this.contract.registerPlayer().send({
                feeLimit: 100_000_000, // 100 TRX
                shouldPollResponse: true
            });
            
            console.log('[ContractService] Player registered:', tx);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error registering player:', error.message);
            throw error;
        }
    }

    /**
     * Check if player is registered
     */
    async isPlayerRegistered(address) {
        this.ensureContract();
        
        try {
            const player = await this.contract.players(address).call();
            return player.isRegistered;
        } catch (error) {
            console.error('[ContractService] Error checking registration:', error.message);
            throw error;
        }
    }

    /**
     * Convert value to number (handles BigNumber, BigInt, string, number)
     */
    toNumber(value) {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'string') return parseInt(value, 10);
        if (typeof value.toNumber === 'function') return value.toNumber();
        if (typeof value.toString === 'function') return parseInt(value.toString(), 10);
        return Number(value);
    }

    /**
     * Get player balance from contract
     */
    async getPlayerBalance(address) {
        this.ensureContract();
        
        try {
            const balance = await this.contract.getPlayerBalance(address).call();
            return this.toNumber(balance);
        } catch (error) {
            console.error('[ContractService] Error getting balance:', error.message);
            throw error;
        }
    }

    /**
     * Get player info
     */
    async getPlayerInfo(address) {
        this.ensureContract();
        
        try {
            const info = await this.contract.getPlayerInfo(address).call();
            return {
                balance: this.toNumber(info.balance),
                lockedAmount: this.toNumber(info.lockedAmount),
                isRegistered: info.isRegistered,
                registeredAt: this.toNumber(info.registeredAt)
            };
        } catch (error) {
            console.error('[ContractService] Error getting player info:', error.message);
            throw error;
        }
    }

    // ============ Game Functions ============

    /**
     * Join a game table
     */
    async joinTable(tableId, buyInAmount, options = {}) {
        this.ensureContract();
        
        try {
            const tx = await this.contract.joinTable(tableId, buyInAmount).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true,
                ...options
            });
            
            console.log(`[ContractService] Joined table ${tableId} with ${buyInAmount} SUN`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error joining table:', error.message);
            throw error;
        }
    }

    /**
     * Leave a game table
     */
    async leaveTable(tableId) {
        this.ensureContract();
        
        try {
            const tx = await this.contract.leaveTable(tableId).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log(`[ContractService] Left table ${tableId}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error leaving table:', error.message);
            throw error;
        }
    }

    /**
     * Session mode leave table - settle with final stack
     * Rule e: On leaving, stack returns to balance, then sync bankroll
     */
    async leaveTableSession(tableId, finalStack) {
        this.ensureContract();

        try {
            const txId = await this.contract.leaveTableSession(tableId, finalStack).send({
                feeLimit: 100_000_000,
            });

            console.log(`[ContractService] leaveTableSession txId:`, txId);
            return { success: true, tx: txId };
        } catch (error) {
            console.error('[ContractService] Error session leaving table:', error.message);
            throw error;
        }
    }

    // ============ Delegate (Server Proxy) Functions ============

    /**
     * Set delegate for a player (called by player via frontend)
     * Note: This should be called by the player, not the server
     */
    async setDelegate(delegateAddress) {
        this.ensureContract();
        
        try {
            const tx = await this.contract.setDelegate(delegateAddress).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log(`[ContractService] Delegate set to ${delegateAddress}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error setting delegate:', error.message);
            throw error;
        }
    }

    /**
     * Revoke delegate authorization (called by player via frontend)
     */
    async revokeDelegate() {
        this.ensureContract();
        
        try {
            const tx = await this.contract.revokeDelegate().send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log('[ContractService] Delegate revoked');
            return tx;
        } catch (error) {
            console.error('[ContractService] Error revoking delegate:', error.message);
            throw error;
        }
    }

    /**
     * Check if delegate is authorized for a player
     */
    async isAuthorizedDelegate(playerAddress, delegateAddress) {
        this.ensureContract();
        
        try {
            const authorized = await this.contract.isAuthorizedDelegate(playerAddress, delegateAddress).call();
            return authorized;
        } catch (error) {
            console.error('[ContractService] Error checking delegate:', error.message);
            return false;
        }
    }

    /**
     * Get player's current delegate
     */
    async getPlayerDelegate(playerAddress) {
        this.ensureContract();
        
        try {
            const delegate = await this.contract.playerDelegates(playerAddress).call();
            return delegate;
        } catch (error) {
            console.error('[ContractService] Error getting player delegate:', error.message);
            return null;
        }
    }

    /**
     * Server proxy join table on behalf of a player
     * This is called by the server using its private key
     * @param {string} playerAddress - The player's TRON address
     * @param {number} tableId - The table ID
     * @param {number} buyInAmount - Buy-in amount in SUN
     */
    async joinTableFor(playerAddress, tableId, buyInAmount) {
        this.ensureContract();

        try {
            console.log(`[ContractService] joinTableFor: player=${playerAddress}, tableId=${tableId}, buyIn=${buyInAmount}`);

            const txId = await this.contract.joinTableFor(playerAddress, tableId, buyInAmount).send({
                feeLimit: 100_000_000,
            });

            console.log(`[ContractService] joinTableFor txId:`, txId);
            return { success: true, tx: txId };
        } catch (error) {
            console.error('[ContractService] Error joinTableFor:', error.message);
            throw error;
        }
    }

    /**
     * Server proxy leave table on behalf of a player
     * This is called by the server using its private key
     * @param {string} playerAddress - The player's TRON address
     * @param {number} tableId - The table ID
     * @param {number} finalStack - Final stack amount to return
     */
    async leaveTableFor(playerAddress, tableId, finalStack) {
        this.ensureContract();

        try {
            console.log(`[ContractService] leaveTableFor: player=${playerAddress}, tableId=${tableId}, finalStack=${finalStack}`);

            const txId = await this.contract.leaveTableFor(playerAddress, tableId, finalStack).send({
                feeLimit: 100_000_000,
            });

            console.log(`[ContractService] leaveTableFor txId:`, txId);
            return { success: true, tx: txId };
        } catch (error) {
            console.error('[ContractService] Error leaveTableFor:', error.message);
            throw error;
        }
    }

    /**
     * Rebuy in session mode
     * Rule f: Rebuy from balance, add to locked and stack
     */
    async rebuy(tableId, rebuyAmount) {
        this.ensureContract();
        
        try {
            const tx = await this.contract.rebuy(tableId, rebuyAmount).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log(`[ContractService] Rebuy ${rebuyAmount} SUN for table ${tableId}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error rebuy:', error.message);
            throw error;
        }
    }

    /**
     * Session mode game settlement - only updates stack, locked unchanged
     * Rule j: settleGame only updates stack, final settlement on leaveTable
     */
    async settleGameSession(tableId, playersToUpdate, stackDeltas, resultHash) {
        this.ensureContract();

        console.log('[ContractService] settleGameSession params:', {
            tableId,
            playersToUpdate,
            stackDeltas,
            resultHash
        });

        try {
            const tx = await this.contract.settleGameSession(
                tableId,
                playersToUpdate,
                stackDeltas,
                resultHash
            ).send({
                feeLimit: 500_000_000,
                shouldPollResponse: true
            });

            console.log(`[ContractService] Session game settled for table ${tableId}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error session settling game:', error.message);
            throw error;
        }
    }

    /**
     * Settle a game
     */
    async settleGame(tableId, winners, amounts, resultHash) {
        this.ensureContract();
        
        try {
            const tx = await this.contract.settleGame(
                tableId,
                winners,
                amounts,
                resultHash
            ).send({
                feeLimit: 500_000_000, // Higher fee limit for settlement
                shouldPollResponse: true
            });
            
            console.log(`[ContractService] Game settled for table ${tableId}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error settling game:', error.message);
            throw error;
        }
    }

    /**
     * Get game session info
     */
    async getGameSession(tableId) {
        this.ensureContract();
        
        try {
            const session = await this.contract.getGameSession(tableId).call();
            return {
                tableId: this.toNumber(session.tableId),
                players: session.players_,
                buyInAmounts: session.buyInAmounts_.map(a => this.toNumber(a)),
                totalPot: this.toNumber(session.totalPot),
                state: session.state,
                rakeRateUsed: this.toNumber(session.rakeRateUsed)
            };
        } catch (error) {
            console.error('[ContractService] Error getting game session:', error.message);
            throw error;
        }
    }

    // ============ Admin Functions ============

    /**
     * Set table owner (only contract owner can call this)
     * This is needed for the server to be able to settle games
     */
    async setTableOwner(tableId, ownerAddress) {
        this.ensureContract();

        try {
            const tx = await this.contract.setTableOwner(tableId, ownerAddress).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });

            console.log(`[ContractService] Table ${tableId} owner set to ${ownerAddress}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error setting table owner:', error.message);
            throw error;
        }
    }

    /**
     * Get current table owner
     */
    async getTableOwner(tableId) {
        this.ensureContract();

        try {
            const owner = await this.contract.tableOwners(tableId).call();
            return owner;
        } catch (error) {
            console.error('[ContractService] Error getting table owner:', error.message);
            return null;
        }
    }

    /**
     * Force unlock player's locked funds (only contract owner can call this)
     * This is used when a player leaves a game that hasn't been settled
     */
    async forceUnlockPlayer(playerAddress) {
        this.ensureContract();

        try {
            const tx = await this.contract.forceUnlockPlayer(playerAddress).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });

            console.log(`[ContractService] Force unlocked funds for ${playerAddress}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error force unlocking player:', error.message);
            throw error;
        }
    }

    /**
     * Reset game session state (admin only)
     * Used when game state is stuck
     */
    async resetGameSession(tableId) {
        this.ensureContract();

        try {
            const tx = await this.contract.resetGameSession(tableId).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });

            console.log(`[ContractService] Game session ${tableId} reset`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error resetting game session:', error.message);
            throw error;
        }
    }

    /**
     * Schedule rake rate change
     */
    async scheduleRakeRateChange(newRate) {
        this.ensureContract();
        
        try {
            const tx = await this.contract.scheduleRakeRateChange(newRate).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log(`[ContractService] Rake rate change scheduled: ${newRate}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error scheduling rake change:', error.message);
            throw error;
        }
    }

    /**
     * Apply pending rake rate change
     */
    async applyRakeRateChange() {
        this.ensureContract();
        
        try {
            const tx = await this.contract.applyRakeRateChange().send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log('[ContractService] Rake rate change applied');
            return tx;
        } catch (error) {
            console.error('[ContractService] Error applying rake change:', error.message);
            throw error;
        }
    }

    /**
     * Withdraw accumulated rake
     */
    async withdrawRake(to, amount) {
        this.ensureContract();
        
        try {
            const tx = await this.contract.withdrawRake(to, amount).send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log(`[ContractService] Rake withdrawn: ${amount} to ${to}`);
            return tx;
        } catch (error) {
            console.error('[ContractService] Error withdrawing rake:', error.message);
            throw error;
        }
    }

    /**
     * Pause contract
     */
    async pause() {
        this.ensureContract();
        
        try {
            const tx = await this.contract.pause().send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log('[ContractService] Contract paused');
            return tx;
        } catch (error) {
            console.error('[ContractService] Error pausing:', error.message);
            throw error;
        }
    }

    /**
     * Unpause contract
     */
    async unpause() {
        this.ensureContract();
        
        try {
            const tx = await this.contract.unpause().send({
                feeLimit: 100_000_000,
                shouldPollResponse: true
            });
            
            console.log('[ContractService] Contract unpaused');
            return tx;
        } catch (error) {
            console.error('[ContractService] Error unpausing:', error.message);
            throw error;
        }
    }

    /**
     * Get contract statistics
     */
    async getStatistics() {
        this.ensureContract();
        
        try {
            const stats = await this.contract.getStatistics().call();
            return {
                totalVolume: this.toNumber(stats._totalVolume),
                totalRakeCollected: this.toNumber(stats._totalRakeCollected),
                totalGamesPlayed: this.toNumber(stats._totalGamesPlayed),
                accumulatedRake: this.toNumber(stats._accumulatedRake),
                rakeRate: this.toNumber(stats._rakeRate),
                playerCount: this.toNumber(stats._playerCount)
            };
        } catch (error) {
            console.error('[ContractService] Error getting statistics:', error.message);
            throw error;
        }
    }

    /**
     * Get current rake rate
     */
    async getRakeRate() {
        this.ensureContract();
        
        try {
            const rate = await this.contract.rakeRate().call();
            return this.toNumber(rate);
        } catch (error) {
            console.error('[ContractService] Error getting rake rate:', error.message);
            throw error;
        }
    }

    /**
     * Get pending rake change
     */
    async getPendingRakeChange() {
        this.ensureContract();
        
        try {
            const pending = await this.contract.getPendingRakeChange().call();
            return {
                exists: pending.exists,
                newRate: this.toNumber(pending.newRate),
                effectiveTime: this.toNumber(pending.effectiveTime)
            };
        } catch (error) {
            console.error('[ContractService] Error getting pending rake change:', error.message);
            throw error;
        }
    }

    // ============ Utility Functions ============

    /**
     * Ensure contract is loaded
     */
    ensureContract() {
        if (!this.initialized) {
            throw new Error('ContractService not initialized');
        }
        if (!this.contract) {
            throw new Error('Contract not loaded. Set contract address first.');
        }
    }

    /**
     * Get contract address
     */
    getContractAddress() {
        return this.contractAddress;
    }

    /**
     * Default ABI for development
     */
    getDefaultAbi() {
        // Return complete ABI for all functions used by the game
        return [
            // Player registration
            {
                "inputs": [],
                "name": "registerPlayer",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "deposit",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [{"name": "amount", "type": "uint256"}],
                "name": "withdraw",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            // Player info
            {
                "inputs": [{"name": "", "type": "address"}],
                "name": "players",
                "outputs": [
                    {"name": "balance", "type": "uint256"},
                    {"name": "lockedAmount", "type": "uint256"},
                    {"name": "isRegistered", "type": "bool"},
                    {"name": "registeredAt", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "", "type": "address"}],
                "name": "getPlayerInfo",
                "outputs": [
                    {"name": "balance", "type": "uint256"},
                    {"name": "lockedAmount", "type": "uint256"},
                    {"name": "isRegistered", "type": "bool"},
                    {"name": "registeredAt", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            // Table operations
            {
                "inputs": [
                    {"name": "tableId", "type": "uint256"},
                    {"name": "buyInAmount", "type": "uint256"}
                ],
                "name": "joinTable",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"name": "tableId", "type": "uint256"}],
                "name": "leaveTable",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "tableId", "type": "uint256"},
                    {"name": "finalStack", "type": "uint256"}
                ],
                "name": "leaveTableSession",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            // Game session info
            {
                "inputs": [{"name": "tableId", "type": "uint256"}],
                "name": "getGameSession",
                "outputs": [
                    {"name": "tableId", "type": "uint256"},
                    {"name": "players_", "type": "address[]"},
                    {"name": "buyInAmounts_", "type": "uint256[]"},
                    {"name": "totalPot", "type": "uint256"},
                    {"name": "state", "type": "uint8"},
                    {"name": "rakeRateUsed", "type": "uint256"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            // Delegate (Server Proxy) functions
            {
                "inputs": [{"name": "delegate", "type": "address"}],
                "name": "setDelegate",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "revokeDelegate",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "player", "type": "address"},
                    {"name": "delegate", "type": "address"}
                ],
                "name": "isAuthorizedDelegate",
                "outputs": [{"name": "", "type": "bool"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "player", "type": "address"}],
                "name": "getPlayerDelegate",
                "outputs": [{"name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "", "type": "address"}],
                "name": "playerDelegates",
                "outputs": [{"name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function"
            },
            // Server proxy functions
            {
                "inputs": [
                    {"name": "player", "type": "address"},
                    {"name": "tableId", "type": "uint256"},
                    {"name": "buyInAmount", "type": "uint256"}
                ],
                "name": "joinTableFor",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "player", "type": "address"},
                    {"name": "tableId", "type": "uint256"},
                    {"name": "finalStack", "type": "uint256"}
                ],
                "name": "leaveTableFor",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            // Settlement
            {
                "inputs": [
                    {"name": "tableId", "type": "uint256"},
                    {"name": "playersToUpdate", "type": "address[]"},
                    {"name": "stackDeltas", "type": "int256[]"},
                    {"name": "resultHash", "type": "bytes32"}
                ],
                "name": "settleGameSession",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "tableId", "type": "uint256"},
                    {"name": "winners", "type": "address[]"},
                    {"name": "amounts", "type": "uint256[]"},
                    {"name": "resultHash", "type": "bytes32"}
                ],
                "name": "settleGame",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            // Rebuy
            {
                "inputs": [
                    {"name": "tableId", "type": "uint256"},
                    {"name": "rebuyAmount", "type": "uint256"}
                ],
                "name": "rebuy",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            // Admin functions
            {
                "inputs": [
                    {"name": "tableId", "type": "uint256"},
                    {"name": "owner", "type": "address"}
                ],
                "name": "setTableOwner",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"name": "tableId", "type": "uint256"}],
                "name": "tableOwners",
                "outputs": [{"name": "", "type": "address"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"name": "player", "type": "address"}],
                "name": "forceUnlockPlayer",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"name": "tableId", "type": "uint256"}],
                "name": "resetGameSession",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            // Events
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "name": "player", "type": "address"},
                    {"indexed": false, "name": "timestamp", "type": "uint256"}
                ],
                "name": "PlayerRegistered",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "name": "player", "type": "address"},
                    {"indexed": false, "name": "amount", "type": "uint256"}
                ],
                "name": "Deposited",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "name": "player", "type": "address"},
                    {"indexed": false, "name": "amount", "type": "uint256"}
                ],
                "name": "Withdrawn",
                "type": "event"
            }
        ];
    }
}

// Export singleton instance
module.exports = new ContractService();
