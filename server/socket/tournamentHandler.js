const {
    CS_TOURNAMENT_LIST,
    SC_TOURNAMENT_LIST,
    CS_TOURNAMENT_JOIN,
    SC_TOURNAMENT_JOINED,
    SC_TOURNAMENT_JOIN_ERROR,
    CS_TOURNAMENT_CANCEL,
    SC_TOURNAMENT_CANCELLED,
    CS_NFT_CHECK_ACHIEVEMENT,
    SC_NFT_ACHIEVEMENT_EARNED,
    SC_NFT_ACHIEVEMENT_NONE,
    CS_NFT_PREPARE_MINT,
    SC_NFT_MINT_READY,
    SC_NFT_MINT_ERROR,
    CS_NFT_COLLECTION,
    SC_NFT_COLLECTION,
    CS_CHIP_BALANCE,
    SC_CHIP_BALANCE,
    CS_STAKE_INFO,
    SC_STAKE_INFO,
    CS_STAKE_CREATE,
    SC_STAKE_CREATED,
    SC_STAKE_ERROR,
    CS_STAKE_UNSTAKE,
    SC_STAKE_UNSTAKED,
    CS_STAKE_CLAIM_REWARD,
    SC_STAKE_REWARD_CLAIMED,
    CS_DAO_PROPOSALS,
    SC_DAO_PROPOSALS,
    CS_DAO_CREATE_PROPOSAL,
    SC_DAO_PROPOSAL_CREATED,
    CS_DAO_VOTE,
    SC_DAO_VOTED,
    // Tournament game actions
    CS_TOURNAMENT_FOLD,
    CS_TOURNAMENT_CHECK,
    CS_TOURNAMENT_CALL,
    CS_TOURNAMENT_RAISE,
    CS_TOURNAMENT_RECONNECT,
} = require('../pokergame/actions');

const TournamentService = require('../services/TournamentService');
const NFTService = require('../services/NFTService');
const ChipService = require('../services/ChipService');
const DAOService = require('../services/DAOService');

// Track tournament rooms and player mappings (Task 12.5)
const tournamentRooms = new Map(); // tournamentId -> Set of socketIds
const playerTournamentMap = new Map(); // socketId -> tournamentId

/**
 * Initialize tournament and related event handlers
 * @param {Socket} socket - Socket.io socket
 * @param {Server} io - Socket.io server
 */
