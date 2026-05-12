// CDP 完整测试：浏览器端获取余额 -> 传给后端Join
const CDP = require('chrome-remote-interface');
const fs = require('fs');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    console.log('=== CDP 最终测试：TronLink余额 + Join ===\n');
    const client = await CDP({ port: 9222 });
    const { Runtime, Page } = client;
    
    const PLAYER = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    
    // Step 1: 访问Play页面（确保TronLink可用）
    console.log('1. 访问 Play 页面...');
    await Page.navigate({ url: 'http://43.163.114.175:3001/play' });
    await sleep(8000);
    
    // Step 2: 用浏览器的TronWeb直接查合约余额（和前端Landing.js一样的方式）
    console.log('2. 通过 TronWeb 查询合约余额...');
    let r = await Runtime.evaluate({
        expression: `
            (async function() {
                try {
                    const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
                    if (!tronWeb || !tronWeb.address) return 'ERROR: No TronWeb or not connected';
                    
                    const contractAddr = 'TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c';
                    const instance = await tronWeb.contract().at(contractAddr);
                    
                    // Call getPlayerInfo
                    const info = await instance.getPlayerInfo('${PLAYER}').call();
                    let bal = info.balance;
                    if (typeof bal === 'bigint') bal = Number(bal);
                    else if (typeof bal === 'string') bal = parseInt(bal, 10);
                    else if (bal && typeof bal.toNumber === 'function') bal = Number(bal);
                    else bal = Number(bal);
                    
                    let locked = info.lockedAmount;
                    if (typeof locked === 'bigint') locked = Number(locked);
                    else if (typeof locked === 'string') locked = parseInt(locked, 10);
                    else if (locked && typeof locked.toNumber === 'function') locked = Number(locked);
                    else locked = Number(locked) || 0;
                    
                    const total = bal + locked;
                    console.log('Browser contract query result:', {balance: bal, locked: locked, total: total});
                    return JSON.stringify({balance: bal, locked: locked, total: total});
                } catch(e) {
                    return 'TRONWEB_ERR: ' + e.message;
                }
            })()
        `,
        awaitPromise: true,
        returnByValue: true
    });
    console.log('TronWeb查询结果:', r.result.value);
    
    let clientBalance = 0;
    try {
        const balData = JSON.parse(r.result.value);
        clientBalance = balData.total || 0;
    } catch(e) {}
    
    // 截图Lobby状态
    const ss1 = await Page.captureScreenshot({ format: 'png', fromSurface: true });
    fs.writeFileSync('/Users/yingfengzhang/1JackSource/blockchain/game-core/cdp-tourney-lobby.png', Buffer.from(ss1.data, 'base64'));
    
    // Step 3: 创建+Join锦标赛，传clientBalance
    console.log('\n3. 创建并加入锦标赛 (clientBalance=' + (clientBalance/1e6).toFixed(2) + ' TRX)...');
    r = await Runtime.evaluate({
        expression: `
            (async function() {
                try {
                    const createRes = await fetch('/api/tournament/create', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'x-wallet-address': '${PLAYER}'},
                        body: JSON.stringify({configId: 3, walletAddress: '${PLAYER}', mockGame: false})
                    });
                    const ct = createRes.headers.get('content-type') || '';
                    let cd = ''; try { cd = await createRes.text(); } catch(e) {}
                    if (!ct.includes('json')) return 'Create non-JSON (' + ct + '): ' + cd.substring(0,200);
                    const createData = JSON.parse(cd);
                    if (!createData.success) return 'CREATE_FAIL: ' + JSON.stringify(createData).substring(0,300);
                    const tid = createData.tournament.tournamentId;
                    
                    await new Promise(r => setTimeout(r, 1500));
                    
                    // Join with clientBalance!
                    const joinRes = await fetch('/api/tournament/' + tid + '/join', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'x-wallet-address': '${PLAYER}'},
                        body: JSON.stringify({
                            walletAddress: '${PLAYER}',
                            socketId: 'cdp-test',
                            clientBalance: ${clientBalance}
                        })
                    });
                    const jt = joinRes.headers.get('content-type') || '';
                    let jd = ''; try { jd = await joinRes.text(); } catch(e) {}
                    if (!jt.includes('json')) return 'Join non-JSON (' + jt + '): ' + jd.substring(0,200);
                    const joinData = JSON.parse(jd);
                    return JSON.stringify({tournamentId: tid, joinResult: joinData});
                } catch(e) {
                    return 'ERROR: ' + e.message + ' | ' + e.stack.substring(0,100);
                }
            })()
        `,
        awaitPromise: true,
        returnByValue: true
    });
    console.log('\n结果:', r.result.value);

    // 截图最终状态
    await sleep(1000);
    const ss2 = await Page.captureScreenshot({ format: 'png', fromSurface: true });
    fs.writeFileSync('/Users/yingfengzhang/1JackSource/blockchain/game-core/cdp-tourney-result.png', Buffer.from(ss2.data, 'base64'));
    console.log('\n截图已保存');
    
    await client.close();
}

main().catch(console.error);
