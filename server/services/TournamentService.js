/**
 * TournamentService
 * Manages tournament lifecycle and interactions with Tournament.sol
 */

const TronWeb = require('tronweb');
const Tournament = require('../models/Tournament');
const { BotManager } = require('../../tests/helpers/bot-player');

class TournamentService {
    constructor(config) {
        this.tronWeb = config.tronWeb;
        this.contractAddress = config.tournamentContractAddress;
        this.serverWallet = config.serverWallet;
        this.contract = null;
        this.socketIO = null;
        
        // Active tournament tables
        this.activeTables = new Map();
        
        // Bot manager for testing
        this.botManager = new BotManager();
    }
    
    /**
     * Initialize the service
     */
    async init() {
        if (this.contractAddress) {
            this.contract = await this.tronWeb.contract().at(this.contractAddress);
            console.log('[TournamentService] Contract loaded:', this.contractAddress);
        }
    }
    
    /**
     * Set Socket.IO instance
     */
    setSocketIO(io) {
        this.socketIO = io;
    }
    
    // ============ Tournament Creation ============
    
    /**
     * Create a new tournament
     * @param {Object|number} configOrId - Configuration object or ID
     * @param {string} creatorAddress - Creator wallet address (for test mode, deprecated)
     * @returns {Promise<Object>} - Created tournament
     */
    async createTournament(configOrId, creatorAddress = null) {
        // 支持对象参数或数字ID
        let configId, mockGame;
        if (typeof configOrId === 'object') {
            configId = configOrId.configId;
            creatorAddress = configOrId.creatorAddress || creatorAddress;
            mockGame = configOrId.mockGame || false;
        } else {
            configId = configOrId;
            mockGame = false;
        }
        
        // Default configs for test mode
        // prizeDistribution uses basis points: 1% = 100 basis points
        const DEFAULT_CONFIGS = {
            1: { playerCount: 6, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [5000, 3000, 2000] },  // 50%/30%/20%
            2: { playerCount: 4, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [6000, 4000] },         // 60%/40%
            3: { playerCount: 2, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [10000] }              // 100%
        };
        
        let tournamentId;
        let txHash = null;
        
        // Try to use contract if available
        if (this.contract) {
            try {
                const tx = await this.contract.createTournament(configId).send({
                    from: this.serverWallet
                });
                tournamentId = await this._getTournamentIdFromTx(tx);
                txHash = tx;
            } catch (err) {
                console.log('[TournamentService] Contract call failed, using test mode:', err.message);
            }
        }
        
        // Fallback to test mode
        if (!tournamentId) {
            tournamentId = Date.now().toString();
            console.log(`[TournamentService] Creating test tournament ${tournamentId}, mockGame=${mockGame}`);
        }
        
        // Get config from defaults or contract
        const defaultConfig = DEFAULT_CONFIGS[configId] || DEFAULT_CONFIGS[1];
        
        // Create database record
        const TournamentModel = require('../models/Tournament');
        const tournament = new TournamentModel({
            tournamentId,
            configId,
            status: 'WAITING',
            players: [],
            txHash,
            mockGame,  // 添加 mockGame 字段
            config: {
                playerCount: defaultConfig.playerCount,
                buyIn: defaultConfig.buyIn,
                rakeRate: defaultConfig.rakeRate,
                initialChips: defaultConfig.initialChips,
                prizeDistribution: defaultConfig.prizeDistribution,
                tournamentType: 'SNG',
                startMode: 'INSTANT',
                name: `${defaultConfig.playerCount}-Player (${defaultConfig.buyIn/1e6} TRX)`
            },
            buyIn: defaultConfig.buyIn,
            playerCount: defaultConfig.playerCount,
            rakeRate: defaultConfig.rakeRate,
            prizePool: 0
        });
        
        await tournament.save();
        
        console.log(`[TournamentService] Created tournament ${tournamentId}, mockGame=${mockGame}`);
        
        return tournament;
    }
    
    /**
     * Get tournament configurations
     */
    async getConfigs() {
        // All tournaments use 100 TRX buy-in
        // prizeDistribution uses basis points: 1% = 100 basis points
        const DEFAULT_CONFIGS = [
            { id: 1, playerCount: 6, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [5000, 3000, 2000], name: '6-Player (100 TRX)', tournamentType: 'SNG', startMode: 'INSTANT' },  // 50%/30%/20%
            { id: 2, playerCount: 4, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [6000, 4000], name: '4-Player (100 TRX)', tournamentType: 'SNG', startMode: 'INSTANT' },         // 60%/40%
            { id: 3, playerCount: 2, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [10000], name: '2-Player (100 TRX)', tournamentType: 'SNG', startMode: 'INSTANT' }            // 100%
        ];

        // Always use default configs (100 TRX for all tournaments)
        return DEFAULT_CONFIGS;
    }
    
    /**
     * Get all tournaments with filter
     */
    async getTournaments(filter = {}) {
        const query = {};
        if (filter.status) query.status = filter.status;
        if (filter.type) query.type = filter.type;
        
        return Tournament.find(query).sort({ createdAt: -1 });
    }
    
    /**
     * Get tournament by ID
     */
    async getTournamentById(tournamentId) {
        return Tournament.findOne({ tournamentId });
    }
    