function initTournamentHandlers(socket, io) {
    // ============ Tournament Events ============
    
    socket.on(CS_TOURNAMENT_LIST, async ({ status, type }) => {
        try {
            const tournaments = await TournamentService.getTournaments({ status, type });
            socket.emit(SC_TOURNAMENT_LIST, { tournaments });
        } catch (error) {
            console.error('[TournamentHandler] List error:', error.message);
            socket.emit(SC_TOURNAMENT_LIST, { tournaments: [], error: error.message });
        }
    });
    
    socket.on(CS_TOURNAMENT_JOIN, async ({ tournamentId, walletAddress }) => {
        try {
            const result = await TournamentService.joinTournament(tournamentId, walletAddress);
            socket.emit(SC_TOURNAMENT_JOINED, { tournamentId, ...result });
            
            // Broadcast to other players
            socket.broadcast.emit('SC_TOURNAMENT_PLAYER_JOINED', {
                tournamentId,
                playerAddress: walletAddress,
                playerCount: result.playerCount
            });
        } catch (error) {
            console.error('[TournamentHandler] Join error:', error.message);
            socket.emit(SC_TOURNAMENT_JOIN_ERROR, { tournamentId, error: error.message });
        }
    });
    
    socket.on(CS_TOURNAMENT_CANCEL, async ({ tournamentId, walletAddress }) => {
        try {
            const result = await TournamentService.cancelJoin(tournamentId, walletAddress);
            socket.emit(SC_TOURNAMENT_CANCELLED, { tournamentId, ...result });
            
            // Broadcast to other players
            socket.broadcast.emit('SC_TOURNAMENT_PLAYER_LEFT', {
                tournamentId,
                playerAddress: walletAddress
            });
        } catch (error) {
            console.error('[TournamentHandler] Cancel error:', error.message);
        }
    });
    
    // ============ NFT Events ============
    
    socket.on(CS_NFT_CHECK_ACHIEVEMENT, async ({ handCards, communityCards, walletAddress, gameId }) => {
        try {
            const result = await NFTService.checkAchievement(handCards, communityCards);
            
            if (result.hasAchievement) {
                socket.emit(SC_NFT_ACHIEVEMENT_EARNED, {
                    achievementType: result.achievementType,
                    handType: result.handType,
                    cards: result.cards,
                    gameId
                });
            } else {
                socket.emit(SC_NFT_ACHIEVEMENT_NONE, { gameId });
            }
        } catch (error) {
            console.error('[NFTHandler] Check achievement error:', error.message);
        }
    });
    
    socket.on(CS_NFT_PREPARE_MINT, async ({ walletAddress, achievementType, gameSessionId, handData }) => {
        try {
            const result = await NFTService.prepareMint(walletAddress, {
                achievementType,
                gameSessionId,
                handData
            });
            
            socket.emit(SC_NFT_MINT_READY, result);
        } catch (error) {
            console.error('[NFTHandler] Prepare mint error:', error.message);
            socket.emit(SC_NFT_MINT_ERROR, { error: error.message });
        }
    });
    
    socket.on(CS_NFT_COLLECTION, async ({ walletAddress }) => {
        try {
            const nfts = await NFTService.getPlayerNFTs(walletAddress);
            socket.emit(SC_NFT_COLLECTION, { nfts });
        } catch (error) {
            console.error('[NFTHandler] Get collection error:', error.message);
        }
    });
    
    // ============ CHIP Token Events ============
    
    socket.on(CS_CHIP_BALANCE, async ({ walletAddress }) => {
        try {
            const info = await ChipService.getUserInfo(walletAddress);
            socket.emit(SC_CHIP_BALANCE, info);
        } catch (error) {
            console.error('[ChipHandler] Balance error:', error.message);
        }
    });
    
    // ============ Staking Events ============
    
    socket.on(CS_STAKE_INFO, async ({ walletAddress }) => {
        try {
            const stakeInfo = await ChipService.getStakeInfo(walletAddress);
            socket.emit(SC_STAKE_INFO, stakeInfo);
        } catch (error) {
            console.error('[StakeHandler] Info error:', error.message);
        }
    });
    
    socket.on(CS_STAKE_CREATE, async ({ walletAddress, amount, lockDays }) => {
        try {
            const result = await ChipService.createStake(walletAddress, amount, lockDays);
            socket.emit(SC_STAKE_CREATED, result);
        } catch (error) {
            console.error('[StakeHandler] Create error:', error.message);
            socket.emit(SC_STAKE_ERROR, { error: error.message });
        }
    });
    
    socket.on(CS_STAKE_UNSTAKE, async ({ walletAddress, stakeId }) => {
        try {
            const result = await ChipService.unstake(walletAddress, stakeId);
            socket.emit(SC_STAKE_UNSTAKED, result);
        } catch (error) {
            console.error('[StakeHandler] Unstake error:', error.message);
        }
    });
    
    socket.on(CS_STAKE_CLAIM_REWARD, async ({ walletAddress, stakeId }) => {
        try {
            const result = await ChipService.claimStakeReward(walletAddress, stakeId);
            socket.emit(SC_STAKE_REWARD_CLAIMED, result);
        } catch (error) {
            console.error('[StakeHandler] Claim reward error:', error.message);
        }
    });
    
    // ============ DAO Events ============
    
    socket.on(CS_DAO_PROPOSALS, async ({ state }) => {
        try {
            const result = await DAOService.getProposals({ state });
            socket.emit(SC_DAO_PROPOSALS, result);
        } catch (error) {
            console.error('[DAOHandler] Proposals error:', error.message);
        }
    });
    
    socket.on(CS_DAO_CREATE_PROPOSAL, async ({ walletAddress, title, description, targetContract, callData }) => {
        try {
            const result = await DAOService.createProposal(walletAddress, {
                title,
                description,
                targetContract,
                callData
            });
            socket.emit(SC_DAO_PROPOSAL_CREATED, result);
            
            // Broadcast to all users
            io.emit('SC_DAO_NEW_PROPOSAL', result);
        } catch (error) {
            console.error('[DAOHandler] Create proposal error:', error.message);
        }
    });
    
    socket.on(CS_DAO_VOTE, async ({ walletAddress, proposalId, support }) => {
        try {
            const result = await DAOService.castVote(walletAddress, proposalId, support);
            socket.emit(SC_DAO_VOTED, { proposalId, ...result });
            
            // Broadcast vote update
            io.emit('SC_DAO_VOTE_CAST', {
                proposalId,
                voter: walletAddress,
                support
            });
        } catch (error) {
            console.error('[DAOHandler] Vote error:', error.message);
        }
    });
    
    // ============ Tournament Room Management (Task 12.5) ============
    
    /**
     * Join a tournament room for real-time updates
     */
    socket.on('CS_TOURNAMENT_ROOM_JOIN', async ({ tournamentId, walletAddress }) => {
        try {
            // Join the socket.io room
            socket.join(`tournament:${tournamentId}`);
            
            // Track player in room
            if (!tournamentRooms.has(tournamentId)) {
                tournamentRooms.set(tournamentId, new Set());
            }
            tournamentRooms.get(tournamentId).add(socket.id);
            playerTournamentMap.set(socket.id, tournamentId);
            
            console.log(`[TournamentHandler] Player ${walletAddress} joined room for tournament ${tournamentId}`);
            
            // Get current tournament state
            const tournament = await TournamentService.getTournament(tournamentId);
            
            socket.emit('SC_TOURNAMENT_ROOM_JOINED', {
                tournamentId,
                success: true,
                tournament: tournament,
                playerCount: tournamentRooms.get(tournamentId).size
            });
            
            // Notify other players in the room
            socket.to(`tournament:${tournamentId}`).emit('SC_TOURNAMENT_PLAYER_JOINED_ROOM', {
                tournamentId,
                playerAddress: walletAddress,
                playerCount: tournamentRooms.get(tournamentId).size
            });
            
        } catch (error) {
            console.error('[TournamentHandler] Room join error:', error.message);
            socket.emit('SC_TOURNAMENT_ROOM_ERROR', { error: error.message });
        }
    });
    
    /**
     * Leave tournament room
     */
    socket.on('CS_TOURNAMENT_ROOM_LEAVE', ({ tournamentId }) => {
        leaveTournamentRoom(socket, tournamentId);
    });
    
    /**
     * Handle tournament game actions (Task 12.6)
     */
    socket.on(CS_TOURNAMENT_FOLD, ({ tournamentId }) => {
        handleTournamentGameAction(socket, io, tournamentId, 'fold');
    });
    
    socket.on(CS_TOURNAMENT_CHECK, ({ tournamentId }) => {
        handleTournamentGameAction(socket, io, tournamentId, 'check');
    });
    
    socket.on(CS_TOURNAMENT_CALL, ({ tournamentId }) => {
        handleTournamentGameAction(socket, io, tournamentId, 'call');
    });
    
    socket.on(CS_TOURNAMENT_RAISE, ({ tournamentId, amount }) => {
        handleTournamentGameAction(socket, io, tournamentId, 'raise', amount);
    });
    
    /**
     * Handle reconnection to active tournament
     */
    socket.on(CS_TOURNAMENT_RECONNECT, async ({ tournamentId, walletAddress }) => {
        try {
            const table = TournamentService.activeTables?.get(tournamentId);
            
            if (!table) {
                socket.emit('SC_TOURNAMENT_RECONNECT_FAILED', { 
                    error: 'Tournament not active or not found' 
                });
                return;
            }
            
            // Find player in table
            const playerSeat = Object.values(table.seats).find(
                seat => seat && seat.player && seat.player.id === walletAddress
            );
            
            if (!playerSeat) {
                socket.emit('SC_TOURNAMENT_RECONNECT_FAILED', { 
                    error: 'Player not found in tournament' 
                });
                return;
            }
            
            // Update socket ID for player
            playerSeat.player.socketId = socket.id;
            
            // Join room
            socket.join(`tournament:${tournamentId}`);
            if (!tournamentRooms.has(tournamentId)) {
                tournamentRooms.set(tournamentId, new Set());
            }
            tournamentRooms.get(tournamentId).add(socket.id);
            playerTournamentMap.set(socket.id, tournamentId);
            
            // Send current game state
            socket.emit('SC_TOURNAMENT_RECONNECTED', {
                tournamentId,
                seatId: playerSeat.id,
                stack: playerSeat.stack,
                hand: playerSeat.hand
            });
            
            // Broadcast full table state
            TournamentService.broadcastTableState?.(tournamentId, table);
            
            console.log(`[TournamentHandler] Player ${walletAddress} reconnected to tournament ${tournamentId}`);
            
        } catch (error) {
            console.error('[TournamentHandler] Reconnect error:', error.message);
            socket.emit('SC_TOURNAMENT_RECONNECT_FAILED', { error: error.message });
        }
    });
    
    // Handle disconnect - clean up tournament rooms
    socket.on('disconnect', () => {
        const tournamentId = playerTournamentMap.get(socket.id);
        if (tournamentId) {
            leaveTournamentRoom(socket, tournamentId);
            
            // Handle player disconnect in active game
            TournamentService.handleDisconnect?.(socket.id);
        }
    });
}

