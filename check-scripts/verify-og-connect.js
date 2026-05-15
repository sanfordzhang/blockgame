/**
 * Verify 0G wallet connection flow via CDP
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3001';

(async () => {
    try {
        const client = await CDP({ port: 9222 });
        const { Page, Runtime, Input } = client;
        
        await Page.enable();
        await Runtime.enable();
        await Input.enable();
        
        console.log('Navigating to Landing page...');
        await Page.navigate({ url: BASE_URL + '/' });
        await new Promise(r => setTimeout(r, 4000));
        
        // Check if mock MetaMask still exists
        const mmCheck = await Runtime.evaluate({
            expression: `(function() { return { hasMM: !!window.ethereum, addr: window.ethereum?.selectedAddress, chainId: window.ethereum?.chainId }; })()`,
            returnByValue: true
        });
        console.log('MetaMask status:', JSON.stringify(mmCheck.result.value));
        
        if (!mmCheck.result.value.hasMM) {
            console.log('Re-injecting mock MetaMask...');
            // Re-inject if needed
            await Runtime.evaluate({
                expression: `
(function() {
    delete window.ethereum;
    var accounts = ['0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc'];
    var cid = '0x40EA';
    window.ethereum = { isMetaMask: true, request: async function(a) { switch(a.method){ case 'eth_requestAccounts': case 'eth_accounts': return accounts; case 'eth_chainId': return cid; case 'eth_getBalance': return '0xde0b6b3a7640000'; case 'wallet_switchEthereumChain': case 'wallet_addEthereumChain': return null; case 'personal_sign': return '0x'+'a'.repeat(130); default: return null; } }, on:function(){}, removeListener:function(){}, emit:function(){}, _events:{}, chainId: cid, selectedAddress: accounts[0] };
    setTimeout(function(){ window.ethereum.emit('accountsChanged',accounts); window.ethereum.emit('chainChanged',cid); }, 200);
    return 'ok';
})()`,
                returnByValue: true
            });
            await new Promise(r => setTimeout(r, 1000));
        }
        
        // Take screenshot before click
        const ss1 = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('screenshots/verify-before-click.png', Buffer.from(ss1.data, 'base64'));
        
        // Find and click the "0G / EVM" button
        const btnInfo = await Runtime.evaluate({
            expression: `
(function() {
    var btns = Array.from(document.querySelectorAll('button'));
    var ogBtn = btns.find(b => b.textContent.includes('0G') || b.textContent.includes('EVM'));
    if (!ogBtn) return { found: false, allBtns: btns.map(b=>b.textContent.trim()) };
    
    // Get button position
    var rect = ogBtn.getBoundingClientRect();
    return { 
        found: true, 
        text: ogBtn.textContent.trim(),
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        visible: rect.width > 0 && rect.height > 0
    };
})()`,
            returnByValue: true
        });
        
        console.log('Button info:', JSON.stringify(btnInfo.result.value));
        
        if (btnInfo.result.value.found && btnInfo.result.value.visible) {
            console.log('Clicking 0G/EVM button...');
            
            // Use Input.dispatchMouseEvent
            await Input.dispatchMouseEvent({
                type: 'mousePressed',
                x: Math.round(btnInfo.result.value.x),
                y: Math.round(btnInfo.result.value.y),
                button: 'left',
                clickCount: 1
            });
            await Input.dispatchMouseEvent({
                type: 'mouseReleased',
                x: Math.round(btnInfo.result.value.x),
                y: Math.round(btnInfo.result.value.y),
                button: 'left',
                clickCount: 1
            });
            
            await new Promise(r => setTimeout(r, 3000));
            
            // Screenshot after click
            const ss2 = await Page.captureScreenshot({ format: 'png' });
            fs.writeFileSync('screenshots/verify-after-click.png', Buffer.from(ss2.data, 'base64'));
            
            // Check page state after connection
            const afterState = await Runtime.evaluate({
                expression: `
(function() {
    var bodyText = document.body.innerText.substring(0, 1000);
    var hasWalletInfo = bodyText.includes('0x') || bodyText.includes('wallet');
    var errorElms = document.querySelectorAll('[class*="error"], [class*="Error"], [role="alert"]');
    var errors = Array.from(errorElms).map(e => e.textContent.trim()).filter(t => t);
    return { hasWalletInfo, errors: errors.slice(0,3), bodyPreview: bodyText.substring(0,300) };
})()`,
                returnByValue: true
            });
            console.log('\\nAfter click state:', JSON.stringify(afterState.result.value, null, 2));
            
            console.log('\\nScreenshots saved:');
            console.log('  - screenshots/verify-before-click.png (before)');
            console.log('  - screenshots/verify-after-click.png (after)');
        } else {
            console.log('0G/EVM button not found or not visible!');
            console.log('Available buttons:', JSON.stringify(btnInfo.result.value.allBtns));
        }
        
        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
