const CDP = require('chrome-remote-interface');
(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, Network, Runtime } = client;
  await Page.enable();
  await Network.enable();
  await Runtime.enable();

  // Capture console logs
  Runtime.consoleAPICalled((msg) => {
    const text = (msg.args || []).map(a => a.value || a.description || '').join(' ');
    if (text && text.length < 500) {
      console.log(`[LOG] ${text}`);
    }
  });

  // Track game asset requests specifically
  Network.requestWillBeSent((params) => {
    const u = params.request.url;
    const name = u.split('/').pop();
    
    // Log game-related resources
    if (/player[1-6]|dealer|background\.png|table\.webp|card_back|avatar|small_blind|big_blind|branding|circle/.test(name)) {
      console.log(`[ASSET] +${Date.now()-startTime}ms ${name} (${params.type})`);
    }
    
    // Also track lazy chunks (non-main, non-runtime)
    if (u.includes('.chunk.js') && !u.includes('main.') && !u.includes('runtime')) {
      console.log(`[CHUNK] +${Date.now()-startTime}ms ${name}`);
    }
  });

  const startTime = Date.now();
  
  // Clear cache
  await Runtime.evaluate({ expression: 'caches.keys().then(k=>k.forEach(n=>caches.delete(n))).catch(()=>{})' });
  await Network.clearBrowserCache();
  
  console.log('=== Navigating to http://43.163.114.175:3001/ ===');
  await Page.navigate({ url: 'http://43.163.114.175:3001/' });

  // Wait for initial render
  console.log('Waiting 5s (Landing should render by now)...');
  await new Promise(r => setTimeout(r, 5000));
  
  try { await Page.captureScreenshot({ format: 'png', saveToFile: '/tmp/pf2-5s.png' }); } catch(e) {}
  console.log('T+5s screenshot saved');

  // Wait for preload trigger (4s delay from Landing useEffect)
  console.log('Waiting another 5s (preload should trigger around T+4~9s)...');
  await new Promise(r => setTimeout(r, 5000));

  try { await Page.captureScreenshot({ format: 'png', saveToFile: '/tmp/pf2-10s.png' }); } catch(e) {}
  console.log('T+10s screenshot saved');

  // Wait more time for images to finish loading
  console.log('Waiting final 8s (for image downloads)...');
  await new Promise(r => setTimeout(r, 8000));

  try { await Page.captureScreenshot({ format: 'png', saveToFile: '/tmp/pf2-18s.png' }); } catch(e) {}
  console.log('T+18s final screenshot saved');
  console.log('\nDone! Check screenshots at /tmp/pf2-{5,10,18}s.png and [ASSET]/[CHUNK] logs above.');

  await client.close();
})().catch(e => { console.error(e.message); process.exit(1); });
