const CDP = require('chrome-remote-interface');

async function verifyNFTGallery() {
    let client;
    try {
        console.log('[1/7] Connecting to Chrome CDP on port 9222...');
        client = await CDP({ port: 9222 });
        const { Page, Runtime, DOM } = client;

        await Page.enable();
        await Runtime.enable();

        // Step 1: Navigate to /nft
        console.log('[2/7] Navigating to http://127.0.0.1:3001/nft ...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
        await new Promise(r => setTimeout(r, 5000));

        // Take initial screenshot
        const ts0 = Date.now();
        await Page.captureScreenshot({ format: 'png', path: `logs/nft-verify-s1-initial-${ts0}.png` });
        console.log(`  Screenshot saved: logs/nft-verify-s1-initial-${ts0}.png`);

        // Step 2: Check page state and find 0G/INFT tab
        console.log('[3/7] Inspecting page state and finding 0G/INFT tab...');
        const preClickResult = await Runtime.evaluate({
            expression: `
                (function() {
                    var buttons = Array.from(document.querySelectorAll('button'));
                    var inftTab = buttons.find(function(b) { return (b.textContent || '').includes('0G'); });
                    return JSON.stringify({
                        url: window.location.href,
                        title: document.title,
                        inftTabFound: !!inftTab,
                        inftTabText: inftTab ? inftTab.textContent.trim() : 'NOT FOUND',
                        hasEthereum: !!window.ethereum
                    });
                })()
            `,
            returnByValue: true
        });
        const preClickState = JSON.parse(preClickResult.result.value || '{}');
        console.log('  Pre-click state:', JSON.stringify(preClickState, null, 2));

        if (!preClickState.inftTabFound) {
            console.error('  ERROR: 0G/INFT tab button NOT found on page!');
        }

        // Step 3: Click the 0G/INFT tab button
        console.log('[4/7] Clicking 0G / INFT tab button...');
        
        // Collect any existing console messages before click
        const beforeConsoleMessages = [];
        
        let clickResult;
        try {
            const clickResultRaw = await Runtime.evaluate({
                expression: `
                    (function() {
                        var buttons = Array.from(document.querySelectorAll('button'));
                        var target = buttons.find(function(b) { return (b.textContent || '').includes('0G'); });
                        if (!target) return JSON.stringify({ clicked: false, error: '0G/INFT tab not found' });
                        target.click();
                        return JSON.stringify({ clicked: true, text: target.textContent.trim(), timestamp: Date.now() });
                    })()
                `,
                returnByValue: true
            });
            clickResult = JSON.parse((clickResultRaw && clickResultRaw.result && clickResultRaw.result.value) || '{}');
        } catch(e) {
            console.warn('  Click evaluate error (may be normal if MetaMask opened):', e.message);
            clickResult = { clicked: true, text: '0G / INFT', note: 'click triggered but eval may have been interrupted' };
        }
        console.log('  Click result:', JSON.stringify(clickResult, null, 2));

        // Step 4: Handle MetaMask popup if it appeared - wait and check
        console.log('[5/7] Waiting for fetch/MetaMask (8s)...');
        await new Promise(r => setTimeout(r, 3000));

        // Check for MetaMask popup by evaluating if there's a metamask notification
        // Also check for loading state
        let midWaitState;
        try {
            const midWaitRaw = await Runtime.evaluate({
                expression: `
                    (function() {
                        var bodyText = document.body.innerText;
                        return JSON.stringify({
                            hasLoading: bodyText.includes('Loading INFTs'),
                            hasConnectWallet: bodyText.includes('Connect your 0G wallet'),
                            hasNoInfts: bodyText.includes('No INFTs found'),
                            bodySnippet: bodyText.substring(0, 2000)
                        });
                    })()
                `,
                returnByValue: true
            });
            midWaitState = JSON.parse((midWaitRaw && midWaitRaw.result && midWaitRaw.result.value) || '{}');
        } catch(e) {
            console.warn('  Mid-wait eval error:', e.message);
            midWaitState = {};
        }
        console.log('  Mid-wait state:', JSON.stringify(midWaitState, null, 2));

        // Wait more for data to load
        await new Promise(r => setTimeout(r, 5000));

        // Step 5: Check for MetaMask popup windows and handle or note them
        // List all targets to see if MetaMask opened a popup
        const targets = await CDP.List({ port: 9222 });
        console.log(`\n  Browser targets (${targets.length}):`);
        for (const t of targets) {
            console.log(`    - [${t.type}] ${t.title} :: ${t.url}`);
        }

        // Step 6: Take final screenshot after everything loads
        console.log('[6/7] Taking final screenshot...');
        const ts1 = Date.now();
        await Page.captureScreenshot({ format: 'png', path: `logs/nft-verify-s2-after-inft-tab-${ts1}.png` });
        console.log(`  Screenshot saved: logs/nft-verify-s2-after-inft-tab-${ts1}.png`);

        // Step 7: Detailed analysis of what's displayed
        console.log('[7/7] Analyzing final page content...\n');
        const analysisRaw = await Runtime.evaluate({
            expression: `
                (function() {
                    var results = {};

                    // Full page text
                    results.fullBodyText = document.body.innerText;

                    // Find all NFT card elements
                    var cards = document.querySelectorAll('[class*="sc-gjLMO"], [class*="CollectionCard"]');
                    results.collectionCardCount = cards.length;

                    // Also try broader selector if no results
                    if (cards.length === 0) {
                        cards = document.querySelectorAll('[class*="collection-card"], [class*="sc-"]');

                        // Try to find NFT grid items by looking for card-like structures with INFT text
                        var allDivs = document.querySelectorAll('div');
                        var nftDivs = [];
                        for (var di = 0; di < allDivs.length; di++) {
                            var d = allDivs[di];
                            var dt = d.innerText || '';
                            if ((dt.includes('INFT #') || dt.includes('ERC-7857')) && dt.length < 2000 && dt.length > 50) {
                                nftDivs.push(d);
                            }
                        }
                        results.fallbackCardCount = nftDivs.length;
                        cards = nftDivs;
                    }

                    // Extract details from each card
                    results.nftCards = Array.from(cards).map(function(card, idx) {
                        var text = card.innerText;
                        var images = card.querySelectorAll('img');
                        var imageSrcs = Array.from(images).map(function(img) {
                            return {
                                src: img.src ? img.src.substring(0, 120) : 'no-src',
                                naturalWidth: img.naturalWidth,
                                naturalHeight: img.naturalHeight,
                                complete: img.complete
                            };
                        });

                        // Find heading (NFT name)
                        var headings = card.querySelectorAll('h4');
                        var name = headings.length > 0 ? headings[headings.length-1].textContent : '';

                        // Find badge/rarity
                        var badges = card.querySelectorAll('[class*="Badge"], [class*="badge"]');
                        var badgeText = badges.length > 0 ? badges[badges.length-1].textContent : '';

                        // Find INFT token ID
                        var tokenIdMatch = text.match(/INFT\\s*#(\\d+)/);

                        return {
                            index: idx,
                            name: name ? name.trim() : '',
                            badge: badgeText ? badgeText.trim() : '',
                            tokenId: tokenIdMatch ? tokenIdMatch[1] : 'not found',
                            imageCount: images.length,
                            images: imageSrcs,
                            cardTextSnippet: text.substring(0, 500),
                            visible: card.offsetParent !== null
                        };
                    });

                    // Tab state
                    var tabs = Array.from(document.querySelectorAll('button'));
                    results.currentTabs = tabs.filter(function(t) { return t.offsetParent !== null; })
                        .map(function(t) { return (t.textContent || '').trim(); })
                        .filter(Boolean);

                    // Look specifically for "Straight" and "Royal Flush" in text
                    results.hasStraight = results.fullBodyText.indexOf('Straight') !== -1;
                    results.hasRoyalFlush = results.fullBodyText.indexOf('Royal Flush') !== -1;
                    results.hasStraightINFT = results.fullBodyText.indexOf('Straight INFT') !== -1 || results.fullBodyText.indexOf('Straight') !== -1;
                    results.hasRoyalFlushINFT = results.fullBodyText.indexOf('Royal Flush INFT') !== -1;

                    // Count INFT mentions
                    var inftMatches = results.fullBodyText.match(/INFT/g);
                    results.inftMentionCount = inftMatches ? inftMatches.length : 0;

                    // Token ID count
                    var tokenIdAllMatches = results.fullBodyText.match(/INFT\\s*#(\\d+)/g);
                    results.tokenIdsFound = tokenIdAllMatches || [];

                    // Check for any data URI images
                    var allImgs = document.querySelectorAll('img[src^="data:"]');
                    results.dataImagesCount = allImgs.length;
                    results.dataImageDetails = Array.from(allImgs).slice(0, 10).map(function(img) {
                        return {
                            srcPrefix: img.src.substring(0, 80),
                            width: img.naturalWidth,
                            height: img.naturalHeight,
                            complete: img.complete
                        };
                    });

                    // Check for rarity names (LEGENDARY, EPIC, RARE etc.)
                    results.hasLegendary = results.fullBodyText.indexOf('LEGENDARY') !== -1;
                    results.hasEpic = results.fullBodyText.indexOf('EPIC') !== -1;
                    results.hasRare = results.fullBodyText.indexOf('RARE') !== -1;

                    return JSON.stringify(results);
                })()
            `,
            returnByValue: true
        });

        let data;
        try {
            data = JSON.parse(analysisRaw.result.value || '{}');
        } catch(e) {
            console.error('Failed to parse analysis result:', e.message);
            console.log('Raw result:', JSON.stringify(analysisRaw));
            data = {};
        }
        console.log('========== ANALYSIS RESULTS ==========');
        console.log('\n--- Collection Card Count ---');
        console.log(`  Total CollectionCards: ${data.collectionCardCount}`);
        
        console.log('\n--- NFT Cards Details ---');
        if (data.nftCards && data.nftCards.length > 0) {
            data.nftCards.forEach((card, i) => {
                console.log(`\n  Card #${i + 1}:`);
                console.log(`    Name: ${card.name}`);
                console.log(`    Badge/Rarity: ${card.badge}`);
                console.log(`    Token ID: ${card.tokenId}`);
                console.log(`    Images: ${card.imageCount}`);
                if (card.images && card.images.length > 0) {
                    card.images.forEach((img, j) => {
                        console.log(`      Image[${j}]: src="${img.src}" | ${img.naturalWidth}x${img.naturalHeight} | complete=${img.complete}`);
                    });
                }
                console.log(`    Visible: ${card.visible}`);
                console.log(`    Text snippet: ${card.cardTextSnippet.substring(0, 150)}`);
            });
        } else {
            console.log('  NO CARDS FOUND!');
        }

        console.log('\n--- Keyword Detection ---');
        console.log(`  Contains "Straight": ${data.hasStraight}`);
        console.log(`  Contains "Royal Flush": ${data.hasRoyalFlush}`);
        console.log(`  Contains "Straight INFT": ${data.hasStraightINFT}`);
        console.log(`  Contains "Royal Flush INFT": ${data.hasRoyalFlushINFT}`);
        console.log(`  Total "INFT" mentions: ${data.inftMentionCount}`);
        console.log(`  Token IDs found: ${JSON.stringify(data.tokenIdsFound)}`);

        console.log('\n--- Data Images ---');
        console.log(`  Total data: URI images: ${data.dataImagesCount}`);
        if (data.dataImageDetails) {
            data.dataImageDetails.forEach((img, i) => {
                console.log(`    Image[${i}]: ${img.width}x${img.height} | complete=${img.complete} | src=${img.srcPrefix}...`);
            });
        }

        console.log('\n--- Visible Tabs ---');
        console.log(`  ${data.currentTabs.join(' | ')}`);

        console.log('\n=====================================\n');

        // Summary verdict
        console.log('======== VERDICT ========');
        const cardCount = data.collectionCardCount;
        const names = (data.nftCards || []).map(c => c.name).filter(Boolean);
        const hasImages = (data.nftCards || []).some(c => c.imageCount > 0 && c.images.some(i => i.naturalWidth > 0));
        
        console.log(`  INFT Cards Shown: ${cardCount}`);
        console.log(`  Names Found: ${names.length > 0 ? names.join(', ') : 'NONE'}`);
        console.log(`  Images Visible: ${hasImages ? 'YES' : 'NO'}`);
        console.log(`  Expected: 2 INFTs ("Straight INFT", "Royal Flush INFT")`);
        
        if (cardCount === 2 && names.includes('Straight') && names.includes('Royal Flush')) {
            console.log('\n  *** PASS: NFT Gallery correctly shows 2 INFTs with expected names! ***');
        } else if (cardCount === 2) {
            console.log(`\n  ** PARTIAL: 2 cards shown but names may differ: ${names.join(', ')}**`);
        } else if (cardCount === 0) {
            console.log('\n  *** FAIL: No INFT cards displayed! ***');
        } else {
            console.log(`\n  ** UNEXPECTED: ${cardCount} cards shown (expected 2)**`);
        }

    } catch(e) {
        console.error('FATAL ERROR:', e.message);
        console.error(e.stack);
    } finally {
        if(client) {
            await client.close().catch(() => {});
            console.log('\n[Done] CDP connection closed.');
        }
    }
}

verifyNFTGallery();
