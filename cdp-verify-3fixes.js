const CDP = require('chrome-remote-interface');

async function verify() {
  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Page, Runtime, Network, DOM } = client;
    await Promise.all([Page.enable(), Runtime.enable(), Network.enable(), DOM.enable()]);

    // Navigate to Landing page first to check image and navbar
    await Page.navigate({ url: 'http://43.163.114.175:3001/' });
    await new Promise(r => setTimeout(r, 5000));

    const ss1 = '/tmp/cdp-fix3-landing.png';
    await Page.captureScreenshot({ format: 'png', fromSurface: true })
      .then(({ data }) => require('fs').writeFileSync(ss1, data, 'base64'));
    console.log('Landing screenshot saved: ' + ss1);

    // Check navbar for chipsAmount (should NOT exist)
    const navCheck = await Runtime.evaluate({
      expression: `
        (() => {
          const navChips = document.querySelector('[name="chipsAmount"]');
          const chipIcons = document.querySelectorAll('svg, [class*="chip"], [class*="Chip"]');
          const navRight = document.querySelector('nav')?.innerHTML?.includes('TRX');
          return {
            hasChipsInput: !!navChips,
            chipIconCount: chipIcons.length,
            hasTRXInNav: navRight,
            navHTML: document.querySelector('nav')?.innerText?.substring(0, 200) || ''
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Navbar check:', JSON.stringify(navCheck.result.value, null, 2));

    // Check if image loaded
    const imgCheck = await Runtime.evaluate({
      expression: `
        (() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          const pokerImg = imgs.find(img => img.alt && img.alt.includes('Vintage'));
          return {
            allImages: imgs.map(i => ({ src: i.src.substring(0, 80), alt: i.alt, naturalWidth: i.naturalWidth, complete: i.complete })),
            pokerImgFound: !!pokerImg,
            pokerImgSrc: pokerImg ? pokerImg.src : null,
            pokerImgNaturalWidth: pokerImg ? pokerImg.naturalWidth : null
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Image check:', JSON.stringify(imgCheck.result.value, null, 2));

    // Navigate to wallet page and test Deposit CHIP
    await Page.navigate({ url: 'http://43.163.114.175:3001/wallet' });
    await new Promise(r => setTimeout(r, 6000));

    const ss2 = '/tmp/cdp-fix3-wallet.png';
    await Page.captureScreenshot({ format: 'png', fromSurface: true })
      .then(({ data }) => require('fs').writeFileSync(ss2, data, 'base64'));
    console.log('Wallet screenshot saved: ' + ss2);

    // Test the deposit-to-game API directly from the browser
    const apiTest = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const res = await fetch('/api/chip/deposit-to-game', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ walletAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv', amount: 1 })
            });
            const contentType = res.headers.get('content-type');
            const text = await res.text();
            let json;
            try { json = JSON.parse(text); } catch(e) { json = null; }
            return { status: res.status, contentType, isJSON: !!json, bodyPreview: text.substring(0, 200), json: json };
          } catch(e) { return { error: e.message }; }
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Deposit API test:', JSON.stringify(apiTest.result.value, null, 2));

    // Also check what /api/chip/balance returns
    const balanceTest = await Runtime.evaluate({
      expression: `
        (async () => {
          try {
            const res = await fetch('/api/chip/balance/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
            const ct = res.headers.get('content-type');
            const text = await res.text();
            return { status: res.status, contentType: ct, body: text.substring(0, 300) };
          } catch(e) { return { error: e.message }; }
        })()
      `,
      returnByValue: true,
      awaitPromise: true
    });
    console.log('Balance API test:', JSON.stringify(balanceTest.result.value, null, 2));

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    if(client) await client.close();
  }
}
verify().catch(console.error);
