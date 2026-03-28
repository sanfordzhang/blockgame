const CDP = require('chrome-remote-interface');

async function main() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Navigate to NFT gallery
    console.log('Navigating to NFT gallery...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if screenshot image is displayed
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                const images = document.querySelectorAll('img[src^="data:image"]');
                const cards = document.querySelectorAll('[class*="CollectionCard"], [class*="Screenshot"]');
                const text = document.body.innerText;
                return {
                    imageDataUrls: images.length,
                    collectionCards: cards.length,
                    hasScreenshot: images.length > 0,
                    hasNFTContent: text.includes('STRAIGHT') || text.includes('Straight'),
                    totalNFTs: (text.match(/My Collection/g) || []).length
                };
            })()
        `
    });
    
    console.log('Page state:', JSON.stringify(result.result.value, null, 2));
    
    await client.close();
}

main().catch(console.error);
