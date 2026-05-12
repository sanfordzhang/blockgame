const WebSocket = require('ws');
const { execSync } = require('child_process');

const PAGE_ID = 'FB1A0501AADEEEA8187F4F1B553994D6';
const ws = new WebSocket(`ws://localhost:9222/devtools/page/${PAGE_ID}`);
let id = 1;
const pending = new Map();

function send(method, params) {
  return new Promise(resolve => {
    const reqId = id++;
    pending.set(reqId, resolve);
    ws.send(JSON.stringify({ id: reqId, method, params }));
  });
}
function eval_(expr) {
  return send('Runtime.evaluate', { expression: expr, returnByValue: true })
    .then(m => m.result?.result?.value);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

ws.on('message', d => {
  const m = JSON.parse(d);
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});

ws.on('open', async () => {
  // Step 1: Leave if on play page
  const url = await eval_('window.location.href');
  console.log('Current URL:', url);
  if (url.includes('/play')) {
    const leave = await eval_(`(function(){
      const btn = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Leave');
      if(btn){btn.click();return 'clicked';}
      return 'not found';
    })()`);
    console.log('Leave:', leave);
    await sleep(3000);
  }

  // Step 2: Wait for Enter Game
  console.log('Waiting for Enter Game button...');
  let entered = false;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const btns = await eval_(`Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).filter(t=>t).join('|')`);
    if (i % 5 === 0) console.log(`[${i}s] Buttons:`, btns);
    if (btns && btns.includes('Enter Game')) {
      const r = await eval_(`(function(){
        const btn = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Enter Game'));
        if(btn){btn.click();return 'clicked';}
        return 'not found';
      })()`);
      console.log('Enter Game:', r);
      entered = true;
      break;
    }
  }

  if (!entered) {
    console.log('Could not find Enter Game button');
    ws.close();
    return;
  }

  // Step 3: Monitor server log and DOM
  console.log('\nMonitoring for 20s...');
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const seatNames = await eval_(`Array.from(document.querySelectorAll('.seat-name')).map(e=>e.textContent.trim()).join('|')`);
    const emptySeat = await eval_(`document.querySelectorAll('.empty-seat').length`);
    const btns = await eval_(`Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).filter(t=>t).join('|')`);
    if (i % 5 === 0 || seatNames) {
      console.log(`[${i}s] emptySeat:${emptySeat} names:${seatNames} btns:${btns}`);
    }
    if (seatNames) {
      console.log('✅ Player info visible on table!');
      break;
    }
  }

  // Step 4: Show server log
  const log = execSync('tail -50 /tmp/server.log').toString();
  const lines = log.split('\n').filter(l => l.trim() && !l.includes('Polled'));
  console.log('\n=== Server Log ===');
  lines.forEach(l => console.log(l));

  ws.close();
});
