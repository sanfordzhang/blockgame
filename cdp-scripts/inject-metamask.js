/**
 * Inject mock MetaMask with user's real address (0x8808...58Eb5)
 * Strategy: Navigate first, wait for load, then FORCE override window.ethereum
 * 
 * Usage: node inject-metamask.js
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const PLAYER_ADDRESS = '0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5';

(async () => {
    try {
        // Step 1: Navigate to page
        console.log('=== Navigating ===');
        let client = await CDP({ port: 9222 });
        let { Page } = client;
        await Page.enable();
        await Page.navigate({ url: 'http://127.0.0.1:3001/' });
        await client.close();
        await new Promise(r => setTimeout(r, 4000));

        // Step 2: Reconnect and inject AFTER page loaded
        console.log('=== Reconnecting + Injecting ===');
        client = await CDP({ port: 9222 });
        const { Page: P2, Runtime } = client;
        await P2.enable();
        await Runtime.enable();

        // Force inject - delete whatever is there, put ours in
        console.log('Injecting mock MetaMask with address:', PLAYER_ADDRESS);
        
        await Runtime.evaluate({
            expression: `
(function() {
    var ADDR = '${PLAYER_ADDRESS}';
    var CHAIN = '0x40DA';
    
    // Delete existing ethereum object entirely
    Object.defineProperty(window, 'ethereum', {
        value: {
            isMetaMask: true,
            _isMock: true,
            request: async function(args) {
                var m = args.method, p = args.params || [];
                switch(m) {
                    case 'eth_requestAccounts': return [ADDR];
                    case 'eth_accounts': return [ADDR];
                    case 'eth_chainId': return CHAIN;
                    case 'eth_getBalance':
                        try {
                            var resp = await fetch('https://evmrpc-galileo.0g.ai', {
                                method: 'POST',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:[p[0]||ADDR,'latest'],id:1})
                            });
                            var data = await resp.json();
                            return data.result || '0x0';
                        } catch(e) { return '0x0'; }
                    case 'wallet_switchEthereumChain': return null;
                    case 'wallet_addEthereumChain': return null;
                    case 'personal_sign': return '0x' + 'a'.repeat(130);
                    case 'eth_sendTransaction': return '0x' + '1'.repeat(64);
                    default: return null;
                }
            },
            on: function(e,h){if(!this._e)this._e={};if(!this._e[e])this._e[e]=[];this._e[e].push(h);},
            removeListener: function(e,h){if(!this._e)return;if(this._e[e])this._e[e]=this._e[e].filter(function(x){return x!==h;});},
            emit: function(e,d){if(!this._e||!this._e[e])return;this._e[e].forEach(function(h){try{h(d);}catch(ex){}});},
            chainId: CHAIN,
            selectedAddress: ADDR,
            networkVersion: '16602'
        },
        writable: true,
        configurable: true
    });

    setTimeout(function() {
        window.ethereum.emit('accountsChanged', [ADDR]);
        window.ethereum.emit('chainChanged', CHAIN);
    }, 200);
    
    return 'injected:' + ADDR;
})()`,
            returnByValue: true,
            awaitPromise: true
        });

        // Verify
        const v = await Runtime.evaluate({
            expression: `({
                addr: window.ethereum?.selectedAddress,
                chainId: window.ethereum?.chainId,
                isMetaMask: window.ethereum?.isMetaMask
            })`,
            returnByValue: true
        });
        console.log('Verified:', JSON.stringify(v.result.value));

        if (v.result.value.addr?.toLowerCase() !== PLAYER_ADDRESS.toLowerCase()) {
            throw new Error('Injection failed! Got: ' + v.result.value.addr);
        }

        // Screenshot before click
        const ss1 = await P2.captureScreenshot({ format: 'png' });
        fs.writeFileSync('screenshots/fix-before-click.png', Buffer.from(ss1.data, 'base64'));

        // Click 0G / EVM button
        console.log('\n=== Clicking 0G / EVM button ===');
        await Runtime.evaluate({
            expression: `(function() {
    var btns = Array.from(document.querySelectorAll('button'));
    var btn = btns.find(function(b) { return b.textContent.indexOf('0G') !== -1; });
    if (btn) { btn.click(); return 'clicked'; }
    return 'not found: ' + btns.map(function(b){return b.textContent}).join('|');
})()`,
            returnByValue: true
        });

        await new Promise(r => setTimeout(r, 5000));

        // Screenshot after click
        const ss2 = await P2.captureScreenshot({ format: 'png' });
        fs.writeFileSync('screenshots/fix-after-click-real.png', Buffer.from(ss2.data, 'base64'));

        const result = await Runtime.evaluate({
            expression: `(function() {
    return {
        type: localStorage.getItem('wallet_type'),
        addr: localStorage.getItem('wallet_address'),
        text: document.body.innerText.substring(0, 1000)
    };
})()`,
            returnByValue: true
        });
        
        console.log('\n=== RESULT ===');
        console.log('Wallet type:', result.result.value.type);
        console.log('Address:', result.result.value.addr);
        console.log('Preview:', result.result.value.text.substring(0, 350));
        console.log('\nScreenshots:');
        console.log('  Before: screenshots/fix-before-click.png');
        console.log('  After:  screenshots/fix-after-click-real.png');

        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
