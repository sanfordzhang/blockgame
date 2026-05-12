const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    // Check current state
    const state = await Runtime.evaluate({
        expression: `(function() {
    return {
        address: window.ethereum?.selectedAddress,
        chainId: window.ethereum?.chainId,
        isMetaMask: window.ethereum?.isMetaMask
    };
})()`,
        returnByValue: true
    });
    console.log('Current wallet:', JSON.stringify(state.result.value));

    // Screenshot
    const ss = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/fix-injected-verify.png', Buffer.from(ss.data, 'base64'));

    // If address looks good, click 0G button
    if (state.result.value.address && state.result.value.address.startsWith('0x8808')) {
        console.log('\n✅ Real address detected! Clicking 0G / EVM...');
        
        await Runtime.evaluate({
            expression: `(function() {
                var btns = Array.from(document.querySelectorAll('button'));
                var btn = btns.find(function(b) { return b.textContent.indexOf('0G') !== -1; });
                if (btn) { btn.click(); return 'clicked'; }
                return 'not found';
            })()`,
            returnByValue: true
        });

        await new Promise(r => setTimeout(r, 4000));
        
        const ss2 = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('screenshots/fix-after-real-connect.png', Buffer.from(ss2.data, 'base64'));
        
        const after = await Runtime.evaluate({
            expression: `(function() {
    return {
        type: localStorage.getItem('wallet_type'),
        addr: localStorage.getItem('wallet_address'),
        text: document.body.innerText.substring(0, 800)
    };
})()`,
            returnByValue: true
        });
        
        console.log('\nAfter connect:');
        console.log('  Type:', after.result.value.type);
        console.log('  Addr:', after.result.value.addr);
        console.log('  Text:', after.result.value.text.substring(0, 400));
        console.log('\nScreenshot: screenshots/fix-after-real-connect.png');
    } else {
        console.log('\n❌ Wrong address. Need to re-inject.');
        console.log('Screenshot: screenshots/fix-injected-verify.png');
    }
    
    await client.close();
})();
