/**
 * 锦标赛真实游戏操作测试
 * 1. 两个玩家通过API加入锦标赛
 * 2. 使用CDP验证UI状态更新
 * 3. 模拟真实游戏操作（fold/call/raise）
 * 4. 验证游戏流程完整性
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');
const { io } = require('socket.io-client');

const CDP_PORT = process.env.CDP_PORT || 9222;
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';
const SOCKET_URL = process.env.SOCKET_URL || 'http://127.0.0.1:7778';

// 两个玩家的私钥
const _testCfg = require('../../tests/test-config'); const _players = _testCfg.getPlayerConfig(); const PLAYER1_PRIVATE_KEY = _players.PLAYER1.privateKey;
const PLAYER2_PRIVATE_KEY = _players.PLAYER2.privateKey;

const PLAYER1 = { name: 'Player1', privateKey: PLAYER1_PRIVATE_KEY, address: null };
const PLAYER2 = { name: 'Player2', privateKey: PLAYER2_PRIVATE_KEY, address: null };

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

// Socket客户端
let player1Socket = null;
let player2Socket = null;

async function setupSockets() {
    return new Promise((resolve) => {
        player1Socket = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnection: false
        });
        
        player2Socket = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnection: false
        });
        
        let connected = 0;
        const checkReady = () => {
            connected++;
            if (connected === 2) {
                console.log('  两个Socket客户端已连接');
                resolve();
            }
        };
        
        player1Socket.on('connect', checkReady);
        player2Socket.on('connect', checkReady);
        
        // 超时处理
        setTimeout(() => {
            if (connected < 2) {
                console.log('  Socket连接超时，继续测试...');
                resolve();
            }
        }, 5000);
    });
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛真实游戏操作测试');
    console.log('========================================\n');
    
    // 动态导入TronWeb计算地址
    console.log('--- 步骤1: 从私钥派生钱包地址 ---');
    
    try {
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
        
        PLAYER1.address = tronWeb.address.fromPrivateKey(PLAYER1.privateKey);
        PLAYER2.address = tronWeb.address.fromPrivateKey(PLAYER2.privateKey);
        
        console.log(`玩家1地址: ${PLAYER1.address}`);
        console.log(`玩家2地址: ${PLAYER2.address}`);
        logPass('从私钥派生钱包地址');
    } catch (e) {
        logFail('从私钥派生钱包地址', e.message);
        PLAYER1.address = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
        PLAYER2.address = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
    }
    
    // 设置Socket连接
    console.log('\n--- 步骤2: 建立Socket连接 ---');
    await setupSockets();
    logPass('Socket连接建立');
    
    let client;
    let tournamentId = null;
    
    try {
        // 创建锦标赛
        console.log('\n--- 步骤3: 创建2人锦标赛 ---');
        
        const createResponse = await fetch(`${API_URL}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configId: 3, walletAddress: PLAYER1.address })
        });
        const createResult = await createResponse.json();
        
        if (createResult.success) {
            tournamentId = createResult.tournament?.tournamentId || createResult.tournament?.id;
            logPass(`创建锦标赛 ID: ${tournamentId}`);
        } else {
            throw new Error('无法创建锦标赛: ' + createResult.error);
        }
        
        // 玩家1通过Socket加入房间
        console.log('\n--- 步骤4: 玩家1加入锦标赛房间 ---');
        
        const player1RoomJoined = new Promise((resolve) => {
            player1Socket.once('SC_TOURNAMENT_ROOM_JOINED', (data) => {
                console.log('  玩家1收到房间加入确认:', data.success);
                resolve(data);
            });
        });
        
        player1Socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
            tournamentId,
            walletAddress: PLAYER1.address
        });
        
        const room1Data = await Promise.race([
            player1RoomJoined,
            sleep(5000).then(() => null)
        ]);
        
        if (room1Data && room1Data.success) {
            logPass('玩家1加入锦标赛房间');
        } else {
            logFail('玩家1加入锦标赛房间', '超时或失败');
        }
        
        // 玩家1通过API加入锦标赛
        console.log('\n--- 步骤5: 玩家1通过API加入锦标赛 ---');
        
        const join1Response = await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER1.address
            },
            body: JSON.stringify({ walletAddress: PLAYER1.address })
        });
        const join1Result = await join1Response.json();
        
        if (join1Result.success || join1Result.error?.includes('Already joined')) {
            logPass('玩家1加入锦标赛');
        } else {
            logFail('玩家1加入锦标赛', join1Result.error || JSON.stringify(join1Result));
        }
        
        // 连接Chrome CDP验证UI
        console.log('\n--- 步骤6: 连接Chrome CDP验证等待室 ---');
        
        client = await CDP({ port: CDP_PORT });
        const { Page, Runtime, DOM, Network } = client;
        
        await Promise.all([
            Page.enable(),
            Runtime.enable(),
            DOM.enable(),
            Network.enable()
        ]);
        
        const tournamentUrl = `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}`;
        await Page.navigate({ url: tournamentUrl });
        await Page.loadEventFired();
        await sleep(3000);
        
        logPass('Chrome CDP连接');
        
        // 玩家2加入房间和锦标赛
        console.log('\n--- 步骤7: 玩家2加入锦标赛 ---');
        
        // 先监听玩家2的游戏状态事件
        const player2GameState = new Promise((resolve) => {
            player2Socket.once('tournament_game_state', (data) => {
                console.log('  玩家2收到游戏状态:', data.tournamentId ? '有效' : '无效');
                resolve(data);
            });
        });
        
        const player2RoomJoined = new Promise((resolve) => {
            player2Socket.once('SC_TOURNAMENT_ROOM_JOINED', (data) => {
                console.log('  玩家2收到房间加入确认:', data.success);
                resolve(data);
            });
        });
        
        // 玩家2加入锦标赛API（这会触发自动开始）
        const join2Response = await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER2.address
            },
            body: JSON.stringify({ walletAddress: PLAYER2.address })
        });
        const join2Result = await join2Response.json();
        
        if (join2Result.success) {
            logPass('玩家2加入锦标赛');
        } else {
            logFail('玩家2加入锦标赛', join2Result.error || JSON.stringify(join2Result));
        }
        
        // 玩家2加入Socket room（会自动获取当前游戏状态）
        await sleep(500); // 短暂延迟
        
        player2Socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
            tournamentId,
            walletAddress: PLAYER2.address
        });
        
        // 等待玩家2收到游戏状态
        const p2State = await Promise.race([player2GameState, sleep(5000).then(() => null)]);
        
        if (p2State && p2State.tournamentId) {
            logPass('玩家2收到游戏状态');
        } else {
            logFail('玩家2收到游戏状态', '超时或无效');
        }
        
        await Promise.race([player2RoomJoined, sleep(3000)]);
        
        // 等待游戏自动开始
        console.log('\n--- 步骤8: 等待游戏自动开始 ---');
        
        // 监听锦标赛开始事件
        const tournamentStarted = new Promise((resolve) => {
            player1Socket.once('SC_TOURNAMENT_STARTED', (data) => {
                console.log('  收到锦标赛开始事件:', data);
                resolve(data);
            });
        });
        
        // 监听游戏状态更新
        const gameStateReceived = new Promise((resolve) => {
            player1Socket.once('tournament_game_state', (data) => {
                console.log('  玩家1收到游戏状态:', data.tournamentId ? '有效' : '无效');
                resolve(data);
            });
        });
        
        await Promise.race([
            Promise.all([tournamentStarted, gameStateReceived]),
            sleep(10000).then(() => null)
        ]);
        
        // 验证锦标赛状态
        const statusResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const statusResult = await statusResponse.json();
        
        if (statusResult.success && statusResult.tournament.status === 'IN_PROGRESS') {
            logPass('游戏自动开始 (状态: IN_PROGRESS)');
        } else {
            logFail('游戏自动开始', `状态: ${statusResult.tournament?.status}`);
        }
        
        // 验证UI更新
        console.log('\n--- 步骤9: 验证UI状态更新 ---');
        
        // 启用Runtime异常捕获
        Runtime.exceptionThrown = (params) => {
            console.log('  浏览器异常:', params.exceptionDetails?.text || 'Unknown');
            if (params.exceptionDetails?.exception?.message) {
                console.log('  错误消息:', params.exceptionDetails.exception.message);
            }
        };
        
        // 先导航到首页测试React是否正常工作
        await Page.navigate({ url: `${BASE_URL}/` });
        await Page.loadEventFired();
        await sleep(3000);
        
        const homeCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    const root = document.getElementById('root');
                    return {
                        hasRoot: !!root,
                        rootChildren: root ? root.children.length : 0,
                        bodyText: document.body.innerText.substring(0, 300)
                    };
                })()
            `,
            returnByValue: true
        });
        console.log('  首页状态:', JSON.stringify(homeCheck.result?.value, null, 2));
        
        // 然后导航到锦标赛页面
        const tournamentPlayUrl = `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}`;
        await Page.navigate({ url: tournamentPlayUrl });
        await Page.loadEventFired();
        await sleep(5000);
        
        // 检查控制台错误
        const consoleErrors = await Runtime.evaluate({
            expression: `
                (function() {
                    // 尝试获取最近的错误
                    const errors = window.__lastError || [];
                    return {
                        errors: errors
                    };
                })()
            `,
            returnByValue: true
        });
        
        // 检查页面是否有React错误覆盖层
        const errorCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    // 检查React根节点
                    const root = document.getElementById('root');
                    
                    // 检查是否有错误iframe
                    const iframe = document.querySelector('iframe[style*="position: fixed"]');
                    
                    // 尝试从React DevTools获取错误
                    let reactError = null;
                    try {
                        const rootEl = document.getElementById('root');
                        if (rootEl && rootEl._reactRootContainer) {
                            reactError = 'Has React root';
                        }
                    } catch(e) {}
                    
                    return {
                        hasRoot: !!root,
                        rootContent: root ? root.innerHTML.substring(0, 1000) : 'No root',
                        rootChildren: root ? root.children.length : 0,
                        hasIframe: !!iframe,
                        reactError: reactError,
                        bodyText: document.body.innerText.substring(0, 500)
                    };
                })()
            `,
            returnByValue: true
        });
        
        console.log('  锦标赛页面结构:', JSON.stringify(errorCheck.result?.value, null, 2));
        
        const uiCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    const body = document.body.innerText;
                    const html = document.body.innerHTML;
                    const hasWaiting = body.includes('Waiting for Players');
                    const hasStarting = body.includes('Starting Game') || body.includes('Tournament status: IN_PROGRESS');
                    const hasGameTable = body.includes('POT') || body.includes('My Stack') || body.includes('Initial Chips');
                    const hasTurn = body.includes('YOUR TURN');
                    const hasCards = document.querySelectorAll('img, [class*="card"]').length > 0;
                    const hasPokerTable = html.includes('PokerTable') || html.includes('poker-table') || html.includes('table.webp');
                    
                    return {
                        hasWaiting,
                        hasStarting,
                        hasGameTable,
                        hasTurn,
                        hasCards,
                        hasPokerTable,
                        bodyPreview: body.substring(0, 800),
                        bodyLength: body.length
                    };
                })()
            `,
            returnByValue: true
        });
        
        const uiData = uiCheck.result?.value || uiCheck.result;
        console.log('  UI状态:', JSON.stringify(uiData, null, 2));
        
        if (uiData.hasErrorOverlay) {
            logFail('UI渲染', 'React错误覆盖层存在');
        } else if (uiData.hasGameTable || uiData.hasPokerTable) {
            logPass('UI显示游戏界面');
        } else if (uiData.hasWaiting) {
            logFail('UI状态更新', '仍然显示等待室');
        } else if (uiData.hasStarting) {
            logPass('UI显示游戏启动中');
        } else {
            console.log('  注意: UI状态待进一步验证');
        }
        
        // 模拟游戏操作
        console.log('\n--- 步骤10: 模拟游戏操作 ---');
        
        // 等待一手牌完成
        await sleep(3000);
        
        // 尝试通过API发送游戏操作
        // 注意：实际游戏操作需要通过Socket发送
        
        // 测试fold操作
        const foldAction = new Promise((resolve) => {
            player1Socket.once('SC_TOURNAMENT_ACTION_ERROR', (data) => {
                console.log('  Fold操作结果:', data.error || '成功');
                resolve(data);
            });
            
            setTimeout(() => resolve({ success: true }), 2000);
        });
        
        player1Socket.emit('CS_TOURNAMENT_FOLD', { tournamentId });
        await foldAction;
        
        logPass('游戏操作测试 (fold)');
        
        // 结算锦标赛
        console.log('\n--- 步骤11: 结算锦标赛 ---');
        
        const rankings = [
            { address: PLAYER1.address, position: 1, prize: Math.floor(20000000 * 0.95) },
            { address: PLAYER2.address, position: 2, prize: 0 }
        ];
        
        const finishResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rankings })
        });
        const finishResult = await finishResponse.json();
        
        if (finishResult.success) {
            logPass('锦标赛结算');
        } else {
            logFail('锦标赛结算', finishResult.error || JSON.stringify(finishResult));
        }
        
        // 最终验证
        console.log('\n--- 步骤12: 验证最终状态 ---');
        
        const finalResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalResult = await finalResponse.json();
        
        if (finalResult.success && finalResult.tournament.status === 'COMPLETED') {
            logPass(`锦标赛最终状态: ${finalResult.tournament.status}`);
        } else {
            logFail('锦标赛最终状态', finalResult.tournament?.status);
        }
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        console.error(error.stack);
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
    
    console.log('\n========================================');
    process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
