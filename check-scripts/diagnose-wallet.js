const CDP = require('chrome-remote-interface');

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Network } = client;
    
    await Network.enable();
    console.log('Connecting to Chrome CDP...\n');
    
    // Navigate to wallet page
    await Page.navigate({ url: 'http://127.0.0.1:3000/wallet?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' });
    await Page.loadEventFired();
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Check what API returns from browser's perspective
    const apiResult = await Runtime.evaluate({
        expression: `
            (async () => {
                const res = await fetch('/api/chip/balance/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
                return await res.json();
            })()
        `,
        awaitPromise: true
    });
    
    console.log('API result from browser:', apiResult.result.value);
    
    // Click Staking tab
    await Runtime.evaluate({
        expression: `
            const tabs = document.querySelectorAll('button');
            for (const tab of tabs) {
                if (tab.textContent === 'Staking') {
                    tab.click();
                    break;
                }
            }
        `
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Get staked display
    const stakedDisplay = await Runtime.evaluate({
        expression: `
            const el = document.querySelector('[data-testid="staked-amount"]');
            el ? el.textContent : 'not found'
        `
    });
    
    console.log('\nStaked display:', stakedDisplay.result.value);
    
    // Take screenshot
    await Page.captureScreenshot({ format: 'png' }).then(ret => {
        require('fs').writeFileSync('wallet-diagnose.png', Buffer.from(ret.data, 'base64'));
        console.log('\nScreenshot saved: wallet-diagnose.png');
    });
    
    await client.close();
}

test().catch(console.error);
