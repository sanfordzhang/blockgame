const CDP = require('chrome-remote-interface');

const WALLET_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const WALLET_URL = `http://127.0.0.1:3000/wallet?address=${WALLET_ADDRESS}`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWalletButtons() {
  let client;
  try {
    console.log('Connecting to Chrome CDP...');
    client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    console.log(`Navigating to: ${WALLET_URL}`);
    await Page.navigate({ url: WALLET_URL });
    await Page.loadEventFired();
    await sleep(3000);
    
    const fs = require('fs');
    
    // Test History button
    console.log('\n=== Test 1: Clicking History Button ===');
    await Runtime.evaluate({
      expression: `document.querySelector('[data-testid="history-btn"]').click()`,
      returnByValue: true
    });
    await sleep(2000);
    
    let screenshot = await Page.captureScreenshot();
    fs.writeFileSync('wallet-history-click.png', Buffer.from(screenshot.data, 'base64'));
    
    const historyContent = await Runtime.evaluate({
      expression: `
        (function() {
          const activeTab = document.querySelector('button[style*="background"]');
          const historyHeading = document.querySelector('h3');
          const transactionItems = document.querySelectorAll('[data-testid="transaction-item"], [class*="StakingCard"]');
          return {
            activeTabText: activeTab ? activeTab.textContent : 'none',
            historyHeading: historyHeading ? historyHeading.textContent : 'none',
            transactionCount: transactionItems.length
          };
        })()
      `,
      returnByValue: true
    });
    console.log('History tab result:', JSON.stringify(historyContent.result.value, null, 2));
    
    // Check if History tab content is visible
    const historyPageContent = await Runtime.evaluate({
      expression: `document.body.innerText`,
      returnByValue: true
    });
    console.log('\n=== History Page Content ===');
    console.log(historyPageContent.result.value);
    
    // Go back to Balance tab
    console.log('\n=== Going back to Balance tab ===');
    await Runtime.evaluate({
      expression: `document.querySelectorAll('button')[0].click()`,
      returnByValue: true
    });
    await sleep(1000);
    
    // Test Transfer button
    console.log('\n=== Test 2: Clicking Transfer Button ===');
    await Runtime.evaluate({
      expression: `document.querySelector('[data-testid="transfer-btn"]').click()`,
      returnByValue: true
    });
    await sleep(2000);
    
    screenshot = await Page.captureScreenshot();
    fs.writeFileSync('wallet-transfer-click.png', Buffer.from(screenshot.data, 'base64'));
    
    const transferModal = await Runtime.evaluate({
      expression: `
        (function() {
          const modalTitle = document.querySelector('h3');
          const inputs = document.querySelectorAll('input');
          const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent);
          
          return {
            modalVisible: !!modalTitle,
            modalTitle: modalTitle ? modalTitle.textContent : null,
            inputCount: inputs.length,
            inputPlaceholders: Array.from(inputs).map(i => i.placeholder),
            buttons: buttons
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Transfer modal result:', JSON.stringify(transferModal.result.value, null, 2));
    
    // Test filling transfer form
    console.log('\n=== Test 3: Filling Transfer Form ===');
    await Runtime.evaluate({
      expression: `
        (function() {
          const inputs = document.querySelectorAll('input');
          if (inputs.length >= 2) {
            inputs[0].value = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
            inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            inputs[1].value = '100';
            inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
            return 'Form filled with test data';
          }
          return 'Inputs not found';
        })()
      `,
      returnByValue: true
    });
    await sleep(1000);
    
    screenshot = await Page.captureScreenshot();
    fs.writeFileSync('wallet-transfer-filled.png', Buffer.from(screenshot.data, 'base64'));
    
    const filledForm = await Runtime.evaluate({
      expression: `
        (function() {
          const inputs = document.querySelectorAll('input');
          return {
            recipientValue: inputs[0] ? inputs[0].value : null,
            amountValue: inputs[1] ? inputs[1].value : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Filled form:', JSON.stringify(filledForm.result.value, null, 2));
    
    // Cancel transfer
    console.log('\n=== Cancelling Transfer ===');
    await Runtime.evaluate({
      expression: `
        (function() {
          const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
          if (cancelBtn) {
            cancelBtn.click();
            return 'Clicked Cancel';
          }
          return 'Cancel button not found';
        })()
      `,
      returnByValue: true
    });
    await sleep(1000);
    
    screenshot = await Page.captureScreenshot();
    fs.writeFileSync('wallet-after-cancel.png', Buffer.from(screenshot.data, 'base64'));
    
    const finalState = await Runtime.evaluate({
      expression: `
        (function() {
          const balanceEl = document.querySelector('[data-testid="chip-balance"]');
          return {
            balanceVisible: !!balanceEl,
            balanceText: balanceEl ? balanceEl.textContent : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Final state:', JSON.stringify(finalState.result.value, null, 2));
    
    console.log('\n=== Test Complete ===');
    console.log('Screenshots saved:');
    console.log('- wallet-history-click.png');
    console.log('- wallet-transfer-click.png');
    console.log('- wallet-transfer-filled.png');
    console.log('- wallet-after-cancel.png');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testWalletButtons();
