/**
 * 测试锦标赛结算
 * 验证：
 * 1. 双人赛 winner 获得全部奖池
 * 2. 输家失去 buyIn
 * 3. 余额变化正确
 */
const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const { TronWeb } = require('tronweb');
require('dotenv').config({ path: '.env.testnet' });

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';

const PLAYER1 = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' };
const BOT = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };
const CONTRACT_ADDRESS = process.env.TESTNET_CONTRACT_ADDRESS || 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

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

async function getPlayerBalance(address) {
    try {
        const tronWeb = new TronWeb({
            fullHost: process.env.TRON_NODE_URL || 'https://nile.trongrid.io'
        });
        const contract = await tronWeb.contract().at(CONTRACT_ADDRESS);
        const info = await contract.players(address).call();
        const balance = Number(info.balance.toString());
        const locked = Number(info.lockedAmount.toString());
        return { balance, locked, total: balance + locked };
    } catch (e) {
        log('获取余额失败: ' + e.message);
        return { balance: 0, locked: 0, total: 0 };
    }
}

async function startBot(tournamentId) {
    const botState = { tournamentId, lastTurnKey: '', lastActionTime: 0 };
    return new Promise((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:7778/socket.io/?EIO=4&transport=websocket`);
        ws.on('open', () => { ws.send('40'); });
        ws.on('message', raw => {
            const data = raw.toString();
            if (data === '2') { ws.send('3'); return; }
            if (data.startsWith('40')) {
                setTimeout(() => {
                    ws.send('42' + JSON.stringify(['CS_LOBBY_CONNECT', { walletAddress: BOT.address }]));
                    setTimeout(() => {
                        ws.send('42' + JSON.stringify(['CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: BOT.address }]));
                        setTimeout(() => {
                            ws.send('42' + JSON.stringify(['CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: BOT.address }]));
                            resolve(ws);
                        }, 800);
                    }, 1000);
                }, 500);
            }
            if (data.startsWith('42[')) {
                try {
                    const [event, state] = JSON.parse(data.slice(2));
                    if (['tournament_game_state', 'SC_GAME_STATE', 'game_state'].includes(event)) {
                        handleBotTurn(ws, state, botState);
                    }
                } catch (_) {}
            }
        });
        ws.on('error', e => log('Bot error: ' + e.message));
    });
}

function handleBotTurn(ws, state, botState) {
    if (!state?.seats) return;
    for (const [seatId, seat] of Object.entries(state.seats)) {
        if (!seat?.player) continue;
        const addr = (typeof seat.player === 'string' ? seat.player : seat.player.id || '').toLowerCase();
        if (addr !== BOT.address.toLowerCase()) continue;
        if (state.turn !== parseInt(seatId) || seat.folded) continue;
        const key = `${state.turn}-${state.street}`;
        const now = Date.now();
        if (botState.lastTurnKey !== key) { botState.lastTurnKey = key; botState.lastActionTime = 0; }
        if (now - botState.lastActionTime > 2000) {
            botState.lastActionTime = now;
            setTimeout(() => {
                // Bot fold every time to lose quickly
                ws.send('42' + JSON.stringify(['CS_TOURNAMENT_FOLD', { tournamentId: botState.tournamentId }]));
                log(`Bot: FOLD (筹码: ${seat.stack / 1e6} TRX)`);
            }, 1000);
        }
    }
}

async function test() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
        log(`📸 ${name}`);
    };

    const eval_ = async (expr) => {
        const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
        return r.result?.value;
    };

    log('=== 锦标赛结算测试 ===');

    // Step 0: 导航到钱包页面进行 deposit
    log('[0] 先检查并充值');
    await Page.navigate({ url: `${BASE_URL}/wallet?address=${PLAYER1.address}` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('wallet-initial');

    // 检查当前余额
    const balance1Before = await getPlayerBalance(PLAYER1.address);
    const balance2Before = await getPlayerBalance(BOT.address);
    log(`玩家1合约余额: ${balance1Before.total / 1e6} TRX (available: ${balance1Before.balance / 1e6}, locked: ${balance1Before.locked / 1e6})`);
    log(`玩家2合约余额: ${balance2Before.total / 1e6} TRX (available: ${balance2Before.balance / 1e6}, locked: ${balance2Before.locked / 1e6})`);

    // 如果余额不足，需要 deposit
    const minRequired = 100 * 1e6; // 100 TRX buyIn
    if (balance1Before.balance < minRequired || balance2Before.balance < minRequired) {
        log('⚠️ 玩家合约余额不足，需要 deposit');
        log('请在浏览器中手动 deposit，或使用测试私钥脚本充值');
        log('继续测试但结算可能无法在链上执行...');
    }

    // Step 1: 创建锦标赛（非 mock，真实结算）
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
    await screenshot('settlement-01-play-page');

    // Step 3: Bot 加入
    log('[3] Bot 加入锦标赛');
    const botWs = await startBot(tournamentId);
    await sleep(3000);

    // Step 4: 游戏循环 - Player1 主动让 Bot fold 从而赢
    log('[4] 游戏循环开始');
    let gameEnded = false;
    for (let round = 1; round <= 50 && !gameEnded; round++) {
        await sleep(1500);
        const state = await eval_(`({
            buttons: Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent.trim()),
            url: window.location.href,
            pageText: document.body.innerText.substring(0, 500)
        })`);
        const btns = state?.buttons || [];
        log(`Round ${round}: [${btns.join(',')}]`);

        if (round % 5 === 0) await screenshot(`settlement-round-${round}`);

        // 检测锦标赛结束
        if (state?.pageText?.includes('Tournament Champion') || 
            state?.pageText?.includes('Tournament ended') ||
            btns.some(b => b.includes('Back to Tournaments'))) {
            log('🎉 锦标赛已结束！');
            gameEnded = true;
            await screenshot('settlement-game-ended');
            break;
        }

        // 玩家1 check/call 等待 bot fold
        if (btns.includes('Check')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Check' && !b.disabled)].click()`);
            log('Player1: Check');
        } else if (btns.includes('Call')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Call' && !b.disabled)].click()`);
            log('Player1: Call');
        } else if (btns.includes('Raise')) {
            // 小额 raise
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Raise' && !b.disabled)].click()`);
            log('Player1: Raise');
        }
    }

    await sleep(3000); // 等待结算完成
    await screenshot('settlement-final');

    // Step 5: 获取结束后的余额
    log('[5] 获取结束后的余额');
    const balance1After = await getPlayerBalance(PLAYER1.address);
    const balance2After = await getPlayerBalance(BOT.address);
    
    const change1 = (balance1After.balance + balance1After.locked) - (balance1Before.balance + balance1Before.locked);
    const change2 = (balance2After.balance + balance2After.locked) - (balance2Before.balance + balance2Before.locked);
    
    log(`玩家1余额: ${(balance1After.balance + balance1After.locked) / 1e6} TRX (变化: ${change1 / 1e6 >= 0 ? '+' : ''}${change1 / 1e6} TRX)`);
    log(`玩家2余额: ${(balance2After.balance + balance2After.locked) / 1e6} TRX (变化: ${change2 / 1e6 >= 0 ? '+' : ''}${change2 / 1e6} TRX)`);

    // Step 6: 验证结算
    log('[6] 验证结算结果');
    const buyIn = 100; // 100 TRX
    const expectedRake = 10; // 5% = 10 TRX
    const expectedPrizePool = 200 - 10; // 190 TRX
    
    // 双人赛 winner 应该获得 100% 奖池
    const expectedWinnerGain = expectedPrizePool - buyIn; // 净赢 90 TRX (赢 190, 成本 100)
    const expectedLoserLoss = -buyIn; // 输 100 TRX
    
    log(`预期: 玩家1(赢家)净赢 +${expectedWinnerGain} TRX, 玩家2(输家)净输 ${expectedLoserLoss} TRX`);
    
    const tolerance = 1; // 1 TRX 容差
    const isWinnerCorrect = Math.abs(change1 / 1e6 - expectedWinnerGain) <= tolerance;
    const isLoserCorrect = Math.abs(change2 / 1e6 - expectedLoserLoss) <= tolerance;
    
    if (isWinnerCorrect && isLoserCorrect) {
        log('✅ 结算正确！');
    } else {
        log(`❌ 结算错误！`);
        log(`   玩家1 期望 +${expectedWinnerGain} TRX, 实际 ${change1 / 1e6} TRX`);
        log(`   玩家2 期望 ${expectedLoserLoss} TRX, 实际 ${change2 / 1e6} TRX`);
    }

    // 获取页面上的 GameBalance 显示
    const gameBalanceText = await eval_(`document.body.innerText.match(/GameBalance[\\s\\S]*?TRX/g)?.[0] || 'Not found'`);
    log(`页面 GameBalance 显示: ${gameBalanceText}`);

    botWs.close();
    await client.close();
    
    log('测试完成');
    
    if (!isWinnerCorrect || !isLoserCorrect) {
        process.exit(1);
    }
}

test().catch(e => { console.error(e); process.exit(1); });
