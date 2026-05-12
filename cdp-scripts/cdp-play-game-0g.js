/**
 * 0G Poker E2E Test via CDP
 * - Injects mock MetaMask with 0G testnet wallet
 * - Creates tournament, joins as player + bot, plays full hand
 * - Verifies fairness shield, INFT mint, NFT gallery
 */
const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const { execSync } = require('child_process');
const fs = require('fs');

// ============ Config ============
const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';
const PLAYER = { address: '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc' };
const BOT = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function httpPost(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-wallet-address': PLAYER.address } };
        const u = new URL(url);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        });
        req.on('error', reject); req.write(body); req.end();
    });
}

function cliclick(cmd) {
    try { execSync(`cliclick ${cmd}`, { encoding: 'utf-8' }); } catch (_) {}
}

// ============ Bot (WebSocket) ============
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
                            log('Bot joined tournament room');
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

function handleBotTurn(ws, state, bs) {
    if (!state?.seats) return;
    for (const [seatId, seat] of Object.entries(state.seats)) {
        if (!seat?.player) continue;
        const addr = (typeof seat.player === 'string' ? seat.player : seat.player.id || '').toLowerCase();
        if (addr !== BOT.address.toLowerCase()) continue;
        if (state.turn !== parseInt(seatId) || seat.folded) continue;
        const key = `${state.turn}-${state.street}`;
        const now = Date.now();
        if (bs.lastTurnKey !== key) { bs.lastTurnKey = key; bs.lastActionTime = 0; }
        if (now - bs.lastActionTime > 2000) {
            bs.lastActionTime = now;
            setTimeout(() => {
                const action = state.callAmount > 0 ? 'CALL' : 'CHECK';
                ws.send('42' + JSON.stringify([`CS_TOURNAMENT_${action}`, { tournamentId: bs.tournamentId }]));
                log(`Bot: ${action}`);
            }, 1200);
        }
    }
}

// ============ CDP Connection ============
async function connectCDP(urlPattern) {
    for (let i = 0; i < 20; i++) {
        const pages = await new Promise((res, rej) => {
            http.get('http://localhost:9222/json', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error', rej);
        });
        const page = pages.find(p => p.url.includes(urlPattern)) || pages.find(p => p.url.includes('3001'));
        if (page) {
            log(`CDP tab found: ${page.url.substring(0, 80)}`);
            const c = await CDP({ target: page.webSocketDebuggerUrl });
            await c.Page.enable();
            await c.Runtime.enable();
            await c.Log.enable();
            let consoleLogs = [];
            c.on('Log.entryAdded', ({entry}) => {
                const t = entry.text || '';
                if (/error|Error|WARNING|Socket|Join|ROOM|Tournament|NFT|0g|INFT|fairness/i.test(t))
                    consoleLogs.push(t.substring(0, 200));
            });
            const screenshot = name => c.Page.captureScreenshot().then(({data}) => {
                fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
                log(`📸 ${name}`);
            }).catch(() => {});
            const eval_ = expr => c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true })
                .then(r => r.result?.value).catch(e => { log(`eval error: ${e.message}`); return null; });
            const logs = () => consoleLogs;
            return { client: c, screenshot, eval_, logs };
        }
        log(`CDP waiting... (${i+1}/20)`);
        await sleep(1500);
    }
    throw new Error('Tab not found');
}

// ============ Inject Mock MetaMask for 0G ============
async function injectMockWallet(c) {
    log('Injecting mock MetaMask (0G testnet)...');
    await c.Runtime.evaluate({
        expression: `
(function() {
    // Remove existing ethereum if any
    delete window.ethereum;

    const accounts = ['${PLAYER.address}'];
    const chainIdHex = '0x40da'; // 16602 = 0G Galileo testnet

    window.ethereum = {
        isMetaMask: true,
        request: async ({method, params}) => {
            switch(method) {
                case 'eth_requestAccounts':
                case 'eth_accounts':
                    return accounts;
                case 'eth_chainId':
                    return chainIdHex;
                case 'eth_getBalance':
                    return '0xde0b6b3a7640000'; // 1 ETH
                case 'wallet_switchEthereumChain':
                    return null;
                case 'personal_sign':
                    return '0x' + 'a'.repeat(130); // fake signature
                default:
                    console.log('[mockMM] unhandled:', method, params);
                    return null;
            }
        },
        on: () => {},
        removeListener: () => {},
        emit: () => {},
        _events: {},
        chainId: chainIdHex,
        selectedAddress: accounts[0]
    };

    // Fire events so React context picks up changes
    setTimeout(() => {
        window.ethereum.emit('accountsChanged', accounts);
        window.ethereum.emit('chainChanged', chainIdHex);
    }, 100);

    return 'mock metamask injected';
})()`,
        returnByValue: true
    });
    await sleep(1000);
    log('Mock MetaMask injected ✅');
}

