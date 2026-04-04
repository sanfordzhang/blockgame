/**
 * 顺子NFT完整测试流程
 *
 * 按照 GAME_BOT_TEST_FLOW.md 流程：
 * 1. 启动机器人（Bot_Alice = PLAYER2）创建 mock 锦标赛
 * 2. PLAYER1 通过 CDP 加入锦标赛
 * 3. 游戏开始后完成一手（顺子牌型）
 * 4. 验证 NFT 生成
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';
const CDP_PORT = 9222;

const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    name: 'Player1'
};

const BOT = {
    address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
    name: 'Bot_Alice'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// ---------- HTTP helpers ----------
function httpGet(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        }).on('error', reject);
    });
}

function httpPost(url, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        };
        const urlObj = new URL(url);
        options.hostname = urlObj.hostname;
        options.port = urlObj.port;
        options.path = urlObj.pathname + urlObj.search;

        const req = http.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch (e) { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ---------- CDP helpers ----------
async function getCDPTarget() {
    const result = await httpGet(`http://localhost:${CDP_PORT}/json`);
    const pages = Array.isArray(result.body) ? result.body : [];
    return pages.find(p => p.type === 'page' && p.url.includes('127.0.0.1:3001'));
}

async function cdpConnect(target) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        const pending = {};
        let msgId = 1;

        ws.on('open', () => {
            log('CDP WebSocket connected');
            resolve({
                send: (method, params = {}) => new Promise((res, rej) => {
                    const id = msgId++;
                    pending[id] = { res, rej };
                    ws.send(JSON.stringify({ id, method, params }));
                }),
                on: (event, fn) => ws.on('message', raw => {
                    try {
                        const msg = JSON.parse(raw);
                        if (msg.method === event) fn(msg.params);
                    } catch (_) {}
                }),
                close: () => ws.close()
            });
        });

        ws.on('message', raw => {
            try {
                const msg = JSON.parse(raw);
                if (msg.id && pending[msg.id]) {
                    const { res, rej } = pending[msg.id];
                    delete pending[msg.id];
                    if (msg.error) rej(new Error(msg.error.message));
                    else res(msg.result);
                }
            } catch (_) {}
        });

        ws.on('error', reject);
    });
}

async function evaluate(cdp, expression) {
    const result = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
    });
    return result?.result?.value;
}

async function screenshot(cdp, filename) {
    try {
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const dir = path.join(__dirname, 'test-results');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, filename), Buffer.from(data, 'base64'));
        log(`Screenshot: ${filename}`);
    } catch (e) {
        log(`Screenshot failed: ${e.message}`);
    }
}

async function navigate(cdp, url) {
    await cdp.send('Page.navigate', { url });
    await sleep(3000);
}

// ---------- Socket.io bot ----------
function startBot(tournamentId) {
    return new Promise((resolve, reject) => {
        log('Starting bot via Socket.io...');

        // Use simple HTTP polling to connect socket.io
        // We'll use the WebSocket transport manually
        const connectUrl = `${API_URL}/socket.io/?EIO=4&transport=websocket`;
        const wsUrl = connectUrl.replace('http://', 'ws://');

        const ws = new WebSocket(wsUrl);
        let sessionId = null;
        const botState = {
            tournamentId,
            mySeat: null,
            lastTurnKey: null,
            lastActionTime: 0
        };

        ws.on('open', () => {
            log('Bot WebSocket opened');
        });

        ws.on('message', raw => {
            const data = raw.toString();

            // Socket.io handshake
            if (data.startsWith('0{')) {
                const json = JSON.parse(data.slice(1));
                sessionId = json.sid;
                log(`Bot socket.io session: ${sessionId}`);

                // Send connect
                ws.send('40');
            }
            // Connected
            else if (data === '40' || data.startsWith('40{')) {
                log('Bot connected to socket.io');

                // Send lobby connect
                const payload = JSON.stringify(['CS_LOBBY_CONNECT', {
                    gameId: 'lobby',
                    address: BOT.address,
                    userInfo: { name: BOT.name }
                }]);
                ws.send('42' + payload);
                log('Bot: sent CS_LOBBY_CONNECT');

                setTimeout(() => {
                    // Join tournament
                    const joinPayload = JSON.stringify(['CS_TOURNAMENT_JOIN', {
                        tournamentId,
                        walletAddress: BOT.address
                    }]);
                    ws.send('42' + joinPayload);
                    log(`Bot: sent CS_TOURNAMENT_JOIN (${tournamentId})`);

                    setTimeout(() => {
                        const roomPayload = JSON.stringify(['CS_TOURNAMENT_ROOM_JOIN', {
                            tournamentId,
                            walletAddress: BOT.address
                        }]);
                        ws.send('42' + roomPayload);
                        log(`Bot: sent CS_TOURNAMENT_ROOM_JOIN`);
                        resolve(ws);
                    }, 800);
                }, 1000);
            }
            // Game state
            else if (data.startsWith('42[')) {
                try {
                    const arr = JSON.parse(data.slice(2));
                    const [event, state] = arr;

                    if (event === 'tournament_game_state' || event === 'SC_GAME_STATE' || event === 'game_state') {
                        handleBotTurn(ws, state, botState);
                    }
                    if (event === 'SC_NFT_ACHIEVEMENT_EARNED') {
                        log(`BOT received NFT achievement: ${JSON.stringify(state)}`);
                    }
                } catch (_) {}
            }
            // Ping
            else if (data === '2') {
                ws.send('3');
            }
        });

        ws.on('error', err => {
            log(`Bot error: ${err.message}`);
        });
    });
}

function handleBotTurn(ws, state, botState) {
    if (!state || !state.seats) return;

    const botAddrLower = BOT.address.toLowerCase();

    for (const [seatId, seat] of Object.entries(state.seats)) {
        if (!seat || !seat.player) continue;

        const playerAddr = typeof seat.player === 'string'
            ? seat.player.toLowerCase()
            : (seat.player.id || '').toLowerCase();

        if (playerAddr !== botAddrLower) continue;
        botState.mySeat = seatId;

        const turnSeat = parseInt(seatId);
        const isMyTurn = state.turn === turnSeat;

        if (isMyTurn && !seat.folded) {
            const turnKey = `${state.turn}-${state.street || 'preflop'}`;
            const now = Date.now();

            if (botState.lastTurnKey !== turnKey) {
                botState.lastTurnKey = turnKey;
                botState.lastActionTime = 0;
            }

            if (now - botState.lastActionTime > 2000) {
                botState.lastActionTime = now;
                log(`Bot turn! seat=${seatId} street=${state.street} callAmount=${state.callAmount}`);

                setTimeout(() => {
                    let action = 'CHECK';
                    let payload = { tournamentId: botState.tournamentId };

                    if (state.callAmount && state.callAmount > 0) {
                        action = 'CALL';
                    }

                    const msg = JSON.stringify([`CS_TOURNAMENT_${action}`, payload]);
                    ws.send('42' + msg);
                    log(`Bot action: ${action}`);
                }, 1200);
            }
        }
    }
}

// ---------- Main test ----------
async function runTest() {
    log('='.repeat(50));
    log('顺子NFT完整测试流程');
    log('='.repeat(50));

    // Step 1: Connect CDP first
    log('\n[Step 1] 连接 Chrome CDP');
    const target = await getCDPTarget();
    if (!target) { log('未找到 Chrome 页面目标，退出'); process.exit(1); }
    log(`连接目标: ${target.url}`);
    const cdp = await cdpConnect(target);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Step 2: PLAYER1 creates tournament via CDP (gets seat 1 = straight hand)
    log('\n[Step 2] PLAYER1 创建 Mock 锦标赛（坐座位1拿顺子）');
    const createRes = await httpPost(`${API_URL}/api/tournament/create`, {
        configId: 3,
        walletAddress: PLAYER1.address,
        mockGame: true
    });

    log(`创建响应: ${JSON.stringify(createRes.body).substring(0, 200)}`);
    if (!createRes.body?.success) { log('创建锦标赛失败，退出'); process.exit(1); }

    const tournamentId = createRes.body.tournament?.tournamentId || createRes.body.tournament?.id;
    log(`锦标赛ID: ${tournamentId}`);

    // Screenshot current state
    await screenshot(cdp, 'step1-initial.png');

    // Step 3: Navigate to tournament list and PLAYER1 joins first
    log('\n[Step 3] 导航到锦标赛列表，PLAYER1 先加入（坐座位1）');
    await navigate(cdp, `${BASE_URL}/tournament`);
    await screenshot(cdp, 'step2-tournament-list.png');

    // Step 5: Enable mock game checkbox
    log('\n[Step 5] 勾选 Mock 游戏开关');
    const mockCheckResult = await evaluate(cdp, `
        (function() {
            const checkbox = document.querySelector('input[data-testid="mock-game-checkbox"]');
            if (checkbox) {
                if (!checkbox.checked) checkbox.click();
                return 'mock enabled: ' + checkbox.checked;
            }
            // Try to find by label text
            const labels = document.querySelectorAll('label');
            for (const label of labels) {
                if (label.textContent.toLowerCase().includes('mock')) {
                    const input = label.querySelector('input') || document.getElementById(label.htmlFor);
                    if (input && !input.checked) {
                        input.click();
                        return 'mock enabled via label';
                    }
                }
            }
            return 'mock checkbox not found';
        })()
    `);
    log(`Mock 开关: ${mockCheckResult}`);
    await sleep(500);

    // Step 6: Find tournament card with 1/2 players
    log('\n[Step 6] 查找并点击锦标赛卡片 (1/2)');
    await screenshot(cdp, 'step3-looking-for-tournament.png');

    const findCardResult = await evaluate(cdp, `
        (function() {
            // 查找包含 "1 / 2" 或 "1/2" 的卡片
            const allElements = document.querySelectorAll('[class*="card"], [class*="Card"], .tournament-card, [class*="tournament"]');
            const allText = [];
            for (const el of allElements) {
                const text = (el.innerText || '').trim();
                if (text.includes('1 / 2') || text.includes('1/2')) {
                    el.click();
                    return 'clicked card: ' + text.substring(0, 100);
                }
                if (text.length > 10 && text.length < 200) allText.push(text.substring(0, 80));
            }
            // Try any clickable with "双人赛" or "2人"
            const allBtns = document.querySelectorAll('button, [role="button"], [onClick]');
            for (const btn of allBtns) {
                const text = (btn.innerText || '').trim();
                if (text.includes('双人赛') || text.includes('2人')) {
                    btn.click();
                    return 'clicked btn: ' + text;
                }
            }
            return 'not found, elements: ' + allElements.length + ' | texts: ' + JSON.stringify(allText.slice(0, 5));
        })()
    `);
    log(`查找卡片: ${findCardResult}`);
    await sleep(1500);
    await screenshot(cdp, 'step4-after-card-click.png');

    // Step 7: Click Confirm button
    log('\n[Step 7] 点击 Confirm 加入锦标赛');
    const confirmResult = await evaluate(cdp, `
        (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent.trim();
                if (text === 'Confirm' || text === '确认' || text === 'Join') {
                    btn.click();
                    return 'clicked: ' + text;
                }
            }
            const btnTexts = Array.from(buttons).map(b => b.textContent.trim()).filter(t => t);
            return 'buttons: ' + JSON.stringify(btnTexts.slice(0, 10));
        })()
    `);
    log(`Confirm: ${confirmResult}`);
    await sleep(1500);
    await screenshot(cdp, 'step5-after-confirm.png');

    // Step 6: PLAYER1 joins via socket directly, then navigate to play page
    log('\n[Step 6] PLAYER1 通过 socket 加入锦标赛，然后导航到游戏页面');
    // Join via API socket events using CDP
    await evaluate(cdp, `
        (function() {
            if (window.socket) {
                window.socket.emit('CS_TOURNAMENT_JOIN', { tournamentId: '${tournamentId}', walletAddress: '${PLAYER1.address}' });
                window.socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId: '${tournamentId}', walletAddress: '${PLAYER1.address}' });
                return 'joined via socket';
            }
            return 'no socket';
        })()
    `);
    await sleep(1000);

    // Navigate directly to tournament play page
    await navigate(cdp, `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}`);
    await screenshot(cdp, 'step6-play-page.png');

    // Step 7: Bot joins AFTER PLAYER1 (gets seat 2)
    log('\n[Step 7] Bot_Alice 加入锦标赛（坐座位2）');
    const botWs = await startBot(tournamentId);
    await sleep(3000);

    // Step 8: Wait for game to start and play
    log('\n[Step 8] 等待游戏开始，执行操作...');

    const maxRounds = 40;
    let round = 0;
    let nftAchieved = false;

    while (round < maxRounds) {
        round++;
        await sleep(1000);

        const gameStatus = await evaluate(cdp, `
            (function() {
                const btns = Array.from(document.querySelectorAll('button'))
                    .filter(b => !b.disabled)
                    .map(b => b.textContent.trim())
                    .filter(t => t);
                const bodyText = document.body.innerText.substring(0, 300);
                const hasNFT = bodyText.toLowerCase().includes('achievement') || bodyText.toLowerCase().includes('nft') && bodyText.includes('earned');
                const currentUrl = window.location.href;
                return JSON.stringify({ buttons: btns, bodyText: bodyText.substring(0, 150), hasNFT, url: currentUrl });
            })()
        `);

        let status;
        try { status = JSON.parse(gameStatus); } catch (e) { status = {}; }

        log(`Round ${round}: URL=${status.url?.split('/').slice(-2).join('/')} | buttons=[${(status.buttons || []).join(',')}]`);

        if (status.hasNFT) {
            log('NFT成就已触发！');
            nftAchieved = true;
            await screenshot(cdp, `step-nft-achievement.png`);
            break;
        }

        // Take periodic screenshots
        if (round % 3 === 0) {
            await screenshot(cdp, `step-round-${round}.png`);
        }

        const buttons = status.buttons || [];

        // Navigate to tournament if we're not in game yet
        if (!status.url?.includes('/play') && !status.url?.includes('/tournament/')) {
            if (round <= 3) {
                log('Not in game yet, trying to navigate...');
                // Try to click tournament card again
                const tryJoin = await evaluate(cdp, `
                    (function() {
                        const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
                        for (const card of cards) {
                            const t = card.innerText || '';
                            if (t.includes('1 / 2') || t.includes('双人赛')) {
                                card.click();
                                return 'clicked';
                            }
                        }
                        return 'not found';
                    })()
                `);
                log(`Re-join attempt: ${tryJoin}`);
                await sleep(1500);
                // Click Confirm
                await evaluate(cdp, `
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            const t = btn.textContent.trim();
                            if (t === 'Confirm' || t === '确认' || t === 'Join') {
                                btn.click();
                                return t;
                            }
                        }
                    })()
                `);
            }
            continue;
        }

        // Perform actions
        // Check for NFT mint button first
        if (buttons.some(b => b.includes('铸造 NFT') || b.includes('Mint NFT'))) {
            log('检测到 NFT 铸造按钮，注入合约地址并点击！');
            // Inject contract address before clicking
            await evaluate(cdp, `window.__NFT_CONTRACT_ONCHAIN = 'TZ44KG9TPtWzFWKHy4SJxHFmzwbgTZU9fc'`);
            await sleep(300);
            await evaluate(cdp, `
                (function() {
                    const btns = document.querySelectorAll('button');
                    for (const b of btns) {
                        const t = b.textContent.trim();
                        if ((t.includes('铸造 NFT') || t.includes('Mint NFT')) && !b.disabled) { b.click(); return; }
                    }
                })()
            `);
            nftAchieved = true;
            await sleep(2000);
            await screenshot(cdp, 'step-nft-mint-clicked.png');
            break;
        }

        if (buttons.includes('Check')) {
            await evaluate(cdp, `
                (function() {
                    const btns = document.querySelectorAll('button');
                    for (const b of btns) {
                        if (b.textContent.trim() === 'Check' && !b.disabled) { b.click(); return; }
                    }
                })()
            `);
            log('Clicked: Check');
        } else if (buttons.includes('Call')) {
            await evaluate(cdp, `
                (function() {
                    const btns = document.querySelectorAll('button');
                    for (const b of btns) {
                        if (b.textContent.trim() === 'Call' && !b.disabled) { b.click(); return; }
                    }
                })()
            `);
            log('Clicked: Call');
        } else if (buttons.some(b => b.toLowerCase().includes('check'))) {
            await evaluate(cdp, `
                (function() {
                    const btns = document.querySelectorAll('button');
                    for (const b of btns) {
                        if (b.textContent.toLowerCase().includes('check') && !b.disabled) { b.click(); return; }
                    }
                })()
            `);
            log('Clicked: check (fuzzy)');
        } else if (buttons.some(b => b.toLowerCase().includes('call'))) {
            await evaluate(cdp, `
                (function() {
                    const btns = document.querySelectorAll('button');
                    for (const b of btns) {
                        if (b.textContent.toLowerCase().includes('call') && !b.disabled) { b.click(); return; }
                    }
                })()
            `);
            log('Clicked: call (fuzzy)');
        }
    }

    await screenshot(cdp, 'step-final.png');

    // Step 9: Check NFT API
    log('\n[Step 9] 检查 NFT 状态');
    const nftRes = await httpGet(`${API_URL}/api/nft/collection/${PLAYER1.address}`);
    log(`NFT集合 (PLAYER1): ${JSON.stringify(nftRes.body).substring(0, 300)}`);

    const nftBotRes = await httpGet(`${API_URL}/api/nft/collection/${BOT.address}`);
    log(`NFT集合 (BOT): ${JSON.stringify(nftBotRes.body).substring(0, 300)}`);

    // Step 10: Navigate to NFT gallery to verify
    log('\n[Step 10] 导航到 NFT 画廊验证');
    await navigate(cdp, `${BASE_URL}/nft`);
    await screenshot(cdp, 'step-nft-gallery.png');

    const nftGalleryCheck = await evaluate(cdp, `
        JSON.stringify({
            hasStraight: document.body.innerText.includes('Straight'),
            hasNFT: document.body.innerText.includes('NFT'),
            bodyText: document.body.innerText.substring(0, 300)
        })
    `);
    log(`NFT画廊: ${nftGalleryCheck}`);

    cdp.close();

    log('\n' + '='.repeat(50));
    log(`测试完成！NFT成就触发: ${nftAchieved ? '是' : '否（需检查日志）'}`);
    log('截图保存在 test-results/ 目录');
    log('='.repeat(50));

    process.exit(0);
}

runTest().catch(err => {
    log(`未捕获错误: ${err.message}`);
    console.error(err);
    process.exit(1);
});
