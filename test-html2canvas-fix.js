// Quick test to preview screenshot fix in game page
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function main() {
    console.log('=== Testing Screenshot Fix Preview ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Step 1: Navigate to game page (tournament)
    console.log('1. Navigating to tournament...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await new Promise(r => setTimeout(r, 3000));
    
    // Step 2: Check page state
    console.log('2. Checking page state...');
    const pageResult = await Runtime.evaluate({
        expression: `JSON.stringify({
            hasPlayArea: !!document.querySelector('.play-area'),
            hasPokerTable: !!document.querySelector('.poker-table-wrapper'),
            title: document.title,
            buttonCount: document.querySelectorAll('button').length
        })`
    });
    
    const pageData = JSON.parse(pageResult.result.value || '{}');
    console.log('   Page state:', JSON.stringify(pageData, null, 2));
    
    // Step 3: Test html2canvas directly in browser
    console.log('\n3. Injecting html2canvas and testing...');
    
    // First inject html2canvas library
    await Runtime.evaluate({
        expression: `(function() {
            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                document.head.appendChild(script);
            }
        })()`
    });
    
    console.log('   Waiting for html2canvas to load...');
    await new Promise(r => setTimeout(r, 3000));
    
    // Test capture
    const screenshotResult = await Runtime.evaluate({
        expression: `JSON.stringify((async function() {
            try {
                const playArea = document.querySelector('.play-area');
                const pokerTable = document.querySelector('.poker-table-wrapper');
                const targetElement = playArea || pokerTable || document.body;
                
                const canvas = await html2canvas(targetElement, {
                    backgroundColor: '#0a0a0f',
                    scale: 0.8,
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    onclone: (clonedDoc) => {
                        const clonedElement = clonedDoc.querySelector('.play-area') || clonedDoc.body;
                        clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                        clonedElement.style.backgroundImage = 'none';
                        clonedElement.style.boxShadow = 'none';
                        clonedElement.style.filter = 'none';
                        clonedDoc.querySelectorAll('*').forEach(el => {
                            el.style.backdropFilter = 'none';
                            el.style.webkitBackdropFilter = 'none';
                        });
                    }
                });
                
                return {
                    success: true,
                    width: canvas.width,
                    height: canvas.height
                };
            } catch (e) {
                return { success: false, error: e.message };
            }
        })())`,
        awaitPromise: true
    });
    
    console.log('   Screenshot result:', screenshotResult.result.value);
    
    // Step 4: Get the actual screenshot data
    console.log('\n4. Capturing actual screenshot...');
    const captureResult = await Runtime.evaluate({
        expression: `(async function() {
            const playArea = document.querySelector('.play-area');
            const pokerTable = document.querySelector('.poker-table-wrapper');
            const targetElement = playArea || pokerTable || document.body;
            
            const canvas = await html2canvas(targetElement, {
                backgroundColor: '#0a0a0f',
                scale: 0.8,
                logging: false,
                useCORS: true,
                allowTaint: true,
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.querySelector('.play-area') || clonedDoc.body;
                    clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                    clonedElement.style.backgroundImage = 'none';
                    clonedElement.style.boxShadow = 'none';
                    clonedElement.style.filter = 'none';
                    clonedDoc.querySelectorAll('*').forEach(el => {
                        el.style.backdropFilter = 'none';
                        el.style.webkitBackdropFilter = 'none';
                    });
                }
            });
            
            return canvas.toDataURL('image/png');
        })()`,
        awaitPromise: true
    });
    
    const dataUrl = captureResult.result.value;
    if (dataUrl && dataUrl.includes && dataUrl.includes('base64,')) {
        const base64Data = dataUrl.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const outputPath = 'test-results/screenshot-fix-preview.png';
        fs.writeFileSync(outputPath, buffer);
        console.log('   Saved to:', outputPath);
        console.log('   File size:', buffer.length, 'bytes');
    } else {
        console.log('   Failed to capture screenshot, result:', typeof dataUrl);
    }
    
    // Step 5: Also take browser screenshot for comparison
    console.log('\n5. Taking browser screenshot for comparison...');
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/browser-comparison.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   Saved to: test-results/browser-comparison.png');
    
    await client.close();
    console.log('\n=== Test Complete ===');
    console.log('\nCompare the two files:');
    console.log('  - test-results/screenshot-fix-preview.png (html2canvas with fix)');
    console.log('  - test-results/browser-comparison.png (actual browser view)');
    console.log('  - test-results/existing-nft-screenshot.png (old screenshot with issue)');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
