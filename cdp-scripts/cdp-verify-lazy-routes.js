const puppeteer = require('puppeteer-core');
const path = require('path');

const URL = 'https://testnet.vintagepoker.xyz';
const CDP_PORT = 9222;

async function main() {
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CDP_PORT}`,
    defaultViewport: null,
  });

  // Use existing page or create new one
  let page = (await browser.pages())[0];
  if (!page) {
    page = await browser.newPage();
  }

  console.log('=== Step 1: Clear ALL cache ===');
  const client = await page.createCDPSession();

  // Clear everything
  try { await client.send('Network.clearBrowserCache'); console.log('  [OK] Browser cache cleared'); } catch(e) { console.log('  [WARN] clearBrowserCache:', e.message); }
  try { await client.send('Network.clearBrowserCookies'); console.log('  [OK] Cookies cleared'); } catch(e) { console.log('  [WARN] clearBrowserCookies:', e.message); }
  try { await client.send('Storage.clearDataForOrigin', { origin: URL, storageTypes: 'all' }); console.log('  [OK] Storage cleared for', URL); } catch(e) { console.log('  [WARN] clearStorage:', e.message); }

  // Unregister all Service Workers
  try {
    const swRegistrations = await client.send('ServiceWorker.unregister', { scopeURL: URL + '/' });
    console.log('  [OK] SW unregistered:', JSON.stringify(swRegistrations));
  } catch(e) { console.log('  [INFO] No SW to unregister'); }

  // Enable network monitoring before navigation
  await client.send('Network.enable');
  
  // Track resources
  const resources = [];
  client.on('Network.requestWillBeSent', (event) => {
    const url = event.request.url;
    const ext = url.split('.').pop().split('?')[0].split('#')[0].toLowerCase();
    const isGameAsset = /\/(player[1-6]|dealer|background|table\.webp|card_back|small_blind|big_blind|gglab_green|avatar|loading-background)\./i.test(url) || 
                        /\/cards-svg\//.test(url);
    if (['png','jpg','jpeg','svg','gif','webp'].includes(ext)) {
      resources.push({ url, time: event.wallTime, isGameAsset });
      if (isGameAsset) {
        console.log(`  [GAME ASSET!] ${url}`);
      }
    }
  });

  console.log('\n=== Step 2: Navigate to landing page ===');
  const t0 = Date.now();
  
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const domTime = Date.now() - t0;
  console.log(`  T+${domTime}ms: DOMContentLoaded`);
  await page.screenshot({ path: '/tmp/verify-dom.png', fullPage: false });
  console.log('  Screenshot saved: /tmp/verify-dom.png');

  // Wait a bit for rendering
  await new Promise(r => setTimeout(r, 2000));
  const renderTime = Date.now() - t0;
  await page.screenshot({ path: '/tmp/verify-render.png', fullPage: false });
  console.log(`  T+${renderTime}ms: After 2s render wait`);

  // Wait for full load
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  const idleTime = Date.now() - t0;
  await page.screenshot({ path: '/tmp/verify-idle.png', fullPage: false });
  console.log(`  T+${idleTime}ms: NetworkIdle`);

  console.log('\n=== Step 3: Resource Analysis ===');
  const gameAssets = resources.filter(r => r.isGameAsset);
  const nonGameAssets = resources.filter(r => !r.isGameAsset);
  
  console.log(`\nTotal image requests: ${resources.length}`);
  console.log(`Game assets (player/dealer/background/cards): ${gameAssets.length}`);
  console.log(`Non-game images: ${nonGameAssets.length}`);

  if (gameAssets.length > 0) {
    console.log('\n!!! GAME ASSETS FOUND IN INITIAL LOAD !!!');
    gameAssets.forEach(r => console.log(`  - ${r.url}`));
  } else {
    console.log('\n✅ SUCCESS: ZERO game assets in initial load!');
  }

  console.log('\nAll image resources:');
  resources.forEach((r, i) => {
    console.log(`  ${r.isGame ? '[GAME]' : '     '} ${i+1}. ${r.url.split('/').pop()} (${r.url.includes('/game/') ? 'game/' : r.url.includes('/img/') ? 'img/' : 'other'})`);
  });

  // Also check JS chunks loaded
  const jsChunks = [];
  client.removeAllListeners('Network.requestWillBeSent');

  console.log('\n=== Verification Complete ===');
  console.log(`DOM visible: T+${domTime}ms`);
  console.log(`Rendered: T+${renderTime}ms`);
  console.log(`Network idle: T+${idleTime}ms`);
  console.log(`Game assets blocking: ${gameAssets.length > 0 ? 'YES - FIX NEEDED' : 'NO - PASS'}`);
}

main().catch(console.error);
