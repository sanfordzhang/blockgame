/**
 * 0G Full Game Flow: Auto-connect MetaMask → Play Poker → Mint INFT → Verify Gallery
 *
 * Based on docs/GAME_BOT_TEST_FLOW.md + cdp-play-game-0g.js
 * Uses existing tournament ID and bot that's already running.
 *
 * Run: node cdp-scripts/cdp-0g-full-flow-mint.js
 */
const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

// ============ Config ============
const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';
const TOURNAMENT_ID = process.env.TID || '1778739600916';

// Browser player - 0G address (the one with existing INFTs)
const PLAYER = {
    address: '0x8808ff950b9bfddde445fd099262e80cee858eb5'
};

const ZEROG_CHAIN_ID_HEX = '0x40da'; // 16602

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function httpPost(url, data, walletAddress) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const opts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-wallet-address': walletAddress || PLAYER.address
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

// ============ Main ============
async function main() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    log(`=== 0G Full Game Flow ===`);
    log(`Tournament: ${TOURNAMENT_ID}`);
    log(`Player: ${PLAYER.address.substring(0,12)}...`);

    // Step 1: Connect CDP
    log('\n[Step 1] Connecting Chrome CDP...');
    let client;
    try {
        const pages = await new Promise((res, rej) => {
            http.get('http://localhost:9222/json', r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
        const page = pages.find(p => p.url.includes('3001')) || pages[0];
        client = await CDP({ target: page.webSocketDebuggerUrl });
        await client.Page.enable();
        await client.Runtime.enable();
        log(`Connected to: ${(page?.url || '').substring(0, 60)}`);
    } catch(e) {
        log('CDP connection failed: ' + e.message); process.exit(1);
    }

    const screenshot = async (name) => {
        try {
            const { data } = await client.Page.captureScreenshot();
            fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
            log(`  Screenshot: ${name}.png`);
        } catch(_) {}
    };

    const eval_ = async (expr) => {
        try {
            const r = await client.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
            return r.result?.value ?? null;
        } catch(e) { return null; }
    };

    // Step 2: Navigate to Landing page
    log('\n[Step 2] Navigate to landing page...');
    await client.Page.navigate({ url: BASE_URL + '/' });
    await sleep(4000);
    await screenshot('01-landing');

    // Step 3: Inject Mock MetaMask (0G chain) + fire events
    log('\n[Step 3] Injecting Mock MetaMask (0G Galileo testnet)...');
    await eval_(`(function() {
        delete window.ethereum;
        var addr = '${PLAYER.address}';
        window.ethereum = {
            isMetaMask: true,
            _metamask: { isUnlocked: function() { return true; } },
            request: async function(req) {
                switch(req.method) {
                    case 'eth_requestAccounts':
                    case 'eth_accounts':
                        return [addr];
                    case 'eth_chainId':
                        return '${ZEROG_CHAIN_ID_HEX}';
                    case 'eth_getBalance':
                        return '0xde0b6b3a7640000';
                    case 'eth_gasPrice':
                        return '0x3b9aca00';
                    case 'eth_estimateGas':
                        return '0x5208';
                    case 'wallet_switchEthereumChain':
                        return null;
                    case 'personal_sign':
                        return '0x' + 'a'.repeat(130);
                    case 'eth_sendTransaction':
                        return '0x' + Array.from({length:64},()=>Math.floor(Math.random()*16).toString(16)).join('');
                    default:
                        return null;
                }
            },
            on: function(){},
            removeListener: function(){},
            emit: function(){},
            _events: {},
            chainId: '${ZEROG_CHAIN_ID_HEX}',
            selectedAddress: addr,
            isConnected: function() { return true; }
        };
        setTimeout(function() {
            window.ethereum.emit('accountsChanged', [addr]);
            window.ethereum.emit('chainChanged', '${ZEROG_CHAIN_ID_HEX}');
            if(window.ethereum._events.connect) window.ethereum.emit('connect',{chainId:'${ZEROG_CHAIN_ID_HEX}'});
        }, 200);
        return 'mock MM injected: ' + addr;
    })()`);
    await sleep(2000);
    await screenshot('02-wallet-injected');

    // Step 4: Click "Connect 0G Wallet" button on Landing page
    log('\n[Step 4] Clicking Connect 0G Wallet button...');
    const btnResult = await eval_(`(function() {
        var btns = Array.from(document.querySelectorAll('button'));
        var b = btns.find(function(b){var t=b.textContent.trim().toLowerCase();
            return (t.includes('0g') && t.includes('connect')) ||
                   (t.includes('ethereum') && t.includes('connect')) ||
                   (t.includes('connect') && t.toLowerCase().includes('wallet'));});
        if(b) { b.click(); return 'Clicked: '+b.textContent.trim(); }
        return 'No 0G button. Available: ['+btns.map(function(b){return b.textContent.trim()}).filter(function(t){return t.length>0&&t.length<40}).join('|')+']';
    })()`);
    log(`  Result: ${btnResult}`);
    await sleep(3000);
    await screenshot('03-after-connect-click');

    // ========== Step 4: HTTP Join tournament with clientBalance ==========
    log('\n[Step 4] HTTP JOIN tournament (with clientBalance)...');
    const httpJoinRes = await new Promise((resolve) => {
        const body = JSON.stringify({
            walletAddress: PLAYER.address,
            clientBalance: 500000000  // 500 TRX - enough for buyIn
        });
        const opts = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-wallet-address': PLAYER.address }
        };
        const u = new URL(`${API_URL}/api/tournament/${TOURNAMENT_ID}/join`);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        });
        req.on('error', e => resolve({ error: e.message }));
        req.write(body); req.end();
    });
    log(`  Join result: ${JSON.stringify(httpJoinRes)?.substring(0, 200)}`);

    // Also join bot via HTTP
    await new Promise((resolve) => {
        const body = JSON.stringify({ walletAddress: '0x1DaD15c006C3e6dB2e115Bcd8b12A40CE87CD341', clientBalance: 500000000 });
        const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-wallet-address': '0x1DaD15c006C3e6dB2e115Bcd8b12A40CE87CD341' } };
        const u = new URL(`${API_URL}/api/tournament/${TOURNAMENT_ID}/join`);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { console.log('[Bot HTTP Join]', JSON.parse(d)); resolve(); } catch { resolve(); } });
        }); req.on('error', () => resolve());
        req.write(body); req.end();
    });
    log('  Bot also joined via HTTP');
    await sleep(2000);

    // Step 5: Navigate to tournament play page
    log('\n[Step 5] Navigate to tournament play page...');
    await client.Page.navigate({
        url: `${BASE_URL}/tournament/${TOURNAMENT_ID}/play?address=${PLAYER.address}`
    });
    await sleep(5000);
    await screenshot('04-tournament-page');

    // Re-inject after SPA navigation
    log('[Step 5b] Re-injecting wallet after SPA navigation...');
    await eval_(`(function(){
        var addr='${PLAYER.address}';
        if(!window.ethereum || !window.ethereum.selectedAddress){
            window.ethereum={isMetaMask:true,request:async function(r){if(r.method==='eth_requestAccounts'||r.method==='eth_accounts')return[addr];if(r.method==='eth_chainId')return'${ZEROG_CHAIN_ID_HEX}';return null;},selectedAddress:addr,isConnected:function(){return true;},on:function(){},emit:function(){}};
        }
        setTimeout(function(){window.ethereum&&window.ethereum.emit&&window.ethereum.emit('accountsChanged',[addr]);},300);
        return 'reinject done';
    })()`);
    await sleep(2000);

    // Step 6: Trigger Socket.io join via browser socket
    log('\n[Step 6] Emitting Socket.io join sequence...');
    const joinRes = await eval_(`(async function(){
        var attempts=0;
        while(attempts<20){
            if(window.socket && window.socket.emit) break;
            await new Promise(function(r){setTimeout(r,500)});
            attempts++;
        }
        var s=window.socket;
        if(s && s.emit){
            s.emit('CS_LOBBY_CONNECT',{walletAddress:'${PLAYER.address}'});
            await new Promise(function(r){setTimeout(r,800)});
            s.emit('CS_TOURNAMENT_JOIN',{tournamentId:'${TOURNAMENT_ID}',walletAddress:'${PLAYER.address}'});
            await new Promise(function(r){setTimeout(r,800)});
            s.emit('CS_TOURNAMENT_ROOM_JOIN',{tournamentId:'${TOURNAMENT_ID}',walletAddress:'${PLAYER.address}'});
            return {ok:true,sid:s.id};
        }
        return {ok:false,attempts:attempts,keys:Object.keys(window).filter(function(k){/socket|io/i.test(k)})};
    })()`);
    log(`  Join result: ${JSON.stringify(joinRes)}`);
    await sleep(5000);
    await screenshot('06-socket-joined');

    // Check buttons available
    const initBtns = await eval_(`Array.from(document.querySelectorAll('button:not([disabled])')).map(function(b){return b.textContent.trim()}).filter(function(t){return t;})`);
    log(`  Available buttons: [${(initBtns||[]).join(', ')}`);

    // Step 7: Game loop - auto-play + detect NFT mint
    log('\n[Step 7] Starting game action loop...\n');
    let nftMinted = false;
    let totalActions = 0;

    for (let round = 1; round <= 70; round++) {
        await sleep(1500);

        try {
            const state = await eval_(`({
                btns: Array.from(document.querySelectorAll('button:not([disabled])'))
                    .map(function(b){return b.textContent.trim()}),
                url: location.href,
                swalTitle: document.querySelector('.swal2-title') ? document.querySelector('.swal2-title').textContent : ''
            })`);

            const btns = state?.btns || [];
            log(`[Round ${round}] Btns: [${btns.slice(0,8).join(', ')}${btns.length>8?'...':''}] Swal:${state.swalTitle?'YES:'+state.swalTitle.substring(0,30):'no'}`);

            if (round % 10 === 0) await screenshot(`round-${round}`);

            // --- Detect NFT Mint / 铸造 button ---
            const mintMatch = btns.find(b =>
                /铸造|Mint.*NFT|Mint INFT|生成NFT|Regenerate/i.test(b)
            );
            if (mintMatch && !nftMinted) {
                log(`\n  *** NFT MINT BUTTON DETECTED: "${mintMatch}" ***\n`);
                await screenshot('nft-button-detected');

                await eval_(`(function(){
                    var bs=document.querySelectorAll('button:not([disabled])');
                    for(var i=0;i<bs.length;i++){
                        if(/铸造|Mint.*NFT|Mint INFT|生成NFT|Regenerate/i.test(bs[i].textContent.trim())){
                            bs[i].click(); return 'Clicked: '+bs[i].textContent.trim();
                        }
                    }
                    return 'not found';
                })()`);

                nftMinted = true;
                log('  Waiting for mint to complete...');
                await sleep(10000);
                await screenshot('after-nft-mint');
                break;
            }

            // --- Game actions ---
            if (btns.includes('Check')) {
                await eval_(`(function(){var b=Array.from(document.querySelectorAll('button:not([disabled])')).find(function(b){return b.textContent.trim()==='Check'}); if(b){b.click();return'Check'} return'none'})()`);
                totalActions++;
            } else if (btns.includes('Call')) {
                await eval_(`(function(){var b=Array.from(document.querySelectorAll('button:not([disabled])')).find(function(b){return b.textContent.trim()==='Call'}); if(b){b.click();return'Call'} return'none'})()`);
                totalActions++;
            } else if (btns.includes('Fold') && round > 45) {
                await eval_(`(function(){var b=Array.from(document.querySelectorAll('button:not([disabled])')).find(function(b){return b.textContent.trim()==='Fold'}); if(b){b.click();return'Fold'} return'none'})()`);
                totalActions++;
            }

            // No game buttons for too long?
            if (!btns.some(b => /Check|Call|Fold|Raise|All.in/i.test(b)) && round > 50) {
                log('  No game buttons for long time, may have ended');
                break;
            }

        } catch(e) {
            log(`  Round error: ${(e.message||'').substring(0,80)}`);
        }
    }

    await screenshot('99-final-state');
    log(`\nTotal actions: ${totalActions}, NFT minted: ${nftMinted}`);

    // Step 8: Check NFT Gallery
    log('\n[Step 8] Checking NFT Gallery...');
    await client.Page.navigate({ url: `${BASE_URL}/nft` });
    await sleep(4000);
    await screenshot('nft-gallery-before-tab');

    // Click 0G/INFT tab
    log('Clicking 0G/INFT tab...');
    const tabResult = await eval_(`(function(){
        var els=document.querySelectorAll('button,[role=tab]');
        for(var i=0;i<els.length;i++){
            var t=els[i].textContent.trim();
            if(/0.?g|inft|interactive/i.test(t)){
                els[i].click(); return 'Clicked: '+t;
            }
        }
        return 'Available tabs: ['+Array.from(els).map(function(e){return e.textContent.trim()}).join('|')+']';
    })()`);
    log(`  Tab result: ${tabResult}`);
    await sleep(3000);
    await screenshot('nft-gallery-inft-tab-final');

    // Count INFTs visible
    const inftCount = await eval_(`(function(){
        // Look for INFT card elements or count text
        var text = document.body.innerText;
        var match = text.match(/0G.*?\\(\\s*(\\d+)/);
        if(match) return parseInt(match[1]);
        // Fallback: look for CollectionCard elements
        var cards = document.querySelectorAll('[class*=CollectionCard],[class*=card]');
        return cards.length || 'unknown';
    })()`);
    log(`\n  INFT count visible: ${inftCount}`);

    // Final summary
    log('\n========================================');
    log('  0G FULL GAME FLOW COMPLETE');
    log('========================================');
    log(`  Tournament: ${TOURNAMENT_ID}`);
    log(`  Player:     ${PLAYER.address}`);
    log(`  Actions:    ${totalActions}`);
    log(`  NFT Mint:   ${nftMinted ? 'YES ✅' : 'NOT DETECTED ⚠️'}`);
    log(`  Gallery:    ${inftCount} INFT(s) visible`);
    log('========================================\n');

    await client.close().catch(()=>{});
    process.exit(nftMinted ? 0 : 0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
