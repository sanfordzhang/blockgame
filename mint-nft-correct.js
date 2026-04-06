const CDP = require('chrome-remote-interface');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    Runtime.consoleAPICalled(({ type, args }) => {
        const msg = args.map(a => a.value || JSON.stringify(a)).join(' ');
        console.log(`[浏览器] ${msg}`);
    });
    
    console.log('=== 使用正确的方法名 claimNFT ===\n');
    
    // 导航到NFT页面
    console.log('[1] 导航到NFT页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
    await Page.loadEventFired();
    await sleep(2000);
    
    // 调用合约
    console.log('\n[2] 调用 claimNFT 方法...');
    const result = await Runtime.evaluate({
        expression: `(async function() {
            try {
                console.log('准备调用合约...');
                
                const contract = await window.tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
                console.log('合约已连接');
                
                // 使用正确的方法名和参数（6个参数，不含metadata）
                const tx = await contract.claimNFT(
                    6,  // achievementTypeId (STRAIGHT)
                    1775492525,  // timestamp
                    'tournament-1775492306823',  // gameId
                    28,  // v
                    '0xc26cd260ca3872bd79996e8a45aa598e5079bd1a2377a858774b651b0b847a18',  // r
                    '0x22a46a324e627e92a89e4dc744174636cfbfe5593b25c0df65e1c463acb94401'   // s
                ).send({
                    feeLimit: 100000000,
                    callValue: 5 * 1e6  // 5 TRX (mint price)
                });
                
                console.log('交易成功! TX:', tx);
                return JSON.stringify({ success: true, txHash: tx });
                
            } catch (e) {
                console.error('错误:', e);
                return JSON.stringify({ 
                    success: false, 
                    error: e.message || e.toString()
                });
            }
        })()`,
        returnByValue: true,
        awaitPromise: true
    });
    
    console.log('\n结果:', result.result.value);
    
    const resultData = JSON.parse(result.result.value || '{}');
    
    if (resultData.success) {
        console.log('\n✅ 交易已提交！');
        console.log('等待TronLink签名...');
        
        await sleep(5000);
        
        // 自动签名
        console.log('\n[3] 点击签名按钮...');
        try {
            execSync('cliclick c:1238,50');  // TronLink图标
            await sleep(2000);
            execSync('cliclick c:1414,635');  // 签名按钮
            await sleep(1000);
            execSync('cliclick c:1414,635');
            await sleep(1000);
            execSync('cliclick c:1414,635');
            console.log('✓ 已点击签名按钮');
        } catch (e) {
            console.log('签名点击失败:', e.message);
        }
        
        await sleep(10000);
        
    } else {
        console.log('\n❌ 交易失败:', resultData.error);
    }
    
    // 截图
    const { data } = await Page.captureScreenshot();
    require('fs').writeFileSync('./test-results/nft-mint-correct.png', Buffer.from(data, 'base64'));
    console.log('\n📸 截图: test-results/nft-mint-correct.png');
    
    await client.close();
    console.log('\n流程完成');
    console.log('NFT合约: https://nile.tronscan.org/#/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
})();
