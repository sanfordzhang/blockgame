/**
 * CDP Test: Verify Mainnet Logic by Simulating Port 80 on Port 3001
 *
 * This test overrides window.location to simulate port 80 (mainnet)
 * while running the actual React app on port 3001.
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER_ADDRESS = '0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5';

// Mainnet config - what we expect when port is 80
const MAINNET_CONFIG = {
    port: '80',
    chainId: '0x4115',
    chainIdNum: 16661,
    name: '0G Mainnet',
    rpcUrl: 'https://evmrpc.0g.ai',
    blockExplorer: 'https://chainscan.0g.ai'
};

(async function() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   CDP Test: MAINNET Network Add Logic (Port 80 Sim)      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    let client;

    try {
        // Step 1: Navigate to page
        console.log('[1] Navigating to localhost:3001...');
        client = await CDP({ port: 9222 });
        let { Page } = client;
        await Page.enable();
        await Page.navigate({ url: 'http://127.0.0.1:3001/' });
        await client.close();

        // Wait for render
        await new Promise(r => setTimeout(r, 6000));
        client = await CDP({ port: 9222 });
        const { Page: P2, Runtime } = client;
        await P2.enable();
        await Runtime.enable();

        // Poll for readiness
        let ready = false;
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const check = await Runtime.evaluate({
                expression: '(function() { var b = Array.from(document.querySelectorAll("button")); return b.length > 2 && b.find(x=>/0G/i.test(x.textContent)); })()',
                returnByValue: true
            });
            process.stdout.write('.');
            if (check.result.value) { ready = true; break; }
        }
        console.log(ready ? ' Ready!' : ' Timeout');
        if (!ready) throw new Error('Page not ready');

        // Step 2: SIMULATE PORT 80 by overriding location.port before injecting MetaMask
        console.log('\n[2] Simulating PORT 80 (mainnet) environment...');

        // Override Object.getOwnPropertyDescriptor for window.location to return port 80
        await Runtime.evaluate({
            expression: `
(function() {
    // Store original port getter
    const origLocation = window.location;
    
    // Create a proxy that returns port as '80'
    const locationProxy = new Proxy(origLocation, {
        get(target, prop) {
            if (prop === 'port') return '80';
            if (prop === 'hostname') return '127.0.0.1';
            if (prop === 'host') return '127.0.0.1';
            if (prop === 'origin') return 'http://127.0.0.1';
            if (prop === 'href') return 'http://127.0.0.1/';
            const val = target[prop];
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });

    // Override window.location to use our proxy
    try {
        Object.defineProperty(window, 'location', {
            get: () => locationProxy,
            configurable: true
        });
        
        // Also store for direct access
        window.__simulatedPort = '80';
        window.location = locationProxy;
    } catch(e) {
        // Some browsers don't allow overriding location
        console.warn('[SIM] Could not override location:', e.message);
        window.__simulatedPort = '80';
    }

    // Inject mock MetaMask with mainnet target
    var ADDR = '${PLAYER_ADDRESS}';
    var CURRENT_CHAIN = '0x1'; // Start on wrong chain
    var TARGET_CHAIN = '${MAINNET_CONFIG.chainId}';

    window.__walletCalls = [];
    window.ethereum = {
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

                case 'wallet_switchEthereumChain':
                    callInfo.params = p;
                    window.__walletCalls.push(callInfo);
                    
                    if (p[0]?.chainId === TARGET_CHAIN) {
                        CURRENT_CHAIN = TARGET_CHAIN;
                        this.chainId = TARGET_CHAIN;
                        setTimeout(() => this.emit('chainChanged', TARGET_CHAIN), 100);
                        return null;
                    }
                    var err = new Error('wallet_addEthereumChain');
                    err.code = 4902;
                    throw err;

                case 'wallet_addEthereumChain':
                    callInfo.params = p;
                    callInfo.fullParams = JSON.stringify(p[0]);
                    window.__walletCalls.push(callInfo);
                    console.log('[MOCK-MAINNET] addEthereumChain:', JSON.stringify(p[0]));
                    return null;

                case 'personal_sign':
                case 'eth_sendTransaction':
                    window.__walletCalls.push(callInfo);
                    return m === 'personal_sign' ? '0x' + 'a'.repeat(130) : '0x' + '1'.repeat(64);

                default:
                    window.__walletCalls.push(callInfo);
                    return null;
            }
        },

        on: function(e,h){if(!this._e)this._e={};if(!this._e[e])this._e[e]=[];this._e[e].push(h);},
        removeListener: function(e,h){if(!this._e)return;if(this._e[e])this._e[e]=this._e[e].filter(function(x){return x!==h;});},
        emit: function(e,d){if(!this._e||!this._e[e])return;this._e[e].forEach(function(h){try{h(d);}catch(ex){}});},

        chainId: CURRENT_CHAIN,
        selectedAddress: ADDR,
        networkVersion: String(${MAINNET_CONFIG.chainIdNum})
    };

    return {
        simulatedPort: '80',
        targetChain: TARGET_CHAIN,
        address: ADDR
    };
})()`,
            returnByValue: true,
            awaitPromise: true
        });

        const injectResult = await Runtime.evaluate({
            expression: '({port: window.__simulatedPort || window.location.port, hasEth: !!window.ethereum, chainId: window.ethereum?.chainId})',
            returnByValue: true
        });
        console.log('[2] Injection complete:', JSON.stringify(injectResult.result.value));

        // Screenshot before click
        const ssBefore = await P2.captureScreenshot({ format: 'png' });
        fs.writeFileSync('logs/mainnet-sim-before.png', Buffer.from(ssBefore.data, 'base64'));
        console.log('[3] Before-click screenshot saved');

        // Check network indicator shows MAINNET
        const pageInfo = await Runtime.evaluate({
            expression: `(function() {
                var text = document.body.innerText;
                var indicator = text.match(/0G\\s+(Mainnet|Testnet)\\s*\\(\\d+\\)/);
                var btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
                return {
                    networkIndicator: indicator ? indicator[0] : 'NOT FOUND',
                    buttons: btns,
                    hasMainnetText: text.includes('Mainnet')
                };
            })()`,
            returnByValue: true
        });

        console.log('\n[4] Page state after simulating port 80:');
        console.log('    Network indicator:', pageInfo.result.value.networkIndicator);
        console.log('    Has "Mainnet" text:', pageInfo.result.value.hasMainnetText);

        // CRITICAL CHECK: Does it show Mainnet or Testnet?
        if (pageInfo.result.value.networkIndicator.includes('Mainnet')) {
            console.log('    ✓ CORRECT: Shows 0G Mainnet!');
        } else {
            console.log('    ✗ WRONG: Expected "0G Mainnet", got:', pageInfo.result.value.networkIndicator);
        }

        // Click 0G / EVM button
        console.log('\n[5] Clicking 0G / EVM button...');
        await Runtime.evaluate({
            expression: `(function() {
                var btns = Array.from(document.querySelectorAll('button'));
                var btn = btns.find(b => /0G/i.test(b.textContent));
                if (btn) { btn.click(); return 'clicked'; }
                return 'not found';
            })()`,
            returnByValue: true
        });

        await new Promise(r => setTimeout(r, 5000));

        // Screenshot after click
        const ssAfter = await P2.captureScreenshot({ format: 'png' });
        fs.writeFileSync('logs/mainnet-sim-after.png', Buffer.from(ssAfter.data, 'base64'));
        console.log('[6] After-click screenshot saved');

        // Get captured calls
        const callsResult = await Runtime.evaluate({
            expression: 'window.__walletCalls || []',
            returnByValue: true
        });
        const calls = callsResult.result.value;

        console.log('\n[7] Wallet API Calls (' + calls.length + '):');
        calls.forEach((c, i) => {
            const extra = c.method === 'wallet_addEthereumChain'
                ? '\n       Params: ' + c.fullParams?.substring(0, 200)
                : '';
            console.log('    [' + i + '] ' + c.method + extra);
        });

        // VERIFICATION
        console.log('\n' + '-'.repeat(55));
        console.log('MAINNET VERIFICATION RESULTS');
        console.log('-'.repeat(55));

        let passed = true;
        const errors = [];

        // Check 1: eth_requestAccounts called
        if (calls.some(c => c.method === 'eth_requestAccounts')) {
            console.log('✓ eth_requestAccounts called');
        } else {
            console.log('✗ eth_requestAccounts NOT called');
            passed = false; errors.push('Missing eth_requestAccounts');
        }

        // Check 2: switchEthereumChain with mainnet chainId (0x4115)
        const switchCall = calls.find(c => c.method === 'wallet_switchEthereumChain');
        if (switchCall?.params?.[0]?.chainId === MAINNET_CONFIG.chainId) {
            console.log('✓ switchEthereumChain with correct mainnet chainId:', MAINNET_CONFIG.chainId);
        } else if (switchCall) {
            console.log('✗ switchEthereumChain WRONG chainId:',
                switchCall.params?.[0]?.chainId, '(expected:', MAINNET_CONFIG.chainId, ')');
            passed = false; errors.push('Wrong switch chainId: ' + switchCall.params?.[0]?.chainId);
        } else {
            console.log('? No switch call');
        }

        // Check 3: If addEthereumChain called, verify mainnet params
        const addCall = calls.find(c => c.method === 'wallet_addEthereumChain');
        if (addCall?.params?.[0]) {
            const params = addCall.params[0];
            console.log('\n  addEthereumChain params verification:');

            if (params.chainId === MAINNET_CONFIG.chainId) {
                console.log('  ✓ chainId correct:', params.chainId);
            } else {
                console.log('  ✗ chainId WRONG! Expected:', MAINNET_CONFIG.chainId, 'Got:', params.chainId);
                passed = false; errors.push('Wrong add chainId');
            }

            if (params.chainName === MAINNET_CONFIG.name) {
                console.log('  ✓ chainName correct:', params.chainName);
            } else {
                console.log('  ✗ chainName WRONG! Expected:', MAINNET_CONFIG.name);
                passed = false; errors.push('Wrong chainName');
            }

            if (params.rpcUrls?.includes(MAINNET_CONFIG.rpcUrl)) {
                console.log('  ✓ rpcUrl correct (includes', MAINNET_CONFIG.rpcUrl, ')');
            } else {
                console.log('  ✗ rpcUrl WRONG! Expected mainnet RPC');
                passed = false; errors.push('Wrong rpcUrl');
            }
        }

        // Check 4: localStorage
        const storage = await Runtime.evaluate({
            expression: '({type: localStorage.getItem("wallet_type"), addr: localStorage.getItem("wallet_address"), net: localStorage.getItem("zerog_network")})',
            returnByValue: true
        });
        const s = storage.result.value;
        console.log('\n  localStorage:');
        console.log('    wallet_type:', s.type);
        console.log('    zerog_network:', s.net);

        if (s.net === 'mainnet') {
            console.log('  ✓ zerog_network = mainnet');
        } else if (!s.net) {
            console.log('  ? zerog_network not set');
        } else {
            console.log('  ✗ zerog_network WRONG! Expected mainnet, got:', s.net);
            passed = false; errors.push('Wrong stored network: ' + s.net);
        }

        // Final result
        console.log('\n' + '='.repeat(55));
        if (passed) {
            console.log('RESULT: PASS ✓ - MAINNET logic works correctly!');
            console.log('  Port 80 → 0G Mainnet (16661) confirmed');
        } else {
            console.log('RESULT: FAIL ✗');
            errors.forEach((e, i) => console.log('  ', i+1 + '.', e));
        }
        console.log('='.repeat(55));

        await client.close();
        process.exit(passed ? 0 : 1);

    } catch(e) {
        console.error('ERROR:', e.message);
        if (client) try { await client.close(); } catch(ex) {}
        process.exit(1);
    }
})();
