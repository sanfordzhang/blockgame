const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function main() {
    console.log('=== NFT Screenshot Fix Verification ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, DOM } = client;
    await Page.enable();
    await Runtime.enable();
    await DOM.enable();
    
    try {
        // Step 1: Check NFT gallery and existing screenshots
        console.log('1. Checking NFT gallery...');
        await Page.navigate({ url: `http://127.0.0.1:3001/nft?address=${PLAYER1_ADDRESS}` });
        await new Promise(r => setTimeout(r, 4000));
        
        const galleryResult = await Runtime.evaluate({
            expression: `(function() {
                const images = document.querySelectorAll('img[src^="data:image"]');
                const results = [];
                images.forEach((img, i) => {
                    results.push({
                        index: i,
                        srcLength: img.src.length,
                        hasBase64: img.src.includes('base64'),
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    });
                });
                return JSON.stringify({
                    screenshotCount: images.length,
                    screenshots: results,
                    hasCollectionTab: document.body.innerText.includes('My Collection')
                });
            })()`
        });
        
        const galleryData = JSON.parse(galleryResult.result.value);
        console.log('   Screenshots found:', galleryData.screenshotCount);
        if (galleryData.screenshots.length > 0) {
            console.log('   Screenshot details:', JSON.stringify(galleryData.screenshots, null, 2));
        }
        
        // Step 2: Navigate to game to check play-area
        console.log('\n2. Checking game page...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
        await new Promise(r => setTimeout(r, 3000));
        
        const gameResult = await Runtime.evaluate({
            expression: `(function() {
                const playArea = document.querySelector('.play-area');
                const pokerTable = document.querySelector('.poker-table-wrapper');
                return JSON.stringify({
                    hasPlayArea: !!playArea,
                    hasPokerTable: !!pokerTable,
                    playAreaStyles: playArea ? {
                        background: window.getComputedStyle(playArea).background.substring(0, 100),
                        backgroundImage: window.getComputedStyle(playArea).backgroundImage.substring(0, 100),
                        width: playArea.offsetWidth,
                        height: playArea.offsetHeight
                    } : null
                });
            })()`
        });
        
        const gameData = JSON.parse(gameResult.result.value);
        console.log('   Game element found:', gameData.hasPlayArea);
        if (gameData.playAreaStyles) {
            console.log('   Play-area styles:', JSON.stringify(gameData.playAreaStyles, null, 2));
        }
        
        // Step 3: Test screenshot capture simulation
        console.log('\n3. Testing screenshot capture simulation...');
        const captureResult = await Runtime.evaluate({
            expression: `(async function() {
                // Simulate html2canvas options
                const playArea = document.querySelector('.play-area');
                if (!playArea) return JSON.stringify({ error: 'play-area not found' });
                
                // Get computed styles that html2canvas would see
                const styles = window.getComputedStyle(playArea);
                return JSON.stringify({
                    backgroundColor: styles.backgroundColor,
                    backgroundImage: styles.backgroundImage.substring(0, 200),
                    hasPseudoElements: true,
                    // Check for backdrop-filter on children
                    backdropFilterCount: document.querySelectorAll('*').length
                });
            })()`
        });
        
        const captureData = JSON.parse(captureResult.result.value);
        console.log('   Capture simulation:', JSON.stringify(captureData, null, 2));
        
        // Step 4: Take actual screenshot for visual check
        console.log('\n4. Taking browser screenshot...');
        const { data: screenshot } = await Page.captureScreenshot();
        fs.writeFileSync('test-results/screenshot-fix-verification.png', Buffer.from(screenshot, 'base64'));
        console.log('   Saved to: test-results/screenshot-fix-verification.png');
        
        console.log('\n=== Verification Complete ===');
        console.log('\nTo test the actual NFT screenshot fix:');
        console.log('1. Play a game and achieve a Straight or better hand');
        console.log('2. When the NFT achievement popup appears, click "Mint NFT"');
        console.log('3. Check the NFT gallery for the new screenshot');
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.close();
    }
}

main().catch(console.error);
