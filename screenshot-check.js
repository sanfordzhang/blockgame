const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    // Screenshot
    const ss = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/fix-wallet-clean.png', Buffer.from(ss.data, 'base64'));
    
    // Get buttons
    const btns = await Runtime.evaluate({
        expression: `(function() {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map(b => b.textContent.trim()).filter(t => t);
})()`,
        returnByValue: true
    });
    console.log('Buttons on page:', JSON.stringify(btns.result.value));
    console.log('Screenshot saved to screenshots/fix-wallet-clean.png');
    await client.close();
})();
