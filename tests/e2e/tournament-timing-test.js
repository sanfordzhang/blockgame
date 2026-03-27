/**
 * 锦标赛完整流程测试 - 正确时序
 * 玩家先打开页面加入 Socket 房间，然后锦标赛才开始
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
    console.log('=== Tournament Multi-Hand Test (Correct Timing) ===\n');
    
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
        
        // 2. 连接 CDP
        console.log('Step 2: Setting up CDP clients...');
        
        client1 = await CDP({ port: CDP_PORT });
        ({ Runtime: Runtime1, Page: Page1 } = client1);
        await Runtime1.enable();
        await Page1.enable();
        
        await sleep(500);
        
        client2 = await CDP({ port: CDP_PORT });
        ({ Runtime: Runtime2, Page: Page2 } = client2);
        await Runtime2.enable();
        await Page2.enable();
        
        console.log('CDP clients ready\n');
        
        // 3. Player 1 先打开页面并加入房间（但不加入锦标赛）
        console.log('Step 3: Player 1 opening page (joining room)...');
        await Page1.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
        await sleep(4000);
        
        // 检查页面状态
        const p1Before = await Runtime1.evaluate({
            expression: `document.body.innerText.substring(0, 300)`
        });
        console.log(`Player 1 page before join: ${p1Before.result.value}`);
        
        // 4. Player 2 打开页面
        console.log('\nStep 4: Player 2 opening page...');
        await Page2.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}` });
        await sleep(4000);
        
        const p2Before = await Runtime2.evaluate({
            expression: `document.body.innerText.substring(0, 300)`
        });
        console.log(`Player 2 page before join: ${p2Before.result.value}`);
        
        // 5. Player 1 通过 API 加入锦标赛
        console.log('\nStep 5: Player 1 joining tournament via API...');
        await axios.post(`${API_BASE}/api/tournament/${tournamentId}/join`, {}, {
            headers: { 'x-wallet-address': player1Address }
        });
        await sleep(3000);
        
        // 6. Player 2 通过 API 加入 - 锦标赛开始！
        console.log('\nStep 6: Player 2 joining tournament via API (tournament starts)...');
        await axios.post(`${API_BASE}/api/tournament/${tournamentId}/join`, {}, {
            headers: { 'x-wallet-address': player2Address }
        });
        
        // 等待锦标赛开始和游戏状态广播
        await sleep(8000);
        
        // 7. 检查游戏状态
        console.log('\nStep 7: Checking game state after tournament start...');
        
        const p1After = await Runtime1.evaluate({
            expression: `document.body.innerText.substring(0, 500)`
        });
        console.log(`Player 1 page after start:\n${p1After.result.value}`);
        
        // 8. 检查按钮
        console.log('\nStep 8: Checking action buttons...');
        
        const getButtons = async (Runtime) => {
            const result = await Runtime.evaluate({
                expression: `
                    (function() {
                        const btns = document.querySelectorAll('button');
                        return Array.from(btns).filter(b => b.textContent.trim()).map(b => b.textContent.trim());
                    })()
                `
            });
            return result.result.value || [];
        };
        
        const p1Buttons = await getButtons(Runtime1);
        const p2Buttons = await getButtons(Runtime2);
        
        console.log(`Player 1 buttons: ${JSON.stringify(p1Buttons)}`);
        console.log(`Player 2 buttons: ${JSON.stringify(p2Buttons)}`);
        
        const hasActionButtons = (buttons) => buttons.some(b => 
            b.toLowerCase().includes('fold') || 
            b.toLowerCase().includes('check') ||
            b.toLowerCase().includes('call') ||
            b.toLowerCase().includes('raise')
        );
        
        if (!hasActionButtons(p1Buttons) && !hasActionButtons(p2Buttons)) {
            console.log('\n❌ No action buttons found - game state not properly synced');
            
            // 尝试刷新页面重新同步
            console.log('Refreshing pages to resync...');
            await Page1.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
            await sleep(5000);
            
            const p1Refreshed = await getButtons(Runtime1);
            console.log(`Player 1 buttons after refresh: ${JSON.stringify(p1Refreshed)}`);
            
            if (!hasActionButtons(p1Refreshed)) {
                console.log('Still no buttons - there may be a deeper issue');
                return;
            }
        }
        
        // 9. 执行 Fold 操作
        console.log('\nStep 9: Playing first hand...');
        
        const clickFold = async (Runtime, name) => {
            const result = await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.textContent.toLowerCase().includes('fold')) {
                                btn.click();
                                return 'Fold clicked';
                            }
                        }
                        return 'No fold button';
                    })()
                `
            });
            return result.result.value;
        };
        
        const p1HasButtons = hasActionButtons(await getButtons(Runtime1));
        const p2HasButtons = hasActionButtons(await getButtons(Runtime2));
        
        if (p1HasButtons) {
            const result = await clickFold(Runtime1, 'Player 1');
            console.log(`Player 1: ${result}`);
        } else if (p2HasButtons) {
            const result = await clickFold(Runtime2, 'Player 2');
            console.log(`Player 2: ${result}`);
        }
        
        // 等待第一手结束
        console.log('\nWaiting for first hand to end...');
        await sleep(5000);
        
        // 10. 检查第一手是否结束
        console.log('\nStep 10: Checking if first hand ended...');
        
        const p1AfterHand = await Runtime1.evaluate({
            expression: `document.body.innerText.substring(0, 300)`
        });
        console.log(`Player 1 after hand 1:\n${p1AfterHand.result.value}`);
        
        // 11. 等待第二手开始
        console.log('\nStep 11: Waiting for second hand (3s delay + buffer)...');
        await sleep(6000);
        
        // 12. 检查第二手是否开始
        console.log('\nStep 12: Checking if second hand started...');
        
        const p1Buttons2 = await getButtons(Runtime1);
        console.log(`Player 1 buttons (hand 2): ${JSON.stringify(p1Buttons2)}`);
        
        if (hasActionButtons(p1Buttons2)) {
            console.log('\n✅ SUCCESS: Second hand started!');
            
            // 玩第二手
            const result = await clickFold(Runtime1, 'Player 1');
            console.log(`Player 1 (hand 2): ${result}`);
            
            await sleep(5000);
            
            // 检查第三手
            const p1Buttons3 = await getButtons(Runtime1);
            if (hasActionButtons(p1Buttons3)) {
                console.log('✅ Third hand also started!');
            } else {
                console.log('Tournament may have ended after hand 2');
            }
        } else {
            console.log('\n❌ FAILURE: Second hand did NOT start');
            
            const pageText = await Runtime1.evaluate({
                expression: `document.body.innerText.substring(0, 500)`
            });
            console.log(`Final page state:\n${pageText.result.value}`);
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
