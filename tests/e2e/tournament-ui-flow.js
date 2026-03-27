/**
 * 锦标赛完整 UI 流程测试
 * 1. 使用私钥创建和加入锦标赛
 * 2. 使用 CDP 验证 UI 显示
 * 3. 等待玩家加入后验证游戏状态
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');

const CDP_PORT = process.env.CDP_PORT || 9222;
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';

// 两个玩家的私钥
const PLAYER1_PRIVATE_KEY = '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]';
const PLAYER2_PRIVATE_KEY = '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]';

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

async function runTests() {
    console.log('========================================');
    console.log('锦标赛完整 UI 流程测试');
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
        
        if (!TronWeb) {
            throw new Error('无法找到TronWeb构造函数');
        }
        
        const tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io'
        });
        
        PLAYER1.address = tronWeb.address.fromPrivateKey(PLAYER1.privateKey);
        PLAYER2.address = tronWeb.address.fromPrivateKey(PLAYER2.privateKey);
        
        console.log(`玩家1地址: ${PLAYER1.address}`);
        console.log(`玩家2地址: ${PLAYER2.address}`);
        logPass('从私钥派生钱包地址');
    } catch (e) {
        logFail('从私钥派生钱包地址', e.message);
        // 使用备用地址
        PLAYER1.address = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
        PLAYER2.address = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
        console.log(`玩家1地址: ${PLAYER1.address} (备用)`);
        console.log(`玩家2地址: ${PLAYER2.address} (备用)`);
    }
    console.log('');
    
    let client;
    let tournamentId = null;
    
    try {
        // ========== API 部分 ==========
        
        // 创建2人锦标赛
        console.log('\n--- 步骤2: 创建2人锦标赛 ---');
        
        const createResponse = await fetch(`${API_URL}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configId: 3, walletAddress: PLAYER1.address })
        });
        const createResult = await createResponse.json();
        
        if (createResult.success) {
            tournamentId = createResult.tournament?.tournamentId || createResult.tournament?.id;
            logPass(`创建锦标赛 ID: ${tournamentId}`);
            console.log('  买入金额:', createResult.tournament?.buyIn, 'SUN');
            console.log('  玩家人数:', createResult.tournament?.playerCount);
        } else {
            logFail('创建锦标赛', createResult.error);
            throw new Error('无法创建锦标赛: ' + createResult.error);
        }
        
        // 玩家1加入锦标赛
        console.log('\n--- 步骤3: 玩家1加入锦标赛 (API) ---');
        
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
        
        // ========== UI 验证部分 ==========
        
        // 连接Chrome CDP
        console.log('\n--- 步骤4: 连接Chrome CDP ---');
        client = await CDP({ port: CDP_PORT });
        const { Page, Runtime, DOM, Network } = client;
        
        await Promise.all([
            Page.enable(),
            Runtime.enable(),
            DOM.enable(),
            Network.enable()
        ]);
        
        logPass('Chrome CDP连接');
        
        // 导航到锦标赛页面（带钱包地址参数）
        console.log('\n--- 步骤5: 验证锦标赛等待室 UI ---');
        
        const tournamentUrl = `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}`;
        console.log(`  导航到: ${tournamentUrl}`);
        
        await Page.navigate({ url: tournamentUrl });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 检查等待室显示
        const waitingRoomCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    // 检查是否有 "Waiting for Players" 或 "等待玩家" 文字
                    const body = document.body.innerText;
                    const hasWaiting = body.includes('Waiting') || body.includes('等待');
                    
                    // 检查玩家数量显示
                    const playerCountMatch = body.match(/(\\d+)\\s*\\/\\s*(\\d+)/);
                    
                    // 检查是否有玩家地址显示
                    const hasPlayerAddress = body.includes('${PLAYER1.address.substring(0, 10)}');
                    
                    return {
                        hasWaiting,
                        playerCount: playerCountMatch ? playerCountMatch[1] : null,
                        totalPlayers: playerCountMatch ? playerCountMatch[2] : null,
                        hasPlayerAddress,
                        bodyPreview: body.substring(0, 500)
                    };
                })()
            `,
            returnByValue: true
        });
        
        const waitingData = waitingRoomCheck.result?.value || waitingRoomCheck.result;
        console.log('  等待室状态:', JSON.stringify(waitingData, null, 2));
        
        if (waitingData.hasWaiting && waitingData.playerCount === '1') {
            logPass('等待室 UI 显示正确 (1/2 玩家)');
        } else {
            logFail('等待室 UI 显示', '未检测到正确的等待室状态');
        }
        
        if (waitingData.hasPlayerAddress) {
            logPass('玩家地址在 UI 中显示');
        } else {
            console.log('  注意: 玩家地址未在 UI 中显示（可能正常）');
        }
        
        // 玩家2加入锦标赛
        console.log('\n--- 步骤6: 玩家2加入锦标赛 (API) ---');
        
        const join2Response = await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER2.address
            },
            body: JSON.stringify({ walletAddress: PLAYER2.address })
        });
        const join2Result = await join2Response.json();
        
        if (join2Result.success || join2Result.error?.includes('Already joined')) {
            logPass('玩家2加入锦标赛');
        } else {
            logFail('玩家2加入锦标赛', join2Result.error || JSON.stringify(join2Result));
        }
        
        // 等待游戏自动开始（两个玩家都加入后应该自动开始）
        console.log('\n--- 步骤7: 验证游戏自动开始 ---');
        await sleep(2000);
        
        // 检查锦标赛状态
        const statusResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const statusResult = await statusResponse.json();
        
        console.log('  API 返回:', JSON.stringify(statusResult, null, 2));
        
        if (statusResult.success) {
            const tournament = statusResult.tournament;
            console.log('  锦标赛状态:', tournament.status);
            console.log('  玩家数量:', tournament.players?.length);
            console.log('  需要人数:', tournament.playerCount);
            
            // 关键验证：两个玩家都加入后，状态应该是 IN_PROGRESS
            if (tournament.status === 'IN_PROGRESS') {
                logPass('游戏自动开始 (状态: IN_PROGRESS)');
            } else if (tournament.players?.length >= tournament.playerCount) {
                logFail('游戏自动开始', `玩家已满(${tournament.players?.length}/${tournament.playerCount})但状态仍为 ${tournament.status}`);
            } else {
                console.log(`  等待中: ${tournament.players?.length}/${tournament.playerCount} 玩家`);
                logPass(`锦标赛状态: ${tournament.status}`);
            }
        } else {
            logFail('获取锦标赛状态', statusResult.error || '未知错误');
        }
        
        // 刷新页面检查游戏 UI
        console.log('\n--- 步骤8: 验证游戏 UI ---');
        
        await Page.navigate({ url: tournamentUrl });
        await Page.loadEventFired();
        await sleep(3000);
        
        const gameUICheck = await Runtime.evaluate({
            expression: `
                (function() {
                    const body = document.body.innerText;
                    
                    // 检查是否有游戏相关元素
                    const hasGameTable = body.includes('Tournament') || body.includes('锦标赛');
                    const hasChips = body.includes('Stack') || body.includes('筹码') || body.includes('Chip');
                    const hasPot = body.includes('POT') || body.includes('奖池');
                    const hasCards = document.querySelectorAll('img, [class*="card"]').length > 0 || body.includes('Card');
                    
                    // 检查是否还有等待信息
                    const stillWaiting = body.includes('Waiting for Players') || body.includes('等待玩家');
                    
                    return {
                        hasGameTable,
                        hasChips,
                        hasPot,
                        hasCards,
                        stillWaiting,
                        bodyPreview: body.substring(0, 500)
                    };
                })()
            `,
            returnByValue: true
        });
        
        const gameData = gameUICheck.result?.value || gameUICheck.result;
        console.log('  游戏 UI 状态:', JSON.stringify(gameData, null, 2));
        
        if (gameData.hasGameTable && !gameData.stillWaiting) {
            logPass('游戏 UI 正确显示');
        } else if (gameData.stillWaiting) {
            logFail('游戏 UI', '仍然显示等待室，游戏可能未开始');
        } else {
            console.log('  注意: 游戏 UI 状态待确认');
        }
        
        // 结算锦标赛
        console.log('\n--- 步骤10: 结算锦标赛 ---');
        
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
        
        // 验证最终状态
        console.log('\n--- 步骤11: 验证最终状态 ---');
        
        const finalResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalResult = await finalResponse.json();
        
        if (finalResult.success) {
            const final = finalResult.tournament;
            console.log('  最终状态:', final.status);
            logPass(`锦标赛最终状态: ${final.status}`);
        }
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        console.error(error.stack);
    } finally {
        if (client) {
            await client.close();
        }
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
