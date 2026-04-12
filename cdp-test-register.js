const WebSocket = require('ws');
const http = require('http');

async function cdpRun() {
  const pages = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const page = pages[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let msgId = 1;
  const consoleMessages = [];

  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) { ws.off('message', handler); resolve(msg.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
      if (!text.includes('AMM Context')) // suppress AMM noise
        consoleMessages.push(`[${msg.params.type}] ${text}`);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');

  // Hard reload to bypass cache
  console.log('=== Hard reload (bypass cache) ===');
  await send('Page.navigate', { url: 'http://43.163.114.175/' });
  await send('Page.reload', { ignoreCache: true });

  await new Promise((resolve) => {
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Page.loadEventFired') { ws.off('message', handler); resolve(); }
    };
    ws.on('message', handler);
    setTimeout(resolve, 10000);
  });

  await new Promise(r => setTimeout(r, 4000));

  // Check which JS files loaded
  const scripts = await send('Runtime.evaluate', {
    expression: `JSON.stringify(Array.from(document.querySelectorAll('script[src]')).map(s=>s.src.split('/').pop()))`,
    returnByValue: true
  });
  console.log('\n=== Loaded JS chunks ===');
  console.log(scripts.result?.value);

  // Check socket state
  const status = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      hasSocket: !!window.socket,
      connected: window.socket?.connected,
      socketId: window.socket?.id,
      transport: window.socket?.io?.engine?.transport?.name
    })`,
    returnByValue: true
  });
  console.log('\n=== Socket Status ===');
  console.log(status.result?.value);

  // Screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('/tmp/landing-reload.png', Buffer.from(shot.data, 'base64'));
  console.log('\nScreenshot: /tmp/landing-reload.png');

  console.log('\n=== Console (non-AMM) ===');
  consoleMessages.forEach(m => console.log(m));

  ws.close();
}

cdpRun().catch(console.error);
