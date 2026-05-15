/**
 * Capture console logs to trace restore flow
 */
const CDP = require('chrome-remote-interface');
const BASE = 'http://127.0.0.1:3001';
const PLAYER = '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc';

(async () => {
    const c = await CDP({ port: 9222 });
    await c.Page.enable(); await c.Runtime.enable(); await c.Log.enable();
    
    const logs = [];
    c.on('Log.entryAdded', ({entry}) => { if (entry.text) logs.push(entry.text); });
    
    // 1. Connect
    console.log('--- Phase 1: Connect ---');
    await c.Page.navigate({ url: BASE + '/' });
    await new Promise(r => setTimeout(r, 4000));
    
    // Inject MM + install LS hook (persists across reload? no, but let's see)
    await c.Runtime.evaluate({
        expression: `(function(){delete window.ethereum;var a=['${PLAYER}'];window.ethereum={isMetaMask:true,request:async function(x){switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':'0x40EA';case'eth_getBalance':'0x38D7EA4C68000';default:return null}},on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:'0x40EA',selectedAddress:a[0]};})()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 500));
    
    // Click 0G
    await c.Runtime.evaluate({ expression: '(function(){var b=Array.from(document.querySelectorAll("button")).find(x=>x.textContent.includes("0G"));if(b)b.click();})()', returnByValue: true });
    await new Promise(r => setTimeout(r, 5000));
    
    const ls1 = await c.Runtime.evaluate({ expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address")})', returnByValue: true });
    console.log('LS after connect:', ls1.result.value);
    
    // 2. Reload + capture ALL logs
    console.log('\n--- Phase 2: Reload ---');
    // Enable runtime console capture BEFORE reload
    const runtimeLogs = [];
    c.on('Runtime.consoleAPICalled', ({type, args}) => {
        const text = args.map(a => a.value || a.description || '').join(' ');
        if (/Landing|RESTORE|wallet|ethereum/i.test(text)) {
            runtimeLogs.push(`[Console.${type}] ${text.substring(0,200)}`);
        }
    });
    try { await c.Runtime.enable(); } catch(e) {}
    
    await c.Page.reload();
    console.log('Page reloaded, waiting 10s for React mount...');
    await new Promise(r => setTimeout(r, 10000));
    
    // Check LS now
    const ls2 = await c.Runtime.evaluate({ expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address")})', returnByValue: true });
    console.log('LS after reload:', ls2.result.value);
    
    // Check if ethereum exists in page context
    const ethCheck = await c.Runtime.evaluate({ expression: 'JSON.stringify({hasEth:!!window.ethereum})', returnByValue: true });
    console.log('window.ethereum exists:', ethCheck.result.value.hasEth);
    
    // Now inject and check
    console.log('\nInjecting mock MM...');
    await c.Runtime.evaluate({
        expression: `(function(){delete window.ethereum;var a=['${PLAYER}'];window.ethereum={isMetaMask:true,request:async(x)=>{switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':'0x40EA';default:return null}},on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:'0x40EA',selectedAddress:a[0]};setTimeout(()=>window.ethereum.emit('accountsChanged',a),300);return'injected'})()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 3000));
    
    const ls3 = await c.Runtime.evaluate({ expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address")})', returnByValue: true });
    console.log('LS after inject:', ls3.result.value);
    
    console.log('\n=== Console Logs (Landing/RESTORE/wallet) ===');
    runtimeLogs.forEach(l => console.log(' ', l));
    
    console.log('\n=== Browser Log entries ===');
    logs.filter(l => /Landing|RESTORE|wallet|restore/.test(l)).forEach(l => console.log(' ', l.substring(0,200)));
    
    await c.close();
})();
