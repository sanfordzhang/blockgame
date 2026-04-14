// CDP深度验证：等页面完全加载后检查余额和Deposit功能
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime } = client;
  
  await Page.enable();
  await Runtime.enable();

  console.log('=== 深度验证：等待页面完全加载 ===\n');

  // Step 1: Navigate to Wallet and wait for full load
  console.log('--- 验证Wallet页面 + Deposit(CHIP) ---');
  await Page.navigate({ url: 'http://43.163.114.175:3001/wallet' });
  await sleep(8000); // Wait longer for full data load
  
  const walletData = await Runtime.evaluate({
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        const html = document.body.innerHTML;
        
        // Check all balance-related text
        const chipMatches = [...bodyText.matchAll(/([\\d,]+\\.?\\d*)\\s*CHIP/g)].map(m => m[0]);
        const trxMatches = [...bodyText.matchAll(/([\\d,]+\\.?\\d*)\\s*TRX/g)].map(m => m[0]);
        
        // Check if Deposit/Withdraw tab content is visible
        const hasOnChainBalance = /on.?chain|On-Chain|链上/i.test(bodyText);
        const hasGameBalance = /game.*balance|Game.*Balance|游戏.*余额/i.test(bodyText);
        
        // Look for specific numbers that indicate on-chain balance
        const largeNumbers = bodyText.match(/\\d{4}\\.\\d{3}/g) || [];
        
        return {
          chipValues: chipMatches,
          trxValues: trxMatches,
          largeNumbers: largeNumbers,
          hasOnChainSection: hasOnChainBalance,
          hasGameBalanceSection: hasGameBalance,
          isLoading: /loading|加载/i.test(bodyText),
          // Get a broader snippet of the wallet area
          walletSnippet: bodyText.substring(0, 1500)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Wallet完整数据:', JSON.stringify(walletData.result.value, null, 2));

  const ssWallet = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdp-wallet-full.png', Buffer.from(ssWallet.data, 'base64'));
  console.log('Wallet完整截图: /tmp/cdp-wallet-full.png');

  // Step 2: Click on Deposit/Withdraw tab and check deposit button
  console.log('\n--- 点击Deposit/Withdraw标签 ---');
  await Runtime.evaluate({
    expression: `
      (function() {
        const tabs = Array.from(document.querySelectorAll('button, [role="tab"], [class*="tab"]'));
        const depositTab = tabs.find(t => /deposit|withdraw|存取款/i.test(t.textContent));
        if (depositTab) {
          depositTab.click();
          return 'Clicked: ' + depositTab.textContent.trim();
        }
        return 'Tab not found. Tabs: ' + tabs.map(t => t.textContent.trim().substring(0,20)).join(' | ');
      })()
    `,
    returnByValue: true
  });
  await sleep(3000);

  const ssDeposit = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdp-deposit-tab.png', Buffer.from(ssDeposit.data, 'base64'));
  console.log('Deposit标签页截图: /tmp/cdp-deposit-tab.png\n');

  // Step 3: Navigate to NFT page and check navbar balance
  console.log('--- 验证NFT页面navbar余额 ---');
  await Page.navigate({ url: 'http://43.163.114.175:3001/nft' });
  await sleep(8000);

  const nftData = await Runtime.evaluate({
    expression: `
      (function() {
        const bodyText = document.body.innerText;
        // Find navbar area - usually top right
        const navbarArea = document.querySelector('[class*="nav"], [class*="header"], nav, header');
        const navbarText = navbarArea ? navbarArea.innerText : '';
        
        // Find all numbers near TRX or CHIP
        const allBalances = [...bodyText.matchAll(/(\\d[\\d,]*\\.?\\d*)\\s*(TRX|CHIP)/g)].map(m => m[0]);
        
        return {
          navbarText: navbarText.substring(0, 200),
          allBalances: allBalances,
          isLoading: /loading|加载/i.test(bodyText),
          pageSnippet: bodyText.substring(0, 500)
        };
      })()
    `,
    returnByValue: true
  });
  console.log('NFT页面数据:', JSON.stringify(nftData.result.value, null, 2));

  const ssNFT = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdp-nft-full.png', Buffer.from(ssNFT.data, 'base64'));
  console.log('NFT页面截图: /tmp/cdp-nft-full.png');

  // Step 4: Navigate to DAO page too (user mentioned this)
  console.log('\n--- 验证DAO页面navbar余额 ---');
  await Page.navigate({ url: 'http://43.163.114.175:3001/dao' });
  await sleep(6000);

  const ssDAO = await Page.captureScreenshot({ format: 'png' });
  fs.writeFileSync('/tmp/cdp-dao-full.png', Buffer.from(ssDAO.data, 'base64'));
  console.log('DAO页面截图: /tmp/cdp-dao-full.png');

  console.log('\n=== 全部验证完成 ===');
  await client.close();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
