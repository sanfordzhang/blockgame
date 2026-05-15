/**
 * Click 0G/EVM button and verify the address returned is the real MetaMask address
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    console.log('=== Before click ===');
    const before = await Runtime.evaluate({
        expression: `(function() {
    return {
        hasEthereum: !!window.ethereum,
        isMetaMask: window.ethereum?.isMetaMask,
        selectedAddress: window.ethereum?.selectedAddress || 'none',
        chainId: window.ethereum?.chainId || 'none'
    };
})()`,
        returnByValue: true
    });
    console.log(JSON.stringify(before.result.value, null, 2));

    // Click the "0G / EVM" button
    console.log('\n=== Clicking 0G / EVM button ===');
    await Runtime.evaluate({
        expression: `(function() {
    const btns = Array.from(document.querySelectorAll('button'));
    const ogBtn = btns.find(b => b.textContent.includes('0G'));
    if (ogBtn) {
        ogBtn.click();
        return 'Clicked 0G / EVM button';
    }
    return 'Button not found';
})()`,
        returnByValue: true
    });

    // Wait for any wallet popup / async operations
    await new Promise(r => setTimeout(r, 3000));

    // Screenshot after click
    const ss = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/fix-after-click-0g.png', Buffer.from(ss.data, 'base64'));

    // Check state after click
    console.log('\n=== After click (3s later) ===');
    const after = await Runtime.evaluate({
        expression: `(function() {
    return {
        hasEthereum: !!window.ethereum,
        isMetaMask: window.ethereum?.isMetaMask,
        selectedAddress: window.ethereum?.selectedAddress || 'none',
        chainId: window.ethereum?.chainId || 'none',
        localStorage_type: localStorage.getItem('wallet_type'),
        localStorage_addr: localStorage.getItem('wallet_address'),
        // Check if page shows a wallet address
        pageText: document.body.innerText.substring(0, 800)
    };
})()`,
        returnByValue: true
    });
    console.log(JSON.stringify(after.result.value, null, 2));
    console.log('\nScreenshot: screenshots/fix-after-click-0g.png');
    
    await client.close();
})();
