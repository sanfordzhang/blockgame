const puppeteer = require('puppeteer-core');
(async () => {
  const br = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: { width: 1440, height: 900 } });
  const page = (await br.pages())[0] || await br.newPage();
  const cdp = await page.createCDPSession();

  // Nuclear clear
  try { await cdp.send('Network.clearBrowserCache'); } catch(e){}  
  try { await cdp.send('Network.clearBrowserCookies'); } catch(e){}
  try { await cdp.send('Storage.clearDataForOrigin', { origin: 'https://testnet.vintagepoker.xyz/', storageTypes: 'all' }); } catch(e){}
  try { 
    const r = await cdp.send('ServiceWorker.getRegistrations'); 
    for(const sw of (r.registrations||[])) { await cdp.send('ServiceWorker.unregister',{scopeURL:sw.scopeURL}); }
  } catch(e){}

  console.log('[OK] Cache nuked');
  await cdp.send('Network.enable');

  const reqs = [];
  cdp.on('Network.requestWillBeSent', e => {
    const u = e.request.url;
    if(u.startsWith('data:') || u.includes('favicon') || u.startsWith('chrome-extension://')) return;
    reqs.push({ url: u, type: e.type||'', time: e.timestamp });
  });

  console.log('[NAV] Navigate...');
  const t0 = Date.now();
  await page.goto('https://testnet.vintagepoker.xyz/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(()=>{});
  console.log(`[DCL] ${Date.now()-t0}ms`);
  await page.screenshot({ path:'/tmp/d-dcl.png' });

  await new Promise(r=>setTimeout(r,3000));
  console.log(`[3s]  ${Date.now()-t0}ms`);
  await page.screenshot({ path:'/tmp/d-3s.png' });

  try{ await page.waitForNavigation({waitUntil:'networkidle0',timeout:25000}); }catch(e){}
  console.log(`[IDLE] ${Date.now()-t0}ms`);
  await page.screenshot({ path:'/tmp/d-idle.png' });

  // Analyze
  const gamePat = /player\d|dealer|background\.png|table\.webp|card_back|small_blind|big_blind|gglab_green|avatar\.png|cards-svg/i;
  const games = reqs.filter(r => gamePat.test(r.url));
  const imgs = reqs.filter(r => ['Image','image'].includes(String(r.type)));

  console.log('\n===== RESULT =====');
  console.log(`Total requests: ${reqs.length}`);
  console.log(`Images: ${imgs.length}`);
  console.log(`GAME ASSETS: ${games.length}`);

  if(games.length > 0) {
    console.log('\n!!! GAME ASSETS FOUND !!!');
    games.forEach(g => console.log(`  [!] ${g.url}`));
  }

  console.log('\nAll images:');
  imgs.forEach((r,i) => {
    const tag = gamePat.test(r.url) ? ' <<<< GAME!' : '';
    console.log(`  ${i+1}. ${r.url.split('/').pop()}${tag}`);
  });

  console.log(`\nVERDICT: ${games.length>0 ? 'FAIL - game assets present' : 'PASS - clean'}`);
  br.disconnect();
})().catch(console.error);
