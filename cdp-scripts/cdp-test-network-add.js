/**
 * CDP Test: Verify Mainnet vs Testnet Network Add Logic
 *
 * Test flow:
 * 1. Navigate to localhost:80 (mainnet) or localhost:3001 (testnet)
 * 2. Inject mock MetaMask that logs all wallet_* calls
 * 3. Click "0G / EVM" button
 * 4. Verify correct network params are used (mainnet: 16661/0x4115, testnet: 16602/0x40DA)
 *
 * Usage:
 *   node cdp-scripts/cdp-test-network-add.js mainnet   # Test port 80 (mainnet)
 *   node cdp-scripts/cdp-test-network-add.js testnet   # Test port 3001 (testnet)
 *   node cdp-scripts/cdp-test-network-add.js all       # Test both
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER_ADDRESS = '0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5';

// Network configs matching zeroGInteract.js
const NETWORK_CONFIGS = {
    testnet: {
        port: '3001',
        url: 'http://127.0.0.1:3001/',
        chainId: '0x40DA',
        chainIdNum: 16602,
        name: '0G Testnet',
        rpcUrl: 'https://evmrpc-galileo.0g.ai',
        blockExplorer: 'https://chainscan-galileo.0g.ai'
    },
    mainnet: {
        port: '80',
        url: 'http://127.0.0.1/',
        chainId: '0x4115',
        chainIdNum: 16661,
        name: '0G Mainnet',
        rpcUrl: 'https://evmrpc.0g.ai',
        blockExplorer: 'https://chainscan.0g.ai'
    }
};

// Store intercepted wallet API calls
let capturedCalls = [];

async function testNetwork(networkType) {
    const config = NETWORK_CONFIGS[networkType];
    console.log('\n' + '='.repeat(70));
    console.log(`TESTING: ${config.name} (${networkType})`);
    console.log(`URL: ${config.url}`);
    console.log(`Expected chainId: ${config.chainId} (${config.chainIdNum})`);
    console.log(`Expected RPC: ${config.rpcUrl}`);
    console.log('='.repeat(70));

    capturedCalls = [];

    let client;
    try {
        // Step 1: Navigate to target page
        console.log('\n[1] Navigating to', config.url);
        client = await CDP({ port: 9222 });
        let { Page } = client;
        await Page.enable();
        await Page.navigate({ url: config.url + '?v=' + Date.now() });
        await client.close();

        // Wait for page load (React needs time to render)
        console.log('    Waiting for React to render...');
        // Reconnect and poll for page readiness
        client = await CDP({ port: 9222 });
        const { Page: P2Wait, Runtime: RWait } = client;
        await P2Wait.enable();
        await RWait.enable();

        let ready = false;
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const check = await RWait.evaluate({
                expression: '(function() { var b = Array.from(document.querySelectorAll("button, [role=button]")); return { ready: b.length > 2, btnCount: b.length, text: (document.body||{}).innerText?.substring(0,200) }; })()',
                returnByValue: true
            });
            process.stdout.write('.');
            if (check.result.value.ready || check.result.value.text.includes('Connect')) {
                ready = true;
                break;
            }
        }
        console.log(ready ? ' Ready!' : ' Timeout');

        await client.close();

        if (!ready) {
            console.log('\n✗ FAIL: Page did not fully load in time');
            console.log('  The React app may be stuck on loading screen');
            console.log('  Try refreshing the browser manually and re-run');
            return false;
        }

        // Final wait before injection
        await new Promise(r => setTimeout(r, 1000));

        // Step 2: Reconnect and inject mock MetaMask with logging
        console.log('[2] Injecting mock MetaMask...');
        client = await CDP({ port: 9222 });
        const { Page: P2, Runtime } = client;
        await P2.enable();
        await Runtime.enable();

        // Inject MetaMock that captures all wallet_* calls
        await Runtime.evaluate({
            expression: `
(function() {
    var ADDR = '${PLAYER_ADDRESS}';
    // Start with a different chain so switch is required
    var CURRENT_CHAIN = '0x1'; // Ethereum mainnet (not 0G)
    var TARGET_CHAIN = '${config.chainId}';

    window.__walletCalls = [];
    window.__mockMetaMask = {
        isMetaMask: true,
        _isMock: true,

        request: async function(args) {
            var m = args.method;
            var p = args.params || [];
            var callInfo = { method: m, params: p, timestamp: Date.now() };

            switch(m) {
                case 'eth_requestAccounts':
                    callInfo.result = [ADDR];
                    window.__walletCalls.push(callInfo);
                    return [ADDR];

                case 'eth_accounts':
                    callInfo.result = [ADDR];
                    window.__walletCalls.push(callInfo);
                    return [ADDR];

                case 'eth_chainId':
                    callInfo.result = CURRENT_CHAIN;
                    window.__walletCalls.push(callInfo);
                    return CURRENT_CHAIN;

                case 'eth_getBalance':
                    callInfo.result = '0xde0b6b3a7640000'; // 1 ETH
                    window.__walletCalls.push(callInfo);
                    return '0xde0b6b3a7640000';

                case 'wallet_switchEthereumChain':
                    // Simulate success on first call, or 4902 if not added yet
                    // For testing, always succeed after logging
                    callInfo.params = p;
                    window.__walletCalls.push(callInfo);

                    // Check if switching to our target chain
                    if (p[0] && p[0].chainId === TARGET_CHAIN) {
                        CURRENT_CHAIN = TARGET_CHAIN; // Switch successful
                        this.chainId = TARGET_CHAIN;
                        this.selectedAddress = ADDR;
                        setTimeout(() => {
                            this.emit('chainChanged', TARGET_CHAIN);
                        }, 100);
                        return null;
                    }
                    // Return 4902 for unknown chains (triggers addEthereumChain)
                    var err = new Error('wallet_addEthereumChain');
                    err.code = 4902;
                    throw err;

                case 'wallet_addEthereumChain':
                    callInfo.params = p;
                    callInfo.fullParams = JSON.stringify(p[0]);
                    window.__walletCalls.push(callInfo);
                    // Log the add params for verification
                    console.log('[MOCK] wallet_addEthereumChain called with:', JSON.stringify(p[0], null, 2));
                    return null;

                case 'personal_sign':
                    callInfo.result = '0x' + 'a'.repeat(130);
                    window.__walletCalls.push(callInfo);
                    return callInfo.result;

                case 'eth_sendTransaction':
                    callInfo.result = '0x' + '1'.repeat(64);
                    window.__walletCalls.push(callInfo);
                    return callInfo.result;

                default:
                    callInfo.result = null;
                    window.__walletCalls.push(callInfo);
                    return null;
            }
        },

        on: function(e, h) {
            if (!this._e) this._e = {};
            if (!this._e[e]) this._e[e] = [];
            this._e[e].push(h);
        },

        removeListener: function(e, h) {
            if (!this._e) return;
            if (this._e[e]) this._e[e] = this._e[e].filter(function(x) { return x !== h; });
        },

        emit: function(e, d) {
            if (!this._e || !this._e[e]) return;
            this._e[e].forEach(function(h) { try { h(d); } catch(ex) {} });
        },

        chainId: CURRENT_CHAIN,
        selectedAddress: null,
        networkVersion: String(${config.chainIdNum})
    };

    // Force inject
    Object.defineProperty(window, 'ethereum', {
        value: window.__mockMetaMask,
        writable: true,
        configurable: true
    });

    // Emit initial events after short delay
    setTimeout(function() {
        window.ethereum.emit('accountsChanged', [ADDR]);
    }, 200);

    return {
        injected: true,
        address: ADDR,
        currentChain: CURRENT_CHAIN,
        targetChain: TARGET_CHAIN
    };
})()`,
            returnByValue: true,
            awaitPromise: true
        });

        // Verify injection
        const verify = await Runtime.evaluate({
            expression: `({
                hasEth: !!window.ethereum,
                addr: window.ethereum?.selectedAddress || window.ethereum?._mockMetaMask?.selectedAddress,
                chainId: window.ethereum?.chainId,
                isMock: window.ethereum?._isMock
            })`,
            returnByValue: true
        });
        console.log('[2] Injection verified:', JSON.stringify(verify.result.value));

        // Step 3: Screenshot before click
        const screenshotDir = 'logs';
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

        const ssBefore = await P2.captureScreenshot({ format: 'png' });
        fs.writeFileSync(`${screenshotDir}/network-${networkType}-before.png`, Buffer.from(ssBefore.data, 'base64'));
        console.log('[3] Screenshot saved:', `${screenshotDir}/network-${networkType}-before.png`);

        // Step 4: Check page content and find 0G button
        const pageInfo = await Runtime.evaluate({
            expression: `(function() {
                var btns = Array.from(document.querySelectorAll('button'));
                var ogBtn = btns.find(function(b) { return /0[Gg]\\s*\\/\\s*EVM/i.test(b.textContent); });
                var networkIndicator = document.body.innerText.match(/0G\\s+(Mainnet|Testnet)\\s*\\(\\d+\\)/);
                var portInfo = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
                return {
                    buttonFound: !!ogBtn,
                    buttonText: ogBtn ? ogBtn.textContent.trim() : null,
                    networkIndicator: networkIndicator ? networkIndicator[0] : null,
                    port: portInfo,
                    allButtons: btns.map(function(b) { return b.textContent.trim(); })
                };
            })()`,
            returnByValue: true
        });

        console.log('[4] Page info:');
        console.log('    Port detected:', pageInfo.result.value.port);
        console.log('    0G Button found:', pageInfo.result.value.buttonFound);
        console.log('    0G Button text:', pageInfo.result.value.buttonText);
        console.log('    Network indicator:', pageInfo.result.value.networkIndicator);

        // Verify network indicator shows correct network
        const expectedNetworkText = networkType === 'mainnet' ? '0G Mainnet' : '0G Testnet';
        if (pageInfo.result.value.networkIndicator && pageInfo.result.value.networkIndicator.includes(expectedNetworkText)) {
            console.log('    ✓ Network indicator CORRECT');
        } else {
            console.log('    ✗ Network indicator WRONG! Expected:', expectedNetworkText);
        }

        // Step 5: Click 0G / EVM button
        if (!pageInfo.result.value.buttonFound) {
            console.log('\n✗ FAIL: 0G/EVM button not found!');
            console.log('Available buttons:', pageInfo.result.value.allButtons);
            await client.close();
            return false;
        }

        console.log('\n[5] Clicking 0G / EVM button...');
        await Runtime.evaluate({
            expression: `(function() {
                var btns = Array.from(document.querySelectorAll('button'));
                var btn = btns.find(function(b) { return /0[Gg]/i.test(b.textContent); });
                if (btn) { btn.click(); return 'clicked'; }
                return 'not found';
            })()`,
            returnByValue: true
        });

        // Wait for operations to complete
        console.log('[6] Waiting 5s for wallet operations...');
        await new Promise(r => setTimeout(r, 5000));

        // Step 7: Capture screenshot after click
        const ssAfter = await P2.captureScreenshot({ format: 'png' });
        fs.writeFileSync(`${screenshotDir}/network-${networkType}-after.png`, Buffer.from(ssAfter.data, 'base64'));
        console.log('[7] Screenshot saved:', `${screenshotDir}/network-${networkType}-after.png`);

        // Step 8: Get captured wallet calls
        const callsResult = await Runtime.evaluate({
            expression: `window.__walletCalls || []`,
            returnByValue: true
        });
        const walletCalls = callsResult.result.value;

        console.log('\n[8] Captured Wallet API Calls (' + walletCalls.length + '):');
        walletCalls.forEach((call, i) => {
            const paramsStr = call.method === 'wallet_addEthereumChain'
                ? '\n         Params: ' + (call.fullParams || JSON.stringify(call.params))
                : '';
            console.log('    [' + i + '] ' + call.method + paramsStr);
        });

        // Step 9: Verify results
        console.log('\n' + '-'.repeat(50));
        console.log('VERIFICATION RESULTS for', networkType.toUpperCase());
        console.log('-'.repeat(50));

        let passed = true;
        const errors = [];

        // Check 1: eth_requestAccounts was called
        const hasRequestAccounts = walletCalls.some(c => c.method === 'eth_requestAccounts');
        if (hasRequestAccounts) {
            console.log('✓ eth_requestAccounts called');
        } else {
            console.log('✗ eth_requestAccounts NOT called');
            passed = false;
            errors.push('eth_requestAccounts missing');
        }

        // Check 2: wallet_switchEthereumChain called with correct chainId
        const switchCall = walletCalls.find(c => c.method === 'wallet_switchEthereumChain');
        if (switchCall && switchCall.params && switchCall.params[0]?.chainId === config.chainId) {
            console.log('✓ wallet_switchEthereumChain called with correct chainId:', config.chainId);
        } else if (switchCall) {
            console.log('✗ wallet_switchEthereumChain called but WRONG chainId:',
                switchCall.params ? switchCall.params[0]?.chainId : 'no params');
            passed = false;
            errors.push('Wrong switch chainId');
        } else {
            console.log('? wallet_switchEthereumChain NOT called (may have gone directly to add)');
        }

        // Check 3: If wallet_addEthereumChain called, verify params match expected network
        const addCall = walletCalls.find(c => c.method === 'wallet_addEthereumChain');
        if (addCall && addCall.params && addCall.params[0]) {
            const addParams = addCall.params[0];
            console.log('\n  wallet_addEthereumChain params verification:');

            // Check chainId
            if (addParams.chainId === config.chainId) {
                console.log('  ✓ chainId correct:', addParams.chainId);
            } else {
                console.log('  ✗ chainId WRONG! Expected:', config.chainId, 'Got:', addParams.chainId);
                passed = false;
                errors.push('Wrong add chainId: ' + addParams.chainId);
            }

            // Check chainName
            if (addParams.chainName === config.name) {
                console.log('  ✓ chainName correct:', addParams.chainName);
            } else {
                console.log('  ✗ chainName WRONG! Expected:', config.name, 'Got:', addParams.chainName);
                passed = false;
                errors.push('Wrong chainName: ' + addParams.chainName);
            }

            // Check rpcUrls contains expected RPC
            if (addParams.rpcUrls && addParams.rpcUrls.includes(config.rpcUrl)) {
                console.log('  ✓ rpcUrls correct, includes:', config.rpcUrl);
            } else {
                console.log('  ✗ rpcUrls WRONG! Expected to include:', config.rpcUrl, 'Got:', JSON.stringify(addParams.rpcUrls));
                passed = false;
                errors.push('Wrong rpcUrls');
            }

            // Check blockExplorerUrls
            if (addParams.blockExplorerUrls && addParams.blockExplorerUrls.includes(config.blockExplorer)) {
                console.log('  ✓ blockExplorerUrls correct, includes:', config.blockExplorer);
            } else {
                console.log('  ✗ blockExplorerUrls WRONG!');
                passed = false;
                errors.push('Wrong blockExplorerUrls');
            }
        } else {
            // No add call means either already on correct chain (switch succeeded) or issue
            console.log('? wallet_addEthereumChain NOT called (network may be pre-added)');
        }

        // Check 4: localStorage updated correctly
        const storageResult = await Runtime.evaluate({
            expression: `({
                type: localStorage.getItem('wallet_type'),
                address: localStorage.getItem('wallet_address'),
                network: localStorage.getItem('zerog_network')
            })`,
            returnByValue: true
        });
        const storage = storageResult.result.value;
        console.log('\n  localStorage state:');
        console.log('    wallet_type:', storage.type);
        console.log('    wallet_address:', storage.address);
        console.log('    zerog_network:', storage.network);

        if (storage.type === 'zerog') {
            console.log('  ✓ wallet_type set to zerog');
        } else {
            console.log('  ? wallet_type not set (connection may have failed)');
        }

        if (storage.network === networkType) {
            console.log('  ✓ zerog_network correct:', storage.network);
        } else if (!storage.network) {
            console.log('  ? zerog_network not set');
        } else {
            console.log('  ✗ zerog_network WRONG! Expected:', networkType, 'Got:', storage.network);
            passed = false;
            errors.push('Wrong stored network: ' + storage.network);
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        if (passed) {
            console.log('RESULT: PASS ✓ -', networkType, 'network logic works correctly!');
        } else {
            console.log('RESULT: FAIL ✗ - Errors found:');
            errors.forEach((e, i) => console.log('  ', i+1 + '.', e));
        }
        console.log('='.repeat(50));

        await client.close();
        return passed;

    } catch (err) {
        console.error('\nERROR in testNetwork(', networkType, '):', err.message);
        if (client) try { await client.close(); } catch(e) {}
        return false;
    }
}

// Main execution
(async function() {
    const mode = process.argv[2] || 'all';

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     CDP Test: Mainnet/Testnet Network Add Logic       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('Mode:', mode);
    console.log('');

    const results = {};

    if (mode === 'mainnet' || mode === 'all') {
        results.mainnet = await testNetwork('mainnet');
    }

    if (mode === 'testnet' || mode === 'all') {
        results.testnet = await testNetwork('testnet');
    }

    // Final summary
    console.log('\n\n' + '═'.repeat(60));
    console.log('FINAL TEST SUMMARY');
    console.log('═'.repeat(60));

    Object.keys(results).forEach(network => {
        const status = results[network] ? 'PASS ✓' : 'FAIL ✗';
        console.log('  ' + network.padEnd(10), '-', status);
    });

    const allPassed = Object.values(results).every(v => v);
    console.log('\nOverall:', allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗');

    process.exit(allPassed ? 0 : 1);
})();
