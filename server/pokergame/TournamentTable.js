/**
 * TournamentTable
 * Extends Table.js with tournament-specific functionality
 * - Elimination detection
 * - Fixed blinds
 * - Disconnect handling
 * - Time bank
 */

const Table = require('./Table');

/**
 * Generate a mock deck that gives player 1 a straight
 * @param {number} playerCount - Number of players
 * @returns {Array} - Array of card objects
 */
function generateStraightMockDeck(playerCount) {
    // 顺子牌型：玩家1获得 5-6，公共牌 7-8-9-2-3
    // 这样玩家1有 5-6-7-8-9 顺子
    
    const suits = ['h', 'd', 'c', 's']; // hearts, diamonds, clubs, spades
    
    // 玩家1的手牌: 5h, 6h (红桃顺子起始)
    const player1Hand = [
        { rank: '5', suit: 'h' },
        { rank: '6', suit: 'h' }
    ];
    
    // 公共牌: 7h, 8h, 9d (flop), 2c (turn), 3s (river)
    // 这样玩家1有 5-6-7-8-9 顺子（红桃5-8 + 方块9）
    const board = [
        { rank: '7', suit: 'h' },
        { rank: '8', suit: 'h' },
        { rank: '9', suit: 'd' },
        { rank: '2', suit: 'c' },
        { rank: '3', suit: 's' }
    ];
    
    // 玩家2的手牌: 随机不形成顺子的牌
    const player2Hand = [
        { rank: 'K', suit: 'c' },
        { rank: 'Q', suit: 'd' }
    ];
    
    // 构建完整的 mock deck
    // 发牌顺序: 玩家1卡1, 玩家2卡1, 玩家1卡2, 玩家2卡2, [burn], flop3张, [burn], turn, [burn], river
    const mockDeck = [];
    
    // Pre-flop: 按座位顺序发牌
    // 玩家1第一张, 玩家2第一张, 玩家1第二张, 玩家2第二张
    mockDeck.push(player1Hand[0]);
    mockDeck.push(player2Hand[0]);
    mockDeck.push(player1Hand[1]);
    mockDeck.push(player2Hand[1]);
    
    // Flop (3张)
    mockDeck.push(...board.slice(0, 3));
    
    // Turn (1张)
    mockDeck.push(board[3]);
    
    // River (1张)
    mockDeck.push(board[4]);
    
    // 剩余的牌（用于其他情况）
    const usedRanks = new Set(['5', '6', '7', '8', '9', '2', '3', 'K', 'Q']);
    const allRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    for (const rank of allRanks) {
        for (const suit of suits) {
            const cardStr = `${rank}${suit}`;
            const isUsed = mockDeck.some(c => c.rank === rank && c.suit === suit);
            if (!isUsed) {
                mockDeck.push({ rank, suit });
            }
        }
    }
    
    console.log('[MockDeck] Generated straight mock deck for', playerCount, 'players');
    console.log('[MockDeck] Player 1 will get:', player1Hand.map(c => c.rank + c.suit).join(' '));
    console.log('[MockDeck] Board will be:', board.map(c => c.rank + c.suit).join(' '));
    
    return mockDeck;
}

