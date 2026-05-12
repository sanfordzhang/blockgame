const puppeteer = require('puppeteer-core');

const URL = 'https://testnet.vintagepoker.xyz';
const CDP_PORT = 9222;

async function main() {
  const browser = await puppeteer.connect({
    browserURL: `http://127.0.0.1:${CDP_PORT}`,
    defaultViewport: { width: 1440, height: 900 },
  });

  let page = (await browser.pages())[0] || await browser.newPage();
  const client = await page.createCDPSession();

  // === Step 1: Nuclear cache clear ===
  console.log('=== NUCLEAR CACHE CLEAR ===');
  try { await client.send('Network.clearBrowserCache'); } catch(e) {}
  try { await client.send('Network.clearBrowserCookies'); } catch(e) {}
  try { await client.send('Storage.clearDataForOrigin', { origin: URL + '/', storageTypes: 'all' }); } catch(e) {}
  
  // Kill all service workers
  try {
    const { registrations } = await client.send('ServiceWorker.getRegistrations');
    for (const reg of registrations || []) {
      await client.send('ServiceWorker.unregister', { scopeURL: reg.scopeURL });
      console.log(`  Unregistered SW: ${reg.scopeURL}`);
    }
  } catch(e) {}

  // Enable comprehensive monitoring
  await client.send('Network.enable');
  await client.send('Page.enable');

  // Track ALL requests with detailed info
  const allRequests = [];
  const requestMap = new Map(); // requestId -> info
  
  client.on('Network.requestWillBeSent', (event) => {
    const req = event.request;
    const url = req.url;
    
    // Skip chrome internal / data URIs / favicon
    if (url.startsWith('data:') || url.includes('favicon') || url.startsWith('chrome-extension://')) return;

    // Skip analytics/tracking
    if (url.includes('google-analytics') || url.includes('googletag') || url.includes('hotjar')) return;

    const entry = {
      id: event.requestId,
      url,
      method: req.method,
      type: (event.type || '').toString(),
      initiator: JSON.stringify(event.initiator).slice(0, 200),
      wallTime: event.wallTime ? Math.round(event.wallTime * 1000) : null,
      timestamp: event.timestamp,
      resourceType: event.type,
    };
    
    requestMap.set(event.requestId, entry);
    allRequests.push(entry);
  });

  client.on('Network.responseReceived', (event) => {
    const entry = requestMap.get(event.requestId);
    if (entry) {
      entry.status = event.response.status;
      entry.mimeType = event.response.mimeType;
      entry.size = event.response.headers['content-length'] || 
                   parseInt(event.response.headers['content-length'] || '0');
    }
  });

  client.on('Network.loadingFinished', (event) => {
    const entry = requestMap.get(event.requestId);
    if (entry) {
      entry.finished = true;
      entry.encodedSize = event.encodedDataLength;
      entry.dataLength = event.dataLength;
    }
  });

  console.log('\n=== NAVIGATING TO:', URL, '===');
  const navStart = Date.now();

  // Navigate with domcontentloaded first
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const dclTime = Date.now() - navStart;
  console.log(`\n[DCL] T+${dclTime}ms - DOMContentLoaded`);
  await page.screenshot({ path: '/tmp/deep-t1-dcl.png', fullPage: false });

  // Wait 3 seconds for visual rendering
  await new Promise(r => setTimeout(r, 3000));
  const render3s = Date.now() - navStart;
  console.log(`[R3]  T+${render3s}ms - After 3s wait`);
  await page.screenshot({ path: '/tmp/deep-t2-render3s.png', fullPage: false });

  // Wait for full network idle (up to 30s)
  try {
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
  } catch(e) {}
  const idleTime = Date.now() - navStart;
  console.log(`[IDLE] T+${idleTime}ms - NetworkIdle`);
  await page.screenshot({ path: '/tmp/deep-t3-idle.png', fullPage: false });

  // Also capture what JS chunks were loaded
  console.log('\n========== DETAILED REQUEST ANALYSIS ==========');

  // Categorize requests
  const categories = {
    js: [], css: [], image: [], font: [], xhr: [], doc: [], other: [],
  };
  
  const gameAssetPatterns = [
    /player[1-6]\./i, /dealer\./i, /background\.png/i, /table\.webp/i,
    /card_back\./i, /small_blind\./i, /big_blind\./i, /gglab_green\./i,
    /avatar\.png/i, /loading-background\./i, /cards-svg\//i,
  ];

  for (const req of allRequests) {
    const url = req.url;
    const ext = url.split('?')[0].split('#')[0].split('.').pop().toLowerCase();
    const isGameAsset = gameAssetPatterns.some(p => p.test(url));
    const isImg = ['png','jpg','jpeg','svg','gif','webp','ico'].includes(ext);
    
    const cat = isGameAsset ? 'GAME_ASSET' :
                ext === 'js' ? 'JS' :
                ext === 'css' ? 'CSS' :
                isImg ? 'IMG' : 'OTHER';
    
    req.category = cat;
    req.isGameAsset = isGameAsset;
    req.shortUrl = url.split('/').pop().split('?')[0];
    req.relativeT = req.wallTime ? (req.wallTime - (requestMap.values().next().value?.wallTime || req.wallTime)) : null;
  }

  // Sort by time
  allRequests.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // Print timeline
  const baseTime = allRequests[0]?.timestamp || 0;
  console.log('\n--- REQUEST TIMELINE (sorted by start time) ---');
  console.log(`${'T(ms)'.padEnd(8)} ${'Status'.padEnd(6)} ${'Size'.padEnd(10)} ${'Type'.padEnd(14)} ${'URL'.padEnd(70)} Game?`);
  console.log('-'.repeat(120));
  
  for (const req of allRequests) {
    const t = req.timestamp ? Math.round((req.timestamp - baseTime) * 1000) : '?';
    const status = String(req.status || '?').padEnd(6);
    const size = req.encodedSize != null ? formatBytes(req.encodedSize).padEnd(10) : ''.padStart(10);
    const type = (req.resourceType || '?').toString().padEnd(14);
    const url = (req.shortUrl || req.url).substring(0, 68).padEnd(70);
    const gameTag = req.isGameAsset ? '!!! GAME !!!' : '';
    
    // Only print interesting stuff (not every tiny icon)
    if (req.isGameAsset || req.encodedDataLength > 5000 || 
        ['Script', 'Document', 'Stylesheet', 'Image', 'XHR'].includes(req.resourceType)) {
      console.log(`${String(t).padEnd(8)} ${status} ${size} ${type} ${url} ${gameTag}`);
    }
  }

  // Summary stats
  console.log('\n========== SUMMARY ==========');
  const gameReqs = allRequests.filter(r => r.isGameAsset);
  const imgReqs = allRequests.filter(r => r.category === 'IMG');
  const jsReqs = allRequests.filter(r => r.resourceType === 'Script');
  const cssReqs = allRequests.filter(r => r.resourceType === 'Stylesheet');
  const totalSize = allRequests.reduce((sum, r) => sum + (r.encodedDataLength || 0), 0);

  console.log(`Total requests: ${allRequests.length}`);
  console.log(`Total transferred: ${formatBytes(totalSize)}`);
  console.log(`JS chunks: ${jsReqs.length} (total ${formatBytes(jsReqs.reduce((s,r)=>s+(r.encodedDataLength||0),0))})`);
  console.log(`CSS files: ${cssReqs.length}`);
  console.log(`Images: ${imgReqs.length}`);
  console.log(`\n*** GAME ASSETS DETECTED: ${gameReqs.length} ***`);
  if (gameReqs.length > 0) {
    console.log('These game assets were requested during landing page load:');
    for (const g of gameReqs) {
      console.log(`  [!] ${g.url}`);
      console.log(`      Type: ${g.resourceType}, Size: ${formatBytes(g.encodedDataLength)}, Initiated: ${g.initiator}`);
    }
  }

  // Check JS chunks - list them
  console.log('\n--- JS Chunks Loaded ---');
  for (const j of jsReqs) {
    const sizeStr = j.encodedSize ? formatBytes(j.encodedSize) : '?';
    console.log(`  ${sizeStr.padEnd(10)} ${j.url.split('/').pop().split('?')[0]}`);
  }

  console.log(`\nTiming: DCL=${dclTime}ms, Render@3s=${render3s}ms, Idle=${idleTime}ms`);
  console.log(`Result: ${gameReqs.length > 0 ? 'FAIL - game assets still blocking!' : 'PASS - no game assets in initial load'}`);

  browser.disconnect();
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

main().catch(console.error);
