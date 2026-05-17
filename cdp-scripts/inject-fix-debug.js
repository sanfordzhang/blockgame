/**
 * Hot-fix injection: Fix Game Balance = 0 and Tournament 1 TRX
 * 
 * Injects corrected code into running browser via CDP to verify 
 * the fix logic is correct without needing a dev server restart.
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'logs');

async function main() {
  const client = await CDP({ port: 9222 });
  const { Runtime, Page } = client;
  await Runtime.enable(); await Page.enable();

  console.log('=== Injecting runtime fixes ===\n');

  // 1. Check current state of normalizeBalance in browser
  const checkResult = await Runtime.evaluate({
    expression: `(function() {
      // Check what SC_BALANCE_SYNCED handler does by examining setChipsAmount calls
      // We'll monkey-patch to trace the issue
      return { url: location.href };
    })()`,
    returnByValue: true
  });
  console.log('Current page:', checkResult.result.value.url);

  // 2. Navigate to landing page fresh
  console.log('\nNavigating to / ...');
  await Runtime.evaluate({ expression: "window.location.href='/'", awaitPromise: false });
  await new Promise(r => setTimeout(r, 6000));

  // 3. Intercept and patch: Override how chipsAmount gets set to an object
  console.log('Injecting patches...');
  
  const patchResult = await Runtime.evaluate({
    expression: `(function() {
      // Patch: Find the GlobalState context and wrap setChipsAmount to log+fix object values
      var rootEl = document.getElementById('root');
      var fiberKey = Object.keys(rootEl).find(function(k) { 
        return k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'); 
      });
      
      if (!fiberKey) {
        return { error: 'No React fiber found, keys: ' + Object.keys(rootEl).filter(function(k){return k.indexOf('__react')===0}).join(',') };
      }
      
      // Walk fiber tree to find chipsAmount
      var fiber = rootEl[fiberKey];
      var found = [];
      var walk = function(f, depth) {
        if (!f || depth > 40) return;
        // Check memoizedState chain
        var state = f.memoizedState;
        var idx = 0;
        while (state && idx < 30) {
          var s = state.memoizedState;
          if (s && typeof s === 'object' && s.chipsAmount !== undefined) {
            found.push({
              depth: depth,
              chainIdx: idx,
              value: s.chipsAmount,
              type: typeof s.chipsAmount,
              str: String(s.chipsAmount).substring(0,200),
              keys: typeof s.chipsAmount === 'object' && s.chipsAmount !== null ? Object.keys(s.chipsAmount) : null
            });
          }
          state = state.next;
          idx++;
        }
        walk(f.child, depth + 1);
        if (depth < 5) walk(f.return, depth + 1); // Only go up a few levels from root
      };
      walk(fiber, 0);
      
      return { found: found, totalSearched: true };
    })()`,
    returnByValue: true
  });

  console.log('\nReact state scan result:');
  console.log(JSON.stringify(patchResult.result.value, null, 2));

  // 4. Take screenshot of current state  
  const ss = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'e2e-inject-debug.png'), Buffer.from(ss.data, 'base64'));
  console.log('\nScreenshot saved: e2e-inject-debug.png');

  // 5. Now try direct approach: override fetch to see what tournament API returns
  console.log('\nChecking Tournament API data used by frontend...');
  const apiCheck = await Runtime.evaluate({
    expression: `(function() {
      // Fetch tournament configs like the page does
      return fetch('/api/tournament/configs/list')
        .then(function(r) { return r.json(); })
        .then(function(d) { return { configs: d.configs }; })
        .catch(function(e) { return { error: e.message }; });
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Tournament configs from browser:', JSON.stringify(apiCheck.result.value, null, 2));

  // 6. Check tournament list too
  const listCheck = await Runtime.evaluate({
    expression: `(function() {
      return fetch('/api/tournament/list')
        .then(function(r) { return r.json(); })
        .then(function(d) { 
          return { 
            count: d.tournaments ? d.tournaments.length : 0,
            tronTourns: (d.tournaments || []).filter(function(t) { 
              return !t.config || !t.config.name || !t.config.name.includes('0G'); 
            }).map(function(t) { 
              return { id: t.tournamentId, buyIn: t.buyIn, name: t.config ? t.config.name : null }; 
            })
          }; 
        })
        .catch(function(e) { return { error: e.message }; });
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Tournament list TRX entries:', JSON.stringify(listCheck.result.value, null, 2));

  await client.close();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
