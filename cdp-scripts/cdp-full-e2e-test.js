/**
 * Full E2E Test: 0G Wallet Connect + Deposit + Game Play
 * Uses CDP + mouse coordinates from CODEBUDDY.md
 */
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

const TARGET = 'http://43.163.114.175:3001/';
const SS_DIR = '/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results';
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

// Mouse positions from CODEBUDDY.md
const POS = {
  disconnect_1: { x: 1464, y: 883 },
  disconnect_2: { x: 1362, y: 380 },
  btn_0g:      { x: 492, y: 758 },
  metaMask:   { x: 1208, y: 271 },
  connect:    { x: 1425, y: 875 },  // Also used for confirm
  refresh:    { x: 93, y: 96 },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickAt(ws, x, y) {
  await ws.send(JSON.stringify({
    id: Date.now(), method: 'Input.dispatchMouseEvent',
    params: { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }
  }));
  await sleep(80);
  await ws.send(JSON.stringify({
    id: Date.now(), method: 'Input.dispatchMouseEvent',
    params: { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }
  }));
}

async function screenshot(ws, name) {
  const data = await new Promise((resolve) => {
    const id = Date.now();
    const pending = new Map([[id, resolve]]);
    const handler = d => {
      const m = JSON.parse(d);
      if (m.id === id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', 
      params: { format: 'png' } }));
  });
  if (data.data) {
    fs.writeFileSync(`${SS_DIR}/${name}.png`, Buffer.from(data.data, 'base64'));
  }
  // Fallback: use CDP screenshot
  try {
    await ws.send(JSON.stringify({ id: Date.now(), method: 'Page.captureScreenshot',
      params: { format: 'png', saveToFile: `${SS_DIR}/${name}.png` } }));
  } catch(e) {}
  console.log(`[SS] ${name}.png`);
}

async function eval_(ws, expr) {
  const r = await new Promise(resolve => {
    const id = Date.now();
    const handler = d => { const m = JSON.parse(d); if (m.id === id) resolve(m); };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate',
      params: { expression: expr, returnByValue: true } }));
  });
  return r?.result?.result?.value;
}

async function getButtons(ws) {
  return await eval_(ws, `Array.from(document.querySelectorAll('button:not([disabled])')).map(b=>b.textContent.trim()).filter(t=>t)`) || [];
}

async function getText(ws) {
  return await eval_(ws, `(document.body.innerText || '').substring(0, 500)`);
}

