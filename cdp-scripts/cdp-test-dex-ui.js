/**
 * CDP Test for DEX UI Swap Function
 * 完整测试 DEX 页面的 Swap 功能
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const DEX_URL = 'http://127.0.0.1:3001/dex';
const CDP_PORT = 9222;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDexUISwap() {
    let client;
    
    try {
        console.log('[CDP] Connecting to Chrome...');
        client = await CDP({ port: CDP_PORT });
        
        const { Page, Runtime, DOM, Input } = client;
        
        await Page.enable();
        await Runtime.enable();
        await DOM.enable();
        
        console.log('[CDP] Navigating to DEX page...');
        await Page.navigate({ url: DEX_URL });
        await Page.loadEventFired();
        await sleep(3000);
        
        // Take initial screenshot
        let { data: screenshot } = await Page.captureScreenshot();
        fs.writeFileSync('dex-ui-1-initial.png', Buffer.from(screenshot, 'base64'));
        console.log('[CDP] Screenshot: dex-ui-1-initial.png');
        
        // Check wallet connection
        const walletStatus = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tronLink = window.tronLink;
                    return {
                        connected: !!(tronLink?.tronWeb?.defaultAddress?.base58),
                        address: tronLink?.tronWeb?.defaultAddress?.base58
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Wallet:', JSON.stringify(walletStatus.result.value));
        
        // Find input field and enter amount
        console.log('[CDP] Finding input field...');
        const inputInfo = await Runtime.evaluate({
            expression: `
                (() => {
                    const inputs = document.querySelectorAll('input[type="number"]');
                    if (inputs.length > 0) {
                        const input = inputs[0];
                        // Get position for clicking
                        const rect = input.getBoundingClientRect();
                        return {
                            found: true,
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                            placeholder: input.placeholder
                        };
                    }
                    return { found: false };
                })()
            `,
            returnByValue: true
        });
        
        console.log('[CDP] Input info:', JSON.stringify(inputInfo.result.value));
        
        if (inputInfo.result.value.found) {
            // Click on input
            const { x, y } = inputInfo.result.value;
            await Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
            await Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
            await sleep(500);
            
            // Type amount
            console.log('[CDP] Typing amount: 2');
            await Input.dispatchKeyEvent({ type: 'keyDown', text: '2' });
            await Input.dispatchKeyEvent({ type: 'keyUp', text: '2' });
            await sleep(500);
            
            // Take screenshot after input
            screenshot = (await Page.captureScreenshot()).data;
            fs.writeFileSync('dex-ui-2-after-input.png', Buffer.from(screenshot, 'base64'));
            console.log('[CDP] Screenshot: dex-ui-2-after-input.png');
            
            // Verify input value
            const inputValue = await Runtime.evaluate({
                expression: `document.querySelectorAll('input[type="number"]')[0]?.value`,
                returnByValue: true
            });
            console.log('[CDP] Input value:', inputValue.result.value);
            
            // Wait for quote to load
            await sleep(2000);
            
            // Take screenshot after quote
            screenshot = (await Page.captureScreenshot()).data;
            fs.writeFileSync('dex-ui-3-after-quote.png', Buffer.from(screenshot, 'base64'));
            console.log('[CDP] Screenshot: dex-ui-3-after-quote.png');
            
            // Find and click Swap button
            console.log('[CDP] Finding Swap button...');
            const buttonInfo = await Runtime.evaluate({
                expression: `
                    (() => {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.textContent.toLowerCase().includes('swap')) {
                                const rect = btn.getBoundingClientRect();
                                return {
                                    found: true,
                                    x: rect.left + rect.width / 2,
                                    y: rect.top + rect.height / 2,
                                    text: btn.textContent,
                                    disabled: btn.disabled
                                };
                            }
                        }
                        return { found: false };
                    })()
                `,
                returnByValue: true
            });
            
            console.log('[CDP] Button info:', JSON.stringify(buttonInfo.result.value));
            
            if (buttonInfo.result.value.found && !buttonInfo.result.value.disabled) {
                // Click Swap button
                const bx = buttonInfo.result.value.x;
                const by = buttonInfo.result.value.y;
                
                console.log('[CDP] Clicking Swap button...');
                await Input.dispatchMouseEvent({ type: 'mousePressed', x: bx, y: by, button: 'left', clickCount: 1 });
                await Input.dispatchMouseEvent({ type: 'mouseReleased', x: bx, y: by, button: 'left', clickCount: 1 });
                
                // Wait for transaction
                await sleep(5000);
                
                // Take screenshot after swap
                screenshot = (await Page.captureScreenshot()).data;
                fs.writeFileSync('dex-ui-4-after-swap.png', Buffer.from(screenshot, 'base64'));
                console.log('[CDP] Screenshot: dex-ui-4-after-swap.png');
                
                // Check for success or error
                const result = await Runtime.evaluate({
                    expression: `
                        (() => {
                            // Check for alerts
                            const alerts = document.querySelectorAll('[role="alert"], .alert, .toast');
                            // Check for error messages
                            const errors = document.querySelectorAll('.error, [class*="error"]');
                            return {
                                alertCount: alerts.length,
                                errorCount: errors.length,
                                alertTexts: Array.from(alerts).map(a => a.textContent),
                                errorTexts: Array.from(errors).map(e => e.textContent)
                            };
                        })()
                    `,
                    returnByValue: true
                });
                
                console.log('[CDP] Result:', JSON.stringify(result.result.value));
            } else {
                console.log('[CDP] Button not found or disabled');
            }
        } else {
            console.log('[CDP] Input field not found');
        }
        
        // Get console logs
        console.log('[CDP] Check browser console for detailed logs');
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testDexUISwap();
