const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const { execSync } = require('child_process');
const fs = require('fs');

// ============================================================
// 钱包操作鼠标点击坐标 (来自 mouse-operations.json.replay.py 录制)
// ============================================================
const CLICKS = {
    // 浏览器刷新按钮
    REFRESH:           { x: 93,   y: 96 },

    // 首页 0G/EVM 连接按钮
    OG_EVM_BUTTON:     { x: 492,  y: 758 },
    
    // 钱包选择弹窗 - 选择 MetaMask
    SELECT_METAMASK:   { x: 1208, y: 271 },
    
    // MetaMask 连接确认按钮
    MM_CONNECT:        { x: 1425, y: 875 },
    
    // MetaMask 确认交易/签名按钮
    MM_CONFIRM_TX:     { x: 1425, y: 875 },
    
    // 断开连接 (两次点击)
    DISCONNECT_1:      { x: 1464, y: 883 },
    DISCONNECT_2:      { x: 1362, y: 380 },
};

function clickAt(name, delayMs = 800) {
    const pos = CLICKS[name];
    if (!pos) { console.error(`Unknown click target: ${name}`); return; }
    console.log(`  [🖱️] CLICK ${name} @ (${pos.x}, ${pos.y})`);
    try {
        execSync(`cliclick c:${pos.x},${pos.y}`, { encoding: 'utf-8', timeout: 5000 });
    } catch (e) {
        // fallback: use python Quartz
        try {
            execSync(`python3 -c "
from Quartz import CGEventCreateMouseEvent, CGEventPost, CGEventSetSource, CGEventSourceCreate, kCGEventSourceStateHIDSystemState, kCGHIDEventTap, kCGMouseButtonLeft, kCGEventLeftMouseDown, kCGEventLeftMouseUp
src = CGEventSourceCreate(kCGEventSourceStateHIDSystemState)
d = CGEventCreateMouseEvent(src, kCGEventLeftMouseDown, (${pos.x}, ${pos.y}), kCGMouseButtonLeft)
u = CGEventCreateMouseEvent(src, kCGEventLeftMouseUp, (${pos.x}, ${pos.y}), kCGMouseButtonLeft)
CGEventPost(kCGHIDEventTap, d)
import time; time.sleep(0.05)
CGEventPost(kCGHIDEventTap, u)
"`, { encoding: 'utf-8', timeout: 5000 });
        } catch(e2) { console.warn(`  click failed for ${name}: ${e2.message}`); }
    }
    return new Promise(r => setTimeout(r, delayMs));
}

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function httpPost(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
        const u = new URL(url);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        });
        req.on('error', reject); req.write(body); req.end();
    });
}

async function connectCDP(urlPattern) {
    for (let i = 0; i < 20; i++) {
        const pages = await new Promise((resolve, reject) => {
            http.get('http://localhost:9222/json', res => {
                let d = ''; res.on('data', c => d += c);
                res.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });
        const candidates = pages.filter(p => p.url.includes(urlPattern));
        const page = candidates[0] || pages.find(p => p.url.includes('3001'));
        if (page) {
            log(`CDP connected: ${page.url.substring(0, 80)}`);
            const c = await CDP({ target: page.webSocketDebuggerUrl });
            await c.Page.enable();
            await c.Runtime.enable();
            await c.Log.enable();
            let errors = [];
            c.on('Log.entryAdded', ({entry}) => {
                const t = entry.text || '';
                if (/error|Error|fail|FAIL|reject|timeout/i.test(t)) errors.push(t.substring(0, 200));
            });
            const screenshot = (name) => c.Page.captureScreenshot().then(({data}) => {
                fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
                log(`📸 ${name}`);
            }).catch(() => {});
            const eval_ = (expr) => c.Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true })
                .then(r => r.result?.value).catch(() => null);
            const getErrors = () => errors;
            return { client: c, screenshot, eval_, getErrors };
        }
        log(`CDP waiting... (${i+1}/20)`);
        await sleep(1000);
    }
    throw new Error('Tab not found');
}

