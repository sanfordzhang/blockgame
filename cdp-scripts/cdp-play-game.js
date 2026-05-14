/**
 * Focused: /nft INFT verify + MetaMask auto-import v2
 * 
 * Fixed flow: Tab → Connect → Approve MM → On-chain verify → MM Import
 */
const CDP = require('chrome-remote-interface');
const http = require('http');
const fs = require('fs');

const WEB    = 'http://127.0.0.1:3001';
const API    = 'http://127.0.0.1:7778';
const PLAYER = '0x8808ff950b9bfddde445fd099262e80cee858eb5';
const INFT   = '0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5';
// Known token IDs minted on chain
const KNOWN_TOKEN_IDS = [1, 2];

const sleep  = ms => new Promise(r => setTimeout(r, ms));
const log    = m => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);

function post(url, data, hdrs={}) {
    return new Promise((res,rej)=>{
        const b=JSON.stringify(data);
        const o={method:'POST',headers:{'Content-Type':'application/json',...hdrs,'Content-Length':Buffer.byteLength(b)}};
        const u=new URL(url);
        const q=http.request({...o,hostname:u.hostname,port:u.port,path:u.pathname},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d))}catch{res(d)}})});
        q.on('error',rej); q.write(b); q.end();
    });
}

async function main(){
    if(!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    log('=============================================================');
    log('  Focused: /nft Verify + MetaMask Auto-Import v2');
    log('=============================================================');

    // =====[1] CDP Connect =====
    log('\n[1] Connecting to Chrome...');
    const pages = await new Promise((a,b)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>a(JSON.parse(d)))}).on('error',b)});
    let tab = pages.find(p=>p.url.includes('3001'));
    if(!tab) tab = pages[0];
    log(`  Tab: ${tab.url.substring(0,70)}`);
    
    const client = await Promise.race([
        CDP({ target: tab.webSocketDebuggerUrl }),
        new Promise((_,r)=>setTimeout(()=>r(null),15000))
    ]);
    if(!client){log('ERROR: CDP timeout!');process.exit(1);}
    log('[1.6] Connected! Enabling domains...');
    await Promise.race([client.Page.enable().catch(()=>{}),new Promise(r=>setTimeout(r,null),5000)]);
    await Promise.race([client.Runtime.enable().catch(()=>{}),new Promise(r=>setTimeout(r,null),5000)]);
    log('[1.7] Ready');

    // Fire-and-forget screenshots
    const ss = name => { client.Page.captureScreenshot({format:'jpeg',quality:50})
        .then(({data})=>fs.writeFileSync(`test-results/${name}.jpg`,Buffer.from(data,'base64')))
        .catch(()=>{}).then(()=>log(`\U0001f4f8 ${name}`)).catch(()=>{}); };

    const ev = (expr, useAsync=false) => Promise.race([
        client.Runtime.evaluate({expression:expr,returnByValue:true,awaitPromise:useAsync})
            .then(r=>{
                if(r?.exceptionDetails) return 'EX:'+r.exceptionDetails.text;
                if(r?.result && r.result.type!=='undefined') return r.result.value;
                return null;
            })
            .catch(e=>'ERR:'+e.message),
        new Promise(r => setTimeout(() => r('TIMEOUT'), 12000))
    ]);

    ss('00-start');

    // =====[2] Navigate to /nft =====
    log('\n[2] Navigate to /nft ...');
    await Promise.race([client.Page.navigate({url:WEB+'/nft'}).catch(()=>{}),new Promise(r=>setTimeout(r,10000))]);
    await sleep(3000);
    ss('01-nft-loaded');

    // =====[3] Click "0G / INFT" tab FIRST =====
    log('\n[3] Switch to 0G / INFT tab ...');
    
    // Use precise querySelector for tab buttons only
    const tabResult = await ev(`(function(){
        // ONLY look at button elements (not divs/body)
        var btns=document.querySelectorAll('button');
        for(var i=0;i<btns.length;i++){
            var txt=(btns[i].textContent||btns[i].innerText||'').trim();
            if(txt.indexOf('0G')!==-1 && txt.indexOf('INFT')!==-1){
                btns[i].click(); 
                return 'clicked-tab: '+txt;
            }
            if(txt.indexOf('INFT')!==-1){
                btns[i].click();
                return 'clicked-inft: '+txt;
            }
        }
        var list=[];
        for(var j=0;j<btns.length;j++){var t=btns[j].textContent.trim();if(t)list.push(t.substring(0,30));}
        return 'no-tab-btn: ['+list.join('|')+']';
    })()`);
    await sleep(2000);
    ss('02-inft-tab');

    // =====[4] Click "Connect 0G Wallet" on INFT tab =====
    log('\n[4] Click Connect 0G Wallet ...');
    const connectResult = await ev(`(function(){
        var btns=document.querySelectorAll('button');
        for(var i=0;i<btns.length;i++){
            var t=btns[i].textContent||btns[i].innerText||'';
            if(t.indexOf('Connect 0G')!==-1){btns[i].click();return 'clicked: '+t.trim();}
            if(t.indexOf('Connect Wallet')!==-1){btns[i].click();return 'clicked: '+t.trim();}
        }
        var vis=[];
        for(var j=0;j<btns.length;j++){
            var txt=(btns[j].textContent||'').trim();
            if(txt)vis.push(txt.substring(0,25));
        }
        return 'no-btn: ['+vis.slice(0,5).join('|')+']';
    })()`);
    log(`  Result: ${connectResult}`);
    await sleep(3000);
    ss('03-connect-clicked');

    // =====[5] Check address + handle MM popup if needed =====
    let addr = null;
    
    // First try eth_accounts (no popup)
    addr = await ev(`(function(){
        try{
            if(window.ethereum){
                var a=window.ethereum.request({method:'eth_accounts'});
                // It might be a promise or immediate
                if(a&&a.then)return a; // return promise for async mode
                if(Array.isArray(a))return a[0]||null;
                return a||null;
            }
        }catch(e){return null;}
        return null;
    })()`, true); // use async for eth_accounts which returns a promise
    // Handle both string and array/object results
    const addrStr = (typeof addr === 'string') ? addr : 
                     (Array.isArray(addr) ? (addr[0] || '(empty arr)') :
                     (addr && addr.address ? addr.address : JSON.stringify(addr).substring(0,20)));
    log(`  Address (eth_accounts): ${addrStr || '(none)'}`);

    if(!addr){
        // Trigger requestAccounts - this will open MetaMask popup
        log('  Triggering requestAccounts (opens MetaMask popup)...');
        ev(`(async()=>{try{await window.ethereum.request({method:'eth_requestAccounts'});}catch(e){console.log('rr err:',e.message);}})()`);
        
        // Wait longer for user/MM interaction
        log('  Waiting 12s for MetaMask approval ...');
        await sleep(8000);

        // Try clicking "Connect"/"Next"/"Confirm" in MetaMask popup via separate CDP client
        try{
            const allPages = await new Promise((a,b)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>a(JSON.parse(d)))}).on('error',b)});
            
            // Precise MetaMask filter: chrome-extension with MM ID OR exact title match
            const mmTabs = allPages.filter(p => 
                p.url.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||  // MetaMask extension ID
                p.title === 'MetaMask'
            );
            
            log(`  MetaMask popups found: ${mmTabs.length}`);
            
            if(mmTabs.length > 0){
                const mmTab = mmTabs.find(p => p.type==='popup' || p.url.includes('notification')) || mmTabs[0];
                log(`  Using: ${mmTab.title} | ${(mmTab.url||'').substring(0,60)}`);
                
                const mmClient = await CDP({ target: mmTab.webSocketDebuggerUrl });
                try {
                    await mmClient.Page.enable().catch(()=>{});
                    await mmClient.Runtime.enable().catch(()=>{});
                    
                    // Screenshot MM state
                    await mmClient.Page.captureScreenshot({format:'jpeg',quality:60}).then(({data})=>{
                        fs.writeFileSync('test-results/04-mm-popup.jpg',Buffer.from(data,'base64'));
                    }).catch(()=>{});
                    
                    // Try to click Next/Connect/Confirm buttons in sequence
                    for(const btnText of ['Next','连接','Connect','确认','Confirm','签名','Sign','Approve']){
                        const clicked = await mmClient.Runtime.evaluate({
                            expression:`(()=>{
                                const btns=[...document.querySelectorAll('button')].filter(b=>b.offsetHeight>0);
                                const b=btns.find(x=>{
                                    const t=(x.textContent||'').trim();
                                    return t===btnText || t.startsWith(btnText);
                                });
                                if(b){b.click();return 'clicked:'+t;}
                                const labels=btns.map(x=>x.textContent.trim()).filter(t=>t.length>0&&t.length<20);
                                return 'no-'+btnText+'-btn: ['+labels.slice(0,6).join(',')+']';
                            })()`,
                            returnByValue:true
                        }).then(r=>r.result?.value).catch(e=>'err');
                        log(`  MM action [${btnText}]: ${clicked}`);
                        if(!clicked?.startsWith('no-') && !clicked?.startsWith('err')){
                            await sleep(2000); // wait between clicks
                        } else {
                            await sleep(500);
                        }
                    }
                    
                    // Final screenshot
                    await mmClient.Page.captureScreenshot({format:'jpeg',quality:60}).then(({data})=>{
                        fs.writeFileSync('test-results/04b-mm-after.jpg',Buffer.from(data,'base64'));
                    }).catch(()=>{});
                } catch(me){log(`  MM client err: ${me.message}`);}
                finally{try{mmClient.close();}catch{}}
            }
        } catch(pe){log(`  MM popup check err: ${pe.message}`);}

        // Extra wait then re-check
        await sleep(4000);
        addr = await ev(`(async()=>{
            try{return (await window.ethereum.request({method:'eth_accounts'}))[0]||null;}catch(e){return null;}
        })()`);
        log(`  Address after MM handling: ${addr || '(still none)'}`);
    }

    ss('04-wallet-state');

    // =====[5] On-chain verify balanceOf + tokenURI =====
    // Use DIRECT HTTP RPC call (doesn't need wallet connected on page!)
    log('\n[5] On-chain verification (direct RPC) ...');
    
    const rpcCall = async (method, params) => {
        try {
            const r = await post('https://evmrpc-galileo.0g.ai', {
                jsonrpc:'2.0', method, params, id:1
            }, {'Content-Type':'application/json'});
            return r?.result || null;
        } catch(e) { return {error:e.message}; }
    };
    
    // balanceOf(PLAYER) = 0x70a08231 + padded address  
    const balData = '0x70a08231' + PLAYER.slice(2).padStart(64,'0');
    const balResult = await rpcCall('eth_call', [{to:INFT,data:balData},'latest']);
    const balance = parseInt(balResult||'0x0',16);
    
    log(`  Balance: ${balance}`);
    
    // Query tokenURIs for known token IDs
    const tokens = [];
    for(const id of KNOWN_TOKEN_IDS){
        // tokenURI(tokenId) = 0xc87b56dd + padded tokenId
        const uriData = '0xc87b56dd' + id.toString(16).padStart(64,'0');
        const ur = await rpcCall('eth_call', [{to:INFT,data:uriData},'latest']);
        
        let s='';
        if(ur && ur!=='0x' && ur.startsWith('0x')){
            const h=ur.slice(2);
            if(h.length>=128){
                const o=parseInt(h.slice(0,64),16)*2;
                const l=parseInt(h.slice(o,o+64),16)*2;
                s=Buffer.from(h.slice(o+64,o+64+l),'hex').toString('utf8');
            }
        }
        tokens.push({id,uriLen:s.length,preview:s.substring(0,100),hasImage:s.includes('image')});
        if(s) log(`  Token #${id}: ${s.length}ch img=${s.includes('image')} "${s.substring(0,60)}"`);
        else log(`  Token #${id}: (no URI data or error)`);
    }
    
    const chainInfo = {balance, tokens};

    log(`  Balance: ${chainInfo?.balance ?? '(query failed)'}`);
    (chainInfo?.tokens||[]).forEach(t=>{
        if(t.err) log(`  Token #${t.id}: ERR ${t.err}`);
        else log(`  Token #${t.id}: ${t.uriLen}ch img=${t.hasImage} "${t.preview.substring(0,60)}"`);
    });

    ss('05-onchain');

    // =====[7] Refresh /nft page to show connected state =====
    log('\n[6] Refreshing /nft to show connected NFTs ...');
    await Promise.race([client.Page.navigate({url:WEB+'/nft'}).catch(()=>{}),new Promise(r=>setTimeout(r,10000))]);
    await sleep(3000);

    // Click INFT tab again after refresh
    await ev(`(async()=>{
        const els=[...document.querySelectorAll('button,[role="tab"]')];
        for(const el of els){
            const t=(el.textContent||'').trim();
            if(t.includes('INFT')||t.includes('0G')){el.click();break;}
        }
    })()`);
    await sleep(3000);
    ss('06-nft-refreshed');

    // Check what's showing now
    const pageState = await ev(`(function(){
        var body=document.body.innerText||'';
        if(body.indexOf('Royal Flush')!==-1) return 'HAS Royal Flush';
        if(body.indexOf('Straight')!==-1) return 'HAS Straight';
        if(body.indexOf('INFT #')!==-1) return 'HAS INFT cards';
        if(body.indexOf('No INFT')!==-1) return 'EMPTY: No INFTs';
        if(body.indexOf('Connect your 0G')!==-1) return 'NEEDS_CONNECT';
        return 'STATE: '+body.substring(Math.max(0,body.length-200));
    })()`);
    log(`  Page state: ${pageState}`);
    ss('07-page-state');

    // =====[8] Auto-import to MetaMask NFTs tab =====
    log('\n[7] Auto-import to MetaMask NFTs ...');
    const nftCount = chainInfo?.balance || KNOWN_TOKEN_IDS.length;
    
    try{
        const allPages = await new Promise((a,b)=>{http.get('http://localhost:9222/json',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>a(JSON.parse(d)))}).on('error',b)});
        
        // STRICT MetaMask filter - exclude TronLink!
        const mmTabs = allPages.filter(p =>
            p.url.includes('nkbihfbeogaeaoehlefnkodbefgpgknn') ||
            (p.title === 'MetaMask' && !p.url.includes('tronlink'))
        );
        
        log(`  Strict MetaMask tabs: ${mmTabs.length}`);
        if(mmTabs.length === 0){
            log(`  Available tabs for debug:`);
            allPages.forEach((p,i)=>log(`    [${i}] ${p.title || '?'} | ${(p.url||'').substring(0,70)} | type=${p.type}`));
        }

        if(mmTabs.length > 0){
            // Prefer popup/notification type, fallback to any MM tab
            const mmTab = mmTabs.find(p => p.type==='popup'||p.type==='notification') || mmTabs[0];
            log(`  Opening: ${mmTab.title || 'MetaMask'} | ${(mmTab.url||'').substring(0,60)}`);
            
            const mmClient = await CDP({ target: mmTab.webSocketDebuggerUrl });
            try {
                await mmClient.Page.enable().catch(()=>{});
                await mmClient.Runtime.enable().catch(()=>{});
                // Enable DOM and Input protocols for reliable element interaction  
                await mmClient.DOM.enable().catch(()=>{});
                await mmClient.Input.dispatchMouseEvent({type:'mousePressed',x:1,y:1,button:'left',clickCount:1}).catch(()=>{});
                
                // Screenshot initial MM state
                await mmClient.Page.captureScreenshot({format:'jpeg',quality:60}).then(({data})=>{
                    fs.writeFileSync('test-results/08a-mm-start.jpg',Buffer.from(data,'base64'));
                }).catch(()=>{});

                // === Helper: click element by text content ===
                const mmClick = async (selector, textMatch, desc) => {
                    try {
                        const r = await Promise.race([
                            mmClient.Runtime.evaluate({
                                expression: `(function(){
                                    var els=document.querySelectorAll('${selector}');
                                    for(var i=0;i<els.length;i++){
                                        var t=(els[i].textContent||els[i].innerText||'').trim();
                                        if(t.indexOf('${textMatch}')!==-1){els[i].click();return 'clicked:'+t;}
                                    }
                                    return null;
                                })()`,
                                returnByValue:true
                            }).then(r=>r?.result?.value),
                            new Promise(r => setTimeout(() => r('timeout'), 5000))
                        ]);
                        log(`    [${desc}] ${r || '(not found)'}`);
                        return r;
                    } catch(e){
                        log(`    [${desc}] err: ${e.message}`);
                        return null;
                    }
                };

                // === Helper: coordinate-based mouse click (for CSP-restricted pages) ===
                const mmClickXY = async (x, y, desc) => {
                    try {
                        await mmClient.Input.dispatchMouseEvent({
                            type:'mousePressed', x, y, button:'left', clickCount:1
                        }).catch(()=>{});
                        await sleep(50);
                        await mmClient.Input.dispatchMouseEvent({
                            type:'mouseReleased', x, y, button:'left', clickCount:1
                        }).catch(()=>{});
                        log(`    [${desc}] clicked at (${x},${y})`);
                    } catch(e){
                        log(`    [${desc}] XY err: ${e.message}`);
                    }
                };

                // Step A: Click "NFTs" sub-tab inside MetaMask
                log('  [A] Clicking NFTs tab ...');
                let navRes = await mmClick('button,[role="tab"],[class*="tab"],div', 'NFTs', 'NFTs-tab');
                
                // Fallback: coordinate click on NFTs tab (from screenshot analysis)
                if(!navRes || navRes.includes('timeout') || navRes.includes('Account')){
                    log(`    Eval didn't target NFTs tab precisely, using coords...`);
                    await mmClickXY(195, 168, 'NFTs-xy'); // Precise coords from screenshot
                    navRes = 'clicked-via-coords';
                }
                await sleep(2500);
                
                await mmClient.Page.captureScreenshot({format:'jpeg',quality:60}).then(({data})=>{
                    fs.writeFileSync('test-results/08b-mm-nfts.jpg',Buffer.from(data,'base64'));
                }).catch(()=>{});

                // Step B: Click "Import" button  
                log('  [B] Looking for Import button ...');
                let importRes = await mmClick('button,a,[role="button"]', 'Import', 'Import-btn');
                
                if(!importRes || importRes.includes('timeout') || importRes.includes('not found')){
                    // Import NFT button typically appears centered below tabs in empty NFT view
                    await mmClickXY(180, 300, 'Import-xy');
                    await sleep(1000);
                    importRes = 'clicked-via-coords';
                }
                await sleep(2000);
                
                await mmClient.Page.captureScreenshot({format:'jpeg',quality:60}).then(({data})=>{
                    fs.writeFileSync('test-results/08c-mm-import-form.jpg',Buffer.from(data,'base64'));
                }).catch(()=>{});

                if(importRes && !importRes.includes('timeout') && !importRes.includes('null')){
                    // Step C: Fill contract address using sync eval
                    log('  [C] Filling address ...');
                    const addrFill = await Promise.race([
                        mmClient.Runtime.evaluate({
                            expression: `(function(){
                                var inputs=document.querySelectorAll('input');
                                for(var i=0;i<inputs.length;i++){
                                    var ph=(inputs[i].placeholder||'').toLowerCase();
                                    if(ph.indexOf('address')!==-1||ph.indexOf('contract')!==-1||i===0){
                                        inputs[i].value='${INFT}';
                                        inputs[i].dispatchEvent(new Event('input',{bubbles:true}));
                                        inputs[i].dispatchEvent(new Event('change',{bubbles:true}));
                                        return 'filled:'+inputs[i].name||'input'+i;
                                    }
                                }
                                return 'no-input';
                            })()`,
                            returnByValue:true
                        }).then(r=>r.result?.value),
                        new Promise(r=>setTimeout(r('addr-to'),5000))
                    ]);
                    log(`  Addr: ${addrFill}`);
                    await sleep(1000);

                    // Step D: Fill Token ID
                    log('  [D] Filling Token ID ...');
                    const tidStr = String(KNOWN_TOKEN_IDS[KNOWN_TOKEN_IDS.length-1] || nftCount);
                    const tidFill = await Promise.race([
                        mmClient.Runtime.evaluate({
                            expression: `(function(){
                                var inputs=document.querySelectorAll('input');
                                for(var i=0;i<inputs.length;i++){
                                    var v=inputs[i].value||'';
                                    var ph=(inputs[i].placeholder||'').toLowerCase();
                                    if(v.indexOf('0x')===0) continue; // skip address input
                                    if(i>=1 || ph.indexOf('token')!==-1 || ph.indexOf('id')!==-1){
                                        inputs[i].value='${tidStr}';
                                        inputs[i].dispatchEvent(new Event('input',{bubbles:true}));
                                        inputs[i].dispatchEvent(new Event('change',{bubbles:true}));
                                        return 'filled-tid:'+tidStr;
                                    }
                                }
                                return 'no-tid-input';
                            })()`,
                            returnByValue:true
                        }).then(r=>r.result?.value),
                        new Promise(r=>setTimeout(r('tid-to'),5000))
                    ]);
                    log(`  TID: ${tidFill}`);
                    await sleep(1000);

                    // Step E: Submit
                    log('  [E] Submitting ...');
                    const submitRes = await mmClick('button', 'Confirm', 'Submit');
                    
                    // Also try alternative submit buttons
                    if(!submitRes || submitRes.includes('timeout')){
                        await mmClick('button', 'Sign', 'Sign');
                        await sleep(500);
                        await mmClick('button', 'Import', 'Import-submit');
                    }
                    await sleep(4000);

                    // Final screenshot after import
                    await mmClient.Page.captureScreenshot({format:'jpeg',quality:60}).then(({data})=>{
                        fs.writeFileSync('test-results/09-mm-imported.jpg',Buffer.from(data,'base64'));
                    }).catch(()=>{});
                    log('  Import complete (or submitted)');
                } else {
                    log('  Could not open Import form. May need manual step.');
                }
            } catch(merr){
                log(`  MM client error: ${merr.message}`);
            } finally {
                try { mmClient.close(); } catch {}
            }
        } else {
            log('  No MetaMask tab found.');
            log('  Manual steps:');
            log(`    1. MetaMask → 0G Testnet network → NFTs tab`);
            log(`    2. Import NFT → Address: ${INFT}`);
            log(`    3. Token ID: ${KNOWN_TOKEN_IDS.join(' or ')}`);
        }
    } catch(err){
        log(`  Import error: ${err.message}`);
    }

    ss('10-final');

    // ===== Report =====
    log('');
    log('╔══════════════════════════════════════════════╗');
    log('║              RESULTS                         ║');
    log(`║ Contract : ${INFT.padEnd(38)} ║`);
    log(`║ Player  : ${PLAYER.padEnd(38)} ║`);
    log(`║ Balance : ${(chainInfo?.balance??'?').toString().padEnd(38)} ║`);
    log(`║ Page    : ${String(pageState||'?').substring(0,38).padEnd(38)} ║`);
    log(`║ Screens : test-results/*.jpg                  ║`);
    log('╚══════════════════════════════════════════════╝');
    log('');
    log('Done!');
    
    await client.close();
}

main().catch(e=>{console.error('FATAL:',e);process.exit(1);});
