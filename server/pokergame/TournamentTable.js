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
    constructor(tournamentId, maxPlayers, initialChips) {
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
        
        // Callbacks
        this.onElimination = null;
        this.onTournamentEnd = null;
        
        console.log(`[TournamentTable] Created tournament ${tournamentId} with ${maxPlayers} players, ${initialChips} starting chips`);
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
     * Override endHand to detect eliminations
     */
    endHand() {
        // Call parent endHand
        super.endHand();
        
        // Check for eliminated players
        this.checkEliminatedPlayers();
        
        // Check if tournament is over
        if (this.getRemainingPlayers().length === 1) {
            this.endTournament();
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
                // Player is eliminated
                const eliminationData = {
                    seatId: parseInt(seatId),
                    player: seat.player,
                    finalPosition: this.getRemainingPlayers().length,
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
        
        console.log(`[TournamentTable] Tournament ${this.tournamentId} ended`);
        console.log(`[TournamentTable] Rankings: ${rankings.join(', ')}`);
        
        // Callback
        if (this.onTournamentEnd) {
            this.onTournamentEnd({
                tournamentId: this.tournamentId,
                rankings,
                totalHands: this.history.length,
                endedAt: new Date()
            });
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
            initialChips: this.initialChips,
            timeBanks: this.playerTimeBanks
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
