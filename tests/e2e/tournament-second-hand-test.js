/**
 * Tournament Second Hand Test
 * 测试锦标赛第二局是否能正常开始
 * 
 * 运行方式: node tests/e2e/tournament-second-hand-test.js
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');

const API_BASE = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';
const CDP_PORT = 9222;

// 测试用的私钥
const PLAYER1_PRIVATE_KEY = 'a1a2a3a4a5a6a7a8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2';
const PLAYER2_PRIVATE_KEY = 'b1b2b3b4b5b6b7b8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2';

// 从私钥派生地址 - 使用 TronWeb v6 的导入方式
const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://api.shasta.trongrid.io' });

async function getAddressFromPrivateKey(privateKey) {
    return tronWeb.address.fromPrivateKey(privateKey);
}

// CDP 辅助函数
async function initCDP() {
    const client = await CDP({ port: CDP_PORT });
    const { Page, Runtime, Network } = client;
    await Page.enable();
    await Runtime.enable();
    await Network.enable();
    return { client, Page, Runtime, Network };
}

async function navigate(Runtime, url) {
    await Runtime.evaluate({
        expression: `window.location.href = '${url}'`,
        awaitPromise: true
    });
    await new Promise(r => setTimeout(r, 2000));
}

async function waitFor(Runtime, selector, timeout = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const result = await Runtime.evaluate({
            expression: `document.querySelector('${selector}') !== null`
        });
        if (result.result.value) return true;
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

async function click(Runtime, selector) {
    await Runtime.evaluate({
        expression: `
            const el = document.querySelector('${selector}');
            if (el) { el.click(); true; } else { false; }
        `
    });
    await new Promise(r => setTimeout(r, 500));
}

async function getText(Runtime, selector) {
    const result = await Runtime.evaluate({
        expression: `document.querySelector('${selector}')?.textContent || ''`
    });
    return result.result.value;
}

async function getConsoleLogs(Runtime) {
    const result = await Runtime.evaluate({
        expression: `window.__testLogs || []`
    });
    return result.result.value || [];
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// 测试主流程
async function runTest() {
    console.log('=== Tournament Second Hand Test ===\n');
    
    let client1, client2;
    let Runtime1, Runtime2;
    let player1Address, player2Address;
    let tournamentId;
    
    try {
        // 派生地址
        player1Address = await getAddressFromPrivateKey(PLAYER1_PRIVATE_KEY);
        player2Address = await getAddressFromPrivateKey(PLAYER2_PRIVATE_KEY);
        console.log(`Player 1: ${player1Address}`);
        console.log(`Player 2: ${player2Address}\n`);
        
        // 1. 创建锦标赛
        console.log('Step 1: Creating tournament...');
        const createRes = await axios.post(`${API_BASE}/api/tournament/create`, {
            configId: 3 // 2人锦标赛
        }, {
            headers: { 'x-wallet-address': player1Address }
        });
        tournamentId = createRes.data.tournamentId || createRes.data.tournament?.tournamentId;
        console.log(`Tournament created: ${tournamentId}\n`);
        
        // 2. 连接 CDP
        console.log('Step 2: Connecting to Chrome CDP...');
        const cdp1 = await initCDP();
        client1 = cdp1.client;
        Runtime1 = cdp1.Runtime;
        
        const cdp2 = await initCDP();
        client2 = cdp2.client;
        Runtime2 = cdp2.Runtime;
        console.log('CDP connected\n');
        
        // 3. 初始化浏览器 - 收集控制台日志
        console.log('Step 3: Setting up console log capture...');
        const setupLogCapture = async (Runtime, playerName) => {
            await Runtime.evaluate({
                expression: `
                    window.__testLogs = [];
                    window.__socketEvents = [];
                    
                    // Capture console.log
                    const originalLog = console.log;
                    console.log = function(...args) {
                        window.__testLogs.push(args.map(a => 
                            typeof a === 'object' ? JSON.stringify(a) : String(a)
                        ).join(' '));
                        originalLog.apply(console, args);
                    };
                    
                    // Capture socket events if socket exists
                    const originalOn = window.socket?.on;
                    if (originalOn) {
                        window.socket.on = function(event, handler) {
                            window.__socketEvents.push({ event, type: 'registered' });
                            return originalOn.call(this, event, handler);
                        };
                    }
                    
                    'Log capture setup complete'
                `
            });
        };
        
        await setupLogCapture(Runtime1, 'Player1');
        await setupLogCapture(Runtime2, 'Player2');
        console.log('Log capture setup complete\n');
        
        // 4. 玩家1加入锦标赛页面
        console.log('Step 4: Player 1 joining tournament...');
        await navigate(Runtime1, `${FRONTEND_URL}/tournament/${tournamentId}?address=${player1Address}`);
        await sleep(3000);
        
        // 检查是否成功加入房间
        const roomJoined1 = await Runtime1.evaluate({
            expression: `document.body.innerText.includes('Waiting') || document.body.innerText.includes('Tournament')`
        });
        console.log(`Player 1 page loaded: ${roomJoined1.result.value ? 'YES' : 'NO'}\n`);
        
        // 5. 玩家2加入锦标赛页面 - 锦标赛开始
        console.log('Step 5: Player 2 joining tournament (should start)...');
        await navigate(Runtime2, `${FRONTEND_URL}/tournament/${tournamentId}?address=${player2Address}`);
        await sleep(8000); // 等待锦标赛开始和游戏状态广播
        
        // 检查锦标赛是否开始
        const gameStarted = await Runtime1.evaluate({
            expression: `document.body.innerText.includes('fold') || document.body.innerText.includes('call') || document.body.innerText.includes('check') || document.body.innerText.includes('♥') || document.body.innerText.includes('♠')`
        });
        console.log(`Game started: ${gameStarted.result.value ? 'YES' : 'NO'}\n`);
        
        // 打印页面 URL 和关键元素
        const pageInfo = await Runtime1.evaluate({
            expression: `
                (function() {
                    return {
                        url: window.location.href,
                        title: document.title,
                        bodyClasses: document.body.className,
                        hasRoot: document.getElementById('root') !== null,
                        rootInnerHTML: document.getElementById('root')?.innerHTML?.substring(0, 500) || 'NO ROOT'
                    };
                })()
            `
        });
        console.log('Player 1 page info:', JSON.stringify(pageInfo.result.value, null, 2));
        
        if (!gameStarted.result.value) {
            console.log('ERROR: Game did not start. Checking page content...');
            const pageContent1 = await Runtime1.evaluate({
                expression: `document.body.innerText.substring(0, 500)`
            });
            console.log('Player 1 page:', pageContent1.result.value);
            
            const pageContent2 = await Runtime2.evaluate({
                expression: `document.body.innerText.substring(0, 500)`
            });
            console.log('Player 2 page:', pageContent2.result.value);
            return;
        }
        
        // 6. 玩第一局 - 玩家1 fold
        console.log('Step 6: Playing first hand - Player 1 folds...');
        
        // 检查是否轮到玩家1
        const isPlayer1Turn = await Runtime1.evaluate({
            expression: `
                // 检查是否有 fold 按钮
                document.querySelector('button') !== null && 
                Array.from(document.querySelectorAll('button')).some(b => 
                    b.textContent.toLowerCase().includes('fold')
                )
            `
        });
        console.log(`Player 1 turn: ${isPlayer1Turn.result.value ? 'YES' : 'NO'}`);
        
        if (!isPlayer1Turn.result.value) {
            // 可能轮到玩家2，先让玩家2 check/fold
            const isPlayer2Turn = await Runtime2.evaluate({
                expression: `
                    document.querySelector('button') !== null && 
                    Array.from(document.querySelectorAll('button')).some(b => 
                        b.textContent.toLowerCase().includes('fold') || 
                        b.textContent.toLowerCase().includes('check')
                    )
                `
            });
            
            if (isPlayer2Turn.result.value) {
                console.log('Player 2 turn - checking...');
                // 尝试 check
                await Runtime2.evaluate({
                    expression: `
                        const btn = Array.from(document.querySelectorAll('button'))
                            .find(b => b.textContent.toLowerCase().includes('check'));
                        if (btn) btn.click();
                    `
                });
                await sleep(2000);
            }
        }
        
        // 玩家1 fold
        await Runtime1.evaluate({
            expression: `
                const foldBtn = Array.from(document.querySelectorAll('button'))
                    .find(b => b.textContent.toLowerCase().includes('fold'));
                if (foldBtn) { 
                    console.log('Clicking fold button');
                    foldBtn.click(); 
                    'FOLDED'; 
                } else { 
                    'NO_FOLD_BUTTON'; 
                }
            `
        });
        
        console.log('Waiting for first hand to end...');
        await sleep(5000);
        
        // 7. 检查第一局是否结束
        console.log('\nStep 7: Checking if first hand ended...');
        const firstHandEnded = await Runtime1.evaluate({
            expression: `
                window.__testLogs.some(log => 
                    log.includes('wins') || 
                    log.includes('Hand') ||
                    log.includes('hand')
                )
            `
        });
        console.log(`First hand ended: ${firstHandEnded.result.value ? 'YES' : 'NO'}`);
        
        // 获取日志
        const logs1 = await Runtime1.evaluate({
            expression: `window.__testLogs.slice(-20).join('\\n')`
        });
        console.log('Recent logs (Player 1):\n', logs1.result.value);
        
        // 8. 等待第二局开始
        console.log('\nStep 8: Waiting for second hand to start (3 seconds delay)...');
        await sleep(5000); // 3秒延迟 + 2秒buffer
        
        // 9. 检查第二局是否开始
        console.log('\nStep 9: Checking if second hand started...');
        
        // 检查游戏状态
        const gameState1 = await Runtime1.evaluate({
            expression: `
                (function() {
                    const state = {
                        hasCards: document.body.innerText.includes('♥') || 
                                   document.body.innerText.includes('♠') || 
                                   document.body.innerText.includes('♦') || 
                                   document.body.innerText.includes('♣'),
                        hasActionButtons: Array.from(document.querySelectorAll('button'))
                            .some(b => ['fold', 'call', 'check', 'raise'].some(action => 
                                b.textContent.toLowerCase().includes(action)
                            )),
                        pageText: document.body.innerText.substring(0, 300)
                    };
                    return JSON.stringify(state);
                })()
            `
        });
        
        const state1 = JSON.parse(gameState1.result.value);
        console.log('Player 1 state:', state1);
        
        const gameState2 = await Runtime2.evaluate({
            expression: `
                (function() {
                    const state = {
                        hasCards: document.body.innerText.includes('♥') || 
                                   document.body.innerText.includes('♠') || 
                                   document.body.innerText.includes('♦') || 
                                   document.body.innerText.includes('♣'),
                        hasActionButtons: Array.from(document.querySelectorAll('button'))
                            .some(b => ['fold', 'call', 'check', 'raise'].some(action => 
                                b.textContent.toLowerCase().includes(action)
                            )),
                        pageText: document.body.innerText.substring(0, 300)
                    };
                    return JSON.stringify(state);
                })()
            `
        });
        
        const state2 = JSON.parse(gameState2.result.value);
        console.log('Player 2 state:', state2);
        
        // 检查是否有等待中的问题
        const isWaiting = state1.pageText.includes('Waiting') && !state1.hasCards;
        
        if (state1.hasCards && state1.hasActionButtons) {
            console.log('\n✅ SUCCESS: Second hand started successfully!');
            
            // 玩第二局
            console.log('\nStep 10: Playing second hand...');
            
            // 确定轮到谁
            const p1Turn = await Runtime1.evaluate({
                expression: `
                    Array.from(document.querySelectorAll('button'))
                        .some(b => b.textContent.toLowerCase().includes('fold'))
                `
            });
            
            if (p1Turn.result.value) {
                console.log('Player 1 turn in second hand - calling...');
                await Runtime1.evaluate({
                    expression: `
                        const callBtn = Array.from(document.querySelectorAll('button'))
                            .find(b => b.textContent.toLowerCase().includes('call'));
                        if (callBtn) callBtn.click();
                    `
                });
                await sleep(2000);
                
                // 玩家2 check
                await Runtime2.evaluate({
                    expression: `
                        const checkBtn = Array.from(document.querySelectorAll('button'))
                            .find(b => b.textContent.toLowerCase().includes('check'));
                        if (checkBtn) checkBtn.click();
                    `
                });
                await sleep(2000);
            }
            
            console.log('Second hand actions completed!');
        } else if (isWaiting) {
            console.log('\n❌ FAILURE: Second hand did NOT start - stuck at waiting');
            console.log('This indicates the auto-start logic is not working');
            
            // 获取更多调试信息
            const socketState = await Runtime1.evaluate({
                expression: `
                    (function() {
                        return {
                            socketConnected: window.socket?.connected || false,
                            socketEvents: window.__socketEvents || [],
                            recentLogs: window.__testLogs.slice(-10)
                        };
                    })()
                `
            });
            console.log('Socket state:', socketState.result.value);
        } else {
            console.log('\n⚠️ UNCLEAR: Could not determine if second hand started');
        }
        
        // 最终日志
        console.log('\n=== Final Server Logs ===');
        const finalLogs = await Runtime1.evaluate({
            expression: `window.__testLogs.slice(-30).join('\\n')`
        });
        console.log(finalLogs.result.value);
        
    } catch (error) {
        console.error('Test error:', error.message);
        console.error(error.stack);
    } finally {
        if (client1) await client1.close();
        if (client2) await client2.close();
        console.log('\nTest completed');
    }
}

// 运行测试
runTest().catch(console.error);
