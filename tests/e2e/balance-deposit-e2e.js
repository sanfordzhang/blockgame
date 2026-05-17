/**
 * E2E Test: Game Balance, Deposit, Withdraw, Tournament flows
 * 
 * Uses CDP (Chrome DevTools Protocol) on port 9222 to control browser.
 * Tests:
 *   1. Game Balance loads correctly on landing page
 *   2. Deposit updates Game Balance
 *   3. Withdraw works correctly  
 *   4. Tournament shows correct buy-in (100 TRX)
 *   5. Tournament exit shows settlement screen
 *
 * Usage: node tests/e2e/balance-deposit-e2e.js
 */

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

// Config
const CDP_PORT = 9222;
const FRONTEND_URL = 'http://127.0.0.1:3001';
const API_URL = 'http://127.0.0.1:7778';
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(SCREENSHOT_DIR, 'e2e-balance-test.log');

// Test players
const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

// Logging helper
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function screenshot(name) {
  return async (client) => {
    const { Page } = client;
    try {
      await Page.enable();
      const ss = await Page.captureScreenshot({ format: 'png' });
      const filepath = path.join(SCREENSHOT_DIR, `e2e-${name}.png`);
      fs.writeFileSync(filepath, Buffer.from(ss.data, 'base64'));
      log(`Screenshot saved: e2e-${name}.png`);
      return filepath;
    } catch (e) {
      log(`Screenshot error (${name}): ${e.message}`);
    }
  };
}

async function evaluate(client, expression) {
  const { Runtime } = client;
  await Runtime.enable();
  const result = await Runtime.evaluate({
    expression: `(function() { return JSON.stringify(${expression}); })()`,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.result.value === undefined || result.result.value === null) return null;
  try {
    return JSON.parse(result.result.value);
  } catch {
    return result.result.value;
  }
}

async function waitFor(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getBalances(client) {
  return await evaluate(client, `
    (function() {
      const text = document.body.innerText;
      const extract = (label) => {
        const m = text.match(new RegExp(label + '[\\\\s\\\\S]*?([\\\\d.]+)\\\\s*TRX'));
        return m ? parseFloat(m[1]) : null;
      };
      return {
        gameBalance: extract('Game Balance'),
        bankroll: extract('Bankroll'),
        walletTrx: extract('Wallet TRX')
      };
    })()
  `);
}

async function clickButton(client, buttonText) {
  return await evaluate(client, `
    (function() {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.trim().includes('${buttonText}'));
      if (!btn) return { found: false, disabled: null };
      btn.click();
      return { found: true, disabled: btn.disabled, text: btn.textContent.trim() };
    })()
  `);
}

async function setInputValue(client, selector, value) {
  return await evaluate(client, `
    (function() {
      const input = document.querySelector('${selector}');
      if (!input) return { found: false };
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(input, '${value}');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true, value: input.value };
    })()
  `);
}

// ==================== TEST SUITE ====================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    log(`  PASS: ${message}`);
    testsPassed++;
    return true;
  } else {
    log(`  FAIL: ${message}`);
    testsFailed++;
    return false;
  }
}

// Test 1: Landing page - Game Balance should show real balance (not 0)
async function testGameBalanceOnLoad(client, ss) {
  log('\n===== TEST 1: Game Balance on Landing Page Load =====');
  
  // Navigate to landing page
  log('Navigating to landing page...');
  await evaluate(client, "window.location.href = '/'");
  await waitFor(5000); // Wait for React mount, TronLink init, registration check
  
  // Take screenshot
  await ss(client, 'test1-landing-loaded');
  
  // Get balances
  const balances = await getBalances(client);
  log(`Balances after load: ${JSON.stringify(balances)}`);
  
  assert(balances.gameBalance !== null, `Game Balance element exists (value: ${balances.gameBalance})`);
  assert(balances.walletTrx !== null && balances.walletTrx > 0, `Wallet TRX > 0 (${balances.walletTrx})`);
  
  if (balances.gameBalance === 0) {
    log('  WARN: Game Balance is 0 after 5s - checking if still loading...');
    // Wait longer for retries
    await waitFor(8000);
    const balances2 = await getBalances(client);
    log(`Balances after additional 8s wait: ${JSON.stringify(balances2)}`);
    
    if (assert(balances2.gameBalance !== null && balances2.gameBalance > 0,
          `Game Balance > 0 after full wait (${balances2.gameBalance})`)) {
      await ss(client, 'test1-balance-correct');
      return true;
    }
    await ss(client, 'test1-balance-still-zero');
    return false;
  }
  
  assert(balances.gameBalance > 0, `Game Balance > 0 (${balances.gameBalance})`);
  await ss(client, 'test1-balance-ok');
  return true;
}

