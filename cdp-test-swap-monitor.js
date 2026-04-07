/**
 * CDP Test for DEX Swap - Monitor Console
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const DEX_URL = 'http://127.0.0.1:3001/dex';
const CDP_PORT = 9222;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSwapWithConsole() {
    let client;
    const logs = [];
    
    try {
        console.log('[CDP] Connecting to Chrome...');
        client = await CDP({ port: CDP_PORT });
        
        const { Page, Runtime, Console, Network } = client;
        
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        
        // Enable console
        try {
            await Console.enable();
            Console.messageAdded((params) => {
                const msg = `[${params.message.level}] ${params.message.text}`;
                logs.push(msg);
                console.log('[Browser]', msg);
            });
        } catch (e) {
            console.log('[CDP] Console not available, using Runtime');
        }
        
        // Listen for console API calls
        Runtime.consoleAPICalled((params) => {
            const args = params.args.map(a => a.value || a.description || '').join(' ');
            const msg = `[${params.type}] ${args}`;
            logs.push(msg);
            console.log('[Browser Console]', msg);
        });
        
        // Listen for exceptions
        Runtime.exceptionThrown((params) => {
            const msg = `[Exception] ${params.exceptionDetails.text} - ${params.exceptionDetails.exception?.message}`;
            logs.push(msg);
            console.log('[Browser Exception]', msg);
        });
        
        console.log('[CDP] Navigating to DEX page...');
        await Page.navigate({ url: DEX_URL });
        await Page.loadEventFired();
        await sleep(3000);
        
        // Check wallet balance first
        const balanceCheck = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tronWeb = window.tronLink?.tronWeb;
                    if (!tronWeb) return { error: 'No TronWeb' };
                    
                    const address = tronWeb.defaultAddress?.base58;
                    const trxBalance = await tronWeb.trx.getBalance(address);
                    
                    // Check CHIP balance
                    const chipAddress = 'TFWScXGFALnK9D79zf5jrnw5on7aqJiaY3';
                    const chipContract = await tronWeb.contract().at(chipAddress);
                    const chipBalance = await chipContract.balanceOf(address).call();
                    
                    return {
                        address,
                        trxSun: trxBalance.toString(),
                        trxBalance: (parseInt(trxBalance) / 1e6).toFixed(6),
                        chipSun: chipBalance.toString(),
                        chipBalance: (parseInt(chipBalance) / 1e6).toFixed(6)
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Balances:', JSON.stringify(balanceCheck.result.value, null, 2));
        
        // Set input and do swap
        await Runtime.evaluate({
            expression: `
                (() => {
                    const input = document.querySelectorAll('input[type="number"]')[0];
                    if (input) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set;
                        nativeInputValueSetter.call(input, '1');
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                })()
            `,
            returnByValue: true
        });
        
        await sleep(2000);
        
        // Click swap
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
        
        // Wait for transaction to complete
        console.log('[CDP] Waiting for transaction...');
        await sleep(10000);
        
        // Check final balance
        const finalBalance = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tronWeb = window.tronLink?.tronWeb;
                    const address = tronWeb.defaultAddress?.base58;
                    const trxBalance = await tronWeb.trx.getBalance(address);
                    
                    const chipAddress = 'TFWScXGFALnK9D79zf5jrnw5on7aqJiaY3';
                    const chipContract = await tronWeb.contract().at(chipAddress);
                    const chipBalance = await chipContract.balanceOf(address).call();
                    
                    return {
                        trxBalance: (parseInt(trxBalance) / 1e6).toFixed(6),
                        chipBalance: (parseInt(chipBalance) / 1e6).toFixed(6)
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Final balances:', JSON.stringify(finalBalance.result.value, null, 2));
        
        // Take screenshot
        const screenshot = (await Page.captureScreenshot()).data;
        fs.writeFileSync('dex-swap-complete.png', Buffer.from(screenshot, 'base64'));
        console.log('[CDP] Screenshot saved: dex-swap-complete.png');
        
        // Print all logs
        console.log('\n[CDP] === All Console Logs ===');
        logs.forEach(log => console.log(log));
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testSwapWithConsole();