    /**
     * Get tournament config
     */
    async getConfig(configId) {
        if (!this.contract) return null;
        try {
            const config = await this.contract.getConfig(configId).call();
            return config;
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Get tournament players
     */
    async getTournamentPlayers(tournamentId) {
        const tournament = await Tournament.findOne({ tournamentId });
        return tournament?.players || [];
    }
    
    /**
     * Get player tournament history
     */
    async getPlayerHistory(walletAddress) {
        return Tournament.find({
            'players.address': walletAddress
        }).sort({ createdAt: -1 }).limit(20);
    }
    
    /**
     * Finish tournament with rankings
     */
    async finishTournament(tournamentId, rankings) {
        const tournament = await Tournament.findOne({ tournamentId });
        if (!tournament) {
            throw new Error('Tournament not found');
        }
        
        tournament.status = 'FINISHED';
        tournament.rankings = rankings;
        tournament.finishedAt = new Date();
        
        await tournament.save();
        
        return tournament;
    }
    
    /**
     * Claim tournament prize
     */
    async claimPrize(tournamentId, walletAddress) {
        const tournament = await Tournament.findOne({ tournamentId });
        if (!tournament || tournament.status !== 'FINISHED') {
            throw new Error('Tournament not finished');
        }
        
        const ranking = tournament.rankings?.find(r => r.address === walletAddress);
        if (!ranking) {
            throw new Error('Not a winner');
        }
        
        if (ranking.claimed) {
            throw new Error('Already claimed');
        }
        
        // Mark as claimed
        ranking.claimed = true;
        await tournament.save();
        
        return { success: true, prize: ranking.prize };
    }
    
    // ============ Player Actions ============
    
    /**
     * Join a tournament
     * @param {string} tournamentId - Tournament ID
     * @param {string} playerAddress - Player wallet address
     * @param {string} socketId - Socket ID
     */
    async joinTournament(tournamentId, playerAddress, socketId) {
        const normalizedAddress = playerAddress.toLowerCase();

        // Get tournament to check buyIn
        const existingTournament = await Tournament.findOne({ tournamentId });
        if (!existingTournament) {
            throw new Error('Tournament not found');
        }
        if (existingTournament.status !== 'WAITING') {
            throw new Error('Tournament not accepting players');
        }
        const alreadyJoined = existingTournament.players.some(p => p.address === normalizedAddress);
        if (alreadyJoined) {
            throw new Error('Already joined');
        }

        // Lock buyIn via contract (if player has enough balance)
        const buyIn = existingTournament.buyIn || 100000000; // 100 TRX
        let buyInLocked = false;
        
        try {
            const contractService = require('../blockchain/ContractService');
            if (contractService) {
                const playerInfo = await contractService.getPlayerInfo(playerAddress);
                if (playerInfo.balance >= buyIn) {
                    // Generate a tableId for this tournament
                    const tableId = parseInt(tournamentId.replace(/-/g, '').substring(0, 10)) || Date.now();
                    await contractService.joinTableFor(playerAddress, tableId, buyIn);
                    buyInLocked = true;
                    console.log(`[TournamentService] Locked ${buyIn/1e6} TRX buyIn for player ${playerAddress.substring(0, 10)}...`);
                } else {
                    console.log(`[TournamentService] Player ${playerAddress.substring(0, 10)}... has insufficient balance (${playerInfo.balance/1e6} TRX < ${buyIn/1e6} TRX), buyIn not locked on chain`);
                }
            }
        } catch (e) {
            console.error(`[TournamentService] Failed to lock buyIn:`, e.message);
        }

        // Use atomic update to prevent race condition
        const tournament = await Tournament.findOneAndUpdate(
            {
                tournamentId,
                status: 'WAITING',
                'players.address': { $ne: normalizedAddress }
            },
            {
                $push: {
                    players: {
                        address: normalizedAddress,
                        socketId,
                        joinedAt: new Date(),
                        finalPosition: null,
                        prizeAmount: null,
                        claimed: false,
                        buyInLocked // Track if buyIn was locked on chain
                    }
                }
            },
            { new: true }
        );

        if (!tournament) {
            return existingTournament;
        }
        
        // Broadcast update
        this.broadcastUpdate(tournamentId, {
            type: 'player_joined',
            player: playerAddress,
            playerCount: tournament.players.length
        });
        
        // Check if ready to start
        // Use tournament's playerCount (stored at creation time) instead of config query
        // This works in both contract mode and test mode
        const requiredPlayerCount = tournament.playerCount || tournament.config?.playerCount || 2;
        console.log(`[TournamentService] Player count check: ${tournament.players.length}/${requiredPlayerCount}`);
        
        if (tournament.players.length >= requiredPlayerCount) {
            console.log(`[TournamentService] Tournament ${tournamentId} is full, starting...`);
            await this.startTournament(tournamentId);
        }
        
        return tournament;
    }
    
    /**
     * Cancel tournament join
     */
    async cancelJoin(tournamentId, playerAddress) {
        const tournament = await Tournament.findOne({ tournamentId });
        
        if (!tournament) {
            throw new Error('Tournament not found');
        }
        
        tournament.removePlayer(playerAddress);
        await tournament.save();
        
        this.broadcastUpdate(tournamentId, {
            type: 'player_left',
            player: playerAddress,
            playerCount: tournament.players.length
        });
        
        return tournament;
    }
    
    // ============ Tournament Flow ============
    
    /**
     * Start a tournament
     */
    async startTournament(tournamentId) {
        const tournament = await Tournament.findOne({ tournamentId });
        
        if (!tournament || tournament.status !== 'WAITING') {
            throw new Error('Cannot start tournament');
        }
        
        // Call contract to start
        const tx = await this.contract.startTournament(tournamentId).send({
            from: this.serverWallet
        });
        
        tournament.start();
        await tournament.save();
        
        // Create game table
        const TournamentTable = require('../pokergame/TournamentTable');
        const config = await this.getConfig(tournament.configId);
        
        const table = new TournamentTable(
            tournamentId,
            config.playerCount,
            config.initialChips,
            null,  // blindConfig
            tournament.mockGame || false  // mockGame
        );
        
        // Set callbacks
        table.onElimination = (data) => this.handleElimination(tournamentId, data);
        table.onTournamentEnd = (data) => this.handleTournamentEnd(tournamentId, data);
        
        // Sit all players
        for (let i = 0; i < tournament.players.length; i++) {
            const player = tournament.players[i];
            table.sitPlayer(
                { address: player.address, socketId: player.socketId },
                i + 1,
                config.initialChips
            );
        }
        
        this.activeTables.set(tournamentId, table);
        
        // Broadcast start
        this.broadcastUpdate(tournamentId, {
            type: 'tournament_started',
            prizePool: tournament.prizePool
        });
        
        console.log(`[TournamentService] Tournament ${tournamentId} started`);
        
        return tournament;
    }
    
    /**
     * Handle player elimination
     */
    async handleElimination(tournamentId, data) {
        const tournament = await Tournament.findOne({ tournamentId });
        
        const player = tournament.players.find(p => p.address === data.playerAddress);
        if (player) {
            player.finalPosition = data.position;
        }
        
        await tournament.save();
        
        this.broadcastUpdate(tournamentId, {
            type: 'player_eliminated',
            player: data.playerAddress,
            position: data.position
        });
    }
    
    /**
     * Handle tournament end
     */
    async handleTournamentEnd(tournamentId, data) {
        const tournament = await Tournament.findOne({ tournamentId });
        
        // Get config for prize distribution
        const config = await this.getConfig(tournament.configId);
        
        // Finish tournament on contract
        const rankings = data.rankings;
        const tx = await this.contract.finishTournament(tournamentId, rankings).send({
            from: this.serverWallet
        });
        
        tournament.finish(rankings, config.prizeDistribution, config.rakeRate);
        tournament.txHash = tx;
        await tournament.save();
        
        // Remove from active tables
        this.activeTables.delete(tournamentId);
        
        // Broadcast end
        this.broadcastUpdate(tournamentId, {
            type: 'tournament_ended',
            rankings: data.rankings,
            prizes: tournament.players.map(p => ({
                address: p.address,
                position: p.finalPosition,
                prize: p.prizeAmount
            }))
        });
        
        console.log(`[TournamentService] Tournament ${tournamentId} ended`);
    }
    
    // ============ Game Actions ============
    
    /**
     * Handle game action
     */
    handleGameAction(tournamentId, socketId, action) {
        const table = this.activeTables.get(tournamentId);
        
        if (!table) {
            throw new Error('Tournament not active');
        }
        
        switch (action.type) {
            case 'fold':
                return table.handleFold(socketId);
            case 'check':
                return table.handleCheck(socketId);
            case 'call':
                return table.handleCall(socketId);
            case 'raise':
                return table.handleRaise(socketId, action.amount);
            default:
                throw new Error('Unknown action');
        }
    }
    
    /**
     * Handle player disconnect
     */
    handleDisconnect(socketId, walletAddress) {
        // Find tournament the player is in
        for (const [tournamentId, table] of this.activeTables) {
            const result = table.handleDisconnect(socketId, walletAddress);
            if (result) {
                console.log(`[TournamentService] Player disconnected from tournament ${tournamentId}`);
            }
        }
    }
    
    // ============ Broadcasting ============
    
    /**
     * Broadcast tournament update
     */
    broadcastUpdate(tournamentId, data) {
        if (!this.socketIO) return;
        
        this.socketIO.to(`tournament:${tournamentId}`).emit('tournament_update', {
            tournamentId,
            ...data
        });
    }
    
    /**
     * Broadcast game state (Task 7.9)
     */
    broadcastGameState(tournamentId, gameState) {
        if (!this.socketIO) return;
        
        this.socketIO.to(`tournament:${tournamentId}`).emit('game_state', {
            tournamentId,
            ...gameState
        });
    }
    
    /**
     * Broadcast table state to all players in tournament (Task 7.9)
     * @param {string} tournamentId - Tournament ID
     * @param {object} table - Tournament table instance
     */
    broadcastTableState(tournamentId, table) {
        if (!this.socketIO || !table) return;
        
        const gameState = {
            // Tournament-specific info
            tournamentId,
            isTournament: true,
            initialChips: table.initialChips,
            
            // Standard game state
            pot: table.pot,
            board: table.board,
            street: table.board.length === 0 ? 'preflop' : 
                    table.board.length === 3 ? 'flop' :
                    table.board.length === 4 ? 'turn' :
                    table.board.length === 5 ? 'river' : 'showdown',
            turn: table.turn,
            button: table.button,
            smallBlind: table.smallBlind,
            bigBlind: table.bigBlind,
            callAmount: table.callAmount,
            minBet: table.minBet,
            handOver: table.handOver,
            wentToShowdown: table.wentToShowdown,
            winMessages: table.winMessages,
            
            // Player info (hide opponent cards)
            seats: {},
            players: table.players.map(p => ({
                socketId: p.socketId,
                id: p.id,
                name: p.name
            })),
            
            // Tournament rankings
            eliminatedPlayers: table.eliminatedPlayers || [],
            remainingPlayers: table.getRemainingPlayers ? table.getRemainingPlayers() : []
        };
        
        // Build seats with hidden opponent cards
        for (let i = 1; i <= table.maxPlayers; i++) {
            const seat = table.seats[i];
            if (seat && seat.player) {
                gameState.seats[i] = {
                    player: {
                        socketId: seat.player.socketId,
                        id: seat.player.id,
                        name: seat.player.name
                    },
                    stack: seat.stack,
                    bet: seat.bet,
                    folded: seat.folded,
                    checked: seat.checked,
                    sittingOut: seat.sittingOut,
                    lastAction: seat.lastAction
                };
            }
        }
        
        // Send personalized game state to each player (with their cards visible)
        for (const player of table.players) {
            const socketId = player.socketId;
            const personalState = JSON.parse(JSON.stringify(gameState));
            
            // Show this player's cards
            for (let i = 1; i <= table.maxPlayers; i++) {
                const seat = table.seats[i];
                if (seat && seat.player && seat.hand) {
                    if (seat.player.socketId === socketId) {
                        personalState.seats[i].hand = seat.hand;
                    } else if (!seat.folded && table.wentToShowdown) {
                        // Show cards at showdown
                        personalState.seats[i].hand = seat.hand;
                    } else {
                        // Hide opponent cards
                        personalState.seats[i].hand = [{ suit: 'hidden', rank: 'hidden' }, { suit: 'hidden', rank: 'hidden' }];
                    }
                }
            }
            
            this.socketIO.to(socketId).emit('tournament_game_state', personalState);
        }
    }
    
    // ============ Waiting Room & Timeout (Task 7.8) ============
    
    /**
     * Start waiting check for tournament timeout
     * @param {string} tournamentId - Tournament ID
     */
    startWaitingCheck(tournamentId) {
        const checkInterval = setInterval(async () => {
            try {
                const tournament = await Tournament.findOne({ tournamentId });
                
                if (!tournament || tournament.status !== 'WAITING') {
                    clearInterval(checkInterval);
                    return;
                }
                
                const config = await this.getConfig(tournament.configId);
                const waitTimeout = config.waitTimeout || 600; // Default 10 minutes
                
                // Check if timeout reached
                const waitingTime = (Date.now() - tournament.createdAt.getTime()) / 1000;
                
                if (waitingTime > waitTimeout) {
                    console.log(`[TournamentService] Tournament ${tournamentId} timed out after ${waitingTime}s`);
                    
                    // Cancel tournament and refund players
                    await this.cancelTournament(tournamentId, 'Timeout reached');
                    clearInterval(checkInterval);
                    return;
                }
                
                // Broadcast waiting status
                this.broadcastUpdate(tournamentId, {
                    type: 'waiting_status',
                    playersJoined: tournament.players.length,
                    playersRequired: config.playerCount,
                    timeRemaining: Math.max(0, waitTimeout - waitingTime),
                    waitingTime
                });
                
            } catch (error) {
                console.error(`[TournamentService] Waiting check error:`, error);
            }
        }, 5000); // Check every 5 seconds
        
        // Store interval for cleanup
        this._waitingChecks = this._waitingChecks || new Map();
        this._waitingChecks.set(tournamentId, checkInterval);
    }
    
    /**
     * Stop waiting check
     */
    stopWaitingCheck(tournamentId) {
        if (this._waitingChecks && this._waitingChecks.has(tournamentId)) {
            clearInterval(this._waitingChecks.get(tournamentId));
            this._waitingChecks.delete(tournamentId);
        }
    }
    
    /**
     * Cancel tournament
     */
    async cancelTournament(tournamentId, reason = 'Cancelled') {
        const tournament = await Tournament.findOne({ tournamentId });
        
        if (!tournament) {
            throw new Error('Tournament not found');
        }
        
        // Stop waiting check
        this.stopWaitingCheck(tournamentId);
        
        // Update status
        tournament.status = 'CANCELLED';
        tournament.cancelReason = reason;
        await tournament.save();
        
        // Broadcast cancellation
        this.broadcastUpdate(tournamentId, {
            type: 'tournament_cancelled',
            reason
        });
        
        // Call contract to cancel and refund if needed
        if (this.contract && tournament.players.length > 0) {
            try {
                await this.contract.cancelTournament(tournamentId).send({
                    from: this.serverWallet
                });
            } catch (error) {
                console.error('[TournamentService] Contract cancel error:', error);
            }
        }
        
        console.log(`[TournamentService] Tournament ${tournamentId} cancelled: ${reason}`);
        
        return tournament;
    }
    
    // ============ Query Functions ============
    
    /**
     * Get tournament by ID
     */
    async getTournament(tournamentId) {
        return Tournament.findOne({ tournamentId });
    }
    
    /**
     * Get active tournaments
     */
    async getActiveTournaments() {
        return Tournament.findActive();
    }
    
    /**
     * Get waiting tournaments
     */
    async getWaitingTournaments() {
        return Tournament.findWaiting();
    }
    
    /**
     * Get tournaments by player
     */
    async getPlayerTournaments(address) {
        return Tournament.findByPlayer(address);
    }
    
    /**
     * Get config
     */
    async getConfig(configId) {
        if (!this.contract) return null;
        
        const config = await this.contract.getTournamentConfig(configId).call();
        
        return {
            id: configId,
            tournamentType: config.tournamentType.toNumber(),
            playerCount: config.playerCount.toNumber(),
            buyIn: config.buyIn.toNumber(),
            rakeRate: config.rakeRate.toNumber(),
            prizeDistribution: config.prizeDistribution.map(p => p.toNumber()),
            initialChips: config.initialChips.toNumber(),
            startMode: config.startMode.toNumber(),
            waitTimeout: config.waitTimeout.toNumber()
        };
    }
    
    // ============ Helper Functions ============
    
    async _getTournamentIdFromTx(tx) {
        // Parse event from transaction
        const event = tx.events?.TournamentCreated;
        if (event) {
            return event.result.tournamentId;
        }
        return Date.now().toString(); // Fallback
    }
}

// Singleton instance
let tournamentServiceInstance = null;

// Test mode globals (used when tournamentServiceInstance is null)
let testModeSocketIO = null;
let testModeActiveTables = new Map();

/**
 * Initialize TournamentService singleton
 */
function initTournamentService(config) {
    if (!tournamentServiceInstance) {
        tournamentServiceInstance = new TournamentService(config);
    }
    return tournamentServiceInstance;
}

// Export with proxy methods for backward compatibility
module.exports = {
    TournamentService,
    initTournamentService,
    getTournamentService: () => tournamentServiceInstance,
    
    // Proxy methods to instance
    getTournaments: async (filter = {}) => {
        // Fallback to direct Tournament model query if service not initialized
        if (!tournamentServiceInstance) {
            const Tournament = require('../models/Tournament');
            const query = {};
            if (filter.status) query.status = filter.status;
            if (filter.type) query.type = filter.type;
            return Tournament.find(query).sort({ createdAt: -1 });
        }
        return tournamentServiceInstance.getTournaments(filter);
    },
    getTournamentById: async (id) => {
        if (!tournamentServiceInstance) {
            // Test mode fallback
            const TournamentModel = require('../models/Tournament');
            return TournamentModel.findOne({ tournamentId: id });
        }
        return tournamentServiceInstance.getTournamentById(id);
    },
    getTournament: async (tournamentId) => {
        // Fallback to direct Tournament model query if service not initialized
        if (!tournamentServiceInstance) {
            const Tournament = require('../models/Tournament');
            return Tournament.findOne({ tournamentId });
        }
        return tournamentServiceInstance.getTournament(tournamentId);
    },
    getConfigs: async () => {
        // Default configs for test mode
        // prizeDistribution uses basis points: 1% = 100 basis points
        const DEFAULT_CONFIGS = [
            { id: 1, playerCount: 6, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [5000, 3000, 2000], name: '6-Player (100 TRX)', tournamentType: 'SNG', startMode: 'INSTANT' },  // 50%/30%/20%
            { id: 2, playerCount: 4, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [6000, 4000], name: '4-Player (100 TRX)', tournamentType: 'SNG', startMode: 'INSTANT' },         // 60%/40%
            { id: 3, playerCount: 2, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [10000], name: '2-Player (100 TRX)', tournamentType: 'SNG', startMode: 'INSTANT' }            // 100%
        ];
        
        if (!tournamentServiceInstance) return DEFAULT_CONFIGS;
        return tournamentServiceInstance.getConfigs();
    },
    createTournament: async (data) => {
        if (!tournamentServiceInstance) {
            // Create a minimal instance for test mode
            // prizeDistribution uses basis points: 1% = 100 basis points
            const TournamentModel = require('../models/Tournament');
            const config = data.configId === 2 
                ? { playerCount: 4, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [6000, 4000] }       // 60%/40%
                : data.configId === 3
                ? { playerCount: 2, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [10000] }          // 100%
                : { playerCount: 6, buyIn: 100000000, rakeRate: 500, initialChips: 10000000, prizeDistribution: [5000, 3000, 2000] }; // 50%/30%/20%
            
            const tournamentId = Date.now().toString();
            const tournament = new TournamentModel({
                tournamentId,
                configId: data.configId || 1,
                status: 'WAITING',
                players: [],
                mockGame: data.mockGame || false,  // 添加 mockGame 字段
                config: {
                    ...config,
                    tournamentType: 'SNG',
                    startMode: 'INSTANT',
                    name: `${config.playerCount}-Player (${config.buyIn/1e6} TRX)`
                },
                buyIn: config.buyIn,
                playerCount: config.playerCount,
                rakeRate: config.rakeRate,
                prizePool: 0
            });
            
            await tournament.save();
            console.log(`[TournamentService] Created test tournament ${tournamentId}, mockGame=${data.mockGame}`);
            return tournament;
        }
        return tournamentServiceInstance.createTournament(data);
    },
    joinTournament: async (tournamentId, walletAddress, socketId) => {
        // Test mode fallback - use atomic operation
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            const normalizedAddress = walletAddress.toLowerCase();

            // Use atomic update to prevent race condition
            const tournament = await TournamentModel.findOneAndUpdate(
                {
                    tournamentId,
                    status: 'WAITING',
                    'players.address': { $ne: normalizedAddress }
                },
                {
                    $push: {
                        players: {
                            address: normalizedAddress,
                            socketId,
                            joinedAt: new Date(),
                            finalPosition: null,
                            prizeAmount: null,
                            claimed: false
                        }
                    }
                },
                { new: true }
            );

            if (!tournament) {
                const existing = await TournamentModel.findOne({ tournamentId });
                if (!existing) {
                    throw new Error('Tournament not found');
                }
                if (existing.status !== 'WAITING') {
                    throw new Error('Tournament not accepting players');
                }
                // Check if player is already in the list
                const alreadyJoined = existing.players.some(p => p.address === normalizedAddress);
                if (alreadyJoined) {
                    throw new Error('Already joined');
                }
                // If we get here, it means concurrent request won, return success anyway
                return { success: true, tournament: existing };
            }

            // Update prize pool
            tournament.prizePool = tournament.players.length * tournament.buyIn;
            await tournament.save();

            console.log(`[TournamentService] Test mode: Player ${walletAddress} joined tournament ${tournamentId}`);
            console.log(`[TournamentService] Test mode: Player count ${tournament.players.length}/${tournament.playerCount}`);
            console.log(`[TournamentService] Test mode: Player addresses in DB: ${tournament.players.map(p => p.address?.substring(0, 10)).join(', ')}`);

            const requiredPlayerCount = tournament.playerCount || tournament.config?.playerCount || 2;
            
            if (tournament.players.length >= requiredPlayerCount) {
                console.log(`[TournamentService] Test mode: Tournament ${tournamentId} is full, auto-starting...`);
                tournament.status = 'IN_PROGRESS';
                tournament.startedAt = new Date();
                await tournament.save();
                console.log(`[TournamentService] Test mode: Tournament ${tournamentId} started`);
                
                // Broadcast tournament started event to all players
                if (testModeSocketIO) {
                    testModeSocketIO.to(`tournament:${tournamentId}`).emit('SC_TOURNAMENT_STARTED', {
                        tournamentId,
                        status: 'IN_PROGRESS',
                        prizePool: tournament.prizePool
                    });
                    console.log(`[TournamentService] Test mode: Broadcasted SC_TOURNAMENT_STARTED`);
                }
                
                // Create game table (for testing without contract)
                const TournamentTable = require('../pokergame/TournamentTable');
                console.log(`[TournamentService] Test mode: Creating table with mockGame=${tournament.mockGame}`);
                const table = new TournamentTable(
                    tournamentId,
                    requiredPlayerCount,
                    tournament.config?.initialChips || 2000000,
                    null,  // blindConfig
                    tournament.mockGame || false  // mockGame
                );
                console.log(`[TournamentService] Test mode: Table created, table.mockGame=${table.mockGame}`);
                
                // Set callback for tournament end (sync wrapper for async handler)
                table.onTournamentEnd = (data) => {
                    console.log(`[TournamentService] Test mode: >>> Tournament ${tournamentId} ended`, data);
                    // Immediately mark as inactive and remove from active tables
                    testModeActiveTables.delete(tournamentId);
                    console.log(`[TournamentService] Test mode: >>> Removed from activeTables`);
                    // Handle DB save and broadcast asynchronously
                    // Use module.exports._handleTournamentEnd since 'this' may not be correct in this context
                    module.exports._handleTournamentEnd(tournamentId, data).catch(err => {
                        console.error(`[TournamentService] Test mode: _handleTournamentEnd error:`, err);
                    });
                };
                
                // Set callback for next hand (for broadcasting)
                table.onNextHand = (data) => {
                    console.log(`[TournamentService] Test mode: Next hand starting`, data);
                    if (testModeSocketIO) {
                        // Broadcast blind update
                        testModeSocketIO.to(`tournament:${tournamentId}`).emit('tournament_blind_update', {
                            tournamentId,
                            blindLevel: data.blindLevel,
                            smallBlind: data.smallBlind,
                            bigBlind: data.bigBlind,
                            handNumber: data.handNumber
                        });
                        
                        // Broadcast full game state after a short delay to ensure hand is ready
                        setTimeout(() => {
                            console.log(`[TournamentService] Test mode: Broadcasting game state after next hand start`);
                            broadcastGameState(tournamentId, table);
                        }, 500);
                    }
                };
                
                // Helper function to broadcast game state
                function broadcastGameState(tournamentId, table) {
                    if (!testModeSocketIO || !table) return;
                    
                    const gameState = {
                        tournamentId,
                        isTournament: true,
                        pot: table.pot,
                        board: table.board,
                        street: table.board.length === 0 ? 'preflop' : 
                                table.board.length === 3 ? 'flop' :
                                table.board.length === 4 ? 'turn' :
                                table.board.length === 5 ? 'river' : 'showdown',
                        turn: table.turn,
                        button: table.button,
                        smallBlind: table.smallBlind,
                        bigBlind: table.bigBlind,
                        initialChips: table.initialChips,
                        handOver: table.handOver,
                        winMessages: table.winMessages,
                        wentToShowdown: table.wentToShowdown,
                        callAmount: table.callAmount,
                        minBet: table.minBet,
                        // Tournament specific info
                        blindLevel: table.currentBlindLevel,
                        handsPlayed: table.handsPlayed,
                        currentBlinds: {
                            small: table.minBet,
                            big: table.minBet * 2
                        },
                        remainingTime: table.getRemainingTime ? table.getRemainingTime() : null,
                        isTournamentActive: table.isTournamentActive,
                        eliminatedPlayers: table.eliminatedPlayers || [],
                        remainingPlayers: table.getRemainingPlayers ? table.getRemainingPlayers() : [],
                        seats: {}
                    };
                    
                    // Build seats
                    for (let i = 1; i <= table.maxPlayers; i++) {
                        const seat = table.seats[i];
                        if (seat && seat.player) {
                            gameState.seats[i] = {
                                player: { 
                                    id: seat.player.id, 
                                    name: seat.player.name,
                                    socketId: seat.player.socketId
                                },
                                stack: seat.stack,
                                bet: seat.bet,
                                folded: seat.folded,
                                checked: seat.checked,
                                lastAction: seat.lastAction,
                                turn: seat.turn,
                                sittingOut: seat.sittingOut
                            };
                        }
                    }
                    
                    // Send personalized state to each player (show their cards)
                    // Get all sockets in the tournament room
                    const roomSockets = testModeSocketIO.sockets.adapter.rooms.get(`tournament:${tournamentId}`);
                    console.log(`[TournamentService] broadcastGameState: roomSockets count = ${roomSockets ? roomSockets.size : 0}`);
                    
                    // 需要从外部传入 socketWalletMap 或者在这里直接查找
                    // 由于我们无法直接访问 socketWalletMap，我们需要修改策略：
                    // 遍历所有座位，为每个玩家发送个性化的游戏状态
                    
                    if (roomSockets && roomSockets.size > 0) {
                        for (const sockId of roomSockets) {
                            const personalState = JSON.parse(JSON.stringify(gameState));
                            
                            // 获取 socket 实例来获取钱包地址
                            const sock = testModeSocketIO.sockets.sockets.get(sockId);
                            // 尝试多种方式获取钱包地址
                            const playerWallet = sock?.handshake?.query?.address || 
                                                sock?.walletAddress ||
                                                sock?.request?.query?.address;
                            
                            console.log(`[TournamentService] Sending to socket ${sockId}, wallet=${playerWallet?.substring(0, 10)}, turn=${gameState.turn}`);
                            
                            // Add cards for each seat
                            for (let i = 1; i <= table.maxPlayers; i++) {
                                const seat = table.seats[i];
                                if (seat && seat.player && seat.hand) {
                                    // Case-insensitive address comparison
                                    const seatAddr = seat.player.id?.toLowerCase();
                                    const walletAddr = playerWallet?.toLowerCase();
                                    if (seatAddr === walletAddr) {
                                        // Show own cards
                                        personalState.seats[i].hand = seat.hand;
                                    } else if (!seat.folded && table.wentToShowdown) {
                                        // Show cards at showdown
                                        personalState.seats[i].hand = seat.hand;
                                    } else {
                                        // Hide opponent cards
                                        personalState.seats[i].hand = null;
                                    }
                                }
                            }
                            
                            testModeSocketIO.to(sockId).emit('tournament_game_state', personalState);
                        }
                    } else {
                        // Fallback: broadcast to room without personalization
                        console.log(`[TournamentService] No room sockets, broadcasting to room`);
                        testModeSocketIO.to(`tournament:${tournamentId}`).emit('tournament_game_state', gameState);
                    }
                }
                
                // Sit all players
                for (let i = 0; i < tournament.players.length; i++) {
                    const player = tournament.players[i];
                    // 使用钱包地址前8位作为名称
                    const playerAddress = player.address;
                    const shortAddress = playerAddress ? `${playerAddress.substring(0, 4)}...${playerAddress.substring(playerAddress.length - 4)}` : `Player ${i + 1}`;
                    
                    table.sitPlayer(
                        { 
                            address: player.address, 
                            socketId: player.socketId,
                            id: player.address,
                            name: shortAddress
                        },
                        i + 1,
                        tournament.config?.initialChips || 2000000
                    );
                }
                
                // Store active table
                testModeActiveTables.set(tournamentId, table);
                
                // Start tournament timer
                table.startTournamentTimer();
                
                console.log(`[TournamentService] Test mode: Created game table with ${tournament.players.length} players, 30 min time limit`);
                
                // Start first hand after a short delay
                setTimeout(async () => {
                    console.log(`[TournamentService] Test mode: >>> Starting first hand...`);
                    console.log(`[TournamentService] Test mode: Table mockGame=${table.mockGame}, handsPlayed=${table.handsPlayed}`);
                    console.log(`[TournamentService] Test mode: Room sockets before startHand: ${testModeSocketIO ? (() => {
                        const rs = testModeSocketIO.sockets.adapter.rooms.get(`tournament:${tournamentId}`);
                        return rs ? Array.from(rs).join(', ') : 'none';
                    })() : 'no IO'}`);
                    
                    // Use startNextHand instead of startHand to ensure mock deck is applied
                    table.startNextHand();
                    console.log(`[TournamentService] Test mode: startNextHand done. table.turn=${table.turn}`);
                    
                    // Broadcast initial game state
                    if (testModeSocketIO) {
                        console.log(`[TournamentService] Test mode: Room sockets after startHand: ${(() => {
                            const rs = testModeSocketIO.sockets.adapter.rooms.get(`tournament:${tournamentId}`);
                            return rs ? Array.from(rs).join(', ') : 'none';
                        })()}`);
                        
                        // Use broadcastGameState helper for personalized state
                        broadcastGameState(tournamentId, table);
                        console.log(`[TournamentService] Test mode: >>> Broadcasted initial game state via broadcastGameState`);
                    }
                }, 2000);
            }
            
            return { success: true, tournament };
        }
        return tournamentServiceInstance.joinTournament(tournamentId, walletAddress, socketId);
    },
    cancelJoin: async (tournamentId, walletAddress) => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            const tournament = await TournamentModel.findOne({ tournamentId });
            
            if (!tournament) {
                throw new Error('Tournament not found');
            }
            
            // Remove player
            const playerIndex = tournament.players?.findIndex(p => p.address === walletAddress);
            if (playerIndex > -1) {
                tournament.players.splice(playerIndex, 1);
                tournament.prizePool = (tournament.prizePool || 0) - tournament.buyIn;
                await tournament.save();
            }
            
            return { success: true, tournament };
        }
        return tournamentServiceInstance.cancelJoin(tournamentId, walletAddress);
    },
    startTournament: async (tournamentId) => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            const tournament = await TournamentModel.findOne({ tournamentId });
            
            if (!tournament) {
                throw new Error('Tournament not found');
            }
            
            tournament.status = 'IN_PROGRESS';
            tournament.startedAt = new Date();
            await tournament.save();
            
            console.log(`[TournamentService] Test mode: Tournament ${tournamentId} started`);
            return { success: true, tournament };
        }
        return tournamentServiceInstance.startTournament(tournamentId);
    },
    finishTournament: async (tournamentId, rankings) => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            const tournament = await TournamentModel.findOne({ tournamentId });
            
            if (!tournament) {
                throw new Error('Tournament not found');
            }
            
            tournament.status = 'COMPLETED';
            tournament.rankings = rankings;
            tournament.finishedAt = new Date();
            
            // Update player positions
            for (const ranking of rankings) {
                const player = tournament.players?.find(p => p.address === ranking.address);
                if (player) {
                    player.finalPosition = ranking.position;
                    player.prizeAmount = ranking.prize;
                }
            }
            
            await tournament.save();
            
            console.log(`[TournamentService] Test mode: Tournament ${tournamentId} finished`);
            return { success: true, tournament };
        }
        return tournamentServiceInstance.finishTournament(tournamentId, rankings);
    },
    getTournamentPlayers: async (tournamentId) => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            const tournament = await TournamentModel.findOne({ tournamentId });
            return tournament?.players || [];
        }
        return tournamentServiceInstance.getTournamentPlayers(tournamentId);
    },
    getPlayerHistory: async (walletAddress) => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            return TournamentModel.find({
                'players.address': walletAddress
            }).sort({ createdAt: -1 }).limit(20);
        }
        return tournamentServiceInstance.getPlayerHistory(walletAddress);
    },
    getActiveTournaments: async () => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            return TournamentModel.find({ status: { $in: ['WAITING', 'IN_PROGRESS'] } }).sort({ createdAt: -1 });
        }
        return tournamentServiceInstance.getActiveTournaments();
    },
    getWaitingTournaments: async () => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            return TournamentModel.find({ status: 'WAITING' }).sort({ createdAt: -1 });
        }
        return tournamentServiceInstance.getWaitingTournaments();
    },
    claimPrize: async (tournamentId, walletAddress) => {
        if (!tournamentServiceInstance) {
            const TournamentModel = require('../models/Tournament');
            const tournament = await TournamentModel.findOne({ tournamentId });
            
            if (!tournament || tournament.status !== 'COMPLETED') {
                throw new Error('Tournament not finished');
            }
            
            const ranking = tournament.rankings?.find(r => r.address === walletAddress);
            if (!ranking) {
                throw new Error('Not a winner');
            }
            
            if (ranking.claimed) {
                throw new Error('Already claimed');
            }
            
            // Mark as claimed
            ranking.claimed = true;
            await tournament.save();
            
            return { success: true, prize: ranking.prize };
        }
        return tournamentServiceInstance.claimPrize(tournamentId, walletAddress);
    },
    // Set Socket.IO instance (for test mode)
    setSocketIO: (io) => {
        if (tournamentServiceInstance) {
            tournamentServiceInstance.setSocketIO(io);
        } else {
            testModeSocketIO = io;
            console.log('[TournamentService] Test mode: Socket.IO instance set');
        }
    },
    // Get active tables (for test mode)
    get activeTables() {
        if (tournamentServiceInstance) {
            return tournamentServiceInstance.activeTables;
        }
        return testModeActiveTables;
    },
    // Handle game action (for test mode)
    handleGameAction: (tournamentId, socketId, action, walletAddress) => {
        if (tournamentServiceInstance) {
            return tournamentServiceInstance.handleGameAction(tournamentId, socketId, action, walletAddress);
        }
        
        // Test mode
        const table = testModeActiveTables.get(tournamentId);
        if (!table) {
            throw new Error('Tournament not active');
        }
        
        // 先尝试通过socketId查找，如果失败则通过钱包地址查找
        let playerSeat = table.findPlayerBySocketId(socketId);
        
        if (!playerSeat && walletAddress) {
            playerSeat = table.findPlayerByAddress(walletAddress);
            if (playerSeat) {
                // 更新socketId
                playerSeat.player.socketId = socketId;
                console.log(`[TournamentService] Updated socketId for player ${walletAddress?.substring(0, 10)}...`);
            }
        }
        
        if (!playerSeat) {
            throw new Error('Player not found in table');
        }
        
        // 使用找到的玩家的socketId
        const effectiveSocketId = playerSeat.player.socketId || socketId;
        
        let result;
        switch (action.type) {
            case 'fold':
                result = table.handleFold(effectiveSocketId);
                break;
            case 'check':
                result = table.handleCheck(effectiveSocketId);
                break;
            case 'call':
                result = table.handleCall(effectiveSocketId);
                break;
            case 'raise':
                result = table.handleRaise(effectiveSocketId, action.amount);
                break;
            default:
                throw new Error('Unknown action');
        }
        
        // Broadcast updated state (only if tournament is still active)
        if (testModeSocketIO && result && table.isTournamentActive) {
            const gameState = {
                tournamentId,
                isTournament: true,
                pot: table.pot,
                board: table.board,
                street: table.board.length === 0 ? 'preflop' : 
                        table.board.length === 3 ? 'flop' :
                        table.board.length === 4 ? 'turn' :
                        table.board.length === 5 ? 'river' : 'showdown',
                turn: table.turn,
                button: table.button,
                smallBlind: table.smallBlind,
                bigBlind: table.bigBlind,
                callAmount: table.callAmount,
                minBet: table.minBet,
                handOver: table.handOver,
                winMessages: table.winMessages,
                wentToShowdown: table.wentToShowdown,
                // Tournament specific
                blindLevel: table.currentBlindLevel,
                handsPlayed: table.handsPlayed,
                currentBlinds: {
                    small: table.minBet,
                    big: table.minBet * 2
                },
                remainingTime: table.getRemainingTime ? table.getRemainingTime() : null,
                isTournamentActive: table.isTournamentActive,
                eliminatedPlayers: table.eliminatedPlayers || [],
                remainingPlayers: table.getRemainingPlayers ? table.getRemainingPlayers() : [],
                seats: {}
            };
            
            for (let i = 1; i <= table.maxPlayers; i++) {
                const seat = table.seats[i];
                if (seat && seat.player) {
                    gameState.seats[i] = {
                        player: { 
                            id: seat.player.id, 
                            name: seat.player.name,
                            socketId: seat.player.socketId
                        },
                        stack: seat.stack,
                        bet: seat.bet,
                        folded: seat.folded,
                        checked: seat.checked,
                        lastAction: seat.lastAction,
                        turn: seat.turn !== undefined ? seat.turn : (table.turn === i),
                        sittingOut: seat.sittingOut
                    };
                }
            }
            
            // Send personalized state (show player's own cards)
            const roomSockets = testModeSocketIO.sockets.adapter.rooms.get(`tournament:${tournamentId}`);
            if (roomSockets) {
                for (const sockId of roomSockets) {
                    const personalState = JSON.parse(JSON.stringify(gameState));
                    const socket = testModeSocketIO.sockets.sockets.get(sockId);
                    const playerWallet = socket?.handshake?.query?.address || socket?.walletAddress;
                    
                    // Add cards for each seat
                    for (let i = 1; i <= table.maxPlayers; i++) {
                        const seat = table.seats[i];
                        if (seat && seat.player && seat.hand) {
                            // Case-insensitive address comparison
                            const seatAddr = seat.player.id?.toLowerCase();
                            const walletAddr = playerWallet?.toLowerCase();
                            if (seatAddr === walletAddr) {
                                personalState.seats[i].hand = seat.hand;
                            } else if (!seat.folded && table.wentToShowdown) {
                                personalState.seats[i].hand = seat.hand;
                            } else {
                                personalState.seats[i].hand = null;
                            }
                        }
                    }
                    
                    testModeSocketIO.to(sockId).emit('tournament_game_state', personalState);
                    console.log(`[TournamentService] handleGameAction: sent to ${sockId}, wallet=${playerWallet?.substring(0, 10)}, turn=${personalState.turn}`);
                }
            } else {
                testModeSocketIO.to(`tournament:${tournamentId}`).emit('tournament_game_state', gameState);
            }
        }
        
        // Send NFT achievements if any
        if (table.pendingAchievements && table.pendingAchievements.length > 0) {
            const { SC_NFT_ACHIEVEMENT_EARNED } = require('../pokergame/actions');
            
            for (const achievement of table.pendingAchievements) {
                // Find the player's socket
                const roomSockets = testModeSocketIO.sockets.adapter.rooms.get(`tournament:${tournamentId}`);
                if (roomSockets) {
                    for (const sockId of roomSockets) {
                        const socket = testModeSocketIO.sockets.sockets.get(sockId);
                        const playerWallet = socket?.handshake?.query?.address || socket?.walletAddress;
                        
                        if (playerWallet?.toLowerCase() === achievement.playerAddress?.toLowerCase()) {
                            console.log(`[TournamentService] Sending NFT achievement to ${playerWallet?.substring(0, 10)}: ${achievement.achievementType}`);
                            
                            testModeSocketIO.to(sockId).emit(SC_NFT_ACHIEVEMENT_EARNED, {
                                achievementType: achievement.achievementType,
                                handType: achievement.handType,
                                cards: achievement.cards,
                                description: achievement.description,
                                typeId: achievement.typeId,
                                hand: achievement.hand,
                                board: achievement.board,
                                gameId: `tournament-${tournamentId}`
                            });
                        }
                    }
                }
            }
            
            // Clear pending achievements after sending
            table.pendingAchievements = [];
        }
        
        return result;
    },
    // Handle disconnect
    handleDisconnect: (socketId, walletAddress) => {
        if (tournamentServiceInstance) {
            return tournamentServiceInstance.handleDisconnect(socketId, walletAddress);
        }

        // Test mode - handle disconnect in test mode tables
        console.log(`[TournamentService] Test mode handleDisconnect for socket: ${socketId}, wallet: ${walletAddress?.substring(0, 10)}`);
        for (const [tournamentId, table] of testModeActiveTables) {
            const result = table.handleDisconnect(socketId, walletAddress);
            if (result) {
                console.log(`[TournamentService] Test mode: Player disconnected from tournament ${tournamentId}`);
                if (result.tournamentEnded) {
                    // Remove table from active tables
                    testModeActiveTables.delete(tournamentId);
                }
                return result;
            }
        }
        return null;
    },
    // Broadcast table state
    broadcastTableState: (tournamentId, table) => {
        if (tournamentServiceInstance) {
            return tournamentServiceInstance.broadcastTableState(tournamentId, table);
        }
        
        // Test mode
        if (!testModeSocketIO || !table) return;
        
        console.log(`[TournamentService] broadcastTableState: turn=${table.turn}, handOver=${table.handOver}`);
        
        const gameState = {
            tournamentId,
            isTournament: true,
            pot: table.pot,
            board: table.board,
            street: table.board.length === 0 ? 'preflop' : 
                    table.board.length === 3 ? 'flop' :
                    table.board.length === 4 ? 'turn' :
                    table.board.length === 5 ? 'river' : 'showdown',
            turn: table.turn,
            button: table.button,
            smallBlind: table.smallBlind,
            bigBlind: table.bigBlind,
            callAmount: table.callAmount,
            initialChips: table.initialChips,
            handOver: table.handOver,
            winMessages: table.winMessages,
            // Tournament specific info
            blindLevel: table.currentBlindLevel,
            handsPlayed: table.handsPlayed,
            currentBlinds: {
                small: table.minBet,
                big: table.minBet * 2
            },
            remainingTime: table.getRemainingTime ? table.getRemainingTime() : null,
            seats: {}
        };
        
        // Build seats with card visibility
        for (let i = 1; i <= table.maxPlayers; i++) {
            const seat = table.seats[i];
            if (seat && seat.player) {
                gameState.seats[i] = {
                    player: { id: seat.player.id, name: seat.player.name },
                    stack: seat.stack,
                    bet: seat.bet,
                    folded: seat.folded,
                    hand: seat.hand,
                    lastAction: seat.lastAction,
                    turn: seat.turn !== undefined ? seat.turn : (table.turn === i)
                };
                console.log(`[TournamentService] Seat ${i}: player=${seat.player.id?.substring(0, 10)}, turn=${seat.turn}, table.turn=${table.turn}, stack=${seat.stack}`);
            }
        }
        
        testModeSocketIO.to(`tournament:${tournamentId}`).emit('tournament_game_state', gameState);
        console.log(`[TournamentService] Sent game state to room tournament:${tournamentId}`);
    },
    // Internal: Handle tournament end (called async from onTournamentEnd callback)
    _handleTournamentEnd: async (tournamentId, data) => {
        const TournamentModel = require('../models/Tournament');
        const ChipService = require('./ChipService');
        const tournament = await TournamentModel.findOne({ tournamentId });
        
        if (!tournament) {
            console.error(`[TournamentService] _handleTournamentEnd: Tournament ${tournamentId} not found in DB!`);
            return;
        }
        
        console.log(`[TournamentService] _handleTournamentEnd: Saving tournament ${tournamentId} to DB, rankings:`, data.rankings);
        
        // Calculate rake amount (TRX)
        const buyIn = tournament.buyIn || 100000000; // Default 100 TRX
        const playerCount = tournament.players?.length || data.rankings.length;
        const totalBuyIn = buyIn * playerCount;
        const rakeRate = tournament.rakeRate || 500; // 5% = 500 basis points
        const rakeAmountSun = Math.floor(totalBuyIn * rakeRate / 10000);
        const rakeAmountTrx = rakeAmountSun / 1e6; // Convert SUN to TRX

        console.log(`[TournamentService] Rake calculation: ${playerCount} players × ${buyIn/1e6} TRX = ${totalBuyIn/1e6} TRX total, rake: ${rakeAmountTrx} TRX`);
        
        // Calculate prize distribution
        // Prize pool = total buy-in - rake
        const prizePool = totalBuyIn - rakeAmountSun;
        
        // Get prize distribution from tournament config
        // ConfigId 1 (6人赛): [50, 30, 20] - 50%/30%/20%
        // ConfigId 2 (4人赛): [60, 40] - 60%/40%
        // ConfigId 3 (双人赛): [100] - 第一名100%
        const prizeDistribution = tournament.config?.prizeDistribution || tournament.prizeDistribution || [7000, 3000]; // basis points
        
        // Calculate prizes for each position
        const prizes = [];
        for (let i = 0; i < data.rankings.length && i < prizeDistribution.length; i++) {
            const prizeAmount = Math.floor(prizePool * prizeDistribution[i] / 10000);
            prizes.push({
                address: data.rankings[i],
                position: i + 1,
                prizeAmount
            });
        }
        
        console.log(`[TournamentService] Prize distribution:`, prizes.map(p => 
            `#${p.position}: ${(p.prizeAmount/1e6).toFixed(2)} TRX`
        ).join(', '));
        
        // Update tournament status
        tournament.status = 'COMPLETED';
        tournament.rakeAmount = rakeAmountSun;
        tournament.rankings = data.rankings.map((address, index) => ({
            address,
            position: index + 1,
            prize: prizes[index]?.prizeAmount || 0
        }));
        tournament.finishedAt = new Date();
        tournament.endReason = data.reason || 'elimination';
        tournament.totalHands = data.totalHands;
        
        await tournament.save();
        console.log(`[TournamentService] _handleTournamentEnd: Tournament ${tournamentId} saved to DB`);

        // === SETTLE TRX VIA CONTRACT ===
        // Tournament settlement logic:
        // 1. Prize pool already has rake deducted (totalBuyIn - rake)
        // 2. Contract will also take rake on profit (finalStack > buyIn)
        // 3. To avoid double-rake, we adjust finalStack so that after contract rake,
        //    player gets exactly the prizeAmount
        //
        // Formula derivation:
        // - Contract: netStack = finalStack - (finalStack - buyIn) * rakeRate
        // - We want: netStack = buyIn + prizeAmount
        // - Solve: finalStack = buyIn + prizeAmount / (1 - rakeRate)
        
        try {
            const contractService = require('../blockchain/ContractService');
            const { TronWeb } = require('tronweb');
            
            // Helper function to restore proper Base58 address from lowercase
            const restoreAddress = (lowerAddr) => {
                const knownAddresses = {
                    'tu8rhtpfqusgpbe9sxqafg8bdxf52ggsmv': 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
                    'tx27ljdqk64d4nvbxkt1taayx5dpf4jpl4': 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'
                };
                return knownAddresses[lowerAddr] || lowerAddr;
            };
            
            // Check if contract service is available
            if (contractService) {
                console.log(`[TournamentService] Settling tournament prizes via contract...`);
                
                // Generate a unique tableId for this tournament
                const tableId = parseInt(tournamentId.replace('tournament-', '').replace(/-/g, '').substring(0, 10)) || Date.now();
                const buyIn = tournament.buyIn || 100000000;
                const contractRakeRate = 0.05; // Contract rake rate is 5% (500 basis points)
                
                // Build a map of all players with their final amounts
                const playerSettlements = new Map();
                
                // Add all tournament players with their prize amounts
                for (const prize of prizes) {
                    playerSettlements.set(prize.address, {
                        address: prize.address,
                        prizeAmount: prize.prizeAmount,
                        position: prize.position
                    });
                }
                
                // Also add losers who didn't get any prize (finalStack = 0)
                for (const player of tournament.players) {
                    if (!playerSettlements.has(player.address)) {
                        playerSettlements.set(player.address, {
                            address: player.address,
                            prizeAmount: 0,  // Loser gets nothing
                            position: player.finalPosition || data.rankings.length
                        });
                    }
                }
                
                // Settle each player
                for (const [address, settlement] of playerSettlements) {
                    try {
                        const playerAddress = restoreAddress(address);
                        
                        console.log(`[TournamentService] Settling player ${playerAddress.substring(0, 10)}... position=${settlement.position}, prize=${(settlement.prizeAmount/1e6).toFixed(2)} TRX`);
                        
                        // Get player info
                        const playerInfo = await contractService.getPlayerInfo(playerAddress);
                        const playerBalance = playerInfo.balance || 0;
                        const playerLocked = playerInfo.lockedAmount || 0;
                        
                        // Calculate finalStack that accounts for contract rake
                        // The contract charges rake on profit (finalStack - buyIn)
                        // We need to adjust finalStack so that after contract rake,
                        // player gets exactly the prizeAmount
                        //
                        // Formula derivation:
                        // netChange = netStack - buyIn = finalStack - (finalStack - buyIn) * rakeRate - buyIn
                        // We want: netChange = prizeAmount - buyIn
                        // Solving: finalStack = (prizeAmount - buyIn) / (1 - rakeRate) + buyIn
                        // Simplified: finalStack = targetNetChange / (1 - rakeRate) + buyIn
                        // Where targetNetChange = prizeAmount - buyIn
                        
                        let finalStack;
                        if (settlement.prizeAmount === 0) {
                            // Loser: finalStack = 0, loses entire buyIn
                            finalStack = 0;
                        } else {
                            // Winner: adjust for contract rake
                            // targetNetChange = prizeAmount - buyIn (e.g., 190 - 100 = 90 TRX)
                            const targetNetChange = settlement.prizeAmount - buyIn;
                            if (targetNetChange <= 0) {
                                // No profit, no adjustment needed
                                finalStack = settlement.prizeAmount;
                            } else {
                                // Adjust finalStack so contract rake doesn't eat into expected prize
                                finalStack = Math.floor(targetNetChange / (1 - contractRakeRate) + buyIn);
                            }
                        }
                        
                        // Check if player already has locked funds (from joinTournament)
                        // or has enough balance to lock
                        if (playerLocked >= buyIn) {
                            // Player already has buyIn locked, just return final stack
                            console.log(`[TournamentService] Player has ${playerLocked/1e6} TRX locked, settling...`);
                            
                            await contractService.leaveTableFor(playerAddress, tableId, finalStack);
                            
                            // Calculate actual net change (after contract rake)
                            const netStack = finalStack <= buyIn ? finalStack : 
                                finalStack - Math.floor((finalStack - buyIn) * contractRakeRate);
                            const netChange = netStack - buyIn;
                            console.log(`[TournamentService] ✅ Settled ${playerAddress.substring(0, 10)}...: finalStack=${(finalStack/1e6).toFixed(2)}, net change=${netChange/1e6 >= 0 ? '+' : ''}${netChange/1e6} TRX`);
                        } else if (playerBalance >= buyIn) {
                            // Step 1: Lock buyIn
                            await contractService.joinTableFor(playerAddress, tableId, buyIn);
                            
                            // Step 2: Return final stack
                            await contractService.leaveTableFor(playerAddress, tableId, finalStack);
                            
                            // Calculate actual net change (after contract rake)
                            const netStack = finalStack <= buyIn ? finalStack : 
                                finalStack - Math.floor((finalStack - buyIn) * contractRakeRate);
                            const netChange = netStack - buyIn;
                            console.log(`[TournamentService] ✅ Settled ${playerAddress.substring(0, 10)}...: finalStack=${(finalStack/1e6).toFixed(2)}, net change=${netChange/1e6 >= 0 ? '+' : ''}${netChange/1e6} TRX`);
                        } else {
                            console.log(`[TournamentService] ⚠️ Player ${playerAddress.substring(0, 10)}... has insufficient balance (${playerBalance/1e6} TRX < ${buyIn/1e6} TRX), prize recorded in DB only`);
                            console.log(`[TournamentService] 💡 Player needs to deposit at least ${buyIn/1e6} TRX to contract for on-chain settlement`);
                        }
                    } catch (e) {
                        console.error(`[TournamentService] ❌ Failed to settle ${address}:`, e.message);
                    }
                }
            } else {
                console.log(`[TournamentService] ContractService not available, skipping on-chain settlement`);
            }
        } catch (e) {
            console.error(`[TournamentService] Error in contract settlement:`, e.message);
        }

        // Reward ALL players with CHIP based on position and VIP level
        // Position-based reward rates:
        // - 1st place: 100% of base CHIP reward
        // - 2nd place: 30% of base CHIP reward (even if they left/disconnected)
        // - 3rd+ places: 10% of base CHIP reward
        const chipRewards = [];
        
        // Helper to restore proper Base58 address from lowercase
        const restoreAddressForChip = (addr) => {
            if (!addr) return addr;
            const knownAddresses = {
                'tu8rhtpfqusgpbe9sxqafg8bdxf52ggsmv': 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
                'tx27ljdqk64d4nvbxkt1taayx5dpf4jpl4': 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'
            };
            const lower = addr.toLowerCase();
            return knownAddresses[lower] || addr;
        };
        
        // Position-based reward multipliers
        const positionMultipliers = [1.0, 0.3, 0.1, 0.1]; // 1st: 100%, 2nd: 30%, 3rd+: 10%
        
        for (let i = 0; i < data.rankings.length; i++) {
            const playerAddressRaw = data.rankings[i];
            const playerAddress = restoreAddressForChip(playerAddressRaw);
            const position = i + 1;
            const multiplier = positionMultipliers[i] || 0.1; // Default to 10% for 4th+ place
            
            if (rakeAmountTrx > 0 && multiplier > 0) {
                try {
                    const chipService = ChipService.getChipService();
                    if (chipService) {
                        console.log(`[TournamentService] Attempting CHIP reward to ${playerAddress} (position: ${position}, multiplier: ${multiplier})`);
                        const rewardResult = await chipService.rewardPlayerWithChipBonus(
                            playerAddress, 
                            rakeAmountTrx, 
                            multiplier,
                            position
                        );
                        chipRewards.push({
                            address: playerAddressRaw,
                            position: position,
                            ...rewardResult
                        });
                        console.log(`[TournamentService] CHIP reward result for ${playerAddress}:`, rewardResult);
                    } else {
                        console.warn(`[TournamentService] ChipService not initialized, skipping CHIP reward`);
                    }
                } catch (error) {
                    console.error(`[TournamentService] Failed to reward CHIP to ${playerAddress}:`, error.message);
                }
            }
        }
        
        // Broadcast tournament ended (activeTable already removed by sync callback)
        // Send to all players (including eliminated ones who may have left the room)
        if (testModeSocketIO) {
            const endEventData = {
                tournamentId,
                rankings: data.rankings,
                reason: data.reason || 'elimination',
                totalHands: data.totalHands,
                rakeAmount: rakeAmountTrx,
                chipRewards,
                prizes: prizes.map(p => ({ address: p.address, position: p.position, prizeAmount: p.prizeAmount }))
            };
            
            // Broadcast to room (for remaining players)
            testModeSocketIO.to(`tournament:${tournamentId}`).emit('SC_TOURNAMENT_ENDED', endEventData);
            
            // Also send directly to all players in rankings (including eliminated ones who left the room)
            // Get socket IDs from active table's eliminated players and seats
            const table = testModeActiveTables.get(tournamentId);
            const playerSocketMap = new Map(); // address -> socketId
            
            // Collect from eliminated players
            if (table && table.eliminatedPlayers) {
                for (const eliminated of table.eliminatedPlayers) {
                    if (eliminated.player && eliminated.player.address && eliminated.player.socketId) {
                        playerSocketMap.set(eliminated.player.address.toLowerCase(), eliminated.player.socketId);
                    }
                }
            }
            
            // Collect from current seats (remaining players)
            if (table && table.seats) {
                for (const seatId in table.seats) {
                    const seat = table.seats[seatId];
                    if (seat && seat.player && seat.player.address && seat.player.socketId) {
                        playerSocketMap.set(seat.player.address.toLowerCase(), seat.player.socketId);
                    }
                }
            }
            
            // Also check tournament.players from DB (may have socketId from join)
            if (tournament.players) {
                for (const player of tournament.players) {
                    if (player.address && player.socketId) {
                        // Only add if not already in map (prefer table's socketId)
                        if (!playerSocketMap.has(player.address.toLowerCase())) {
                            playerSocketMap.set(player.address.toLowerCase(), player.socketId);
                        }
                    }
                }
            }
            
            // Send to all ranked players who are not in the room
            for (const address of data.rankings) {
                const socketId = playerSocketMap.get(address.toLowerCase());
                if (socketId) {
                    const socket = testModeSocketIO.sockets.sockets.get(socketId);
                    if (socket) {
                        // Check if socket is in the room (avoid double send)
                        const isInRoom = testModeSocketIO.sockets.adapter.rooms.get(`tournament:${tournamentId}`)?.has(socketId);
                        if (!isInRoom) {
                            socket.emit('SC_TOURNAMENT_ENDED', endEventData);
                            console.log(`[TournamentService] Sent SC_TOURNAMENT_ENDED to player ${address?.substring(0, 10)}... (socket left room)`);
                        }
                    }
                }
            }
            
            console.log(`[TournamentService] _handleTournamentEnd: >>> Broadcasted SC_TOURNAMENT_ENDED to all players`);
        }
        
        console.log(`[TournamentService] _handleTournamentEnd: Tournament ${tournamentId} end handling complete`);
    }
};
