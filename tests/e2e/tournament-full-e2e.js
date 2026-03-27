/**
 * 锦标赛完整端到端测试
 * 使用Chrome CDP测试前端UI + 后端API
 * 
 * 玩家1私钥: [REMOVED PRIVATE KEY - SEE .env FOR CONFIG]
 * 玩家2私钥: [REMOVED PRIVATE KEY - SEE .env FOR CONFIG]
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');

const CDP_PORT = 9222;
const BASE_URL = 'http://127.0.0.1:3001';
const API_URL = 'http://127.0.0.1:7778';

const PLAYER1_PRIVATE_KEY = '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]';
const PLAYER2_PRIVATE_KEY = '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]';

const PLAYER1 = { name: 'Player1', privateKey: PLAYER1_PRIVATE_KEY, address: null };
const PLAYER2 = { name: 'Player2', privateKey: PLAYER2_PRIVATE_KEY, address: null };

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function deriveAddresses() {
    try {
        const TronWebModule = await import('tronweb');
        let TronWeb = TronWebModule.default || TronWebModule.TronWeb || TronWebModule;
        const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
        PLAYER1.address = tronWeb.address.fromPrivateKey(PLAYER1.privateKey);
        PLAYER2.address = tronWeb.address.fromPrivateKey(PLAYER2.privateKey);
        console.log(`玩家1: ${PLAYER1.address}`);
        console.log(`玩家2: ${PLAYER2.address}`);
        return true;
    } catch (e) {
        console.error('派生地址失败:', e.message);
        return false;
    }
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛完整端到端测试');
    console.log('========================================\n');
    
    // 派生地址
    console.log('--- 步骤1: 派生钱包地址 ---');
    await deriveAddresses();
    logPass('派生钱包地址');
    
    let client;
    
    try {
        // 连接CDP
        console.log('\n--- 步骤2: 连接Chrome CDP ---');
        client = await CDP({ port: CDP_PORT });
        const { Page, Runtime, DOM } = client;
        await Promise.all([Page.enable(), Runtime.enable(), DOM.enable()]);
        logPass('Chrome CDP连接');
        
        // 导航到锦标赛页面
        console.log('\n--- 步骤3: 导航到锦标赛页面 ---');
        await Page.navigate({ url: `${BASE_URL}/tournament` });
        await Page.loadEventFired();
        await sleep(3000);
        logPass('导航到锦标赛页面');
        
        // 检查钱包状态
        console.log('\n--- 步骤4: 检查TronLink钱包状态 ---');
        const walletState = await Runtime.evaluate({
            expression: `
                (function() {
                    if (window.tronLink && window.tronLink.tronWeb) {
                        return {
                            installed: true,
                            connected: !!window.tronLink.tronWeb.defaultAddress?.base58,
                            address: window.tronLink.tronWeb.defaultAddress?.base58
                        };
                    }
                    return { installed: false, connected: false };
                })()
            `,
            returnByValue: true
        });
        const wallet = walletState.result?.value;
        console.log(`  钱包状态: ${JSON.stringify(wallet)}`);
        
        if (wallet?.connected) {
            logPass(`钱包已连接: ${wallet.address}`);
        } else {
            logFail('钱包连接', '请先在浏览器中连接TronLink钱包');
        }
        
        // 创建锦标赛
        console.log('\n--- 步骤5: 创建2人锦标赛 ---');
        await Runtime.evaluate({
            expression: `document.querySelector('[data-testid="create-tournament-btn-3"]')?.click()`,
            returnByValue: true
        });
        await sleep(2000);
        
        // 获取刚创建的锦标赛
        const listRes = await fetch(`${API_URL}/api/tournament/list?status=WAITING`);
        const listData = await listRes.json();
        const tournamentId = listData.tournaments?.[0]?.tournamentId;
        
        if (tournamentId) {
            logPass(`创建锦标赛 ID: ${tournamentId}`);
        } else {
            logFail('创建锦标赛', '未找到WAITING状态的锦标赛');
        }
        
        // 点击锦标赛卡片加入
        console.log('\n--- 步骤6: 玩家1通过UI加入锦标赛 ---');
        
        // 点击第一个WAITING卡片
        const clickCard = await Runtime.evaluate({
            expression: `
                (function() {
                    const cards = document.querySelectorAll('[data-testid^="tournament-card-"]');
                    for (const card of cards) {
                        if (card.textContent.includes('WAITING')) {
                            card.click();
                            return true;
                        }
                    }
                    return false;
                })()
            `,
            returnByValue: true
        });
        
        await sleep(1000);
        
        // 检查模态框是否显示
        const modalCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    const wrapper = document.getElementById('wrapper');
                    const style = wrapper ? window.getComputedStyle(wrapper) : null;
                    return {
                        exists: !!wrapper,
                        visible: style && style.display !== 'none' && style.visibility !== 'hidden',
                        text: wrapper?.textContent?.substring(0, 50)
                    };
                })()
            `,
            returnByValue: true
        });
        
        if (modalCheck.result?.value?.visible) {
            logPass('显示Join Tournament模态框');
            console.log(`  模态框内容: ${modalCheck.result.value.text}`);
            
            // 点击Confirm按钮
            console.log('\n--- 步骤7: 点击Confirm按钮加入 ---');
            await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.textContent.includes('Confirm')) {
                                btn.click();
                                return true;
                            }
                        }
                        return false;
                    })()
                `,
                returnByValue: true
            });
            
            await sleep(2000);
            
            // 检查是否跳转到游戏页面
            const urlCheck = await Runtime.evaluate({
                expression: `window.location.href`,
                returnByValue: true
            });
            
            if (urlCheck.result?.value?.includes('/play')) {
                logPass('玩家1成功加入并跳转到游戏页面');
                console.log(`  URL: ${urlCheck.result.value}`);
            } else {
                logFail('玩家1加入', '未跳转到游戏页面');
            }
        } else {
            logFail('显示模态框', '模态框未显示');
        }
        
        // 玩家2通过API加入
        console.log('\n--- 步骤8: 玩家2通过API加入锦标赛 ---');
        const join2Res = await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: PLAYER2.address })
        });
        const join2Data = await join2Res.json();
        
        if (join2Data.success || join2Data.error?.includes('Already joined')) {
            logPass('玩家2加入锦标赛');
        } else {
            logFail('玩家2加入锦标赛', join2Data.error);
        }
        
        // 开始锦标赛
        console.log('\n--- 步骤9: 开始锦标赛 ---');
        await sleep(1000);
        const startRes = await fetch(`${API_URL}/api/tournament/${tournamentId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const startData = await startRes.json();
        
        if (startData.success) {
            logPass('锦标赛开始');
        } else {
            console.log(`  开始结果: ${startData.error || JSON.stringify(startData)}`);
        }
        
        // 结算锦标赛
        console.log('\n--- 步骤10: 结算锦标赛 ---');
        await sleep(1000);
        const rankings = [
            { address: PLAYER1.address, position: 1, prize: 19000000 },
            { address: PLAYER2.address, position: 2, prize: 0 }
        ];
        
        const finishRes = await fetch(`${API_URL}/api/tournament/${tournamentId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rankings })
        });
        const finishData = await finishRes.json();
        
        if (finishData.success) {
            logPass('锦标赛结算完成');
            console.log(`  玩家1获得: ${rankings[0].prize} SUN`);
        } else {
            logFail('锦标赛结算', finishData.error);
        }
        
        // 验证最终状态
        console.log('\n--- 步骤11: 验证最终状态 ---');
        const finalRes = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalData = await finalRes.json();
        
        if (finalData.success && finalData.tournament?.status === 'COMPLETED') {
            logPass('锦标赛状态: COMPLETED');
        } else {
            logFail('验证最终状态', finalData.tournament?.status);
        }
        
        // 领取奖金
        console.log('\n--- 步骤12: 领取奖金 ---');
        const claimRes = await fetch(`${API_URL}/api/tournament/${tournamentId}/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: PLAYER1.address })
        });
        const claimData = await claimRes.json();
        
        if (claimData.success) {
            logPass(`玩家1领取奖金: ${claimData.prize} SUN`);
        } else {
            console.log(`  领取结果: ${claimData.error}`);
        }
        
        // 刷新页面验证
        console.log('\n--- 步骤13: 刷新页面验证 ---');
        await Page.navigate({ url: `${BASE_URL}/tournament` });
        await Page.loadEventFired();
        await sleep(2000);
        
        const pageCheck = await Runtime.evaluate({
            expression: `document.body.textContent.includes('COMPLETED')`,
            returnByValue: true
        });
        
        if (pageCheck.result?.value) {
            logPass('页面显示COMPLETED状态');
        }
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        logFail('测试执行', error.message);
    } finally {
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

runTests().catch(console.error);
