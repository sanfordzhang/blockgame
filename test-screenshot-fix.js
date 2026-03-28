const CDP = require('chrome-remote-interface');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function main() {
    console.log('=== NFT Screenshot Test ===');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Step 1: Navigate to NFT gallery first to check existing NFTs
    console.log('\n1. Checking NFT gallery...');
    await Page.navigate({ url: `http://127.0.0.1:3001/nft?address=${PLAYER1_ADDRESS}` });
    await new Promise(r => setTimeout(r, 3000));
    
    const galleryResult = await Runtime.evaluate({
        expression: `(function() {
            const images = document.querySelectorAll('img[src^="data:image"]');
            const cards = document.querySelectorAll('[class*="CollectionCard"], [class*="sc-"]');
            return {
                screenshotCount: images.length,
                cardCount: cards.length,
                pageText: document.body.innerText.substring(0, 500)
            };
        })()`
    });
    console.log('Gallery state:', JSON.stringify(galleryResult.result.value, null, 2));
    
    // Step 2: Navigate to tournament to trigger a game
    console.log('\n2. Navigating to tournament...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Check for join buttons
    const tournamentResult = await Runtime.evaluate({
        expression: `(function() {
            const buttons = Array.from(document.querySelectorAll('button'));
            const joinButtons = buttons.filter(b => b.innerText.toLowerCase().includes('join'));
            return {
                joinButtonCount: joinButtons.length,
                pageText: document.body.innerText.substring(0, 300)
            };
        })()`
    });
    console.log('Tournament state:', JSON.stringify(tournamentResult.result.value, null, 2));
    
    // Step 3: Take screenshot of current page
    console.log('\n3. Taking screenshot...');
    const { data: screenshot } = await Page.captureScreenshot();
    const fs = require('fs');
    fs.writeFileSync('test-results/screenshot-fix-test.png', Buffer.from(screenshot, 'base64'));
    console.log('Screenshot saved to test-results/screenshot-fix-test.png');
    
    await client.close();
    console.log('\n=== Test Complete ===');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
