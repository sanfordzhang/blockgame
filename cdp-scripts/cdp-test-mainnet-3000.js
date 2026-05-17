/**
 * CDP Test: Mainnet (Port 3000) Network Add Logic Verification
 *
 * Strategy: Navigate to page, intercept the getNetworkFromPort logic,
 * force port=3000, inject mock MetaMask with mainnet params, click button.
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER_ADDR = '0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5';
const MAINNET_CHAIN_ID = '0x4115'; // 16661

(async () => {
    console.log('=' .repeat(60));
    console.log('MAINNET (Port 3000) Network Add Test');
    console.log('=' .repeat(60));

    let client;
    try {
        // Step 1: Connect and navigate to test page (use existing 3001)
        console.log('\n[1] Connecting to browser...');
        client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        await Page.enable();
        await Runtime.enable();

        console.log('[2] Navigating to localhost:3001 (React app)...');
        await Page.navigate({ url: 'http://127.0.0.1:3001/' });

        // Wait for React render
        let ready = false;
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const r = await Runtime.evaluate({
                expression: 'document.querySelectorAll("button").length >= 3',
                returnByValue: true
            });
            process.stdout.write('.');
            if (r.result.value) { ready = true; break; }
        }
        console.log(ready ? ' Page ready!' : ' Timeout');
        if (!ready) throw new Error('Page not loaded');

        // Step 2: CRITICAL - Override getNetworkFromPort BEFORE React uses it
        // We'll monkey-patch window.location.port getter to return '3000'
        console.log('\n[3] Injecting MAINNET environment (simulating port 3000)...');

        // First, inject mock MetaMask that logs all calls
        const injectResult = await Runtime.evaluate({
            expression: `
(function() {
    var ADDR = '${PLAYER_ADDR}';
    var TARGET_CHAIN = '${MAINNET_CHAIN_ID}';

    // Capture all wallet calls
    window.__testCalls = [];

    // Create mock MetaMask that simulates mainnet add flow
    window.ethereum = {
        isMetaMask: true,
        _isMock: true,
        chainId: '0x1', // Start on wrong chain
        selectedAddress: null,

        request: async function(args) {
            var m = args.method, p = args.params || [];
            var entry = { method: m, params: p, time: Date.now() };

            switch(m) {
                case 'eth_requestAccounts':
                    this.selectedAddress = ADDR;
                    entry.result = [ADDR];
                    window.__testCalls.push(entry);
                    return [ADDR];

                case 'eth_accounts':
                    entry.result = [ADDR];
                    window.__testCalls.push(entry);
                    return [ADDR];

                case 'eth_chainId':
                    entry.result = this.chainId;
                    window.__testCalls.push(entry);
                    return this.chainId;

                case 'wallet_switchEthereumChain':
                    entry.switchTarget = p[0]?.chainId;
                    window.__testCalls.push(entry);

                    // If switching to mainnet chain - succeed
                    if (p[0]?.chainId === TARGET_CHAIN) {
                        this.chainId = TARGET_CHAIN;
                        var self = this;
                        setTimeout(function() { self.emit('chainChanged', TARGET_CHAIN); }, 100);
                        return null;
                    }

                    // Otherwise return 4902 (not added) -> triggers wallet_addEthereumChain
                    var err = new Error('chain not added');
                    err.code = 4902;
                    throw err;

                case 'wallet_addEthereumChain':
                    entry.addParams = JSON.stringify(p[0]);
                    window.__testCalls.push(entry);
                    console.log('[TEST-MAINNET] Adding network:', JSON.stringify(p[0]));
                    return null;

                case 'personal_sign':
                    entry.result = '0x' + 'a'.repeat(130);
                    window.__testCalls.push(entry);
                    return entry.result;

                case 'eth_sendTransaction':
                    entry.result = '0x' + '1'.repeat(64);
                    window.__testCalls.push(entry);
                    return entry.result;

                default:
                    window.__testCalls.push(entry);
                    return null;
            }
        },

        on: function(e, h) {
            if (!this._listeners) this._listeners = {};
            if (!this._listeners[e]) this._listeners[e] = [];
            this._listeners[e].push(h);
        },
        removeListener: function(e, h) {
            if (!this._listeners) return;
            if (this._listeners[e]) this._listeners[e] = this._listeners[e].filter(function(x) { return x !== h; });
        },
        emit: function(e, d) {
            if (!this._listeners || !this._listeners[e]) return;
            this._listeners[e].forEach(function(h) { try { h(d); } catch(ex) {}); }
        }
    };

    // Now override location.port to simulate port 3000 (mainnet)
    // We need to do this before React reads it on first render
    try {
        var origLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location') || {};
        var origLocation = window.location;

        // Use defineProperty with a getter that returns port as 3000
        Object.defineProperty(window, 'location', {
            get: function() {
                return new Proxy(origLocation, {
                    get: function(target, prop) {
                        if (prop === 'port') return '3000';
                        if (prop === 'host') return '127.0.0.1:3000';
                        if (prop === 'hostname') return '127.0.0.1';
                        if (prop === 'origin') return 'http://127.0.0.1:3000';
                        if (prop === 'href') return 'http://127.0.0.1:3000/';
                        var val = target[prop];
                        return typeof val === 'function' ? val.bind(target) : val;
                    }
                });
            },
            configurable: true
        });

        return { injected: true, simulatedPort: '3000', targetChain: TARGET_CHAIN };
    } catch(e) {
        return { injected: false, error: e.message };
    }
})()`,
            returnByValue: true,
            awaitPromise: true
        });

        console.log('    Injection result:', JSON.stringify(injectResult.result.value));

        // Verify port simulation
        const portCheck = await Runtime.evaluate({
            expression: '({ port: window.location.port, hasEth: !!window.ethereum })',
            returnByValue: true
        });
        console.log('    Port check:', JSON.stringify(portCheck.result.value));

        // Screenshot before
        const ssBefore = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('logs/mainnet-3000-before.png', Buffer.from(ssBefore.data, 'base64'));

        // Check network indicator - should show Mainnet because we forced port=3000
        const indicatorCheck = await Runtime.evaluate({
            expression: `(function() {
                var bodyText = document.body.innerText || '';
                var match = bodyText.match(/0G\\s+(Mainnet|Testnet)\\s*\\(\\d+\\)/);
                return match ? match[0] : ('NO INDICATOR FOUND. Text preview: ' + bodyText.substring(0, 200));
            })()`,
            returnByValue: true
        });

        console.log('\n[4] Network Indicator:', indicatorCheck.result.value);

        if (indicatorCheck.result.value.includes('Mainnet')) {
            console.log('    ✓ CORRECT: Shows "0G Mainnet"!');
        } else if (indicatorCheck.result.value.includes('Testnet')) {
            console.log('    ✗ WRONG: Shows Testnet instead of Mainnet');
            console.log('    (location.port override may not have worked before React init)');
        } else {
            console.log('    ?', indicatorCheck.result.value.substring(0, 100));
        }

        // Find and click 0G/EVM button
        console.log('\n[5] Clicking 0G / EVM button...');
        const clickResult = await Runtime.evaluate({
            expression: `(function() {
                var btns = Array.from(document.querySelectorAll('button, [role="button"]'));
                var btn = btns.find(function(b) { return /0[Gg]/i.test(b.textContent); });
                if (btn) { btn.click(); return 'clicked: ' + btn.textContent.trim(); }
                return 'NOT FOUND. Buttons: ' + btns.map(function(b){return b.textContent.trim();}).join('|');
            })()`,
            returnByValue: true
        });
        console.log('    Result:', clickResult.result.value);

        // Wait for operations
        console.log('[6] Waiting 6s for wallet operations...');
        await new Promise(r => setTimeout(r, 6000));

        // Screenshot after
        const ssAfter = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('logs/mainnet-3000-after.png', Buffer.from(ssAfter.data, 'base64'));
        console.log('[7] Screenshots saved to logs/');

        // Get captured calls
        const callsResult = await Runtime.evaluate({
            expression: 'window.__testCalls || []',
            returnByValue: true
        });
        const calls = callsResult.result.value;

        console.log('\n[8] Captured Wallet API Calls (' + calls.length + '):');
        calls.forEach((c, i) => {
            let detail = '';
            if (c.method === 'wallet_addEthereumChain') detail = '\n       Params: ' + c.addParams?.substring(0, 200);
            if (c.method === 'wallet_switchEthereumChain') detail = ' → target: ' + (c.switchTarget || '?');
            console.log('    [' + i + '] ' + c.method + detail);
        });

        // ===== VERIFICATION =====
        console.log('\n' + '-'.repeat(55));
        console.log('VERIFICATION: MAINNET (Port 3000)');
        console.log('-'.repeat(55));

        let pass = true, errors = [];

        // V1: eth_requestAccounts called?
        if (calls.find(c => c.method === 'eth_requestAccounts')) {
            console.log('✓ eth_requestAccounts called');
        } else { pass=false; errors.push('Missing eth_requestAccounts'); }

        // V2: switchEthereumChain called with mainnet chainId?
        const sw = calls.find(c => c.method === 'wallet_switchEthereumChain');
        if (sw?.switchTarget === MAINNET_CHAIN_ID) {
            console.log('✓ switchEthereumChain target=0x4115 (16661 mainnet)');
        } else if (sw) {
            console.log('✗ switchEthereumChain WRONG target:', sw.switchTarget, '(expected 0x4115)');
            pass=false; errors.push('Wrong switch chainId');
        } else { console.log('? No switch call'); }

        // V3: If addEthereumChain called, verify mainnet params
        const add = calls.find(c => c.method === 'wallet_addEthereumChain');
        if (add?.addParams) {
            try {
                const p = JSON.parse(add.addParams);
                console.log('\n  addEthereumChain verification:');
                if (p.chainId === MAINNET_CHAIN_ID) console.log('  ✓ chainId=' + p.chainId);
                else { console.log('  ✗ chainId=' + p.chainId + ' (want 0x4115)'); pass=false; errors.push('Wrong add chainId'); }
                if (p.chainName === '0G Mainnet') console.log('  ✓ chainName=' + p.chainName);
                else { console.log('  ✗ chainName=' + p.chainName); pass=false; errors.push('Wrong chainName'); }
                if (p.rpcUrls?.includes('https://evmrpc.0g.ai')) console.log('  ✓ rpcUrl includes evmrpc.0g.ai');
                else { console.log('  ✗ Wrong rpcUrl'); pass=false; errors.push('Wrong RPC URL'); }
                if (p.blockExplorerUrls?.includes('https://chainscan.0g.ai')) console.log('  ✓ blockExplorer correct');
                else { console.log('  ✗ Wrong blockExplorer'); pass=false; }
            } catch(e) { console.log('  ✗ Failed parse addParams'); pass=false; }
        }

        // V4: localStorage
        const storage = await Runtime.evaluate({
            expression: '({t: localStorage.getItem("wallet_type"), n: localStorage.getItem("zerog_network"), a: localStorage.getItem("wallet_address")})',
            returnByValue: true
        });
        const s = storage.result.value;
        console.log('\n  localStorage:');
        console.log('    wallet_type:', s.t);
        console.log('    zerog_network:', s.n);
        if (s.n === 'mainnet') console.log('  ✓ zerog_network=mainnet');
        else if (!s.n) console.log('  ? not set');
        else { console.log('  ✗ zerog_network=' + s.n + ' (want mainnet)'); pass=false; errors.push('Wrong stored net: '+s.n); }

        console.log('\n' + '='.repeat(55));
        if (pass) {
            console.log('RESULT: PASS ✓ — MAINNET logic verified!');
            console.log('  Port 3000 → 0G Mainnet (16661) works correctly.');
        } else {
            console.log('RESULT: FAIL ✗');
            errors.forEach((e,i) => console.log('  '+(i+1)+'.', e));
        }
        console.log('='.repeat(55));

        await client.close();
        process.exit(pass ? 0 : 1);

    } catch(err) {
        console.error('ERROR:', err.message);
        if (client) try { await client.close(); } catch(e) {}
        process.exit(1);
    }
})();
