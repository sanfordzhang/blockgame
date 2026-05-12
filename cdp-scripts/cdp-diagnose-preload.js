const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, Network, Runtime } = client;
  await Page.enable();
  await Network.enable();
  await Runtime.enable();

  const url = 'http://43.163.114.175:3001/';
  
  // Capture ALL console logs
  const allLogs = [];
  Runtime.consoleAPICalled((msg) => {
    const text = (msg.args || []).map(a => a.value || a.description || '').join(' ');
    if (text && text.length < 500) {
      const ts = Date.now();
      allLogs.push(`T+${ts - startTime}ms [${msg.type}] ${text}`);
    }
  });

  // Track ALL network requests with timing
  const reqs = [];
  Network.requestWillBeSent((params) => {
    const t = Date.now() - startTime;
    reqs.push({ time: t, url: params.request.url, type: params.type });
  });

  // Also track responses for chunk files
  const chunks = [];
  Network.responseReceived((params) => {
    const u = params.response.url;
    if (u.includes('.chunk') || u.includes('.png') || u.includes('.webp')) {
      chunks.push({
        time: Date.now() - startTime,
        url: u.split('/').pop(),
        status: params.response.status
      });
    }
  });

  const startTime = Date.now();
  await Page.navigate({ url });

  // Wait long enough for prefetch to fire (4s delay + idle callback)
  console.log('=== Waiting 15s for preload activity ===\n');
  
  // Checkpoints at various intervals
  for (const [label, wait] of [['3s', 3000], ['6s', 6000], ['10s', 10000], ['15s', 15000]]) {
    await new Promise(r => setTimeout(r, wait));
    
    // Get console logs so far
    const result = await Runtime.evaluate({ 
      expression: 'JSON.stringify(window.__preloadLog || [])',
      returnByValue: true 
    });
    const preloadLog = result.result.value || [];
    
    console.log(`--- ${label} (${Date.now()-startTime}ms total) ---`);
    console.log(`Total requests: ${reqs.length}`);
    console.log(`Chunk/image requests: ${chunks.length}`);
    if (preloadLog.length > 0) {
      console.log('Preload log:', JSON.stringify(preloadLog));
    }
    
    // List any game-related requests
    const gameReqs = chunks.filter(c => !c.url.includes('main.') && !c.url.includes('runtime'));
    if (gameReqs.length > 0) {
      gameReqs.forEach(c => console.log(`  [${c.time}ms] ${c.url}`));
    }

    // Screenshot at each checkpoint
    try {
      await Page.captureScreenshot({ format: 'png', saveToFile: `/tmp/diag-${label.replace('s','')}.png` });
    } catch(e) {}
  }

  // Final: dump ALL console messages
  console.log('\n=== ALL CONSOLE LOGS ===');
  allLogs.forEach(l => console.log(l));

  // Try to manually call preloadGameAssets and see error
  console.log('\n=== Manual preload test ===');
  const manualTest = await Runtime.evaluate({
    expression: `
      (async () => {
        try {
          if (typeof window.preloadGameAssets === 'undefined') {
            return 'preloadGameAssets NOT found on window';
          }
          await window.preloadGameAssets();
          return 'preloadGameAssets called successfully';
        } catch(e) {
          return 'ERROR: ' + e.message;
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  }).catch(e => ({ result: { value: 'Runtime error: ' + e.message } }));
  console.log(manualTest.result ? manualTest.result.value : 'no result');

  // Check if the function exists as module export
  const fnCheck = await Runtime.evaluate({
    expression: `
      typeof window !== 'undefined' && Object.keys(window).filter(k => k.toLowerCase().includes('preload')).length > 0 
        ? Object.keys(window).filter(k => k.toLowerCase().includes('preload')).join(', ') 
        : 'no preload keys on window'
    `,
    returnByValue: true
  });
  console.log('Window keys:', fnCheck.result.value);

  await client.close();
})().catch(e => { console.error(e.message); process.exit(1); });