/**
 * Leave tournament room helper
 */
function leaveTournamentRoom(socket, tournamentId) {
    socket.leave(`tournament:${tournamentId}`);
    
    if (tournamentRooms.has(tournamentId)) {
        tournamentRooms.get(tournamentId).delete(socket.id);
        
        // Notify others
        socket.to(`tournament:${tournamentId}`).emit('SC_TOURNAMENT_PLAYER_LEFT_ROOM', {
            tournamentId,
            playerCount: tournamentRooms.get(tournamentId).size
        });
        
        // Clean up empty rooms
        if (tournamentRooms.get(tournamentId).size === 0) {
            tournamentRooms.delete(tournamentId);
        }
    }
    
    playerTournamentMap.delete(socket.id);
}

/**
 * Handle tournament game action
 */
function handleTournamentGameAction(socket, io, tournamentId, actionType, amount = 0) {
    try {
        const result = TournamentService.handleGameAction(tournamentId, socket.id, {
            type: actionType,
            amount
        });
        
        if (result && result.message) {
            // Broadcast action message
            io.to(`tournament:${tournamentId}`).emit('tournament_action', {
                tournamentId,
                action: actionType,
                message: result.message
            });
        }
        
        // Broadcast updated table state (Task 12.6)
        const table = TournamentService.activeTables?.get(tournamentId);
        if (table) {
            TournamentService.broadcastTableState?.(tournamentId, table);
        }
        
    } catch (error) {
        console.error('[TournamentHandler] Game action error:', error.message);
        socket.emit('SC_TOURNAMENT_ACTION_ERROR', { 
            tournamentId, 
            action: actionType, 
            error: error.message 
        });
    }
}

module.exports = { initTournamentHandlers };
