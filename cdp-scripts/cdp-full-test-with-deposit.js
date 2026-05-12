const WebSocket = require('ws');
const http = require('http');
const { execSync } = require('child_process');

async function run() {
  const targets = await new Promise((res, rej) => {
    http.get('http://localhost:9222/json', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const tab = targets.find(t => t.url && t.url.includes('192.168.10.46:3000'));
  if (!tab) { console.log('No game tab found'); return; }

  console.log('Found tab:', tab.url);
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();

  function send(method, params) {
    return new Promise(resolve => {
      const reqId = msgId++;
      pending.set(reqId, resolve);
      ws.send(JSON.stringify({ id: reqId, method, params: params || {} }));
    });
  }

  async function eval_(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result && r.result.result && r.result.result.value;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  ws.on('message', d => {
    const m = JSON.parse(d);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });

  await new Promise(resolve => ws.on('open', resolve));

  // Check balance
  const balance = await eval_("document.querySelector('.balance-display')?.textContent || 'not found'");
  console.log('Current balance:', balance);

  if (balance.includes('0') || balance.includes('Deposit Required')) {
    console.log('\n=== Step 0: Deposit 100 TRX ===');
    const depositResult = await eval_(`
      (function() {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Deposit'));
        if (btn) { btn.click(); return 'clicked'; }
        return 'not found';
      })()
    `);
    console.log('Deposit button:', depositResult);

    console.log('⏳ Waiting 3s for deposit modal...');
    await sleep(3000);

    // Enter 100 in amount field
    await eval_("document.querySelector('input[type=\"number\"]').value = '100'");
    console.log('✅ Entered 100 TRX');

    // Click Confirm
    const confirmResult = await eval_(`
      (function() {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm'));
        if (btn) { btn.click(); return 'clicked'; }
        return 'not found';
      })()
    `);
    console.log('Confirm button:', confirmResult);

    console.log('⏳ Waiting 10s for TronLink sign + deposit to complete...');
    console.log('👉 Please click Sign in TronLink popup');
    await sleep(10000);

    const newBalance = await eval_("document.querySelector('.balance-display')?.textContent || 'not found'");
    console.log('New balance:', newBalance);
  }

  // Step 1: Click Enter Game
  console.log('\n=== Step 1: Click Enter Game ===');
  const enterResult = await eval_(`
    (function() {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enter Game'));
      if (btn) { btn.click(); return 'clicked'; }
      return 'not found';
    })()
  `);
  console.log('Enter Game:', enterResult);

  // Step 2: Wait for game load
  console.log('\n=== Step 2: Waiting 15s for game load ===');
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const url = await eval_('window.location.href');
    if (i % 3 === 0) console.log(`[${i}s] URL: ${url}`);
    if (url && url.includes('/play')) {
      console.log('✅ Navigated to /play');
      break;
    }
  }

  // Step 3: Wait for player info on table
  console.log('\n=== Step 3: Waiting for player info on table ===');
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const seatName = await eval_("Array.from(document.querySelectorAll('.seat-name')).map(e=>e.textContent.trim()).filter(t=>t && t!=='Empty Seat').join('|')");
    if (i % 5 === 0 || seatName) console.log(`[${i}s] seatName: ${seatName}`);
    if (seatName) {
      console.log('✅ Player info visible:', seatName);
      break;
    }
  }

  // Step 4: Click Leave
  console.log('\n=== Step 4: Click Leave ===');
  const leaveResult = await eval_(`
    (function() {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Leave');
      if (btn) { btn.click(); return 'clicked'; }
      return 'not found';
    })()
  `);
  console.log('Leave button:', leaveResult);

  // Step 5: Wait for navigation back to home
  console.log('\n=== Step 5: Waiting for navigation home ===');
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const url = await eval_('window.location.href');
    if (i % 3 === 0) console.log(`[${i}s] URL: ${url}`);
    if (url && !url.includes('/play')) {
      console.log('✅ Back on home page');
      break;
    }
  }

  // Step 6: Check server log
  console.log('\n=== Server Log (last 50 relevant lines) ===');
  const log = execSync('tail -150 /tmp/server.log').toString();
  const lines = log.split('\n').filter(l => l.trim() && !l.includes('Polled'));
  lines.slice(-50).forEach(l => console.log(l));

  // Check for locked=0
  const hasLockedZero = lines.some(l => l.includes('locked=0'));
  const hasLeaveTableFor = lines.some(l => l.includes('leaveTableFor'));
  const hasFinalStack = lines.filter(l => l.includes('finalStack')).slice(-1)[0];

  console.log('\n=== Test Results ===');
  console.log('✅ leaveTableFor called:', hasLeaveTableFor);
  console.log('✅ locked=0 in log:', hasLockedZero);
  console.log('📊 finalStack:', hasFinalStack || 'not found');

  ws.close();
}

run().catch(console.error);
