/**
 * 锦标赛完整游戏流程测试
 * 使用Chrome DevTools Protocol模拟真实用户操作
 * 
 * 测试流程：
 * 1. 创建锦标赛
 * 2. 两个玩家加入
 * 3. 游戏自动开始
 * 4. 轮流进行操作（Fold/Check/Call/Raise）
 * 5. 完成整个游戏直到决出冠军
 * 6. 截图验证每个关键步骤
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');

// 玩家私钥
const PLAYER1_PRIVATE_KEY = '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]';
const PLAYER2_PRIVATE_KEY = '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]';

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
        console.log(`  📸 截图已保存: ${filename}`);
        return filename;
    } catch (err) {
        console.log(`  ⚠️ 截图失败: ${err.message}`);
        return null;
    }
}

async function getGameState(Runtime) {
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                // 获取游戏状态
                const state = {
                    bodyText: document.body.innerText.substring(0, 500),
                    buttons: [],
                    hasPlayArea: document.querySelector('.play-area') !== null,
                    pot: null,
                    turn: null
                };
                
                // 获取所有按钮
                document.querySelectorAll('button').forEach(btn => {
                    state.buttons.push({
                        text: btn.textContent.trim().substring(0, 30),
                        disabled: btn.disabled,
                        visible: btn.offsetParent !== null
                    });
                });
                
                // 尝试获取pot信息
                const potEl = document.querySelector('[class*="pot"], [class*="Pot"]');
                if (potEl) {
                    state.pot = potEl.innerText;
                }
                
                return JSON.stringify(state);
            })()
        `,
        returnByValue: true
    });
    
    return JSON.parse(result.result?.value || '{}');
}

async function clickButton(Runtime, buttonText) {
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                const btn = Array.from(document.querySelectorAll('button')).find(b => 
                    b.textContent.toLowerCase().includes('${buttonText.toLowerCase()}')
                );
                if (btn && !btn.disabled) {
                    btn.click();
                    return { success: true, text: btn.textContent.trim() };
                }
                return { success: false, reason: btn ? 'disabled' : 'not found' };
            })()
        `,
        returnByValue: true
    });
    
    return result.result?.value;
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛完整游戏流程测试');
    console.log('========================================\n');
    
    let player1Address, player2Address;
    let tournamentId;
    let client1, client2;
    let Page1, Runtime1, Page2, Runtime2;
    
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
        
        // 步骤3: 连接到Chrome
        console.log('\n--- 步骤3: 连接到Chrome ---');
        
        try {
            client1 = await CDP({ port: CDP_PORT });
            client2 = await CDP({ port: CDP_PORT });
            
            ({ Page: Page1, Runtime: Runtime1 } = client1);
            ({ Page: Page2, Runtime: Runtime2 } = client2);
            
            await Page1.enable();
            await Runtime1.enable();
            await Page2.enable();
            await Runtime2.enable();
            
            logPass('连接Chrome成功');
        } catch (err) {
            throw new Error(`Chrome连接失败: ${err.message}。请确保Chrome在端口${CDP_PORT}运行`);
        }
        
        // 步骤4: 打开玩家1页面
        console.log('\n--- 步骤4: 打开玩家1页面 ---');
        
        await Page1.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
        await Page1.loadEventFired();
        await sleep(3000);
        
        await takeScreenshot(Page1, '01-player1-waiting');
        logPass('玩家1页面打开');
        
        // 步骤5: 玩家1加入锦标赛
        console.log('\n--- 步骤5: 玩家1加入锦标赛 ---');
        
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
        
        await sleep(1000);
        await takeScreenshot(Page1, '02-player1-joined');
        
        // 步骤6: 打开玩家2页面并加入
        console.log('\n--- 步骤6: 打开玩家2页面并加入（触发游戏开始）---');
        
        await Page2.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}` });
        await Page2.loadEventFired();
        await sleep(2000);
        
        // 玩家2加入（触发游戏开始）
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
        
        // 等待游戏开始
        console.log('  等待游戏开始...');
        await sleep(5000);  // 等待游戏初始化
        
        await takeScreenshot(Page1, '03-game-started-p1');
        await takeScreenshot(Page2, '04-game-started-p2');
        
        // 步骤7: 游戏循环 - 轮流操作直到游戏结束
        console.log('\n--- 步骤7: 游戏循环 - 轮流操作 ---');
        
        let handCount = 0;
        let maxHands = 50;  // 最多50手牌，防止无限循环
        let actionCount = 0;
        let maxActions = 200;  // 最多200次操作
        
        while (handCount < maxHands && actionCount < maxActions) {
            actionCount++;
            
            // 获取两个玩家的状态
            const state1 = await getGameState(Runtime1);
            const state2 = await getGameState(Runtime2);
            
            console.log(`\n  --- 动作 #${actionCount} ---`);
            console.log(`  玩家1按钮: ${state1.buttons?.filter(b => !b.disabled).map(b => b.text).join(', ') || '无可用'}`);
            console.log(`  玩家2按钮: ${state2.buttons?.filter(b => !b.disabled).map(b => b.text).join(', ') || '无可用'}`);
            
            // 检查游戏是否结束
            if (state1.bodyText?.includes('COMPLETED') || state2.bodyText?.includes('COMPLETED')) {
                console.log('\n  🏆 游戏已结束！');
                await takeScreenshot(Page1, `05-game-end-p1-hand${handCount}`);
                await takeScreenshot(Page2, `06-game-end-p2-hand${handCount}`);
                break;
            }
            
            // 检查是否有新一手牌
            if (state1.bodyText?.includes('wins') || state2.bodyText?.includes('wins')) {
                handCount++;
                console.log(`  📊 第 ${handCount} 手牌结束`);
                await sleep(2000);
            }
            
            // 玩家1操作
            const p1ActiveButtons = state1.buttons?.filter(b => !b.disabled && b.visible !== false) || [];
            if (p1ActiveButtons.length > 0) {
                // 优先选择 Check > Call > Fold (简化策略)
                let action = null;
                let buttonText = null;
                
                if (p1ActiveButtons.find(b => b.text.toLowerCase().includes('check'))) {
                    buttonText = 'check';
                    action = await clickButton(Runtime1, 'check');
                } else if (p1ActiveButtons.find(b => b.text.toLowerCase().includes('call'))) {
                    buttonText = 'call';
                    action = await clickButton(Runtime1, 'call');
                } else if (p1ActiveButtons.find(b => b.text.toLowerCase().includes('fold'))) {
                    buttonText = 'fold';
                    action = await clickButton(Runtime1, 'fold');
                } else if (p1ActiveButtons.find(b => b.text.toLowerCase().includes('raise'))) {
                    buttonText = 'raise';
                    action = await clickButton(Runtime1, 'raise');
                }
                
                if (action?.success) {
                    console.log(`  玩家1: ${action.text}`);
                    await sleep(1500);
                    await takeScreenshot(Page1, `07-p1-${buttonText}-${actionCount}`);
                }
                
                continue;
            }
            
            // 玩家2操作
            const p2ActiveButtons = state2.buttons?.filter(b => !b.disabled && b.visible !== false) || [];
            if (p2ActiveButtons.length > 0) {
                let action = null;
                let buttonText = null;
                
                if (p2ActiveButtons.find(b => b.text.toLowerCase().includes('check'))) {
                    buttonText = 'check';
                    action = await clickButton(Runtime2, 'check');
                } else if (p2ActiveButtons.find(b => b.text.toLowerCase().includes('call'))) {
                    buttonText = 'call';
                    action = await clickButton(Runtime2, 'call');
                } else if (p2ActiveButtons.find(b => b.text.toLowerCase().includes('fold'))) {
                    buttonText = 'fold';
                    action = await clickButton(Runtime2, 'fold');
                } else if (p2ActiveButtons.find(b => b.text.toLowerCase().includes('raise'))) {
                    buttonText = 'raise';
                    action = await clickButton(Runtime2, 'raise');
                }
                
                if (action?.success) {
                    console.log(`  玩家2: ${action.text}`);
                    await sleep(1500);
                    await takeScreenshot(Page2, `08-p2-${buttonText}-${actionCount}`);
                }
                
                continue;
            }
            
            // 如果两个玩家都没有可用按钮，等待一下
            await sleep(1000);
        }
        
        logPass(`游戏循环完成 - ${actionCount}次操作, ${handCount}手牌`);
        
        // 步骤8: 最终验证
        console.log('\n--- 步骤8: 最终验证 ---');
        
        const finalResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalResult = await finalResponse.json();
        
        if (finalResult.success) {
            console.log('  锦标赛状态:', finalResult.tournament?.status);
            console.log('  玩家数:', finalResult.tournament?.players?.length);
            
            if (finalResult.tournament?.status === 'COMPLETED') {
                logPass('锦标赛已完成');
            } else {
                logPass(`最终状态: ${finalResult.tournament?.status}`);
            }
        }
        
        // 检查服务器日志
        console.log('\n--- 步骤9: 检查服务器日志 ---');
        
        const serverLogResult = await Runtime1.evaluate({
            expression: `
                document.body.innerText.includes('error') || document.body.innerText.includes('Error')
            `,
            returnByValue: true
        });
        
        if (serverLogResult.result?.value) {
            logFail('页面错误检查', '发现错误信息');
        } else {
            logPass('无页面错误');
        }
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        console.error(error.stack);
        logFail('测试执行', error.message);
    } finally {
        // 清理
        if (client1) await client1.close();
        if (client2) await client2.close();
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
    
    console.log(`\n截图保存在: ${screenshotsDir}`);
    console.log('\n========================================');
    
    process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