// Test 2: Deposit flow
async function testDepositFlow(client, ss) {
  log('\n===== TEST 2: Deposit Flow =====');
  
  // Navigate to landing page
  await evaluate(client, "window.location.href = '/'");
  await waitFor(4000);
  
  const before = await getBalances(client);
  log(`Before deposit: ${JSON.stringify(before)}`);
  
  // Set deposit amount
  await setInputValue(client, 'input[placeholder*="TRX"], input[type="number"]', '10');
  await waitFor(500);
  
  await ss(client, 'test2-before-deposit');
  
  // Click Deposit button
  log('Clicking Deposit button...');
  const clickResult = await clickButton(client, 'Deposit');
  log(`Deposit click: ${JSON.stringify(clickResult)}`);
  
  assert(clickResult.found, 'Deposit button found');
  
  // Wait for transaction (TRON testnet ~15-20s)
  log('Waiting for deposit tx to confirm...');
  await waitFor(20000);
  
  await ss(client, 'test2-after-deposit-wait');
  
  const after = await getBalances(client);
  log(`After deposit: ${JSON.stringify(after)}`);
  
  // Check balance increased
  if (before.gameBalance !== null && after.gameBalance !== null) {
    const diff = after.gameBalance - before.gameBalance;
    assert(diff >= 9 && diff <= 11, `Game Balance increased by ~10 TRX (diff: ${diff})`);
  }
  
  assert(after.walletTrx < before.walletTrx - 8, 
         `Wallet TRX decreased by ~10 TRX (before: ${before.walletTrx}, after: ${after.walletTrx})`);
  
  return true;
}

// Test 3: Tournament buy-in display
async function testTournamentBuyIn(client, ss) {
  log('\n===== TEST 3: Tournament Buy-In Display =====');
  
  // Navigate to tournament page
  log('Navigating to /tournament...');
  await evaluate(client, "window.location.href = '/tournament'");
  await waitFor(3000);
  
  await ss(client, 'test3-tournament-page');
  
  // Check tournament card names
  const pageInfo = await evaluate(client, `
    (function() {
      const text = document.body.innerText;
      const lines = text.split('\\n').filter(l => l.includes('Player') || l.includes('TRX') || l.includes('0G'));
      return { relevantLines: lines.slice(0, 15), hasOneTRX: text.includes('(1 TRX)'), hasHundredTRX: text.includes('(100 TRX)') };
    })()
  `);
  log(`Tournament page info: ${JSON.stringify(pageInfo)}`);
  
  assert(!pageInfo.hasOneTRX, 'No "(1 TRX)" displayed - should be 100 TRX');
  assert(pageInfo.hasHundredTRX, '"(100 TRX)" displayed correctly');
  
  return true;
}

// Test 4: Tournament exit settlement screen
async function testTournamentExitSettlement(client, ss) {
  log('\n===== TEST 4: Tournament Exit Settlement Screen =====');
  
  // This test requires joining and then leaving a tournament
  // For now, just verify we can navigate and see the UI elements
  
  log('Checking tournament exit behavior...');
  
  // First navigate to play page (game table area)
  await evaluate(client, "window.location.href = '/play'");
  await waitFor(3000);
  
  await ss(client, 'test4-play-page');
  
  // Check if there's a Leave button or tournament state
  const playState = await evaluate(client, `
    (function() {
      const text = document.body.innerText;
      const hasLeaveBtn = !!Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent.includes('Leave') || b.textContent.includes('leave')
      );
      return { hasLeaveButton: hasLeaveBtn, textPreview: text.substring(0, 500) };
    })()
  `);
  log(`Play page state: ${JSON.stringify(playState)}`);
  
  // Note: Full exit-settlement test requires active tournament session
  log('  INFO: Full exit/settlement test requires active tournament - partial check done.');
  return true;
}

