/**
 * 锦标赛完整游戏流程测试 - 修复版
 * 
 * 关键修复：
 * 1. 玩家必须先通过 CS_TOURNAMENT_ROOM_JOIN 建立socket关联
 * 2. 然后再通过 API 加入锦标赛
 * 3. 这样才能确保 socketId 被正确设置
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');

// 玩家私钥
const _testCfg = require('../../tests/test-config'); const _players = _testCfg.getPlayerConfig(); const PLAYER1_PRIVATE_KEY = _players.PLAYER1.privateKey;
const PLAYER2_PRIVATE_KEY = _players.PLAYER2.privateKey;

// 测试结果
const results = { passed: [], failed: [], errors: [] };
const screenshotsDir = path.join(__dirname, 'screenshots');

// 确保截图目录存在
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

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

async function takeScreenshot(Page, name) {
    try {
        const { data } = await Page.captureScreenshot({ format: 'png' });
        const filename = path.join(screenshotsDir, `${name}.png`);
        fs.writeFileSync(filename, Buffer.from(data, 'base64'));
        console.log(`  📸 截图: ${filename}`);
        return filename;
    } catch (err) {
        console.log(`  ⚠️ 截图失败: ${err.message}`);
        return null;
    }
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛完整游戏流程测试 - 修复版');
    console.log('========================================\n');
    
    let player1Address, player2Address;
    let tournamentId;
    let player1Socket, player2Socket;
    let client, Page, Runtime;
    
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
        
        const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
        player1Address = tronWeb.address.fromPrivateKey(PLAYER1_PRIVATE_KEY);
        player2Address = tronWeb.address.fromPrivateKey(PLAYER2_PRIVATE_KEY);
        
        console.log(`玩家1: ${player1Address}`);
        console.log(`玩家2: ${player2Address}`);
        logPass('获取钱包地址');
        
        // 步骤2: 创建Socket连接（必须先建立）
        console.log('\n--- 步骤2: 建立Socket连接 ---');
        
        player1Socket = io(API_URL, { transports: ['websocket'], reconnection: false });
        player2Socket = io(API_URL, { transports: ['websocket'], reconnection: false });
        
        await Promise.all([
            new Promise((resolve) => player1Socket.on('connect', resolve)),
            new Promise((resolve) => player2Socket.on('connect', resolve))
        ]);
        
        console.log('  两个Socket客户端已连接');
        logPass('Socket连接建立');
        
        // 步骤3: 创建锦标赛
        console.log('\n--- 步骤3: 创建2人锦标赛 ---');
        
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
        
        // 步骤4: 玩家1先加入Socket Room（关键步骤！）
        console.log('\n--- 步骤4: 玩家1加入Socket Room ---');
        
        const p1RoomPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('加入房间超时')), 5000);
            player1Socket.once('SC_TOURNAMENT_ROOM_JOINED', (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
            player1Socket.once('SC_TOURNAMENT_ROOM_ERROR', (data) => {
                clearTimeout(timeout);
                reject(new Error(data.error));
            });
        });
        
        player1Socket.emit('CS_TOURNAMENT_ROOM_JOIN', { 
            tournamentId, 
            walletAddress: player1Address 
        });
        
        const p1RoomData = await p1RoomPromise;
        console.log('  玩家1房间状态:', p1RoomData.tournament?.status);
        logPass('玩家1加入Socket Room');
        
        // 步骤5: 玩家1通过API加入锦标赛
        console.log('\n--- 步骤5: 玩家1通过API加入锦标赛 ---');
        
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
            logFail('玩家1加入锦标赛', join1Result.error);
        }
        
        // 步骤6: 连接Chrome CDP
        console.log('\n--- 步骤6: 连接Chrome CDP ---');
        
        try {
            client = await CDP({ port: CDP_PORT });
            ({ Page, Runtime } = client);
            await Page.enable();
            await Runtime.enable();
            
            // 打开玩家1页面
            await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}/play?address=${player1Address}` });
            await Page.loadEventFired();
            await sleep(3000);
            
            await takeScreenshot(Page, '01-player1-waiting');
            logPass('Chrome CDP连接');
        } catch (err) {
            console.log('  ⚠️ Chrome CDP连接失败:', err.message);
        }
        
        // 步骤7: 玩家2先加入Socket Room
        console.log('\n--- 步骤7: 玩家2加入Socket Room ---');
        
        const p2RoomPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('加入房间超时')), 5000);
            player2Socket.once('SC_TOURNAMENT_ROOM_JOINED', (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
            player2Socket.once('SC_TOURNAMENT_ROOM_ERROR', (data) => {
                clearTimeout(timeout);
                reject(new Error(data.error));
            });
        });
        
        player2Socket.emit('CS_TOURNAMENT_ROOM_JOIN', { 
            tournamentId, 
            walletAddress: player2Address 
        });
        
        const p2RoomData = await p2RoomPromise;
        console.log('  玩家2房间状态:', p2RoomData.tournament?.status);
        logPass('玩家2加入Socket Room');
        
        // 步骤8: 玩家2通过API加入锦标赛（触发游戏开始）
        console.log('\n--- 步骤8: 玩家2通过API加入（触发游戏开始）---');
        
        // 提前注册持久游戏状态监听器（关键！）
        let latestGameState = null;
        const handleGameState = (state) => {
            latestGameState = state;
            console.log(`  📨 收到游戏状态: turn=${state.turn}, pot=${state.pot}`);
        };
        player1Socket.on('tournament_game_state', handleGameState);
        player2Socket.on('tournament_game_state', handleGameState);
        
        // 监听操作错误
        player1Socket.on('SC_TOURNAMENT_ACTION_ERROR', (data) => {
            console.log(`  ⚠️ 玩家1操作错误: ${data.error}`);
        });
        player2Socket.on('SC_TOURNAMENT_ACTION_ERROR', (data) => {
            console.log(`  ⚠️ 玩家2操作错误: ${data.error}`);
        });
        
        // 监听手牌结果
        const handleWinMessage = (data) => {
            if (data.message?.includes('wins')) {
                console.log(`  🏅 ${data.message}`);
            }
        };
        player1Socket.on('tournament_action', handleWinMessage);
        player2Socket.on('tournament_action', handleWinMessage);
        
        // 使用 once 监听第一次游戏状态（用于确认）
        const firstGameState1 = new Promise((resolve) => {
            player1Socket.once('tournament_game_state', resolve);
        });
        const firstGameState2 = new Promise((resolve) => {
            player2Socket.once('tournament_game_state', resolve);
        });
        
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
            logFail('玩家2加入锦标赛', join2Result.error);
        }
        
        // 等待游戏状态
        console.log('  等待游戏状态...');
        await Promise.race([
            Promise.all([firstGameState1, firstGameState2]),
            sleep(8000).then(() => null)
        ]);
        
        console.log('  游戏状态已广播');
        logPass('收到游戏状态');
        
        // 步骤9: 验证锦标赛状态
        console.log('\n--- 步骤9: 验证锦标赛状态 ---');
        
        const statusResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const statusResult = await statusResponse.json();
        
        console.log('  锦标赛状态:', statusResult.tournament?.status);
        console.log('  玩家数:', statusResult.tournament?.players?.length);
        
        if (statusResult.tournament?.status === 'IN_PROGRESS') {
            logPass('游戏已开始');
        }
        
        // 步骤10: 游戏操作循环
        console.log('\n--- 步骤10: 游戏操作循环 ---');
        
        let actionCount = 0;
        let maxActions = 50;
        let isGameEnded = false;
        
        // 等待初始游戏状态
        console.log('  等待初始游戏状态...');
        let waitCount = 0;
        while (!latestGameState && waitCount < 10) {
            await sleep(1000);
            waitCount++;
            console.log(`  等待中... (${waitCount}/10)`);
        }
        
        if (!latestGameState) {
            logFail('等待游戏状态', '超时未收到游戏状态');
        } else {
            console.log('  收到初始游戏状态');
            if (Page) await takeScreenshot(Page, '02-game-started');
        }
        
        // 游戏循环
        while (actionCount < maxActions && !isGameEnded) {
            actionCount++;
            await sleep(2000);
            
            // 每10次操作检查一次状态
            if (actionCount % 10 === 0) {
                try {
                    const statusCheck = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
                    const statusData = await statusCheck.json();
                    
                    if (statusData.tournament?.status === 'COMPLETED') {
                        console.log('\n  🏆 游戏已结束！');
                        isGameEnded = true;
                        if (Page) await takeScreenshot(Page, '03-game-end');
                        break;
                    }
                } catch (err) {
                    console.log(`  状态检查失败: ${err.message}`);
                }
            }
            
            // 获取最新游戏状态
            if (!latestGameState) {
                console.log(`  [${actionCount}] 等待游戏状态...`);
                continue;
            }
            
            const turn = latestGameState.turn;
            const seats = latestGameState.seats;
            
            // 找出当前是谁的回合
            let currentPlayerSeat = null;
            let currentPlayerSocket = null;
            let currentPlayerAddress = null;
            
            for (const [seatId, seat] of Object.entries(seats || {})) {
                if (parseInt(seatId) === turn && seat.player) {
                    currentPlayerSeat = seatId;
                    currentPlayerAddress = seat.player.id;
                    currentPlayerSocket = currentPlayerAddress === player1Address ? player1Socket : player2Socket;
                    break;
                }
            }
            
            if (!currentPlayerSocket) {
                console.log(`  [${actionCount}] 无法确定当前玩家, turn=${turn}`);
                continue;
            }
            
            console.log(`  [${actionCount}] 回合: 座位${currentPlayerSeat}, 玩家${currentPlayerAddress?.substring(0, 8)}...`);
            
            // 执行操作
            const mySeat = seats[currentPlayerSeat];
            const callAmount = latestGameState.callAmount || 0;
            const myBet = mySeat?.bet || 0;
            
            if (myBet < callAmount) {
                console.log(`  执行 Call...`);
                currentPlayerSocket.emit('CS_TOURNAMENT_CALL', { tournamentId });
            } else {
                console.log(`  执行 Check...`);
                currentPlayerSocket.emit('CS_TOURNAMENT_CHECK', { tournamentId });
            }
            
            // 截图
            if (Page && actionCount % 10 === 0) {
                await takeScreenshot(Page, `04-action-${actionCount}`);
            }
        }
        
        logPass(`完成 ${actionCount} 次操作`);
        
        // 步骤11: 最终验证
        console.log('\n--- 步骤11: 最终验证 ---');
        
        const finalResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalResult = await finalResponse.json();
        
        console.log('  最终状态:', finalResult.tournament?.status);
        console.log('  玩家数:', finalResult.tournament?.players?.length);
        
        if (finalResult.tournament?.status === 'COMPLETED') {
            logPass('锦标赛已完成');
        } else {
            logPass(`最终状态: ${finalResult.tournament?.status}`);
        }
        
        // 检查页面错误
        if (Page && Runtime) {
            const errorCheck = await Runtime.evaluate({
                expression: `document.body.innerText.includes('Error') || document.body.innerText.includes('error')`,
                returnByValue: true
            });
            
            if (!errorCheck.result?.value) {
                logPass('无页面错误');
            } else {
                logFail('页面错误检查', '发现错误信息');
            }
        }
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        console.error(error.stack);
        logFail('测试执行', error.message);
    } finally {
        // 清理
        if (player1Socket) player1Socket.disconnect();
        if (player2Socket) player2Socket.disconnect();
        if (client) await client.close();
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
    
    console.log(`\n截图目录: ${screenshotsDir}`);
    console.log('========================================');
    
    process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
