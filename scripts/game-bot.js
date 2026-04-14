/**
 * 游戏机器人 - 自动配合玩家测试
 * 
 * 使用方法: 
 *   node scripts/game-bot.js
 * 
 * 机器人会自动：
 * 1. 创建2人锦标赛
 * 2. 加入并等待另一玩家
 * 3. 游戏开始后自动操作（check, call, raise）
 */

const io = require('socket.io-client');

// 机器人配置
const BOT_CONFIG = {
    name: 'Bot_Alice',
    address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
    addressLower: 'tx27ljdqk64d4nvbxkt1taayx5dpf4jpl4',  // 小写用于匹配
    serverUrl: 'http://43.163.114.175:7778'
};

// 游戏状态
let gameState = {
    socket: null,
    tournamentId: null,
    mySeat: null,
    isMyTurn: false,
    lastStreet: null,
    lastTurnKey: null,  // 用于跟踪轮次变化
    lastActionTime: 0,
    gameStarted: false
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function log(msg, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [${BOT_CONFIG.name}] ${msg}`);
    if (data) console.log('  ', JSON.stringify(data, null, 2));
}

// 连接Socket
function connectSocket() {
    return new Promise((resolve, reject) => {
        log('连接服务器...');
        
        const socket = io(BOT_CONFIG.serverUrl, {
            transports: ['websocket'],
            query: { walletAddress: BOT_CONFIG.address }
        });
        
        socket.on('connect', () => {
            log('✅ Socket连接成功');
            gameState.socket = socket;
            
            // 发送钱包连接
            socket.emit('CS_LOBBY_CONNECT', {
                gameId: 'lobby',
                address: BOT_CONFIG.address,
                userInfo: { name: BOT_CONFIG.name }
            });
            
            resolve(socket);
        });
        
        socket.on('connect_error', (err) => {
            log('❌ 连接失败:', err.message);
            reject(err);
        });
        
        // 游戏状态 - 监听多个可能的事件名
        socket.on('SC_GAME_STATE', (state) => {
            log('收到 SC_GAME_STATE');
            handleGameState(state);
        });
        
        socket.on('tournament_game_state', (state) => {
            log('收到 tournament_game_state');
            handleGameState(state);
        });
        
        socket.on('game_state', (state) => {
            log('收到 game_state');
            handleGameState(state);
        });
        
        // 锦标赛事件
        socket.on('SC_TOURNAMENT_JOIN_SUCCESS', (data) => {
            log('✅ 加入锦标赛成功', data);
            gameState.tournamentId = data.tournamentId;
        });
        
        socket.on('SC_TOURNAMENT_STARTED', (data) => {
            log('🏆 锦标赛开始!', data);
            gameState.tournamentId = data.tournamentId || gameState.tournamentId;
            gameState.gameStarted = true;
        });
        
        // NFT事件
        socket.on('SC_NFT_ACHIEVEMENT_EARNED', (data) => {
            log('🎉 NFT成就达成!', data);
        });
        
        socket.on('disconnect', () => log('连接断开'));
    });
}

// 处理游戏状态
function handleGameState(state) {
    if (!state) {
        log('状态为空');
        return;
    }
    
    gameState.tournamentId = state.id || gameState.tournamentId;
    
    log(`游戏状态: turn=${state.turn}, pot=${state.pot}, street=${state.street}`);
    
    // 调试：打印完整座位信息
    if (state.seats) {
        log(`座位数量: ${Object.keys(state.seats).length}`);
        
        // 检查座位格式
        const sampleSeat = Object.entries(state.seats)[0];
        if (sampleSeat) {
            log(`座位样例: seatId=${sampleSeat[0]}, seat=`, JSON.stringify(sampleSeat[1]).substring(0, 100));
        }
    }
    
    // 查找我的座位
    if (state.seats) {
        for (const [seatId, seat] of Object.entries(state.seats)) {
            // 调试：打印每个座位
            if (seat) {
                // player 可能是对象 {id: "address", name: "...", socketId: "..."} 或字符串
                let playerAddr = '';
                if (seat.player) {
                    if (typeof seat.player === 'string') {
                        playerAddr = seat.player.toLowerCase();
                    } else if (seat.player.id) {
                        playerAddr = seat.player.id.toLowerCase();
                    }
                }
                log(`座位${seatId}: player=${playerAddr.substring(0, 10)}..., turn=${seat.turn}, myAddr=${BOT_CONFIG.addressLower.substring(0, 10)}...`);
                
                // 检查是否匹配
                const isMatch = playerAddr === BOT_CONFIG.addressLower;
                
                if (isMatch) {
                    gameState.mySeat = seatId;
                    log(`✅ 找到我的座位: ${seatId}`);
                    
                    // 显示手牌
                    if (seat.hand && Array.isArray(seat.hand)) {
                        const handStr = seat.hand.map(c => (c.rank || c.Rank) + (c.suit || c.Suit)).join(' ');
                        log(`🃏 我的手牌: ${handStr}`);
                    }
                    
                    // 检查是否轮到我
                    const turnSeat = parseInt(seatId);
                    const isMyTurnNow = state.turn === turnSeat;
                    
                    log(`检查轮次: state.turn=${state.turn}(${typeof state.turn}), seatId=${seatId}(${typeof seatId}), turnSeat=${turnSeat}, isMyTurnNow=${isMyTurnNow}`);
                    
                    if (isMyTurnNow && !seat.folded) {
                        // 防止同一轮次重复操作
                        const currentTurnKey = `${state.turn}-${state.street || 'preflop'}`;
                        const now = Date.now();
                        
                        // 如果轮次变化了，重置防抖
                        if (gameState.lastTurnKey !== currentTurnKey) {
                            gameState.lastTurnKey = currentTurnKey;
                            gameState.lastActionTime = 0; // 重置，允许立即操作
                        }
                        
                        if (now - gameState.lastActionTime > 2000) {
                            gameState.lastActionTime = now;
                            log(`🎯 轮到我了！座位: ${seatId}, turnKey: ${currentTurnKey}`);
                            
                            // 延迟后做决策
                            setTimeout(() => makeDecision(state), 1000);
                        } else {
                            log(`⏳ 等待操作冷却... (${Math.floor((now - gameState.lastActionTime) / 1000)}s)`);
                        }
                    }
                }
            }
        }
    }
    
    // 显示公共牌
    if (state.board && state.board.length > 0) {
        const boardStr = state.board.map(c => c.rank + c.suit).join(' ');
        if (state.street !== gameState.lastStreet) {
            log(`🎴 公共牌: ${boardStr}`);
            gameState.lastStreet = state.street;
        }
    }
}

// 做出决策
function makeDecision(state) {
    if (!gameState.socket) {
        log('❌ Socket未连接');
        return;
    }
    
    if (!gameState.tournamentId) {
        log('❌ 没有锦标赛ID');
        return;
    }
    
    // 简单策略: 尽量check/call，偶尔raise
    let action, amount = null;
    const rand = Math.random();
    
    // 如果没有需要跟注的金额，check
    if (!state.callAmount || state.callAmount === 0) {
        if (rand < 0.7) {
            action = 'CHECK';
        } else {
            action = 'RAISE';
            // 计算 raise 金额：大盲注或最小加注
            amount = state.bigBlind || 100000;  // 默认 100000 (1 TRX)
        }
    } else {
        // 有跟注金额，大部分时候call
        if (rand < 0.85) {
            action = 'CALL';
        } else {
            action = 'FOLD';
        }
    }
    
    log(`🤖 执行操作: ${action}${amount ? ' amount=' + amount : ''} (callAmount: ${state.callAmount || 0})`);
    
    // 发送操作事件
    const eventName = `CS_TOURNAMENT_${action}`;
    const payload = {
        tournamentId: gameState.tournamentId
    };
    
    if (amount) {
        payload.amount = amount;
    }
    
    log(`发送事件: ${eventName}`, payload);
    gameState.socket.emit(eventName, payload);
}

// 加入指定锦标赛
async function joinTournament(tournamentId) {
    log(`加入指定锦标赛: ${tournamentId}...`);
    
    gameState.tournamentId = tournamentId;
    
    // 1. 先发送 JOIN 事件
    gameState.socket.emit('CS_TOURNAMENT_JOIN', {
        tournamentId: tournamentId,
        walletAddress: BOT_CONFIG.address
    });
    log('发送 CS_TOURNAMENT_JOIN');
    
    // 2. 再发送 ROOM_JOIN 事件（更新 socketId）
    await sleep(500);
    gameState.socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
        tournamentId: tournamentId,
        walletAddress: BOT_CONFIG.address
    });
    log('发送 CS_TOURNAMENT_ROOM_JOIN');
    
    log(`✅ 已加入锦标赛: ${tournamentId}`);
}

// 创建2人锦标赛
async function createTournament() {
    log('创建2人锦标赛 (configId: 3, mockGame: true)...');
    
    try {
        const response = await fetch(`${BOT_CONFIG.serverUrl}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                configId: 3,  // 2人锦标赛配置
                walletAddress: BOT_CONFIG.address,
                mockGame: true  // 启用 mock 模式测试 NFT
            })
        });
        
        const data = await response.json();
        log('创建响应:', data);
        
        if (data.success && data.tournament) {
            const tournamentId = data.tournament.tournamentId || data.tournament.id;
            gameState.tournamentId = tournamentId;
            
            log(`✅ 锦标赛创建成功: ${tournamentId}`);
            
            // 加入锦标赛 - 使用两个事件确保正确注册
            await sleep(500);
            
            // 1. 先发送 JOIN 事件
            gameState.socket.emit('CS_TOURNAMENT_JOIN', {
                tournamentId: tournamentId,
                walletAddress: BOT_CONFIG.address
            });
            log('发送 CS_TOURNAMENT_JOIN');
            
            // 2. 再发送 ROOM_JOIN 事件（更新 socketId）
            await sleep(500);
            gameState.socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
                tournamentId: tournamentId,
                walletAddress: BOT_CONFIG.address
            });
            log('发送 CS_TOURNAMENT_ROOM_JOIN');
            
            log(`✅ 已加入锦标赛: ${tournamentId}`);
            log('⏳ 等待你加入...');
            log(`🌐 请访问: http://127.0.0.1:3001/tournament`);
        } else {
            log('❌ 创建失败:', data);
        }
    } catch (err) {
        log('❌ 创建出错:', err.message);
    }
}

// 主函数
async function main() {
    console.log('\n========================================');
    console.log('🤖 游戏机器人启动');
    console.log(`   名称: ${BOT_CONFIG.name}`);
    console.log(`   地址: ${BOT_CONFIG.address}`);
    console.log('========================================\n');
    
    try {
        await connectSocket();
        await sleep(2000);
        
        // 检查是否要加入指定的锦标赛
        const joinTournamentId = process.env.JOIN_TOURNAMENT_ID;
        if (joinTournamentId) {
            await joinTournament(joinTournamentId);
        } else {
            await createTournament();
        }
        
        // 保持运行
        process.on('SIGINT', () => {
            log('👋 机器人退出');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ 启动失败:', error);
        process.exit(1);
    }
}

main();
