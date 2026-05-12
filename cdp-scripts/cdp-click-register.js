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
      consoleMessages.push(`[${msg.params.type}] ${text}`);
    }
  });

  await send('Runtime.enable');
  await send('Page.enable');

  console.log('=== Navigate and hard reload ===');
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

  await new Promise(r => setTimeout(r, 3000));
  console.log('Page loaded');

  // Find and click Register button
  console.log('\n=== Clicking "Register on Blockchain" button ===');
  const clickResult = await send('Runtime.evaluate', {
    expression: `(function() {
      const buttons = Array.from(document.querySelectorAll('button'));
      const registerBtn = buttons.find(b => b.textContent.includes('Register on Blockchain'));
      if (registerBtn) {
        registerBtn.click();
        return 'Clicked Register button';
      }
      return 'Register button not found. Available: ' + buttons.map(b => b.textContent.trim()).join(', ');
    })()`,
    returnByValue: true
  });
  console.log(clickResult.result?.value);

  await new Promise(r => setTimeout(r, 2000));

  // Check for error message
  const errorCheck = await send('Runtime.evaluate', {
    expression: `document.body.innerText.includes('TronLink') ? 'TronLink error shown' : 'No TronLink error'`,
    returnByValue: true
  });
  console.log('\n=== Error Display ===');
  console.log(errorCheck.result?.value);

  // Screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync('/tmp/register-click.png', Buffer.from(shot.data, 'base64'));
  console.log('\nScreenshot: /tmp/register-click.png');

  console.log('\n=== Console Messages (last 10) ===');
  consoleMessages.slice(-10).forEach(m => console.log(m));

  ws.close();
}

cdpRun().catch(console.error);
