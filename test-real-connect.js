const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function run() {
    // Step 1: Navigate first
    console.log('=== Step 1: Navigate ===');
    let client = await CDP({ port: 9222 });
    let { Page } = client;
    await Page.enable();
    await Page.navigate({ url: 'http://127.0.0.1:3001/' });
    await client.close();
    
    // Wait for page load
    await new Promise(r => setTimeout(r, 3500));

    // Step 2: Reconnect and interact
    console.log('=== Step 2: Reconnect + Click ===');
    client = await CDP({ port: 9222 });
    const { Page: P2, Runtime } = client;
    await P2.enable();
    await Runtime.enable();

    const before = await Runtime.evaluate({
        expression: `(function() {
    return { address: window.ethereum?.selectedAddress, chainId: window.ethereum?.chainId };
})()`,
        returnByValue: true
    });
    console.log('Before:', JSON.stringify(before.result.value));

    // Click 0G button
    await Runtime.evaluate({
        expression: `(function() {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('0G'));
    if (btn) { btn.click(); return 'clicked'; }
    return 'not found';
})()`,
        returnByValue: true
    });

    await new Promise(r => setTimeout(r, 4000));

    // Screenshot
    const ss = await P2.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/fix-connected-real.png', Buffer.from(ss.data, 'base64'));

    const after = await Runtime.evaluate({
        expression: `(function() {
    return {
        wallet_type: localStorage.getItem('wallet_type'),
        wallet_address: localStorage.getItem('wallet_address'),
        text: document.body.innerText.substring(0, 800)
    };
})()`,
        returnByValue: true
    });
    console.log('\nResult:');
    console.log('  type:', after.result.value.wallet_type);
    console.log('  addr:', after.result.value.wallet_address);
    console.log('  text:', after.result.value.text.substring(0, 300));
    console.log('\nScreenshot saved: screenshots/fix-connected-real.png');
    
    await client.close();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
