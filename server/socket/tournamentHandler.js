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
const { checkAITurn, executeAIAction } = require('./index');

// Track tournament rooms and player mappings (Task 12.5)
const tournamentRooms = new Map(); // tournamentId -> Set of socketIds
const playerTournamentMap = new Map(); // socketId -> tournamentId
const socketWalletMap = new Map(); // socketId -> walletAddress (新增：存储socket到钱包地址的映射)

/**
 * Initialize tournament and related event handlers
 * @param {Socket} socket - Socket.io socket
 * @param {Server} io - Socket.io server
 */
function initTournamentHandlers(socket, io) {
    // Set Socket.IO instance on TournamentService. If the singleton has not
    // initialized yet, TournamentService caches it for later use.
    TournamentService.setSocketIO(io);
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
    
    socket.on(CS_TOURNAMENT_JOIN, async ({ tournamentId, walletAddress, clientBalance = 0 }) => {
        try {
            // 存储钱包地址映射，用于后续游戏操作
            socketWalletMap.set(socket.id, walletAddress);
            console.log(`[TournamentHandler] Player ${walletAddress?.substring(0, 10)}... joining tournament ${tournamentId}, socketId=${socket.id}`);
            
            const result = await TournamentService.joinTournament(tournamentId, walletAddress, socket.id, clientBalance);
            socket.emit(SC_TOURNAMENT_JOINED, { tournamentId, ...result });
            
            // 存储玩家-锦标赛映射
            playerTournamentMap.set(socket.id, tournamentId);
            
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
            
            if (result && result.type) {
                socket.emit(SC_NFT_ACHIEVEMENT_EARNED, {
                    playerAddress: walletAddress,
                    achievementType: result.type,
                    handType: result.name,
                    cards: result.cards,
                    description: result.description,
                    typeId: result.typeId,
                    gameId
                });
            } else {
                socket.emit(SC_NFT_ACHIEVEMENT_NONE, { gameId });
            }
        } catch (error) {
            console.error('[NFTHandler] Check achievement error:', error.message);
        }
    });
    
    socket.on(CS_NFT_PREPARE_MINT, async ({ walletAddress, achievementType, gameSessionId, handData, screenshot }) => {
        const timeoutMs = parseInt(process.env.NFT_PREPARE_MINT_SOCKET_TIMEOUT_MS || '90000', 10);
        const startedAt = Date.now();
        const screenshotLength = typeof screenshot === 'string' ? screenshot.length : 0;
        console.log('[NFTHandler] CS_NFT_PREPARE_MINT received:', {
            socketId: socket.id,
            wallet: walletAddress?.substring(0, 10),
            achievementType,
            gameSessionId,
            cards: handData?.cards?.length || 0,
            screenshotLength
        });

        const withTimeout = (promise, ms) => {
            let timeoutId;
            return Promise.race([
                Promise.resolve(promise).finally(() => clearTimeout(timeoutId)),
                new Promise((_, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`prepareMint timed out after ${ms}ms`)), ms);
                })
            ]);
        };

        try {
            const result = await withTimeout(
                NFTService.prepareMint(walletAddress, {
                    achievementType,
                    gameSessionId,
                    handData,
                    screenshot
                }),
                timeoutMs
            );
            
            console.log('[NFTHandler] SC_NFT_MINT_READY sending:', {
                socketId: socket.id,
                wallet: walletAddress?.substring(0, 10),
                success: result?.success,
                chain: result?.chain,
                txHash: result?.txHash,
                tokenId: result?.tokenId,
                elapsedMs: Date.now() - startedAt
            });
            socket.emit(SC_NFT_MINT_READY, result);
        } catch (error) {
            console.error('[NFTHandler] Prepare mint error:', {
                socketId: socket.id,
                wallet: walletAddress?.substring(0, 10),
                achievementType,
                gameSessionId,
                elapsedMs: Date.now() - startedAt,
                error: error.message
            });
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
            // Normalize address for case-insensitive comparison
            const normalizedWallet = walletAddress?.toLowerCase();
            console.log(`[TournamentHandler] >>> CS_TOURNAMENT_ROOM_JOIN: tournamentId=${tournamentId}, wallet=${normalizedWallet?.substring(0, 10)}..., socketId=${socket.id}`);
            
            // 存储socket到钱包地址的映射
            socketWalletMap.set(socket.id, normalizedWallet);
            
            // 也存储到 socket 对象上，以便后续广播时可以获取
            socket.walletAddress = normalizedWallet;
            
            // Join the socket.io room
            socket.join(`tournament:${tournamentId}`);
            console.log(`[TournamentHandler] Socket ${socket.id} joined room tournament:${tournamentId}`);
            
            // Track player in room
            if (!tournamentRooms.has(tournamentId)) {
                tournamentRooms.set(tournamentId, new Set());
            }
            tournamentRooms.get(tournamentId).add(socket.id);
            playerTournamentMap.set(socket.id, tournamentId);
            
            // Get current tournament state
            const tournament = await TournamentService.getTournament(tournamentId);
            
            console.log(`[TournamentHandler] Tournament status: ${tournament?.status}, players: ${tournament?.players?.length}`);
            if (tournament?.players) {
                tournament.players.forEach((p, i) => {
                    console.log(`[TournamentHandler]   DB player[${i}]: address=${p.address?.substring(0, 10)}... (lowercase: ${p.address?.toLowerCase()?.substring(0, 10)}...)`);
                });
            }
            console.log(`[TournamentHandler] Looking for normalizedWallet: ${normalizedWallet?.substring(0, 10)}...`);
            
            // Update player's socketId in tournament if they're already joined (case-insensitive)
            if (tournament && tournament.players) {
                const playerIndex = tournament.players.findIndex(p => p.address?.toLowerCase() === normalizedWallet);
                console.log(`[TournamentHandler] Player index found: ${playerIndex}`);
                if (playerIndex !== -1) {
                    tournament.players[playerIndex].socketId = socket.id;
                    await tournament.save();
                    console.log(`[TournamentHandler] Updated socketId for player ${normalizedWallet?.substring(0, 10)}...`);
                }
            }
            
            // 更新 active table 中的 socketId (case-insensitive)
            const table = TournamentService.activeTables?.get(tournamentId);
            console.log(`[TournamentHandler] Active table exists: ${!!table}`);
            if (table) {
                console.log(`[TournamentHandler] Table turn: ${table.turn}, handOver: ${table.handOver}`);
                for (let i = 1; i <= table.maxPlayers; i++) {
                    const seat = table.seats[i];
                    if (seat && seat.player) {
                        console.log(`[TournamentHandler]   Table seat[${i}]: id=${seat.player.id?.substring(0, 10)}... (lowercase: ${seat.player.id?.toLowerCase()?.substring(0, 10)}...), socketId=${seat.player.socketId}`);
                        if (seat.player.id?.toLowerCase() === normalizedWallet) {
                            seat.player.socketId = socket.id;
                            console.log(`[TournamentHandler] >>> MATCH! Updated socketId in table for seat ${i}: ${socket.id}`);
                        }
                    }
                }
            }
            
            // Check if player is already in this tournament (case-insensitive)
            const existingPlayer = tournament?.players?.find(p => p.address?.toLowerCase() === normalizedWallet);
            const isInProgress = tournament && tournament.status === 'IN_PROGRESS';
            console.log(`[TournamentHandler] existingPlayer=${!!existingPlayer}, isInProgress=${isInProgress}, willSendState=${isInProgress && !!existingPlayer}`);
            
            socket.emit('SC_TOURNAMENT_ROOM_JOINED', {
                tournamentId,
                success: true,
                tournament: tournament,
                playerCount: tournamentRooms.get(tournamentId).size,
                isReconnecting: isInProgress && existingPlayer
            });
            
            // Notify other players in the room
            socket.to(`tournament:${tournamentId}`).emit('SC_TOURNAMENT_PLAYER_JOINED_ROOM', {
                tournamentId,
                playerAddress: walletAddress,
                playerCount: tournamentRooms.get(tournamentId).size
            });
            
            // If tournament is in progress and player is already joined, send game state (reconnect or late join)
            if (isInProgress && existingPlayer) {
                if (table) {
                    console.log(`[TournamentHandler] >>> Sending game state to player ${normalizedWallet?.substring(0, 10)}... (reconnect/late join)`);
                    
                    // Check if hand has started (turn is not null)
                    if (table.turn === null || table.turn === undefined) {
                        console.log(`[TournamentHandler] Hand not started yet (turn=${table.turn}), scheduling retry in 2500ms...`);
                        // Hand hasn't started yet, wait and retry
                        setTimeout(() => {
                            console.log(`[TournamentHandler] >>> Retry: sending game state to player ${normalizedWallet?.substring(0, 10)}...`);
                            sendGameStateToPlayer(socket, table, tournamentId, normalizedWallet);
                        }, 2500); // Wait for hand to start
                    } else {
                        console.log(`[TournamentHandler] Hand already started (turn=${table.turn}), sending immediately`);
                        // Hand already started, send immediately
                        sendGameStateToPlayer(socket, table, tournamentId, normalizedWallet);
                    }
                } else {
                    console.warn(`[TournamentHandler] >>> WARNING: No active table found for tournament ${tournamentId}!`);
                }
            } else if (isInProgress && !existingPlayer) {
                console.warn(`[TournamentHandler] >>> WARNING: Tournament in progress but player NOT found in player list. Will NOT send game state!`);
            }
            
        } catch (error) {
            console.error('[TournamentHandler] Room join error:', error.message);
            socket.emit('SC_TOURNAMENT_ROOM_ERROR', { error: error.message });
        }
    });
    
    /**
     * Leave tournament room - player actively leaves the tournament
     */
    socket.on('CS_TOURNAMENT_ROOM_LEAVE', ({ tournamentId }) => {
        const walletAddress = socketWalletMap.get(socket.id);
        console.log(`[TournamentHandler] Player leaving tournament: tournamentId=${tournamentId}, wallet=${walletAddress?.substring(0, 10)}...`);
        
        socket.explicitTournamentLeave = true;

        // Keep socket reference before leaving room (to send end event later)
        const leavingSocket = socket;
        
        leaveTournamentRoom(socket, tournamentId);
        
        // Handle player leaving in active game (same as disconnect)
        if (tournamentId) {
            console.log(`[TournamentHandler] Calling TournamentService.handleDisconnect for tournament ${tournamentId}`);
            const result = TournamentService.handleDisconnect?.(socket.id, walletAddress);
            console.log(`[TournamentHandler] handleDisconnect result:`, result);
            
            // If tournament ended due to this player leaving, send end event directly to them
            if (result && result.tournamentEnded) {
                console.log(`[TournamentHandler] Tournament ended by player leaving, sending end event to leaving player`);
                // The leaving player will receive SC_TOURNAMENT_ENDED from _handleTournamentEnd
                // But since they left the room, we need to send it directly
                // Note: _handleTournamentEnd handles this already via the eliminated players loop
            }
        }
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
    
    // Handle disconnect - clean up socket room state only.
    // A browser refresh, wallet popup, network blip, or socket reconnect must not
    // count as a tournament forfeit. Explicit leave is handled by
    // CS_TOURNAMENT_ROOM_LEAVE above.
    socket.on('disconnect', () => {
        const tournamentId = playerTournamentMap.get(socket.id);
        const walletAddress = socketWalletMap.get(socket.id);

        console.log(`[TournamentHandler] Disconnect event: socketId=${socket.id}, tournamentId=${tournamentId}, wallet=${walletAddress?.substring(0, 10)}...`);

        // 清理映射
        socketWalletMap.delete(socket.id);
        playerTournamentMap.delete(socket.id);

        if (tournamentId) {
            leaveTournamentRoom(socket, tournamentId);
            console.log(`[TournamentHandler] Transient socket disconnect for tournament ${tournamentId}; keeping player seated for reconnect`);
        }

        console.log(`[TournamentHandler] Socket disconnected: ${socket.id}, wallet: ${walletAddress?.substring(0, 10)}...`);
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
        // 获取钱包地址
        const walletAddress = socketWalletMap.get(socket.id);
        console.log(`[TournamentHandler] handleTournamentGameAction: tournamentId=${tournamentId}, socketId=${socket.id}, wallet=${walletAddress?.substring(0, 10)}..., action=${actionType}, amount=${amount}`);
        
        // Get the table and find the player
        const table = TournamentService.activeTables?.get(tournamentId);
        if (!table) {
            console.error(`[TournamentHandler] No active table for tournament ${tournamentId}`);
            throw new Error('Tournament not active');
        }
        
        // Debug: show all seats and their socketIds
        console.log(`[TournamentHandler] Table seats:`);
        for (let i = 1; i <= table.maxPlayers; i++) {
            const seat = table.seats[i];
            if (seat && seat.player) {
                console.log(`  Seat ${i}: player=${seat.player.id?.substring(0, 10)}..., socketId=${seat.player.socketId}, turn=${seat.turn}, stack=${seat.stack}`);
            }
        }
        
        // Find player by wallet address (优先) or socket ID
        let playerSeat = null;
        let playerSocketId = socket.id;
        
        for (let i = 1; i <= table.maxPlayers; i++) {
            const seat = table.seats[i];
            if (seat && seat.player) {
                // 优先通过钱包地址匹配
                if (walletAddress && seat.player.id === walletAddress) {
                    playerSeat = seat;
                    // 确保socketId是最新的
                    seat.player.socketId = socket.id;
                    playerSocketId = socket.id;
                    console.log(`[TournamentHandler] Found player by wallet address at seat ${i}`);
                    break;
                }
                // 备用：通过socketId匹配
                if (seat.player.socketId === socket.id) {
                    playerSeat = seat;
                    console.log(`[TournamentHandler] Found player by socketId match at seat ${i}`);
                    break;
                }
            }
        }
        
        if (!playerSeat) {
            console.error(`[TournamentHandler] Player not found for socket ${socket.id}, wallet ${walletAddress}`);
            // Try to find by socketId in the room
            const roomSockets = io.sockets.adapter.rooms.get(`tournament:${tournamentId}`);
            console.log(`[TournamentHandler] Room sockets: ${roomSockets ? Array.from(roomSockets) : 'none'}`);
            throw new Error('Player not found in tournament');
        }
        
        const result = TournamentService.handleGameAction(tournamentId, playerSocketId, {
            type: actionType,
            amount
        }, walletAddress);  // 传递钱包地址
        
        console.log(`[TournamentHandler] Action result:`, result);
        
        if (result && result.message) {
            // Broadcast action message
            io.to(`tournament:${tournamentId}`).emit('tournament_action', {
                tournamentId,
                action: actionType,
                message: result.message
            });
        }
        
        // Note: TournamentService.handleGameAction (test mode) already broadcasts game state.
        // We do NOT broadcast again here to avoid double-broadcast.
        // Only broadcast if tournamentServiceInstance is active (non-test mode, which uses table.broadcastTableState)
        const serviceInstance = TournamentService.getTournamentService?.();
        if (serviceInstance && table && table.isTournamentActive) {
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

/**
 * Send personalized game state to a specific player
 */
function sendGameStateToPlayer(socket, table, tournamentId, walletAddress) {
    console.log(`[TournamentHandler] >>> sendGameStateToPlayer: wallet=${walletAddress?.substring(0, 10)}..., table.turn=${table.turn}, handOver=${table.handOver}, board=${table.board?.length} cards`);
    
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
    
    // Build seats with personalized cards
    for (let i = 1; i <= table.maxPlayers; i++) {
        const seat = table.seats[i];
        if (seat && seat.player) {
            const normalizedSeatId = seat.player.id?.toLowerCase();
            const normalizedWallet = walletAddress?.toLowerCase();
            const isOwnSeat = normalizedSeatId === normalizedWallet;
            const turnVal = seat.turn !== undefined ? seat.turn : (table.turn === i);
            
            console.log(`[TournamentHandler]   Seat ${i}: seat.turn=${seat.turn}, table.turn=${table.turn}, computedTurn=${turnVal}, player=${seat.player.id?.substring(0, 10)}, isOwn=${isOwnSeat}`);
            
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
                turn: turnVal,
                sittingOut: seat.sittingOut
            };
            
            // Show own cards or cards at showdown (case-insensitive comparison)
            if (seat.hand) {
                if (isOwnSeat) {
                    gameState.seats[i].hand = seat.hand;
                } else if (!seat.folded && table.wentToShowdown) {
                    gameState.seats[i].hand = seat.hand;
                } else {
                    gameState.seats[i].hand = null;
                }
            }
        }
    }
    
    socket.emit('tournament_game_state', gameState);
    console.log(`[TournamentHandler] >>> EMIT tournament_game_state to socket ${socket.id}, player ${walletAddress?.substring(0, 10)}..., turn=${gameState.turn}, seatsCount=${Object.keys(gameState.seats).length}`);
}

module.exports = { initTournamentHandlers };
