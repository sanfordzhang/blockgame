const CDP = require('chrome-remote-interface');

async function main() {
    try {
        const client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        await Page.enable();
        await Runtime.enable();
        
        // Navigate to NFT gallery
        console.log('Navigating to NFT gallery...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
        await new Promise(r => setTimeout(r, 4000));
        
        // Check screenshot images
        const result = await Runtime.evaluate({
            expression: `(function() {
                const images = document.querySelectorAll('img[src^="data:image"]');
                return {
                    screenshotCount: images.length,
                    hasImages: images.length > 0
                };
            })()`
        });
        
        console.log('Result:', JSON.stringify(result.result.value, null, 2));
        
        await client.close();
        console.log('Test completed!');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
