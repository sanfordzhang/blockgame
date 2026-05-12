const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Page, Runtime, Network, Console } = client;

    // Collect console logs
    const logs = [];
    Console.messageAdded(({ message }) => {
      if (message.source === 'console-api' || message.source === 'network') {
        const txt = message.text || JSON.stringify(message);
        if (txt.includes('DAO') || txt.includes('chip') || txt.includes('balance') || txt.includes('error') || txt.includes('Error') || txt.includes('fail')) {
          console.log(`[LOG] ${txt}`);
          logs.push(txt);
        }
      }
    });

    await Page.enable();
    await Network.enable();
    await Console.enable();
    await Runtime.enable();

    // Navigate to DAO page
    console.log('[STEP] Navigating to /dao ...');
    await Page.navigate({ url: 'http://43.163.114.175:3001/dao' });
    await new Promise(r => setTimeout(r, 8000));

    // Check page content - what's actually displayed?
    const result = await Runtime.evaluate({
      expression: `
        (function() {
          // Get all text content from the balance area
          const allText = document.body.innerText;
          
          // Find CHIP Balance display
          const chipElements = Array.from(document.querySelectorAll('*')).filter(el => el.textContent.includes('CHIP'));
          const chipDisplay = chipElements.map(el => ({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 100),
            className: el.className
          })).filter(e => e.text.length > 5 && e.text.length < 100);

          // Check for specific balance elements
          const boldTexts = Array.from(document.querySelectorAll('b, strong, [style*="font-weight"]'))
            .map(el => el.textContent.trim())
            .filter(t => t.includes('CHIP') || t.match(/^\\d/) || t === '0');
          
          return {
            hasWallet: !!window.tronWeb?.defaultAddress,
            tronLink: window.tronLink ? 'present' : 'missing',
            chipDisplay: chipDisplay.slice(0, 10),
            boldTexts: boldTexts.slice(0, 15),
            pageHasChipBalance: allText.includes('CHIP Balance'),
            allBalanceTexts: allText.match(/\\d+\\.?\\d*\\s*CHIP/g) || []
          };
        })()
      `,
      returnByValue: true
    });

    console.log('\\n=== PAGE CONTENT ===');
    console.log(JSON.stringify(result.result, null, 2));

    // Try calling the API directly from the browser
    const apiResult = await Runtime.evaluate({
      expression: `
        (async function() {
          try {
            const addr = window.tronWeb ? window.tronWeb.defaultAddress.base58 : null;
            if (!addr) return { error: 'No wallet address', addr };
            
            // Call the same API as Wallet page
            const res = await fetch('/api/chip/balance/' + addr);
            const data = await res.json();
            return { walletAddress: addr, apiResponse: data };
          } catch(e) {
            return { error: e.message };
          }
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });

    console.log('\\n=== API CALL RESULT ===');
    console.log(JSON.stringify(apiResult.result, null, 2));

    // Screenshot
    const screenshot = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('/tmp/dao-debug.png', Buffer.from(screenshot.data, 'base64'));
    console.log('\\n[Screenshot saved to /tmp/dao-debug.png]');

    // Wait more for lazy load
    console.log('\\n[Waiting 5 more seconds for data...]');
    await new Promise(r => setTimeout(r, 5000));
    
    const finalResult = await Runtime.evaluate({
      expression: `
        (function() {
          const boldTexts = Array.from(document.querySelectorAll('b, strong, [style*="font-weight"], [style*="bold"]'))
            .map(el => el.textContent.trim())
            .filter(t => t.match(/CHIP|\\d+/) && t.length < 50);
          return { finalBoldTexts: boldTexts.slice(0, 20) };
        })()
      `,
      returnByValue: true
    });
    console.log('\\n=== FINAL STATE (T+13s) ===');
    console.log(JSON.stringify(finalResult.result, null, 2));

    const ss2 = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('/tmp/dao-debug-final.png', Buffer.from(ss2.data, 'base64'));
    console.log('[Final screenshot saved to /tmp/dao-debug-final.png]');

  } catch (e) {
    console.error('CDP Error:', e.message);
  } finally {
    if (client) await client.close();
  }
})();
