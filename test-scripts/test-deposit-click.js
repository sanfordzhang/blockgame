/**
 * Click Deposit button and capture all console output/errors
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
    // Navigate
    console.log('=== Navigating ===');
    let c = await CDP({ port: 9222 });
    let { Page } = c;
    await Page.enable();
    await Page.navigate({ url: 'http://127.0.0.1:3001/' });
    await c.close();
    await new Promise(r => setTimeout(r, 4000));

    // Reconnect + inject
    c = await CDP({ port: 9222 });
    const { Page: P2, Runtime, Console } = c;
    await P2.enable();
    await Runtime.enable();
    await Console.enable();

    // Listen for console messages
    Console.messageAdded(({ message }) => {
        if (message.source === 'console-api' || message.level === 'error') {
            console.log(`[CONSOLE ${message.level}]`, message.text?.substring(0, 200));
        }
    });

    // Re-inject mock
    await Runtime.evaluate({ expression: `(function(){
var A='0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5';
Object.defineProperty(window,'ethereum',{value:{
isMetaMask:true,request:async function(a){var m=a.method;switch(m){
case'eth_requestAccounts':case'eth_accounts':return[A];
case'eth_chainId':return'0x40EA';
case'eth_getBalance':try{var r=await fetch('https://evmrpc-galileo.0g.ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:[a.params?.[0]||A,'latest'],id:1})});return(await r.json()).result||'0x0';}catch(e){return'0x0';}
case'wallet_switchEthereumChain':case'wallet_addEthereumChain':return null;
case'personal_sign':return'0x'+'a'.repeat(130);
case'eth_sendTransaction':
    console.log('[mockMM] eth_sendTransaction called!', JSON.stringify(a.params));
    return '0x' + '1'.repeat(64);
default:return null;}
},on:function(e,h){if(!this._e)this._e={};if(!this._e[e])this._e[e]=[];this._e[e].push(h);},removeListener:function(e,h){if(!this._e)return;if(this._e[e])this._e[e]=this._e[e].filter(function(x){return x!==h;});},emit:function(e,d){if(!this._e||!this._e[e])return;this._e[e].forEach(function(h){try{h(d);}catch(ex){}});},_e:{},chainId:'0x40EA',selectedAddress:A,networkVersion:'16602'
},writable:true,configurable:true});
setTimeout(function(){window.ethereum.emit('accountsChanged',[A]);window.ethereum.emit('chainChanged','0x40EA');},200);
})()` });

    await new Promise(r => setTimeout(r, 3000));

    // Check state before
    const before = await Runtime.evaluate({
        expression: `(function() {
    var els = document.querySelectorAll('*');
    var text = document.body.innerText.substring(0, 600);
    return { text: text };
})()`,
        returnByValue: true
    });
    console.log('\n=== BEFORE DEPOSIT ===');
    console.log(before.result.value.text);

    // Find and click Deposit button
    console.log('\n=== Clicking Deposit ===');
    const clickResult = await Runtime.evaluate({
        expression: `(function() {
    var btns = Array.from(document.querySelectorAll('button'));
    var depositBtn = btns.find(function(b) { 
        var t = b.textContent.trim(); 
        return t === 'Deposit' || t === 'Depositing...';
    });
    if (depositBtn) { 
        depositBtn.click(); 
        return 'Clicked: ' + depositBtn.textContent.trim(); 
    }
    return 'Buttons found: ' + btns.map(function(b){return b.textContent.trim().substring(0,20)}).join(' | ');
})()`,
        returnByValue: true
    });
    console.log(clickResult.result.value);

    // Wait for async operations
    await new Promise(r => setTimeout(r, 6000));

    // Check state after
    const after = await Runtime.evaluate({
        expression: `(function() {
    return {
        type: localStorage.getItem('wallet_type'),
        addr: localStorage.getItem('wallet_address'),
        text: document.body.innerText.substring(0, 800)
    };
})()`,
        returnByValue: true
    });

    console.log('\n=== AFTER DEPOSIT (6s later) ===');
    console.log(after.result.value.text);

    const ss = await P2.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/fix-after-deposit.png', Buffer.from(ss.data, 'base64'));
    console.log('\nScreenshot: screenshots/fix-after-deposit.png');

    await c.close();
})();
