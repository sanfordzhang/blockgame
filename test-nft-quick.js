const CDP = require('chrome-remote-interface');
const axios = require('axios');
const { spawn, execSync } = require('child_process');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const SERVER_URL = 'http://127.0.0.1:7778';

let botProcess = null;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function createMockTournament() {
    const res = await axios.post(`${SERVER_URL}/api/tournament/create`, {
        configId: 3,
        walletAddress: PLAYER1_ADDRESS,
        mockGame: true
    });
    console.log(`[Test] Created tournament: ${res.data.tournament.tournamentId}, mockGame: ${res.data.tournament.mockGame}`);
    return res.data.tournament.tournamentId;
}

async function startBot(tournamentId) {
    return new Promise((resolve) => {
        botProcess = spawn('node', ['scripts/game-bot.js'], {
            cwd: process.cwd(),
            env: { ...process.env, JOIN_TOURNAMENT_ID: tournamentId },
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        botProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('[Bot]', output.trim());
            if (output.includes('已加入锦标赛') || output.includes('公共牌')) {
                resolve();
            }
        });
        
        botProcess.stderr.on('data', (data) => {
            console.error('[Bot Error]', data.toString());
        });
        
        setTimeout(resolve, 15000);
    });
}

async function clickButton(Runtime, buttonTexts) {
    const result = await Runtime.evaluate({
        expression: `(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            ${buttonTexts.map(text => `
                const ${text.toLowerCase().replace(/\s/g, '_')}Btn = btns.find(b => {
                    const t = b.textContent.toLowerCase();
                    return t.includes('${text.toLowerCase()}');
                });
                if (${text.toLowerCase().replace(/\s/g, '_')}Btn && !${text.toLowerCase().replace(/\s/g, '_')}Btn.disabled) {
                    ${text.toLowerCase().replace(/\s/g, '_')}Btn.click();
                    return '${text}';
                }
            `).join('\n')}
            return null;
        })()`,
        returnByValue: true
    });
    return result.result.value;
}

async function checkNFTPopup(Runtime) {
    const result = await Runtime.evaluate({
        expression: `(() => {
            const popup = document.querySelector('.swal2-popup, .swal-modal, [role="dialog"]');
            if (popup) {
                const title = document.querySelector('.swal2-title, .swal-title, h2')?.textContent;
                const html = document.querySelector('.swal2-html-container, .swal-content')?.textContent;
                const visible = popup.offsetParent !== null;
                return { hasPopup: visible, title, html };
            }
            return { hasPopup: false };
        })()`,
        returnByValue: true
    });
    return result.result.value;
}

async function takeScreenshot(Page, name) {
    const { data } = await Page.captureScreenshot();
    const fs = require('fs');
    fs.writeFileSync(`test-results/nft-${name}.png`, Buffer.from(data, 'base64'));
    console.log(`[Test] Screenshot saved: nft-${name}.png`);
}

async function getPageContent(Runtime) {
    const result = await Runtime.evaluate({
        expression: `(() => {
            // Get game state info
            const turnText = document.querySelector('.turn-indicator, [data-turn]')?.textContent || '';
            const boardCards = document.querySelectorAll('.board-card, .community-card, .card').length;
            const potText = document.querySelector('.pot, [data-pot]')?.textContent || '';
            const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent).filter(t => t.trim());
            
            // Check for winner/tournament end
            const winner = document.querySelector('.winner, .tournament-winner')?.textContent;
            const endScreen = document.body.innerText.includes('Tournament Over') || 
                              document.body.innerText.includes('最终排名') ||
                              document.body.innerText.includes('WINNER');
            
            return { turnText, boardCards, potText, buttons, winner, endScreen };
        })()`,
        returnByValue: true
    });
    return result.result.value || {};
}

