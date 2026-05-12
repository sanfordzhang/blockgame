/**
 * CDP Test for AMM Swap Function
 * 测试 TRX <-> CHIP 兑换功能
 */
const CDP = require('chrome-remote-interface');

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
        
        const { Page, Runtime, Network, DOM } = client;
        
        // Enable domains
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        await DOM.enable();
        
        console.log('[CDP] Navigating to DEX page...');
        await Page.navigate({ url: DEX_URL });
        await Page.loadEventFired();
        await sleep(2000);
        
        // Take screenshot
        console.log('[CDP] Taking initial screenshot...');
        const { data: screenshot1 } = await Page.captureScreenshot();
        require('fs').writeFileSync('dex-initial.png', Buffer.from(screenshot1, 'base64'));
        
        // Check wallet connection
        console.log('[CDP] Checking wallet connection...');
        const walletResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tronLink = window.tronLink;
                    if (!tronLink) return { connected: false, reason: 'TronLink not found' };
                    
                    const ready = await tronLink.ready;
                    return {
                        connected: tronLink.tronWeb && tronLink.tronWeb.defaultAddress && tronLink.tronWeb.defaultAddress.base58,
                        address: tronLink.tronWeb?.defaultAddress?.base58,
                        ready: ready
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] Wallet status:', JSON.stringify(walletResult.result.value, null, 2));
        
        if (!walletResult.result.value.connected) {
            console.log('[CDP] Wallet not connected, attempting to connect...');
            
            // Try to connect wallet
            await Runtime.evaluate({
                expression: `
                    (async () => {
                        try {
                            const result = await window.tronLink.request({ method: 'tron_requestAccounts' });
                            return result;
                        } catch (e) {
                            return { error: e.message };
                        }
                    })()
                `,
                returnByValue: true,
                awaitPromise: true
            });
            
            await sleep(3000);
        }
        
        // Check AMM config
        console.log('[CDP] Checking AMM config...');
        const configResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    try {
                        const res = await fetch('http://127.0.0.1:7778/api/amm/config');
                        const data = await res.json();
                        return data;
                    } catch (e) {
                        return { error: e.message };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] AMM Config:', JSON.stringify(configResult.result.value, null, 2));
        
        // Get swap transaction data for testing
        console.log('[CDP] Getting swap transaction data...');
        const swapTxResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    try {
                        const res = await fetch('http://127.0.0.1:7778/api/amm/tx/swap', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                amountIn: '1000000',
                                direction: 'TRX_TO_CHIP',
                                amountOutMin: '990000',
                                deadline: Math.floor(Date.now() / 1000) + 1200
                            })
                        });
                        const data = await res.json();
                        return data;
                    } catch (e) {
                        return { error: e.message };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] Swap TX Data:', JSON.stringify(swapTxResult.result.value, null, 2));
        
        // Find and fill input
        console.log('[CDP] Finding input field...');
        const inputResult = await Runtime.evaluate({
            expression: `
                (() => {
                    // Find input field
                    const inputs = document.querySelectorAll('input[type="number"]');
                    console.log('Found inputs:', inputs.length);
                    
                    if (inputs.length > 0) {
                        const input = inputs[0];
                        input.focus();
                        input.value = '1';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                        return { found: true, value: input.value };
                    }
                    return { found: false };
                })()
            `,
            returnByValue: true
        });
        
        console.log('[CDP] Input result:', inputResult.result.value);
        
        await sleep(1000);
        
        // Take screenshot after input
        console.log('[CDP] Taking screenshot after input...');
        const { data: screenshot2 } = await Page.captureScreenshot();
        require('fs').writeFileSync('dex-after-input.png', Buffer.from(screenshot2, 'base64'));
        
        // Find and click swap button
        console.log('[CDP] Finding swap button...');
        const buttonResult = await Runtime.evaluate({
            expression: `
                (() => {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.toLowerCase().includes('swap') || 
                            btn.textContent.includes('兑换') ||
                            btn.textContent.includes('swap')) {
                            return { found: true, text: btn.textContent, disabled: btn.disabled };
                        }
                    }
                    return { found: false, buttonsFound: buttons.length };
                })()
            `,
            returnByValue: true
        });
        
        console.log('[CDP] Button result:', buttonResult.result.value);
        
        // Try direct contract call test
        console.log('[CDP] Testing direct contract call...');
        const contractTestResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    try {
                        const tronWeb = window.tronLink?.tronWeb;
                        if (!tronWeb) return { error: 'TronWeb not available' };
                        
                        const routerAddress = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                        const userAddress = tronWeb.defaultAddress?.base58;
                        
                        if (!userAddress) return { error: 'No user address' };
                        
                        // Test triggerSmartContract with proper parameters
                        const functionSelector = 'swapTRXForCHIP(uint256,address,uint256)';
                        const parameters = [
                            { type: 'uint256', value: '990000' },
                            { type: 'address', value: userAddress },
                            { type: 'uint256', value: Math.floor(Date.now() / 1000) + 1200 }
                        ];
                        
                        const args = parameters.map(p => p.value);
                        
                        console.log('Testing with args:', args);
                        
                        // Just test the transaction builder (don't sign/send)
                        const tx = await tronWeb.transactionBuilder.triggerSmartContract(
                            routerAddress,
                            functionSelector,
                            {
                                feeLimit: 100_000_000,
                                callValue: 1000000
                            },
                            args,
                            userAddress
                        );
                        
                        return { success: true, txCreated: !!tx.transaction };
                    } catch (e) {
                        return { error: e.message, stack: e.stack };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] Contract test result:', JSON.stringify(contractTestResult.result.value, null, 2));
        
        // Take final screenshot
        const { data: screenshot3 } = await Page.captureScreenshot();
        require('fs').writeFileSync('dex-final.png', Buffer.from(screenshot3, 'base64'));
        
        // Check for errors in console
        console.log('[CDP] Checking console logs...');
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testSwap();
