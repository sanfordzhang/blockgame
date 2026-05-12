/** Quick test: navigate to correct tab + inject + click + screenshot */
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const BASE = 'http://127.0.0.1:3001';
const PLAYER = '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc';

(async () => {
    // Find the correct tab
    const http = require('http');
    const pages = await new Promise((res,rej)=>{
        http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej);
    });
    const target = pages.find(p=>p.url.includes('3001')) || pages[0];
    console.log('Target:', target?.url?.substring(0,80));
    
    const c = await CDP({target:target.webSocketDebuggerUrl});
    await c.Page.enable(); await c.Runtime.enable();
    
    // Force navigate to our app
    await c.Page.navigate({url:BASE+'/'});
    await new Promise(r=>setTimeout(r,4000));
    
    // Inject MM with 5.0 0G
    await c.Runtime.evaluate({
        expression:`(function(){delete window.ethereum;var a=['${PLAYER}'];window.ethereum={isMetaMask:true,request:async(x)=>{switch(x.method){case'eth_requestAccounts':case'eth_accounts':return a;case'eth_chainId':'0x40EA';case'eth_getBalance':'0x4563918244F40000';default:return null}},on:function(){},removeListener:function(){},emit:function(){},_events:{},chainId:'0x40EA',selectedAddress:a[0]};})()`,
        returnByValue:true
    });
    await new Promise(r=>setTimeout(r,500));
    
    // Click 0G button
    await c.Runtime.evaluate({expression:`(function(){var b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('0G'));if(b)b.click();return!!b})()`,returnByValue:true});
    await new Promise(r=>setTimeout(r,6000));
    
    // Screenshot + state
    const ss = await c.Page.captureScreenshot({format:'png'});
    fs.writeFileSync('screenshots/final-balance-test.png',Buffer.from(ss.data,'base64'));
    
    const state = await c.Runtime.evaluate({
        expression:`(function(){
            var t=document.body.innerText;
            var ogIdx=t.indexOf('0G:');
            return {
                preview:t.substring(t.indexOf('Wallet'),t.indexOf('Wallet')+200),
                balanceLine:ogIdx>=0?t.substring(ogIdx,ogIdx+30):'NOT FOUND',
                hasNonZero:/[1-9]\.\d+/.test(t),
                allBalances:t.match(/\\d+\\.\\d+/g)||[]
            };
        })()`,
        returnByValue:true
    });
    
    console.log('\nState:',JSON.stringify(state.result.value,null,2));
    console.log('\nScreenshot: screenshots/final-balance-test.png');
    
    // Test getBalance function directly
    const balTest = await c.Runtime.evaluate({
        expression:`(async function(){
            try {
                var r = await fetch('https://evmrpc-galileo.0g.ai',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:['${PLAYER}','latest'],id:1})
                });
                var d=await r.json();
                var wei=parseInt(d.result,16);
                var eth=wei/1e18;
                return {raw:d.result,wei,eth,status:r.status};
            }catch(e){return{error:e.message}};
        })()`,
        returnByValue:true,
        awaitPromise:true
    });
    console.log('\nDirect RPC result:',JSON.stringify(balTest.result.value));
    
    await c.close();
})();
