const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

// TronLink 签名按钮坐标（与 deposit 流程相同）
const SIGN_BUTTON_COORDS = { x: 1406, y: 638 };

function cliclick(cmd) {
    try { execSync(`cliclick ${cmd}`, { encoding: 'utf-8' }); } catch (e) { /* ignore */ }
}

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';

const PLAYER1 = { address: '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc' }; // 0G deployer wallet
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

async function connectCDP(urlPattern) {
    // Wait for tab with urlPattern to appear
    for (let i = 0; i < 15; i++) {
        const pages = await new Promise((resolve, reject) => {
            http.get('http://localhost:9222/json', res => {
                let d = ''; res.on('data', c => d += c);
                res.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });
        // Prefer exact urlPattern match; filter out localhost tabs when using remote BASE_URL
        const candidates = pages.filter(p => p.url.includes(urlPattern));
        // If no match, try any non-localhost 3001 port tab
        const page = candidates[0] || pages.find(p => 
            p.url.includes('3001') && !p.url.includes('localhost')
        );
        if (page) {
            log(`connectCDP found tab: ${page.url.substring(0, 80)}`);
            const c = await CDP({ target: page.webSocketDebuggerUrl });
            await c.Page.enable();
            await c.Runtime.enable();
            await c.Log.enable();  // Enable console log capture
            // Capture console logs
            let consoleLogs = [];
            c.on('Log.entryAdded', ({entry}) => {
                const text = entry.text || '';
                if (text.includes('TournamentGame') || text.includes('Socket') || 
                    text.includes('Join API') || text.includes('error') || text.includes('Error') ||
                    text.includes('WARNING') || text.includes('ROOM') || text.includes('join')) {
                    consoleLogs.push(text.substring(0, 200));
                }
            });
            const screenshot = (name) => c.Page.captureScreenshot().then(({data}) => {
                fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
                log(`📸 ${name}`);
            }).catch(() => {});
            const eval_ = (expr) => c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true })
                .then(r => r.result?.value).catch(() => null);
            const getConsoleLogs = () => { return consoleLogs; };
            return { client: c, screenshot, eval_, getConsoleLogs };
        }
        log(`connectCDP waiting... (${i+1}/15), tabs: ${pages.map(p=>p.url.substring(0,40)).join(' | ')}`);
        await sleep(1000);
    }
    throw new Error('Tab not found: ' + urlPattern);
}

async function test() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    log('=== CDP游戏测试 Mock顺子NFT ===');

    // Step 1: 创建 mock 锦标赛
    log('[1] 创建 Mock 锦标赛');
    const createRes = await httpPost(`${API_URL}/api/tournament/create`, {
        configId: 3, walletAddress: PLAYER1.address, mockGame: true
    });
    if (!createRes.success) { log('创建失败: ' + JSON.stringify(createRes)); process.exit(1); }
    const tournamentId = createRes.tournament?.tournamentId || createRes.tournament?.id;
    log(`锦标赛ID: ${tournamentId}`);

    // Step 2: 导航到游戏页面
    log('[2] 导航到游戏页面');
    {
        log('[2a] 获取tabs');
        const pages = await new Promise((resolve, reject) => {
            http.get('http://localhost:9222/json', res => {
                let d = ''; res.on('data', c => d += c);
                res.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });
        const tab = pages.find(p => p.url.includes('3001')) || pages[0];
        log('[2b] 连接tab: ' + tab.url.substring(0, 50));
        const c = await CDP({ target: tab.webSocketDebuggerUrl });
        log('[2c] 启用Page');
        await c.Page.enable();
        log('[2d] 导航');
        c.Page.navigate({ url: `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}` }).catch(() => {});
        log('[2e] 等待5秒');
        await sleep(5000);
        log('[2f] 关闭连接');
        await c.close().catch(() => {});
        log('[2g] 完成');
    }
    const { client, screenshot, eval_, getConsoleLogs } = await connectCDP(`tournament/${tournamentId}`);
    await screenshot('01-play-page');
    
    // Check console logs for join errors
    await sleep(2000);
    
    // Evaluate JS in browser context
    const diag = await eval_(`(function() {
        return {
            url: window.location.href,
            hostname: window.location.hostname,
            hasReact: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined',
            bodyText: document.body?.innerText?.substring(0, 500) || 'empty',
            apiBase: typeof fetch !== 'undefined' ? 'fetch available' : 'no fetch'
        };
    })()`);
    log(`[Browser diag]: ${JSON.stringify(diag)}`);
    
    const initialLogs = getConsoleLogs();
    if (initialLogs.length > 0) {
        log(`[Console logs]: ${initialLogs.slice(0, 10).join('\n')}`);
    }

    // Step 3: Bot 加入（坐座位2）
    log('[3] Bot 加入锦标赛');
    const botWs = await startBot(tournamentId);
    await sleep(5000);
    
    // Check logs after bot joins
    const postJoinLogs = getConsoleLogs();
    if (postJoinLogs.length > 0) {
        log(`[Post-join Console logs]: ${postJoinLogs.slice(-10).join('\n')}`);
    }
    await screenshot('after-bot-join');

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

        // 检测铸造NFT按钮 - 直接点击并处理TronLink签名
        if (btns.some(b => b.includes('铸造 NFT') || b.includes('Mint NFT'))) {
            log('🎉 检测到铸造NFT按钮！点击铸造...');
            await screenshot('nft-button-detected');
            nftDetected = true;
            // 点击铸造NFT按钮
            await eval_(`(function(){
                const btns = Array.from(document.querySelectorAll('button'));
                const btn = btns.find(b => b.textContent.includes('铸造 NFT') || b.textContent.includes('Mint NFT'));
                if (btn) btn.click();
            })()`);
            log('已点击铸造NFT按钮，等待TronLink签名弹窗...');
            await sleep(3000);
            await screenshot('nft-tronlink-popup');
            log('⚠️  请在 TronLink 中手动点击签名确认！等待60秒...');
            await sleep(60000);
            await screenshot('nft-after-sign');
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

    // Step 5: 等待链上铸造确认
    log('[5] 等待链上铸造确认（30秒）');
    await sleep(30000);
    await screenshot('nft-mint-result');

    // Step 6: 验证
    log('[6] 验证NFT');
    client.Page.navigate({ url: `${BASE_URL}/nft?address=${PLAYER1.address}` }).catch(() => {});
    await sleep(3000);
    await screenshot('nft-gallery');

    const galleryText = await eval_(`document.body.innerText.substring(0, 300)`);
    log('NFT画廊: ' + galleryText);

    await client.close();
    log('✅ 测试完成');
}

test().catch(e => { console.error(e); process.exit(1); });
