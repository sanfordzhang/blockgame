/**
 * CDP Test - UI Swap Test
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const DEX_URL = 'http://127.0.0.1:3001/dex';
const CDP_PORT = 9222;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUISwap() {
    let client;
    
    try {
        console.log('[CDP] Connecting...');
        client = await CDP({ port: CDP_PORT });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();
        
        // Hard refresh
        console.log('[CDP] Refreshing page...');
        await Page.navigate({ url: DEX_URL });
        await Page.loadEventFired();
        await sleep(3000);
        
        // Listen to console
        Runtime.consoleAPICalled((params) => {
            const args = params.args.map(a => a.value || a.description || '').join(' ');
            if (args.includes('useTronLink') || args.includes('TradingPanel') || args.includes('Swap') || args.includes('error')) {
                console.log('[Console]', params.type, args);
            }
        });
        
        // Get balance
        const bal = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const addr = tw.defaultAddress?.base58;
                    const trx = await tw.trx.getBalance(addr);
                    const chipContract = await tw.contract().at('TFWScXGFALnK9D79zf5jrnw5on7aqJiaY3');
                    const chip = await chipContract.balanceOf(addr).call();
                    return {
                        addr,
                        trx: (parseInt(trx) / 1e6).toFixed(4),
                        chip: (parseInt(chip) / 1e6).toFixed(4)
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Balance:', JSON.stringify(bal.result.value));
        
        // Set input value using React's value setter
        console.log('[CDP] Setting input value to 0.5 TRX...');
        await Runtime.evaluate({
            expression: `
                (() => {
                    const input = document.querySelectorAll('input[type="number"]')[0];
                    if (!input) return { error: 'Input not found' };
                    
                    const nativeSetter = Object.getOwnPropertyDescriptor(
                        window.HTMLInputElement.prototype, 'value'
                    ).set;
                    nativeSetter.call(input, '0.5');
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    return { value: input.value };
                })()
            `,
            returnByValue: true
        });
        
        await sleep(2000);
        
        // Click Swap button
        console.log('[CDP] Clicking Swap button...');
        await Runtime.evaluate({
            expression: `
                (() => {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.toLowerCase().includes('swap') && !btn.disabled) {
                            btn.click();
                            return 'clicked';
                        }
                    }
                    return 'not found';
                })()
            `,
            returnByValue: true
        });
        
        // Wait for transaction
        await sleep(8000);
        
        // Take screenshot
        const screenshot = (await Page.captureScreenshot()).data;
        fs.writeFileSync('dex-ui-swap-test.png', Buffer.from(screenshot, 'base64'));
        console.log('[CDP] Screenshot saved: dex-ui-swap-test.png');
        
        // Get final balance
        const finalBal = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const addr = tw.defaultAddress?.base58;
                    const trx = await tw.trx.getBalance(addr);
                    const chipContract = await tw.contract().at('TFWScXGFALnK9D79zf5jrnw5on7aqJiaY3');
                    const chip = await chipContract.balanceOf(addr).call();
                    return {
                        trx: (parseInt(trx) / 1e6).toFixed(4),
                        chip: (parseInt(chip) / 1e6).toFixed(4)
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Final Balance:', JSON.stringify(finalBal.result.value));
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) await client.close();
    }
}

testUISwap();