async function run() {
  // Find tab
  const targets = await new Promise((res, rej) => {
    http.get('http://localhost:9222/json', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const tab = targets.find(t => t.url === TARGET || (t.type === 'page' && t.url.includes('43.163.114.175:3001')));
  if (!tab) { console.error('[FATAL] No tab for', TARGET); process.exit(1); }
  console.log('[TAB]', tab.id, tab.url);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  
  // Enable
  await new Promise((resolve) => {
    let c = 0; const handler = d => { if (++c >= 4) resolve(); };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Network.enable' }));
    ws.send(JSON.stringify({ id: 3, method: 'Page.enable' }));
  });

  // Error capture
  await eval_(ws, `
    window.__errs=[]; window.__warns=[];
    const oe=console.error,ow=console.warn;
    console.error=(...a)=>{window.__errs.push(a.join(' '));oe.apply(console,a)};
    console.warn=(...a)=>{window.__warns.push(a.join(' '));ow.apply(console,a)};
    true;
  `);

  // ========== STEP 1: Refresh & Verify Page Load ==========
  console.log('\n=== Step 1: Navigate to testnet page ===');
  await ws.send(JSON.stringify({ id: 10, method: 'Page.navigate', params: { url: TARGET } }));
  await new Promise((r) => {
    const h = d => { try { const m=JSON.parse(d); if(m.method==='Page.loadEventFired') r(); } catch{} };
    ws.on('message', h);
  });
  await sleep(5000);

  const errs = await eval_(ws, 'window.__errs') || [];
  const has502 = errs.some(e => e.includes('502'));
  const hasCors = errs.some(e => e.includes('CORS') || e.includes('Access-Control'));
  console.log(`[CHECK] 502=${has502}, CORS=${hasCors}, TotalErrors=${errs.length}`);
  if (errs.length > 0) errs.forEach((e,i) => console.error('  ERR:', e.substring(0,150)));
  await screenshot(ws, '01-page-loaded');

  // ========== STEP 2: Disconnect old wallet (if connected) ==========
  console.log('\n=== Step 2: Check/Disconnect existing wallet ===');
  const text1 = await getText(ws);
  console.log('[PAGE]', text1.substring(0, 200));

  if (text1.includes('Disconnect')) {
    console.log('[ACTION] Disconnecting old wallet...');
    await clickAt(ws, POS.disconnect_1.x, POS.disconnect_1.y);
    await sleep(1000);
    await clickAt(ws, POS.disconnect_2.x, POS.disconnect_2.y);
    await sleep(3000);
    await screenshot(ws, '02-after-disconnect');
  }

  // ========== STEP 3: Click 0G/EVM button ==========
  console.log('\n=== Step 3: Switch to 0G/EVM mode ===');
  await clickAt(ws, POS.btn_0g.x, POS.btn_0g.y);
  console.log('[CLICK] 0G/EVM button at', POS.btn_0g.x, POS.btn_0g.y);
  await sleep(4000);
  await screenshot(ws, '03-0g-mode');

  // ========== STEP 4: Select MetaMask in popup ==========
  console.log('\n=== Step 4: Select MetaMask wallet ===');
  await clickAt(ws, POS.metaMask.x, POS.metaMask.y);
  console.log('[CLICK] MetaMask at', POS.metaMask.x, POS.metaMask.y);
  await sleep(4000);
  await screenshot(ws, '04-metamask-selected');

  // ========== STEP 5: Click Connect ==========
  console.log('\n=== Step 5: Click Connect ===');
  await clickAt(ws, POS.connect.x, POS.connect.y);
  console.log('[CLICK] Connect at', POS.connect.x, POS.connect.y);
  await sleep(8000);  // Wait for MetaMask popup sign

  // Handle any additional confirm clicks
  await clickAt(ws, POS.connect.x, POS.connect.y);
  await sleep(8000);
  await screenshot(ws, '05-after-connect');

  // Check connection status
  const text2 = await getText(ws);
  console.log('[AFTER CONNECT]', text2.substring(0, 250));
  const balanceBefore = await eval_(ws, `
    (() => {
      const el = document.querySelector('.balance-display, .chip-balance, [class*="balance"]');
      return el ? el.textContent.trim() : (document.body.innerText.match(/Balance[:\\s]*([\\d.]+)/i)||[])[1]||'unknown';
    })()
  `);
  console.log('[BALANCE BEFORE DEPOSIT]:', balanceBefore);

  // ========== STEP 6: Deposit Flow ==========
  console.log('\n=== Step 6: Deposit TRX to game contract ===');

  // Click Deposit button
  const btns = await getButtons(ws);
  console.log('[BUTTONS]', btns.join(', '));
  
  const depClicked = await eval_(ws, `
    (() => {
      const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Deposit'));
      if(b && !b.disabled){ b.click(); return 'clicked'; }
      return b ? 'disabled':'not found';
    })()
  `);
  console.log('[DEPOSIT]', depClicked);
  await sleep(4000);
  await screenshot(ws, '06-deposit-modal');

  // Enter amount
  await eval_(ws, `
    (() => {
      const inp = document.querySelector('input[type="number"], input[type="text"]');
      if(inp){ inp.value='10'; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); return 'set'; }
      return 'no input';
    })()
  `);
  console.log('[DEPOSIT] Entered 10 TRX');

  // Click Confirm
  const confirmResult = await eval_(ws, `
    (() => {
      const bs = Array.from(document.querySelectorAll('button'));
      const b = bs.find(b=> b.textContent.includes('Confirm')||b.textContent.includes('确认')||b.textContent.includes('Approve'));
      if(b && !b.disabled){ b.click(); return 'clicked'; }
      return b?b.textContent.trim():'not found - buttons: '+bs.map(b=>b.textContent.trim().slice(0,15)).join(',');
    })()
  `);
  console.log('[CONFIRM]', confirmResult);
  await screenshot(ws, '07-deposit-confirm-clicked');

  // Wait for signature + blockchain confirmation
  console.log('[WAITING] Waiting 20s for TronLink sign + chain confirm...');
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    if (i % 5 === 0) {
      // Retry click connect/confirm for MetaMask popups
      await clickAt(ws, POS.connect.x, POS.connect.y);
    }
  }
  await screenshot(ws, '08-post-deposit-wait');

  const balanceAfter = await eval_(ws, `
    (() => {
      const el = document.querySelector('.balance-display, .chip-balance');
      return el ? el.textContent.trim() : 'unknown';
    })()
  `);
  console.log('[BALANCE AFTER DEPOSIT]:', balanceAfter);
  await screenshot(ws, '09-balance-after-deposit');

  // ========== STEP 7: Authorize Server (if needed) ==========
  console.log('\n=== Step 7: Authorize Server ===');
  const authBtns = await getButtons(ws);
  if (authBtns.some(b => b.includes('Authorize'))) {
    await eval_(ws, `
      (() => {
        const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Authorize'));
        if(b && !b.disabled) { b.click(); return 'clicked'; }
        return 'not needed';
      })()
    `);
    console.log('[AUTHORIZE] clicked');
    await sleep(6000);
    
    // Handle MetaMask sign popup
    await clickAt(ws, POS.connect.x, POS.connect.y);
    await sleep(8000);
    await screenshot(ws, '10-after-authorize');
  } else {
    console.log('[AUTHORIZE] No authorize button visible (may already be authorized)');
  }

  // ========== STEP 8: Enter Game ==========
  console.log('\n=== Step 8: Enter Game Room ===');
  const enterBtns = await getButtons(ws);
  console.log('[BUTTONS NOW]', enterBtns.join(', '));

  const enterResult = await eval_(ws, `
    (() => {
      const bs = Array.from(document.querySelectorAll('button:not([disabled])'));
      const b = bs.find(b => 
        b.textContent.includes('Enter') || b.textContent.includes('进入') ||
        b.textContent.includes('Join') || b.textContent.includes('Play')
      );
      if(b){ b.click(); return b.textContent.trim(); }
      return bs.map(b=>b.textContent.trim().slice(0,20)).join('|');
    })()
  `);
  console.log('[ENTER]', enterResult);
  await sleep(8000);
  await screenshot(ws, '11-game-room');

  const gameUrl = await eval_(ws, 'window.location.href');
  console.log('[URL]', gameUrl);
  const gameText = await getText(ws);
  console.log('[GAME PAGE]', gameText.substring(0, 250));

  // ========== STEP 9: Play a Hand ==========
  console.log('\n=== Step 9: Playing Poker Hand ===');

  for (let round = 1; round <= 5; round++) {
    const action = await eval_(ws, `
      (() => {
        const bs = Array.from(document.querySelectorAll('button:not([disabled])'));
        const ts = bs.map(b=>b.textContent.trim());
        const p = ['Fold','Check','Call','Raise','All In'];
        for (const a of p) { if (ts.includes(a)){ bs.find(b=>b.textContent.trim()===a).click(); return a; } }
        if (ts.includes('Leave')) { bs.find(b=>b.textContent.trim()==='Leave').click(); return 'Leave'; }
        return 'none:'+ts.slice(0,6).join(',');
      })()
    `);
    console.log(`[ROUND ${round}]`, action);
    
    if (action.startsWith('none:') && !action.includes('Leave')) break;
    if (action === 'Leave') { console.log('[INFO] Left table'); break; }
    
    await sleep(6000);
    await screenshot(ws, `12-round${round}-${action}`);

    // Re-check for MetaMask sign popups during game actions
    if (round % 2 === 0) {
      await clickAt(ws, POS.connect.x, POS.connect.y);
      await sleep(3000);
    }
  }

  // Final state
  await sleep(3000);
  const finalBtns = await getButtons(ws);
  const finalErrs = await eval_(ws, 'window.__errs.length') || 0;
  await screenshot(ws, '13-final-state');

  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log('[502 Fixed]:', !has502);
  console.log('[CORS Fixed]:', !hasCors);
  console.log('[JS Errors]:', finalErrs);
  console.log('[Final Buttons]:', finalBtns.slice(0, 10).join(', '));
  console.log('[Screenshots]: saved to', SS_DIR);
  console.log('\n[DONE]');
  ws.close();
}

run().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
