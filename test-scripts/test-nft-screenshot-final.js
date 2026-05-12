// Test html2canvas fix on actual game page
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function main() {
    console.log('=== Testing Screenshot Fix on Game Page ===\n');
    
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Step 1: Navigate to NFT gallery first (we know this page exists)
    console.log('1. Navigating to NFT gallery to test screenshot...');
    await Page.navigate({ url: `http://127.0.0.1:3001/nft?address=${PLAYER1_ADDRESS}` });
    await new Promise(r => setTimeout(r, 3000));
    
    // Step 2: Inject html2canvas
    console.log('\n2. Injecting html2canvas...');
    await Runtime.evaluate({
        expression: `(function() {
            if (typeof html2canvas === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                document.head.appendChild(script);
            }
        })()`
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Step 3: Test screenshot on the NFT gallery page
    console.log('\n3. Testing screenshot capture...');
    
    const testResult = await Runtime.evaluate({
        expression: `JSON.stringify((async function() {
            try {
                // Get the main container
                const mainContainer = document.querySelector('[class*="Container"]') || document.body;
                
                // Test 1: Capture with OLD method (like before)
                const oldCanvas = await html2canvas(mainContainer, {
                    backgroundColor: '#1a1a2e',
                    scale: 0.8,
                    logging: false,
                    useCORS: true
                });
                
                // Test 2: Capture with NEW fix
                const newCanvas = await html2canvas(mainContainer, {
                    backgroundColor: '#0a0a0f',
                    scale: 0.8,
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    onclone: (clonedDoc) => {
                        const clonedElement = clonedDoc.body;
                        // Apply gradient background fix
                        clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                        // Remove any shadows or filters
                        clonedElement.style.boxShadow = 'none';
                        clonedElement.style.filter = 'none';
                        // Remove backdrop-filter from all elements
                        clonedDoc.querySelectorAll('*').forEach(el => {
                            el.style.backdropFilter = 'none';
                            el.style.webkitBackdropFilter = 'none';
                        });
                    }
                });
                
                return {
                    success: true,
                    old: { width: oldCanvas.width, height: oldCanvas.height },
                    new: { width: newCanvas.width, height: newCanvas.height }
                };
            } catch (e) {
                return { success: false, error: e.message };
            }
        })())`,
        awaitPromise: true
    });
    
    console.log('   Test result:', testResult.result.value);
    
    // Step 4: Get both screenshots for comparison
    console.log('\n4. Capturing comparison screenshots...');
    
    // Old method screenshot
    const oldResult = await Runtime.evaluate({
        expression: `(async function() {
            const mainContainer = document.querySelector('[class*="Container"]') || document.body;
            const canvas = await html2canvas(mainContainer, {
                backgroundColor: '#1a1a2e',
                scale: 0.8,
                logging: false,
                useCORS: true
            });
            return canvas.toDataURL('image/png');
        })()`,
        awaitPromise: true
    });
    
    if (oldResult.result.value && oldResult.result.value.includes('base64,')) {
        const base64Data = oldResult.result.value.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/screenshot-old-method.png', buffer);
        console.log('   Old method saved: test-results/screenshot-old-method.png');
    }
    
    // New fix screenshot
    const newResult = await Runtime.evaluate({
        expression: `(async function() {
            const mainContainer = document.querySelector('[class*="Container"]') || document.body;
            const canvas = await html2canvas(mainContainer, {
                backgroundColor: '#0a0a0f',
                scale: 0.8,
                logging: false,
                useCORS: true,
                allowTaint: true,
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.body;
                    clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
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
    
    if (newResult.result.value && newResult.result.value.includes('base64,')) {
        const base64Data = newResult.result.value.split('base64,')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync('test-results/screenshot-new-fix.png', buffer);
        console.log('   New fix saved: test-results/screenshot-new-fix.png');
    }
    
    // Step 5: Browser screenshot for reference
    console.log('\n5. Browser screenshot for reference...');
    const { data: browserScreenshot } = await Page.captureScreenshot();
    fs.writeFileSync('test-results/browser-nft-page.png', Buffer.from(browserScreenshot, 'base64'));
    console.log('   Saved: test-results/browser-nft-page.png');
    
    await client.close();
    console.log('\n=== Test Complete ===');
    console.log('\nCompare files:');
    console.log('  - test-results/screenshot-old-method.png (old method)');
    console.log('  - test-results/screenshot-new-fix.png (with fix)');
    console.log('  - test-results/browser-nft-page.png (browser view)');
    console.log('\nThe fix should show a gradient background without black shadows.');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
