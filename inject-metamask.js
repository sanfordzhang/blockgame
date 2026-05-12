/**
 * Inject Mock MetaMask into Chrome debug browser for 0G testing
 * Usage: node inject-metamask.js
 */
const CDP = require('chrome-remote-interface');

const PLAYER_ADDRESS = '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc';
const CHAIN_ID_HEX = '0x40EA'; // 16602 = 0G Testnet

(async () => {
    try {
        const client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        await Page.enable();
        await Runtime.enable();
        
        console.log('Injecting mock MetaMask for 0G Testnet...');
        console.log(`  Account: ${PLAYER_ADDRESS}`);
        console.log(`  Chain ID: ${CHAIN_ID_HEX} (0G Testnet)`);
        
        await Runtime.evaluate({
            expression: `
(function() {
    // Remove existing ethereum if any
    delete window.ethereum;

    var accounts = ['${PLAYER_ADDRESS}'];
    var chainIdHex = '${CHAIN_ID_HEX}';

    window.ethereum = {
        isMetaMask: true,
        isOKX: false,
        request: async function(args) {
            var method = args.method;
            var params = args.params || [];
            
            switch(method) {
                case 'eth_requestAccounts':
                    console.log('[mockMM] eth_requestAccounts ->', accounts);
                    return accounts;
                case 'eth_accounts':
                    return accounts;
                case 'eth_chainId':
                    return chainIdHex;
                case 'eth_getBalance':
                    // Return ~1 0G token balance
                    return '0xde0b6b3a7640000';
                case 'wallet_switchEthereumChain':
                    console.log('[mockMM] wallet_switchEthereumChain ->', params[0].chainId);
                    return null;
                case 'wallet_addEthereumChain':
                    console.log('[mockMM] wallet_addEthereumChain ->', params[0].chainName);
                    return null;
                case 'personal_sign':
                    return '0x' + 'a'.repeat(130);
                case 'eth_sendTransaction':
                    console.log('[mockMM] tx to:', params[0]?.to);
                    return '0x' + '1'.repeat(64);
                default:
                    console.log('[mockMM] unhandled:', method, JSON.stringify(params).substring(0,100));
                    return null;
            }
        },
        on: function(event, handler) {
            if (!this._events) this._events = {};
            if (!this._events[event]) this._events[event] = [];
            this._events[event].push(handler);
        },
        removeListener: function(event, handler) {
            if (!this._events) return;
            if (this._events[event]) {
                this._events[event] = this._events[event].filter(function(h) { return h !== handler; });
            }
        },
        emit: function(event, data) {
            if (!this._events || !this._events[event]) return;
            this._events[event].forEach(function(h) {
                try { h(data); } catch(e) {}
            });
        },
        _events: {},
        chainId: chainIdHex,
        selectedAddress: accounts[0],
        networkVersion: '16602'
    };

    // Fire events after a short delay so React context can pick up
    setTimeout(function() {
        window.ethereum.emit('accountsChanged', accounts);
        window.ethereum.emit('chainChanged', chainIdHex);
    }, 200);

    return 'Mock MetaMask injected successfully';
})()`,
            returnByValue: true,
            awaitPromise: true
        });
        
        // Verify injection
        const verify = await Runtime.evaluate({
            expression: `
(function() {
    return {
        hasEthereum: !!window.ethereum,
        isMetaMask: window.ethereum?.isMetaMask,
        address: window.ethereum?.selectedAddress,
        chainId: window.ethereum?.chainId
    };
})()`,
            returnByValue: true
        });
        
        console.log('\\n=== Injection Result ===');
        console.log(JSON.stringify(verify.result.value, null, 2));
        
        await client.close();
        console.log('\\nDone! Now click the "0G / EVM" button in browser.');
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
