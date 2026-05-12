const CDP = require('chrome-remote-interface');
const { execSync } = require('child_process');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    console.log('=== 触发NFT锻造流程 ===\n');
    
    // 1. 查找最新的未锻造NFT记录
    console.log('[1] 查找最新的未锻造NFT记录...');
    
    const nftResult = await Runtime.evaluate({
        expression: `(async function() {
            // 调用后端API获取NFT列表
            const response = await fetch('http://127.0.0.1:7778/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
            const data = await response.json();
            
            if (data.nfts && data.nfts.length > 0) {
                // 查找最新的未锻造NFT
                const unminted = data.nfts.find(n => !n.txHash || n.txHash === 'synced_from_chain');
                if (unminted) {
                    return JSON.stringify({
                        found: true,
                        achievementType: unminted.achievementType,
                        gameId: unminted.gameId,
                        tokenId: unminted.tokenId
                    });
                }
            }
            
            return JSON.stringify({ found: false });
        })()`,
        returnByValue: true
    });
    
    let nftInfo;
    try {
        nftInfo = typeof nftResult.result.value === 'string' 
            ? JSON.parse(nftResult.result.value) 
            : nftResult.result.value;
    } catch (e) {
        console.log('解析结果:', nftResult.result.value);
        nftInfo = { found: false };
    }
    console.log('NFT信息:', nftInfo);
    
    // 2. 触发锻造
    if (nftInfo.found) {
        console.log('\n[2] 触发锻造流程...');
        
        // 发送锻造请求
        const mintRequest = await Runtime.evaluate({
            expression: `(async function() {
                const response = await fetch('http://127.0.0.1:7778/api/nft/prepare-mint', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        walletAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
                        achievementType: '${nftInfo.achievementType}',
                        gameSessionId: '${nftInfo.gameId}'
                    })
                });
                const data = await response.json();
                return JSON.stringify(data);
            })()`,
            returnByValue: true
        });
        
        const mintData = JSON.parse(mintRequest.result.value);
        console.log('锻造响应:', mintData);
        
        if (mintData.success && mintData.signature) {
            console.log('\n[3] 调用智能合约...');
            
            // 调用智能合约
            const contractCall = await Runtime.evaluate({
                expression: `(async function() {
                    try {
                        if (!window.tronWeb) {
                            return JSON.stringify({ error: 'TronWeb not available' });
                        }
                        
                        const contract = await window.tronWeb.contract().at('${mintData.onchainContractAddress || 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC'}');
                        
                        // 调用safeMint
                        const tx = await contract.safeMint(
                            '${mintData.playerAddress || 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'}',
                            ${mintData.achievementTypeId || 6},
                            '${mintData.gameId}',
                            ${JSON.stringify(mintData.signature)}
                        ).send();
                        
                        return JSON.stringify({ success: true, txHash: tx });
                    } catch (e) {
                        return JSON.stringify({ error: e.message });
                    }
                })()`,
                returnByValue: true
            });
            
            console.log('合约调用结果:', contractCall.result.value);
            
            // 等待TronLink签名
            await sleep(5000);
            
            // 点击签名按钮
            console.log('\n[4] 点击签名按钮...');
            try {
                execSync('cliclick c:1238,50'); // TronLink图标
                await sleep(2000);
                execSync('cliclick c:1414,635'); // 签名按钮
                await sleep(1000);
                execSync('cliclick c:1414,635');
                await sleep(1000);
                execSync('cliclick c:1414,635');
                console.log('✓ 已点击签名按钮');
            } catch (e) {
                console.log('签名点击失败:', e.message);
            }
            
            // 等待确认
            console.log('\n[5] 等待交易确认 (10秒)...');
            await sleep(10000);
            
            // 截图
            const { data } = await Page.captureScreenshot();
            require('fs').writeFileSync('./test-results/nft-mint-result.png', Buffer.from(data, 'base64'));
            console.log('📸 截图: test-results/nft-mint-result.png');
        }
    } else {
        console.log('未找到未锻造的NFT');
    }
    
    await client.close();
    console.log('\n流程完成');
})();
