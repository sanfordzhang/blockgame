const CDP = require('chrome-remote-interface');

async function test() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    console.log('Connecting to Chrome CDP...');
    
    // Navigate to wallet page
    await Page.navigate({ url: 'http://127.0.0.1:3000/wallet?address=TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' });
    await Page.loadEventFired();
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Click on Collection tab
    console.log('Clicking Collection tab...');
    await Runtime.evaluate({
        expression: `
            const tabs = document.querySelectorAll('button');
            for (const tab of tabs) {
                if (tab.textContent === 'Collection') {
                    tab.click();
                    break;
                }
            }
        `
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Get NFT count
    const result = await Runtime.evaluate({
        expression: `
            const bodyText = document.body.innerText;
            const nftMatch = bodyText.match(/(\\d+)\\s*Items/);
            nftMatch ? nftMatch[1] + ' NFTs' : 'not found'
        `
    });
    
    console.log('NFT count:', result.result.value);
    
    // Get full page text
    const fullText = await Runtime.evaluate({
        expression: `document.body.innerText.substring(0, 1500)`
    });
    
    console.log('\n=== Page Content ===\n', fullText.result.value);
    
    // Take screenshot
    await Page.captureScreenshot({ format: 'png' }).then(ret => {
        require('fs').writeFileSync('nft-collection.png', Buffer.from(ret.data, 'base64'));
        console.log('\nScreenshot saved: nft-collection.png');
    });
    
    await client.close();
}

test().catch(console.error);
