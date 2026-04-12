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
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = msgId++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === id) { ws.off('message', handler); resolve(msg.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  console.log('=== Navigating to http://43.163.114.175/ ===');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://43.163.114.175/' });

  // Wait for load
  await new Promise((resolve) => {
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Page.loadEventFired') { ws.off('message', handler); resolve(); }
    };
    ws.on('message', handler);
    setTimeout(resolve, 8000);
  });

  console.log('Page loaded, waiting for TronLink...');
  await new Promise(r => setTimeout(r, 3000));

  // TronLink check
  const tron = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      hasTronLink: !!window.tronLink,
      hasTronWeb: !!window.tronWeb,
      ready: window.tronLink?.ready,
      address: window.tronLink?.tronWeb?.defaultAddress?.base58 || window.tronWeb?.defaultAddress?.base58 || null,
      fullHost: window.tronLink?.tronWeb?.fullNode?.host || window.tronWeb?.fullNode?.host || null
    })`,
    returnByValue: true
  });
  console.log('\n=== TronLink Status ===');
  const tronData = JSON.parse(tron.result?.value || '{}');
  console.log(JSON.stringify(tronData, null, 2));

  // Check bundled env vars
  const env = await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      NODE_ENV: process?.env?.NODE_ENV,
      SERVER_URI: process?.env?.REACT_APP_SERVER_URI,
      MAINNET_CONTRACT: process?.env?.REACT_APP_MAINNET_CONTRACT_ADDRESS,
      TESTNET_CONTRACT: process?.env?.REACT_APP_TESTNET_CONTRACT_ADDRESS,
      NETWORK: process?.env?.REACT_APP_NETWORK
    })`,
    returnByValue: true
  });
  console.log('\n=== Bundled Env Vars ===');
  console.log(env.result?.value);

  // Screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png', quality: 80 });
  require('fs').writeFileSync('/tmp/page-state.png', Buffer.from(shot.data, 'base64'));
  console.log('\nScreenshot saved to /tmp/page-state.png');

  ws.close();
}

cdpRun().catch(console.error);
