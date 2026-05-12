/**
 * CDP Test - Simple Balance Check + Direct Swap
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
        
        // Get initial balance
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
        console.log('[CDP] Initial Balance:', JSON.stringify(initBal.result.value));
        
        // Do direct swap via contract
        console.log('[CDP] Executing direct swap (1 TRX -> CHIP)...');
        const swapResult = await Runtime.evaluate({
            expression: `
                (async () => {
                    const tw = window.tronLink?.tronWeb;
                    const addr = tw.defaultAddress?.base58;
                    
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
                    
                    const amountOutMin = '18000000'; // min 18 CHIP (1 TRX * 20 * 0.9)
                    const deadline = Math.floor(Date.now() / 1000) + 1200;
                    
                    const tx = await contract.methods.swapTRXForCHIP(
                        amountOutMin,
                        addr,
                        deadline
                    ).send({
                        feeLimit: 100_000_000,
                        callValue: 1000000, // 1 TRX
                        shouldPollResponse: false
                    });
                    
                    return { success: true, txHash: tx };
                })()
            `,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('[CDP] Swap Result:', JSON.stringify(swapResult.result.value));
        
        // Wait for confirmation
        await sleep(5000);
        
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
        
        // Calculate difference
        const init = initBal.result.value;
        const fin = finalBal.result.value;
        console.log('[CDP] === Balance Changes ===');
        console.log(`[CDP] TRX: ${init.trx} -> ${fin.trx} (delta: ${(fin.trx - init.trx).toFixed(4)})`);
        console.log(`[CDP] CHIP: ${init.chip} -> ${fin.chip} (delta: ${(fin.chip - init.chip).toFixed(4)})`);
        
    } catch (error) {
        console.error('[CDP] Error:', error);
    } finally {
        if (client) await client.close();
    }
}

test();
