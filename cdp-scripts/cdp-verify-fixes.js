// CDP验证4个bug修复: 1)同账号重复玩家 2)AI状态残留 3)刷新余额0 4)Deposit读错变量
const CDP = require('chrome-remote-interface');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, DOM, Network } = client;
  
  await Page.enable();
  await Runtime.enable();
  await Network.enable();

  console.log('=== 开始验证4个Bug修复 ===\n');

  // Step 1: 导航到NFT页面，检查余额显示（Bug #3）
  console.log('--- Bug #3: 刷新页面后余额是否为0 ---');
  await Page.navigate({ url: 'http://43.163.114.175:3001/nft' });
  await sleep(5000);
  
  const balanceCheck = await Runtime.evaluate({
    expression: `
      (function() {
        const navbarEl = document.querySelector('[class*="chips"]') || document.querySelector('[class*="balance"]') || document.querySelector('.navbar');
        const allText = document.body.innerText;
        // Look for CHIP amount in navbar area
        const chipMatch = allText.match(/(\\d+[\\.,]\\d+)\\s*CHIP/);
        return {
          hasNavbar: !!navbarEl,
          chipMatchText: chipMatch ? chipMatch[0] : 'not found',
          bodySnippet: allText.substring(0, 200)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('NFT页面余额:', JSON.stringify(balanceCheck.result.value, null, 2));

  // Take screenshot of NFT page
  const screenshot1 = await Page.captureScreenshot({ format: 'png' });
  require('fs').writeFileSync('/tmp/cdp-verify-nft-balance.png', Buffer.from(screenshot1.data, 'base64'));
  console.log('截图保存: /tmp/cdp-verify-nft-balance.png\n');

  // Step 2: 导航到Wallet页面，测试Deposit功能（Bug #4）
  console.log('--- Bug #4: Deposit(CHIP)按钮是否正确读取onChainBalance ---');
  await Page.navigate({ url: 'http://43.163.114.175:3001/wallet' });
  await sleep(5000);
  
  // Check if on-chain balance is displayed and handleDepositChip uses correct variable
  const walletState = await Runtime.evaluate({
    expression: `
      (function() {
        // Check what's visible on the wallet page
        const bodyText = document.body.innerText;
        
        // Try to find the on-chain balance display
        const onChainMatch = bodyText.match(/On-Chain[\\s\\S]*?([\\d,]+\\.?\\d*)\\s*CHIP/i);
        const gameBalanceMatch = bodyText.match(/Game[\\s\\S]*?Balance[\\s\\S]*?([\\d,]+\\.?\\d*)/i);
        
        return {
          onChainDisplay: onChainMatch ? onChainMatch[0].trim() : 'NOT FOUND',
          gameBalanceDisplay: gameBalanceMatch ? gameBalanceMatch[0].trim() : 'NOT FOUND',
          hasDepositButton: !!document.querySelector('button'),
          buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.includes('Deposit'))
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Wallet页面状态:', JSON.stringify(walletState.result.value, null, 2));

  const screenshot2 = await Page.captureScreenshot({ format: 'png' });
  require('fs').writeFileSync('/tmp/cdp-verify-wallet-deposit.png', Buffer.from(screenshot2.data, 'base64'));
  console.log('截图保存: /tmp/cdp-verify-wallet-deposit.png\n');

  // Step 3: 导航到游戏页面，检查重复玩家（Bug #1）
  console.log('--- Bug #1: 检查同一账号是否出现两个玩家 ---');
  await Page.navigate({ url: 'http://43.163.114.175:3001/' });
  await sleep(4000);

  // Click Play button to enter game
  const playClick = await Runtime.evaluate({
    expression: `
      (function() {
        // Find and click Play or Join Table button
        const buttons = Array.from(document.querySelectorAll('button, a[href*="play"], [role="button"]'));
        const playBtn = buttons.find(b => /play|join|start|开始/i.test(b.textContent));
        if (playBtn) {
          playBtn.click();
          return 'Clicked: ' + playBtn.textContent.trim();
        }
        return 'No play button found. Available buttons: ' + buttons.map(b => b.textContent.trim().substring(0,30)).join(', ');
      })()
    `,
    returnByValue: true
  });
  console.log(playClick.result.value);
  await sleep(6000);

  const gameScreen = await Page.captureScreenshot({ format: 'png' });
  require('fs').writeFileSync('/tmp/cdp-verify-game-entry.png', Buffer.from(gameScreen.data, 'base64'));
  console.log('截图保存: /tmp/cdp-verify-game-entry.png');

  // Check for duplicate players in game view
  const playerCheck = await Runtime.evaluate({
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        // Find player names/addresses - check for duplicates
        const addressPattern = /T[A-Za-z0-9]{33}/g;
        const addresses = bodyText.match(addressPattern) || [];
        const uniqueAddresses = new Set(addresses);
        
        // Also look for seat info
        const seatMatches = bodyText.match(/seat\\s*\\d|Seat\\s*\\d|座位\\s*\\d/gi) || [];
        
        return {
          totalAddressesFound: addresses.length,
          uniqueAddresses: Array.from(uniqueAddresses),
          duplicateDetected: addresses.length > uniqueAddresses.size,
          seatInfo: seatMatches,
          textSnippet: bodyText.substring(0, 500)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('\n玩家检测:', JSON.stringify(playerCheck.result.value, null, 2));

  // Step 4: Check AI state after entering game (Bug #2 context)
  console.log('\n--- Bug #2: AI状态检查（进入游戏后应无AI自动操作）---');
  const aiCheck = await Runtime.evaluate({
    expression: `
      (function() {
        // Check if there's any AI control panel or indication
        const bodyText = document.body.innerText;
        const hasAIPanel = /autopilot|auto.?pilot|AI/i.test(bodyText);
        const aiEnabledIndicators = bodyText.match(/AI.*enabled|autopilot.*on|自动.*开启/gi) || [];
        return {
          hasAIPanel,
          aiIndicators: aiEnabledIndicators,
          note: 'AI should NOT be enabled by default when re-entering game'
        };
      })()
    `,
    returnByValue: true
  });
  console.log('AI状态:', JSON.stringify(aiCheck.result.value, null, 2));

  console.log('\n=== 验证完成 ===');
  console.log('修复摘要:');
  console.log('Bug #1 (重复玩家): 服务端重连时清理旧座位+清理旧AI状态');
  console.log('Bug #2 (AI残留): 断开连接时自动disableAI + 离开游戏时发送CS_AI_DISABLE');
  console.log('Bug #3 (余额0): AppLayout API路径从 /api/chips/balance 改为 /api/chip/balance');
  console.log('Bug #4 (Deposit): handleDepositChip读取onChainBalance state而非balance.onchainBalance(undefined)');

  await client.close();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
