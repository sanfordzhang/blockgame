const CDP = require('chrome-remote-interface');

async function debugINFTIssue() {
    let client;
    try {
        console.log('Connecting to Chrome CDP on port 9222...');
        client = await CDP({ port: 9222 });
        const { Page, Runtime, Network, DOM, Console } = client;
        
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        await DOM.enable();
        await Console.enable();
        
        // Step 1: Get current URL
        const currentUrl = (await Runtime.evaluate({ expression: 'window.location.href' })).result.value;
        console.log('\n=== Current URL:', currentUrl, '===');
        
        // Navigate to NFT page if needed
        if (!currentUrl.includes('/nft')) {
            console.log('Navigating to /nft page...');
            await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
            await new Promise(r => setTimeout(r, 3000)); // Wait for page load
        }
        
        // Take initial screenshot
        const timestamp1 = Date.now();
        await Page.captureScreenshot({
            format: 'png',
            path: `logs/inft-debug-screenshot-1-before-${timestamp1}.png`
        });
        console.log(`\n[Screenshot 1 taken: inft-debug-screenshot-1-before-${timestamp1}.png]`);
        
        // Step 2a: Check React state for zeroGAddress
        console.log('\n=== Checking React State ===');
        try {
            const reactHookResult = await Runtime.evaluate({
                expression: `
                    (function() {
                        try {
                            const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
                            if (hook) {
                                return { hasDevToolsHook: true, renderers: Object.keys(hook._renderers || {}) };
                            }
                            return { hasDevToolsHook: false };
                        } catch(e) { return { error: e.message }; }
                    })()
                `
            });
            console.log('React DevTools Hook:', JSON.stringify(reactHookResult.result.value, null, 2));
        } catch(e) {
            console.log('React Hook check error:', e.message);
        }

        // Try to find zeroG context via DOM
        const domCheckResult = await Runtime.evaluate({
            expression: `
                (function() {
                    const results = {};
                    
                    // Look for zero-g related elements or text
                    const allElements = document.querySelectorAll('*');
                    let zeroGElements = [];
                    allElements.forEach(el => {
                        if (el.textContent && (
                            el.textContent.includes('0G') || 
                            el.textContent.includes('INFT') || 
                            el.textContent.includes('zeroG') ||
                            el.textContent.toLowerCase().includes('inft')
                        )) {
                            zeroGElements.push({
                                tag: el.tagName,
                                className: el.className,
                                textContent: el.textContent.substring(0, 100),
                                id: el.id
                            });
                        }
                    });
                    results.zeroGElements = zeroGElements.slice(0, 20); // Limit results
                    
                    // Check for tabs/buttons related to 0G
                    const tabs = Array.from(document.querySelectorAll('[class*="tab"], [class*="Tab"], button'));
                    results.tabs = tabs.map(t => ({
                        tag: t.tagName,
                        className: t.className.toString(),
                        text: t.textContent?.trim().substring(0, 50)
                    })).filter(t => t.text).slice(0, 30);
                    
                    return results;
                })()
            `
        });
        console.log('DOM elements with 0G/INFT text:', JSON.stringify(domCheckResult.result.value, null, 2));
        
        // Step 3c: Call API directly from browser
        console.log('\n=== Direct API Call Test ===');
        const apiCallResult = await Runtime.evaluate({
            expression: `
                fetch('/api/0g/infts/0x8808ff950b9bfddde445fd099262e80cee858eb5')
                    .then(r => {
                        console.log('API Response status:', r.status);
                        return r.json();
                    })
                    .then(d => {
                        console.log('INFT result:', d);
                        return { status: 'success', data: d };
                    })
                    .catch(e => ({ status: 'error', error: e.message }))
            `,
            awaitPromise: true,
            returnByValue: true
        });
        console.log('Direct API Result:', JSON.stringify(apiCallResult.result.value, null, 2));
        
        // Step 3d/e: Check page content and look for 0G tab
        console.log('\n=== Page Content Analysis ===');
        const pageTextResult = await Runtime.evaluate({
            expression: `
                (function() {
                    const body = document.body.innerText;
                    return {
                        bodyTextPreview: body.substring(0, 2000),
                        hasZeroG: body.includes('0G') || body.includes('zeroG'),
                        hasINFT: body.includes('INFT') || body.includes('inft'),
                        hasTron: body.includes('TRON') || body.includes('Tron'),
                        hasNFTGallery: body.includes('NFT') || body.includes('NFT'),
                        hasZeroGButton: !!document.querySelector('[class*="zero"], [class*="0g"], [class*="zerog"]')
                    };
                })()
            `
        });
        console.log('Page content analysis:', JSON.stringify(pageTextResult.result.value, null, 2));
        
        // Try to find and click 0G tab/button
        console.log('\n=== Attempting to Find & Click 0G Tab ===');
        const clickAttempt = await Runtime.evaluate({
            expression: `
                (async function() {
                    // Strategy 1: Look for buttons/tabs containing "0G" or "INFT" text
                    const allButtons = Array.from(document.querySelectorAll('button, [role="tab"], [class*="nav"], [class*="tab"], div[onclick], span[class*="tab"]'));
                    const targetBtn = allButtons.find(btn => {
                        const text = btn.textContent || '';
                        return text.includes('0G') || text.includes('INFT') || text.includes('EVM');
                    });
                    
                    if (targetBtn) {
                        targetBtn.click();
                        return { clicked: true, element: targetBtn.tagName, text: targetBtn.textContent.trim(), className: targetBtn.className.toString() };
                    }
                    
                    // Strategy 2: Look for any clickable element near "TRON"
                    const tronRelated = allButtons.filter(btn => (btn.textContent || '').includes('TRON'));
                    return { 
                        clicked: false, 
                        reason: 'No 0G/INFT button found', 
                        tronButtonsFound: tronRelated.map(b => b.textContent?.trim()),
                        allClickables: allButtons.slice(0, 20).map(b => ({
                            tag: b.tagName,
                            text: b.textContent?.trim().substring(0, 40),
                            class: b.className.toString().substring(0, 60)
                        }))
                    };
                })()
            `
        });
        console.log('Click attempt result:', JSON.stringify(clickAttempt.result.value, null, 2));
        
        // Wait after clicking
        await new Promise(r => setTimeout(r, 2000));
        
        // Take second screenshot after potential click
        const timestamp2 = Date.now();
        await Page.captureScreenshot({
            format: 'png',
            path: `logs/inft-debug-screenshot-2-after-${timestamp2}.png`
        });
        console.log(`\n[Screenshot 2 taken: inft-debug-screenshot-2-after-${timestamp2}.png]`);
        
        // Additional check: Get console errors/warnings
        console.log('\n=== Checking Console Messages ===');
        // The Console messages would have been captured during enable
        
        // Check network requests
        console.log('\n=== Checking for INFT-related Network Requests ===');
        
        // Final state check - what's actually displayed
        console.log('\n=== Final Display State ===');
        const finalState = await Runtime.evaluate({
            expression: `
                (function() {
                    // Count visible cards/items on the page
                    const cards = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="nft"], [class*="NFT"], [class*="item"]');
                    const emptyStates = document.querySelectorAll('[class*="empty"], [class*="Empty"], [class*="no-data"], [class*="NoData"]');
                    
                    // Look specifically for count displays
                    const counts = [];
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                    while(walker.nextNode()) {
                        const text = walker.currentNode.textContent.trim();
                        if (/\\d+\\s*(NFT|INFT|nft|inft)/i.test(text) || /^(0|1|2|3|4|5|6|7|8|9)$/.test(text)) {
                            if (text.length < 20) counts.push(text + ' | parent: ' + (walker.currentNode.parentElement?.className || '').toString().substring(0, 60));
                        }
                    }
                    
                    return {
                        cardCount: cards.length,
                        emptyStateCount: emptyStates.length,
                        numberCounts: counts.slice(0, 30)
                    };
                })()
            `
        });
        console.log('Final display state:', JSON.stringify(finalState.result.value, null, 2));
        
        console.log('\n========== DEBUG COMPLETE ==========');
        
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

debugINFTIssue();
