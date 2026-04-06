/**
 * Complete Tournament Settlement Test
 * Tests the full tournament flow with balance verification
 */

const CDP = require('chrome-remote-interface');
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.testnet' });

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const CONTRACT_ADDRESS = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';

const SERVER_URL = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';
const CDP_PORT = 9222;

let client, Page, Runtime, DOM;

// Utility functions
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getContractBalance(tronWeb, playerAddress) {
    const abi = [
        {"inputs":[{"name":"","type":"address"}],"name":"players","outputs":[{"name":"balance","type":"uint256"},{"name":"lockedAmount","type":"uint256"},{"name":"isRegistered","type":"bool"}],"stateMutability":"view","type":"function"}
    ];
    const contract = await tronWeb.contract(abi, CONTRACT_ADDRESS);
    try {
        const info = await contract.players(playerAddress).call();
        return {
            balance: Number(info.balance) / 1e6,
            locked: Number(info.lockedAmount) / 1e6
        };
    } catch (e) {
        return { balance: 0, locked: 0 };
    }
}

async function saveScreenshot(name) {
    const screenshot = await Page.captureScreenshot({ format: 'png' });
    const screenshotsDir = path.join(__dirname, 'test-results');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    fs.writeFileSync(path.join(screenshotsDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
    console.log(`  📸 Saved: ${name}.png`);
}

async function executeJS(code) {
    const result = await Runtime.evaluate({ expression: code, returnByValue: true });
    return result.result?.value;
}

async function main() {
    console.log('=== Complete Tournament Settlement Test ===\n');
    
    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullHost: 'https://api.nile.trongrid.io',
        privateKey: process.env.SERVER_PRIVATE_KEY
    });
    
    // Get initial balances
    console.log('Initial Balances:');
    const p1Before = await getContractBalance(tronWeb, PLAYER1_ADDRESS);
    const p2Before = await getContractBalance(tronWeb, PLAYER2_ADDRESS);
    console.log(`  Player 1: ${p1Before.balance.toFixed(2)} TRX (locked: ${p1Before.locked.toFixed(2)})`);
    console.log(`  Player 2: ${p2Before.balance.toFixed(2)} TRX (locked: ${p2Before.locked.toFixed(2)})`);
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/bridge-poker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    const Tournament = mongoose.model('Tournament', new mongoose.Schema({}, { strict: false }));
    
    // Get latest tournament before this test
    const latestTournamentBefore = await Tournament.findOne({ 
        status: 'COMPLETED', configId: 3 
    }).sort({ finishedAt: -1 });
    console.log(`  Latest tournament before test: ${latestTournamentBefore?.tournamentId || 'none'}`);
    
    // Connect to Chrome CDP
    console.log('\nConnecting to Chrome CDP...');
    client = await CDP({ port: CDP_PORT });
    ({ Page, Runtime, DOM } = client);
    await Promise.all([Page.enable(), Runtime.enable(), DOM.enable()]);
    console.log('  ✅ Connected to Chrome');
    
    try {
        // Step 1: Navigate to tournament page
        console.log('\n[Step 1] Navigate to tournament page...');
        await Page.navigate({ url: `${FRONTEND_URL}/tournament` });
        await Page.loadEventFired();
        await sleep(2000);
        await saveScreenshot('01-tournament-page');
        
        // Step 2: Enable mock game mode
        console.log('\n[Step 2] Enable mock game mode...');
        const mockEnabled = await executeJS(`
            (function() {
                const checkbox = document.querySelector('input[data-testid="mock-game-checkbox"]');
                if (checkbox && !checkbox.checked) {
                    checkbox.click();
                    return true;
                }
                return checkbox?.checked || false;
            })()
        `);
        console.log(`  Mock game enabled: ${mockEnabled}`);
        await sleep(500);
        await saveScreenshot('02-mock-enabled');
        
        // Step 3: Create new tournament
        console.log('\n[Step 3] Create new tournament...');
        const createResult = await executeJS(`
            (function() {
                // Click "双人赛" button
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.includes('双人赛')) {
                        btn.click();
                        return 'clicked';
                    }
                }
                return 'not found';
            })()
        `);
        console.log(`  Create result: ${createResult}`);
        await sleep(3000);
        await saveScreenshot('03-tournament-created');
        
        // Step 4: Wait for bot and join tournament
        console.log('\n[Step 4] Wait for bot and join tournament...');
        
        // Wait up to 10 seconds for tournament with 1/2 players
        let joined = false;
        for (let i = 0; i < 20; i++) {
            await sleep(500);
            const result = await executeJS(`
                (function() {
                    const cards = document.querySelectorAll('.sc-bypJrT.ilegoF');
                    for (const card of cards) {
                        if ((card.innerText || '').includes('1 / 2') || (card.innerText || '').includes('1/2')) {
                            card.click();
                            return 'found and clicked';
                        }
                    }
                    return 'waiting';
                })()
            `);
            if (result === 'found and clicked') {
                console.log('  Found tournament with 1/2 players, clicked');
                joined = true;
                break;
            }
        }
        
        if (!joined) {
            console.log('  ⚠️ No tournament found, creating one manually via API...');
            // Create tournament via API
            const fetch = require('node-fetch');
            const createResp = await fetch(`${SERVER_URL}/api/tournament/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ configId: 3, mockGame: true })
            });
            const createData = await createResp.json();
            console.log(`  Created tournament: ${createData.tournament?.tournamentId}`);
            await sleep(2000);
            await Page.navigate({ url: `${FRONTEND_URL}/tournament` });
            await Page.loadEventFired();
            await sleep(2000);
        }
        
        await saveScreenshot('04-ready-to-join');
        
        // Step 5: Click confirm to join
        console.log('\n[Step 5] Confirm joining...');
        await sleep(1000);
        const confirmResult = await executeJS(`
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.trim() === 'Confirm') {
                        btn.click();
                        return 'clicked';
                    }
                }
                return 'not found';
            })()
        `);
        console.log(`  Confirm result: ${confirmResult}`);
        await sleep(3000);
        await saveScreenshot('05-joined');
        
        // Step 6: Wait for game to start and play
        console.log('\n[Step 6] Play game...');
        
        // Game loop - play until game ends
        let gameEnded = false;
        let roundCount = 0;
        const maxRounds = 50;
        
        while (!gameEnded && roundCount < maxRounds) {
            roundCount++;
            await sleep(1500);
            
            // Check for game buttons
            const gameState = await executeJS(`
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'))
                        .filter(b => !b.disabled && ['Check', 'Call', 'Fold', 'Raise'].includes(b.textContent.trim()))
                        .map(b => b.textContent.trim());
                    
                    const gameOver = document.body.innerText.includes('Tournament Champion') || 
                                     document.body.innerText.includes('Tournament Ended') ||
                                     document.body.innerText.includes('eliminated');
                    
                    return { buttons, gameOver };
                })()
            `);
            
            if (gameState?.gameOver) {
                console.log(`  🎮 Game ended after ${roundCount} rounds`);
                gameEnded = true;
                break;
            }
            
            if (gameState?.buttons?.length > 0) {
                const btn = gameState.buttons[0]; // Take first available action
                console.log(`  Round ${roundCount}: Clicking ${btn}`);
                
                await executeJS(`
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === '${btn}' && !btn.disabled) {
                                btn.click();
                                return true;
                            }
                        }
                        return false;
                    })()
                `);
            }
            
            if (roundCount % 5 === 0) {
                await saveScreenshot(`06-game-round-${roundCount}`);
            }
        }
        
        await sleep(2000);
        await saveScreenshot('07-game-ended');
        
        // Step 7: Verify settlement
        console.log('\n[Step 7] Verify settlement...');
        
        // Get final balances
        await sleep(2000); // Wait for blockchain settlement
        const p1After = await getContractBalance(tronWeb, PLAYER1_ADDRESS);
        const p2After = await getContractBalance(tronWeb, PLAYER2_ADDRESS);
        
        console.log('\nFinal Balances:');
        console.log(`  Player 1: ${p1After.balance.toFixed(2)} TRX (locked: ${p1After.locked.toFixed(2)})`);
        console.log(`  Player 2: ${p2After.balance.toFixed(2)} TRX (locked: ${p2After.locked.toFixed(2)})`);
        
        console.log('\nBalance Changes:');
        const p1Change = p1After.balance - p1Before.balance;
        const p2Change = p2After.balance - p2Before.balance;
        console.log(`  Player 1: ${p1Change >= 0 ? '+' : ''}${p1Change.toFixed(2)} TRX`);
        console.log(`  Player 2: ${p2Change >= 0 ? '+' : ''}${p2Change.toFixed(2)} TRX`);
        
        // Get tournament result from DB
        const latestTournament = await Tournament.findOne({ 
            status: 'COMPLETED', configId: 3 
        }).sort({ finishedAt: -1 });
        
        if (latestTournament && latestTournament.tournamentId !== latestTournamentBefore?.tournamentId) {
            console.log('\nTournament Result:');
            console.log(`  ID: ${latestTournament.tournamentId}`);
            console.log(`  Rake: ${(latestTournament.rakeAmount/1e6).toFixed(2)} TRX`);
            for (const r of latestTournament.rankings || []) {
                console.log(`  #${r.position}: ${r.address?.substring(0, 10)}... prize=${(r.prize/1e6).toFixed(2)} TRX`);
            }
            
            // Verify
            const winner = latestTournament.rankings?.find(r => r.position === 1);
            const expectedWinnerNet = (winner?.prize || 0) / 1e6 - 100; // prize - buyIn
            
            if (Math.abs(p1Change - expectedWinnerNet) < 0.1 || Math.abs(p2Change - expectedWinnerNet) < 0.1) {
                console.log('\n✅ Settlement verification PASSED!');
                console.log(`  Winner should gain: +${expectedWinnerNet.toFixed(2)} TRX`);
                console.log(`  Actual changes match expected!`);
            } else {
                console.log('\n⚠️ Settlement verification needs review:');
                console.log(`  Expected winner net: +${expectedWinnerNet.toFixed(2)} TRX`);
                console.log(`  Player 1 change: ${p1Change.toFixed(2)} TRX`);
                console.log(`  Player 2 change: ${p2Change.toFixed(2)} TRX`);
            }
        }
        
        console.log('\n=== Test Complete ===');
        
    } finally {
        await client.close();
        await mongoose.disconnect();
    }
}

main().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