// ============================================================
// 主测试流程
// ============================================================
async function test() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    log('=============================================================');
    log('  MetaMask INFT 铸造 + tokenURI 显示验证 (自动点击版)');
    log('=============================================================');

    const INFT_ADDRESS = '0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5';

    // ---- Step 0: 连接浏览器 CDP ----
    log('\n[Step 0] 连接 Chrome CDP...');
    const { client, screenshot, eval_, getErrors } = await connectCDP('3001');
    await screenshot('00-start');

    // ---- Step 1: 检测当前钱包状态（可能已从之前的会话保持连接）----
    log('\n[Step 1] 检测钱包连接状态...');
    
    // 先尝试 eth_accounts（无弹窗）
    let metamaskAddr = null;
    let chainId = 0;
    
    const existingAccounts = await eval_(`(async () => {
        if (!window.ethereum) return { accounts: [], chainId: 0, hasProvider: false };
        try {
            const accs = await window.ethereum.request({ method: 'eth_accounts' });
            const cid = await window.ethereum.request({ method: 'eth_chainId' });
            return { accounts: accs, chainId: parseInt(cid, 16), hasProvider: true };
        } catch(e) { return { accounts: [], chainId: 0, error: e.message, hasProvider: true }; }
    })()`);
    
    log(`  eth_accounts 结果: ${JSON.stringify(existingAccounts)}`);
    
    if (existingAccounts?.accounts?.length > 0) {
        metamaskAddr = existingAccounts.accounts[0];
        chainId = existingAccounts.chainId;
        log(`✅ 已有连接账户: ${metamaskAddr}, Chain ID: ${chainId}`);
    } else {
        // 需要弹窗连接 - 执行点击流程
        log('  无已连接账户，执行连接流程...');
        
        client.Page.navigate({ url: BASE_URL + '/' }).catch(() => {});
        await sleep(2000);
        
        log('  点击 0G/EVM 按钮...');
        await clickAt('OG_EVM_BUTTON', 1500);
        await sleep(1000);
        
        log('  选择 MetaMask...');
        await clickAt('SELECT_METAMASK', 1500);
        await sleep(2000);
        
        // 此时 MetaMask 弹出连接请求 - 点击确认
        log('  等待 MetaMask 弹窗... (4秒后点击 Confirm)');
        await sleep(4000);
        await clickAt('MM_CONNECT', 3000);
        await sleep(5000);
        
        // 刷新后重新检查
        client.Page.navigate({ url: BASE_URL + '/' }).catch(() => {});
        await sleep(3000);
        
        const newAccounts = await eval_(`(async () => {
            try {
                const accs = await window.ethereum.request({ method: 'eth_accounts' });
                const cid = await window.ethereum.request({ method: 'eth_chainId' });
                return { accounts: accs, chainId: parseInt(cid, 16) };
            } catch(e) { return { error: e.message }; }
        })()`);
        
        if (newAccounts?.accounts?.length > 0) {
            metamaskAddr = newAccounts.accounts[0];
            chainId = newAccounts.chainId;
            log(`✅ 连接成功: ${metamaskAddr}, Chain ID: ${chainId}`);
        } else {
            // 最后手段：使用 eth_requestAccounts 并等待用户在 MetaMask 中手动确认
            log('  使用 requestAccounts（需要手动确认 MetaMask 弹窗）...');
            
            // 先启动并行等待用户操作
            const reqPromise = eval_(`(async () => {
                try {
                    const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
                    const cid = await window.ethereum.request({ method: 'eth_chainId' });
                    return { accounts: accs, chainId: parseInt(cid, 16) };
                } catch(e) { return { error: e.message }; }
            })()`);
            
            // 每5秒尝试点击一次 MetaMask 确认按钮（处理弹窗）
            for (let attempt = 0; attempt < 12; attempt++) {
                await sleep(5000);
                log(`  等待 MetaMask 确认... (${attempt+1}/12)`);
                await clickAt('MM_CONFIRM_TX', 500);
                
                // 检查 promise 是否已完成
                // （无法真正检测，但继续等待）
            }
            
            const finalResult = await reqPromise;
            log(`  最终结果: ${JSON.stringify(finalResult)}`);
            if (finalResult?.accounts?.length > 0) {
                metamaskAddr = finalResult.accounts[0];
                chainId = finalResult.chainId;
            }
        }
    }

    if (!metamaskAddr) {
        log('❌ 无法获取 MetaMask 账户。请手动:');
        log('   1. 在 Chrome 中打开 MetaMask');
        log('   2. 确保 0G Testnet 已添加且已连接');
        log('   3. 然后重新运行此脚本');
        
        const errs = getErrors();
        if (errs.length > 0) errs.slice(0, 5).forEach(e => log('  · ' + e));
        await screenshot('no-account');
        await client.close();
        process.exit(1);
    }

    // ---- Step 4: 确保在 0G Testnet ----
    if (mmStatus2.chainId !== 16602) {
        log('\n[Step 4] 切换到 0G Testnet...');
        await eval_(`(async () => {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x410a' }]
            });
        })()`);
        await sleep(3000);
        // MetaMask 会弹出网络切换确认
        await clickAt('MM_CONFIRM_TX', 4000);
        await sleep(2000);
        log('✅ 已切换到 0G Testnet');
    }

    // ---- Step 5: 通过 MetaMask 铸造 INFT ----
    log('\n[Step 5] 调用 mint() 铸造 INFT (MetaMask 弹窗确认)...');
    await screenshot('06-before-mint');

    const mintResult = await eval_(`(async () => {
        const handType = 'Straight';
        
        // 内嵌 SVG metadata URI → MetaMask 可直接渲染图片
        const svg = \`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
            <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/>
            </linearGradient></defs>
            <rect width="300" height="400" rx="16" fill="url(#bg)"/>
            <text x="150" y="160" text-anchor="middle" font-size="32" fill="white" font-weight="bold" font-family="Arial">\${handType}</text>
            <text x="150" y="210" text-anchor="middle" font-size="14" fill="#ddd">0G Poker Hand</text>
            <text x="150" y="235" text-anchor="middle" font-size="12" fill="#bbb">ERC-7857 Interactive NFT</text>
            <rect x="40" y="260" width="220" height="3" rx="1.5" fill="rgba(255,255,255,0.3)"/>
            <text x="150" y="290" text-anchor="middle" font-size="11" fill="#aaa">tokenURI override enabled</text>
            <text x="150" y="380" text-anchor="middle" font-size="10" fill="#888">0G Testnet</text>
        </svg>\`;
        const svgB64 = btoa(unescape(encodeURIComponent(svg)));
        const metaObj = {
            name: handType + ' INFT',
            description: 'Straight hand achievement NFT on 0G Poker with tokenURI override.',
            image: 'data:image/svg+xml;base64,' + svgB64,
            attributes: [
                { trait_type: 'Hand Type', value: handType },
                { trait_type: 'Rarity', value: 'Common' },
                { trait_type: 'Standard', value: 'ERC-7857' },
                { trait_type: 'Network', value: '0G Testnet' }
            ]
        };
        const metaB64 = btoa(unescape(encodeURIComponent(JSON.stringify(metaObj))));
        const metadataURI = 'data:application/json;base64,' + metaB64;

        const abi = ['function mint(address to, string handType, string storageRootHash, string metadataURI) returns (uint256)'];
        const iface = new ethers.utils.Interface(abi);
        const calldata = iface.encodeFunctionData('mint', [
            '${metamaskAddr}',
            handType,
            '0x0000000000000000000000000000000000000000000000000000000000000000',
            metadataURI
        ]);

        const txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from: '${metamaskAddr}', to: '${INFT_ADDRESS}', data: calldata }]
        });
        return txHash;
    })()`);

    log(`🎉 mint() TX Hash: ${mintResult}`);
    await screenshot('07-mint-tx-sent');

    // ---- Step 6: 自动点击 MetaMask 确认弹窗 ----
    log('\n[Step 6] 等待 MetaMask 弹窗... 自动点击 Confirm (5秒后)');
    await sleep(5000);  // 等 MetaMask 弹窗出现
    await screenshot('08-metamask-popup');
    
    log('  点击 MetaMask Confirm 按钮...');
    await clickAt('MM_CONFIRM_TX', 3000);
    await screenshot('09-after-confirm-click');

    // 再等一次（有时需要二次确认）
    await sleep(3000);
    // 检查是否还有弹窗需要处理
    const stillOnPage = await eval_(`window.location.href`).catch(() => null);
    log(`  当前页面: ${(stillOnPage || '').substring(0, 60)}`);

    // ---- Step 7: 等待链上确认 ----
    log('\n[Step 7] 等待链上确认 (25秒)...');
    await sleep(25000);
    await screenshot('10-chain-confirmed');

    // ---- Step 8: 验证 tokenURI ----
    log('\n[Step 8] 验证 tokenURI 和余额...');
    const verifyResult = await eval_(`(async () => {
        try {
            const abi = ['function tokenURI(uint256) view returns (string)', 
                       'function balanceOf(address) view returns (uint256)',
                       'function name() view returns (string)',
                       'function symbol() view returns (string)',
                       'function ownerOf(uint256) view returns (address)'];
            const iface = new ethers.utils.Interface(abi);

            const balData = iface.encodeFunctionData('balanceOf', ['${metamaskAddr}']);
            const balRes = await window.ethereum.request({
                method: 'eth_call', params: [{ to: '${INFT_ADDRESS}', data: balData }]
            });
            const balance = parseInt(balRes, 16);

            let result = { balance, hasNFT: balance > 0 };

            if (balance > 0) {
                // tokenURI
                const uriData = iface.encodeFunctionData('tokenURI', [balance]);
                const uriRaw = await window.ethereum.request({
                    method: 'eth_call', params: [{ to: '${INFT_ADDRESS}', data: uriData }]
                });
                
                // Decode ABI string
                let uriStr = uriRaw;
                if (uriRaw && uriRaw.startsWith('0x')) {
                    try {
                        const h = uriRaw.slice(2);
                        const off = parseInt(h.slice(0, 64), 16);
                        const len = parseInt(h.slice(off * 2, off * 2 + 64), 16);
                        const start = (off + 2) * 2;
                        uriStr = Buffer.from(h.slice(start, start + len * 2), 'hex').toString('utf8');
                    } catch(e) { uriStr = '[decode error, raw length=' + uriRaw.length + ']'; }
                }
                result.tokenURI = uriStr;
                result.tokenId = balance;

                // name & symbol
                const nameRaw = await window.ethereum.request({ method: 'eth_call', params: [{ to: '${INFT_ADDRESS}', data: iface.encodeFunctionData('name', []) }] });
                const symRaw = await window.ethereum.request({ method: 'eth_call', params: [{ to: '${INFT_ADDRESS}', data: iface.encodeFunctionData('symbol', []) }] });
                result.contractName = nameRaw ? Buffer.from(nameRaw.slice(2), 'hex').toString('utf8').replace(/\\x00/g, '').trim() : '?';
                result.symbol = symRaw ? Buffer.from(symRaw.slice(2), 'hex').toString('utf8').replace(/\\x00/g, '').trim() : '?';
            }
            return result;
        } catch(e) { return { error: e.message }; }
    })()`);

    log(`验证结果:`);
    log(`  合约名称: ${verifyResult?.contractName || '?'}`);
    log(`  合约符号: ${verifyResult?.symbol || '?'}`);
    log(`  NFT 数量: ${verifyResult?.balance || 0}`);
    log(`  Token ID: ${verifyResult?.tokenId || 'N/A'}`);
    log(`  tokenURI: ${(verifyResult?.tokenURI || '').substring(0, 80)}...`);
    log(`  有图片元数据: ${!!(verifyResult?.tokenURI?.includes('image')) ? 'YES ✓' : 'NO'}`);

    await screenshot('11-verify-result');

    // ---- Step 9: 检查浏览器错误 ----
    log('\n[Step 9] 检查浏览器错误日志...');
    const errs = getErrors();
    if (errs.length > 0) {
        log(`⚠️ 发现 ${errs.length} 条错误/警告:`);
        errs.slice(0, 15).forEach(e => log('  · ' + e));
    } else {
        log('✅ 无浏览器错误');
    }

    // ---- 最终报告 ----
    log('');
    log('╔══════════════════════════════════════════════════════════╗');
    log('║          🎉 MetaMask INFT 铸造验证报告                   ║');
    log('╠══════════════════════════════════════════════════════════╣');
    log(`║ 合约地址:  ${INFT_ADDRESS.padEnd(46)} ║`);
    log(`║ 钱包地址:  ${(metamaskAddr || '?').padEnd(46)} ║`);
    log(`║ TX Hash:   ${(mintResult || '?').padEnd(46)} ║`);
    log(`║ NFT 数量:  ${String(verifyResult?.balance || 0).padEnd(46)} ║`);
    log(`║ Token ID:  ${String(verifyResult?.tokenId || 'N/A').padEnd(46)} ║`);
    log(`║ tokenURI:  ${(verifyResult?.tokenURI ? '✅ 有效 (' + verifyResult.tokenURI.length + ' chars)' : '❌ 空').padEnd(46)} ║`);
    log(`║ 图片渲染:  ${verifyResult?.tokenURI?.includes('image') ? '✅ SVG内嵌图片可用' : '⚠️ 待确认'.padEnd(44)} ║`);
    log('╠══════════════════════════════════════════════════════════╣');
    log('║  MetaMask 导入方法:                                      ║');
    log('║  1. 打开 MetaMask → NFTs 标签                              ║');
    log('║  2. 点击 Import NFT                                     ║');
    log(`║  3. Address: ${INFT_ADDRESS} ║`);
    log(`║  4. Token ID: ${String(verifyResult?.tokenId || '1')}                                    ║`);
    log('║  5. 应能看到带渐变背景的 "Straight" 图片!                 ║');
    log('╚══════════════════════════════════════════════════════════╝');

    await screenshot('12-final-report');
    await client.close();
    log('\n✅ 测试完成!');
}

test().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
