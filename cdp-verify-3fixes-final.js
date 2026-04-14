const CDP = require('chrome-remote-interface');

async function verify() {
  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Promise.all([Page.enable(), Runtime.enable()]);

    // Test deposit-to-game API directly from browser
    console.log('Testing deposit API after server restart...');
    
    await Page.navigate({ url: 'http://43.163.114.175:3001/wallet' });
    await new Promise(r => setTimeout(r, 5000));

    const apiTest = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            // Test POST /api/chip/deposit-to-game
            const res = await fetch('/api/chip/deposit-to-game', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv', amount: 1 })
            });
            const contentType = res.headers.get('content-type');
            const text = await res.text();
            let json;
            try { json = JSON.parse(text); } catch(e) { json = null; }
            
            return { 
              status: res.status, 
              contentType, 
              isJSON: !!json, 
              bodyPreview: text.substring(0, 200), 
              success: json?.success,
              error: json?.error || null,
              deposited: json?.deposited || null
            };
          } catch(e) { return { error: e.message }; }
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Deposit API result:', JSON.stringify(apiTest.result.value, null, 2));

    // Take wallet screenshot
    const ss1 = '/tmp/cdp-fix3-wallet-after.png';
    await Page.captureScreenshot({ format: 'png', fromSurface: true })
      .then(({ data }) => require('fs').writeFileSync(ss1, data, 'base64'));
    console.log('Wallet screenshot saved:', ss1);

    // Also test Landing page image
    await Page.navigate({ url: 'http://43.163.114.175:3001/' });
    await new Promise(r => setTimeout(r, 4000));
    
    const ss2 = '/tmp/cdp-fix3-landing-after.png';
    await Page.captureScreenshot({ format: 'png', fromSurface: true })
      .then(({ data }) => require('fs').writeFileSync(ss2, data, 'base64'));
    console.log('Landing screenshot saved:', ss2);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    if(client) await client.close();
  }
}
verify().catch(console.error);
