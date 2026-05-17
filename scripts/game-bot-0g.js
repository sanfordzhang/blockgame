/**
 * 0G 游戏机器人 - 自动配合玩家测试
 *
 * 使用方法:
 *   node scripts/game-bot-0g.js
 *
 * 环境变量:
 *   JOIN_TOURNAMENT_ID - 指定加入的锦标赛ID (可选, 不指定则自动创建)
 *
 * 功能:
 *   - 连接服务器 Socket.io
 *   - 加入锦标赛
 *   - 自动操作 (check/call/raise)
 *   - 支持 0G 钱包地址格式 (0x前缀)
 *
 * 配置:
 *   Bot Address: 0x1DaD15c006C3e6dB2e115Bcd8b12A40CE87CD341
 */

const io = require('socket.io-client');

// ============ 0G 机器人配置 ============
const BOT_CONFIG = {
    name: 'Bot_0G_Alice',
    address: process.env.BOT_ADDRESS || '0x1DaD15c006C3e6dB2e115Bcd8b12A40CE87CD341',
    privateKey: process.env.BOT_PRIVATE_KEY || '',
    // 小写地址用于匹配 seat.player
    addressLower: '0x1dad15c006c3e6db2e115bcd8b12a40ce87cd341',
    serverUrl: process.env.BOT_SERVER_URL || 'http://127.0.0.1:7778',
    clientBalance: process.env.BOT_CLIENT_BALANCE || '100000000000000000'
};

