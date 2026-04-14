const CDP = require('chrome-remote-interface');

async function verify() {
  let client;
  try {
    // Use a fresh connection with longer timeout
    client = await CDP({ port: 9222, maxRetries: 3, retryInterval: 1000 });
    
    const { Page, Runtime, Network } = client;
    await Promise.all([Page.enable(), Runtime.enable()]);
    await Network.enable();
    
    const fs = require('fs');

    // Step 1: Clear cache via JS (safer than Network.clearBrowserCache which can disconnect)
    console.log('Clearing caches via JS...');
    await Runtime.evaluate({
      expression: `
        (async () => {
          try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}
          try { const ks = await caches.keys(); for(const k of ks) await caches.delete(k); } catch(e) {}
          if(navigator.serviceWorker) {
            const regs = await navigator.serviceWorker.getRegistrations().catch(()=>[]);
            for(const r of regs) await r.unregister().catch(()=>{});
          }
          return 'done';
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    }).then(r => console.log('Cache clear:', r.result.value));

    // Disable network cache
    await Network.setCacheDisabled({ cacheDisabled: true });
    console.log('Network cache disabled');
    
    // Navigate with cache-busting query
    const t0 = Date.now();
    const url = 'http://43.163.114.175:3001/?_nocache=' + Date.now();
    console.log('Navigating to:', url);
    await Page.navigate({ url });
    console.log('Navigation command sent');

    // Wait and poll
    let contentVisible = false;
    let firstContentTime = 0;

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 800));
      const elapsed = Date.now() - t0;
      
      if (i === 0 || i % 4 === 0 || elapsed > 12000) {
        const ss = `/tmp/cdp-clean-t${elapsed}ms.png`;
        try {
          await Page.captureScreenshot({ format: 'png', fromSurface: true })
            .then(({ data }) => fs.writeFileSync(ss, data, 'base64'));
        } catch(e) { /* screenshot may fail */ }
      }

      const check = await Runtime.evaluate({
        expression: `({
          hasH2: !!document.querySelector('h2'),
          h2text: document.querySelector('h2')?.innerText?.substring(0,60)||'',
          txtLen: document.body.innerText.length,
          imgs: document.querySelectorAll('img').length,
          visImgs: Array.from(document.querySelectorAll('img')).filter(i=>i.naturalWidth>0).length,
        })`,
        returnByValue: true
      });

      const s = check.result.value;
      
      if (!contentVisible && s.hasH2) {
        contentVisible = true;
        firstContentTime = elapsed;
        console.log(`\\n*** CONTENT FIRST VISIBLE at T+${firstContentTime}ms ***`);
        console.log(`    h2="${s.h2text}" imgs=${s.imgs}/${s.visImgs}`);
      }

      if (contentVisible && elapsed > firstContentTime + 2000) break;
      if (elapsed > 18000 && !contentVisible) break;
    }

    const totalElapsed = Date.now() - t0;
    console.log(`\\nTotal time: ${totalElapsed}ms`);

    // Resource analysis
    const res = await Runtime.evaluate({
      expression: `
        performance.getEntriesByType('resource').map(e=>({
          n:e.name.split('/').slice(-2).join('/'),
          t:e.initiatorType,
          d:Math.round(e.duration),
          kb:Math.round(e.transferSize/1024),
          s:Math.round(e.startTime),
          g:/player[1-6]|dealer\\.png|background\\.png|table\\.webp|card_back|big_blind|small_blind|cards-svg/.test(e.name)
        })).sort((a,b)=>a.s-b.s)
      `,
      returnByValue: true
    });

    const allRes = res.result.value || [];
    const gameAssets = allRes.filter(r => r.g);
    
    console.log(`\\nResources: ${allRes.length} total, ${gameAssets.length} game assets`);
    
    if (gameAssets.length === 0) {
      console.log('>>> NO GAME ASSETS IN INITIAL LOAD <<< FIX VERIFIED!');
    } else {
      gameAssets.forEach(a => console.log(`  GAME [${a.s}ms +${a.d}ms ${a.kb}KB] ${a.n}`));
    }

    // Show timeline of significant resources
    console.log('\\n--- Timeline (resources >30KB or >200ms or game assets) ---');
    allRes.filter(r => r.kb > 30 || r.d > 200 || r.g)
         .forEach(r => console.log(`  [${r.s}ms +${r.d}ms ${r.kb}KB] ${r.t}: ${r.n}${r.g?' [GAME]':''}`));

    // Re-enable cache
    await Network.setCacheDisabled({ cacheDisabled: false });

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    if(client) try { await client.close(); } catch(ex) {}
  }
}
verify().catch(console.error);
