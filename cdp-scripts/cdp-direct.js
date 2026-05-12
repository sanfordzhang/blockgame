const puppeteer = require('puppeteer-core');
(async () => {
  const br = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: { width: 1440, height: 900 } });
  const page = (await br.pages())[0] || await br.newPage();
  const cdp = await page.createCDPSession();

  // Nuclear clear
  try { await cdp.send('Network.clearBrowserCache'); } catch(e){}  
  try { await cdp.send('Network.clearBrowserCookies'); } catch(e){}
  try { await cdp.send('Storage.clearDataForOrigin', { origin: 'http://43.163.114.175:3001/', storageTypes: 'all' }); } catch(e){}
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
    reqs.push({ url: u, type: String(e.type||''), ts: e.timestamp });
  });

  // Navigate via DIRECT IP (bypassing DNS/proxy issues)
  const TARGET = 'http://43.163.114.175:3001/';
  console.log(`[NAV] ${TARGET}`);
  const t0 = Date.now();
  
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(()=>{});
  console.log(`[DCL] ${Date.now()-t0}ms`);
  await page.screenshot({ path:'/tmp/direct-dcl.png', fullPage:false });

  await new Promise(r=>setTimeout(r,2000));
  console.log(`[2s]  ${Date.now()-t0}ms`);
  await page.screenshot({ path:'/tmp/direct-2s.png', fullPage:false });

  await new Promise(r=>setTimeout(r,3000));
  console.log(`[5s]  ${Date.now()-t0}ms`);
  await page.screenshot({ path:'/tmp/direct-5s.png', fullPage:false });

  try{ await page.waitForNavigation({waitUntil:'networkidle0',timeout:20000}); }catch(e){}
  console.log(`[IDLE] ${Date.now()-t0}ms`);
  await page.screenshot({ path:'/tmp/direct-idle.png', fullPage:false });

  // Analyze
  const gamePat = /player\d|dealer\.png|background\.png|table\.webp|card_back|small_blind|big_blind|gglab_green|avatar\.png|cards-svg/i;
  const imgs = reqs.filter(r => ['Image','image'].includes(r.type));
  const games = reqs.filter(r => gamePat.test(r.url));

  console.log(`\nTotal requests: ${reqs.length}, Images: ${imgs.length}, Game assets: ${games.length}`);

  // Print all requests sorted by time
  const baseTs = reqs.length ? reqs[0].ts : 0;
  console.log('\n--- Timeline ---');
  for(const r of reqs) {
    const t = r.ts ? Math.round((r.ts-baseTs)*1000) : '?';
    const g = gamePat.test(r.url) ? ' [!!! GAME !!!]' : '';
    if(['Script','Document','Stylesheet','Image','XHR'].includes(r.type) || gamePat.test(r.url))
      console.log(`  T+${String(t).padStart(5)}ms [${r.type.padEnd(10)}] ${r.url.split('/').pop().substring(0,60)}${g}`);
  }

  if(games.length > 0) {
    console.log('\n!!! FAIL: Game assets found in initial load !!!');
    games.forEach(g => console.log(`  ${g.url}`));
  } else {
    console.log('\n✅ PASS: No game assets in initial load!');
  }

  // Check JS chunk count & sizes  
  const jsChunks = reqs.filter(r => r.type === 'Script' && /\.chunk\.js/.test(r.url));
  console.log(`\nJS chunks loaded: ${jsChunks.length}`);
  jsChunks.forEach(j => console.log(`  ${j.url.split('/').pop()}`));

  br.disconnect();
})().catch(console.error);
