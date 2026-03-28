/**
 * 一体化测试：机器人 + CDP玩家
 * 
 * 1. 机器人创建并加入锦标赛
 * 2. CDP玩家加入同一锦标赛
 * 3. 双方进行游戏
 */

const CDP = require('chrome-remote-interface');
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://127.0.0.1:7778';
const CDP_PORT = 9222;
const SCREENSHOT_DIR = '/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results';

const PLAYER1 = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv', name: 'Player1' };
const BOT = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4', name: 'Bot_Alice' };

let screenshotCount = 0;
let tournamentId = null;
let botSocket = null;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function takeScreenshot(Page, name = '') {
    screenshotCount++;
    const filename = `game-${String(screenshotCount).padStart(2, '0')}${name ? '-' + name : ''}.png`;
    fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), Buffer.from(await Page.captureScreenshot({ format: 'png' }).then(r => r.data), 'base64'));
    console.log(`📸 ${filename}`);
}

// 启动机器人
async function startBot() {
    return new Promise((resolve, reject) => {
        console.log('🤖 启动机器人...');
        
        const socket = io(SERVER_URL, {
            transports: ['websocket'],
            query: { walletAddress: BOT.address }
        });
        
        socket.on('connect', async () => {
            console.log('✅ 机器人已连接');
            botSocket = socket;
            
            socket.emit('CS_LOBBY_CONNECT', {
                gameId: 'lobby',
                address: BOT.address,
                userInfo: { name: BOT.name }
            });
            
            await sleep(1000);
            
            // 创建锦标赛
            const resp = await fetch(`${SERVER_URL}/api/tournament/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId: 3, walletAddress: BOT.address })
            });
            const data = await resp.json();
            
            if (data.success && data.tournament) {
                tournamentId = data.tournament.tournamentId || data.tournament.id;
                console.log(`✅ 锦标赛已创建: ${tournamentId}`);
                
                // 加入锦标赛
                await sleep(500);
                socket.emit('CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: BOT.address });
                await sleep(500);
                socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: BOT.address });
                
                console.log('✅ 机器人已加入锦标赛');
                resolve();
            } else {
                reject(new Error('创建锦标赛失败'));
            }
        });
        
        socket.on('tournament_game_state', (state) => handleBotGameState(state));
        socket.on('SC_GAME_STATE', (state) => handleBotGameState(state));
        socket.on('connect_error', reject);
    });
}

// 机器人处理游戏
let lastBotAction = 0;
async function handleBotGameState(state) {
    if (!state?.seats) return;
    
    const botAddr = BOT.address.toLowerCase();
    for (const [seatId, seat] of Object.entries(state.seats)) {
        if (seat?.player?.address?.toLowerCase() === botAddr) {
            const isMyTurn = state.turn === parseInt(seatId) && !seat.folded;
            if (isMyTurn && Date.now() - lastBotAction > 2000) {
                lastBotAction = Date.now();
                console.log(`🤖 机器人回合，座位${seatId}`);
                await sleep(1000);
                const action = (!state.callAmount || state.callAmount === 0) ? 'CHECK' : 'CALL';
                console.log(`🤖 机器人执行: ${action}`);
                botSocket.emit(`CS_TOURNAMENT_${action}`, { tournamentId });
            }
        }
    }
}

// CDP玩家
async function runCDP() {
    console.log('\n🎮 启动CDP玩家...');
    
    const client = await CDP({ port: CDP_PORT });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // 导航到锦标赛页面
    console.log('导航到锦标赛页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await sleep(3000);
    await takeScreenshot(Page, 'tournament-list');
    
    // 点击锦标赛卡片
    console.log('点击锦标赛卡片...');
    await Runtime.evaluate({
        expression: `
            (function() {
                const cards = document.querySelectorAll('[class*="lniqUP"], [class*="card"], div');
                for (const card of cards) {
                    const text = card.innerText || '';
                    if (text.includes('WAITING') && text.includes('Players') && text.includes('1 / 2')) {
                        card.click();
                        return 'clicked card with 1/2 players';
                    }
                }
                // 备用：点击任何WAITING的卡片
                for (const card of cards) {
                    if ((card.innerText || '').includes('WAITING') && (card.innerText || '').includes('2人赛')) {
                        card.click();
                        return 'clicked 2-player card';
                    }
                }
                return 'no card found';
            })()
        `,
        returnByValue: true
    });
    
    await sleep(2000);
    await takeScreenshot(Page, 'after-click');
    
    // 点击确认按钮
    const confirmResult = await Runtime.evaluate({
        expression: `
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent.trim().toLowerCase();
                    if ((text.includes('join') || text.includes('加入') || text.includes('enter')) && !btn.disabled) {
                        btn.click();
                        return btn.textContent.trim();
                    }
                }
                return null;
            })()
        `,
        returnByValue: true
    });
    
    if (confirmResult.result?.value) {
        console.log(`点击确认按钮: ${confirmResult.result.value}`);
        await sleep(3000);
        await takeScreenshot(Page, 'joined');
    }
    
    // 游戏循环
    console.log('\n开始游戏循环...\n');
    
    for (let round = 1; round <= 12; round++) {
        await sleep(2000);
        await takeScreenshot(Page, `round-${round}`);
        
        // 执行游戏操作
        const actionResult = await Runtime.evaluate({
            expression: `
                (function() {
                    const buttons = document.querySelectorAll('button');
                    const actions = ['check', 'call', 'raise'];
                    for (const btn of buttons) {
                        const text = btn.textContent.trim().toLowerCase();
                        if (!btn.disabled) {
                            for (const action of actions) {
                                if (text.includes(action)) {
                                    btn.click();
                                    return { success: true, action: btn.textContent.trim() };
                                }
                            }
                        }
                    }
                    return { success: false };
                })()
            `,
            returnByValue: true
        });
        
        if (actionResult.result?.value?.success) {
            console.log(`✅ CDP玩家: ${actionResult.result.value.action}`);
        }
        
        await sleep(1000);
    }
    
    await takeScreenshot(Page, 'final');
    console.log('\n✅ 测试完成');
    
    await client.close();
}

async function main() {
    console.log('\n========================================');
    console.log('🤖 机器人 + CDP玩家 一体化测试');
    console.log('========================================\n');
    
    try {
        // 1. 启动机器人
        await startBot();
        await sleep(2000);
        
        // 2. 启动CDP玩家
        await runCDP();
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

main();
