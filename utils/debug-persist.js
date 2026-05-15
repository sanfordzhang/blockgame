/**
 * Debug persistence + balance issues
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3001';
const PLAYER_ADDR = '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function injectMM(c) {
    await c.Runtime.evaluate({
        expression: `(function(){
            delete window.ethereum;
            var a=['${PLAYER_ADDR}'];var cid='0x40EA';
            window.ethereum={isMetaMask:true,
                request:async function(x){switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':return cid;case'eth_getBalance':'0x7ce66c50e2840000';case'wallet_switchEthereumChain':case'wallet_addEthereumChain':return null;case'personal_sign':return '0x'+'a'.repeat(130);default:return null}},
                on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:cid,selectedAddress:a[0]
            };
            setTimeout(function(){window.ethereum.emit('accountsChanged',a);},200);
        })()`,
        returnByValue: true
    });
}

(async () => {
    const c = await CDP({ port: 9222 });
    await c.Page.enable(); await c.Runtime.enable();
    
    // 1. Fresh nav + inject
    console.log('=== Phase 1: Connect ===');
    await c.Page.navigate({ url: BASE_URL + '/' });
    await sleep(4000);
    await injectMM(c); await sleep(1000);
    
    // Check LS BEFORE click
    const lsBefore = await c.Runtime.evaluate({ expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address")})', returnByValue: true });
    console.log('LS before connect:', lsBefore.result.value);
    
    // Click 0G button via JS
    await c.Runtime.evaluate({ 
        expression: `(function(){var b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('0G'));if(b){b.click();return 'clicked'}return 'not found'})()`, 
        returnByValue: true 
    });
    await sleep(5000);
    
    // Check LS AFTER click  
    const lsAfter = await c.Runtime.evaluate({ expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address"),allKeys:Object.keys(localStorage)})', returnByValue: true });
    console.log('LS after connect:', lsAfter.result.value);
    
    // Balance check
    const balCheck = await c.Runtime.evaluate({
        expression: `(function(){
            var body = document.body.innerText;
            var lines = body.split('\\n').filter(l=>l.includes('0G:')||l.includes('Wallet'));
            return {lines, preview: body.substring(500,700)};
        })()`,
        returnByValue: true
    });
    console.log('Balance area:', JSON.stringify(balCheck.result.value));
    
    // Screenshot
    const ss1 = await c.Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/debug-after-connect.png', Buffer.from(ss1.data,'base64'));
    
    // 2. REFRESH
    console.log('\n=== Phase 2: Refresh ===');
    await c.Page.reload();
    
    // Check LS IMMEDIATELY after reload (before any JS runs)
    const lsImmediate = await c.Runtime.evaluate({ 
        expression: '(function(){return JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address")})})()', 
        returnByValue: true,
        // Run as soon as possible
    });
    console.log('LS immediately after reload:', lsImmediate.result.value);
    
    // Wait for page to fully load and React to mount
    await sleep(6000);
    
    // Now re-inject mock MM
    console.log('Re-injecting mock MM...');
    await injectMM(c);
    await sleep(2000);
    
    // Check LS after full load
    const lsFinal = await c.Runtime.evaluate({ 
        expression: 'JSON.stringify({t:localStorage.getItem("wallet_type"),a:localStorage.getItem("wallet_address"),allKeys:Object.keys(localStorage)})', 
        returnByValue: true 
    });
    console.log('LS after refresh+inject:', lsFinal.result.value);
    
    // Page state
    const finalState = await c.Runtime.evaluate({
        expression: `(function(){
            var b=document.body.innerText;
            return {preview:b.substring(0,400),hasConnectBtn:b.includes('Connect TRON'),hasOGBtn:b.includes('0G / EVM'),hasAddr:/0x/.test(b)};
        })()`,
        returnByValue: true
    });
    console.log('Page state:', JSON.stringify(finalState.result.value));
    
    const ss2 = await c.Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/debug-after-refresh.png', Buffer.from(ss2.data,'base64'));
    
    console.log('\nScreenshots: screenshots/debug-{after-connect,after-refresh}.png');
    await c.close();
})();
