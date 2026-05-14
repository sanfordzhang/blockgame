/**
 * CDP Tournament Join Test v3 - Robust, main-window-only, full flow
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function test() {
    console.log('=== CDP Tournament Test v3 ===\n');
    
    // Get MAIN target (not extension popups)
    const { Target } = await CDP({ port: 9222 });
    const targets = await Target.getTargets();
    let mainTargetId = null;
    for (const t of targets.targetInfos) {
        const isMain = !t.url.startsWith('chrome-extension://') && 
                       t.type === 'page' && t.url !== 'about:blank';
        if (isMain) { mainTargetId = t.targetId; break; }
    }
    if (!mainTargetId) {
        for (const t of targets.targetInfos) {
            if ((t.type === 'page') && !t.url.startsWith('chrome-extension://')) { mainTargetId = t.targetId; break; }
        }
    }
    console.log('[Init] Main target:', mainTargetId);

    // Connect to main target ONLY
    const client = await CDP({ port: 9222, target: mainTargetId });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    const ss = () => Page.captureScreenshot().then(r => r.data);
    const saveSS = (name) => ss().then(d => fs.writeFileSync('test-results/' + name, Buffer.from(d, 'base64')));
    const wait = ms => new Promise(r => setTimeout(r, ms));

    // Step 1: Landing page
    console.log('[Step 1] Navigate to /');
    await Page.navigate({ url: 'http://127.0.0.1:3001/' });
    await wait(2500);
    await saveSS('cdp-v3-01-landing.png');

    // Step 2: Check wallet & connect 0G if needed
    console.log('\n[Step 2] Check wallet...');
    let walletState;
    try {
        const wsResult = await Runtime.evaluate({
            expression: `(function() {
                return {
                    addr: localStorage.getItem('wallet_address'),
                    type: localStorage.getItem('wallet_type'),
                    has0GText: document.body.innerText.includes('0G') && document.body.innerText.includes('Disconnect'),
                    bodyPreview: document.body.innerText.substring(0, 120)
                };
            })()`, returnByValue: true
        });
        walletState = wsResult?.result?.value || { addr: null, type: null, has0GText: false, bodyPreview: '' };
    } catch (e) {
        console.log('  Wallet check error:', e.message);
        walletState = { addr: null, type: null, has0GText: false, bodyPreview: '', error: e.message };
    }
    console.log('  Wallet:', JSON.stringify(walletState).substring(0, 150));

    if (!walletState.has0GText && !walletState.addr) {
        console.log('  Connecting 0G wallet...');
        await Runtime.evaluate({
            expression: `(function() {
                const els = document.querySelectorAll('*');
                for (const el of els) {
                    const t = el.textContent?.trim();
                    if ((t === '0G' || t === '0G / EVM') && el.offsetHeight > 20 && el.offsetHeight < 60 && el.children.length <= 2) {
                        el.click(); return 'ok';
                    }
                }
                // Position fallback
                try { document.elementsFromPoint(492, 758)[0]?.click(); } catch(e) {}
                return 'fallback';
            })()`, returnByValue: true
        });
        await wait(4000);

        const after0G = await Runtime.evaluate({
            expression: `(() => ({
                txt: document.body.innerText,
                btns: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean)
            }))()`, returnByValue: true
        }).then(r => r.result.value);
        
        console.log('  After click:', JSON.stringify(after0G.btns).substring(0, 100));
        
        // Click Connect if available (but not Disconnect!)
        if (after0G.btns.includes('Connect')) {
            console.log('  Clicking Connect...');
            await Runtime.evaluate({
                expression: `document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Connect') b.click(); })`, returnByValue: false
            });
            await wait(3500);
            
            // Try Next/Sign/Confirm buttons in MetaMask
            for (const act of ['Next', 'Confirm', 'Sign']) {
                const r = await Runtime.evaluate({
                    expression: `(() => { const b=[...document.querySelectorAll('button')]; const f=b.find(x=>x.textContent.trim()==='${act}'); if(f){f.click(); return '${act}';} return null; })()`, returnByValue: true
                }).then(x => x.result.value);
                if (r) { console.log(`  -> ${r}`); await wait(2000); }
            }
        }

        await saveSS('cdp-v3-02-connected.png');
    } else {
        console.log('  ✅ Already connected to 0G!');
        await saveSS('cdp-v3-02-already.png');
    }

    // Step 3: Tournament page + currency check
    console.log('\n[Step 3] Go to /tournament ...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await wait(4000);
    await saveSS('cdp-v3-03-tournament.png');

    let ci;
    try {
        ci = await Runtime.evaluate({
            expression: `(() => {
                const txt=document.body.innerText;
                const btns=[]; document.querySelectorAll('button').forEach(b=>{const t=b.textContent.trim();if(t.match(/Player.*\\d+/))btns.push(t);});
                return {btns,buyIn:(txt.match(/Buy-in[^\\n]{0,50}/g)||[]).slice(0,5),has0G:txt.includes('0G'),hasTRX:txt.includes('TRX'),url:window.location.href};
            })()`, returnByValue: true
        }).then(r => r?.result?.value || {});
    } catch(e) { ci = {error: e.message}; }
    
    console.log('  Create buttons:', JSON.stringify(ci.btns));
    console.log('  Buy-in:', JSON.stringify(ci.buyIn).slice(0,3));
    console.log('  0G:', ci.has0G, '| TRX:', ci.hasTRX);
    if (ci.btns?.some(b => b.includes('0G'))) console.log('  ✅ FIX VERIFIED: Shows 0G!');

    // Step 4: Scroll and find tournament card with Join
    console.log('\n[Step 4] Find & click tournament card...');
    await Runtime.evaluate({ expression: 'window.scrollTo(0, document.body.scrollHeight-400)', returnByValue: false });
    await wait(800);

    const cards = await Runtime.evaluate({
        expression: `(() => {
            const r=[];
            document.querySelectorAll('div,a,section').forEach(el=>{
                const rc=el.getBoundingClientRect(), t=el.innerText||'';
                if(rc.width>150&&rc.width<900&&rc.height>80&&rc.height<400&&t.includes('WAITING')&&(t.includes('Join')||t.includes('Prize'))&&!t.startsWith('Click')&&!t.includes('Quick Create')&&t.length<500){
                    r.push({tag:el.tagName,h:Math.round(rc.height),preview:t.substring(0,100),join:!!t.match(/\\bJoin\\b/i)});
                }
            });
            return r.slice(0,5);
        })()`, returnByValue: true
    }).then(r => r.result.value);
    console.log('  Cards found:', JSON.stringify(cards).slice(0,200));

    if (cards.length > 0) {
        const best = cards.find(c=>c.join) || cards[0];
        console.log(`  Clicking: ${best.preview.substring(0,60)}...`);
        await Runtime.evaluate({
            expression: `(()=>{
                const p=best.preview.substring(0,60); 
                document.querySelectorAll('div,a,section').forEach(el=>{
                    const rc=el.getBoundingClientRect(),t=el.innerText||'';
                    if(rc.width>150&&rc.width<900&&rc.height>80&&rc.height<400&&t.includes('WAITING')&&(t.includes('Join')||t.includes('Prize'))&&!t.startsWith(p))el.click();
                });
            })())()`, returnByValue: false
        });
        await wait(3000);
    } else {
        console.log('  No card found, trying scroll+click...');
        await Runtime.evaluate({ expression: 'window.scrollBy(0,500)', returnByValue: false });
        await wait(800);
        await Runtime.evaluate({
            expression: `(()=>{ const all=document.querySelectorAll('*'); for(const el of all){const r=el.getBoundingClientRect();const t=el.innerText||''; if(r.height>60&&r.height<350&&r.width>200&&t.includes('WAITING')&&t.includes('100 TRX')){el.click();return'ok';}} return 'none';})())()`, returnByValue: false
        });
        await wait(3000);
    }
    await saveSS('cdp-v3-04-card-clicked.png');

    // Step 5: Find Join button and TIMING TEST
    console.log('\n[Step 5] Looking for Join modal (TIMING TEST)...');
    let _joinRaw;
    try {
        _joinRaw = await Runtime.evaluate({
            expression: `(() => {
                var _txt=document.body.innerText;
                var _btns=[];
                document.querySelectorAll('button').forEach(function(b){if(b.offsetWidth>0)_btns.push(b.textContent.trim());});
                document.querySelectorAll('[role="button"]').forEach(function(b){if(b.offsetWidth>0)_btns.push(b.textContent.trim());});
                return {u:window.location.href,b:_btns.slice(0,15),j:_btns.filter(function(x){return /join|confirm|mint|yes/i.test(x)}),s:!!document.querySelector('.swal2-popup'),m:_txt.includes('Buy-in'),p:_txt.toLowerCase().includes('processing...')};
            })()`, returnByValue: true
        });
        console.log('  Raw evaluate result type:', typeof _joinRaw, 'keys:', Object.keys(_joinRaw || {}).join(','));
    } catch (_e5) {
        console.log('  Evaluate threw:', _e5.message);
        _joinRaw = null;
    }
    // Parse safely
    console.log('  [CANARY] Parsing joinInfo now...');
    let joinInfo = { btns:[], joinBtns:[], swal:false, modal:false, processing:false };
    console.log('  [CANARY] joinInfo declared:', typeof joinInfo, 'joinBtns:', Array.isArray(joinInfo.joinBtns));
    if (_joinRaw && _joinRaw.result && _joinRaw.result.value) {
        const _v = _joinRaw.result.value;
        joinInfo = { btns: (_v.b || []), joinBtns: (_v.j || []), swal: !!_v.s, modal: !!_v.m, processing: !!_v.p };
        console.log('  Parsed joinInfo:', JSON.stringify(joinInfo));
    } else {
        console.log('  No usable result from evaluate, using defaults');
    }
    
    console.log('  Join buttons:', JSON.stringify(joinInfo.joinBtns));
    console.log('  Has Swal:', joinInfo.swal, '| Buy-in visible:', !!joinInfo.modal);

    if (joinInfo.joinBtns.length > 0 || joinInfo.swal || joinInfo.modal) {
        console.log('\n[Step 6] 🎯 CLICK JOIN - timing test (was HANGING before fix)');
        const t0 = Date.now();

        await Runtime.evaluate({
            expression: `(()=>{
                const btns=document.querySelectorAll('button,[role="button"]');
                for(const b of btns){const t=b.textContent.trim().toLowerCase();if(/join|confirm|yes/i.test(t)){b.click();return't:'+t;}}
                const s=document.querySelector('.swal2-confirm');if(s){s.click();return'swal-confirm';}
                return 'none';
            })()`, returnByValue: false
        });

        console.log('  Waiting (max 10s)...');
        let ok = false;
        for (let i = 0; i < 20; i++) {
            await wait(500);
            const s = await Runtime.evaluate({
                expression: `(()=>{
                    const t=document.body.innerText;
                    return {p:t.toLowerCase().includes('processing...'),u:window.location.href,g:/FOLD|CHECK|CALL|RAISE/.test(t),err:/error|insufficient|failed/i.test(t),ok:/success|joined|welcome|Minted/.test(t),swal:!!document.querySelector('.swal2-show')};
                })()`, returnByValue: true
            }).then(r => r.result.value);
            if (!s.p || s.g || s.err || s.ok) {
                const ms = Date.now()-t0; ok=true;
                console.log(`\n  ╔════════════════════════╗`);
                console.log(`  ║  ✅ RESOLVED in ${ms}ms!      ║`);
                console.log(`  ║  No longer Processing: ${!s.p}   ║`);
                console.log(`  ║  Game UI: ${s.g}             ║`);
                console.log(`  ║  Error: ${s.err}               ║`);
                console.log(`  ║  Success: ${s.ok}              ║`);
                console.log(`  ╚════════════════════════╝`);
                break;
            }
        }
        if (!ok) console.log(`  ❌ STILL HUNG after ${Date.now()-t0}ms`);
        await saveSS(ok ? 'cdp-v3-06-SUCCESS.png' : 'cdp-v3-06-HUNG.png');
    } else {
        console.log('  No join button. May need manual interaction.');
        await saveSS('cdp-v3-05-no-join.png');
    }

    console.log('\n=== DONE ===\nScreenshots: cdp-v3-01~06');
    await client.close();
}
test().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
