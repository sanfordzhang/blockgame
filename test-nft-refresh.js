const CDP = require('chrome-remote-interface');

async function main() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Navigate to NFT gallery directly
    console.log('Navigating to NFT gallery directly...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if NFTs are displayed
    const result = await Runtime.evaluate({
        expression: `
            (function() {
                const cards = document.querySelectorAll('[class*="NFTCard"], [class*="nft-card"]');
                const text = document.body.innerText;
                return {
                    cardCount: cards.length,
                    hasConnectWallet: text.includes('Connect') || text.includes('connect'),
                    hasNFTContent: text.includes('Straight') || text.includes('NFT'),
                    hasLoading: text.includes('Loading'),
                    bodyPreview: text.substring(0, 500)
                };
            })()
        `
    });
    
    console.log('Page state:', JSON.stringify(result.result.value, null, 2));
    
    // Check localStorage for wallet address
    const storage = await Runtime.evaluate({
        expression: `localStorage.getItem('testWalletAddress')`
    });
    console.log('Stored wallet:', storage.result.value);
    
    await client.close();
}

main().catch(console.error);
