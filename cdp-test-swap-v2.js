/**
 * CDP Test for AMM Swap - Using contract() method
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
        
        const { Page, Runtime, Network } = client;
        
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        
        console.log('[CDP] Navigating to DEX page...');
        await Page.navigate({ url: DEX_URL });
        await Page.loadEventFired();
        await sleep(2000);
        
        // Test different methods to call contract
        console.log('[CDP] Testing contract call methods...');
        
        // Method 1: Use contract().at() and call method directly
        const test1 = await Runtime.evaluate({
            expression: `
                (async () => {
                    try {
                        const tronWeb = window.tronLink?.tronWeb;
                        if (!tronWeb) return { error: 'TronWeb not available' };
                        
                        const routerAddress = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                        const userAddress = tronWeb.defaultAddress?.base58;
                        
                        // Get contract instance using tronWeb.contract()
                        const contract = await tronWeb.contract().at(routerAddress);
                        
                        // Check if swapTRXForCHIP method exists
                        const methods = Object.keys(contract).filter(k => typeof contract[k] === 'function');
                        
                        return { 
                            success: true, 
                            hasContract: !!contract,
                            methods: methods.slice(0, 20),
                            hasSwapMethod: typeof contract.swapTRXForCHIP === 'function'
                        };
                    } catch (e) {
                        return { error: e.message };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] Contract test 1:', JSON.stringify(test1.result.value, null, 2));
        
        // Method 2: Build transaction manually
        const test2 = await Runtime.evaluate({
            expression: `
                (async () => {
                    try {
                        const tronWeb = window.tronLink?.tronWeb;
                        if (!tronWeb) return { error: 'TronWeb not available' };
                        
                        const routerAddress = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                        const userAddress = tronWeb.defaultAddress?.base58;
                        
                        // Check tronWeb.transactionBuilder methods
                        const methods = Object.keys(tronWeb.transactionBuilder || {});
                        
                        // Try to use triggerSmartContract with different parameter format
                        const functionSelector = 'swapTRXForCHIP(uint256,address,uint256)';
                        
                        // Use parameterInfo format
                        const parameterInfo = [
                            { type: 'uint256', value: '990000' },
                            { type: 'address', value: userAddress },
                            { type: 'uint256', value: Math.floor(Date.now() / 1000) + 1200 }
                        ];
                        
                        console.log('Testing with parameterInfo format:', parameterInfo);
                        
                        const tx = await tronWeb.transactionBuilder.triggerSmartContract(
                            routerAddress,
                            functionSelector,
                            {
                                feeLimit: 100_000_000,
                                callValue: 1000000
                            },
                            parameterInfo,
                            userAddress
                        );
                        
                        return { success: true, hasTransaction: !!tx };
                    } catch (e) {
                        return { error: e.message, stack: e.stack?.substring(0, 500) };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] Contract test 2:', JSON.stringify(test2.result.value, null, 2));
        
        // Method 3: Use contract with ABI
        const test3 = await Runtime.evaluate({
            expression: `
                (async () => {
                    try {
                        const tronWeb = window.tronLink?.tronWeb;
                        if (!tronWeb) return { error: 'TronWeb not available' };
                        
                        const routerAddress = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                        const userAddress = tronWeb.defaultAddress?.base58;
                        
                        // Define ABI for swap function
                        const abi = [{
                            inputs: [
                                { name: 'amountOutMin', type: 'uint256' },
                                { name: 'to', type: 'address' },
                                { name: 'deadline', type: 'uint256' }
                            ],
                            name: 'swapTRXForCHIP',
                            outputs: [],
                            stateMutability: 'payable',
                            type: 'function'
                        }];
                        
                        // Create contract instance with ABI
                        const contract = tronWeb.contract(abi, routerAddress);
                        
                        // Call the function (don't send yet, just test)
                        const amountOutMin = '990000';
                        const deadline = Math.floor(Date.now() / 1000) + 1200;
                        
                        // This should create the call object
                        const call = contract.methods.swapTRXForCHIP(amountOutMin, userAddress, deadline);
                        
                        return { 
                            success: true, 
                            hasCall: !!call,
                            callMethods: Object.keys(call)
                        };
                    } catch (e) {
                        return { error: e.message, stack: e.stack?.substring(0, 500) };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] Contract test 3:', JSON.stringify(test3.result.value, null, 2));
        
        // Method 4: Actually send the transaction using contract().send()
        console.log('[CDP] Attempting actual swap transaction...');
        const swapResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    try {
                        const tronWeb = window.tronLink?.tronWeb;
                        if (!tronWeb) return { error: 'TronWeb not available' };
                        
                        const routerAddress = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                        const userAddress = tronWeb.defaultAddress?.base58;
                        
                        // Define ABI
                        const abi = [{
                            inputs: [
                                { name: 'amountOutMin', type: 'uint256' },
                                { name: 'to', type: 'address' },
                                { name: 'deadline', type: 'uint256' }
                            ],
                            name: 'swapTRXForCHIP',
                            outputs: [],
                            stateMutability: 'payable',
                            type: 'function'
                        }];
                        
                        const contract = tronWeb.contract(abi, routerAddress);
                        
                        const amountOutMin = '990000'; // min output (1 TRX * 20 CHIP * 0.99)
                        const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min
                        
                        console.log('[Swap] Calling swapTRXForCHIP with:', {
                            amountOutMin,
                            to: userAddress,
                            deadline,
                            callValue: 1000000
                        });
                        
                        // Send the transaction
                        const result = await contract.methods.swapTRXForCHIP(
                            amountOutMin,
                            userAddress,
                            deadline
                        ).send({
                            feeLimit: 100_000_000,
                            callValue: 1000000, // 1 TRX
                            shouldPollResponse: false
                        });
                        
                        return { success: true, result };
                    } catch (e) {
                        return { error: e.message, stack: e.stack?.substring(0, 800) };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        
        console.log('[CDP] Swap result:', JSON.stringify(swapResult.result.value, null, 2));
        
        // Take screenshot
        const { data: screenshot } = await Page.captureScreenshot();
        fs.writeFileSync('dex-swap-result.png', Buffer.from(screenshot, 'base64'));
        console.log('[CDP] Screenshot saved to dex-swap-result.png');
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testSwap();
