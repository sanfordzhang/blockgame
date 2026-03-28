/**
 * NFT Achievement Test - Verify Straight Hand Detection
 * Fixed version: Use localStorage to set mock mode
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
    return filename;
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function evaluateJS(expression) {
    const { result } = await client.Runtime.evaluate({ expression });
    return result;
}

async function main() {
    console.log('========================================');
    console.log('NFT Achievement Test - Straight Hand');
    console.log('========================================');

    // Connect to Chrome CDP
    console.log('\n[1] Connecting to Chrome CDP...');
    client = await CDP({ port: 9222 });
    const { Page, Runtime, Network, Console } = client;

    await Page.enable();
    await Runtime.enable();
    await Network.enable();

    // Listen for console logs
    Console.messageAdded((msg) => {
        if (msg.message) {
            console.log(`[Browser Console] ${msg.message.text}`);
        }
    });

    // Listen for WebSocket frames
    Network.webSocketFrameReceived((params) => {
        try {
            const payload = JSON.parse(params.response.payloadData);
            const eventName = payload[0];
            if (eventName === 'SC_NFT_ACHIEVEMENT_EARNED') {
                console.log('\n🎯 ========== NFT ACHIEVEMENT EARNED! ==========');
                console.log(JSON.stringify(payload[1], null, 2));
                console.log('=================================================\n');
            } else if (eventName?.includes('TOURNAMENT')) {
                console.log(`[Socket] ${eventName}`);
            }
        } catch (e) {}
    });

    // Navigate to tournament page
    console.log('\n[2] Navigating to tournament page...');
    await Page.navigate({ url: `${FRONTEND_URL}/tournament` });
    await delay(3000);
    await screenshot('tournament-page');

    // Set mock mode via localStorage and reload
    console.log('\n[3] Setting Mock Game mode via localStorage...');
    await evaluateJS(`
        localStorage.setItem('mockGame', 'true');
        console.log('[Mock] Set localStorage to true');
    `);
    
    // Reload page to apply localStorage change
    await Page.reload();
    await delay(3000);
    await screenshot('after-reload');

    // Verify mock is enabled
    const mockStatus = await evaluateJS(`
        (function() {
            const stored = localStorage.getItem('mockGame');
            const checkbox = document.querySelector('[data-testid="mock-game-checkbox"]');
            const checked = checkbox ? checkbox.checked : null;
            const text = document.querySelector('[data-testid="mock-game-section"]')?.innerText;
            return { stored, checked, text };
        })()
    `);
    console.log('[Mock Status]', JSON.stringify(mockStatus.value));

    // Create tournament from browser
    console.log('\n[4] Creating tournament with mock mode enabled...');
    
    // Click create button (2人赛)
    const createResult = await evaluateJS(`
        (function() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const createBtn = buttons.find(b => b.textContent.includes('2人赛') || b.textContent.includes('双人赛'));
            if (createBtn) {
                createBtn.click();
                return { success: true, text: createBtn.textContent };
            }
            return { success: false, buttons: buttons.map(b => b.textContent.substring(0, 30)) };
        })()
    `);
    console.log('[Create Button]', JSON.stringify(createResult.value));
    await delay(3000);
    await screenshot('tournament-created');

    // Get the latest tournament
    console.log('\n[5] Getting tournament info...');
    await delay(2000);

    const tournamentsRes = await axios.get(`${API_BASE}/api/tournament/list`);
    const tournaments = tournamentsRes.data.tournaments || [];
    
    // Sort by createdAt descending
    tournaments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestTournament = tournaments[0];
    
    if (!latestTournament) {
        console.log('[Error] No tournament found');
        await client.close();
        return;
    }
    
    const tournamentId = latestTournament.tournamentId;
    console.log(`[Found] Tournament ID: ${tournamentId}`);
    console.log(`[Found] Mock Mode: ${latestTournament.mockGame}`);
    console.log(`[Found] Status: ${latestTournament.status}`);

    if (!latestTournament.mockGame) {
        console.log('[Warning] Tournament was NOT created with mock mode!');
    }

    // Join the tournament with player 1 (browser)
    console.log('\n[6] Joining tournament with Player 1...');
    
    // Click on the tournament card
    const joinResult = await evaluateJS(`
        (function() {
            // Find tournament card and click
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                if (el.textContent.includes('${tournamentId}') || 
                    (el.textContent.includes('WAITING') && el.textContent.includes('TRX'))) {
                    if (el.click) {
                        el.click();
                        return { success: true, tag: el.tagName };
                    }
                }
            }
            return { success: false };
        })()
    `);
    console.log('[Join Click]', JSON.stringify(joinResult.value));
    await delay(3000);
    await screenshot('player1-joined');

    // Check if we're in waiting room or game
    const pageState = await evaluateJS(`
        (function() {
            const text = document.body.innerText;
            return {
                hasWaiting: text.includes('Waiting for Players'),
                hasGame: text.includes('Leave Tournament') || text.includes('Tournament #'),
                url: window.location.href
            };
        })()
    `);
    console.log('[Page State]', JSON.stringify(pageState.value));

    // Start game bot for player 2
    console.log('\n[7] Starting game bot for Player 2...');
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

    // Monitor game progress
    console.log('\n[8] Monitoring game progress (waiting for game to start)...');
    
    let roundCount = 0;
    let gameStarted = false;
    let nftDetected = false;
    let lastAction = '';
    const maxWaitTime = 120000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        await delay(3000);
        roundCount++;
        
        // Check current state
        const currentState = await evaluateJS(`
            (function() {
                const text = document.body.innerText;
                const url = window.location.href;
                
                // Check for NFT popup
                const swalPopup = document.querySelector('.swal2-popup');
                const swalTitle = document.querySelector('.swal2-title')?.textContent || '';
                const swalHtml = document.querySelector('.swal2-html-container')?.innerHTML || '';
                
                // Check for game state
                const hasBoard = document.querySelectorAll('[class*="PokerCard"], [class*="card"]').length > 0;
                const hasWaitingRoom = text.includes('Waiting for Players');
                const hasTournamentEnded = text.includes('Tournament Ended') || text.includes('Tournament Champion');
                
                // Check for turn indicator
                const hasMyTurn = text.includes('Your turn') || text.includes('你的回合');
                
                return {
                    url,
                    hasBoard,
                    hasWaitingRoom,
                    hasTournamentEnded,
                    hasMyTurn,
                    hasPopup: !!swalPopup,
                    swalTitle,
                    swalHtml: swalHtml.substring(0, 200),
                    pagePreview: text.substring(0, 300)
                };
            })()
        `);

        // Check for NFT popup
        if (currentState.value?.hasPopup && !nftDetected) {
            console.log('\n🎉 ========== POPUP DETECTED! ==========');
            nftDetected = true;
            await screenshot('nft-popup-detected');
            console.log('[Popup Title]', currentState.value?.swalTitle);
            console.log('[Popup Content]', currentState.value?.swalHtml);
            
            // Click confirm
            await evaluateJS(`document.querySelector('.swal2-confirm')?.click()`);
            await delay(1000);
            await screenshot('after-popup-confirmed');
        }

        // Check for game end
        if (currentState.value?.hasTournamentEnded) {
            console.log('\n[Game] Tournament ended!');
            await screenshot('tournament-ended');
            break;
        }

        // Log state changes
        const stateSummary = `hasBoard=${currentState.value?.hasBoard}, waiting=${currentState.value?.hasWaitingRoom}, turn=${currentState.value?.hasMyTurn}`;
        if (stateSummary !== lastAction) {
            console.log(`[State] ${stateSummary}`);
            lastAction = stateSummary;
        }

        // Take periodic screenshots
        if (roundCount % 5 === 0) {
            await screenshot(`progress-${roundCount}`);
        }

        // Check if still in waiting room
        if (currentState.value?.hasWaitingRoom && !gameStarted) {
            console.log('[Waiting] Still waiting for players...');
        }
        
        // Check if game started
        if (currentState.value?.hasBoard && !gameStarted) {
            console.log('[Game] Game started! Board detected.');
            gameStarted = true;
            await screenshot('game-started');
        }
    }

    // Final results
    console.log('\n========================================');
    console.log('Test Results:');
    console.log(`- Total Screenshots: ${screenshotCount}`);
    console.log(`- Game Started: ${gameStarted}`);
    console.log(`- NFT Popup Detected: ${nftDetected}`);
    console.log('========================================');

    // Kill bot
    bot.kill();

    await client.close();
    process.exit(nftDetected ? 0 : 1);
}

main().catch(err => {
    console.error('[Error]', err);
    process.exit(1);
});
