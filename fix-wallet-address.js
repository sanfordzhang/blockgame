/**
 * Fix wallet address mismatch issue:
 * 1. Clear localStorage stale state (old mock address)
 * 2. Remove injected mock MetaMask so real MetaMask/Brave Wallet can work
 *
 * Usage: node fix-wallet-address.js
 */
const CDP = require('chrome-remote-interface');

(async () => {
    try {
        const client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;

        await Page.enable();
        await Runtime.enable();

        console.log('=== Step 1: Clear localStorage ===');
        const clearResult = await Runtime.evaluate({
            expression: `(function() {
    // Clear stale wallet connection data
    localStorage.removeItem('wallet_type');
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('zerog_connected');

    // Also clear any other related keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('wallet') || key.includes('zerog') || key.includes('tron'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    return { cleared: keysToRemove.length, keys: keysToRemove };
})()`,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('Cleared localStorage:', JSON.stringify(clearResult.result.value, null, 2));

        console.log('\n=== Step 2: Remove mock MetaMask injection ===');
        const removeMock = await Runtime.evaluate({
            expression: `(function() {
    if (!window.ethereum) return { removed: false, reason: 'no ethereum found' };

    // Check if this is our mock (has _events property we set)
    const isMock = window.ethereum._events !== undefined;
    
    if (isMock) {
        delete window.ethereum;
        return { removed: true, reason: 'was mock MetaMask' };
    }

    // Check what's there now - might be real Brave Wallet or MetaMask
    return { 
        removed: false, 
        reason: 'real wallet detected', 
        isMetaMask: window.ethereum?.isMetaMask,
        selectedAddress: window.ethereum?.selectedAddress || 'N/A',
        chainId: window.ethereum?.chainId || 'N/A'
    };
})()`,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('Mock removal:', JSON.stringify(removeMock.result.value, null, 2));

        console.log('\n=== Step 3: Check current wallet state ===');
        const checkWallet = await Runtime.evaluate({
            expression: `(function() {
    return {
        hasEthereum: !!window.ethereum,
        isMetaMask: window.ethereum?.isMetaMask,
        selectedAddress: window.ethereum?.selectedAddress || 'none',
        chainId: window.ethereum?.chainId || 'none',
        localStorage_wallet_type: localStorage.getItem('wallet_type'),
        localStorage_wallet_address: localStorage.getItem('wallet_address')
    };
})()`,
            returnByValue: true,
            awaitPromise: true
        });
        console.log('Current state:', JSON.stringify(checkWallet.result.value, null, 2));

        console.log('\n=== Step 4: Navigate to Landing page fresh ===');
        await Page.navigate({ url: 'http://127.0.0.1:3001/' });
        await new Promise(r => setTimeout(r, 3000)); // wait for page load

        // Check page state after reload
        const pageState = await Runtime.evaluate({
            expression: `(function() {
    return {
        hasEthereum: !!window.ethereum,
        isMetaMask: window.ethereum?.isMetaMask,
        selectedAddress: window.ethereum?.selectedAddress || 'none',
        chainId: window.ethereum?.chainId || 'none',
        localStorage_wallet_type: localStorage.getItem('wallet_type'),
        localStorage_wallet_address: localStorage.getItem('wallet_address'),
        url: window.location.href
    };
})()`,
            returnByValue: true
        });
        console.log('After reload:', JSON.stringify(pageState.result.value, null, 2));

        await client.close();
        console.log('\n✅ Done! Please refresh the browser and click "0G / EVM" button to connect with your REAL MetaMask.');
        console.log('   Your real MetaMask address should now be: 0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5');
    } catch (e) {
        console.error('Error:', e.message);
        process.exit(1);
    }
})();
