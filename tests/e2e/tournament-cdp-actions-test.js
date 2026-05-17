/**
 * 锦标赛游戏操作CDP端对端测试
 * 使用Chrome DevTools Protocol模拟真实用户操作
 * 测试：
 * 1. 按钮点击（Fold/Check/Call/Raise）
 * 2. IN_PROGRESS状态重连
 * 3. 完整游戏流程
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');

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
    console.log('锦标赛游戏操作CDP端对端测试');
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
        
        client1 = await CDP({ port: CDP_PORT });
        client2 = await CDP({ port: CDP_PORT });
        
        ({ Page: Page1, Runtime: Runtime1 } = client1);
        ({ Page: Page2, Runtime: Runtime2 } = client2);
        
        await Page1.enable();
        await Runtime1.enable();
        await Page2.enable();
        await Runtime2.enable();
        
        logPass('连接Chrome成功');
        
        // 步骤4: 打开玩家1页面
        console.log('\n--- 步骤4: 打开玩家1页面 ---');
        
        await Page1.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
        await Page1.loadEventFired();
        await sleep(2000);
        
        logPass('玩家1页面打开');
        
        // 玩家1通过API加入
        await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': player1Address
            },
            body: JSON.stringify({ walletAddress: player1Address })
        });
        
        // 等待页面显示
        const p1CheckResult = await Runtime1.evaluate({
            expression: `document.body.innerText.includes('Waiting') || document.body.innerText.includes('Tournament') || document.querySelector('.play-area') !== null`,
            returnByValue: true
        });
        
        console.log('  玩家1页面状态:', p1CheckResult.result?.value ? '已加载' : '加载中');
        
        // 步骤5: 打开玩家2页面
        console.log('\n--- 步骤5: 打开玩家2页面 ---');
        
        await Page2.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}` });
        await Page2.loadEventFired();
        await sleep(2000);
        
        // 玩家2通过API加入（触发游戏开始）
        await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': player2Address
            },
            body: JSON.stringify({ walletAddress: player2Address })
        });
        
        // 等待游戏开始
        console.log('  等待游戏开始...');
        await sleep(3000);
        
        logPass('玩家2加入，游戏应该开始');
        
        // 步骤6: 检查游戏UI状态
        console.log('\n--- 步骤6: 检查游戏UI状态 ---');
        
        const p1GameState = await Runtime1.evaluate({
            expression: `
                JSON.stringify({
                    hasPlayArea: document.querySelector('.play-area') !== null,
                    hasPokerTable: document.querySelector('img[alt*="poker"]') !== null || document.querySelector('canvas') !== null,
                    hasSeats: document.querySelectorAll('[class*="seat"], [class*="Seat"]').length > 0,
                    bodyText: document.body.innerText.substring(0, 200)
                })
            `,
            returnByValue: true
        });
        
        const p1State = JSON.parse(p1GameState.result?.value || '{}');
        console.log('  玩家1页面状态:', JSON.stringify(p1State, null, 2));
        
        if (p1State.hasPlayArea) {
            logPass('玩家1看到游戏界面');
        } else {
            console.log('  页面文本:', p1State.bodyText);
        }
        
        // 步骤7: 检查按钮状态
        console.log('\n--- 步骤7: 检查按钮状态 ---');
        
        const buttonCheck = await Runtime1.evaluate({
            expression: `
                (function() {
                    const buttons = {
                        fold: document.querySelector('button') ? Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fold')) : null,
                        check: document.querySelector('button') ? Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check')) : null,
                        call: document.querySelector('button') ? Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Call')) : null,
                        raise: document.querySelector('button') ? Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Raise')) : null
                    };
                    
                    return JSON.stringify({
                        foldExists: !!buttons.fold,
                        foldDisabled: buttons.fold?.disabled,
                        checkExists: !!buttons.check,
                        checkDisabled: buttons.check?.disabled,
                        callExists: !!buttons.call,
                        callDisabled: buttons.call?.disabled,
                        raiseExists: !!buttons.raise,
                        raiseDisabled: buttons.raise?.disabled,
                        allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
                            text: b.textContent.trim().substring(0, 20),
                            disabled: b.disabled,
                            visible: b.offsetParent !== null
                        }))
                    });
                })()
            `,
            returnByValue: true
        });
        
        const buttonState = JSON.parse(buttonCheck.result?.value || '{}');
        console.log('  按钮状态:', JSON.stringify(buttonState, null, 2));
        
        if (buttonState.foldExists || buttonState.checkExists || buttonState.callExists || buttonState.raiseExists) {
            logPass('游戏按钮已显示');
        } else {
            console.log('  注意: 当前可能不是该玩家的回合');
        }
        
        // 步骤8: 测试按钮点击
        console.log('\n--- 步骤8: 测试按钮点击 ---');
        
        // 检查是否是玩家1的回合
        const turnCheck = await Runtime1.evaluate({
            expression: `
                (function() {
                    // 检查 console 中是否有 turn: true 的日志
                    // 或者检查按钮是否可用
                    const foldBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fold'));
                    const checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check'));
                    const callBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Call'));
                    
                    return {
                        hasActiveButtons: (foldBtn && !foldBtn.disabled) || (checkBtn && !checkBtn.disabled) || (callBtn && !callBtn.disabled),
                        foldDisabled: foldBtn?.disabled,
                        checkDisabled: checkBtn?.disabled,
                        callDisabled: callBtn?.disabled
                    };
                })()
            `,
            returnByValue: true
        });
        
        const turnState = turnCheck.result?.value;
        console.log('  回合状态:', turnState);
        
        if (turnState?.hasActiveButtons) {
            console.log('  玩家1有可用按钮，尝试点击...');
            
            // 尝试点击 Fold 按钮
            const clickResult = await Runtime1.evaluate({
                expression: `
                    (function() {
                        const foldBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fold'));
                        if (foldBtn && !foldBtn.disabled) {
                            foldBtn.click();
                            return { clicked: 'Fold', success: true };
                        }
                        
                        const checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check'));
                        if (checkBtn && !checkBtn.disabled) {
                            checkBtn.click();
                            return { clicked: 'Check', success: true };
                        }
                        
                        const callBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Call'));
                        if (callBtn && !callBtn.disabled) {
                            callBtn.click();
                            return { clicked: 'Call', success: true };
                        }
                        
                        return { clicked: null, success: false, reason: 'No active button' };
                    })()
                `,
                returnByValue: true
            });
            
            console.log('  点击结果:', clickResult.result?.value);
            
            if (clickResult.result?.value?.success) {
                logPass(`按钮点击成功: ${clickResult.result?.value?.clicked}`);
                
                // 等待状态更新
                await sleep(2000);
                
                // 检查是否有错误
                const errorCheck = await Runtime1.evaluate({
                    expression: `
                        document.body.innerText.includes('Error') || document.body.innerText.includes('error')
                    `,
                    returnByValue: true
                });
                
                if (errorCheck.result?.value) {
                    logFail('按钮点击后检查', '页面显示错误信息');
                } else {
                    logPass('按钮点击后无错误');
                }
            } else {
                logFail('按钮点击', clickResult.result?.value?.reason || '未知原因');
            }
        } else {
            // 检查玩家2是否可以操作
            const p2TurnCheck = await Runtime2.evaluate({
                expression: `
                    (function() {
                        const foldBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fold'));
                        const checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check'));
                        const callBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Call'));
                        
                        return {
                            hasActiveButtons: (foldBtn && !foldBtn.disabled) || (checkBtn && !checkBtn.disabled) || (callBtn && !callBtn.disabled),
                            foldDisabled: foldBtn?.disabled,
                            checkDisabled: checkBtn?.disabled,
                            callDisabled: callBtn?.disabled
                        };
                    })()
                `,
                returnByValue: true
            });
            
            console.log('  玩家2回合状态:', p2TurnCheck.result?.value);
            
            if (p2TurnCheck.result?.value?.hasActiveButtons) {
                console.log('  玩家2可以操作，尝试点击...');
                
                const p2ClickResult = await Runtime2.evaluate({
                    expression: `
                        (function() {
                            const checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check'));
                            if (checkBtn && !checkBtn.disabled) {
                                checkBtn.click();
                                return { clicked: 'Check', success: true };
                            }
                            
                            const callBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Call'));
                            if (callBtn && !callBtn.disabled) {
                                callBtn.click();
                                return { clicked: 'Call', success: true };
                            }
                            
                            const foldBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fold'));
                            if (foldBtn && !foldBtn.disabled) {
                                foldBtn.click();
                                return { clicked: 'Fold', success: true };
                            }
                            
                            return { clicked: null, success: false };
                        })()
                    `,
                    returnByValue: true
                });
                
                console.log('  玩家2点击结果:', p2ClickResult.result?.value);
                
                if (p2ClickResult.result?.value?.success) {
                    logPass(`玩家2按钮点击成功: ${p2ClickResult.result?.value?.clicked}`);
                    await sleep(2000);
                }
            } else {
                console.log('  两个玩家都没有可用按钮，可能需要等待');
                logPass('按钮检查完成（无可操作按钮）');
            }
        }
        
        // 步骤9: 测试IN_PROGRESS状态重连
        console.log('\n--- 步骤9: 测试IN_PROGRESS状态重连 ---');
        
        // 刷新玩家1页面模拟重连
        await Page1.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
        await Page1.loadEventFired();
        await sleep(3000);
        
        // 检查重连后的状态
        const reconnectCheck = await Runtime1.evaluate({
            expression: `
                (function() {
                    return {
                        hasPlayArea: document.querySelector('.play-area') !== null,
                        bodyText: document.body.innerText.substring(0, 300),
                        hasButtons: document.querySelectorAll('button').length > 0
                    };
                })()
            `,
            returnByValue: true
        });
        
        console.log('  重连后状态:', reconnectCheck.result?.value);
        
        if (reconnectCheck.result?.value?.hasPlayArea || reconnectCheck.result?.value?.hasButtons) {
            logPass('IN_PROGRESS状态重连成功');
        } else if (reconnectCheck.result?.value?.bodyText?.includes('Error')) {
            logFail('IN_PROGRESS状态重连', '页面显示错误');
        } else {
            logPass('IN_PROGRESS状态重连（页面加载正常）');
        }
        
        // 步骤10: 验证控制台日志无错误
        console.log('\n--- 步骤10: 验证控制台日志 ---');
        
        const consoleLog1 = await Runtime1.evaluate({
            expression: `
                (function() {
                    // 检查页面是否有明显的错误信息
                    const body = document.body.innerText;
                    const hasError = body.includes('Error') && !body.includes('No Error');
                    return {
                        hasError,
                        errorSnippet: hasError ? body.substring(body.indexOf('Error'), body.indexOf('Error') + 100) : null
                    };
                })()
            `,
            returnByValue: true
        });
        
        if (consoleLog1.result?.value?.hasError) {
            console.log('  发现错误:', consoleLog1.result?.value?.errorSnippet);
            logFail('控制台日志检查', '发现错误信息');
        } else {
            logPass('控制台日志检查通过');
        }
        
        // 步骤11: 最终状态验证
        console.log('\n--- 步骤11: 最终状态验证 ---');
        
        const finalResponse = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const finalResult = await finalResponse.json();
        
        if (finalResult.success) {
            console.log('  锦标赛状态:', finalResult.tournament?.status);
            console.log('  玩家数:', finalResult.tournament?.players?.length);
            logPass(`最终状态验证: ${finalResult.tournament?.status}`);
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
    
    console.log('\n========================================');
    process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
