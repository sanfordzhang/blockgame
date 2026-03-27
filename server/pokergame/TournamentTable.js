/**
 * TournamentTable
 * Extends Table.js with tournament-specific functionality
 * - Elimination detection
 * - Fixed blinds
 * - Disconnect handling
 * - Time bank
 */

const Table = require('./Table');

class TournamentTable extends Table {
    constructor(tournamentId, maxPlayers, initialChips, blindConfig = null) {
        super(tournamentId, `Tournament-${tournamentId}`, initialChips * 100, maxPlayers);
        
        this.tournamentId = tournamentId;
        this.initialChips = initialChips;
        
        // Tournament-specific properties
        this.eliminatedPlayers = [];
        this.finalRankings = [];
        this.isTournamentActive = true;
        
        // Time controls
        this.actionTimeout = 15000; // 15 seconds
        this.timeBankMax = 60000;   // 60 seconds max time bank
        this.playerTimeBanks = {};  // Track time bank per player
        
        // Blind structure (default: increase every 10 hands, 2x multiplier)
        this.blindConfig = blindConfig || {
            initialSmallBlind: this.minBet,
            increaseEveryHands: 10,
            multiplier: 2,
            maxBlindLevel: 10
        };
        this.currentBlindLevel = 1;
        this.handsPlayed = 0;
        this.baseMinBet = this.minBet;
        
        // Time limit (default: 30 minutes = 1800000ms)
        this.timeLimit = 30 * 60 * 1000; // 30 minutes
        this.startTime = null;
        this.timeLimitReached = false;
        this.timeLimitTimer = null;
        
        // Callbacks
        this.onElimination = null;
        this.onTournamentEnd = null;
        this.onNextHand = null; // Callback to start next hand
        
        console.log(`[TournamentTable] Created tournament ${tournamentId} with ${maxPlayers} players, ${initialChips} starting chips`);
        console.log(`[TournamentTable] Blind config: level=${this.currentBlindLevel}, smallBlind=${this.minBet}, increase every ${this.blindConfig.increaseEveryHands} hands`);
    }
    
    /**
     * Override sitPlayer to set fixed initial chips
     */
    sitPlayer(player, seatId, amount) {
        // Use initial chips instead of provided amount
        const tournamentChips = this.initialChips;
        
        // Call parent
        super.sitPlayer(player, seatId, tournamentChips);
        
        // Initialize time bank
        this.playerTimeBanks[player.socketId] = this.timeBankMax;
        
        console.log(`[TournamentTable] Player ${player.address} sat at seat ${seatId} with ${tournamentChips} chips`);
    }
    
    /**
     * Override endHand to detect eliminations and start next hand
     */
    endHand() {
        // Call parent endHand
        super.endHand();
        
        // Increment hands played
        this.handsPlayed++;
        console.log(`[TournamentTable] Hand ${this.handsPlayed} ended`);
        
        // Check for eliminated players
        this.checkEliminatedPlayers();
        
        // Check if tournament is over
        const remaining = this.getRemainingPlayers();
        console.log(`[TournamentTable] Remaining players: ${remaining.length}`);
        if (remaining.length > 0) {
            console.log(`[TournamentTable] Remaining player stacks:`, remaining.map(r => `${r.player.address?.substring(0,8)}=${r.stack}`).join(', '));
        }

        if (remaining.length === 1) {
            console.log(`[TournamentTable] Only 1 player remaining, ending tournament...`);
            this.endTournament();
            return;
        }
        
        // Check time limit
        if (this.isTimeLimitReached()) {
            console.log(`[TournamentTable] Time limit reached, ending tournament`);
            this.endTournamentByTimeLimit();
            return;
        }
        
        // Increase blinds if needed
        this.checkBlindIncrease();
        
        // Auto-start next hand after delay (3 seconds)
        if (this.isTournamentActive && remaining.length > 1) {
            console.log(`[TournamentTable] Scheduling next hand in 3 seconds...`);
            setTimeout(() => {
                this.startNextHand();
            }, 3000);
        }
    }
    
    /**
     * Start the tournament timer
     */
    startTournamentTimer() {
        this.startTime = Date.now();
        console.log(`[TournamentTable] Tournament timer started at ${new Date(this.startTime).toISOString()}`);
        
        // Set timeout for time limit
        this.timeLimitTimer = setTimeout(() => {
            if (this.isTournamentActive) {
                console.log(`[TournamentTable] Time limit reached (${this.timeLimit / 60000} minutes)`);
                this.timeLimitReached = true;
                // Will be handled in endHand
            }
        }, this.timeLimit);
    }
    
    /**
     * Check if time limit is reached
     */
    isTimeLimitReached() {
        if (!this.startTime) return false;
        const elapsed = Date.now() - this.startTime;
        return elapsed >= this.timeLimit;
    }
    
    /**
     * Get remaining time in ms
     */
    getRemainingTime() {
        if (!this.startTime) return this.timeLimit;
        const elapsed = Date.now() - this.startTime;
        return Math.max(0, this.timeLimit - elapsed);
    }
    
