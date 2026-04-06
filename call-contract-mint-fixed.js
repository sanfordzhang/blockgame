const CDP = require('chrome-remote-interface');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, Console } = client;
    
    await Page.enable();
    await Runtime.enable();
    
    // 监听控制台消息
    Runtime.consoleAPICalled(({ type, args }) => {
        const msg = args.map(a => a.value || JSON.stringify(a)).join(' ');
        console.log(`[浏览器] ${msg}`);
    });
    
    console.log('=== 调用智能合约（详细日志） ===\n');
    
    // 确保在正确的页面
    console.log('[1] 导航到游戏页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
    await Page.loadEventFired();
    await sleep(2000);
    
    // 检查TronWeb是否可用
    console.log('[2] 检查TronWeb状态...');
    const tronwebCheck = await Runtime.evaluate({
        expression: `(function() {
            return JSON.stringify({
                hasTronWeb: !!window.tronWeb,
                hasTronLink: !!window.tronLink,
                ready: window.tronWeb && window.tronWeb.ready
            });
        })()`,
        returnByValue: true
    });
    console.log('TronWeb状态:', tronwebCheck.result.value);
    
    // 调用合约
    console.log('\n[3] 调用safeMint合约...');
    const result = await Runtime.evaluate({
        expression: `(async function() {
            try {
                console.log('开始调用合约...');
                
                if (!window.tronWeb) {
                    throw new Error('TronWeb not available');
                }
                
                // 等待TronWeb ready
                if (!window.tronWeb.ready) {
                    console.log('等待TronWeb ready...');
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('TronWeb timeout')), 5000);
                        window.tronWeb.on('ready', () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                }
                
                console.log('连接合约...');
                const contractAddress = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
                const contract = await window.tronWeb.contract().at(contractAddress);
                console.log('合约已连接:', contractAddress);
                
                const params = {
                    playerAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
                    achievementTypeId: 6,
                    gameId: 'tournament-1775492306823',
                    v: 28,
                    r: '0xc26cd260ca3872bd79996e8a45aa598e5079bd1a2377a858774b651b0b847a18',
                    s: '0x22a46a324e627e92a89e4dc744174636cfbfe5593b25c0df65e1c463acb94401'
                };
                
                console.log('调用参数:', JSON.stringify(params));
                
                const tx = await contract.safeMint(
                    params.playerAddress,
                    params.achievementTypeId,
                    params.gameId,
                    params.v,
                    params.r,
                    params.s
                ).send({
                    feeLimit: 100000000
                });
                
                console.log('交易成功! TX:', tx);
                return JSON.stringify({ success: true, txHash: tx });
                
            } catch (e) {
                console.error('合约调用失败:', e);
                return JSON.stringify({ 
                    success: false, 
                    error: e.message || e.toString(),
                    stack: e.stack
                });
            }
        })()`,
        returnByValue: true,
        awaitPromise: true
    });
    
    console.log('\n合约调用结果:', result.result.value);
    
    const resultData = JSON.parse(result.result.value || '{}');
    
    if (resultData.success) {
        console.log('\n✅ 合约调用成功！');
        console.log('等待TronLink签名...');
        
        await sleep(5000);
        
        // 自动签名
        console.log('\n[4] 点击签名按钮...');
        try {
            execSync('cliclick c:1238,50');
            await sleep(2000);
            execSync('cliclick c:1414,635');
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
        console.log('\n❌ 合约调用失败:', resultData.error);
    }
    
    // 截图
    const { data } = await Page.captureScreenshot();
    require('fs').writeFileSync('./test-results/nft-mint-final.png', Buffer.from(data, 'base64'));
    console.log('\n📸 截图: test-results/nft-mint-final.png');
    
    await client.close();
    console.log('\n流程完成');
})();