// ============ 游戏状态 ============
let gameState = {
    socket: null,
    tournamentId: null,
    mySeat: null,
    isMyTurn: false,
    lastStreet: null,
    lastTurnKey: null,
    lastActionTime: 0,
    gameStarted: false,
    handsPlayed: 0
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function log(msg, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${BOT_CONFIG.name}] ${msg}`);
    if (data) console.log('  ', JSON.stringify(data, null, 2));
}

// ============ Socket 连接 ============
function connectSocket() {
    return new Promise((resolve, reject) => {
        log(`Connecting to ${BOT_CONFIG.serverUrl}...`);

        const socket = io(BOT_CONFIG.serverUrl, {
            transports: ['websocket'],
            query: { walletAddress: BOT_CONFIG.address }
        });

        socket.on('connect', () => {
            log('✅ Socket connected');
            gameState.socket = socket;

            // 发送钱包连接事件
            socket.emit('CS_LOBBY_CONNECT', {
                gameId: 'lobby',
                address: BOT_CONFIG.address,
                userInfo: { name: BOT_CONFIG.name }
            });

            resolve(socket);
        });

        socket.on('connect_error', err => {
            log('❌ Connection failed:', err.message);
            reject(err);
        });

        // ====== 游戏状态监听 ======
        socket.on('SC_GAME_STATE', (state) => {
            handleGameState(state);
        });

        socket.on('tournament_game_state', (state) => {
            handleGameState(state);
        });

        socket.on('game_state', (state) => {
            handleGameState(state);
        });

        // ====== 锦标赛事件 ======
        socket.on('SC_TOURNAMENT_JOIN_SUCCESS', (data) => {
            log('✅ Tournament join success', data);
            if (data.tournamentId) gameState.tournamentId = data.tournamentId;
        });

        socket.on('SC_TOURNAMENT_STARTED', (data) => {
            log('🏆 Tournament STARTED!', data);
            gameState.tournamentId = data.tournamentId || gameState.tournamentId;
            gameState.gameStarted = true;
        });

        // ====== NFT 事件 ======
        socket.on('SC_NFT_ACHIEVEMENT_EARNED', (data) => {
            log('🎉 NFT ACHIEVEMENT EARNED!', data);
        });

        socket.on('SC_NFT_MINTED', (data) => {
            log('🎨 NFT MINTED!', data);
        });

        // ====== 其他事件 ======
        socket.on('SC_BALANCE_SYNCED', (data) => {
            log('💰 Balance synced:', { balance: data.balance, reason: data.reason });
        });

        socket.on('disconnect', () => log('Connection closed'));
    });
}

// ============ 处理游戏状态 ============
function handleGameState(state) {
    if (!state) return;

    // 更新锦标赛ID
    gameState.tournamentId = state.id || gameState.tournamentId;

    log(`State: turn=${state.turn}, pot=${state.pot}, street=${state.street || 'preflop'}`);

    // 调试：打印座位信息
    if (state.seats) {
        const seatCount = Object.keys(state.seats).length;
        log(`Seats: ${seatCount}`);

        for (const [seatId, seat] of Object.entries(state.seats)) {
            if (seat && seat.player) {
                let playerAddr = '';
                if (typeof seat.player === 'string') {
                    playerAddr = seat.player.toLowerCase();
                } else if (seat.player.id) {
                    playerAddr = seat.player.id.toLowerCase();
                }

                const isMe = playerAddr === BOT_CONFIG.addressLower;

                if (isMe) {
                    gameState.mySeat = seatId;

                    // 显示手牌
                    if (seat.hand && Array.isArray(seat.hand)) {
                        const handStr = seat.hand.map(c =>
                            (c.rank || c.Rank) + (c.suit || c.Suit)
                        ).join(' ');
                        log(`🃏 My hand: ${handStr}`);
                    }

                    // 检查是否轮到我
                    const turnSeat = parseInt(seatId);
                    const isMyTurnNow = state.turn === turnSeat;

                    if (isMyTurnNow && !seat.folded) {
                        // 防抖：防止同一轮重复操作
                        const currentTurnKey = `${state.turn}-${state.street || 'preflop'}`;
                        const now = Date.now();

                        if (gameState.lastTurnKey !== currentTurnKey) {
                            gameState.lastTurnKey = currentTurnKey;
                            gameState.lastActionTime = 0;
                        }

                        if (now - gameState.lastActionTime > 2000) {
                            gameState.lastActionTime = now;
                            log(`🎯 MY TURN! Seat: ${seatId}, TurnKey: ${currentTurnKey}`);

                            // 延迟后做决策
                            setTimeout(() => makeDecision(state), 1000);
                        } else {
                            log(`⏳ Cooldown (${Math.floor((now - gameState.lastActionTime) / 1000)}s)`);
                        }
                    }
                }
            }
        }
    }

    // 显示公共牌
    if (state.board && state.board.length > 0) {
        const boardStr = state.board.map(c =>
            (c.rank || c.Rank) + (c.suit || c.Suit)
        ).join(' ');

        if (state.street !== gameState.lastStreet) {
            log(`🎴 Board: ${boardStr}`);
            gameState.lastStreet = state.street;
        }
    }
}

// ============ 决策逻辑 ============
function makeDecision(state) {
    if (!gameState.socket) {
        log('❌ No socket connection');
        return;
    }

    if (!gameState.tournamentId) {
        log('❌ No tournament ID');
        return;
    }

    let action;
    let amount = null;
    const rand = Math.random();

    // 策略: 尽量 check/call，偶尔 raise
    if (!state.callAmount || state.callAmount === 0) {
        if (rand < 0.7) {
            action = 'CHECK';
        } else {
            action = 'RAISE';
            amount = state.bigBlind || 100000;  // 默认大盲注
        }
    } else {
        // 有跟注金额，大部分时候 call
        if (rand < 0.9) {
            action = 'CALL';
        } else {
            action = 'FOLD';
        }
    }

    log(`🤖 Action: ${action}${amount ? ' amount=' + amount : ''} (callAmount: ${state.callAmount || 0})`);

    // 发送操作事件
    const eventName = `CS_TOURNAMENT_${action}`;
    const payload = {
        tournamentId: gameState.tournamentId
    };

    if (amount) {
        payload.amount = amount;
    }

    log(`Emitting: ${eventName}`, payload);
    gameState.socket.emit(eventName, payload);
}

// ============ 加入锦标赛 ============
async function joinTournament(tournamentId) {
    log(`Joining tournament: ${tournamentId}...`);

    gameState.tournamentId = tournamentId;

    // 发送 CS_TOURNAMENT_JOIN
    gameState.socket.emit('CS_TOURNAMENT_JOIN', {
        tournamentId: tournamentId,
        walletAddress: BOT_CONFIG.address,
        clientBalance: BOT_CONFIG.clientBalance
    });
    log('Sent CS_TOURNAMENT_JOIN');

    await sleep(500);

    // 发送 CS_TOURNAMENT_ROOM_JOIN
    gameState.socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
        tournamentId: tournamentId,
        walletAddress: BOT_CONFIG.address
    });
    log('Sent CS_TOURNAMENT_ROOM_JOIN');

    log(`✅ Joined tournament: ${tournamentId}`);
}

// ============ 创建锦标赛 ============
async function createTournament() {
    log('Creating 2-player tournament (configId: 3, mockGame: true)...');

    try {
        const response = await fetch(`${BOT_CONFIG.serverUrl}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                configId: 3,           // 2人锦标赛配置
                walletAddress: BOT_CONFIG.address,
                mockGame: true         // 启用 Mock 模式（顺子牌型）
            })
        });

        const data = await response.json();
        log('Create response:', data);

        if (data.success && data.tournament) {
            const tournamentId = data.tournament.tournamentId || data.tournament.id;
            gameState.tournamentId = tournamentId;

            log(`✅ Tournament created: ${tournamentId}`);

            // 加入锦标赛
            await sleep(500);
            gameState.socket.emit('CS_TOURNAMENT_JOIN', {
                tournamentId: tournamentId,
                walletAddress: BOT_CONFIG.address,
                clientBalance: BOT_CONFIG.clientBalance
            });
            log('Sent CS_TOURNAMENT_JOIN');

            await sleep(500);
            gameState.socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
                tournamentId: tournamentId,
                walletAddress: BOT_CONFIG.address
            });
            log('Sent CS_TOURNAMENT_ROOM_JOIN');

            log(`✅ Joined tournament: ${tournamentId}`);
            log('⏳ Waiting for you to join...');
            log(`🌐 Visit: http://127.0.0.1:3001/tournament`);

        } else {
            log('❌ Create failed:', data);
        }
    } catch (err) {
        log('❌ Create error:', err.message);
    }
}

// ============ 主函数 ============
async function main() {
    console.log('\n======================================================');
    console.log('  🤖 0G Game Bot Starting');
    console.log(`     Name:    ${BOT_CONFIG.name}`);
    console.log(`     Address: ${BOT_CONFIG.address}`);
    console.log(`     Chain:   0G Galileo Testnet (16602)`);
    console.log('======================================================\n');

    try {
        await connectSocket();
        await sleep(2000);

        // 检查是否要加入指定锦标赛
        const joinTournamentId = process.env.JOIN_TOURNAMENT_ID;
        if (joinTournamentId) {
            await joinTournament(joinTournamentId);
        } else {
            await createTournament();
        }

        // 保持运行
        process.on('SIGINT', () => {
            log('👋 Bot shutting down');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Startup error:', error);
        process.exit(1);
    }
}

main();