    /**
     * End tournament by time limit
     */
    endTournamentByTimeLimit() {
        this.isTournamentActive = false;
        
        // Rank by stack size
        const remaining = this.getRemainingPlayers()
            .sort((a, b) => b.stack - a.stack);
        
        const rankings = remaining.map(p => p.player.address);
        
        // Add eliminated players (they rank lower)
        const eliminatedSorted = [...this.eliminatedPlayers]
            .sort((a, b) => a.finalPosition - b.finalPosition)
            .map(e => e.player.address);
        
        rankings.push(...eliminatedSorted);
        
        console.log(`[TournamentTable] Tournament ended by time limit`);
        console.log(`[TournamentTable] Rankings by stack: ${rankings.join(', ')}`);
        
        if (this.onTournamentEnd) {
            this.onTournamentEnd({
                tournamentId: this.tournamentId,
                rankings,
                totalHands: this.handsPlayed,
                endedAt: new Date(),
                reason: 'time_limit'
            });
        }
    }
    
    /**
     * Check and increase blinds
     */
    checkBlindIncrease() {
        const handsPerLevel = this.blindConfig.increaseEveryHands;
        const newLevel = Math.floor(this.handsPlayed / handsPerLevel) + 1;
        
        if (newLevel > this.currentBlindLevel && newLevel <= this.blindConfig.maxBlindLevel) {
            this.currentBlindLevel = newLevel;
            const multiplier = Math.pow(this.blindConfig.multiplier, newLevel - 1);
            this.minBet = this.baseMinBet * multiplier;
            
            console.log(`[TournamentTable] Blind level increased to ${newLevel}`);
            console.log(`[TournamentTable] New blinds: small=${this.minBet}, big=${this.minBet * 2}`);
        }
    }
    
    /**
     * Start next hand
     */
    startNextHand() {
        if (!this.isTournamentActive) {
            console.log(`[TournamentTable] Tournament not active, not starting next hand`);
            return;
        }
        
        const remaining = this.getRemainingPlayers();
        if (remaining.length <= 1) {
            console.log(`[TournamentTable] Not enough players, not starting next hand`);
            return;
        }
        
        // Check time limit again
        if (this.isTimeLimitReached()) {
            console.log(`[TournamentTable] Time limit reached, ending tournament instead`);
            this.endTournamentByTimeLimit();
            return;
        }
        
        console.log(`[TournamentTable] Starting hand ${this.handsPlayed + 1}`);
        
        // Clear win messages from previous hand
        this.clearWinMessages();
        
        // Start new hand
        this.startHand();
        
        // Notify callback
        if (this.onNextHand) {
            this.onNextHand({
                handNumber: this.handsPlayed + 1,
                blindLevel: this.currentBlindLevel,
                smallBlind: this.minBet,
                bigBlind: this.minBet * 2
            });
        }
    }
    
    /**
     * Check for eliminated players
     */
    checkEliminatedPlayers() {
        const eliminated = [];

        for (const seatId of Object.keys(this.seats)) {
            const seat = this.seats[seatId];

            if (seat && seat.stack === 0 && !this.isPlayerEliminated(seat.player.socketId)) {
                // Calculate position BEFORE adding to eliminated list
                const remainingCount = this.getRemainingPlayers().length;

                // Player is eliminated
                const eliminationData = {
                    seatId: parseInt(seatId),
                    player: seat.player,
                    finalPosition: remainingCount, // This is their finishing position
                    eliminatedAt: new Date()
                };

                eliminated.push(eliminationData);
                this.eliminatedPlayers.push(eliminationData);

                console.log(`[TournamentTable] Player ${seat.player.address} eliminated at position ${eliminationData.finalPosition}`);

                // Callback
                if (this.onElimination) {
                    this.onElimination(eliminationData);
                }
            }
        }

        return eliminated;
    }
    
    /**
     * Check if player is already eliminated
     */
    isPlayerEliminated(socketId) {
        return this.eliminatedPlayers.some(e => e.player.socketId === socketId);
    }
    
    /**
     * Get remaining players (not eliminated)
     */
    getRemainingPlayers() {
        const remaining = [];
        
        for (const seatId of Object.keys(this.seats)) {
            const seat = this.seats[seatId];
            
            if (seat && seat.stack > 0 && !this.isPlayerEliminated(seat.player.socketId)) {
                remaining.push({
                    seatId: parseInt(seatId),
                    player: seat.player,
                    stack: seat.stack
                });
            }
        }
        
        return remaining;
    }
    
    /**
     * Get final rankings (winner first)
     */
    getFinalRankings() {
        // Sort eliminated players by position (descending, since position is remaining count)
        const rankings = [...this.eliminatedPlayers]
            .sort((a, b) => a.finalPosition - b.finalPosition)
            .map(e => e.player.address);
        
        // Add winner (last remaining)
        const remaining = this.getRemainingPlayers();
        if (remaining.length === 1) {
            rankings.unshift(remaining[0].player.address);
        }
        
        return rankings;
    }
    
