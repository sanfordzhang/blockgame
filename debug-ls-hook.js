/**
 * Track exactly when/who clears localStorage
 */
const CDP = require('chrome-remote-interface');
const BASE_URL = 'http://127.0.0.1:3001';
const PLAYER = '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc';

(async () => {
    const c = await CDP({ port: 9222 });
    await c.Page.enable(); await c.Runtime.enable();
    
    // Phase 1: Connect + save to LS
    await c.Page.navigate({ url: BASE_URL + '/' });
    await new Promise(r => setTimeout(r, 4000));
    
    // Inject MM
    await c.Runtime.evaluate({
        expression: `(function(){
            delete window.ethereum;var a=['${PLAYER}'];var cid='0x40EA';
            window.ethereum={isMetaMask:true,request:async function(x){switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':return cid;case'eth_getBalance':'0x38D7EA4C68000';case'wallet_switchEthereumChain':case'wallet_addEthereumChain':return null;default:return null}},on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:cid,selectedAddress:a[0]};
        })()`,
        returnByValue: true
    });
    
    // Hook localStorage BEFORE clicking
    await c.Runtime.evaluate({
        expression: `(function(){
            var origRI = localStorage.removeItem.bind(localStorage);
            localStorage.removeItem = function(key) {
                console.log('[LS-HOOK] removeItem called for:', key, new Error().stack);
                origRI(key);
            };
            var origSI = localStorage.setItem.bind(localStorage);
            localStorage.setItem = function(key,val) {
                console.log('[LS-HOOK]setItem:', key, '=', val);
                origSI(key,val);
            };
            return 'hooks installed';
        })()`,
        returnByValue: true
    });
    
    // Click 0G button
    await c.Runtime.evaluate({
        expression: `(function(){var b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('0G'));if(b)b.click();})()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 5000));
    
    // Now enable Console to capture logs
    await c.Log.enable();
    
    console.log('=== Before Reload ===');
    const ls1 = await c.Runtime.evaluate({ expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address")})', returnByValue: true });
    console.log('LS:', ls1.result.value);
    
    // Capture all console logs so far
    const logs = [];
    c.on('Log.entryAdded', ({entry}) => { 
        if (entry.text && /LS-HOOK|wallet|restore|Landing/.test(entry.text)) 
            logs.push(entry.text.substring(0,200)); 
    });
    
    // RELOAD
    console.log('\n=== Reloading ===');
    await c.Page.reload();
    
    // Wait for everything to settle
    await new Promise(r => setTimeout(r, 8000));
    
    // Re-inject MM AFTER page has loaded
    console.log('Re-injecting MM...');
    await c.Runtime.evaluate({
        expression: `(function(){
            delete window.ethereum;
            var a=['${PLAYER}'];
            window.ethereum={isMetaMask:true,request:async function(x){switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':'0x40EA';case'eth_getBalance':'0x38D7EA4C68000';default:return null}},on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:'0x40EA',selectedAddress:a[0]};
            setTimeout(function(){window.ethereum.emit('accountsChanged',a);},500);
        })()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 3000));
    
    // Final check
    console.log('\n=== Final State ===');
    const ls2 = await c.Runtime.evaluate({ expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address")})', returnByValue: true });
    console.log('LS:', ls2.result.value);
    
    console.log('\n=== All localStorage hook logs ===');
    logs.forEach(l => console.log(' ', l));
    
    // Also get console errors
    const pageText = await c.Runtime.evaluate({ expression: 'document.body.innerText.substring(0,300)', returnByValue: true });
    console.log('\nPage preview:', pageText.result.value);
    
    await c.close();
})();
