const CDP = require('chrome-remote-interface');

async function debugINFT() {
    let client;
    try {
        console.log('=== Connecting to Chrome CDP ===');
        client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();
        
        // Navigate to NFT page
        console.log('\n=== Navigating to /nft ===');
        await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
        await new Promise(r => setTimeout(r, 4000));
        
        // Screenshot 1 - initial page load
        const ts = Date.now();
        await Page.captureScreenshot({ format: 'png', path: `logs/debug-inft-s1-${ts}.png` });
        console.log(`[Screenshot 1 saved: logs/debug-inft-s1-${ts}.png]`);
        
        // Step 1: Check ZeroGContext state via React fiber inspection
        console.log('\n=== Step 1: Inspecting React/ZeroG State ===');
        
        const stateCheck = await Runtime.evaluate({
            expression: `
                (async function() {
                    const results = {};
                    
                    // Check if window.ethereum exists
                    results.hasEthereum = !!window.ethereum;
                    
                    // Check if we can find React root
                    const root = document.getElementById('root');
                    results.hasReactRoot = !!root;
                    
                    // Look for any global state or context info in DOM
                    // The tabs text tells us current state
                    const allText = document.body.innerText;
                    results.pageText = allText.substring(0, 1500);
                    
                    // Find the 0G/INFT tab element and its content
                    const tabs = Array.from(document.querySelectorAll('button'));
                    const inftTab = tabs.find(t => (t.textContent || '').includes('0G') || (t.textContent || '').includes('INFT'));
                    results.inftTabText = inftTab ? inftTab.textContent.trim() : 'NOT FOUND';
                    results.inftTabHTML = inftTab ? inftTab.outerHTML : '';
                    
                    // Count how many tabs exist
                    results.allTabs = tabs.filter(t => t.offsetParent !== null).map(t => t.textContent?.trim());
                    
                    return results;
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('State check result:', JSON.stringify(stateCheck.result.value, null, 2));
        
        // Step 2: Direct API call with correct address
        console.log('\n=== Step 2: Direct API Test ===');
        const apiTest = await Runtime.evaluate({
            expression: `
                fetch('/api/0g/infts/0x8808ff950b9bfddde445fd099262e80cee858eb5')
                    .then(r => r.json())
                    .then(d => ({ status: 'ok', data: d }))
                    .catch(e => ({ status: 'error', msg: e.message }))
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('API Result:', JSON.stringify(apiTest.result.value, null, 2));
        
        // Step 3: Click on the 0G / INFT tab button
        console.log('\n=== Step 3: Clicking 0G/INFT Tab ===');
        const clickResult = await Runtime.evaluate({
            expression: `
                (function() {
                    // Find ALL buttons on the page
                    const buttons = Array.from(document.querySelectorAll('button, [role="tab"], [class*="tab"]'));
                    const target = buttons.find(b => {
                        const t = b.textContent || '';
                        return t.includes('0G') || t.includes('INFT');
                    });
                    
                    if (!target) {
                        return { clicked: false, reason: '0G/INFT button not found', 
                            buttonsFound: buttons.map(b => ({
                                tag: b.tagName, 
                                text: (b.textContent||'').trim().substring(0, 50),
                                classes: (b.className||'').toString().substring(0, 80)
                            }))
                        };
                    }
                    
                    // Get info before click
                    const beforeClick = {
                        text: target.textContent.trim(),
                        outerHTML: target.outerHTML.substring(0, 300),
                        disabled: target.disabled,
                        opacity: window.getComputedStyle(target).opacity,
                        pointerEvents: window.getComputedStyle(target).pointerEvents,
                        display: window.getComputedStyle(target).display,
                        visibility: window.getComputedStyle(target).visibility
                    };
                    
                    // Click it
                    target.click();
                    
                    return { clicked: true, ...beforeClick };
                })()
            `,
            returnByValue: true
        });
        console.log('Click result:', JSON.stringify(clickResult.result.value, null, 2));
        
        // Wait for fetch to complete
        console.log('Waiting 4s for fetch...');
        await new Promise(r => setTimeout(r, 4000));
        
        // Screenshot 2 - after clicking INFT tab
        const ts2 = Date.now();
        await Page.captureScreenshot({ format: 'png', path: `logs/debug-inft-s2-after-click-${ts2}.png` });
        console.log(`[Screenshot 2 saved: logs/debug-inft-s2-after-click-${ts2}.png]`);
        
        // Step 4: Check what's displayed now after clicking
        console.log('\n=== Step 4: Post-click State Analysis ===');
        const postClickState = await Runtime.evaluate({
            expression: `
                (function() {
                    const body = document.body.innerText;
                    return {
                        fullText: body,
                        hasNoInfts: body.includes('No INFTs found'),
                        hasConnectWallet: body.includes('Connect your 0G wallet'),
                        hasLoading: body.includes('Loading INFTs'),
                        
                        // Find the INFT tab text again to see count updated
                        inftTabText: (() => {
                            const btns = Array.from(document.querySelectorAll('button'));
                            const t = btns.find(b => (b.textContent||'').includes('0G'));
                            return t ? t.textContent.trim() : 'NOT FOUND';
                        })(),
                        
                        // Count CollectionCard elements (NFT cards)
                        nftCardCount: document.querySelectorAll('[class*="CollectionCard"], [class*="collection-card"]').length,
                        
                        // Check for empty state message
                        emptyMessage: (() => {
                            const els = document.querySelectorAll('*');
                            for (const el of els) {
                                const t = el.textContent?.trim();
                                if (t === 'No INFTs found on 0G chain' || t.includes('No INFTs found')) {
                                    return { text: t, visible: el.offsetParent !== null, parentClass: el.parentElement?.className?.toString() };
                                }
                                if (t === 'Connect your 0G wallet to view Interactive NFTs') {
                                    return { text: t, visible: el.offsetParent !== null, parentClass: el.parentElement?.className?.toString() };
                                }
                            }
                            return 'no specific message found';
                        })()
                    };
                })()
            `,
            returnByValue: true
        });
        console.log('Post-click state:', JSON.stringify(postClickState.result.value, null, 2));
        
        // Step 5: Try calling fetchINFTs logic manually with correct address
        console.log('\n=== Step 5: Simulating fetchINFTs with correct address ===');
        const manualFetch = await Runtime.evaluate({
            expression: `
                (async function() {
                    // This simulates what fetchINFTs does but with hardcoded correct address
                    const zeroGAddress = '0x8808ff950b9bfddde445fd099262e80cee858eb5';
                    try {
                        const res = await fetch('/api/0g/infts/' + zeroGAddress);
                        const data = await res.json();
                        return {
                            addressUsed: zeroGAddress,
                            apiStatus: res.status,
                            success: data.success,
                            inftCount: data.infts ? data.infts.length : 0,
                            infts: data.infts ? data.infts.map(i => ({ tokenId: i.tokenId, name: i.metadataName, handType: i.handType })) : [],
                            error: data.error
                        };
                    } catch(e) {
                        return { error: e.message };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('Manual fetch result:', JSON.stringify(manualFetch.result.value, null, 2));
        
        // Step 6: Check console errors
        console.log('\n=== DEBUG COMPLETE ===');
        
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        if(client) await client.close();
    }
}

debugINFT();