    /**
     * End tournament
     */
    endTournament() {
        this.isTournamentActive = false;

        const rankings = this.getFinalRankings();

        console.log(`[TournamentTable] ========== TOURNAMENT ENDED ==========`);
        console.log(`[TournamentTable] Tournament ${this.tournamentId} ended`);
        console.log(`[TournamentTable] Rankings: ${rankings.join(', ')}`);
        console.log(`[TournamentTable] Total hands played: ${this.history.length}`);
        console.log(`[TournamentTable] onTournamentEnd callback exists: ${!!this.onTournamentEnd}`);

        // Callback
        if (this.onTournamentEnd) {
            console.log(`[TournamentTable] Calling onTournamentEnd callback...`);
            this.onTournamentEnd({
                tournamentId: this.tournamentId,
                rankings,
                totalHands: this.history.length,
                endedAt: new Date()
            });
            console.log(`[TournamentTable] onTournamentEnd callback completed`);
        } else {
            console.error(`[TournamentTable] ERROR: onTournamentEnd callback is not set!`);
        }
    }
    
    /**
     * Handle player disconnect
     */
    handleDisconnect(socketId) {
        // Find the seat
        const seat = this.findPlayerBySocketId(socketId);
        
        if (!seat || !this.isTournamentActive) {
            return null;
        }
        
        // If it's their turn, auto-fold
        if (seat.turn) {
            console.log(`[TournamentTable] Player ${seat.player.address} disconnected during turn - auto fold`);
            return this.handleFold(socketId);
        }
        
        console.log(`[TournamentTable] Player ${seat.player.address} disconnected`);
        
        return null;
    }
    
    /**
     * Handle timeout with time bank
     */
    handleTimeout(socketId) {
        const seat = this.findPlayerBySocketId(socketId);
        
        if (!seat || !seat.turn) {
            return null;
        }
        
        // Check time bank
        const timeBank = this.playerTimeBanks[socketId] || 0;
        
        if (timeBank > 0) {
            // Use time bank - don't fold yet
            console.log(`[TournamentTable] Player ${seat.player.address} using time bank (${timeBank}ms remaining)`);
            return { usingTimeBank: true, remaining: timeBank };
        }
        
        // Time bank exhausted - auto fold
        console.log(`[TournamentTable] Player ${seat.player.address} timeout - auto fold`);
        return this.handleFold(socketId);
    }
    
    /**
     * Deduct from time bank
     */
    useTimeBank(socketId, milliseconds) {
        if (!this.playerTimeBanks[socketId]) {
            this.playerTimeBanks[socketId] = this.timeBankMax;
        }
        
        this.playerTimeBanks[socketId] = Math.max(0, this.playerTimeBanks[socketId] - milliseconds);
        return this.playerTimeBanks[socketId];
    }
    
    /**
     * Get time bank remaining
     */
    getTimeBank(socketId) {
        return this.playerTimeBanks[socketId] || 0;
    }
    
    /**
     * Find player by socket ID
     */
    findPlayerBySocketId(socketId) {
        for (const seatId of Object.keys(this.seats)) {
            const seat = this.seats[seatId];
            if (seat && seat.player.socketId === socketId) {
                return seat;
            }
        }
        return null;
    }
    
    /**
     * Find player by wallet address (fallback when socketId is not set)
     */
    findPlayerByAddress(address) {
        for (const seatId of Object.keys(this.seats)) {
            const seat = this.seats[seatId];
            if (seat && seat.player.id === address) {
                return seat;
            }
        }
        return null;
    }
    
    /**
     * Get tournament state for client
     */
    getTournamentState() {
        const remaining = this.getRemainingPlayers();
        
        return {
            tournamentId: this.tournamentId,
            isActive: this.isTournamentActive,
            totalPlayers: this.maxPlayers,
            remainingPlayers: remaining.length,
            eliminatedCount: this.eliminatedPlayers.length,
            currentBlinds: {
                small: this.minBet,
                big: this.minBet * 2
            },
            blindLevel: this.currentBlindLevel,
            handsPlayed: this.handsPlayed,
            nextBlindIncrease: this.blindConfig.increaseEveryHands - (this.handsPlayed % this.blindConfig.increaseEveryHands),
            initialChips: this.initialChips,
            timeBanks: this.playerTimeBanks,
            timeLimit: this.timeLimit,
            remainingTime: this.getRemainingTime(),
            startTime: this.startTime
        };
    }
    
    /**
     * Get leaderboard
     */
    getLeaderboard() {
        const remaining = this.getRemainingPlayers()
            .map(p => ({
                address: p.player.address,
                stack: p.stack,
                status: 'active'
            }));
        
        const eliminated = this.eliminatedPlayers
            .map(e => ({
                address: e.player.address,
                stack: 0,
                status: 'eliminated',
                position: e.finalPosition
            }));
        
        return [...remaining, ...eliminated]
            .sort((a, b) => {
                if (a.status === 'active' && b.status === 'eliminated') return -1;
                if (a.status === 'eliminated' && b.status === 'active') return 1;
                return b.stack - a.stack;
            });
    }
}

module.exports = TournamentTable;
