/**
 * CDP Test for DEX Swap - Final Version
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const DEX_URL = 'http://127.0.0.1:3001/dex';
const CDP_PORT = 9222;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSwap() {
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
        
        // Check wallet
        const walletStatus = await Runtime.evaluate({
            expression: `
                (async () => {
                    return {
                        connected: !!(window.tronLink?.tronWeb?.defaultAddress?.base58),
                        address: window.tronLink?.tronWeb?.defaultAddress?.base58
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Wallet:', JSON.stringify(walletStatus.result.value));
        
        // Use React's value setter to properly set input value
        console.log('[CDP] Setting input value...');
        const inputResult = await Runtime.evaluate({
            expression: `
                (() => {
                    const inputs = document.querySelectorAll('input[type="number"]');
                    if (inputs.length > 0) {
                        const input = inputs[0];
                        
                        // React requires us to use native setter
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set;
                        
                        nativeInputValueSetter.call(input, '2');
                        
                        // Dispatch React events
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        return { success: true, value: input.value };
                    }
                    return { success: false };
                })()
            `,
            returnByValue: true
        });
        console.log('[CDP] Input result:', JSON.stringify(inputResult.result.value));
        
        // Wait for quote calculation
        await sleep(2000);
        
        // Check quote status
        const quoteStatus = await Runtime.evaluate({
            expression: `
                (() => {
                    // Find the output amount
                    const inputs = document.querySelectorAll('input[type="number"]');
                    const outputValue = inputs.length > 1 ? inputs[1].value : null;
                    
                    // Check if there's an error
                    const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
                    
                    return {
                        inputValue: inputs[0]?.value,
                        outputValue,
                        errorCount: errorElements.length,
                        errorTexts: Array.from(errorElements).map(e => e.textContent?.substring(0, 100))
                    };
                })()
            `,
            returnByValue: true
        });
        console.log('[CDP] Quote status:', JSON.stringify(quoteStatus.result.value));
        
        // Take screenshot
        let screenshot = (await Page.captureScreenshot()).data;
        fs.writeFileSync('dex-before-swap.png', Buffer.from(screenshot, 'base64'));
        
        // Click Swap button
        console.log('[CDP] Clicking Swap button...');
        const clickResult = await Runtime.evaluate({
            expression: `
                (() => {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.toLowerCase().includes('swap') && !btn.disabled) {
                            btn.click();
                            return { clicked: true, text: btn.textContent };
                        }
                    }
                    return { clicked: false };
                })()
            `,
            returnByValue: true
        });
        console.log('[CDP] Click result:', JSON.stringify(clickResult.result.value));
        
        // Wait for transaction
        await sleep(5000);
        
        // Take screenshot
        screenshot = (await Page.captureScreenshot()).data;
        fs.writeFileSync('dex-after-swap.png', Buffer.from(screenshot, 'base64'));
        
        // Check result - look for success/error messages
        const finalStatus = await Runtime.evaluate({
            expression: `
                (() => {
                    // Check for any alerts or messages
                    const allText = document.body.innerText;
                    const hasError = allText.toLowerCase().includes('error') || allText.toLowerCase().includes('failed');
                    const hasSuccess = allText.toLowerCase().includes('success') || allText.toLowerCase().includes('tx:');
                    
                    // Check for TronLink popup (if any)
                    const tronLinkPopup = document.querySelector('[class*="tronlink"]') || 
                                          document.querySelector('[class*="tron-link"]');
                    
                    return {
                        hasError,
                        hasSuccess,
                        hasTronLinkPopup: !!tronLinkPopup,
                        bodyTextPreview: allText.substring(0, 500)
                    };
                })()
            `,
            returnByValue: true
        });
        console.log('[CDP] Final status:', JSON.stringify(finalStatus.result.value, null, 2));
        
        // Check console for logs
        console.log('[CDP] Check browser DevTools console for transaction logs');
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testSwap();
