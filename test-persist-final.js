const CDP = require('chrome-remote-interface');
const fs = require('fs');

(async () => {
    // Navigate (this will also trigger our injection since we used defineProperty)
    console.log('=== Refreshing page ===');
    let client = await CDP({ port: 9222 });
    let { Page } = client;
    await Page.enable();
    await Page.navigate({ url: 'http://127.0.0.1:3001/' });
    await client.close();
    await new Promise(r => setTimeout(r, 4500));

    // Reconnect + re-inject + check
    console.log('=== Reconnecting ===');
    client = await CDP({ port: 9222 });
    const { Page: P2, Runtime } = client;
    await P2.enable();
    await Runtime.enable();

    // Re-inject mock with real address
    await Runtime.evaluate({
        expression: `(function(){
    var A='0x8808FF950B9BfDdDE445Fd099262e80CEe858Eb5';
    Object.defineProperty(window,'ethereum',{value:{
        isMetaMask:true,request:async function(a){var m=a.method;switch(m){
            case'eth_requestAccounts':case'eth_accounts':return[A];
            case'eth_chainId':return'0x40EA';
            case'eth_getBalance':try{var r=await fetch('https://evmrpc-galileo.0g.ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:[a.params?.[0]||A,'latest'],id:1})});return(await r.json()).result||'0x0';}catch(e){return'0x0';}
            case'wallet_switchEthereumChain':case'wallet_addEthereumChain':return null;
            case'personal_sign':return'0x'+'a'.repeat(130);
            case'eth_sendTransaction':return'0x'+'1'.repeat(64);default:return null;}
        },on:function(e,h){if(!this._e)this._e={};if(!this._e[e])this._e[e]=[];this._e[e].push(h);},removeListener:function(e,h){if(!this._e)return;if(this._e[e])this._e[e]=this._e[e].filter(function(x){return x!==h;});},emit:function(e,d){if(!this._e||!this._e[e])return;this._e[e].forEach(function(h){try{h(d);}catch(ex){}});},_e:{},chainId:'0x40EA',selectedAddress:A,networkVersion:'16602'
    },writable:true,configurable:true});
    setTimeout(function(){window.ethereum.emit('accountsChanged',[A]);window.ethereum.emit('chainChanged','0x40EA');},200);
})()`
    });

    await new Promise(r => setTimeout(r, 2500));

    const ss = await P2.captureScreenshot({ format: 'png' });
    fs.writeFileSync('screenshots/fix-after-refresh.png', Buffer.from(ss.data, 'base64'));

    const result = await Runtime.evaluate({
        expression: `(function() {
    return {
        type: localStorage.getItem('wallet_type'),
        addr: localStorage.getItem('wallet_address'),
        text: document.body.innerText.substring(0, 500)
    };
})()`,
        returnByValue: true
    });

    console.log('\n=== After Refresh ===');
    console.log('Type:', result.result.value.type);
    console.log('Addr:', result.result.value.addr);
    console.log('Shows buttons?', result.result.value.text.includes('Connect TRON') ? 'YES (BAD!)' : 'NO (Good - auto-restored)');
    console.log('Shows wallet?', result.result.value.text.includes('0x88') ? 'YES (GOOD!)' : 'NO');
    
    console.log('\nScreenshot: screenshots/fix-after-refresh.png');
    await client.close();
})();
