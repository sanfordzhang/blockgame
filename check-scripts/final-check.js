/** Quick screenshot + balance check */
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const BASE = 'http://127.0.0.1:3001';
const PLAYER = '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc';

(async () => {
    const c = await CDP({ port: 9222 });
    await c.Page.enable(); await c.Runtime.enable();
    
    await c.Page.navigate({ url: BASE + '/' }); await new Promise(r=>setTimeout(r,4000));
    // Inject MM with 5.0 0G balance
    await c.Runtime.evaluate({
        expression: `(function(){delete window.ethereum;var a=['${PLAYER}'];window.ethereum={isMetaMask:true,request:async(x)=>{switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':'0x40EA';case'eth_getBalance':'0x4563918244F40000';default:return null}},on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:'0x40EA',selectedAddress:a[0]};})()`,
        returnByValue:true
    });
    await new Promise(r=>setTimeout(r,500));
    await c.Runtime.evaluate({expression:`(function(){var b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('0G'));if(b)b.click();})()`,returnByValue:true});
    await new Promise(r=>setTimeout(r,5000));
    
    const ss = await c.Page.captureScreenshot({format:'png'});
    fs.writeFileSync('screenshots/fix-final-connect.png',Buffer.from(ss.data,'base64'));
    
    // Check balance specifically
    const balInfo = await c.Runtime.evaluate({
        expression: `(function(){
            var body = document.body.innerText;
            var lines = body.split('\\n').filter(l=>l.includes('0G:')||l.includes('Wallet')||l.includes('Balance')||l.includes('balance'));
            return {lines, hasNonZero:/[1-9]/.test(body.substring(body.indexOf('0G'),body.indexOf('0G')+30))};
        })()`,
        returnByValue:true
    });
    console.log('After connect:', JSON.stringify(balInfo.result.value));
    
    // Also test getBalance directly
    const getBalTest = await c.Runtime.evaluate({
        expression: `(async function(){
            try {
                var addr = '${PLAYER}';
                // Test direct RPC call
                var resp = await fetch('https://evmrpc-galileo.0g.ai', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:[addr,'latest'],id:1})
                });
                var data = await resp.json();
                return { rpcResult: data.result, rpcError: data.error, status: resp.status };
            } catch(e) { return {error:e.message}; }
        })()`,
        returnByValue:true, awaitPromise:true
    });
    console.log('Direct RPC:', JSON.stringify(getBalTest.result.value));
    
    // Reload and check persistence UI
    await c.Page.reload();
    await new Promise(r=>setTimeout(r,10000));
    await c.Runtime.evaluate({
        expression: `(function(){delete window.ethereum;var a=['${PLAYER}'];window.ethereum={isMetaMask:true,request:async(x)=>{switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':'0x40EA';default:return null}},on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:'0x40EA',selectedAddress:a[0]};})()`,
        returnByValue:true
    });
    await new Promise(r=>setTimeout(r,3000));
    
    const ss2 = await c.Page.captureScreenshot({format:'png'});
    fs.writeFileSync('screenshots/fix-final-refresh.png',Buffer.from(ss2.data,'base64'));
    
    const uiState = await c.Runtime.evaluate({
        expression: `(function(){
            var b=document.body.innerText.substring(0,500);
            return {hasConnectBtn:b.includes('Connect TRON'),hasOGBtn:b.includes('0G / EVM'),hasAddr:/0x/.test(b),hasDeposit:b.includes('Deposit'),preview:b};
        })()`,
        returnByValue:true
    });
    console.log('\nAfter refresh UI:', JSON.stringify(uiState.result.value,null,2));
    
    console.log('\nScreenshots:');
    console.log('  screenshots/fix-final-connect.png (after connect)');
    console.log('  screenshots/fix-final-refresh.png (after refresh)');
    
    await c.close();
})();
