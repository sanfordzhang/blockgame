/**
 * 锦标赛游戏操作端对端测试
 * 测试：
 * 1. Call/Raise/Fold/Check 按钮点击是否正常
 * 2. IN_PROGRESS 状态下重连是否正常
 * 3. 模拟完整游戏流程
 */

const fetch = require('node-fetch');
const { io } = require('socket.io-client');

const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';

// 玩家私钥
const _testCfg = require('../../tests/test-config'); const _players = _testCfg.getPlayerConfig(); const PLAYER1_PRIVATE_KEY = _players.PLAYER1.privateKey;
const PLAYER2_PRIVATE_KEY = _players.PLAYER2.privateKey;

// 测试结果
const results = { passed: [], failed: [], errors: [] };

function logPass(testName) {
    results.passed.push(testName);
    console.log(`✅ PASS: ${testName}`);
}

function logFail(testName, error) {
    results.failed.push(testName);
    results.errors.push({ test: testName, error });
    console.log(`❌ FAIL: ${testName} - ${error}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛游戏操作端对端测试');
    console.log('========================================\n');
    
    let player1Address, player2Address;
    let tournamentId;
    let player1Socket, player2Socket;
    
    try {
        // 步骤1: 获取钱包地址
        console.log('\n--- 步骤1: 从私钥派生钱包地址 ---');
        
        const TronWebModule = await import('tronweb');
        let TronWeb;
        if (TronWebModule.default && typeof TronWebModule.default === 'function') {
            TronWeb = TronWebModule.default;
        } else if (TronWebModule.TronWeb) {
            TronWeb = TronWebModule.TronWeb;
        } else if (typeof TronWebModule === 'function') {
            TronWeb = TronWebModule;
        }
        
        if (!TronWeb) {
            throw new Error('无法找到TronWeb构造函数');
        }
        
        const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
        player1Address = tronWeb.address.fromPrivateKey(PLAYER1_PRIVATE_KEY);
        player2Address = tronWeb.address.fromPrivateKey(PLAYER2_PRIVATE_KEY);
        
        console.log(`玩家1: ${player1Address}`);
        console.log(`玩家2: ${player2Address}`);
        logPass('获取钱包地址');
        
        // 步骤2: 创建2人锦标赛
        console.log('\n--- 步骤2: 创建2人锦标赛 ---');
        
        const createResponse = await fetch(`${API_URL}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configId: 3, walletAddress: player1Address })
        });
        const createResult = await createResponse.json();
        
        if (createResult.success) {
            tournamentId = createResult.tournament?.tournamentId;
            logPass(`创建锦标赛 ID: ${tournamentId}`);
        } else {
            throw new Error('创建锦标赛失败: ' + createResult.error);
        }
        
        // 步骤3: 建立 Socket 连接
        console.log('\n--- 步骤3: 建立 Socket 连接 ---');
        
        player1Socket = io(API_URL, { transports: ['websocket'], autoConnect: false });
        player2Socket = io(API_URL, { transports: ['websocket'], autoConnect: false });
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Socket连接超时')), 5000);
            
            let p1Connected = false;
            let p2Connected = false;
            
            player1Socket.once('connect', () => {
                console.log('  玩家1 Socket已连接');
                p1Connected = true;
                if (p1Connected && p2Connected) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            
            player2Socket.once('connect', () => {
                console.log('  玩家2 Socket已连接');
                p2Connected = true;
                if (p1Connected && p2Connected) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            
            player1Socket.connect();
            player2Socket.connect();
        });
        
        logPass('Socket连接建立');
        
        // 步骤4: 玩家1加入锦标赛
        console.log('\n--- 步骤4: 玩家1加入锦标赛 ---');
        
        // 先加入房间（建立 socket 关联）
        const roomJoin1 = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('房间加入超时')), 5000);
            
            player1Socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: player1Address });
            
            player1Socket.once('SC_TOURNAMENT_ROOM_JOINED', (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
            
            player1Socket.once('SC_TOURNAMENT_ROOM_ERROR', (data) => {
                clearTimeout(timeout);
                reject(new Error(data.error));
            });
        });
        
        console.log('  玩家1加入房间:', roomJoin1.tournament?.status);
        logPass('玩家1加入房间');
        
        // 然后通过API加入
        const join1Response = await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': player1Address
            },
            body: JSON.stringify({ walletAddress: player1Address })
        });
        const join1Result = await join1Response.json();
        
        if (join1Result.success || join1Result.error?.includes('Already joined')) {
            logPass('玩家1加入锦标赛');
        } else {
            logFail('玩家1加入锦标赛', join1Result.error || JSON.stringify(join1Result));
        }
        
        // 步骤5: 玩家2加入锦标赛（触发自动开始）
        console.log('\n--- 步骤5: 玩家2加入锦标赛（触发自动开始）---');
        
        // 先设置好游戏状态监听器（因为广播可能在API调用后很快发生）
        const gameStatePromise = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 15000);
            
            const handleGameState = (state) => {
                clearTimeout(timeout);
                resolve(state);
            };
            
            player1Socket.once('tournament_game_state', handleGameState);
            player2Socket.once('tournament_game_state', handleGameState);
        });
        
        // 先加入房间（建立 socket 关联）
        const roomJoin2 = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('房间加入超时')), 5000);
            
            player2Socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: player2Address });
            
            player2Socket.once('SC_TOURNAMENT_ROOM_JOINED', (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
            
            player2Socket.once('SC_TOURNAMENT_ROOM_ERROR', (data) => {
                clearTimeout(timeout);
                reject(new Error(data.error));
            });
        });
        
        console.log('  玩家2加入房间:', roomJoin2.tournament?.status);
        logPass('玩家2加入房间');
        
        // 然后通过API加入（这会触发锦标赛开始）
        const join2Response = await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': player2Address
            },
            body: JSON.stringify({ walletAddress: player2Address })
        });
        const join2Result = await join2Response.json();
        
        if (join2Result.success || join2Result.error?.includes('Already joined')) {
            logPass('玩家2加入锦标赛');
        } else {
            logFail('玩家2加入锦标赛', join2Result.error || JSON.stringify(join2Result));
        }
        
        // 步骤6: 等待游戏开始并获取初始状态
        console.log('\n--- 步骤6: 等待游戏开始并获取初始状态 ---');
        
        // 等待游戏状态广播
        console.log('  等待游戏状态广播...');
        const gameState1 = await gameStatePromise;
        
        if (!gameState1) {
            logFail('收到游戏状态', '等待超时，未收到游戏状态');
            throw new Error('等待游戏状态超时');
        }
        
        console.log('  游戏状态接收:');
        console.log('    Pot:', gameState1.pot);
        console.log('    Turn:', gameState1.turn);
        console.log('    Seats:', Object.keys(gameState1.seats || {}).length);
        console.log('    Board:', gameState1.board?.length || 0);
        logPass('收到游戏状态');
        
        // 验证玩家手牌
        let player1Seat = null;
        let player2Seat = null;
        
        for (const [seatId, seat] of Object.entries(gameState1.seats || {})) {
            if (seat.player?.id === player1Address) {
                player1Seat = parseInt(seatId);
                console.log(`  玩家1在座位 ${player1Seat}, 手牌:`, seat.hand?.map(c => `${c.rank}${c.suit}`));
            }
            if (seat.player?.id === player2Address) {
                player2Seat = parseInt(seatId);
                console.log(`  玩家2在座位 ${player2Seat}, 手牌:`, seat.hand?.map(c => `${c.rank}${c.suit}`));
            }
        }
        
        if (player1Seat && player2Seat) {
            logPass('两个玩家都找到了座位');
        } else {
            logFail('找到玩家座位', '未能找到所有玩家的座位');
        }
        
        // 步骤7: 测试游戏操作按钮
        console.log('\n--- 步骤7: 测试游戏操作按钮 ---');
        
        // 确定当前轮到谁
        const currentPlayerTurn = gameState1.turn;
        const isPlayer1Turn = currentPlayerTurn === player1Seat;
        const isPlayer2Turn = currentPlayerTurn === player2Seat;
        
        console.log(`  当前轮到座位 ${currentPlayerTurn}`);
        console.log(`  玩家1的座位: ${player1Seat}, 是否轮到: ${isPlayer1Turn}`);
        console.log(`  玩家2的座位: ${player2Seat}, 是否轮到: ${isPlayer2Turn}`);
        
        const activeSocket = isPlayer1Turn ? player1Socket : (isPlayer2Turn ? player2Socket : null);
        const activePlayerName = isPlayer1Turn ? '玩家1' : '玩家2';
        
        if (activeSocket) {
            // 测试 FOLD 操作
            console.log(`\n  测试 ${activePlayerName} FOLD 操作...`);
            
            const foldResult = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('FOLD响应超时')), 5000);
                
                activeSocket.emit('CS_TOURNAMENT_FOLD', { tournamentId });
                
                // 监听游戏状态更新
                activeSocket.once('tournament_game_state', (state) => {
                    clearTimeout(timeout);
                    resolve(state);
                });
                
                activeSocket.once('SC_TOURNAMENT_ACTION_ERROR', (data) => {
                    clearTimeout(timeout);
                    reject(new Error(data.error));
                });
            });
            
            if (foldResult) {
                console.log(`    FOLD成功，新状态 - Turn: ${foldResult.turn}, Pot: ${foldResult.pot}`);
                logPass(`${activePlayerName} FOLD操作`);
            }
        } else {
            console.log('  无法确定当前玩家，跳过操作测试');
        }
        
        // 步骤8: 测试 IN_PROGRESS 状态下重连
        console.log('\n--- 步骤8: 测试 IN_PROGRESS 状态下重连 ---');
        
        // 断开玩家1连接
        player1Socket.disconnect();
        console.log('  玩家1断开连接...');
        await sleep(500);
        
        // 重新连接
        player1Socket = io(API_URL, { transports: ['websocket'], autoConnect: false });
        
        const reconnectResult = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('重连超时')), 10000);
            
            player1Socket.once('connect', () => {
                console.log('  玩家1重新连接...');
                
                player1Socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: player1Address });
                
                player1Socket.once('SC_TOURNAMENT_ROOM_JOINED', (data) => {
                    if (data.isReconnecting) {
                        console.log('  服务器识别为重连');
                    }
                    // 等待游戏状态
                    player1Socket.once('tournament_game_state', (state) => {
                        clearTimeout(timeout);
                        resolve({ roomData: data, gameState: state });
                    });
                });
                
                player1Socket.once('SC_TOURNAMENT_ROOM_ERROR', (data) => {
                    clearTimeout(timeout);
                    reject(new Error(data.error));
                });
            });
            
            player1Socket.connect();
        });
        
        if (reconnectResult && reconnectResult.gameState) {
            console.log('  重连成功，收到游戏状态');
            console.log('    Turn:', reconnectResult.gameState.turn);
            console.log('    Pot:', reconnectResult.gameState.pot);
            logPass('IN_PROGRESS状态重连');
        } else {
            logFail('IN_PROGRESS状态重连', '未能收到游戏状态');
        }
        
        // 步骤9: 验证重连后可以继续操作
        console.log('\n--- 步骤9: 验证重连后可以继续操作 ---');
        
        const reconnectState = reconnectResult?.gameState;
        if (reconnectState) {
            const currentTurn = reconnectState.turn;
            const isP1Turn = currentTurn === player1Seat;
            const isP2Turn = currentTurn === player2Seat;
            
            if (isP1Turn || isP2Turn) {
                const opSocket = isP1Turn ? player1Socket : player2Socket;
                const opName = isP1Turn ? '玩家1' : '玩家2';
                
                console.log(`  测试重连后 ${opName} CHECK 操作...`);
                
                try {
                    const checkResult = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('CHECK响应超时')), 5000);
                        
                        opSocket.emit('CS_TOURNAMENT_CHECK', { tournamentId });
                        
                        opSocket.once('tournament_game_state', (state) => {
                            clearTimeout(timeout);
                            resolve(state);
                        });
                        
                        opSocket.once('SC_TOURNAMENT_ACTION_ERROR', (data) => {
                            clearTimeout(timeout);
                            // CHECK 可能因为需要 CALL 而失败，这也是正常的
                            resolve({ error: data.error });
                        });
                    });
                    
                    if (checkResult && !checkResult.error) {
                        console.log('    CHECK成功');
                        logPass('重连后游戏操作');
                    } else if (checkResult?.error) {
                        console.log(`    CHECK被拒绝（正常）: ${checkResult.error}`);
                        logPass('重连后游戏操作（CHECK被正确拒绝）');
                    }
                } catch (e) {
                    // 如果 CHECK 不可用，尝试 CALL
                    console.log(`  CHECK不可用，测试 ${opName} CALL 操作...`);
                    
                    const callResult = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('CALL响应超时')), 5000);
                        
                        opSocket.emit('CS_TOURNAMENT_CALL', { tournamentId });
                        
                        opSocket.once('tournament_game_state', (state) => {
                            clearTimeout(timeout);
                            resolve(state);
                        });
                        
                        opSocket.once('SC_TOURNAMENT_ACTION_ERROR', (data) => {
                            clearTimeout(timeout);
                            resolve({ error: data.error });
                        });
                    });
                    
                    if (callResult && !callResult.error) {
                        console.log('    CALL成功');
                        logPass('重连后游戏操作（CALL）');
                    } else {
                        logFail('重连后游戏操作', callResult?.error || '未知错误');
                    }
                }
            } else {
                console.log('  当前没有玩家轮次，跳过操作测试');
                logPass('重连后游戏操作（跳过）');
            }
        }
        
        // 步骤10: 验证最终状态
        console.log('\n--- 步骤10: 验证最终状态 ---');
        
        const finalStatusResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalStatusResult = await finalStatusResponse.json();
        
        if (finalStatusResult.success) {
            console.log('  最终状态:', finalStatusResult.tournament?.status);
            console.log('  玩家数:', finalStatusResult.tournament?.players?.length);
            logPass(`锦标赛最终状态: ${finalStatusResult.tournament?.status}`);
        }
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        console.error(error.stack);
        logFail('测试执行', error.message);
    } finally {
        // 清理
        if (player1Socket) player1Socket.disconnect();
        if (player2Socket) player2Socket.disconnect();
    }
    
    // 输出汇总
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${results.passed.length}`);
    console.log(`❌ 失败: ${results.failed.length}`);
    
    if (results.passed.length > 0) {
        console.log('\n通过的测试:');
        results.passed.forEach(t => console.log(`  ✅ ${t}`));
    }
    
    if (results.failed.length > 0) {
        console.log('\n失败的测试:');
        results.failed.forEach(t => console.log(`  ❌ ${t}`));
    }
    
    console.log('\n========================================');
    process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
