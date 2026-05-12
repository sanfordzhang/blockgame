const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, Network, Runtime, DOM } = client;
  await Page.enable();
  await Network.enable();

  // Clear all caches and navigate fresh
  await Runtime.evaluate({ expression: 'caches.keys().then(k => k.forEach(n => caches.delete(n)))' });
  await Network.clearBrowserCache();
  
  const url = 'http://43.163.114.175:3001/';
  console.log(`=== Navigating to ${url} ===`);
  
  let requests = [];
  let dclTime = null;
  let loadTime = null;

  Network.requestWillBeSent((params) => {
    requests.push(params);
    const u = params.request.url;
    if (u.includes('player') || u.includes('dealer') || u.includes('background') || u.includes('table.webp') || u.includes('card_back')) {
      const t = Date.now() - startTime;
      console.log(`T+${t}ms [GAME-ASSET] ${u.split('/').pop()}`);
    }
  });

  Network.responseReceived((params) => {
    if (!dclTime && params.type === 'Document') {
      dclTime = Date.now();
      console.log(`T+${Date.now()-startTime}ms DCL (document)`);
    }
  });

  Page.loadEventFired(() => {
    loadTime = Date.now();
    console.log(`T+${Date.now()-startTime}ms Load Event`);
  });

  const startTime = Date.now();
  await Page.navigate({ url });

  // Wait for initial render + idle time for prefetch to start
  console.log('Waiting for page render...');
  await new Promise(r => setTimeout(r, 2000));
  
  // Screenshot at T+2s - should show full Landing content
  await Page.captureScreenshot({ format: 'png', saveToFile: '/tmp/pf-dcl.png' });
  console.log('T+2000ms: Screenshot saved (Landing should be fully visible)');

  // Wait until prefetch window (4s delay from Landing useEffect)
  console.log('Waiting for prefetch trigger (4s total from mount)...');
  await new Promise(r => setTimeout(r, 3000)); // total ~5s
  
  // Check if prefetch has started by looking at network activity
  const gameRequests = requests.filter(r => 
    r.request.url.includes('.chunk') && !r.request.url.includes('main.') && !r.request.url.includes('runtime')
  );
  console.log(`T+5000ms: Non-main chunk requests so far: ${gameRequests.length}`);
  gameRequests.forEach(r => {
    console.log(`  chunk: ${r.request.url.split('/').pop()}`);
  });

  // Screenshot after prefetch starts
  await Page.captureScreenshot({ format: 'png', saveToFile: '/tmp/pf-prefetch.png' });
  console.log('T+5000ms: Screenshot saved (prefetch may be active)');

  // Wait longer for prefetch to complete
  console.log('Waiting for prefetch completion...');
  await new Promise(r => setTimeout(r, 8000));
  
  const allGameChunks = requests.filter(r =>
    r.request.url.includes('.chunk') && !r.request.url.includes('main.') && !r.request.url.includes('runtime')
  );
  console.log(`T+13000ms: Total lazy chunks requested: ${allGameChunks.length}`);
  
  const gameAssets = requests.filter(r => {
    const u = r.request.url;
    return (u.includes('player') || u.includes('dealer') || u.includes('background') || 
            u.includes('table.webp') || u.includes('card_back')) && u.includes('.png|.webp|jpg'.split('|'));
  });
  
  await Page.captureScreenshot({ format: 'png', saveToFile: '/tmp/pf-done.png' });
  console.log(`T+13000ms: Final screenshot saved`);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total requests: ${requests.length}`);
  console.log(`DCL: ${dclTime ? dclTime-startTime : '?'}ms`);
  console.log(`Load: ${loadTime ? loadTime-startTime : '?'}ms`);
  console.log(`Lazy chunks loaded: ${allGameChunks.length}`);

  // Check console logs for preload messages
  const logs = [];
  Runtime.consoleAPICalled((msg) => {
    if (msg.args[0]) {
      logs.push(`${msg.type}: ${msg.args[0].value || JSON.stringify(msg.args[0])}`);
    }
  });
  console.log('\nConsole messages:');
  logs.forEach(l => console.log('  ', l));

  await client.close();
})().catch(e => { console.error(e.message); process.exit(1); });
