const CDP = require('chrome-remote-interface');

const WALLET_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const WALLET_URL = `http://127.0.0.1:3000/wallet?address=${WALLET_ADDRESS}`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWalletPage() {
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
    await sleep(5000);  // Wait longer for React to render
    
    // Check page content
    const pageContent = await Runtime.evaluate({
      expression: `document.body.innerText`,
      returnByValue: true
    });
    console.log('\n=== Page Content ===');
    console.log(pageContent.result.value);
    
    // Check if React app loaded
    const reactCheck = await Runtime.evaluate({
      expression: `document.getElementById('root') ? document.getElementById('root').innerHTML.length : 0`,
      returnByValue: true
    });
    console.log('\n=== React Root Size ===');
    console.log('Root innerHTML length:', reactCheck.result.value);
    
    // Get all h1/h2/h3 headings
    const headings = await Runtime.evaluate({
      expression: `
        Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent).join(' | ')
      `,
      returnByValue: true
    });
    console.log('\n=== Page Headings ===');
    console.log(headings.result.value);
    
    // Get all buttons
    const buttons = await Runtime.evaluate({
      expression: `
        Array.from(document.querySelectorAll('button')).map(b => b.textContent).join(' | ')
      `,
      returnByValue: true
    });
    console.log('\n=== Page Buttons ===');
    console.log(buttons.result.value);
    
    // Check balance specifically
    const balance = await Runtime.evaluate({
      expression: `
        (function() {
          const el = document.querySelector('[data-testid="chip-balance"]');
          return el ? el.textContent : 'BALANCE NOT FOUND';
        })()
      `,
      returnByValue: true
    });
    console.log('\n=== CHIP Balance ===');
    console.log(balance.result.value);
    
    // Check wallet address in URL
    const urlCheck = await Runtime.evaluate({
      expression: `window.location.href`,
      returnByValue: true
    });
    console.log('\n=== Current URL ===');
    console.log(urlCheck.result.value);
    
    // Check for any error messages
    const errors = await Runtime.evaluate({
      expression: `
        (function() {
          const errorEls = document.querySelectorAll('[class*="error"], [class*="Error"]');
          return Array.from(errorEls).map(e => e.textContent).join(' | ');
        })()
      `,
      returnByValue: true
    });
    console.log('\n=== Error Messages ===');
    console.log(errors.result.value || 'No errors found');
    
    // Take final screenshot
    const screenshot = await Page.captureScreenshot();
    const fs = require('fs');
    fs.writeFileSync('wallet-page-final.png', Buffer.from(screenshot.data, 'base64'));
    console.log('\nScreenshot saved: wallet-page-final.png');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

testWalletPage();
