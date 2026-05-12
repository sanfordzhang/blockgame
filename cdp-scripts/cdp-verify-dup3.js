// CDP最终验证：点击Play进入游戏桌检查重复玩家
const CDP = require('chrome-remote-interface');
const fs = require('fs');
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();

  // Click Play button to join table
  console.log('点击Play进入游戏...');
  
  const clicked = await Runtime.evaluate({
    expression: `
      (function() {
        // Find any clickable element that leads to game
        const all = Array.from(document.querySelectorAll('button, a, div[role="button"], [class*="btn"], [class*="Btn"]'));
        const playEl = all.find(el => {
          const t = (el.textContent || '').trim().toLowerCase();
          return t === 'play' || t === 'join' || t.includes('开始游戏') || t.includes('join table');
        });
        if (playEl) { playEl.click(); return 'Clicked: ' + playEl.textContent.trim(); }
        
        // Try finding by href or onclick
        const linkPlay = document.querySelector('a[href*="play"]');
        if (linkPlay) { linkPlay.click(); return 'Clicked link: ' + linkPlay.href; }
        
        return 'Not found. Elements: ' + all.map(e=>e.textContent.trim().substring(0,20)).filter(Boolean).slice(0,10).join(' | ');
      })()
    `,
    returnByValue: true
  });
  console.log(clicked.result.value);
  
  // Wait for game table to load
  await sleep(10000);
  
  // Check state
  const state = await Runtime.evaluate({
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        const addresses = [...bodyText.matchAll(/TU[\\w]{30}/g)].map(m => m[0]);
        const uniqueAddrs = [...new Set(addresses)];
        const lines = bodyText.split('\\n').filter(l => /TU\\w|Empty Seat|Seat/.test(l));
        
        // Check if in game view vs landing view
        const inGameView = /Pre-Flop|Flop|Turn|River|New hand started|Waiting|Leave/i.test(bodyText);
        const onLanding = /Deposit TRX|Join the world|Deposit.*Withdraw/i.test(bodyText);
        
        return {
          inGameView,
          onLanding,
          totalAddresses: addresses.length,
          uniqueAddresses: uniqueAddrs,
          duplicate: addresses.length > uniqueAddrs.size,
          seatLines: lines,
          snippet: bodyText.substring(0, 1500)
        };
      })()
    `,
    returnByValue: true
  });

  console.log('\n=== 游戏状态 ===');
  console.log('在游戏中:', state.result.value.inGameView);
  console.log('在首页:', state.result.value.onLanding);
  console.log('地址出现次数:', state.result.value.totalAddresses);
  console.log('唯一地址:', JSON.stringify(state.result.value.uniqueAddresses));
  console.log('重复:', state.result.value.duplicate ? '❌' : '✅');
  console.log('\n座位行:');
  state.result.value.seatLines.forEach(l => console.log('  ' + l));

  const ss = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdup-game-final.png', Buffer.from(ss.data, 'base64'));
  console.log('\n截图: /tmp/cdup-game-final.png');

  await client.close();
}
run().catch(e => { console.error('Error:', e.message); process.exit(1); });