async function main() {
    console.log('========================================');
    console.log('NFT Achievement Test - Mock Straight');
    console.log('========================================\n');
    
    let client;
    try {
        client = await CDP({ port: 9222 });
    } catch (e) {
        console.error('Failed to connect to Chrome CDP:', e.message);
        process.exit(1);
    }
    
    const { Page, Runtime, Network } = client;
    await Page.enable();
    await Runtime.enable();
    await Network.enable();
    
    // Listen for WebSocket messages
    let nftEventReceived = null;
    Network.webSocketFrameReceived((params) => {
        try {
            const payload = params.response.payloadData;
            // Parse JSON payload
            if (payload.startsWith('[')) {
                const parsed = JSON.parse(payload);
                const eventName = parsed[0];
                const data = parsed[1];
                if (eventName && (eventName.includes('NFT') || eventName.includes('ACHIEVEMENT'))) {
                    console.log('[WebSocket] 🎉 NFT Event:', eventName, JSON.stringify(data).substring(0, 200));
                    nftEventReceived = { eventName, data };
                }
            }
        } catch (e) {}
    });
    
    // Create tournament
    const tournamentId = await createMockTournament();
    
    // Navigate browser to tournament
    console.log(`[Test] Navigating browser to tournament ${tournamentId}...`);
    await Page.navigate({ url: `http://127.0.0.1:3001/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}` });
    await sleep(3000);
    
    // Start bot
    console.log('[Test] Starting bot...');
    await startBot(tournamentId);
    await sleep(2000);
    
    // Take initial screenshot
    await takeScreenshot(Page, '01-start');
    
    // Main game loop - both browser and bot will play
    let roundCount = 0;
    let lastBoardCount = 0;
    let lastTurn = '';
    let consecutiveNoAction = 0;
    const startTime = Date.now();
    const maxDuration = 180000; // 3 minutes max
    let nftMinted = false;
    
    console.log('[Test] Starting game loop (browser will auto-play)...');
    
    while (Date.now() - startTime < maxDuration) {
        await sleep(1500);
        
        // Check for NFT popup
        const popup = await checkNFTPopup(Runtime);
        if (popup.hasPopup) {
            console.log('[Test] 🎉 NFT POPUP DETECTED!');
            console.log('[Test] Title:', popup.title);
            console.log('[Test] Content:', popup.html);
            await takeScreenshot(Page, '02-nft-popup');
            
            // Click the mint button
            await sleep(500);
            const mintClicked = await clickButton(Runtime, ['铸造 NFT', 'Mint NFT', '确认', 'Confirm']);
            if (mintClicked) {
                console.log('[Test] ✅ Clicked mint button:', mintClicked);
                await sleep(2000);
                await takeScreenshot(Page, '03-minting');
                
                // Wait for mint to complete
                await sleep(3000);
                nftMinted = true;
            }
            break;
        }
        
        // Get page state
        const pageState = await getPageContent(Runtime);
        
        // Log state changes
        if (pageState.turnText !== lastTurn || pageState.boardCards !== lastBoardCount) {
            console.log(`[Test] Turn: "${pageState.turnText}", Board: ${pageState.boardCards} cards, Buttons: ${pageState.buttons.slice(0, 3).join(', ')}`);
            lastTurn = pageState.turnText;
            lastBoardCount = pageState.boardCards;
            roundCount++;
            await takeScreenshot(Page, `round-${roundCount}`);
        }
        
        // Check for game end
        if (pageState.endScreen) {
            console.log('[Test] Tournament ended!');
            await takeScreenshot(Page, '04-tournament-end');
            break;
        }
        
        // Check for NFT event from WebSocket
        if (nftEventReceived) {
            console.log('[Test] 🎉 NFT Event received from WebSocket!');
            await takeScreenshot(Page, '05-nft-event');
            break;
        }
        
        // Try to click action buttons for browser player
        const clicked = await clickButton(Runtime, ['Check', 'Call', 'Raise', 'Fold']);
        if (clicked) {
            console.log(`[Browser] Clicked: ${clicked}`);
            consecutiveNoAction = 0;
        } else {
            consecutiveNoAction++;
        }
        
        // If stuck for too long, try to refresh
        if (consecutiveNoAction > 20) {
            console.log('[Test] No action for 30s, refreshing...');
            await Page.reload();
            await sleep(3000);
            consecutiveNoAction = 0;
        }
    }
    
    // Final checks
    console.log('\n[Test] Final state check...');
    
    // Check server logs for NFT achievement
    try {
        const logs = execSync(`cat /tmp/game-server.log | grep -i "achievement\\|straight\\|nft\\|showdown\\|winner\\|mint\\|saved" | tail -30`).toString();
        console.log('[Test] Server logs (achievement related):');
        console.log(logs);
    } catch (e) {}
    
    // Check database for new NFT
    try {
        const nftCheck = execSync(`curl -s "http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Total NFTs:', len(d.get('nfts',[]))); [print('  -', n.get('achievementType'), n.get('gameId'), n.get('claimedAt','')[:19]) for n in d.get('nfts',[])]"`).toString();
        console.log('[Test] Database NFT check:\n' + nftCheck);
    } catch (e) {}
    
    // Take final screenshot
    await takeScreenshot(Page, '06-final');
    
    // Navigate to NFT gallery to verify
    console.log('[Test] Navigating to NFT gallery to verify...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
    await sleep(2000);
    await takeScreenshot(Page, '07-nft-gallery');
    
    // Cleanup
    if (botProcess) {
        botProcess.kill();
    }
    await client.close();
    
    console.log('\n========================================');
    if (nftEventReceived || nftMinted) {
        console.log('✅ TEST PASSED: NFT Achievement detected!');
        console.log('   Event:', nftEventReceived?.eventName);
        console.log('   Minted:', nftMinted);
    } else {
        console.log('❌ TEST FAILED: No NFT Achievement detected');
    }
    console.log('========================================');
}

main().catch(console.error);
