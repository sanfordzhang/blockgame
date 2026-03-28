const CDP = require('chrome-remote-interface');

const WALLET_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const WALLET_URL = `http://127.0.0.1:3001/wallet?address=${WALLET_ADDRESS}`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWalletPage() {
  let client;
  try {
    console.log('Connecting to Chrome CDP...');
    client = await CDP({ port: 9222 });
    const { Page, Runtime, DOM } = client;
    
    await Page.enable();
    await Runtime.enable();
    await DOM.enable();
    
    console.log(`Navigating to: ${WALLET_URL}`);
    await Page.navigate({ url: WALLET_URL });
    await Page.loadEventFired();
    await sleep(3000);
    
    // Take screenshot
    const screenshot = await Page.captureScreenshot();
    const fs = require('fs');
    fs.writeFileSync('wallet-page-initial.png', Buffer.from(screenshot.data, 'base64'));
    console.log('Screenshot saved: wallet-page-initial.png');
    
    // Check console for errors
    console.log('\n=== Checking Console Logs ===');
    const consoleLogs = await Runtime.evaluate({
      expression: `
        (function() {
          const logs = [];
          const originalLog = console.log;
          const originalError = console.error;
          return 'Console captured';
        })()
      `
    });
    console.log('Console:', consoleLogs.result?.value);
    
    // Check wallet address
    const walletCheck = await Runtime.evaluate({
      expression: `
        (function() {
          const urlParams = new URLSearchParams(window.location.search);
          const address = urlParams.get('address');
          return {
            urlAddress: address,
            localStorageAddress: localStorage.getItem('testWalletAddress')
          };
        })()
      `
    });
    console.log('\n=== Wallet Address Check ===');
    console.log(JSON.stringify(walletCheck.result.value, null, 2));
    
    // Check balance display
    const balanceCheck = await Runtime.evaluate({
      expression: `
        (function() {
          const balanceEl = document.querySelector('[data-testid="chip-balance"]');
          const walletCard = document.querySelector('[data-testid="wallet-card"]');
          const connectPrompt = document.querySelector('[data-testid="connect-wallet-prompt"]');
          const loadingEl = document.querySelector('[data-testid="loading"]');
          
          return {
            balanceText: balanceEl ? balanceEl.textContent : null,
            walletCardExists: !!walletCard,
            showConnectPrompt: !!connectPrompt,
            isLoading: !!loadingEl,
            walletCardHTML: walletCard ? walletCard.innerHTML.substring(0, 500) : null
          };
        })()
      `
    });
    console.log('\n=== Balance Display Check ===');
    console.log(JSON.stringify(balanceCheck.result.value, null, 2));
    
    // Check buttons
    const buttonsCheck = await Runtime.evaluate({
      expression: `
        (function() {
          const transferBtn = document.querySelector('[data-testid="transfer-btn"]');
          const historyBtn = document.querySelector('[data-testid="history-btn"]');
          
          return {
            transferBtnExists: !!transferBtn,
            transferBtnText: transferBtn ? transferBtn.textContent : null,
            transferBtnOnClick: transferBtn ? (typeof transferBtn.onclick) : null,
            historyBtnExists: !!historyBtn,
            historyBtnText: historyBtn ? historyBtn.textContent : null,
            historyBtnOnClick: historyBtn ? (typeof historyBtn.onclick) : null
          };
        })()
      `
    });
    console.log('\n=== Buttons Check ===');
    console.log(JSON.stringify(buttonsCheck.result.value, null, 2));
    
    // Click History button
    console.log('\n=== Clicking History Button ===');
    await Runtime.evaluate({
      expression: `
        (function() {
          const historyBtn = document.querySelector('[data-testid="history-btn"]');
          if (historyBtn) {
            historyBtn.click();
            return 'Clicked history button';
          }
          return 'History button not found';
        })()
      `
    });
    await sleep(2000);
    
    // Take screenshot after history click
    const screenshot2 = await Page.captureScreenshot();
    fs.writeFileSync('wallet-page-history.png', Buffer.from(screenshot2.data, 'base64'));
    console.log('Screenshot saved: wallet-page-history.png');
    
    // Check history tab content
    const historyCheck = await Runtime.evaluate({
      expression: `
        (function() {
          const historyTab = document.querySelector('[data-testid="history-tab"]');
          const transactions = document.querySelectorAll('[data-testid="transaction-item"]');
          const tabButtons = document.querySelectorAll('button');
          let activeTab = null;
          
          tabButtons.forEach(btn => {
            if (btn.textContent.includes('History') && btn.style.background) {
              activeTab = 'History tab appears active';
            }
          });
          
          return {
            activeTab: activeTab,
            transactionCount: transactions.length,
            pageHTML: document.body.innerHTML.substring(0, 1000)
          };
        })()
      `
    });
    console.log('\n=== History Tab Check ===');
    console.log(JSON.stringify(historyCheck.result.value, null, 2));
    
    // Click Transfer button
    console.log('\n=== Clicking Transfer Button ===');
    await Runtime.evaluate({
      expression: `
        (function() {
          // First go back to wallet tab
          const balanceTab = document.querySelector('button');
          if (balanceTab && balanceTab.textContent.includes('Balance')) {
            balanceTab.click();
          }
          return 'Clicked back to balance';
        })()
      `
    });
    await sleep(1000);
    
    await Runtime.evaluate({
      expression: `
        (function() {
          const transferBtn = document.querySelector('[data-testid="transfer-btn"]');
          if (transferBtn) {
            transferBtn.click();
            return 'Clicked transfer button';
          }
          return 'Transfer button not found';
        })()
      `
    });
    await sleep(2000);
    
    // Take screenshot after transfer click
    const screenshot3 = await Page.captureScreenshot();
    fs.writeFileSync('wallet-page-transfer.png', Buffer.from(screenshot3.data, 'base64'));
    console.log('Screenshot saved: wallet-page-transfer.png');
    
    // Check for transfer modal
    const transferModalCheck = await Runtime.evaluate({
      expression: `
        (function() {
          const modal = document.querySelector('h3');
          const inputFields = document.querySelectorAll('input');
          const confirmBtn = document.querySelector('button');
          
          return {
            modalTitle: modal ? modal.textContent : null,
            inputCount: inputFields.length,
            confirmButtonText: confirmBtn ? confirmBtn.textContent : null,
            modalHTML: modal ? modal.parentElement.innerHTML.substring(0, 500) : null
          };
        })()
      `
    });
    console.log('\n=== Transfer Modal Check ===');
    console.log(JSON.stringify(transferModalCheck.result.value, null, 2));
    
    console.log('\n=== Test Complete ===');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testWalletPage();
