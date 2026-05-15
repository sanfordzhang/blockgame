/**
 * Comprehensive E2E Test: Verify page errors + Deposit + Game flow
 * Target: http://43.163.114.175:3001/
 * Uses existing Chrome CDP (port 9222)
 */
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'http://43.163.114.175:3001/';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results');

async function run() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Step 0: Get CDP targets
  const targets = await new Promise((res, rej) => {
    http.get('http://localhost:9222/json', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const tab = targets.find(t => t.url && t.url.includes(TARGET_URL));
  if (!tab) {
    console.log('[ERROR] No tab found for', TARGET_URL);
    console.log('Available tabs:', targets.filter(t => t.type === 'page').map(t => t.url).slice(0, 10));
    return;
  }
  console.log('[OK] Found tab:', tab.id, tab.url);

  // Connect via WebSocket
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();
  let consoleErrors = [];
  let consoleWarnings = [];

  function send(method, params) {
    return new Promise(resolve => {
      const reqId = msgId++;
      pending.set(reqId, resolve);
      ws.send(JSON.stringify({ id: reqId, method, params: params || {} }));
    });
  }

  async function eval_(expr) {
    try {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (r.result?.result?.value !== undefined) return r.result.result.value;
      if (r.result?.result) return r.result.result;
      return r;
    } catch (e) { return e; }
  }

  async function screenshot(name) {
    await send('Page.captureScreenshot', { format: 'png', saveToFile: path.join(SCREENSHOT_DIR, `${name}.png`) });
    console.log(`[SCREENSHOT] ${name}.png`);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  ws.on('message', d => {
    const m = JSON.parse(d);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });

  // Enable console + network monitoring
  await new Promise(resolve => ws.on('open', resolve));

  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');

  // Capture console errors
  await send('Runtime.evaluate', { expression: `
    window.__errors = [];
    window.__warnings = [];
    const origError = console.error;
    const origWarn = console.warn;
    console.error = function(...args) { window.__errors.push(args.join(' ')); origError.apply(console, args); };
    console.warn = function(...args) { window.__warnings.push(args.join(' ')); origWarn.apply(console, args); };
    true;
  `, returnByValue: true });

  // ==========================================
  // PHASE 1: Navigate and check page load
  // ==========================================
  console.log('\n========================================');
  console.log('  PHASE 1: Page Load Verification');
  console.log('========================================\n');

  // Navigate to the target URL
  console.log('[NAV] Navigating to', TARGET_URL);
  await send('Page.navigate', { url: TARGET_URL });
  await send('Page.loadEventFired');
  await sleep(5000);

  const currentUrl = await eval_('window.location.href');
  console.log('[URL]', currentUrl);

  await screenshot('01-page-loaded');

  // Check console errors
  consoleErrors = await eval_('window.__errors || []') || [];
  consoleWarnings = await eval_('window.__warnings || []') || [];

  if (consoleErrors.length > 0) {
    console.error('[ERRORS] Console errors found (' + consoleErrors.length + '):');
    consoleErrors.forEach((e, i) => console.error('  [' + i + ']', e.substring(0, 200)));
  } else {
    console.log('[OK] No JavaScript console errors');
  }

  // Check for 502/CORS in network
  const has502 = consoleErrors.some(e => e.includes('502'));
  const hasCors = consoleErrors.some(e => e.includes('CORS') || e.includes('Access-Control'));
  
  if (has502) console.error('[FAIL] 502 Bad Gateway still present!');
  else console.log('[OK] No 502 Bad Gateway errors');
  
  if (hasCors) console.error('[FAIL] CORS errors still present!');
  else console.log('[OK] No CORS errors');

  // Check socket connection state
  const socketState = await eval_(`
    (() => {
      // Check for socket.io elements or global state
      const hasSocket = typeof window.io !== 'undefined';
      const hasSocketProvider = !!document.querySelector('[class*="socket"]') || !!document.querySelector('[data-socket]');
      // Try to get from React context
      const bodyText = document.body.innerText || '';
      const hasConnectionError = bodyText.includes('connection error') || bodyText.includes('xhr poll error');
      return { hasSocket, hasSocketProvider, hasConnectionError, bodyTextSnippet: bodyText.substring(0, 200) };
    })()
  `);
  console.log('[SOCKET]', JSON.stringify(socketState).substring(0, 200));

  // Check visible page content
  const pageTitle = await eval_('document.title');
  console.log('[TITLE]', pageTitle);

  const buttons = await eval_("Array.from(document.querySelectorAll('button:not([disabled])')).map(b=>b.textContent.trim()).filter(t=>t)");
  console.log('[BUTTONS Available]:', buttons.join(', ') || '(none)');

  // ==========================================
  // PHASE 2: Wallet Connection & Deposit Flow
  // ==========================================
  console.log('\n========================================');
  console.log('  PHASE 2: Wallet & Deposit Flow');
  console.log('========================================\n');

  // Check wallet connection status
  const walletStatus = await eval_(`
    (() => {
      const text = document.body.innerText || '';
      const hasConnectBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Connect'));
      const hasWalletInfo = text.includes('TRON') || text.includes('TronLink') || text.includes('0G') || text.includes('MetaMask');
      
      // Look for balance display
      const balanceEl = document.querySelector('.balance-display, .chip-balance, [class*="balance"]');
      const balanceText = balanceEl ? balanceEl.textContent.trim() : 
        (text.match(/Balance[:\\s]*([\\d.]+)/i) || [])[1] || 'not found';
        
      return { 
        hasConnectBtn, 
        hasWalletInfo, 
        balanceText,
        gameBalance: (text.match(/Game Balance[:\\s]*([\\d]+)/i) || [])[1] || 'not found'
      };
    })()
  `);
  console.log('[WALLET]', JSON.stringify(walletStatus));

  // If not connected, try to connect TRON wallet
  if (walletStatus.hasConnectBtn) {
    console.log('\n[ACTION] Attempting wallet connection...');
    
    // Click TRON connect button first (or 0G button)
    const connectResult = await eval_(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        // Prefer TRON button for testnet
        const tronBtn = btns.find(b => b.textContent.includes('TRON') && b.textContent.includes('Connect'));
        if (tronBtn) { tronBtn.click(); return 'clicked TRON Connect'; }
        const anyConnBtn = btns.find(b => b.textContent === 'Connect' || b.textContent.includes('连接'));
        if (anyConnBtn) { anyConnBtn.click(); return 'clicked Connect'; }
        return 'no connect button found';
      })()
    `);
    console.log('[CONNECT]', connectResult);
    await screenshot('02-after-connect-click');
    await sleep(8000);

    // Handle TronLink popup - click "Connect" in popup
    // Use mouse coordinates from CODEBUDDY.md config
    console.log('\n[ACTION] Handling wallet popup...');
    
    // First check if a popup appeared (new window)
    const targetsAfterPopup = await new Promise((res) => {
      http.get('http://localhost:9222/json', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      });
    });
    const popupTabs = targetsAfterPopup.filter(t => t.type === 'popup' || t.type === 'app' || t.title === '');
    console.log('[POPUP] New windows/tabs:', popupTabs.length);

    // Try clicking MetaMask/TronLink connect button using known coordinates
    // From CODEBUDDY.md: Connect button at (1425, 875)
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: 1425, y: 875, button: 'left', clickCount: 1
    });
    await sleep(100);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: 1425, y: 875, button: 'left', clickCount: 1
    });
    console.log('[CLICK] Clicked connect position (1425, 875)');
    await screenshot('03-popup-click');
    await sleep(8000);

    // Re-check after connection attempt
    const walletStatus2 = await eval_(`
      (() => {
        const text = document.body.innerText || '';
        const balanceEl = document.querySelector('.balance-display, .chip-balance');
        const balanceText = balanceEl ? balanceEl.textContent.trim() : 
          (text.match(/Balance[:\\s]*([\\d.]+)/i) || [])[1] || 'not found';
        return { balanceText, snippet: text.substring(0, 150), hasDeposit: text.includes('Deposit') };
      })()
    `);
    console.log('[WALLET AFTER CONNECT]', JSON.stringify(walletStatus2));
    await screenshot('04-after-wallet-connect');
  }

  // ==========================================
  // PHASE 3: Deposit Test
  // ==========================================
  console.log('\n========================================');
  console.log('  PHASE 3: Deposit Test');
  console.log('========================================\n');

  // Get current balance before deposit
  const preDepositBalance = await eval_(`
    (() => {
      const el = document.querySelector('.balance-display, .chip-balance');
      return el ? el.textContent.trim() : 'unknown';
    })()
  `);
  console.log('[BEFORE DEPOSIT] Balance:', preDepositBalance);

  // Click deposit if available
  const depositClicked = await eval_(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const depBtn = btns.find(b => b.textContent.includes('Deposit') || b.textContent.includes('充值'));
      if (depBtn && !depBtn.disabled) { depBtn.click(); return 'clicked'; }
      return depBtn ? 'disabled' : 'not found';
    })()
  `);
  console.log('[DEPOSIT BUTTON]', depositClicked);

  if (depositClicked === 'clicked') {
    await sleep(4000);
    await screenshot('05-deposit-modal');

    // Enter amount
    await eval_(`
      (() => {
        const input = document.querySelector('input[type="number"], input[type="text"]');
        if (input) { 
          input.value = '10'; 
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return 'set 10';
        }
        return 'no input';
      })()
    `);
    console.log('[DEPOSIT] Entered amount: 10');

    // Click confirm
    const confirmClicked = await eval_(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confBtn = btns.find(b => b.textContent.includes('Confirm') || b.textContent.includes('确认') || b.textContent.includes('Approve'));
        if (confBtn && !confBtn.disabled) { confBtn.click(); return 'clicked'; }
        return confBtn ? 'disabled' : 'not found';
      })()
    `);
    console.log('[CONFIRM]', confirmClicked);

    if (confirmClicked === 'clicked') {
      console.log('[WAITING] Waiting 15s for signature + blockchain confirmation...');
      await screenshot('06-deposit-signing');
      
      // Wait for transaction to complete
      for (let i = 0; i < 15; i++) {
        await sleep(1000);
        if (i % 3 === 0) {
          // Check for sign popup again
          await send('Input.dispatchMouseEvent', {
            type: 'mousePressed', x: 1425, y: 875, button: 'left', clickCount: 1
          });
          await send('Input.dispatchMouseEvent', {
            type: 'mouseReleased', x: 1425, y: 875, button: 'left', clickCount: 1
          });
        }
      }

      const postDepositBalance = await eval_(`
        (() => {
          const el = document.querySelector('.balance-display, .chip-balance');
          return el ? el.textContent.trim() : 'unknown';
        })()
      `);
      console.log('[AFTER DEPOSIT] Balance:', postDepositBalance);
      await screenshot('07-post-deposit');
    }
  } else {
    console.log('[SKIP] Deposit button not available/clickable');
  }

  // ==========================================
  // PHASE 4: Game Entry
  // ==========================================
  console.log('\n========================================');
  console.log('  PHASE 4: Game Entry');
  console.log('========================================\n');

  const enterClicked = await eval_(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button:not([disabled])'));
      const enterBtn = btns.find(b => 
        b.textContent.includes('Enter Game') || 
        b.textContent.includes('进入游戏') ||
        b.textContent.includes('Join')
      );
      if (enterBtn) { enterBtn.click(); return 'clicked'; }
      return btns.map(b => b.textContent.trim().substring(0, 30)).join('|');
    })()
  `);
  console.log('[ENTER GAME]', enterClicked);

  if (enterClicked === 'clicked') {
    console.log('[WAITING] Waiting for game room load...');
    await sleep(8000);
    
    const gameUrl = await eval_('window.location.href');
    console.log('[URL]', gameUrl);
    await screenshot('08-game-room');

    // Wait more for full game UI
    await sleep(5000);

    // Check game state
    const gameState = await eval_(`
      (() => {
        const text = document.body.innerText || '';
        const btns = Array.from(document.querySelectorAll('button:not([disabled])')).map(b => b.textContent.trim());
        return { 
          url: window.location.pathname,
          buttons: btns.slice(0, 15),
          hasTable: text.includes('table') || text.includes('Seat'),
          hasFold: btns.some(b => b === 'Fold'),
          hasCheck: btns.some(b => b === 'Check'),
          hasCall: btns.some(b => b === 'Call'),
          hasRaise: btns.some(b => b === 'Raise'),
          hasLeave: btns.some(b => b === 'Leave'),
          snippet: text.substring(0, 250)
        };
      })()
    `);
    console.log('[GAME STATE]', JSON.stringify(gameState).substring(0, 300));
    await screenshot('09-game-state');

    // ==========================================
    // PHASE 5: Play a hand (Fold/Check/Call)
    // ==========================================
    console.log('\n========================================');
    console.log('  PHASE 5: Playing a Hand');
    console.log('========================================\n');

    // Try up to 3 actions per round
    for (let round = 1; round <= 3; round++) {
      console.log(`--- Round ${round} ---`);
      
      const action = await eval_(`
        (() => {
          const btns = Array.from(document.querySelectorAll('button:not([disabled])'));
          const texts = btns.map(b => b.textContent.trim());
          
          // Priority: Fold > Call > Check > Raise > Leave
          if (texts.includes('Fold')) {
            const btn = btns.find(b => b.textContent.trim() === 'Fold');
            btn.click();
            return 'Fold';
          }
          if (texts.includes('Check')) {
            const btn = btns.find(b => b.textContent.trim() === 'Check');
            btn.click();
            return 'Check';
          }
          if (texts.includes('Call')) {
            const btn = btns.find(b => b.textContent.trim() === 'Call');
            btn.click();
            return 'Call';
          }
          if (texts.includes('Raise')) {
            const btn = btns.find(b => b.textContent.trim() === 'Raise');
            btn.click();
            return 'Raise';
          }
          if (texts.includes('All In')) {
            const btn = btns.find(b => b.textContent.trim() === 'All In');
            btn.click();
            return 'All In';
          }
          if (texts.includes('Leave')) {
            const btn = btns.find(b => b.textContent.trim() === 'Leave');
            btn.click();
            return 'Leave';
          }
          return 'none:' + texts.slice(0, 6).join(',');
        })()
      `);
      console.log(`[ACTION ${round}]`, action);
      
      if (action.startsWith('none:') && !action.includes('Leave')) {
        console.log('[INFO] No action buttons found, waiting...');
        break;
      }
      if (action === 'Leave') {
        console.log('[INFO] Left the table, stopping game play');
        break;
      }

      await sleep(6000); // Wait between actions
      await screenshot(`10-round${round}-after-${action}`);
    }

    // Final state
    await sleep(3000);
    const finalState = await eval_(`
      (() => {
        const text = document.body.innerText || '';
        const btns = Array.from(document.querySelectorAll('button:not([disabled])')).map(b => b.textContent.trim());
        return { buttons: btns.slice(0, 10), snippet: text.substring(0, 200) };
      })()
    `);
    console.log('[FINAL STATE]', JSON.stringify(finalState).substring(0, 200));
    await screenshot('11-final-state');
  } else {
    console.log('[SKIP] Cannot enter game. Buttons:', enterClicked);
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n========================================');
  console.log('  TEST SUMMARY');
  console.log('========================================\n');

  const finalErrors = await eval_('window.__errors || []') || [];
  console.log('[TOTAL ERRORS]:', finalErrors.length);
  if (finalErrors.length > 0) {
    finalErrors.forEach((e, i) => console.error('  ERR[' + i + ']:', e.substring(0, 200)));
  }
  
  console.log('[SCREENSHOTS saved to]:', SCREENSHOT_DIR);
  console.log('\n[DONE]');
  ws.close();
}

run().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
