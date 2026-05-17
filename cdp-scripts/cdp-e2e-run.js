const CDP = require('chrome-remote-interface');
const path = require('path');
const http = require('http');

// ============ Config ============
const SS = '/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results';
const TARGET_URL = 'http://43.163.114.175:3001/';
const API_BASE = 'http://43.163.114.175:7778';

// Test players from CODEBUDDY.md
const PLAYER1 = { address: '0x8808ff950b9bfddde445fd099262e80cee858eb5' };
const PLAYER2 = {
  address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
  privateKey: PLAYER2_PRIVATE_KEY
};

// Mouse positions from CODEBUDDY.md
const P = {
  disconnect1: { x: 1464, y: 883 },
  disconnect2: { x: 1362, y: 380 },
  btn0g:      { x: 492, y: 758 },
  metaMask:   { x: 1208, y: 271 },
  connect:    { x: 1425, y: 875 },
  refresh:    { x: 93, y: 96 },
};

// ============ Helpers ============
async function ss(Page, name) {
  try {
    await Page.captureScreenshot({ saveToFile: path.join(SS, name + '.png') });
    console.log('[SS]', name);
  } catch (e) { console.log('[SS-ERR]', e.message); }
}

async function click(Input, x, y, label) {
  await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await new Promise(r => setTimeout(r, 100));
  await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  if (label) console.log('[CLICK]', label, `@(${x},${y})`);
  await new Promise(r => setTimeout(r, 2000));
}

function js(Runtime, expr) {
  return Runtime.evaluate({ expression: expr, returnByValue: true })
    .then(r => r?.result?.value);
}

async function findAndClick(Runtime, Input, texts, desc) {
  const r = await js(Runtime, `(() => {
    const bs = Array.from(document.querySelectorAll('button:not([disabled])'));
    const targets = ${JSON.stringify(texts)};
    for (const t of targets) { const b = bs.find(b => b.textContent.trim().includes(t)); if (b) { b.click(); return t; } }
    return 'not found:' + bs.map(b => b.textContent.trim().slice(0, 25)).join(',');
  })()`);
  console.log(`[CLICK ${desc}]`, r || '(none)');
  return r;
}

// Poll until condition is true or timeout
async function poll(Runtime, conditionFn, label, maxMs = 30000, intervalMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const result = await conditionFn();
    if (result) return result;
    console.log(`[POLL ${label}] waiting... (${Math.round((Date.now()-start)/1000)}s)`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  console.log(`[POLL ${label}] TIMEOUT after ${maxMs}ms`);
  return false;
}

// HTTP API helper for second player
function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': PLAYER2.address,
      }
    };
    if (body) opts.headers['x-private-key'] = PLAYER2.privateKey;

    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ============ Main ============
