/**
 * NFT Achievement Test - Complete Game with Auto-play
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const API_BASE = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';

let client;
let screenshotCount = 0;

async function screenshot(name) {
    screenshotCount++;
    const filename = `/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/nft-${String(screenshotCount).padStart(2, '0')}-${name}.png`;
    const result = await client.Page.captureScreenshot();
    require('fs').writeFileSync(filename, Buffer.from(result.data, 'base64'));
    console.log(`[Screenshot] Saved: ${filename}`);
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function evaluateJS(expression) {
    const { result } = await client.Runtime.evaluate({ expression, returnByValue: true });
    return result;
}

async function clickButton(buttonText) {
    const result = await evaluateJS(`
        (function() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.textContent.includes('${buttonText}'));
            if (btn) {
                btn.click();
                return { success: true, text: btn.textContent };
            }
            return { success: false };
        })()
    `);
    return result.value;
}

async function main() {
    console.log('========================================');
    console.log('NFT Achievement Test - Complete Game');
    console.log('========================================');

    // Connect to Chrome CDP
    console.log('\n[1] Connecting to Chrome CDP...');
    client = await CDP({ port: 9222 });
    const { Page, Runtime, Network, Console } = client;

    await Page.enable();
    await Runtime.enable();
    await Network.enable();

    Console.messageAdded((msg) => {
        if (msg.message?.text?.includes('NFT') || msg.message?.text?.includes('Achievement')) {
            console.log(`[Browser Console] ${msg.message.text}`);
        }
    });

    let nftReceived = false;
    Network.webSocketFrameReceived((params) => {
        try {
            const payload = JSON.parse(params.response.payloadData);
            if (payload[0] === 'SC_NFT_ACHIEVEMENT_EARNED') {
                console.log('\n🎯 ========== NFT ACHIEVEMENT EARNED! ==========');
                console.log(JSON.stringify(payload[1], null, 2));
                console.log('=================================================\n');
                nftReceived = true;
            }
        } catch (e) {}
    });

    // Create mock tournament
    console.log('\n[2] Creating mock tournament...');
    const createRes = await axios.post(`${API_BASE}/api/tournament/create`, {
        configId: 3,
        walletAddress: PLAYER1_ADDRESS,
        mockGame: true
    });
    
    const tournamentId = createRes.data.tournament.tournamentId;
    console.log(`Tournament ID: ${tournamentId}, Mock: ${createRes.data.tournament.mockGame}`);

    // Navigate browser
    console.log('\n[3] Navigating to game page...');
    const gameUrl = `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}`;
    await Page.navigate({ url: gameUrl });
    await delay(5000);
    await screenshot('game-start');

    // Start bot
    console.log('\n[4] Starting bot for Player 2...');
    const { spawn } = require('child_process');
    
    const bot = spawn('node', ['scripts/game-bot.js'], {
        cwd: '/Users/yingfengzhang/1JackSource/blockchain/game-core',
        env: { 
            ...process.env, 
            PLAYER_INDEX: '1',
            JOIN_TOURNAMENT_ID: tournamentId
        }
    });

    bot.stdout.on('data', (data) => {
        const text = data.toString().trim();
        if (text.includes('手牌') || text.includes('公共牌') || text.includes('操作')) {
            console.log(`[Bot] ${text}`);
        }
    });

    bot.stderr.on('data', (data) => {
        console.error(`[Bot Error] ${data.toString().trim()}`);
    });

    // Auto-play loop
    console.log('\n[5] Auto-playing game...');
    
    let nftDetected = false;
    let lastActionRound = 0;
    const maxWaitTime = 180000; // 3 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        await delay(1500);
        
        // Check for NFT popup
        const popupState = await evaluateJS(`
            (function() {
                const popup = document.querySelector('.swal2-popup');
                const title = document.querySelector('.swal2-title')?.textContent || '';
                return { hasPopup: !!popup, title };
            })()
        `);
        
        if (popupState.value?.hasPopup && !nftDetected) {
            console.log('\n🎉 ========== NFT POPUP DETECTED! ==========');
            console.log('[Popup Title]', popupState.value.title);
            nftDetected = true;
            await screenshot('nft-popup');
            await evaluateJS(`document.querySelector('.swal2-confirm')?.click()`);
            await delay(1000);
            await screenshot('after-nft-popup');
        }
        
        // Check game state and play
        const gameState = await evaluateJS(`
            (function() {
                const text = document.body.innerText;
                const buttons = Array.from(document.querySelectorAll('button'));
                const btnTexts = buttons.map(b => b.textContent.substring(0, 15));
                
                const hasCheck = btnTexts.some(t => t.includes('Check'));
                const hasCall = btnTexts.some(t => t.includes('Call'));
                const hasFold = btnTexts.some(t => t.includes('Fold'));
                const hasEnded = text.includes('Tournament Ended') || text.includes('Tournament Champion');
                const hasWaiting = text.includes('Waiting for Players');
                
                return { hasCheck, hasCall, hasFold, hasEnded, hasWaiting, btnCount: buttons.length };
            })()
        `);
        
        const state = gameState.value || {};
        
        // Check game end
        if (state.hasEnded) {
            console.log('\n[Game] Tournament ended!');
            await screenshot('tournament-ended');
            break;
        }
        
        // Skip waiting room
        if (state.hasWaiting) {
            continue;
        }
        
        // Auto-play: prefer Check over Call
        if (state.hasCheck && lastActionRound !== 1) {
            console.log('[Auto] Click: Check');
            await clickButton('Check');
            lastActionRound = 1;
            await delay(500);
        } else if (state.hasCall && lastActionRound !== 2) {
            console.log('[Auto] Click: Call');
            await clickButton('Call');
            lastActionRound = 2;
            await delay(500);
        } else {
            // Reset action tracking on new betting round
            lastActionRound = 0;
        }
    }

    // Final results
    console.log('\n========================================');
    console.log('TEST RESULTS:');
    console.log(`- NFT Achievement Received (WebSocket): ${nftReceived}`);
    console.log(`- NFT Popup Detected (UI): ${nftDetected}`);
    console.log(`- Screenshots: ${screenshotCount}`);
    console.log('========================================');

    bot.kill();
    await client.close();
    process.exit(nftDetected ? 0 : 1);
}

main().catch(err => {
    console.error('[Error]', err);
    process.exit(1);
});
