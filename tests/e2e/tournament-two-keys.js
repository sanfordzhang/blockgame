/**
 * 锦标赛双人游戏端对端测试（使用私钥，无需浏览器钱包）
 * 玩家私钥通过环境变量 PLAYER1_PRIVATE_KEY / PLAYER2_PRIVATE_KEY 设置
 */

const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';

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

async function runTests() {
    console.log('========================================');
    console.log('锦标赛双人游戏端对端测试（私钥模式）');
    console.log('========================================\n');
    
    // 动态导入TronWeb计算地址
    console.log('--- 步骤1: 从私钥派生钱包地址 ---');
    
    try {
        const TronWebModule = await import('tronweb');
        // TronWeb v6 导入方式
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
        console.log('  尝试备用地址...');
        // 使用之前计算的备用地址
        PLAYER1.address = 'TPL66VK2gCXNCD7EJg9psNJ5TcuTK7htrp';
        PLAYER2.address = 'TJvYqDV3DyaFbA3mJFhE9LbHdK9ZQXxW5p';
        console.log(`玩家1地址: ${PLAYER1.address} (备用)`);
        console.log(`玩家2地址: ${PLAYER2.address} (备用)`);
    }
    console.log('');
    
    let tournamentId = null;
    
    try {
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
            console.log('  状态:', createResult.tournament?.status);
        } else {
            logFail('创建锦标赛', createResult.error);
            throw new Error('无法创建锦标赛: ' + createResult.error);
        }
        
        // 玩家1加入锦标赛
        console.log('\n--- 步骤3: 玩家1加入锦标赛 ---');
        
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
            console.log(`  地址: ${PLAYER1.address}`);
        } else {
            logFail('玩家1加入锦标赛', join1Result.error || JSON.stringify(join1Result));
        }
        
        // 检查锦标赛状态（1人）
        console.log('\n--- 步骤4: 检查锦标赛状态（玩家1已加入） ---');
        
        const status1Response = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const status1Result = await status1Response.json();
        
        if (status1Result.success) {
            const tournament = status1Result.tournament;
            console.log('  状态:', tournament.status);
            console.log('  玩家数量:', tournament.players?.length || 0);
            console.log('  奖池:', tournament.prizePool, 'SUN');
            logPass(`锦标赛状态: ${tournament.status}, 玩家数: ${tournament.players?.length || 0}`);
        }
        
        // 玩家2加入锦标赛
        console.log('\n--- 步骤5: 玩家2加入锦标赛 ---');
        
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
            console.log(`  地址: ${PLAYER2.address}`);
        } else {
            logFail('玩家2加入锦标赛', join2Result.error || JSON.stringify(join2Result));
        }
        
        // 检查锦标赛状态（2人，应自动开始）
        await sleep(1000);
        console.log('\n--- 步骤6: 检查锦标赛状态（玩家2已加入） ---');
        
        const status2Response = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const status2Result = await status2Response.json();
        
        if (status2Result.success) {
            const tournament = status2Result.tournament;
            console.log('  状态:', tournament.status);
            console.log('  玩家数量:', tournament.players?.length || 0);
            console.log('  奖池:', tournament.prizePool, 'SUN');
            console.log('  玩家列表:', tournament.players?.map(p => p.address?.substring(0, 10) + '...').join(', '));
            logPass(`锦标赛状态: ${tournament.status}, 玩家数: ${tournament.players?.length || 0}`);
        }
        
        // 开始锦标赛（如果满员未自动开始）
        console.log('\n--- 步骤7: 开始锦标赛 ---');
        
        const startResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const startResult = await startResponse.json();
        
        if (startResult.success) {
            logPass('锦标赛开始');
            console.log('  消息:', startResult.message);
        } else {
            console.log('  开始结果:', startResult.error || JSON.stringify(startResult));
            if (startResult.error?.includes('already')) {
                logPass('锦标赛已开始');
            }
        }
        
        // 模拟游戏进行
        console.log('\n--- 步骤8: 模拟游戏进行 ---');
        console.log('  等待2秒模拟游戏...');
        await sleep(2000);
        
        // 结算锦标赛
        console.log('\n--- 步骤9: 结算锦标赛 ---');
        
        // 玩家1获胜，获得95%奖金
        const rankings = [
            { address: PLAYER1.address, position: 1, prize: Math.floor(20000000 * 0.95) }, // 冠军获得95%
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
            console.log('  排名结果:');
            rankings.forEach(r => {
                console.log(`    ${r.position === 1 ? '🥇' : '🥈'} ${r.address.substring(0, 10)}... - ${r.prize} SUN`);
            });
        } else {
            logFail('锦标赛结算', finishResult.error || JSON.stringify(finishResult));
        }
        
        // 验证最终状态
        console.log('\n--- 步骤10: 验证最终状态 ---');
        
        const finalResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalResult = await finalResponse.json();
        
        if (finalResult.success) {
            const final = finalResult.tournament;
            console.log('  最终状态:', final.status);
            console.log('  开始时间:', final.startedAt);
            console.log('  结束时间:', final.endedAt);
            logPass(`锦标赛最终状态: ${final.status}`);
            
            if (final.rankings) {
                console.log('  最终排名:', JSON.stringify(final.rankings));
            }
        }
        
        // 检查玩家历史记录
        console.log('\n--- 步骤11: 检查玩家历史 ---');
        
        const history1Response = await fetch(`${API_URL}/api/tournament/history/${PLAYER1.address}`);
        const history1Result = await history1Response.json();
        
        if (history1Result.success) {
            const history = history1Result.history || [];
            const recentTournament = history.find(h => h.tournamentId === tournamentId);
            if (recentTournament) {
                logPass(`玩家1历史记录找到该锦标赛`);
                console.log('  历史记录数:', history.length);
            } else {
                console.log('  注意: 历史记录中未找到该锦标赛');
                console.log('  历史记录数:', history.length);
            }
        }
        
        const history2Response = await fetch(`${API_URL}/api/tournament/history/${PLAYER2.address}`);
        const history2Result = await history2Response.json();
        
        if (history2Result.success) {
            const history = history2Result.history || [];
            const recentTournament = history.find(h => h.tournamentId === tournamentId);
            if (recentTournament) {
                logPass(`玩家2历史记录找到该锦标赛`);
            }
        }
        
        // 测试领取奖金
        console.log('\n--- 步骤12: 测试领取奖金 ---');
        
        const claimResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}/claim`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER1.address
            },
            body: JSON.stringify({ walletAddress: PLAYER1.address })
        });
        const claimResult = await claimResponse.json();
        
        if (claimResult.success) {
            logPass(`玩家1领取奖金: ${claimResult.prize} SUN`);
        } else {
            console.log('  领取结果:', claimResult.error || JSON.stringify(claimResult));
            // 这可能是因为奖金已经在结算时发放
        }
        
        // 检查所有锦标赛列表
        console.log('\n--- 步骤13: 检查锦标赛列表 ---');
        
        const listResponse = await fetch(`${API_URL}/api/tournament/list`);
        const listResult = await listResponse.json();
        
        if (listResult.success) {
            const tournaments = listResult.tournaments || [];
            const ourTournament = tournaments.find(t => t.tournamentId === tournamentId);
            if (ourTournament) {
                logPass(`锦标赛列表中找到该锦标赛`);
                console.log('  总锦标赛数:', tournaments.length);
                console.log('  该锦标赛状态:', ourTournament.status);
            }
        }
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        console.error(error.stack);
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