async function run() {
  console.log('Connecting to CDP...');
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Input } = client;

  await Page.enable();
  await Runtime.enable();
  await Input.dispatchMouseEvent({ type: 'mousePressed', x: 0, y: 0 });

  // Handle JS alert dialogs automatically (Landing.js shows alert if not authorized)
  Page.javascriptDialogOpening(({ message }) => {
    console.log('[ALERT DISMISSED]', String(message || '').substring(0, 80));
    Page.handleJavaScriptDialog({ accept: true });
  });

  // Error capture + log capture (to see socket/join messages)
  await js(Runtime, `
    window.__errs=[]; window.__warns=[]; window.__logs=[];
    const oe=console.error,ow=console.warn,ol=console.log;
    console.error=(...a)=>{__errs.push(a.join(' '));oe.apply(console,a)};
    console.warn=(...a)=>{__warns.push(a.join(' '));ow.apply(console,a)};
    console.log=(...a)=>{__logs.push(a.join(' '));ol.apply(console,a)};
  `);

  // ========== STEP 1: Navigate & Wait for Socket ==========
  console.log('\n=== STEP 1: Navigate to testnet ===');
  await Page.navigate({ url: TARGET_URL });
  await Promise.race([Page.loadEventFired(), new Promise(r => setTimeout(r, 15000))]);
  await new Promise(r => setTimeout(r, 8000));

  let errs = await js(Runtime, '__errs.length');
  let pageText = await js(Runtime, 'document.body.innerText.substring(0,400)');
  console.log('[ERRS]:', errs);
  console.log('[PAGE]:', pageText.substring(0, 200));
  await ss(Page, '01-page');

  // ========== STEP 2: Disconnect Old Wallet ==========
  if (pageText && pageText.includes('Disconnect')) {
    console.log('\n=== STEP 2: Disconnect old wallet ===');
    await click(Input, P.disconnect1.x, P.disconnect1.y, 'disconnect1');
    await click(Input, P.disconnect2.x, P.disconnect2.y, 'disconnect2');
    await new Promise(r => setTimeout(r, 4000));
    pageText = await js(Runtime, 'document.body.innerText.substring(0,200)');
    await ss(Page, '02-disconnect');
  }

  // ========== STEP 3: Switch to 0G/EVM Mode ==========
  console.log('\n=== STEP 3: Switch to 0G/EVM mode ===');
  await click(Input, P.btn0g.x, P.btn0g.y, '0G-button');
  await new Promise(r => setTimeout(r, 5000));

  // ========== STEP 4: Select MetaMask ==========
  console.log('\n=== STEP 4: Select MetaMask wallet ===');
  await click(Input, P.metaMask.x, P.metaMask.y, 'MetaMask');
  await new Promise(r => setTimeout(r, 4000));
  await ss(Page, '04-metamask');

  // ========== STEP 5: Connect Wallet ==========
  console.log('\n=== STEP 5: Connect wallet via MetaMask ===');
  await click(Input, P.connect.x, P.connect.y, 'Connect');
  await new Promise(r => setTimeout(r, 8000)); // Wait for popup
  await click(Input, P.connect.x, P.connect.y, 'Connect-confirm'); // Confirm in popup
  await new Promise(r => setTimeout(r, 10000)); // Wait for connection

  pageText = await js(Runtime, 'document.body.innerText.substring(0,400)');
  console.log('[AFTER CONNECT]:', pageText.substring(0, 200));

  const balance = await js(Runtime, `
    (() => {
      const m = document.body.innerText.match(/Game Balance[:\\s]*([\\d.]+)/i);
      return m ? m[1] : ((document.body.innerText.match(/[\\d.]+\\s*0G/g)||[]).pop()||'unknown').replace('\\s*0G','');
    })()
  `);
  console.log('[BALANCE]:', balance);
  await ss(Page, '05-connected');

  // ========== STEP 6: Deposit (Optional - only if balance low) ==========
  console.log('\n=== STEP 6: Check/Do Deposit 0.01 0G ===');
  const balNum = parseFloat(balance) || 0;
  if (balNum < 0.05) {
    console.log('Balance low, attempting deposit...');
    await findAndClick(Runtime, Input, ['Deposit'], 'Deposit');
    await new Promise(r => setTimeout(r, 3000));
    const inputSet = await js(Runtime, `
      (() => {
        const i=document.querySelector('input[type="number"],input[type="text"]');
        if(i){i.value='0.01';i.dispatchEvent(new Event('input',{bubbles:true}));return'set:'+i.value;}
        return'no input'
      })()
    `);
    console.log('[DEPOSIT INPUT]', inputSet);

    // Try all possible confirm buttons
    const confirmResult = await findAndClick(Runtime, Input,
      ['Confirm', '确认', 'Submit', 'OK', 'Approve'], 'Confirm-deposit');
    console.log('[CONFIRM RESULT]', confirmResult);

    // Wait for signature with periodic MetaMask clicks
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      await click(Input, P.connect.x, P.connect.y, null);
    }
    await ss(Page, '06-post-deposit');
  } else {
    console.log('Balance sufficient (' + balNum + '), skipping deposit');
    await ss(Page, '06-skip-deposit');
  }

  // ========== STEP 7: Authorize Server (MUST DO BEFORE Enter Game!) ==========
  console.log('\n=== STEP 7: Authorize Server (required before Enter Game) ===');

  // Check current auth state
  const authStateBefore = await js(Runtime, `
    (() => {
      const t = document.body.innerText;
      return t.includes('Authorize Server') ? 'need-auth' :
             t.includes('Revoke') ? 'already-auth' : 'unknown:' + t.substring(0,50);
    })()
  `);
  console.log('[AUTH STATE]', authStateBefore);

  if (authStateBefore === 'need-auth') {
    await findAndClick(Runtime, Input, ['Authorize Server', 'Authorize'], 'Authorize-btn');
    await new Promise(r => setTimeout(r, 5000));

    // Click sign on MetaMask popup
    await click(Input, P.connect.x, P.connect.y, 'MetaMask-sign-authorize');
    await new Promise(r => setTimeout(r, 10000));

    // Verify auth completed
    const authAfter = await poll(Runtime, async () => {
      const t = await js(Runtime, 'document.body.innerText') || '';
      return t.includes('Revoke') || t.includes('Authorized');
    }, 'AuthConfirm', 20000, 3000);

    console.log('[AUTH AFTER]', authAfter ? 'AUTHORIZED!' : 'still pending...');
    await ss(Page, '07-authorized');

    // CRITICAL: Wait for React state (delegateAuthorized) to propagate
    console.log('[WAIT] For delegateAuthorized React state to update...');
    await new Promise(r => setTimeout(r, 5000));
  } else {
    console.log('[AUTH] Already authorized, skipping');
    await ss(Page, '07-already-auth');
  }

  // ========== STEP 8: Enter Game Room ==========
  console.log('\n=== STEP 8: Enter Game Room ===');

  // First verify we can see the Enter button
  const btnCheck = await js(Runtime, `
    (() => {
      const bs = Array.from(document.querySelectorAll('button:not([disabled])'));
      return bs.map(b => b.textContent.trim()).filter(t =>
        t.includes('Enter') || t.includes('Play') || t.includes('Join')
      ).join(',');
    })()
  `);
  console.log('[AVAILABLE BTNS]', btnCheck || '(none)');

  const enterResult = await findAndClick(Runtime, Input,
    ['Enter', '进入', 'Join', 'Play'], 'EnterGame');
  console.log('[ENTER]:', enterResult);

  // Wait for alert to be dismissed (if any) + navigation
  await new Promise(r => setTimeout(r, 3000));

  // Navigate should happen automatically; wait for /play URL (longer timeout)
  const atPlay = await poll(Runtime, async () => {
    const u = await js(Runtime, 'window.location.href');
    return u && u.includes('/play');
  }, 'NavigateToPlay', 25000, 2000);

  if (!atPlay) {
    console.log('[RETRY] Still on home - trying Enter again...');
    // Alert might have blocked first attempt, try again
    await findAndClick(Runtime, Input,
      ['Enter', '进入', 'Join', 'Play'], 'EnterGame-retry');
    await new Promise(r => setTimeout(r, 5000));

    const atPlay2 = await poll(Runtime, async () => {
      const u = await js(Runtime, 'window.location.href');
      return u && u.includes('/play');
    }, 'NavigateToPlay2', 20000, 2000);
    console.log('[AT PLAY PAGE (retry)]:', atPlay2 ? 'YES' : 'NO');
  }

  await new Promise(r => setTimeout(r, 5000));
  await ss(Page, '08-entered-game');

  // ========== STEP 8.5: Join Second Player via API ==========
  console.log('\n=== STEP 8.5: Add Player 2 via API (needed for hand to start) ===');
  let p2Joined = false;
  for (let p2try = 0; p2try < 3; p2try++) {
    try {
      await new Promise(r => setTimeout(r, 3000));
      const regRes = await apiRequest('/api/auth/register', 'POST', {
        address: PLAYER2.address,
        network: 'tron'
      });
      console.log(`[P2 REG attempt ${p2try+1}]:`, regRes.status);

      const joinRes = await apiRequest('/api/table/join', 'POST', {
        tableId: 1,
        buyInAmount: '100000000'
      });
      console.log(`[P2 JOIN attempt ${p2try+1}]:`, joinRes.status);
      if (joinRes.status === 200 || joinRes.status === 201) { p2Joined = true; break; }
    } catch (e) {
      console.log(`[P2 ERR attempt ${p2try+1}]:`, e.message.substring(0, 60));
    }
  }
  if (!p2Joined) console.log('[P2] API join failed, will rely on manual socket emit');

  // ========== STEP 8.7: Manual joinTable for Player 1 ==========
  // React Context may not have propagated walletAddress. Manually emit join.
  console.log('\n=== STEP 8.7: Manual joinTable via socket ===');
  const manualJoinResult = await js(Runtime, `
    (() => {
      try {
        const sock = window.socket;
        if (!sock || !sock.connected) return 'no socket';
        sock.emit('CS_JOIN_TABLE_BLOCKCHAIN', { tableId: 1, buyInAmount: 100000000 });
        return 'emitted CS_JOIN_TABLE_BLOCKCHAIN';
      } catch(e) { return 'err:' + e.message; }
    })()
  `);
  console.log('[MANUAL JOIN]', manualJoinResult);

  // Wait for server response + table state
  await new Promise(r => setTimeout(r, 10000));

  // ========== STEP 9: Play Poker Hand (Fold/Check/Call/Raise) ==========
  console.log('\n=== STEP 9: Play Poker Hand ===');

  // First: detailed diagnostics
  const diagUrl = (await js(Runtime, 'window.location.href')) || '';
  const diagTitle = await js(Runtime, 'document.title') || '';
  const diagRootLen = await js(Runtime, `
    (() => { const r = document.getElementById('root'); return r ? r.innerHTML.length : 0; })()
  `);
  const diagBodyHTML = (await js(Runtime, 'document.body.innerHTML.substring(0,500)')) || '';

  // Check socket state
  const diagSocket = await js(Runtime, `
    (() => {
      try {
        // Try to get socket from React context or window
        const ws = window.socket || window.io;
        if (!ws) return 'no socket obj';
        return 'connected=' + ws.connected + ' id=' + (ws.id || '?');
      } catch(e) { return 'err:' + e.message; }
    })()
  `);

  console.log('[DIAG] url=', diagUrl);
  console.log('[DIAG] title=', diagTitle);
  console.log('[DIAG] rootHTML len=', diagRootLen);
  console.log('[DIAG] bodyHTML=', diagBodyHTML.substring(0, 300));
  console.log('[DIAG] socket=', diagSocket);

  // Check walletAddress in React context / DOM
  const diagWallet = await js(Runtime, `
    (() => {
      // Try to find wallet address from page text
      const t = document.body.innerText;
      const m = t.match(/0x[a-fA-F0-9]{8,}/);
      if (m) return 'page:' + m[0];
      // Try from any element with wallet/address class
      const el = document.querySelector('[class*="wallet"], [class*="address"]');
      if (el) return 'dom:' + el.textContent.trim().substring(0, 20);
      return 'not found';
    })()
  `);

  // Get recent console logs
  const recentLogs = await js(Runtime, `
    (() => {
      if (!window.__logs || !__logs.length) return 'no logs';
      return __logs.slice(-15).join(' | ');
    })()
  `);

  console.log('[DIAG] wallet=', diagWallet);
  console.log('[DIAG] recent logs:', recentLogs ? String(recentLogs).substring(0, 300) : '(none)');

  let roundNum = 0;
  const MAX_ROUNDS = 15;

  while (roundNum < MAX_ROUNDS) {
    roundNum++;
    await new Promise(r => setTimeout(r, 3000));

    // Get current page state
    const curUrl = (await js(Runtime, 'window.location.href')) || '';
    const curText = (await js(Runtime, 'document.body.innerText.substring(0,500)')) || '';

    // Check if we're still on play page
    if (!curUrl.includes('/play')) {
      console.log(`[R${roundNum}] Not on /play page anymore:`, curUrl);
      break;
    }

    // Try to find and click action buttons
    const action = await js(Runtime, `(() => {
      const bs = Array.from(document.querySelectorAll('button:not([disabled])'));
      const ts = bs.map(b => b.textContent.trim());
      // Priority order: Fold > Check > Call > Raise > All In > Leave
      for (const a of ['Fold','Check','Call','Raise','All In']) {
        if (ts.includes(a)) {
          bs.find(b => b.textContent.trim() === a).click();
          return { action: a, allBtns: ts.slice(0, 10) };
        }
      }
      if (ts.includes('Leave')) {
        return { action: 'Leave', allBtns: ts };
      }
      return { action: 'none', allBtns: ts.slice(0, 8) };
    })())`);

    const actStr = action && typeof action === 'object' ? JSON.stringify(action) : String(action);
    console.log(`[R${roundNum}]`, actStr);

    if (!action || action.action === 'none') {
      // No action buttons yet - check why
      const hasTable = curText.includes('pot') || curText.includes('Pot') ||
                       curText.includes('Seat') || curText.includes('FLOP') ||
                       curText.includes('TURN') || curText.includes('RIVER');
      const hasCards = curText.includes('♠') || curText.includes('♥') ||
                       curText.includes('♦') || curText.indexOf('♣') !== -1;

      console.log(`[R${roundNum} DEBUG] hasTable=${hasTable}, hasCards=${hasCards}`);
      console.log(`[R${roundNum} TEXT]:`, curText.substring(0, 200));

      if (!hasTable && !hasCards) {
        // Still waiting for table/hand - keep trying but don't loop forever
        if (roundNum > 6) {
          console.log('[SKIP] No game state after multiple attempts');
          break;
        }
        continue;
      } else {
        // Table visible but no turn - might be opponent's turn
        console.log('[WAIT] Opponent\'s turn or between hands...');
        continue;
      }
    }

    if (action.action === 'Leave') {
      console.log('[LEFT GAME]');
      break;
    }

    // Action was clicked! Wait for response
    await new Promise(r => setTimeout(r, 5000));
    await ss(Page, `09-rnd${roundNum}-${action.action}`);

    // Handle potential MetaMask popups during blockchain actions
    if (action.action === 'Raise' || action.action === 'All In') {
      await click(Input, P.connect.x, P.connect.y, null);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // ========== Summary ==========
  await ss(Page, '10-final');
  const finalErrsRaw = await js(Runtime, 'JSON.stringify(__errs || [])') || '[]';
  let errList = [];
  try { errList = JSON.parse(finalErrsRaw); } catch(e) {}

  const finalBalance = await js(Runtime, `
    (() => {
      const m = document.body.innerText.match(/Game Balance[:\\s]*([\\d.]+)/i);
      return m ? m[1] : '?';
    })()
  `);

  console.log('\n========== E2E TEST SUMMARY ==========');
  console.log('502/CORS Fixed:', !errList.some(e => e.includes('502')) && !errList.some(e => e.includes('CORS')));
  console.log('Total JS Errors:', errList.length);
  if (errList.length > 0) console.log('Errors:', errList.slice(0, 3));
  console.log('Final Balance:', finalBalance);
  console.log('Rounds Played:', roundNum - 1);
  console.log('Screenshots saved to:', SS);
  console.log('=====================================');

  client.close();
}

run().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
