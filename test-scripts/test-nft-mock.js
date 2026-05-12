/**
 * NFT Achievement Test - Direct API join
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
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

    // Step 1: Create tournament with mockGame via API
    console.log('\n[2] Creating mock tournament via API...');
    const createRes = await axios.post(`${API_BASE}/api/tournament/create`, {
        configId: 3,
        walletAddress: PLAYER1_ADDRESS,
        mockGame: true
    });
    
    const tournamentId = createRes.data.tournament.tournamentId;
    const mockGame = createRes.data.tournament.mockGame;
    console.log(`Tournament ID: ${tournamentId}, Mock: ${mockGame}`);

    // Step 2: Navigate browser to tournament game page
    console.log('\n[3] Navigating browser to game page...');
    const gameUrl = `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}`;
    await Page.navigate({ url: gameUrl });
    await delay(5000);
    await screenshot('game-page');

    // Step 3: Check page state
    const pageInfo = await evaluateJS(`document.body.innerText.substring(0, 500)`);
    console.log('[Page Info]', pageInfo.value);

    // Step 4: Start bot to join as player 2
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

    // Step 5: Monitor game
    console.log('\n[5] Monitoring game progress...');
    
    let roundCount = 0;
    let nftDetected = false;
    let gameStarted = false;
    const maxWaitTime = 90000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        await delay(3000);
        roundCount++;
        
        // Check for game state
        const state = await evaluateJS(`
            (function() {
                const text = document.body.innerText;
                const hasBoard = document.querySelectorAll('[class*="PokerCard"], [class*="card"]').length > 0;
                const hasWaiting = text.includes('Waiting for Players') || text.includes('等待玩家');
                const hasEnded = text.includes('Tournament Ended') || text.includes('Tournament Champion');
                const hasMyTurn = text.includes('Your turn') || text.includes('Fold');
                
                // Check for swal popup
                const hasPopup = !!document.querySelector('.swal2-popup');
                const popupTitle = document.querySelector('.swal2-title')?.textContent || '';
                
                return { hasBoard, hasWaiting, hasEnded, hasMyTurn, hasPopup, popupTitle, textPreview: text.substring(0, 200) };
            })()
        `);

        if (state.value) {
            const { hasBoard, hasWaiting, hasEnded, hasMyTurn, hasPopup, popupTitle, textPreview } = state.value;
            
            // Log state changes
            if (!gameStarted && hasBoard) {
                console.log('[Game] Game started! Board visible.');
                gameStarted = true;
                await screenshot('game-started');
            }
            
            if (hasMyTurn && !hasWaiting) {
                console.log('[Game] Player turn detected');
            }

            // Check for NFT popup
            if (hasPopup && !nftDetected) {
                console.log('\n🎉 ========== POPUP DETECTED! ==========');
                console.log('[Popup Title]', popupTitle);
                nftDetected = true;
                await screenshot('nft-popup');
                
                // Click confirm button
                await evaluateJS(`document.querySelector('.swal2-confirm')?.click()`);
                await delay(1000);
                await screenshot('after-popup');
            }

            // Game ended
            if (hasEnded) {
                console.log('[Game] Tournament ended');
                await screenshot('tournament-ended');
                break;
            }
        }

        // Periodic screenshots
        if (roundCount % 5 === 0) {
            await screenshot(`progress-${roundCount}`);
        }
    }

    console.log('\n========================================');
    console.log('Test Results:');
    console.log(`- Screenshots: ${screenshotCount}`);
    console.log(`- Game Started: ${gameStarted}`);
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
