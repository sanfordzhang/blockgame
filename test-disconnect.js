const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';

const PLAYER1 = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' };
const BOT = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function httpPost(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
        const u = new URL(url);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        });
        req.on('error', reject); req.write(body); req.end();
    });
}

// 创建机器人类，可以手动控制断开
class TestBot {
    constructor(tournamentId) {
        this.tournamentId = tournamentId;
        this.ws = null;
        this.connected = false;
    }
    
    connect() {
        return new Promise((resolve) => {
            this.ws = new WebSocket(`ws://127.0.0.1:7778/socket.io/?EIO=4&transport=websocket`);
            this.ws.on('open', () => {
                this.ws.send('40');
            });
            this.ws.on('message', raw => {
                const data = raw.toString();
                if (data === '2') { this.ws.send('3'); return; }
                if (data.startsWith('40')) {
                    setTimeout(() => {
                        this.ws.send('42' + JSON.stringify(['CS_LOBBY_CONNECT', { walletAddress: BOT.address }]));
                        setTimeout(() => {
                            this.ws.send('42' + JSON.stringify(['CS_TOURNAMENT_JOIN', { tournamentId: this.tournamentId, walletAddress: BOT.address }]));
                            setTimeout(() => {
                                this.ws.send('42' + JSON.stringify(['CS_TOURNAMENT_ROOM_JOIN', { tournamentId: this.tournamentId, walletAddress: BOT.address }]));
                                this.connected = true;
                                resolve();
                            }, 800);
                        }, 1000);
                    }, 500);
                }
                if (data.startsWith('42[')) {
                    try {
                        const [event, state] = JSON.parse(data.slice(2));
                        if (['tournament_game_state', 'SC_GAME_STATE', 'game_state'].includes(event)) {
                            this.handleGameState(state);
                        }
                    } catch (_) {}
                }
            });
        });
    }
    
    handleGameState(state) {
        if (!state?.seats) return;
        for (const [seatId, seat] of Object.entries(state.seats)) {
            if (!seat?.player) continue;
            const addr = (typeof seat.player === 'string' ? seat.player : seat.player.id || '').toLowerCase();
            if (addr !== BOT.address.toLowerCase()) continue;
            if (state.turn !== parseInt(seatId) || seat.folded) continue;
            
            setTimeout(() => {
                const action = state.callAmount > 0 ? 'CALL' : 'CHECK';
                this.ws.send('42' + JSON.stringify([`CS_TOURNAMENT_${action}`, { tournamentId: this.tournamentId }]));
                log(`Bot: ${action}`);
            }, 1000);
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.connected = false;
            log('Bot disconnected');
        }
    }
}

async function test() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Console } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Enable console capture
    if (Console) {
        await Console.enable();
        Console.messageAdded((msg) => {
            const text = msg.message?.text || '';
            if (text.includes('TournamentGameContext') || text.includes('SC_TOURNAMENT') || text.includes('tournamentEnded')) {
                log(`[Browser] ${text}`);
            }
        });
    }
    
    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
        log(`📸 ${name}`);
    };
    
    const eval_ = async (expr) => {
        const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
        return r.result?.value;
    };
    
    log('=== 测试双人锦标赛 Disconnect 场景 ===');
    
    // Step 1: 创建锦标赛
    log('[1] 创建锦标赛');
    const createRes = await httpPost(`${API_URL}/api/tournament/create`, {
        configId: 3, walletAddress: PLAYER1.address, mockGame: false
    });
    if (!createRes.success) { log('创建失败: ' + JSON.stringify(createRes)); process.exit(1); }
    const tournamentId = createRes.tournament?.tournamentId || createRes.tournament?.id;
    log(`锦标赛ID: ${tournamentId}`);
    
    // Step 2: 导航到游戏页面
    log('[2] 导航到游戏页面');
    await Page.navigate({ url: `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('disconnect-01-play-page');
    
    // Step 3: Bot 加入
    log('[3] Bot 加入锦标赛');
    const bot = new TestBot(tournamentId);
    await bot.connect();
    await sleep(3000);
    await screenshot('disconnect-02-bot-joined');
    
    // Step 4: 玩几轮
    log('[4] 游戏开始，玩几轮...');
    for (let round = 1; round <= 10; round++) {
        await sleep(1500);
        const state = await eval_(`({
            buttons: Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent.trim()),
            hasEndScreen: !!document.querySelector('[data-testid="tournament-ended"]'),
            hasRanking: !!document.querySelector('.tournament-ranking, .ranking-modal')
        })`);
        
        log(`Round ${round}: buttons=[${state?.buttons?.slice(0, 5).join(',')}] endScreen=${state?.hasEndScreen}`);
        
        if (state?.hasEndScreen || state?.hasRanking) {
            log('🎉 检测到锦标赛结束画面！');
            await screenshot('disconnect-end-detected');
            break;
        }
        
        // 点击 Check 或 Call
        if (state?.buttons?.includes('Check')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Check' && !b.disabled)].click()`);
            log('Player: Check');
        } else if (state?.buttons?.includes('Call')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Call' && !b.disabled)].click()`);
            log('Player: Call');
        }
    }
    
    await screenshot('disconnect-03-before-bot-disconnect');
    
    // Step 5: Bot 断开连接
    log('[5] Bot 断开连接...');
    bot.disconnect();
    
    // Step 6: 检查是否出现锦标赛结束画面
    log('[6] 检查锦标赛结束画面...');
    for (let i = 1; i <= 15; i++) {
        await sleep(1000);
        const state = await eval_(`({
            buttons: Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent.trim()),
            hasEndScreen: document.body.innerText.includes('Tournament Champion') || document.body.innerText.includes('Tournament Ended'),
            hasRanking: document.body.innerText.includes('Final Rankings'),
            hasWinnerModal: !!document.querySelector('[class*="winner"], [class*="champion"]'),
            bodyText: document.body.innerText.substring(0, 500)
        })`);
        
        log(`Check ${i}: buttons=[${state?.buttons?.slice(0, 5).join(',')}] endScreen=${state?.hasEndScreen} ranking=${state?.hasRanking}`);
        
        if (state?.hasEndScreen || state?.hasRanking || state?.hasWinnerModal) {
            log('🎉🎉 锦标赛结束画面已出现！');
            await screenshot('disconnect-04-tournament-ended');
            break;
        }
        
        // 检查是否有 "Leave Tournament" 按钮变为其他状态
        if (state?.buttons?.some(b => b.includes('Leave') || b.includes('离开'))) {
            log('还在游戏中...');
        }
        
        // 检查是否有获胜相关文字
        if (state?.bodyText?.includes('Winner') || state?.bodyText?.includes('获胜') || state?.bodyText?.includes('冠军')) {
            log('检测到获胜相关文字！');
            await screenshot('disconnect-05-winner-text');
        }
    }
    
    await screenshot('disconnect-final');
    
    // 最终检查
    const finalState = await eval_(`({
        hasEndScreen: !!document.querySelector('[data-testid="tournament-ended"]'),
        hasRanking: !!document.querySelector('.tournament-ranking, .ranking-modal'),
        bodyText: document.body.innerText
    })`);
    
    log('\n=== 最终状态 ===');
    log('Has End Screen:', finalState?.hasEndScreen);
    log('Has Ranking:', finalState?.hasRanking);
    log('Body Text (first 500):', finalState?.bodyText?.substring(0, 500));
    
    await client.close();
    log('测试完成');
}

test().catch(e => { console.error(e); process.exit(1); });
