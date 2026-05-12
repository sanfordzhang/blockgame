/**
 * CDP Test - Diagnose Swap Issue
 */
const CDP = require('chrome-remote-interface');

const DEX_URL = 'http://127.0.0.1:3001/dex';
const CDP_PORT = 9222;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
    let client;
    
    try {
        console.log('[CDP] Connecting...');
        client = await CDP({ port: CDP_PORT });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();
        
        // Navigate
        await Page.navigate({ url: DEX_URL });
        await Page.loadEventFired();
        await sleep(2000);
        
        // Check TronLink status
        const status = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tl = window.tronLink;
                    const tw = tl?.tronWeb;
                    
                    if (!tw) return { error: 'TronWeb not available' };
                    
                    const addr = tw.defaultAddress?.base58;
                    if (!addr) return { error: 'No address' };
                    
                    // Check if ready
                    const ready = await tl.ready;
                    
                    // Get balance
                    let trxBalance = 0;
                    try {
                        const bal = await tw.trx.getBalance(addr);
                        trxBalance = parseInt(bal) / 1e6;
                    } catch (e) {}
                    
                    return {
                        ready,
                        address: addr,
                        trxBalance: trxBalance.toFixed(4),
                        hasTronLink: !!tl,
                        hasTronWeb: !!tw,
                        node: tw.fullNode?.host
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Status:', JSON.stringify(status.result.value, null, 2));
        
        // Try to check router contract
        const routerCheck = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const router = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                    
                    try {
                        // Check if we can read from router
                        const contract = await tw.contract().at(router);
                        const methods = Object.keys(contract).filter(k => typeof contract[k] === 'function' && !k.startsWith('_'));
                        
                        return {
                            success: true,
                            methods: methods.slice(0, 10),
                            hasSwapTRXForCHIP: methods.includes('swapTRXForCHIP')
                        };
                    } catch (e) {
                        return { error: e.message };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Router check:', JSON.stringify(routerCheck.result.value, null, 2));
        
        // Try a simpler transaction - just check the pool info
        const poolInfo = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const pool = 'TDoYGYAgPLrWTSjsANUuAjEFaAKr3oBo3v';
                    
                    try {
                        const contract = await tw.contract().at(pool);
                        const info = await contract.getPoolInfo().call();
                        
                        return {
                            reserveTRX: (parseInt(info[0]) / 1e6).toFixed(4),
                            reserveCHIP: (parseInt(info[1]) / 1e6).toFixed(4),
                            totalSupply: (parseInt(info[2]) / 1e6).toFixed(4)
                        };
                    } catch (e) {
                        return { error: e.message };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Pool info:', JSON.stringify(poolInfo.result.value, null, 2));
        
        // Try swap with explicit confirm
        console.log('[CDP] Attempting swap with explicit wait...');
        const swapResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const addr = tw.defaultAddress?.base58;
                    const router = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                    
                    try {
                        // Build the transaction first
                        const functionSelector = 'swapTRXForCHIP(uint256,address,uint256)';
                        const parameters = [
                            { type: 'uint256', value: '18000000' },
                            { type: 'address', value: addr },
                            { type: 'uint256', value: Math.floor(Date.now() / 1000) + 600 }
                        ];
                        
                        // Use transactionBuilder
                        const tx = await tw.transactionBuilder.triggerSmartContract(
                            router,
                            functionSelector,
                            {
                                feeLimit: 100_000_000,
                                callValue: 1000000
                            },
                            parameters,
                            addr
                        );
                        
                        return { 
                            step: 'transactionBuilt',
                            txId: tx.transaction?.txID,
                            success: !!tx.transaction
                        };
                    } catch (e) {
                        return { 
                            error: e.message,
                            step: 'failed'
                        };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Swap build result:', JSON.stringify(swapResult.result.value, null, 2));
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) await client.close();
    }
}

test();
