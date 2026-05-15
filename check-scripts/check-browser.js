const CDP = require('chrome-remote-interface');

(async () => {
    try {
        const client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();
        
        console.log('Navigating to http://127.0.0.1:3001/ ...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/' });
        await new Promise(r => setTimeout(r, 6000));
        
        const title = await Runtime.evaluate({ expression: 'document.title' });
        console.log('Page title:', title.result.value);
        
        const root = await Runtime.evaluate({ expression: 'document.querySelector("#root") ? "React root OK" : "No root"' });
        console.log(root.result.value);
        
        // Check for 0G button
        const btns = await Runtime.evaluate({
            expression: `Array.from(document.querySelectorAll('button')).map(b=>b.textContent).filter(t=>t.includes('0G')||t.includes('MetaMask')).join(', ') || 'No wallet buttons found'`
        });
        console.log('Wallet buttons:', btns.result.value);
        
        // Check for JS errors on page
        const bodyText = await Runtime.evaluate({
            expression: 'document.body.innerText.substring(0, 500)'
        });
        console.log('\\nPage content preview:', bodyText.result.value.substring(0, 200));
        
        // Take screenshot via CDP
        const screenshot = await Page.captureScreenshot({ format: 'png' });
        require('fs').writeFileSync('/Users/yingfengzhang/1JackSource/blockchain/game-core/screenshots/verify-landing.png', Buffer.from(screenshot.data, 'base64'));
        console.log('\\nScreenshot saved: screenshots/verify-landing.png');
        
        await client.close();
        console.log('\\n=== Browser verification complete ===');
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
