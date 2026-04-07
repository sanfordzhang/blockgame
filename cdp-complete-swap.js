/**
 * CDP Test - Complete Swap with Sign and Send
 */
const CDP = require('chrome-remote-interface');

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
        
        // Get initial balance
        console.log('[CDP] Getting initial balance...');
        const initBal = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const addr = tw.defaultAddress?.base58;
                    const trx = await tw.trx.getBalance(addr);
                    
                    const chipContract = await tw.contract().at('TFWScXGFALnK9D79zf5jrnw5on7aqJiaY3');
                    const chip = await chipContract.balanceOf(addr).call();
                    
                    return {
                        address: addr,
                        trx: (parseInt(trx) / 1e6).toFixed(4),
                        chip: (parseInt(chip) / 1e6).toFixed(4)
                    };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Initial:', JSON.stringify(initBal.result.value));
        
        // Execute swap using contract().send()
        console.log('[CDP] Executing swap via contract().send()...');
        const swapResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const addr = tw.defaultAddress?.base58;
                    
                    // ABI for swap function
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
                    
                    const router = 'TXfeHckcmZeigv1ixUyFkTc9q7NHNGfcPJ';
                    const contract = tw.contract(abi, router);
                    
                    const amountOutMin = '18000000'; // ~18 CHIP minimum
                    const deadline = Math.floor(Date.now() / 1000) + 600;
                    
                    console.log('[Swap] Sending transaction...');
                    
                    try {
                        const tx = await contract.methods.swapTRXForCHIP(
                            amountOutMin,
                            addr,
                            deadline
                        ).send({
                            feeLimit: 100_000_000,
                            callValue: 1000000, // 1 TRX
                            shouldPollResponse: false
                        });
                        
                        console.log('[Swap] Transaction sent:', tx);
                        return { success: true, txHash: tx };
                    } catch (e) {
                        console.error('[Swap] Error:', e);
                        return { error: e.message };
                    }
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Swap result:', JSON.stringify(swapResult.result.value));
        
        // Wait for confirmation
        console.log('[CDP] Waiting for confirmation...');
        await sleep(8000);
        
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
        console.log('[CDP] Final:', JSON.stringify(finalBal.result.value));
        
        // Show balance change
        if (initBal.result.value.trx && finalBal.result.value.trx) {
            const init = initBal.result.value;
            const fin = finalBal.result.value;
            console.log('\n[CDP] === Balance Change ===');
            console.log(`[CDP] TRX: ${init.trx} -> ${fin.trx}`);
            console.log(`[CDP] CHIP: ${init.chip} -> ${fin.chip}`);
            console.log(`[CDP] Delta TRX: ${(fin.trx - init.trx).toFixed(4)}`);
            console.log(`[CDP] Delta CHIP: ${(fin.chip - init.chip).toFixed(4)}`);
        }
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) await client.close();
    }
}

test();