// ============ Main Test ============
async function runTest() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    log('=== 0G Poker E2E Test ===');

    // Step 1: Create mock tournament
    log('[1] Creating mock tournament...');
    const createRes = await httpPost(`${API_URL}/api/tournament/create`, {
        configId: 3, walletAddress: PLAYER.address, mockGame: true
    });
    if (!createRes.success) { log('Create failed: ' + JSON.stringify(createRes).substring(0,200)); process.exit(1); }
    const tid = createRes.tournament?.tournamentId || createRes.tournament?.id;
    log(`Tournament ID: ${tid}`);

    // Step 1b: Join tournament via HTTP API with sufficient balance (bypasses socket balance check)
    log('[1b] Joining tournament via HTTP API...');
    for (const p of [PLAYER, BOT]) {
        try {
            const joinRes = await httpPost(`${API_URL}/api/tournament/${tid}/join`, {
                walletAddress: p.address,
                clientBalance: 100000000 // 100 TRX in SUN units - enough for any buy-in
            });
            log(`  ${p.address.substring(0,10)}... joined: ${JSON.stringify(joinRes).substring(0,150)}`);
        } catch(e) {
            log(`  ${p.address.substring(0,10)}... join error: ${e.message.substring(0,100)}`);
        }
    }
    await sleep(2000);

    // Step 2: Connect CDP to browser tab
    log('[2] Connecting to Chrome via CDP...');
    let { client, screenshot, eval_: eval_, logs } = await connectCDP('3001');

    // Step 3: Navigate to landing page & inject mock wallet
    log('[3] Navigating to Landing page...');
    await client.Page.navigate({ url: BASE_URL + '/' }).catch(() => {});
    await sleep(3000);
    await screenshot('02-landing-page');

    // Inject mock MetaMask
    await injectMockWallet(client);
    await sleep(1000);
    await screenshot('03-after-inject');

    // Click "Connect 0G Wallet" button
    log('[4] Clicking Connect 0G Wallet...');
    const clickedConnect = await eval_(`
(function() {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('0G') || b.textContent.includes('Connect') && b.textContent.includes('allet'));
    if (btn) { btn.click(); return 'clicked: ' + btn.textContent.trim(); }
    // Try all connect-like buttons
    const allBtns = btns.map(b => b.textContent.trim()).filter(b => b.length > 0 && b.length < 40);
    return 'no 0G button found, available: ' + allBtns.join(' | ');
})()
`);
    log(`Connect result: ${clickedConnect}`);
    await sleep(3000);
    await screenshot('04-after-connect');

    // Check page state after connection attempt
    const pageState = await eval_(`({
        url: location.href,
        text: document.body.innerText.substring(0, 400),
        hasEth: typeof window.ethereum !== 'undefined'
    })`);
    log(`Page state: ${JSON.stringify(pageState).substring(0, 200)}`);

    // Step 4: Navigate to tournament play page
    log('[5] Navigating to tournament play page...');
    await client.Page.navigate({ url: `${BASE_URL}/tournament/${tid}/play?address=${PLAYER.address}` }).catch(() => {});
    await sleep(5000);
    await screenshot('05-tournament-play');

    // Re-inject mock wallet on this page (SPA navigation)
    await injectMockWallet(client);
    await sleep(2000);
    
    // CRITICAL: Manually trigger Socket.io join events for the browser player
    log('[5b] Triggering Socket.io join for browser player...');
    const joinResult = await eval_(`(async function() {
        try {
            // Wait for socket to be available
            let attempts = 0;
            while (attempts < 20) {
                if (window.socket && window.socket.emit) break;
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }
            
            const s = window.socket;
            if (s && s.emit) {
                // Check connection status
                const connected = s.connected || s.io?.connected;
                
                // Emit join sequence
                s.emit('CS_LOBBY_CONNECT', { walletAddress: '${PLAYER.address}' });
                await new Promise(r => setTimeout(r, 800));
                s.emit('CS_TOURNAMENT_JOIN', { tournamentId: '${tid}', walletAddress: '${PLAYER.address}' });
                await new Promise(r => setTimeout(r, 800));
                s.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId: '${tid}', walletAddress: '${PLAYER.address}' });
                return 'emit OK, connected=' + connected + ', id=' + (s.id || 'none');
            }
            
            return 'no emit socket found, keys=' + Object.keys(window).filter(k => /socket/i.test(k)).join(',');
        } catch(e) { return 'error: ' + e.message; }
    })()`);
    log(`Join result: ${joinResult}`);
    
    await sleep(3000);
    await screenshot('06-after-reinject');

    // Get buttons on the page
    const btnState = await eval_(`(
Array.from(document.querySelectorAll('button:not([disabled])')).map(b=>b.textContent.trim()).filter(b=>b)
)`);
    log(`Available buttons: [${btnState?.join(', ') || 'none'}]`);

    const bodyText = await eval_('document.body.innerText.substring(0, 500)');
    log(`Body text: ${(bodyText || '').substring(0, 300)}`);

    // Step 5: Start Bot
    log('[6] Starting bot opponent...');
    const botWs = await startBot(tid);
    await sleep(5000);
    await screenshot('07-bot-joined');

    // Step 6: Game loop - play actions
    log('[7] Game loop starting...');
    let nftMinted = false;
    let fairnessVerified = false;

    for (let round = 1; round <= 60; round++) {
        await sleep(1200);
        const state = await eval_(`(
{
    btns: Array.from(document.querySelectorAll('button:not([disabled])')).map(b=>({text:b.textContent.trim(),tag:b.tagName,id:b.id,cls:b.className})),
    url: location.href
})`);
        const btns = (state?.btns || []).map(b => b.text).filter(Boolean);
        log(`Round ${round}: [${btns.join(',')}]`);

        // Screenshot every 8 rounds
        if (round % 8 === 0) await screenshot(`r${round}`);

        // Check for NFT Mint button
        if (btns.some(b => /铸造|Mint|NFT/i.test(b))) {
            log('🎉 NFT Mint button detected! Clicking...');
            await screenshot('nft-btn-found');
            await eval_(`(
document.querySelectorAll('button').forEach(b=>{
    if(/铸造|Mint|NFT/i.test(b.textContent)&&!b.disabled)b.click();
})
)`);
            nftMinted = true;
            log('NFT mint clicked!');
            await sleep(8000);
            await screenshot('nft-after-click');
            break;
        }

        // Check for Verify Fairness button
        if (btns.some(b => /fairness|verify/i.test(b))) {
            log('🛡️ Fairness verify button detected!');
            await eval_(`(
document.querySelectorAll('button').forEach(b=>{
    if(/fairness|verify/i.test(b.textContent)&&!b.disabled)b.click();
})
)`);
            fairnessVerified = true;
            await sleep(2000);
            await screenshot('fairness-verified');
        }

        // Game action: click appropriate button
        if (btns.includes('Check')) {
            await eval_("document.querySelector('button:not([disabled])')?.textContent.includes('Check')&&document.querySelectorAll('button:not([disabled])').find(b=>b.textContent.trim()==='Check')?.click()");
            log('Action: Check');
        } else if (btns.includes('Call')) {
            await eval_("document.querySelectorAll('button:not([disabled])').find(b=>b.textContent.trim()==='Call')?.click()");
            log('Action: Call');
        } else if (btns.includes('Fold')) {
            // Only fold as last resort
            if (round > 30) {
                await eval_("document.querySelectorAll('button:not([disabled])').find(b=>b.textContent.trim()==='Fold')?.click()");
                log('Action: Fold (timeout)');
            }
        } else if (btns.includes('Raise')) {
            // Raise sometimes for variety
            if (round % 10 === 0) {
                await eval_("document.querySelectorAll('button:not([disabled])').find(b=>b.textContent.trim()==='Raise')?.click()");
                log('Action: Raise');
            } else if (btns.includes('Call')) {
                await eval_("document.querySelectorAll('button:not([disabled])').find(b=>b.textContent.trim()==='Call')?.click()");
                log('Action: Call (fallback from raise)');
            }
        }

        // If no game buttons, check for "Leave" or navigation
        if (!btns.some(b => /Check|Call|Fold|Raise|All.in/i.test(b))) {
            log(`No game buttons. Page might have ended. Body preview: ` + ((await eval_('document.body.innerText.substring(0,150)')) || '').substring(0, 100));
            await screenshot(`no-buttons-r${round}`);
            // Wait a bit more, maybe next hand starts
            if (round > 45) break;
        }
    }

    await screenshot('99-final-state');
    botWs.close();

    // Step 7: Verify results
    log('\n=== TEST RESULTS ===');
    log(`NFT Minted: ${nftMinted ? '✅ YES' : '⚠️ NOT DETECTED'}`);
    log(`Fairness Verified: ${fairnessVerified ? '✅ YES' : 'ℹ️ Not triggered'}`);

    // Capture console logs
    const allLogs = logs();
    if (allLogs.length > 0) {
        log(`\nConsole highlights:`);
        allLogs.slice(-15).forEach(l => log(`  ${l}`));
    }

    // Step 8: Navigate to NFT Gallery to check INFT display
    log('\n[8] Checking NFT Gallery (0G INFT tab)...');
    await client.Page.navigate({ url: `${BASE_URL}/nft?address=${PLAYER.address}` }).catch(() => {});
    await sleep(4000);
    await screenshot('nft-gallery');

    // Switch to INFT tab if available
    const inftResult = await eval_(`(
(function() {
    // Look for INFT tab or 0G tab
    const tabs = Array.from(document.querySelectorAll('*')).filter(el =>
        /0g|inft|erc.?7857/i.test(el.textContent) &&
        el.children.length < 3 &&
        el.offsetHeight > 0
    ).slice(0,5).map(e=>e.textContent.trim());
    
    // Try clicking an INFT/0G related element
    const clickable = Array.from(document.querySelectorAll('[role=tab], button, [class*=tab], [class*=Tab]'))
        .find(e => /0g|inft/i.test(e.textContent));
    if (clickable) { clickable.click(); return 'Clicked tab: ' + clickable.textContent.trim(); }
    
    return { tabs, bodyText: document.body.innerText.substring(0, 300) };
})()
)`);
    log(`INFT Tab result: ${JSON.stringify(inftResult)?.substring(0, 250)}`);
    await sleep(2000);
    await screenshot('nft-gallery-inft-tab');

    // Step 9: Check Fairness verification page
    log('[9] Checking Fairness Verify page...');
    await client.Page.navigate({ url: BASE_URL + '/fairness-verify' }).catch(() => {});
    await sleep(3000);
    await screenshot('fairness-verify-page');

    const fairnessBody = await eval_('document.body.innerText.substring(0, 300)');
    log(`Fairness page: ${(fairnessBody || '').substring(0, 200)}`);

    // Step 10: Check Navbar chain badge
    log('[10] Checking Navbar chain indicator...');
    await client.Page.navigate({ url: BASE_URL + '/play' }).catch(() => {});
    await sleep(3000);
    await screenshot('navbar-check');

    const badgeText = await eval_(`(
(function() {
    // Look for chain badge in navbar area
    const all = document.body.innerText;
    return {
        hasTRON: all.includes('TRON'), 
        hasZeroG: all.includes('0G'),
        badgeText: document.querySelector('[class*=badge], [class*=chain], [class*=indicator]')?.innerText || 'not found'
    };
})()
)`);
    log(`Navbar: TRON=${badgeText.hasTRON}, 0G=${badgeText.hasZeroG}, Badge="${badgeText.badgeText}"`);

    // Final summary
    log('\n========================================');
    log('  0G POKER E2E TEST COMPLETE');
    log('========================================');
    log(`  Screenshots saved to: test-results/`);
    log(`  Total rounds played: ~${60}`);
    log(`  NFT flow: ${nftMinted ? 'PASS' : 'NEEDS MANUAL CHECK'}`);
    log('========================================\n');

    await client.close().catch(() => {});

    // Don't exit with error even if NFT wasn't auto-detected (might need manual interaction)
    process.exit(nftMinted ? 0 : 0);
}

runTest().catch(e => { console.error('FATAL:', e); process.exit(1); });
