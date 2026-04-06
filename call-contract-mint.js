const CDP = require('chrome-remote-interface');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    
    console.log('=== 调用智能合约锻造NFT ===\n');
    
    // 调用合约
    console.log('[1] 调用safeMint...');
    const result = await Runtime.evaluate({
        expression: `(async function() {
            try {
                if (!window.tronWeb) {
                    return JSON.stringify({ error: 'TronWeb not available' });
                }
                
                const contractAddress = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
                const contract = await window.tronWeb.contract().at(contractAddress);
                
                const playerAddress = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
                const achievementTypeId = 6;
                const gameId = 'tournament-1775492306823';
                const v = 28;
                const r = '0xc26cd260ca3872bd79996e8a45aa598e5079bd1a2377a858774b651b0b847a18';
                const s = '0x22a46a324e627e92a89e4dc744174636cfbfe5593b25c0df65e1c463acb94401';
                
                console.log('[Contract] Calling safeMint...');
                
                const tx = await contract.safeMint(
                    playerAddress,
                    achievementTypeId,
                    gameId,
                    v,
                    r,
                    s
                ).send({
                    feeLimit: 100000000
                });
                
                console.log('[Contract] TX:', tx);
                return JSON.stringify({ success: true, txHash: tx });
            } catch (e) {
                console.error('[Contract Error]', e);
                return JSON.stringify({ error: e.message || e.toString() });
            }
        })()`,
        returnByValue: true
    });
    
    console.log('合约调用结果:', result.result.value);
    
    // 等待TronLink签名窗口
    console.log('\n[2] 等待TronLink签名窗口 (5秒)...');
    await sleep(5000);
    
    // 点击签名按钮
    console.log('[3] 点击签名按钮...');
    try {
        // 点击TronLink图标
        execSync('cliclick c:1238,50');
        await sleep(2000);
        
        // 点击签名按钮（多次）
        execSync('cliclick c:1414,635');
        await sleep(1000);
        execSync('cliclick c:1414,635');
        await sleep(1000);
        execSync('cliclick c:1414,635');
        
        console.log('✓ 已点击签名按钮 3 次');
    } catch (e) {
        console.log('签名点击失败:', e.message);
    }
    
    // 等待确认
    console.log('\n[4] 等待交易确认 (15秒)...');
    await sleep(15000);
    
    // 截图
    const { data } = await Page.captureScreenshot();
    require('fs').writeFileSync('./test-results/contract-mint-result.png', Buffer.from(data, 'base64'));
    console.log('📸 截图: test-results/contract-mint-result.png');
    
    await client.close();
    console.log('\n✅ 流程完成！');
    console.log('NFT合约: https://nile.tronscan.org/#/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    console.log('钱包地址: https://nile.tronscan.org/#/address/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
})();
