const WebSocket = require('ws');
const http = require('http');

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

  // Click 刷新余额
  console.log('Clicking 刷新余额...');
  await eval_("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('刷新余额'))?.click()");
  await sleep(3000);

  const btns = await eval_("Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).filter(t=>t).join('|')");
  console.log('Buttons after refresh:', btns);

  ws.close();
}

run().catch(console.error);
