/**
 * 锦标赛完整测试 - 最终版
 * 测试多手牌的完整流程
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');
const { TronWeb } = require('tronweb');

const API_BASE = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';
const CDP_PORT = 9222;

const PLAYER1_PRIVATE_KEY = 'a1a2a3a4a5a6a7a8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2';
const PLAYER2_PRIVATE_KEY = 'b1b2b3b4b5b6b7b8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2';

const tronWeb = new TronWeb({ fullHost: 'https://api.shasta.trongrid.io' });

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
    console.log('=== Tournament Multi-Hand Final Test ===\n');
    
    let client;
    
    try {
        const player1Address = await tronWeb.address.fromPrivateKey(PLAYER1_PRIVATE_KEY);
        const player2Address = await tronWeb.address.fromPrivateKey(PLAYER2_PRIVATE_KEY);
        console.log(`Player 1: ${player1Address}`);
        console.log(`Player 2: ${player2Address}\n`);
        
        // 1. 创建锦标赛
        console.log('Step 1: Creating tournament...');
        const createRes = await axios.post(`${API_BASE}/api/tournament/create`, {
            configId: 3
        }, {
            headers: { 'x-wallet-address': player1Address }
        });
        const tournamentId = createRes.data.tournamentId || createRes.data.tournament?.tournamentId;
        console.log(`Tournament created: ${tournamentId}\n`);
        
        // 2. Player 1 通过 API 加入
        console.log('Step 2: Player 1 joining via API...');
        await axios.post(`${API_BASE}/api/tournament/${tournamentId}/join`, {}, {
            headers: { 'x-wallet-address': player1Address }
        });
        
        // 3. Player 2 通过 API 加入 - 锦标赛开始
        console.log('Step 3: Player 2 joining via API (tournament starts)...');
        await axios.post(`${API_BASE}/api/tournament/${tournamentId}/join`, {}, {
            headers: { 'x-wallet-address': player2Address }
        });
        
        // 等待锦标赛开始
        await sleep(5000);
        
        // 4. 连接 CDP
        console.log('\nStep 4: Connecting to Chrome...');
        client = await CDP({ port: CDP_PORT });
        const { Runtime, Page } = client;
        await Runtime.enable();
        await Page.enable();
        
        // 5. 打开 Player 2 页面（因为 Player 2 轮到）
        console.log('Step 5: Opening Player 2 page (Player 2 is first to act)...');
        await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}` });
        await sleep(6000);
        
        // 6. 检查页面内容
        console.log('\nStep 6: Checking Player 2 page...');
        
        const content = await Runtime.evaluate({
            expression: `document.body.innerText`
        });
        console.log(`Page content:\n${content.result.value?.substring(0, 600)}`);
        
        // 7. 检查按钮
        console.log('\nStep 7: Checking buttons...');
        
        const buttonsText = await Runtime.evaluate({
            expression: `
                (function() {
                    const buttons = document.body ? document.body.querySelectorAll('button') : [];
                    const result = [];
                    for (let i = 0; i < buttons.length; i++) {
                        result.push(buttons[i].textContent.trim());
                    }
                    return result.join('|');
                })()
            `
        });
        
        console.log(`Buttons: ${buttonsText.result.value}`);
        
        const hasActionButtons = (buttonsText.result.value || '').toLowerCase().includes('fold');
        
        if (!hasActionButtons) {
            console.log('\n❌ No action buttons found. Checking server logs...');
            
            // 尝试刷新页面
            console.log('Refreshing page...');
            await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}` });
            await sleep(5000);
            
            const buttonsAfterRefresh = await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.body ? document.body.querySelectorAll('button') : [];
                        const result = [];
                        for (let i = 0; i < buttons.length; i++) {
                            result.push(buttons[i].textContent.trim());
                        }
                        return result.join('|');
                    })()
                `
            });
            
            console.log(`Buttons after refresh: ${buttonsAfterRefresh.result.value}`);
            
            if (!(buttonsAfterRefresh.result.value || '').toLowerCase().includes('fold')) {
                console.log('Still no buttons - there may be an issue');
                return;
            }
        }
        
        // 8. 执行 Fold 操作（第一手）
        console.log('\nStep 8: Playing first hand - clicking Fold...');
        
        const foldResult = await Runtime.evaluate({
            expression: `
                (function() {
                    const buttons = document.body ? document.body.querySelectorAll('button') : [];
                    for (let i = 0; i < buttons.length; i++) {
                        if (buttons[i].textContent.toLowerCase().includes('fold')) {
                            buttons[i].click();
                            return 'Fold clicked';
                        }
                    }
                    return 'No fold button';
                })()
            `
        });
        console.log(`Result: ${foldResult.result.value}`);
        
        // 等待第一手结束
        console.log('\nWaiting for first hand to end...');
        await sleep(5000);
        
        // 9. 检查第一手结束后的状态
        console.log('\nStep 9: Checking state after first hand...');
        
        const afterHand1 = await Runtime.evaluate({
            expression: `document.body.innerText.substring(0, 500)`
        });
        console.log(`Page after hand 1:\n${afterHand1.result.value}`);
        
        // 10. 等待第二手开始
        console.log('\nStep 10: Waiting for second hand (3s delay + buffer)...');
        await sleep(6000);
        
        // 11. 检查第二手是否开始 - 打开玩家1的页面（因为玩家1轮到）
        console.log('\nStep 11: Opening Player 1 page (Player 1 should be acting)...');
        await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
        await sleep(5000);
        
        const buttonsHand2 = await Runtime.evaluate({
            expression: `
                (function() {
                    const buttons = document.body ? document.body.querySelectorAll('button') : [];
                    const btnTexts = [];
                    for (let i = 0; i < buttons.length; i++) {
                        btnTexts.push(buttons[i].textContent.trim());
                    }
                    return btnTexts.join('|');
                })()
            `
        });
        
        const hasHand2Buttons = (buttonsHand2.result.value || '').toLowerCase().includes('fold');
        
        console.log(`Player 1 buttons for hand 2: ${buttonsHand2.result.value}`);
        
        if (hasHand2Buttons) {
            console.log('\n✅ SUCCESS: Second hand started!');
            
            // 执行第二手的 fold
            await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.body ? document.body.querySelectorAll('button') : [];
                        for (let i = 0; i < buttons.length; i++) {
                            if (buttons[i].textContent.toLowerCase().includes('fold')) {
                                buttons[i].click();
                                return true;
                            }
                        }
                        return false;
                    })()
                `
            });
            console.log('Fold clicked in second hand');
            
            await sleep(5000);
            
            // 检查第三手 - 打开玩家2的页面（玩家2应该轮到）
            console.log('\nChecking for third hand...');
            await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}` });
            await sleep(5000);
            
            const buttonsHand3 = await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.body ? document.body.querySelectorAll('button') : [];
                        const btnTexts = [];
                        for (let i = 0; i < buttons.length; i++) {
                            btnTexts.push(buttons[i].textContent.trim());
                        }
                        return btnTexts.join('|');
                    })()
                `
            });
            
            const hasActionButtons3 = (buttonsHand3.result.value || '').toLowerCase().includes('fold');
            
            if (hasActionButtons3) {
                console.log('✅ Third hand started! Multi-hand tournament is working correctly!');
                
                // 执行第三手的 fold
                await Runtime.evaluate({
                    expression: `
                        (function() {
                            const buttons = document.body ? document.body.querySelectorAll('button') : [];
                            for (let i = 0; i < buttons.length; i++) {
                                if (buttons[i].textContent.toLowerCase().includes('fold')) {
                                    buttons[i].click();
                                    return true;
                                }
                            }
                            return false;
                        })()
                    `
                });
                console.log('Fold clicked in third hand');
                
                await sleep(5000);
                
                // 检查第四手
                const buttonsHand4 = await Runtime.evaluate({
                    expression: `
                        (function() {
                            const buttons = document.body ? document.body.querySelectorAll('button') : [];
                            for (let i = 0; i < buttons.length; i++) {
                                if (buttons[i].textContent.toLowerCase().includes('fold')) {
                                    return true;
                                }
                            }
                            return false;
                        })()
                    `
                });
                
                if (buttonsHand4.result.value) {
                    console.log('✅ Fourth hand started! Tournament continues correctly!');
                } else {
                    console.log('Tournament may have ended after hand 3');
                }
            } else {
                console.log(`Player 2 buttons for hand 3: ${buttonsHand3.result.value}`);
                console.log('Tournament may have ended after hand 2');
            }
        } else {
            console.log('\n❌ FAILURE: Second hand did NOT start');
            
            const pageText = await Runtime.evaluate({
                expression: `document.body.innerText.substring(0, 500)`
            });
            console.log(`Final page state:\n${pageText.result.value}`);
        }
        
        await client.close();
        
    } catch (error) {
        console.error('Test error:', error.message);
        console.error(error.stack);
        if (client) await client.close().catch(() => {});
    }
    
    console.log('\nTest completed');
}

runTest().catch(console.error);