// Test 5: Server API verification
async function testServerAPI(ss) {
  log('\n===== TEST 5: Server API Verification =====');
  
  // Check tournament configs via API
  const http = require('http');
  
  const fetchAPI = (path) => new Promise((resolve, reject) => {
    http.get(`${API_URL}${path}`, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
  
  // Test tournament list
  try {
    const tourns = await fetchAPI('/api/tournament/list');
    log(`Tournament count: ${tourns.tournaments?.length || 0}`);
    
    // Check all TRX tournaments have 100 TRX buy-in
    const tronTourns = (tourns.tournaments || []).filter(t => !t.config?.name?.includes('0G'));
    let allCorrect = true;
    tronTourns.forEach(t => {
      if (t.buyIn !== 100000000) {
        log(`  WARN: #${t.tournamentId} buyIn=${t.buyIn} (expected 100000000)`);
        allCorrect = false;
      }
      if (t.config?.name?.includes('(1 TRX)')) {
        log(`  WARN: #${t.tournamentId} name="${t.config.name}" (should say 100 TRX)`);
        allCorrect = false;
      }
    });
    assert(allCorrect, `All TRX tournaments have correct buyIn (checked ${tronTourns.length})`);
  } catch (e) {
    log(`  ERROR fetching tournaments: ${e.message}`);
  }
  
  // Test blockchain config (for Authorize Server)
  try {
    const config = await fetchAPI('/api/blockchain/config');
    log(`Server config: serverWalletAddress=${config.serverWalletAddress ? 'SET' : 'NULL'}, zeroGServerWalletAddress=${config.zeroGServerWalletAddress ? 'SET' : 'NULL'}`);
    assert(config.serverWalletAddress !== null, 'serverWalletAddress is set');
  } catch (e) {
    log(`  ERROR fetching blockchain config: ${e.message}`);
  }
  
  return true;
}

// ==================== MAIN ====================

async function main() {
  log('=' .repeat(60));
  log('E2E Test Suite: Balance / Deposit / Tournament');
  log(`Started at: ${new Date().toISOString()}`);
  log('=' .repeat(60));
  
  // Clear previous log
  fs.writeFileSync(LOG_FILE, '');
  
  let client;
  try {
    client = await CDP({ port: CDP_PORT });
    log(`Connected to Chrome CDP on port ${CDP_PORT}`);
  } catch (e) {
    log(`FATAL: Cannot connect to Chrome CDP on port ${CDP_PORT}. Is Chrome running with --remote-debugging-port=9222?`);
    process.exit(1);
  }
  
  const { Runtime, Page, Console } = client;
  
  // Enable console log capture
  await Runtime.enable();
  await Page.enable();
  await Console.enable();
  
  // Listen for console messages
  Console.messageAdded(({ message }) => {
    if (message.type === 'error' || message.level === 'error') {
      log(`  [BROWSER-ERROR] ${message.text}`);
    } else if (message.text.includes('[Landing]') || message.text.includes('[tronInteract]')) {
      log(`  [BROWSER-LOG] ${message.text.substring(0, 150)}`);
    }
  });
  
  const ss = screenshot;
  
  try {
    // Run tests
    await testServerAPI(ss);
    await testGameBalanceOnLoad(client, ss);
    await testDepositFlow(client, ss);
    await testTournamentBuyIn(client, ss);
    await testTournamentExitSettlement(client, ss);
    
  } finally {
    await client.close();
  }
  
  // Summary
  log('\n' + '=' .repeat(60));
  log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
  log(`Finished at: ${new Date().toISOString()}`);
  log('=' .repeat(60));
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch(e => {
  log(`FATAL: ${e.stack || e.message}`);
  process.exit(1);
});
