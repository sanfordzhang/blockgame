const CDP = require('chrome-remote-interface');

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    // Navigate to wallet page with staking tab
    await Page.navigate({ url: 'http://127.0.0.1:3000/wallet?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv&tab=staking' });
    await Page.loadEventFired();
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Get full page text
    const result = await Runtime.evaluate({
        expression: `document.body.innerText`
    });
    
    console.log('Full page text:\n', result.result.value);
    
    // Check if staked amount is in the page
    const stakedMatch = result.result.value.match(/Staked[\s\S]*?(\d[\d,]*)\s*CHIP/i);
    console.log('\nStaked match:', stakedMatch);
    
    await client.close();
}

test().catch(console.error);
