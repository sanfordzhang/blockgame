const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const { execSync } = require('child_process');
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
                const action = state.callAmount > 0 ? 'CALL' : 'CHECK';
                ws.send('42' + JSON.stringify([`CS_TOURNAMENT_${action}`, { tournamentId: botState.tournamentId }]));
                log(`Bot: ${action}`);
            }, 1200);
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

    log('=== CDP游戏测试 Mock顺子NFT ===');

    // Step 1: PLAYER1 创建 mock 锦标赛
    log('[1] 创建 Mock 锦标赛');
    const createRes = await httpPost(`${API_URL}/api/tournament/create`, {
        configId: 3, walletAddress: PLAYER1.address, mockGame: true
    });
    if (!createRes.success) { log('创建失败: ' + JSON.stringify(createRes)); process.exit(1); }
    const tournamentId = createRes.tournament?.tournamentId || createRes.tournament?.id;
    log(`锦标赛ID: ${tournamentId}`);

    // Step 2: 导航到游戏页面
    log('[2] 导航到游戏页面');
    await Page.navigate({ url: `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('01-play-page');

    // Step 3: Bot 加入（坐座位2）
    log('[3] Bot 加入锦标赛');
    const botWs = await startBot(tournamentId);
    await sleep(3000);

    // Step 4: 游戏循环
    log('[4] 游戏循环开始');
    let nftDetected = false;
    for (let round = 1; round <= 40; round++) {
        await sleep(1000);
        const state = await eval_(`({
            buttons: Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent.trim()),
            url: window.location.href
        })`);
        const btns = state?.buttons || [];
        log(`Round ${round}: [${btns.join(',')}]`);

        if (round % 5 === 0) await screenshot(`round-${round}`);

        // 检测铸造NFT按钮
        if (btns.some(b => b.includes('铸造 NFT') || b.includes('Mint NFT'))) {
            log('🎉 检测到铸造NFT按钮！');
            await screenshot('nft-button-detected');
            nftDetected = true;
            break;
        }

        // 游戏操作
        if (btns.includes('Check')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Check' && !b.disabled)].click()`);
            log('Clicked: Check');
        } else if (btns.includes('Call')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Call' && !b.disabled)].click()`);
            log('Clicked: Call');
        }
    }

    await screenshot('final-game');
    botWs.close();

    if (!nftDetected) {
        log('❌ 未检测到NFT铸造按钮');
        await client.close();
        process.exit(1);
    }

    // Step 5: 链上铸造
    log('[5] 执行链上铸造');
    try {
        const result = execSync('node mint-onchain-latest.js', { encoding: 'utf8', timeout: 60000 });
        log(result);
    } catch (e) {
        log('铸造错误: ' + e.message);
    }

    // Step 6: 验证
    log('[6] 验证NFT');
    await Page.navigate({ url: `${BASE_URL}/nft?address=${PLAYER1.address}` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('nft-gallery');

    const galleryText = await eval_(`document.body.innerText.substring(0, 300)`);
    log('NFT画廊: ' + galleryText);

    await client.close();
    log('✅ 测试完成');
}

test().catch(e => { console.error(e); process.exit(1); });
