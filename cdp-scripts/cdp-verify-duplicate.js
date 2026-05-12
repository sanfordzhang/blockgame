// CDP验证：同账号重复玩家 + 进入后立即退出
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Console } = client;
  
  await Page.enable();
  await Runtime.enable();
  await Console.enable();

  const consoleMsgs = [];
  Console.messageAdded(({ message }) => {
    if (message.level === 'error' || message.level === 'warning') {
      consoleMsgs.push(message.text.substring(0, 300));
    }
    if (message.text.includes('already') || message.text.includes('seated') || 
        message.text.includes('duplicate') || message.text.includes('leave') ||
        message.text.includes('error') || message.text.includes('Error')) {
      consoleMsgs.push(`[${message.level}] ${message.text.substring(0, 300)}`);
    }
  });

  console.log('=== 测试1: 进入游戏，检查重复玩家 ===\n');
  
  // Step 1: Navigate to landing page first (ensure clean state)
  await Page.navigate({ url: 'http://43.163.114.175:3001/' });
  await sleep(4000);
  
  // Click Play to enter game
  const clickRes = await Runtime.evaluate({
    expression: `
      (function() {
        const buttons = Array.from(document.querySelectorAll('button, a[href*="play"], [role="button"], [class*="play"]'));
        const playBtn = buttons.find(b => /play|join|开始|进入/i.test(b.textContent));
        if (playBtn) { playBtn.click(); return 'Clicked: ' + playBtn.textContent.trim(); }
        return 'No play btn. Available: ' + buttons.map(b=>b.textContent.trim().substring(0,20)).join(', ');
      })()
    `,
    returnByValue: true
  });
  console.log(clickRes.result.value);
  await sleep(8000);

  // Check game state for duplicate players
  const gameState1 = await Runtime.evaluate({
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        
        // Find player names/addresses at seats
        const seatPattern = /(Seat\\d+|座位\\d+)\\s*[:\\n]*\\s*([A-Za-z0-9_]+)/g;
        const seats = [];
        let match;
        while ((match = seatPattern.exec(bodyText)) !== null) {
          seats.push({ label: match[1], name: match[2] });
        }
        
        // Also find all TU... addresses
        const addresses = [...bodyText.matchAll(/TU[A-Za-z0-9]{30}/g)].map(m => m[0]);
        const uniqueAddrs = new Set(addresses);
        
        // Count players with stack values
        const playerWithStack = [...bodyText.matchAll(/TU[\\w]{30}\\n([\\d,]+)/g)].map(m => ({ addr: m[0], stack: m[1] }));
        
        return {
          seatsFound: seats,
          allAddresses: addresses,
          uniqueAddresses: Array.from(uniqueAddrs),
          duplicateDetected: addresses.length > uniqueAddrCount,
          totalAddrCount: addresses.length,
          uniqueAddrCount: uniqueAddrs.size,
          playersWithStack: playerWithStack,
          textSnippet: bodyText.substring(0, 1000)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('\n游戏状态检查:', JSON.stringify(gameState1.result.value, null, 2));

  const ss1 = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdp-dup-check1.png', Buffer.from(ss1.data, 'base64'));
  console.log('截图: /tmp/cdp-dup-check1.png');

  // Check console for relevant messages
  console.log('\n=== Console关键消息 ===');
  consoleMsgs.forEach(m => console.log('  ' + m));

  // Step 2: Try re-entering the game (simulate reconnect scenario)
  console.log('\n\n=== 测试2: 模拟重新连接（离开再回来） ===\n');
  
  // Leave the game first
  await Runtime.evaluate({
    expression: `
      (function() {
        const leaveBtn = Array.from(document.querySelectorAll('button')).find(b => /leave|退出|Leave/i.test(b.textContent));
        if (leaveBtn) { leaveBtn.click(); return 'Clicked Leave'; }
        return 'No Leave button';
      })()
    `,
    returnByValue: true
  });
  await sleep(5000);
  
  // Re-enter game
  await Runtime.evaluate({
    expression: `
      (function() {
        // Navigate back to home and click Play again
        window.location.href = 'http://43.163.114.175:3001/';
        return 'Navigating home';
      })()
    `,
    returnByValue: true
  });
  await sleep(6000);

  // Click Play again
  await Runtime.evaluate({
    expression: `
      (function() {
        const buttons = Array.from(document.querySelectorAll('button, a[href*="play"]'));
        const playBtn = buttons.find(b => /play|join/i.test(b.textContent));
        if (playBtn) { playBtn.click(); return 'Clicked Play (reconnect sim)'; }
        return 'No play btn on reconnect';
      })()
    `,
    returnByValue: true
  });
  await sleep(8000);

  const gameState2 = await Runtime.evaluate({
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        const addresses = [...bodyText.matchAll(/TU[A-Za-z0-9]{30}/g)].map(m => m[0]);
        const uniqueAddrs = new Set(addresses);
        const playersWithStack = [...bodyText.matchAll(/TU[\\w]{30}[\\s\\S]*?([\\d,]+)/g)].map(m => m[0].substring(0,40));
        
        return {
          totalAddrCount: addresses.length,
          uniqueAddrCount: uniqueAddrs.size,
          duplicateDetected: addresses.length > uniqueAddrs.size,
          playersWithStack,
          stillInGame: bodyText.includes('Pre-Flop') || bodyText.includes('Waiting'),
          textSnippet: bodyText.substring(0, 800)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('重新连接后游戏状态:', JSON.stringify(gameState2.result.value, null, 2));

  const ss2 = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdp-dup-check2.png', Buffer.from(ss2.data, 'base64'));
  console.log('截图: /tmp/cdp-dup-check2.png');

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('=== 验证结果汇总 ===');
  console.log('='.repeat(50));
  console.log(`Bug #1 重复玩家: ${gameState1.result.value.totalAddrCount > gameState1.result.value.uniqueAddrCount ? '❌ 仍有重复!' : '✅ 首次进入正常'}`);
  console.log(`Bug #1 重连重复: ${gameState2.result.value.duplicateDetected ? '❌ 重连后重复!' : '✅ 重连后无重复'}`);
  console.log(`Bug #2 立即退出: ${gameState2.result.value.stillInGame ? '✅ 留在游戏中' : '⚠️ 已退出，需排查'}`);

  await client.close();
}

run().catch(e => { console.error('Error:', e); process.exit(1); });
