const CDP = require('chrome-remote-interface');

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    console.log('Connecting to Chrome CDP...');
    
    // Navigate to wallet page
    await Page.navigate({ url: 'http://127.0.0.1:3000/wallet?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' });
    await Page.loadEventFired();
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Click on Staking tab
    console.log('Clicking Staking tab...');
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
    
    // Get staked amount
    const result = await Runtime.evaluate({
        expression: `
            const stakedEl = document.querySelector('[data-testid="staked-amount"]');
            stakedEl ? stakedEl.textContent : 'not found';
        `
    });
    
    console.log('Staked amount:', result.result.value);
    
    // Get full text for debugging
    const fullText = await Runtime.evaluate({
        expression: `document.body.innerText`
    });
    
    console.log('\n=== Page Content (first 800 chars) ===\n', fullText.result.value.substring(0, 800));
    
    // Take screenshot
    await Page.captureScreenshot({ format: 'png' }).then(ret => {
        require('fs').writeFileSync('staking-page.png', Buffer.from(ret.data, 'base64'));
        console.log('\nScreenshot saved: staking-page.png');
    });
    
    await client.close();
}

test().catch(console.error);
