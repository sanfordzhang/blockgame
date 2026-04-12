const WebSocket = require('ws');
const http = require('http');

async function run() {
  const pages = await new Promise((r, e) => {
    http.get('http://localhost:9222/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
    }).on('error', e);
  });

  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let id = 1;
  const logs = [];
  const send = (m, p = {}) => new Promise(r => {
    const _id = id++;
    const h = data => { const msg = JSON.parse(data); if (msg.id === _id) { ws.off('message', h); r(msg.result); } };
    ws.on('message', h);
    ws.send(JSON.stringify({ id: _id, method: m, params: p }));
  });

  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const t = msg.params.args.map(a => a.value || '').join(' ');
      if (t.includes('LOBBY') || t.includes('BALANCE') || t.includes('Socket connected') || t.includes('chipsAmount'))
        logs.push(`[${msg.params.type}] ${t}`);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://43.163.114.175/' });
  await send('Page.reload', { ignoreCache: true });
  await new Promise(r => { const h = d => { if (JSON.parse(d).method === 'Page.loadEventFired') { ws.off('message', h); r(); } }; ws.on('message', h); setTimeout(r, 10000); });
  await new Promise(r => setTimeout(r, 5000));

  const status = await send('Runtime.evaluate', {
    expression: `JSON.stringify({ chipsAmount: window.__CHIPS || 'check store', socketConnected: window.socket?.connected })`,
    returnByValue: true
  });

  // Check chipsAmount via React store indirectly
  const chips = await send('Runtime.evaluate', {
    expression: `document.querySelector('[name="chipsAmount"]')?.value || 'not found'`,
    returnByValue: true
  });

  console.log('ChipsAmount input value:', chips.result?.value);
  console.log('\nRelevant console logs:');
  logs.forEach(l => console.log(l));

  ws.close();
}
run().catch(console.error);
