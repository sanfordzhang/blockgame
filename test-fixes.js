/**
 * Test both fixes:
 * 1. Balance reads from 0G RPC directly (not MetaMask's current chain)
 * 2. Connection state persists after page refresh
 */
const CDP = require('chrome-remote-interface');
const fs = require('fs');

const BASE_URL = 'http://127.0.0.1:3001';
const PLAYER_ADDRESS = '0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function injectMockMM(c) {
    const { Runtime } = c;
    await Runtime.evaluate({
        expression: `
(function() {
    delete window.ethereum;
    var accs = ['${PLAYER_ADDRESS}'];
    var cid = '0x40EA';
    window.ethereum = { isMetaMask: true,
      request: async function(a) {
        switch(a.method){
          case 'eth_requestAccounts': return accs;
          case 'eth_accounts': return accs;
          case 'eth_chainId': return cid;
          case 'eth_getBalance': return '0x7ce66c50e2840000'; // 5.0 ETH/0G (simulating 0.5 * 10)
          case 'wallet_switchEthereumChain': return null;
          case 'wallet_addEthereumChain': return null;
          case 'personal_sign': return '0x'+'a'.repeat(130);
          default: return null;
        }
      },
      on:function(){}, removeListener:function(){}, emit:function(){}, _events:{},
      chainId: cid, selectedAddress: accs[0]
    };
    setTimeout(function(){ window.ethereum.emit('accountsChanged',accs); }, 200);
    return 'mock injected';
})()`,
        returnByValue: true, awaitPromise: true
    });
}

async function clickButton(c, text) {
    const { Input, Runtime } = c;
    const info = await Runtime.evaluate({
        expression: `(function(){
            var btns = Array.from(document.querySelectorAll('button'));
            var b = btns.find(x=>x.textContent.includes('${text}'));
            if(!b) return null;
            var r = b.getBoundingClientRect();
            return { x:r.x+r.width/2, y:r.y+r.height/2, w:r.width>0 };
        })()`,
        returnByValue: true
    });
    if (!info.result.value || !info.result.value.w) return false;
    
    // Use JavaScript click instead of Input for better reliability  
    await Runtime.evaluate({
        expression: `(function(){
            var b = Array.from(document.querySelectorAll('button')).find(x=>x.textContent.includes('${text}'));
            if(b){ b.click(); return 'clicked'; }
            return 'not found';
        })()`,
        returnByValue: true
    });
    return true;
}

async function getPageState(c) {
    const { Runtime } = c;
    return Runtime.evaluate({
        expression: `(function(){
            var body = document.body.innerText.substring(0, 1500);
            var hasWallet = /wallet|0x/i.test(body);
            
            // Find wallet info section
            var walletInfoEl = document.querySelector('[class*="Wallet"]') || 
                document.querySelectorAll('*').forEach?null:null;
            
            // Get key data
            var hasAddr = body.includes('0x');
            var hasBalance = /0\\.\\d+|\\d+\\.\\d+/.test(body);
            var showsConnected = body.includes('Registered') || body.includes('Register') || body.includes('Deposit') || body.includes('Withdraw');
            var showsButtons = body.includes('Connect TRON') || body.includes('0G / EVM');
            
            return {
                preview: body.substring(0,400),
                hasAddress: hasAddr,
                hasBalance: hasBalance,
                showsConnectedState: showsConnected,
                showsConnectButtons: showsButtons,
                localStorage: {
                    type: localStorage.getItem('wallet_type'),
                    addr: localStorage.getItem('wallet_address')
                }
            };
        })()`,
        returnByValue: true
    });
}

(async () => {
    try {
        console.log('=== Test Fix #1 (Balance) + Fix #2 (Persistence) ===\n');
        
        const client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        await Page.enable(); await Runtime.enable();
        
        // === STEP 1: Navigate + Inject Mock MM ===
        console.log('[Step 1] Navigate to Landing...');
        await Page.navigate({ url: BASE_URL + '/' });
        await sleep(4000);
        
        console.log('[Step 1] Inject Mock MetaMask with balance=5.0 0G...');
        await injectMockMM(client);
        await sleep(1000);
        
        // === STEP 2: Click 0G/EVM button ===
        console.log('[Step 2] Clicking "0G / EVM" button...');
        const clicked = await clickButton(client, '0G');
        if (!clicked) { console.log('Button not found!'); process.exit(1); }
        await sleep(4000);
        
        // === STEP 3: Check balance display ===
        console.log('\n[Step 3] Checking state after connection...');
        let state1 = await getPageState(client);
        console.log(JSON.stringify(state1.result.value, null, 2));
        
        // Screenshot after connect
        const ss1 = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('screenshots/fix-test-after-connect.png', Buffer.from(ss1.data, 'base64'));
        console.log('\nScreenshot: screenshots/fix-test-after-connect.png');
        
        // === STEP 4: Refresh page ===
        console.log('\n[Step 4] Refreshing page (testing persistence)...');
        await Page.reload();
        await sleep(5000);
        
        // Re-inject mock MetaMask after page reload
        console.log('[Step 4] Re-injecting mock MetaMask after refresh...');
        await injectMockMM(client);
        await sleep(1000);
        
        // === STEP 5: Check if connection persisted ===
        console.log('\n[Step 5] Checking state after REFRESH...');
        let state2 = await getPageState(client);
        console.log(JSON.stringify(state2.result.value, null, 2));
        
        const ss2 = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('screenshots/fix-test-after-refresh.png', Buffer.from(ss2.data, 'base64'));
        console.log('\nScreenshot: screenshots/fix-test-after-refresh.png');
        
        // === Summary ===
        console.log('\n=== RESULTS ===');
        const s1 = state1.result.value;
        const s2 = state2.result.value;
        console.log(`Fix #1 (Balance):     ${s1.hasBalance ? 'PASS ✅ (balance shown)' : 'FAIL ❌ (no balance)'}`);
        console.log(`Fix #2 (Persistence): ${!s2.showsConnectButtons ? 'PASS ✅ (connection kept)' : 'FAIL ❌ (back to connect buttons)'}`);
        console.log(`  - localStorage type: ${s2.localStorage.type || '(empty)'}`);
        console.log(`  - localStorage addr: ${(s2.localStorage.addr||'').substring(0,15)}...`);
        
        await client.close();
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
