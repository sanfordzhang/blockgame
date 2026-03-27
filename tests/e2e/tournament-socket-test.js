/**
 * 锦标赛 Socket 事件测试 - 简化版
 * 使用单个 CDP 客户端测试
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
    console.log('=== Tournament Socket Event Test (Simplified) ===\n');
    
    let client;
    let Runtime, Page;
    
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
        console.log('Player 1 joined\n');
        
        // 3. Player 2 通过 API 加入 - 锦标赛应该开始
        console.log('Step 3: Player 2 joining via API (should start tournament)...');
        await axios.post(`${API_BASE}/api/tournament/${tournamentId}/join`, {}, {
            headers: { 'x-wallet-address': player2Address }
        });
        console.log('Player 2 joined\n');
        
        // 等待锦标赛开始
        await sleep(5000);
        
        // 4. 连接 CDP
        console.log('Step 4: Connecting to Chrome CDP...');
        client = await CDP({ port: CDP_PORT });
        ({ Runtime, Page } = client);
        await Runtime.enable();
        await Page.enable();
        console.log('CDP connected\n');
        
        // 5. Player 1 打开锦标赛页面
        console.log('Step 5: Player 1 opening tournament page...');
        await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}` });
        await sleep(8000);
        
        // 6. 检查游戏状态
        console.log('\nStep 6: Checking game state...');
        
        // 设置 socket 事件监听
        await Runtime.evaluate({
            expression: `
                window.__receivedStates = [];
                if (window.socket) {
                    window.socket.on('tournament_game_state', (state) => {
                        console.log('RECEIVED tournament_game_state', state.turn);
                        window.__receivedStates.push(state);
                    });
                }
            `
        });
        
        // 检查当前页面内容
        const pageContent = await Runtime.evaluate({
            expression: `document.body.innerText`
        });
        console.log(`Page content (first 300 chars): ${pageContent.result.value?.substring(0, 300)}`);
        
        // 检查按钮
        const buttons = await Runtime.evaluate({
            expression: `
                Array.from(document.querySelectorAll('button'))
                    .map(b => b.textContent.trim())
                    .filter(t => t)
            `
        });
        console.log(`Buttons: ${JSON.stringify(buttons.result.value)}`);
        
        // 等待更多 socket 事件
        await sleep(3000);
        
        // 检查接收到的游戏状态
        const receivedStates = await Runtime.evaluate({
            expression: `JSON.stringify(window.__receivedStates || [])`
        });
        console.log(`Received game states: ${receivedStates.result.value?.substring(0, 500)}`);
        
        // 7. 尝试点击 fold 按钮
        console.log('\nStep 7: Trying to click fold button...');
        
        const foldClicked = await Runtime.evaluate({
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
        console.log(`Result: ${foldClicked.result.value}`);
        
        // 等待结果
        await sleep(5000);
        
        // 8. 检查第二手是否开始
        console.log('\nStep 8: Checking if second hand started...');
        
        const buttonsAfter = await Runtime.evaluate({
            expression: `
                Array.from(document.querySelectorAll('button'))
                    .map(b => b.textContent.trim())
                    .filter(t => t)
            `
        });
        console.log(`Buttons after: ${JSON.stringify(buttonsAfter.result.value)}`);
        
        const receivedStatesAfter = await Runtime.evaluate({
            expression: `window.__receivedStates.length`
        });
        console.log(`Total received states: ${receivedStatesAfter.result.value}`);
        
        const hasGameButtons = buttonsAfter.result.value?.some(b => 
            b.toLowerCase().includes('fold') || 
            b.toLowerCase().includes('check') ||
            b.toLowerCase().includes('call')
        );
        
        if (hasGameButtons) {
            console.log('\n✅ SUCCESS: Game buttons found - game is running!');
        } else {
            console.log('\n❌ FAILURE: No game buttons found');
        }
        
    } catch (error) {
        console.error('Test error:', error.message);
        console.error(error.stack);
    } finally {
        if (client) await client.close();
        console.log('\nTest completed');
    }
}

runTest().catch(console.error);
