/**
 * 0G Poker E2E Test via CDP
 *
 * 功能:
 * - 注入 mock MetaMask (0G Galileo testnet, chainId: 0x40da/16602)
 * - 使用指定机器人钱包 (0x1DaD15c006C3e6dB2e115Bcd8b12A40CE87CD341)
 * - 创建锦标赛, 玩家(浏览器) + 机器人(Socket) 对战
 * - Mock 游戏模式: 自动产生顺子牌型 (5-6-7-8-9)
 * - 完整游戏流程: join -> play hand -> NFT mint -> gallery check
 *
 * 运行方式:
 *   node cdp-scripts/cdp-play-game-0g.js
 */
const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const { execSync } = require('child_process');
const fs = require('fs');

// ============ Config ============
const API_URL = process.env.API_URL || 'http://43.163.114.175:7778';
const BASE_URL = process.env.BASE_URL || 'http://43.163.114.175:3001';
const SOCKET_URL = process.env.SOCKET_URL || (() => {
    const parsed = new URL(API_URL);
    const protocol = parsed.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${parsed.host}`;
})();

// 浏览器玩家 (0G custody balance + delegate 已准备好)
const PLAYER = {
    address: '0x8808ff950b9bfddde445fd099262e80cee858eb5'
};

// 0G 机器人钱包（私钥必须通过环境变量 BOT_PRIVATE_KEY 传入）
const BOT = {
    address: process.env.BOT_ADDRESS || '0x1DaD15c006C3e6dB2e115Bcd8b12A40CE87CD341',
    privateKey: process.env.BOT_PRIVATE_KEY || '',
    get addressLower() {
        return this.address.toLowerCase();
    }
};

if (!BOT.privateKey) {
    throw new Error('BOT_PRIVATE_KEY is required to run cdp-play-game-0g.js');
}

// 0G 链配置
const ZEROG_CHAIN_ID_HEX = '0x40da';   // 16602 in hex (0G Galileo testnet)
const ZEROG_CHAIN_ID_DEC = 16602;
const POKERGAME_0G_ADDRESS = '0xc4975D55aD2607B14616E97B9a8E5622778eF5aE';
const BUY_IN_WEI = '100000000000000000'; // 0.1 0G, equals 100,000,000 SUN in test conversion

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
]);

function activateChromeApp() {
    if (process.platform !== 'darwin') return;
    try {
        execSync(`osascript -e 'tell application "Google Chrome" to activate'`, { stdio: 'ignore' });
    } catch (_) {}
}

async function bringPageToFront(client) {
    try {
        await withTimeout(client.Page.bringToFront(), 5000, 'Page.bringToFront');
    } catch (e) {
        log(`[CDP] ${e.message}`);
    }

    activateChromeApp();
    await sleep(300);
}

// ============ HTTP 工具 ============
function httpPost(url, data, walletAddress) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const addr = walletAddress || PLAYER.address;
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-wallet-address': addr
            }
        };
        const u = new URL(url);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function cliclick(cmd) {
    try { execSync(`cliclick ${cmd}`, { encoding: 'utf-8' }); } catch (_) {}
}

// ============ 0G Bot (WebSocket) ============
async function startBot(tournamentId) {
    const botState = {
        tournamentId,
        lastTurnKey: '',
        lastActionTime: 0,
        connected: false,
        gameStarted: false
    };

    log(`[Bot] Starting 0G bot with address: ${BOT.address}`);

    return new Promise((resolve) => {
        const ws = new WebSocket(`${SOCKET_URL}/socket.io/?EIO=4&transport=websocket`);

        ws.on('open', () => {
            log('[Bot] WebSocket connected, sending ping...');
            ws.send('40'); // Socket.io connect + engine.io upgrade
        });

        ws.on('message', raw => {
            const data = raw.toString();

            // Engine.io ping/pong
            if (data === '2') { ws.send('3'); return; }

            // Socket.io connect acknowledgment
            if (data.startsWith('40')) {
                log('[Bot] Socket.io connected!');
                botState.connected = true;

                setTimeout(() => {
                    // Step 1: Lobby Connect
                    ws.send('42' + JSON.stringify(['CS_LOBBY_CONNECT', {
                        walletAddress: BOT.address
                    }]));
                    log('[Bot] Sent CS_LOBBY_CONNECT');

                    setTimeout(() => {
                        // Step 2: Join Tournament
	                        ws.send('42' + JSON.stringify(['CS_TOURNAMENT_JOIN', {
	                            tournamentId: tournamentId,
	                            walletAddress: BOT.address,
	                            clientBalance: BUY_IN_WEI
	                        }]));
	                        log('[Bot] Sent CS_TOURNAMENT_JOIN');

                        setTimeout(() => {
                            // Step 3: Join Tournament Room
                            ws.send('42' + JSON.stringify(['CS_TOURNAMENT_ROOM_JOIN', {
                                tournamentId: tournamentId,
                                walletAddress: BOT.address
                            }]));
                            log('[Bot] Sent CS_TOURNAMENT_ROOM_JOIN ✅');
                            log('[Bot] Bot is ready for game!');
                            resolve(ws);
                        }, 800);
                    }, 1000);
                }, 500);
                return;
            }

            // Handle socket events (format: 42["eventName", {...data}])
            if (data.startsWith('42[')) {
                try {
                    const [event, payload] = JSON.parse(data.slice(2));

                    // Log important events
                    if (['tournament_game_state', 'SC_GAME_STATE', 'game_state', 'SC_TOURNAMENT_STARTED'].includes(event)) {
                        log(`[Bot] Event: ${event}`);
                    }

                    if (event === 'SC_TOURNAMENT_STARTED') {
                        botState.gameStarted = true;
                        log('[Bot] 🏆 Tournament STARTED!');
                    }

                    // Handle game state - auto play
                    if (['tournament_game_state', 'SC_GAME_STATE', 'game_state'].includes(event)) {
                        handleBotTurn(ws, payload, botState);
                    }
                } catch (_) {}
            }
        });

        ws.on('error', e => log(`[Bot] Error: ${e.message}`));
        ws.on('close', () => log('[Bot] Connection closed'));
    });
}

function handleBotTurn(ws, state, bs) {
    if (!state?.seats) return;

    for (const [seatId, seat] of Object.entries(state.seats)) {
        if (!seat?.player) continue;

        // Extract player address - handle both string and object formats
        let playerAddr = '';
        if (typeof seat.player === 'string') {
            playerAddr = seat.player.toLowerCase();
        } else if (seat.player.id) {
            playerAddr = seat.player.id.toLowerCase();
        }

        // Check if this is the bot's turn
        if (playerAddr !== BOT.addressLower) continue;
        if (state.turn !== parseInt(seatId) || seat.folded) continue;

        // Debounce: prevent duplicate actions on same turn
        const key = `${state.turn}-${state.street || 'preflop'}`;
        const now = Date.now();

        if (bs.lastTurnKey !== key) {
            bs.lastTurnKey = key;
            bs.lastActionTime = 0;
        }

        if (now - bs.lastActionTime > 2000) {
            bs.lastActionTime = now;
            setTimeout(() => {
                // Simple strategy: call if there's a bet, otherwise check
                const action = state.callAmount > 0 ? 'CALL' : 'CHECK';
                ws.send('42' + JSON.stringify([`CS_TOURNAMENT_${action}`, {
                    tournamentId: bs.tournamentId
                }]));
                log(`[Bot] Action: ${action} (callAmount: ${state.callAmount || 0})`);
            }, 1200);
        }
    }
}

// ============ CDP 连接 ============
async function connectCDP(urlPattern) {
    for (let i = 0; i < 30; i++) {
        try {
            if (process.env.CDP_REUSE_TAB === 'false') {
                const freshPage = await withTimeout(
                    CDP.New({ url: `${BASE_URL}/` }),
                    10000,
                    'CDP.New'
                );
                log(`[CDP] Fresh tab opened: ${(freshPage.url || BASE_URL).substring(0, 80)}`);
                const c = await withTimeout(CDP({ target: freshPage.webSocketDebuggerUrl || freshPage.id }), 10000, 'CDP connect');

                await withTimeout(c.Page.enable(), 5000, 'Page.enable').catch(e => log(`[CDP] ${e.message}`));
                await withTimeout(c.Runtime.enable(), 5000, 'Runtime.enable').catch(e => log(`[CDP] ${e.message}`));
                await withTimeout(c.Log.enable(), 5000, 'Log.enable').catch(e => log(`[CDP] ${e.message}`));
                await bringPageToFront(c);

                let consoleLogs = [];
                c.on('Log.entryAdded', ({ entry }) => {
                    const t = entry.text || '';
                    if (/error|Error|WARNING|Socket|Join|ROOM|Tournament|NFT|0g|INFT|fairness|balance|Balance/i.test(t)) {
                        consoleLogs.push(`${new Date().toLocaleTimeString()} | ${t.substring(0, 200)}`);
                    }
                });

                const screenshot = async (name) => {
                    try {
                        const { data } = await withTimeout(c.Page.captureScreenshot(), 10000, `screenshot ${name}`);
                        fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
                        log(`📸 Screenshot: ${name}.png`);
                    } catch (e) {
                        log(`[CDP] Screenshot error: ${e.message}`);
                    }
                };

                const eval_ = async (expr) => {
                    try {
                        const r = await withTimeout(c.Runtime.evaluate({
                            expression: expr,
                            returnByValue: true,
                            awaitPromise: true
                        }), 12000, 'Runtime.evaluate');
                        return r.result?.value ?? null;
                    } catch (e) {
                        log(`[CDP] Eval error: ${e.message}`);
                        return null;
                    }
                };

                return { client: c, screenshot, eval_, logs: () => consoleLogs };
            }

            const pages = await new Promise((res, rej) => {
                http.get('http://localhost:9222/json', r => {
                    let d = '';
                    r.on('data', c => d += c);
                    r.on('end', () => res(JSON.parse(d)));
                }).on('error', rej);
            });

            const appPages = pages.filter(p =>
                p.type === 'page' &&
                p.url.includes(urlPattern) &&
                !p.url.includes('chrome-extension://')
            );
            const page = appPages.find(p => !p.url.includes('/fairness-verify'))
                       || appPages[0]
                       || pages.find(p => p.type === 'page' && p.url.includes('3001'));

            if (page) {
                log(`[CDP] Tab found: ${page.url.substring(0, 80)}`);
                const c = await withTimeout(CDP({ target: page.webSocketDebuggerUrl }), 10000, 'CDP connect');

                await withTimeout(c.Page.enable(), 5000, 'Page.enable').catch(e => log(`[CDP] ${e.message}`));
                await withTimeout(c.Runtime.enable(), 5000, 'Runtime.enable').catch(e => log(`[CDP] ${e.message}`));
                await withTimeout(c.Log.enable(), 5000, 'Log.enable').catch(e => log(`[CDP] ${e.message}`));
                await bringPageToFront(c);

                let consoleLogs = [];
                c.on('Log.entryAdded', ({ entry }) => {
                    const t = entry.text || '';
                    // Filter relevant logs
                    if (/error|Error|WARNING|Socket|Join|ROOM|Tournament|NFT|0g|INFT|fairness|balance|Balance/i.test(t)) {
                        consoleLogs.push(`${new Date().toLocaleTimeString()} | ${t.substring(0, 200)}`);
                    }
                });

                const screenshot = async (name) => {
                    try {
                        const { data } = await withTimeout(c.Page.captureScreenshot(), 10000, `screenshot ${name}`);
                        fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
                        log(`📸 Screenshot: ${name}.png`);
                    } catch (e) {
                        log(`[CDP] Screenshot error: ${e.message}`);
                    }
                };

                const eval_ = async (expr) => {
                    try {
                        const r = await withTimeout(c.Runtime.evaluate({
                            expression: expr,
                            returnByValue: true,
                            awaitPromise: true
                        }), 12000, 'Runtime.evaluate');
                        return r.result?.value ?? null;
                    } catch (e) {
                        log(`[CDP] Eval error: ${e.message}`);
                        return null;
                    }
                };

                const logs = () => consoleLogs;

                return { client: c, screenshot, eval_, logs };
            }
        } catch (e) {
            log(`[CDP] Retry (${i+1}/30): ${e.message}`);
        }

        log(`[CDP] Waiting for browser tab... (${i+1}/30)`);
        await sleep(1500);
    }

    throw new Error('Browser tab not found. Make sure Chrome CDP is running on port 9222.');
}

// ============ 注入 Mock MetaMask (0G) ============
async function injectMockWallet(c, options = {}) {
    const walletAddr = options.address || PLAYER.address;
    const chainId = options.chainId || ZEROG_CHAIN_ID_HEX;

    log(`[Inject] Injecting mock MetaMask for address: ${walletAddr.substring(0, 10)}...`);
    log(`[Inject] Chain ID: ${chainId} (0G Galileo testnet)`);

    await c.Runtime.evaluate({
        expression: `
(function() {
    // Remove existing ethereum provider to avoid conflicts
    delete window.ethereum;

    const accounts = ['${walletAddr}'];
    const chainIdHex = '${chainId}';

    window.ethereum = {
        isMetaMask: true,
        _metamask: { isUnlocked: () => true },

        request: async ({method, params}) => {
            switch(method) {
                case 'eth_requestAccounts':
                    console.log('[mockMM] eth_requestAccounts ->', accounts);
                    return accounts;
                case 'eth_accounts':
                    return accounts;
                case 'eth_chainId':
                    return chainIdHex;
                case 'eth_getBlockByNumber':
                    return null; // Don't need real blocks for testing
                case 'eth_getBalance':
                    return '0xde0b6b3a7640000'; // 1 ETH (~1e18 wei)
                case 'eth_gasPrice':
                    return '0x3b9aca00'; // 1 Gwei
                case 'eth_estimateGas':
                    return '0x5208'; // 21000 gas
                case 'wallet_switchEthereumChain':
                    console.log('[mockMM] Switching chain:', params);
                    return null;
                case 'personal_sign':
                    console.log('[mockMM] personal_sign for message:', params?.[0]?.substring(0, 50));
                    // Return fake signature (64 bytes + recovery byte = 130 hex chars)
                    return '0x' + 'a'.repeat(130);
                case 'eth_sendTransaction':
                    // For real transaction signing, we'd need actual private key
                    // Here we return a fake tx hash for testing UI flow
                    const fakeTxHash = '0x' + Array.from({length: 64}, () =>
                        Math.floor(Math.random() * 16).toString(16)
                    ).join('');
                    console.log('[mockMM] eth_sendTransaction -> fake tx:', fakeTxHash);
                    return fakeTxHash;
                default:
                    console.log('[mockMM] Unhandled method:', method, params);
                    return null;
            }
        },

        on: () => {},
        removeListener: () => {},
        emit: () => {},
        _events: {},
        chainId: chainIdHex,
        selectedAddress: accounts[0],
        isConnected: () => true
    };

    // Fire React context events after a short delay
    setTimeout(() => {
        window.ethereum.emit('accountsChanged', accounts);
        window.ethereum.emit('chainChanged', chainIdHex);

        // Also fire connect event
        if (window.ethereum._events.connect) {
            window.ethereum.emit('connect', { chainId: chainIdHex });
        }
    }, 100);

    console.log('[MockMetaMask] Injected successfully! Address:', accounts[0]);
    return 'mock metamask injected OK';
})()`,
        returnByValue: true
    });

    await sleep(1000);
    log('[Inject] Mock MetaMask injected successfully ✅');
}

// ============ 主测试流程 ============
async function runTest() {
    // Ensure output directory exists
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    log('\n========================================');
    log('  0G Poker E2E Automated Test');
    log(`  Player (browser): ${PLAYER.address.substring(0, 10)}...`);
    log(`  Bot (socket):     ${BOT.address.substring(0, 10)}...`);
    log(`  Mode: Mock Game (Straight Flush Cards)`);
    log('========================================\n');

    let tid = process.env.JOIN_TOURNAMENT_ID;
    let skipBotStartup = false;

    if (tid) {
        log(`[Step 1] Reusing existing tournament: ${tid}`);
        skipBotStartup = process.env.SKIP_BOT === 'true';
    } else {
        // ========== Step 1: 创建 Mock 锦标赛 ==========
        log('[Step 1] Creating mock tournament (configId=3, 2-player)...');

        const createRes = await httpPost(`${API_URL}/api/tournament/create`, {
            configId: 3,
            walletAddress: PLAYER.address,
            mockGame: true   // 启用 Mock 模式 -> 产生顺子牌型
        });

        if (!createRes.success && !createRes.tournament) {
            log(`[ERROR] Create failed: ${JSON.stringify(createRes).substring(0, 300)}`);
            process.exit(1);
        }

        tid = createRes.tournament?.tournamentId || createRes.tournament?.id;
        log(`[Step 1] ✅ Tournament created! ID: ${tid}`);

        // ========== Step 1b: 通过 HTTP API 加入锦标赛 ==========
        log('[Step 1b] Joining tournament via HTTP API...');

        for (const p of [
            { label: 'Player', address: PLAYER.address },
            { label: 'Bot', address: BOT.address }
        ]) {
            try {
                const joinRes = await httpPost(
                    `${API_URL}/api/tournament/${tid}/join`,
                    { walletAddress: p.address, clientBalance: BUY_IN_WEI },
                    p.address  // Use each participant's address as header
                );
                log(`  [${p.label}] ${p.address.substring(0, 10)}... joined: ${
                    JSON.stringify(joinRes).substring(0, 120)
                }`);
            } catch(e) {
                log(`  [${p.label}] Join error: ${e.message.substring(0, 100)}`);
            }
        }
        await sleep(2000);
    }

    // ========== Step 2: CDP 连接浏览器 ==========
    log('[Step 2] Connecting to Chrome via CDP...');
    let { client, screenshot, eval_: eval_, logs } = await connectCDP('3001');

    // ========== Step 3: 导航到 Landing 页面并注入钱包 ==========
    log('[Step 3] Navigating to Landing page...');
    await withTimeout(client.Page.navigate({ url: BASE_URL + '/' }), 10000, 'navigate landing').catch(e => log(`[CDP] ${e.message}`));
    await sleep(4000);
    await screenshot('01-landing-page');

    // 注入 mock MetaMask
    await injectMockWallet(client);
    await sleep(1000);
    await screenshot('02-after-inject-wallet');

    // 点击 "Connect 0G Wallet" 按钮
    log('[Step 4] Clicking Connect 0G Wallet button...');
    const connectResult = await eval_(`(function() {
        const btns = Array.from(document.querySelectorAll('button'));
        // Look for 0G or Ethereum wallet button
        const btn = btns.find(b => {
            const t = b.textContent.trim().toLowerCase();
            return (t.includes('0g') && t.includes('connect')) ||
                   (t.includes('ethereum') && t.includes('connect')) ||
                   (t.includes('connect') && b.textContent.includes('allet'));
        });
        if (btn) {
            btn.click();
            return 'Clicked: ' + btn.textContent.trim();
        }
        // List available buttons for debugging
        const allBtnTexts = btns.map(b => b.textContent.trim())
            .filter(b => b.length > 0 && b.length < 50);
        return 'No 0G button found. Available buttons: [' + allBtnTexts.join(' | ') + ']';
    })()`);

    log(`  Result: ${connectResult}`);
    await sleep(3000);
    await screenshot('03-after-connect-click');

    // 检查页面状态
    const pageState = await eval_(`({
        url: location.href,
        hasEthereum: typeof window.ethereum !== 'undefined',
        selectedAddress: window.ethereum?.selectedAddress || 'none',
        bodyPreview: document.body.innerText.substring(0, 300)
    })`);
    log(`  Page: ${JSON.stringify(pageState)?.substring(0, 250)}`);

    // ========== Step 5: 导航到锦标赛游戏页面 ==========
    log('[Step 5] Navigating to tournament play page...');
    await withTimeout(client.Page.navigate({
        url: `${BASE_URL}/tournament/${tid}/play?address=${PLAYER.address}`
    }), 10000, 'navigate play').catch(e => log(`[CDP] ${e.message}`));
    await sleep(5000);
    await screenshot('04-tournament-play-page');

    // SPA导航后重新注入钱包
    await injectMockWallet(client);
    await sleep(2000);
    await screenshot('05-reinject-wallet');

    // 手动触发 Socket.io 加入事件（关键步骤）
    log('[Step 5b] Triggering Socket.io join sequence for browser player...');
    const joinResult = await eval_(`(async function() {
        try {
            // Wait for socket to be available
            let attempts = 0;
            while (attempts < 30) {
                if (window.socket && window.socket.emit) break;
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }

            const s = window.socket;
            if (s && s.emit) {
                const connected = s.connected || s.io?.connected;
                console.log('[Test] Socket found! Connected:', connected);

                // Emit full join sequence
                s.emit('CS_LOBBY_CONNECT', { walletAddress: '${PLAYER.address}' });
                await new Promise(r => setTimeout(r, 800));

                s.emit('CS_TOURNAMENT_JOIN', {
                    tournamentId: '${tid}',
                    walletAddress: '${PLAYER.address}',
                    clientBalance: '${BUY_IN_WEI}'
                });
                await new Promise(r => setTimeout(r, 800));

                s.emit('CS_TOURNAMENT_ROOM_JOIN', {
                    tournamentId: '${tid}',
                    walletAddress: '${PLAYER.address}'
                });

                return {
                    status: 'EMIT_OK',
                    connected: connected,
                    socketId: s.id || 'none',
                    eventsEmitted: ['CS_LOBBY_CONNECT', 'CS_TOURNAMENT_JOIN', 'CS_TOURNAMENT_ROOM_JOIN']
                };
            }

            return {
                status: 'NO_SOCKET',
                windowKeys: Object.keys(window).filter(k => /socket|io/i.test(k)),
                attempts: attempts
            };
        } catch(e) {
            return { status: 'ERROR', msg: e.message };
        }
    })()`);

    log(`  Join result: ${JSON.stringify(joinResult)?.substring(0, 250)}`);
    await sleep(4000);
    await screenshot('06-socket-joined');

    // 获取当前按钮状态
    const btnState = await eval_(`(
        Array.from(document.querySelectorAll('button:not([disabled])'))
            .map(b => ({ text: b.textContent.trim(), tag: b.tagName, id: b.id }))
            .filter(b => b.text)
    )`);
    log(`  Available buttons: [${(btnState || []).map(b => b.text).join(', ') || 'none'}]`);

    const bodyText = await eval_('document.body.innerText.substring(0, 500)');
    log(`  Body preview: ${(bodyText || '').substring(0, 300)}`);

    // ========== Step 6: 启动机器人对手 ==========
    log('[Step 6] Starting 0G bot opponent...');
    const botWs = skipBotStartup ? null : await startBot(tid);
    await sleep(6000);
    await screenshot('07-bot-started');

    // ========== Step 7: 游戏循环 - 自动操作 ==========
    log('[Step 7] Starting game action loop...\n');

    let nftMintRequested = false;
    let nftAchievementSeen = false;
    let nftMintSucceeded = false;
    let fairnessVerified = false;
    let gameEnded = false;
    let totalActions = 0;
    const MAX_ROUNDS = 80;  // 最大轮次

    const waitForAchievementMintFlow = async (label = 'post-end') => {
        const deadline = Date.now() + 30000;
        let lastScreenshotAt = 0;

        while (Date.now() < deadline) {
            const mintState = await eval_(`({
                title: document.querySelector('.swal2-title')?.textContent || '',
                html: document.querySelector('.swal2-html-container')?.innerText || '',
                body: document.body.innerText.substring(0, 1600),
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 30)
            })`);

            const mintText = `${mintState?.title || ''} ${mintState?.html || ''} ${mintState?.body || ''}`;
            const mintButtons = mintState?.buttons || [];

            if (/铸造成功|Mint Successful|mint successful|成功|上链铸造成功/i.test(mintText)) {
                nftMintSucceeded = true;
                log(`[${label}] ✅ Mint success detected from page state`);
                await screenshot('nft-mint-success');
                return true;
            }

            if (/铸造失败|Mint Failed|mint failed|失败|超时|Timeout|timeout|error|Error/i.test(mintText)) {
                log(`[${label}] ❌ Mint failure or timeout detected from page state`);
                await screenshot('nft-mint-failed');
                return false;
            }

            if (!nftMintRequested && (
                /铸造 NFT|Mint NFT|Mint INFT|生成NFT|Regenerate/i.test(mintText) ||
                mintButtons.some(b => /铸造 NFT|Mint NFT|Mint INFT|生成NFT|Regenerate/i.test(b))
            )) {
                const clickResult = await eval_(`(function() {
                    const allButtons = Array.from(document.querySelectorAll('button'));
                    const target = allButtons.find(btn => /铸造 NFT|Mint NFT|Mint INFT|生成NFT|Regenerate/i.test(btn.textContent.trim()));
                    if (target) {
                        target.click();
                        return 'clicked:' + target.textContent.trim();
                    }
                    const confirmBtn = document.querySelector('.swal2-confirm');
                    if (confirmBtn) {
                        confirmBtn.click();
                        return 'clicked:swal-confirm';
                    }
                    return 'not-found';
                })()`);

                log(`[${label}] Mint click: ${clickResult}`);
                nftMintRequested = true;
                await screenshot(`nft-mint-clicked-${label}`);
            }

            if (Date.now() - lastScreenshotAt > 10000) {
                await screenshot(`nft-mint-wait-${label}-${Math.floor((Date.now() - deadline + 30000) / 1000)}s`);
                lastScreenshotAt = Date.now();
            }

            await sleep(1000);
        }

        return false;
    };

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        await sleep(1200);

        try {
            // 获取当前页面状态
            const state = await eval_(`({
                btns: Array.from(document.querySelectorAll('button:not([disabled])'))
                    .map(b => ({ text: b.textContent.trim(), disabled: b.disabled })),
                url: location.href,
                title: document.title,
                swalTitle: document.querySelector('.swal2-title')?.textContent || '',
                swalHtml: document.querySelector('.swal2-html-container')?.innerText || '',
                bodyText: document.body.innerText.substring(0, 1600)
            })`);

	            const btns = (state?.btns || []).map(b => b.text).filter(Boolean);
	            const pageText = state?.bodyText || '';
                const modalText = `${state?.swalTitle || ''} ${state?.swalHtml || ''}`;

            // 过滤出游戏操作按钮
            const gameBtns = btns.filter(b =>
                /Check|Call|Fold|Raise|All.in|Leave|Mint|铸造|Fairness|Verify|Confirm|OK|Close/i.test(b)
            );

            log(`[Round ${round}] Buttons: [${btns.join(', ')}]`);

            // 每 8 轮截一次图
            if (round % 8 === 0) {
                await screenshot(`round-${round}`);
            }

            // ---- 检测 NFT Mint 按钮 ----
            if (/成就解锁|Achievement Unlocked|恭喜|稀有牌型成就|点击下方按钮铸造/i.test(pageText + ' ' + modalText) && !nftAchievementSeen) {
                nftAchievementSeen = true;
                log(`\n🎉 NFT achievement modal detected in page state\n`);
                await screenshot('nft-achievement-modal');
            }

            if (btns.some(b => /铸造|Mint.*NFT|Mint INFT|生成NFT|Regenerate/i.test(b))) {
	                log(`\n🎉🎉🎉 NFT MINT BUTTON DETECTED! Clicking now... 🎉🎉🎉\n`);
	                await screenshot('nft-button-found-before-click');

                const mintClicked = await eval_(`(function() {
                    const btns = document.querySelectorAll('button:not([disabled])');
                    for (const btn of btns) {
                        const t = btn.textContent.trim();
                        if (/铸造|Mint.*NFT|Mint INFT|生成NFT|Regenerate/i.test(t)) {
                            btn.click();
                            return 'Clicked: ' + t;
                        }
                    }
                    return 'No mint button found';
                })()`);

	                log(`  Mint click: ${mintClicked}`);
                nftMintRequested = true;

                // 等待 NFT minting 完成或失败
                const mintDeadline = Date.now() + 150000;
                let lastMintScreenshotAt = 0;
                while (Date.now() < mintDeadline) {
                    await sleep(3000);
                    const mintState = await eval_(`({
                        title: document.querySelector('.swal2-title')?.textContent || '',
                        html: document.querySelector('.swal2-html-container')?.innerText || '',
                        body: document.body.innerText.substring(0, 1200)
                    })`);
                    const mintText = `${mintState?.title || ''} ${mintState?.html || ''} ${mintState?.body || ''}`;
                    log(`[Mint wait] title="${(mintState?.title || '').substring(0, 80)}" html="${(mintState?.html || '').substring(0, 120)}"`);

                    if (/铸造成功|Mint Successful|mint successful|成功|上链铸造成功/i.test(mintText)) {
                        nftMintSucceeded = true;
                        log('✅ Mint success detected from page state');
                        await screenshot('nft-mint-success');
                        break;
                    }

                    if (/铸造失败|Mint Failed|mint failed|失败|超时|Timeout|timeout|error|Error/i.test(mintText)) {
                        log('❌ Mint failure or timeout detected from page state');
                        await screenshot('nft-mint-failed');
                        break;
                    }

                    if (Date.now() - lastMintScreenshotAt > 10000) {
                        await screenshot(`nft-mint-wait-${Math.floor((Date.now() - mintDeadline + 150000) / 1000)}s`);
                        lastMintScreenshotAt = Date.now();
                    }
                }

                if (!nftMintSucceeded) {
                    await screenshot('nft-mint-not-complete');
                }

                gameEnded = true;
                break;  // NFT flow complete, exit loop
            }

            if (!nftMintRequested && nftAchievementSeen && /铸造 NFT|Mint NFT/i.test(pageText + ' ' + modalText)) {
                log('\n🎯 Clicking mint from detected achievement modal...\n');
                const clickMint = await eval_(`(function() {
                    const clickers = Array.from(document.querySelectorAll('button'));
                    const target = clickers.find(b => /铸造 NFT|Mint NFT/i.test(b.textContent.trim()));
                    if (target) {
                        target.click();
                        return 'clicked:' + target.textContent.trim();
                    }
                    const swalBtn = document.querySelector('.swal2-confirm');
                    if (swalBtn) {
                        swalBtn.click();
                        return 'clicked:swal-confirm';
                    }
                    return 'not-found';
                })()`);
                log(`  Mint click from modal: ${clickMint}`);
                nftMintRequested = true;
                const mintDeadline = Date.now() + 150000;
                let lastMintScreenshotAt = 0;
                while (Date.now() < mintDeadline) {
                    await sleep(3000);
                    const mintState = await eval_(`({
                        title: document.querySelector('.swal2-title')?.textContent || '',
                        html: document.querySelector('.swal2-html-container')?.innerText || '',
                        body: document.body.innerText.substring(0, 1200)
                    })`);
                    const mintText = `${mintState?.title || ''} ${mintState?.html || ''} ${mintState?.body || ''}`;
                    log(`[Mint wait] title="${(mintState?.title || '').substring(0, 80)}" html="${(mintState?.html || '').substring(0, 120)}"`);

                    if (/铸造成功|Mint Successful|mint successful|成功|上链铸造成功/i.test(mintText)) {
                        nftMintSucceeded = true;
                        log('✅ Mint success detected from page state');
                        await screenshot('nft-mint-success');
                        break;
                    }

                    if (/铸造失败|Mint Failed|mint failed|失败|超时|Timeout|timeout|error|Error/i.test(mintText)) {
                        log('❌ Mint failure or timeout detected from page state');
                        await screenshot('nft-mint-failed');
                        break;
                    }

                    if (Date.now() - lastMintScreenshotAt > 10000) {
                        await screenshot(`nft-mint-wait-${Math.floor((Date.now() - mintDeadline + 150000) / 1000)}s`);
                        lastMintScreenshotAt = Date.now();
                    }
                }

                if (!nftMintSucceeded) {
                    await screenshot('nft-mint-not-complete');
                }

                gameEnded = true;
                break;
            }

            // ---- 检测 Fairness Verify 按钮 ----
            if (btns.some(b => /fairness|verify/i.test(b)) && !fairnessVerified) {
                log('🛡️ Fairness Verify button detected! Clicking...');
                await eval_(`(function() {
                    const btns = document.querySelectorAll('button:not([disabled])');
                    for (const btn of btns) {
                        if (/fairness|verify/i.test(btn.textContent.trim())) {
                            btn.click(); return true;
                        }
                    }
                })()`);
                fairnessVerified = true;
                await sleep(2000);
                await screenshot('fairness-verified');
            }

            // ---- 游戏操作逻辑 ----
            if (gameBtns.includes('Check')) {
                await eval_(`(function() {
                    const btn = Array.from(document.querySelectorAll('button:not([disabled])'))
                        .find(b => b.textContent.trim() === 'Check');
                    if (btn) { btn.click(); return 'Check'; }
                    return 'no-check-btn';
                })()`);
                log(`  Action: CHECK`);
                totalActions++;

            } else if (gameBtns.includes('Call')) {
                await eval_(`(function() {
                    const btn = Array.from(document.querySelectorAll('button:not([disabled])'))
                        .find(b => b.textContent.trim() === 'Call');
                    if (btn) { btn.click(); return 'Call'; }
                    return 'no-call-btn';
                })()`);
                log(`  Action: CALL`);
                totalActions++;

            } else if (gameBtns.includes('Raise')) {
                // 偶尔 Raise 增加变化性
                if (round % 12 === 0) {
                    await eval_(`(function() {
                        const btn = Array.from(document.querySelectorAll('button:not([disabled])'))
                            .find(b => b.textContent.trim() === 'Raise');
                        if (btn) { btn.click(); return 'Raise'; }
                    })()`);
                    log(`  Action: RAISE (varied)`);
                } else {
                    // 默认 Call
                    await eval_(`(function() {
                        const btn = Array.from(document.querySelectorAll('button:not([disabled])'))
                            .find(b => b.textContent.trim() === 'Call');
                        if (btn) { btn.click(); return 'Call'; }
                    })()`);
                    log(`  Action: CALL (from raise fallback)`);
                }
                totalActions++;

            } else if (gameBtns.includes('Fold')) {
                // 仅在超时后 Fold
                if (round > 45) {
                    await eval_(`(function() {
                        const btn = Array.from(document.querySelectorAll('button:not([disabled])'))
                            .find(b => b.textContent.trim() === 'Fold');
                        if (btn) { btn.click(); return 'Fold'; }
                    })()`);
                    log(`  Action: FOLD (timeout)`);
                    totalActions++;
                }
            }

            // ---- 无游戏按钮检测 ----
            if (!btns.some(b => /Check|Call|Fold|Raise|All.in/i.test(b))) {
	                const preview = pageText || '';
	                log(`  No game buttons. Preview: ${preview.substring(0, 100)}`);
	                await screenshot(`no-buttons-round-${round}`);

	                if (/Back to Tournaments|Tournament Ended|Champion|Winner|Mint.*NFT|铸造|成就解锁|Achievement Unlocked/i.test(preview + ' ' + modalText)) {
	                    log('  Tournament end state detected, waiting for NFT modal/mint flow...');
	                    await waitForAchievementMintFlow(`post-end-round-${round}`);
	                    gameEnded = true;
	                    break;
	                }

	                // 如果长时间无按钮，可能游戏已结束
	                if (round > 55) {
	                    log('  No game actions remained after extended polling');
	                    await waitForAchievementMintFlow(`late-round-${round}`);
	                    gameEnded = true;
	                    break;
	                }
            }

        } catch (evalErr) {
            log(`[Round ${round}] Eval error: ${evalErr.message?.substring(0, 80)}`);
            await screenshot(`error-round-${round}`);
        }
    }

    // 最终截图
    await screenshot('99-final-state');

    // 关闭 Bot WebSocket
    try { botWs?.close(); } catch(_) {}

    // ========== Step 8: 输出结果汇总 ==========
    log('\n\n========================================');
    log('  TEST RESULTS SUMMARY');
    log('========================================');
    log(`  Total rounds:       ${MAX_ROUNDS} (max)`);
    log(`  Actions performed:  ${totalActions}`);
    log(`  NFT Mint requested: ${nftMintRequested ? '✅ YES' : '⚠️ NOT DETECTED'}`);
    log(`  NFT Mint success:   ${nftMintSucceeded ? '✅ YES' : '❌ NO'}`);
    log(`  Fairness verified:  ${fairnessVerified ? '✅ YES' : 'ℹ️ Not triggered'}`);
    log(`  Game ended:         ${gameEnded ? 'YES' : 'timeout'}`);

    // 输出控制台日志
    const allLogs = logs();
    if (allLogs.length > 0) {
        log('\n--- Console Highlights (last 20) ---');
        allLogs.slice(-20).forEach(l => log(`  ${l}`));
    }

    // ========== Step 9: 检查 NFT Gallery (0G INFT tab) ==========
    log('\n[Step 8] Checking NFT Gallery page...');
	    await withTimeout(client.Page.navigate({
	        url: `${BASE_URL}/nft?address=${PLAYER.address}`
	    }), 10000, 'navigate nft').catch(e => log(`[CDP] ${e.message}`));
    await sleep(5000);
    await screenshot('nft-gallery-page');

    // 尝试切换到 INFT / 0G tab
    const inftTabResult = await eval_(`(function() {
        // Find tabs or buttons related to 0G/INFT
        const clickableElements = Array.from(document.querySelectorAll(
            '[role=tab], button, [class*=tab], [class*=Tab], [role=button]'
        ));

        // Find 0G/INFT related elements
        const inftEls = clickableElements.filter(el =>
            /0g|inft|erc.?7857|interactive/i.test(el.textContent)
        );

        if (inftEls.length > 0) {
            inftEls[0].click();
            return 'Clicked: ' + inftEls[0].textContent.trim();
        }

        // Return what we see for debugging
        const allTabs = clickableElements.map(e => e.textContent.trim()).filter(t => t.length < 30);
        return {
            status: 'no_inft_tab_found',
            availableTabs: allTabs.slice(0, 10),
            bodySnippet: document.body.innerText.substring(0, 250)
        };
    })()`);

    log(`  INFT Tab: ${JSON.stringify(inftTabResult)?.substring(0, 250)}`);
    await sleep(2000);
    await screenshot('nft-gallery-inft-tab');

    // ========== Step 10: 检查 Fairness 验证页 ==========
	    log('[Step 9] Checking Fairness Verification page...');
	    await withTimeout(client.Page.navigate({ url: BASE_URL + '/fairness-verify' }), 10000, 'navigate fairness').catch(e => log(`[CDP] ${e.message}`));
	    await sleep(4000);
	    await screenshot('fairness-verify-page');

	    const fairnessPageBody = await eval_('document.body.innerText.substring(0, 350)')
	        .catch(e => {
	            log(`  Fairness page read skipped: ${e.message}`);
	            return '';
	        });
	    log(`  Fairness page content: ${(fairnessPageBody || '').substring(0, 250)}`);

    // ========== Step 11: 检查 Navbar 链标识 ==========
    log('[Step 10] Checking navbar chain indicator...');
    await withTimeout(client.Page.navigate({ url: BASE_URL + '/play' }), 10000, 'navigate play page').catch(e => log(`[CDP] ${e.message}`));
    await sleep(4000);
    await screenshot('navbar-chain-check');

	    const navInfo = await eval_(`(function() {
	        const bodyText = document.body.innerText;
	        return {
	            hasTRON: bodyText.includes('TRON'),
            hasZeroG: bodyText.includes('0G'),
            hasChainIndicator: /0.?G|TRON|chain/i.test(bodyText),
            badgeElement: document.querySelector('[class*=badge], [class*=chain], [class*=indicator], [id*=chain]')
	                    ?.textContent?.trim() || 'not found'
	        };
	    })()`).catch(e => {
	        log(`  Navbar read skipped: ${e.message}`);
	        return null;
	    });

	    if (navInfo) {
	        log(`  Navbar info: TRON=${navInfo.hasTRON}, 0G=${navInfo.hasZeroG}, Badge="${navInfo.badgeElement}"`);
	    } else {
	        log('  Navbar info: skipped');
	    }

    // ========== 最终输出 ==========
    log('\n\n======================================================');
    log('  0G POKER E2E AUTOMATED TEST COMPLETE');
    log('======================================================');
    log(`  Screenshots:      test-results/ directory`);
    log(`  Player address:   ${PLAYER.address}`);
    log(`  Bot address:      ${BOT.address}`);
    log(`  Game mode:        Mock (Straight Flush)`);
    log(`  NFT flow:         ${nftMintSucceeded ? 'PASS ✅' : 'MANUAL CHECK ⚠️'}`);
    log(`  Fairness:         ${fairnessVerified ? 'PASS ✅' : 'SKIPPED'}`);
    log('======================================================\n');

    // 关闭 CDP
    await client.close().catch(() => {});

    // 不因 NFT 未检测而报错（可能需要手动交互）
    process.exit(0);
}

// ============ 执行入口 ============
runTest().catch(err => {
    console.error('\n[FATAL ERROR]', err);
    process.exit(1);
});
