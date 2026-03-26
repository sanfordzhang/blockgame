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
     * @param {number} configId - Configuration ID
     * @returns {Promise<Object>} - Created tournament
     */
    async createTournament(configId) {
        // Call contract to create tournament
        const tx = await this.contract.createTournament(configId).send({
            from: this.serverWallet
        });
        
        // Get tournament ID from event
        const tournamentId = await this._getTournamentIdFromTx(tx);
        
        // Create database record
        const tournament = new Tournament({
            tournamentId,
            configId,
            status: 'WAITING',
            txHash: tx
        });
        
        await tournament.save();
        
        console.log(`[TournamentService] Created tournament ${tournamentId}`);
        
        return tournament;
    }
    
    /**
     * Get tournament configurations
     */
    async getConfigs() {
        if (!this.contract) return [];
        
        const configs = [];
        for (let i = 1; i <= 4; i++) {
            try {
                const config = await this.contract.getTournamentConfig(i).call();
                configs.push({
                    id: i,
                    playerCount: config.playerCount.toNumber(),
                    buyIn: config.buyIn.toString(),
                    rakeRate: config.rakeRate.toNumber(),
                    prizeDistribution: config.prizeDistribution.map(p => p.toNumber()),
                    initialChips: config.initialChips.toNumber()
                });
            } catch (e) {
                break;
            }
        }
        
        return configs;
    }
    
    // ============ Player Actions ============
    
    /**
     * Join a tournament
     * @param {string} tournamentId - Tournament ID
     * @param {string} playerAddress - Player wallet address
     * @param {string} socketId - Socket ID
     */
    async joinTournament(tournamentId, playerAddress, socketId) {
        const tournament = await Tournament.findOne({ tournamentId });
        
        if (!tournament) {
            throw new Error('Tournament not found');
        }
        
        if (tournament.status !== 'WAITING') {
            throw new Error('Tournament not accepting players');
        }
        
        // Add player to database record
        const added = tournament.addPlayer(playerAddress, socketId);
        if (!added) {
            throw new Error('Already joined');
        }
        
        await tournament.save();
        
        // Broadcast update
        this.broadcastUpdate(tournamentId, {
            type: 'player_joined',
            player: playerAddress,
            playerCount: tournament.players.length
        });
        
        // Check if ready to start
        const config = await this.getConfig(tournament.configId);
        if (tournament.players.length >= config.playerCount) {
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
            config.initialChips
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
    handleDisconnect(socketId) {
        // Find tournament the player is in
        for (const [tournamentId, table] of this.activeTables) {
            const result = table.handleDisconnect(socketId);
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

module.exports = TournamentService;
