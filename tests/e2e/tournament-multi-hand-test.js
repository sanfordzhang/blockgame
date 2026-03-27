/**
 * 锦标赛完整流程测试 - 包含多手牌
 * 正确的时序：玩家先打开页面，然后锦标赛才开始
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

// CDP 辅助函数
async function createCDPClient() {
    return await CDP({ port: CDP_PORT });
}

async function runTest() {
    console.log('=== Tournament Multi-Hand Test ===\n');
    
    let client1, client2;
    let Runtime1, Runtime2, Page1, Page2;
    
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
        
        // 2. 连接两个 CDP 客户端（一个接一个，避免连接冲突）
        console.log('Step 2: Setting up CDP clients...');
        
        client1 = await createCDPClient();
        ({ Runtime: Runtime1, Page: Page1 } = client1);
        await Runtime1.enable();
        await Page1.enable();
        
        // 获取当前 Target
        const targets1 = await client1.send('Target.getTargets');
        console.log(`Client 1 targets: ${targets1.targetInfos?.length || 0}`);
        
        // 等待一下再连接第二个客户端
        await sleep(1000);
        
        client2 = await createCDPClient();
        ({ Runtime: Runtime2, Page: Page2 } = client2);
        await Runtime2.enable();
        await Page2.enable();
        
        console.log('CDP clients ready\n');
        
        // 3. Player 1 打开页面（锦标赛还在等待中）
        console.log('Step 3: Player 1 opening page...');
        await Page1.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
        await sleep(3000);
        
        // 检查等待状态
        const p1Waiting = await Runtime1.evaluate({
            expression: `document.body.innerText.includes('Waiting') || document.body.innerText.includes('waiting')`
        });
        console.log(`Player 1 waiting for players: ${p1Waiting.result.value}`);
        
        // 4. Player 2 打开页面 - 这会触发锦标赛开始
        console.log('\nStep 4: Player 2 opening page (should trigger start)...');
        await Page2.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}` });
        await sleep(8000); // 等待锦标赛开始和游戏状态广播
        
        // 5. 检查游戏是否开始
        console.log('\nStep 5: Checking game state...');
        
        const p1Content = await Runtime1.evaluate({
            expression: `document.body.innerText`
        });
        console.log(`Player 1 page content (first 200 chars): ${p1Content.result.value?.substring(0, 200)}`);
        
        const p2Content = await Runtime2.evaluate({
            expression: `document.body.innerText`
        });
        console.log(`Player 2 page content (first 200 chars): ${p2Content.result.value?.substring(0, 200)}`);
        
        // 6. 检查操作按钮
        console.log('\nStep 6: Checking action buttons...');
        
        // 首先检查页面的 HTML 结构
        const p1Html = await Runtime1.evaluate({
            expression: `
                (function() {
                    // 检查包含 Fold 文本的所有元素
                    const allElements = document.querySelectorAll('*');
                    const foldElements = [];
                    for (const el of allElements) {
                        if (el.textContent && el.textContent.toLowerCase().includes('fold')) {
                            foldElements.push({
                                tag: el.tagName,
                                className: el.className,
                                id: el.id,
                                text: el.textContent.substring(0, 50)
                            });
                        }
                    }
                    return foldElements.slice(0, 10);
                })()
            `
        });
        console.log('Elements containing "Fold":', JSON.stringify(p1Html.result.value, null, 2));
        
        const getButtons = async (Runtime) => {
            const result = await Runtime.evaluate({
                expression: `
                    (function() {
                        // 尝试多种选择器
                        const buttonSelectors = ['button', '[role="button"]', '.btn', 'input[type="button"]'];
                        let allButtons = [];
                        
                        for (const selector of buttonSelectors) {
                            const btns = Array.from(document.querySelectorAll(selector));
                            allButtons = allButtons.concat(btns.map(b => ({
                                tag: b.tagName,
                                text: b.textContent.trim(),
                                className: b.className
                            })));
                        }
                        
                        // 也检查所有可点击元素
                        const clickables = Array.from(document.querySelectorAll('[onclick], [role="button"], .clickable'));
                        allButtons = allButtons.concat(clickables.map(b => ({
                            tag: b.tagName,
                            text: b.textContent.trim(),
                            className: b.className
                        })));
                        
                        // 去重
                        const unique = [];
                        const seen = new Set();
                        for (const b of allButtons) {
                            const key = b.text + b.tag;
                            if (!seen.has(key) && b.text) {
                                seen.add(key);
                                unique.push(b.text);
                            }
                        }
                        
                        return unique;
                    })()
                `
            });
            return result.result.value || [];
        };
        
        const p1Buttons = await getButtons(Runtime1);
        const p2Buttons = await getButtons(Runtime2);
        
        console.log(`Player 1 buttons: ${JSON.stringify(p1Buttons)}`);
        console.log(`Player 2 buttons: ${JSON.stringify(p2Buttons)}`);
        
        const p1HasAction = p1Buttons.some(b => 
            b.toLowerCase().includes('fold') || 
            b.toLowerCase().includes('check') ||
            b.toLowerCase().includes('call') ||
            b.toLowerCase().includes('raise')
        );
        const p2HasAction = p2Buttons.some(b => 
            b.toLowerCase().includes('fold') || 
            b.toLowerCase().includes('check') ||
            b.toLowerCase().includes('call') ||
            b.toLowerCase().includes('raise')
        );
        
        console.log(`Player 1 has action buttons: ${p1HasAction}`);
        console.log(`Player 2 has action buttons: ${p2HasAction}`);
        
        if (!p1HasAction && !p2HasAction) {
            console.log('\n❌ Game did not start properly - no action buttons found');
            return;
        }
        
        // 7. 执行 fold 操作
        console.log('\nStep 7: Playing first hand...');
        
        const clickFold = async (Runtime, name) => {
            const result = await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        const foldBtn = buttons.find(b => b.textContent.toLowerCase().includes('fold'));
                        if (foldBtn) {
                            foldBtn.click();
                            return 'Fold clicked';
                        }
                        return 'No fold button';
                    })()
                `
            });
            return result.result.value;
        };
        
        if (p1HasAction) {
            const result = await clickFold(Runtime1, 'Player 1');
            console.log(`Player 1: ${result}`);
        } else if (p2HasAction) {
            const result = await clickFold(Runtime2, 'Player 2');
            console.log(`Player 2: ${result}`);
        }
        
        // 等待第一手结束
        console.log('\nWaiting for first hand to end...');
        await sleep(5000);
        
        // 8. 检查第一手是否结束
        console.log('\nStep 8: Checking if first hand ended...');
        
        const p1ContentAfter = await Runtime1.evaluate({
            expression: `document.body.innerText`
        });
        console.log(`Player 1 page after hand (first 300 chars): ${p1ContentAfter.result.value?.substring(0, 300)}`);
        
        // 9. 等待第二手开始
        console.log('\nStep 9: Waiting for second hand to start (3s delay + buffer)...');
        await sleep(5000);
        
        // 10. 检查第二手是否开始
        console.log('\nStep 10: Checking if second hand started...');
        
        const p1Buttons2 = await getButtons(Runtime1);
        const p2Buttons2 = await getButtons(Runtime2);
        
        console.log(`Player 1 buttons (hand 2): ${JSON.stringify(p1Buttons2)}`);
        console.log(`Player 2 buttons (hand 2): ${JSON.stringify(p2Buttons2)}`);
        
        const hasGameButtons = (buttons) => buttons.some(b => 
            b.toLowerCase().includes('fold') || 
            b.toLowerCase().includes('check') ||
            b.toLowerCase().includes('call') ||
            b.toLowerCase().includes('raise')
        );
        
        if (hasGameButtons(p1Buttons2) || hasGameButtons(p2Buttons2)) {
            console.log('\n✅ SUCCESS: Second hand started!');
            
            // 11. 玩第二手
            console.log('\nStep 11: Playing second hand...');
            
            if (hasGameButtons(p1Buttons2)) {
                const result = await clickFold(Runtime1, 'Player 1');
                console.log(`Player 1 (hand 2): ${result}`);
            } else if (hasGameButtons(p2Buttons2)) {
                const result = await clickFold(Runtime2, 'Player 2');
                console.log(`Player 2 (hand 2): ${result}`);
            }
            
            await sleep(5000);
            
            // 12. 检查第三手
            console.log('\nStep 12: Checking for third hand...');
            
            const p1Buttons3 = await getButtons(Runtime1);
            if (hasGameButtons(p1Buttons3)) {
                console.log('✅ Third hand also started!');
            } else {
                const pageText = await Runtime1.evaluate({
                    expression: `document.body.innerText.substring(0, 300)`
                });
                console.log(`Page state: ${pageText.result.value}`);
            }
        } else {
            console.log('\n❌ FAILURE: Second hand did NOT start');
            
            const pageText = await Runtime1.evaluate({
                expression: `document.body.innerText.substring(0, 500)`
            });
            console.log(`Final page state: ${pageText.result.value}`);
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
        console.error(error.stack);
    } finally {
        try {
            if (client1) await client1.close();
            if (client2) await client2.close();
        } catch (e) {}
        console.log('\nTest completed');
    }
}

runTest().catch(console.error);
