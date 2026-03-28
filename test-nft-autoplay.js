/**
 * NFT Achievement Test - With Auto-play for Player 1
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
    const filename = `/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/nft-test-${String(screenshotCount).padStart(2, '0')}-${name}.png`;
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
    console.log('NFT Achievement Test - Mock Game');
    console.log('========================================');

    // Connect to Chrome CDP
    console.log('\n[1] Connecting to Chrome CDP...');
    client = await CDP({ port: 9222 });
    const { Page, Runtime, Network, Console } = client;

    await Page.enable();
    await Runtime.enable();
    await Network.enable();

    Console.messageAdded((msg) => {
        if (msg.message?.text) {
            console.log(`[Browser Console] ${msg.message.text}`);
        }
    });

    Network.webSocketFrameReceived((params) => {
        try {
            const payload = JSON.parse(params.response.payloadData);
            if (payload[0] === 'SC_NFT_ACHIEVEMENT_EARNED') {
                console.log('\n🎯 ========== NFT ACHIEVEMENT EARNED! ==========');
                console.log(JSON.stringify(payload[1], null, 2));
                console.log('=================================================\n');
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

    // Navigate browser to game page
    console.log('\n[3] Navigating to game page...');
    const gameUrl = `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}`;
    await Page.navigate({ url: gameUrl });
    await delay(5000);
    await screenshot('game-page');

    // Start bot for player 2
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
        console.log(`[Bot] ${data.toString().trim()}`);
    });

    bot.stderr.on('data', (data) => {
        console.error(`[Bot Error] ${data.toString().trim()}`);
    });

    // Monitor and auto-play for Player 1
    console.log('\n[5] Monitoring and auto-playing...');
    
    let roundCount = 0;
    let nftDetected = false;
    let lastAction = '';
    const maxWaitTime = 120000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        await delay(2000);
        roundCount++;
        
        // Check for NFT popup first
        const popupState = await evaluateJS(`
            (function() {
                const popup = document.querySelector('.swal2-popup');
                const title = document.querySelector('.swal2-title')?.textContent || '';
                return { hasPopup: !!popup, title };
            })()
        `);
        
        if (popupState.value?.hasPopup && !nftDetected) {
            console.log('\n🎉 ========== POPUP DETECTED! ==========');
            console.log('[Popup Title]', popupState.value.title);
            nftDetected = true;
            await screenshot('nft-popup');
            await evaluateJS(`document.querySelector('.swal2-confirm')?.click()`);
            await delay(1000);
            await screenshot('after-popup');
            continue;
        }
        
        // Check if it's our turn and click a button
        const gameState = await evaluateJS(`
            (function() {
                const text = document.body.innerText;
                const buttons = Array.from(document.querySelectorAll('button'));
                const hasFold = buttons.some(b => b.textContent.includes('Fold'));
                const hasCheck = buttons.some(b => b.textContent.includes('Check'));
                const hasCall = buttons.some(b => b.textContent.includes('Call'));
                const hasRaise = buttons.some(b => b.textContent.includes('Raise'));
                const hasEnded = text.includes('Tournament Ended') || text.includes('Tournament Champion');
                const hasWaiting = text.includes('Waiting for Players');
                
                return {
                    hasFold, hasCheck, hasCall, hasRaise, hasEnded, hasWaiting,
                    buttonCount: buttons.length
                };
            })()
        `);
        
        const state = gameState.value || {};
        
        // Check if game ended
        if (state.hasEnded) {
            console.log('[Game] Tournament ended!');
            await screenshot('tournament-ended');
            break;
        }
        
        // Skip if waiting room
        if (state.hasWaiting) {
            continue;
        }
        
        // Auto-play: Check > Call > Fold
        if (state.hasCheck) {
            const actionKey = `check-${roundCount}`;
            if (actionKey !== lastAction) {
                console.log('[Auto] Clicking Check button');
                await clickButton('Check');
                lastAction = actionKey;
                await delay(500);
            }
        } else if (state.hasCall) {
            const actionKey = `call-${roundCount}`;
            if (actionKey !== lastAction) {
                console.log('[Auto] Clicking Call button');
                await clickButton('Call');
                lastAction = actionKey;
                await delay(500);
            }
        } else if (state.hasFold) {
            // Only fold if we really have no other choice (shouldn't happen in mock)
            console.log('[Auto] Only Fold available - waiting...');
        }
        
        // Periodic screenshots
        if (roundCount % 10 === 0) {
            await screenshot(`progress-${roundCount}`);
        }
    }

    console.log('\n========================================');
    console.log('Test Results:');
    console.log(`- Screenshots: ${screenshotCount}`);
    console.log(`- NFT Popup Detected: ${nftDetected}`);
    console.log('========================================');

    bot.kill();
    await client.close();
    process.exit(nftDetected ? 0 : 1);
}

main().catch(err => {
    console.error('[Error]', err);
    process.exit(1);
});
