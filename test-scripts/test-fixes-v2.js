const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
    // Navigate
    let c = await CDP({ port: 9222 });
    let { Page } = c;
    await Page.enable();
    await Page.navigate({ url: 'http://127.0.0.1:3001/' });
    await c.close();
    await new Promise(r => setTimeout(r, 4000));

    // Reconnect + inject
    c = await CDP({ port: 9222 });
    const { Page: P, Runtime } = c;
    await P.enable();
    await Runtime.enable();

    // Inject mock
    await Runtime.evaluate({ expression: `(function(){
var A='0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5';
Object.defineProperty(window,'ethereum',{value:{
isMetaMask:true,request:async function(a){var m=a.method;switch(m){
case'eth_requestAccounts':case'eth_accounts':return[A];
case'eth_chainId':return'0x40EA';
case'eth_getBalance':try{var r=await fetch('https://evmrpc-galileo.0g.ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:[a.params?.[0]||A,'latest'],id:1})});return(await r.json()).result||'0x0';}catch(e){return'0x0';}
case'wallet_switchEthereumChain':case'wallet_addEthereumChain':return null;
case'personal_sign':return'0x'+'a'.repeat(130);
case'eth_sendTransaction':console.log('[mockMM] tx:',JSON.stringify(a.params));return'0x'+'1'.repeat(64);
default:return null;}
},on:function(e,h){if(!this._e)this._e={};if(!this._e[e])this._e[e]=[];this._e[e].push(h);},removeListener:function(e,h){if(!this._e)return;if(this._e[e])this._e[e]=this._e[e].filter(function(x){return x!==h;});},emit:function(e,d){if(!this._e||!this._e[e])return;this._e[e].forEach(function(h){try{h(d);}catch(ex){}});},_e:{},chainId:'0x40EA',selectedAddress:A,networkVersion:'16602'
},writable:true,configurable:true});
setTimeout(function(){window.ethereum.emit('accountsChanged',[A]);window.ethereum.emit('chainChanged','0x40EA');},200);
})()` });

    await new Promise(r => setTimeout(r, 3000));

    // Click 0G button to connect
    console.log('=== Connecting 0G ===');
    await Runtime.evaluate({
        expression: `(function(){
    var btns = Array.from(document.querySelectorAll('button'));
    var b=btns.find(function(x){return x.textContent.indexOf('0G')!==-1});
    if(b){b.click();return 'clicked';}
    return 'btn not found';
})()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 5000));

    // Screenshot - connected state
    const ss1 = await P.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/v2-connected.png', Buffer.from(ss1.data, 'base64'));
    
    const state1 = await Runtime.evaluate({
        expression: `document.body.innerText.substring(0, 600)`,
        returnByValue: true
    });
    console.log('\n=== CONNECTED STATE ===');
    console.log(state1.result.value);

    // Check if Disconnect button exists
    const hasDisconnect = await Runtime.evaluate({
        expression: `(function() {
    var btns = Array.from(document.querySelectorAll('button, [role="button"]'));
    return btns.map(b => b.textContent.trim().substring(0, 30)).filter(t => t.toLowerCase().includes('disconnect') || t.toLowerCase().includes('断开'));
})()`,
        returnByValue: true
    });
    console.log('Disconnect buttons found:', JSON.stringify(hasDisconnect.result.value));

    // Click Deposit
    console.log('\n=== Clicking Deposit ===');
    await Runtime.evaluate({
        expression: `(function() {
    var btns = Array.from(document.querySelectorAll('button'));
    var b = btns.find(function(x) { return x.textContent.trim() === 'Deposit'; });
    if (b) { b.click(); return 'clicked deposit'; }
    return 'deposit btn not found';
})()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 6000));

    const ss2 = await P.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/v2-after-deposit.png', Buffer.from(ss2.data, 'base64'));

    const state2 = await Runtime.evaluate({
        expression: `document.body.innerText.substring(0, 700)`,
        returnByValue: true
    });
    console.log('\n=== AFTER DEPOSIT ===');
    console.log(state2.result.value);

    // Click Disconnect button
    console.log('\n=== Clicking Disconnect ===');
    await Runtime.evaluate({
        expression: `(function() {
    var allBtns = Array.from(document.querySelectorAll('button, [style*="border"]'));
    var dBtn = allBtns.find(b => b.textContent && b.textContent.includes('Disconnect'));
    if (dBtn) { dBtn.click(); return 'clicked disconnect'; }
    // try any element with disconnect text
    var els = Array.from(document.querySelectorAll('*'));
    var el = els.find(e => e.textContent === 'Disconnect' || e.textContent.trim() === 'Disconnect');
    if (el) { el.click(); return 'clicked disconnect(el)'; }
    return 'not found. buttons: ' + allBtns.map(b=>b.textContent?.trim().substring(0,15)).join('|').substring(0,200);
})()`,
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 2000));

    const ss3 = await P.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/v2-after-disconnect.png', Buffer.from(ss3.data, 'base64'));

    const state3 = await Runtime.evaluate({
        expression: `(function() {
    return {
        text: document.body.innerText.substring(0, 400),
        type: localStorage.getItem('wallet_type'),
        addr: localStorage.getItem('wallet_address')
    };
})()`,
        returnByValue: true
    });
    console.log('\n=== AFTER DISCONNECT ===');
    console.log('Type:', state3.result.value.type);
    console.log('Addr:', state3.result.value.addr);
    console.log('Text:', state3.result.value.text);
    console.log('\nScreenshots:');
    console.log('  v2-connected.png      - connected state with disconnect btn');
    console.log('  v2-after-deposit.png   - after clicking deposit');
    console.log('  v2-after-disconnect.png - after clicking disconnect');

    await c.close();
})();