class TournamentTable extends Table {
    constructor(tournamentId, maxPlayers, initialChips, blindConfig = null, mockGame = false) {
        super(tournamentId, `Tournament-${tournamentId}`, initialChips * 100, maxPlayers);
        
        this.tournamentId = tournamentId;
        this.initialChips = initialChips;
        this.mockGame = mockGame;  // Mock 游戏模式
        
        // Override minBet for tournament (based on initial chips, not limit)
        // Default: 1/40 of initial chips = small blind
        this.minBet = Math.floor(initialChips / 40);
        this.baseMinBet = this.minBet;
        
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
     * Override sitPlayer to set fixed initial chips (bypass parent's buy-in validation)
     */
    sitPlayer(player, seatId, amount) {
        // Use initial chips instead of provided amount
        const tournamentChips = this.initialChips;
        
        // Directly create seat without parent's minBuyIn validation
        if (this.seats[seatId]) {
            return;
        }
        
        const Seat = require('./Seat');
        this.seats[seatId] = new Seat(seatId, player, tournamentChips, tournamentChips);

        const firstPlayer =
            Object.values(this.seats).filter((seat) => seat != null).length === 1;

        this.button = firstPlayer ? seatId : this.button;
        
        // Initialize time bank
        this.playerTimeBanks[player.socketId || player.address] = this.timeBankMax;
        
        console.log(`[TournamentTable] Player ${player.address || player.id} sat at seat ${seatId} with ${tournamentChips} chips`);
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
        
        // ============ NFT Achievement Detection ============
        // Auto-detect NFT achievements at showdown
        if (this.wentToShowdown) {
            console.log('[TournamentTable] Checking NFT achievements at showdown...');
            const NFTService = require('../services/NFTService');
            const { SC_NFT_ACHIEVEMENT_EARNED } = require('./actions');
            
            for (const seatId of Object.keys(this.seats)) {
                const seat = this.seats[seatId];
                if (seat && seat.player && seat.hand && !seat.folded) {
                    try {
                        // Check if player's hand qualifies for NFT achievement
                        const achievement = NFTService.checkAchievement(seat.hand, this.board);
                        
                        if (achievement && achievement.type) {
                            console.log(`[TournamentTable] 🎉 NFT Achievement detected for ${seat.player.name || seat.player.id?.substring(0,10)}: ${achievement.type}`);
                            
                            // Store achievement for this player (will be sent via socket by TournamentService)
                            if (!this.pendingAchievements) {
                                this.pendingAchievements = [];
                            }
                            this.pendingAchievements.push({
                                playerAddress: seat.player.id,
                                playerSocketId: seat.player.socketId,
                                achievementType: achievement.type,
                                handType: achievement.name,
                                cards: achievement.cards,
                                description: achievement.description,
                                typeId: achievement.typeId,
                                hand: seat.hand,
                                board: this.board
                            });
                        }
                    } catch (error) {
                        console.error(`[TournamentTable] NFT check error:`, error.message);
                    }
                }
            }
        }
        
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
        
        // Set mock deck for mock game mode (only on first hand)
        if (this.mockGame && this.handsPlayed === 0) {
            const playerCount = this.getRemainingPlayers().length;
            const mockDeck = generateStraightMockDeck(playerCount);
            this.setMockDeck(mockDeck);
            console.log('[TournamentTable] Mock game mode: Setting straight deck for player 1');
        }
        
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

            if (seat && seat.stack <= 0 && !this.isPlayerEliminated(seat.player.socketId || seat.player.id || seat.player.address)) {
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

                console.log(`[TournamentTable] Player ${seat.player.address || seat.player.id} eliminated at position ${eliminationData.finalPosition}, stack=${seat.stack}`);

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
        return this.eliminatedPlayers.some(e => {
            if (!e.player) return false;
            // Match by socketId or address (socketId may be null)
            if (socketId && e.player.socketId === socketId) return true;
            if (socketId && e.player.id === socketId) return true;
            if (e.player.address && e.player.address === socketId) return true;
            return false;
        });
    }
    
    /**
     * Get remaining players (not eliminated)
     */
    getRemainingPlayers() {
        const remaining = [];
        
        for (const seatId of Object.keys(this.seats)) {
            const seat = this.seats[seatId];
            
            if (seat && seat.stack > 0 && !this.isPlayerEliminated(seat.player.socketId || seat.player.id || seat.player.address)) {
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
        const normalizedAddress = (address || '').toLowerCase();
        for (const seatId of Object.keys(this.seats)) {
            const seat = this.seats[seatId];
            const seatAddr = (seat && seat.player && (seat.player.id || seat.player.address) || '').toLowerCase();
            if (seat && seatAddr === normalizedAddress) {
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
