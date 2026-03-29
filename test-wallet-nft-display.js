/**
 * 测试钱包页面NFT显示
 * CDP连接到现有Chrome浏览器
 */

const CDP = require('chrome-remote-interface');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const WALLET_URL = `http://127.0.0.1:3001/wallet?address=${PLAYER1_ADDRESS}`;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('🧪 测试钱包页面NFT显示');
    console.log('========================================\n');
    
    let client;
    try {
        console.log('🔗 连接Chrome CDP (端口9222)...');
        client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        console.log('✅ CDP连接成功');
        
        // 导航到钱包页面
        console.log(`📱 导航到: ${WALLET_URL}`);
        await Page.navigate({ url: WALLET_URL });
        await Page.loadEventFired();
        await sleep(2000);
        
        // 截图1: 初始加载
        console.log('📸 截图: 初始加载...');
        let screenshot = await Page.captureScreenshot();
        const fs = require('fs');
        fs.writeFileSync('wallet-nft-initial.png', Buffer.from(screenshot.data, 'base64'));
        console.log('   保存: wallet-nft-initial.png');
        
        // 点击Collection标签
        console.log('🏷️ 点击Collection标签...');
        const clickResult = await Runtime.evaluate({
            expression: `
                (function() {
                    const tabs = document.querySelectorAll('button');
                    for (const tab of tabs) {
                        if (tab.textContent.includes('Collection')) {
                            tab.click();
                            return '已点击Collection';
                        }
                    }
                    return '未找到Collection标签';
                })()
            `
        });
        console.log('   结果:', clickResult.result.value);
        await sleep(1500);
        
        // 截图2: NFT Collection
        console.log('📸 截图: NFT Collection...');
        screenshot = await Page.captureScreenshot();
        fs.writeFileSync('wallet-nft-collection.png', Buffer.from(screenshot.data, 'base64'));
        console.log('   保存: wallet-nft-collection.png');
        
        // 检查NFT显示
        const nftCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    const nftCards = document.querySelectorAll('[style*="border-left"]');
                    return {
                        cardCount: nftCards.length,
                        pageText: document.body.innerText.substring(0, 500)
                    };
                })()
            `
        });
        console.log('   NFT卡片数量:', nftCheck.result.value.cardCount);
        
        // 获取页面内容
        const pageContent = await Runtime.evaluate({
            expression: `document.body.innerText`
        });
        console.log('\n📄 页面内容预览:');
        console.log(pageContent.result.value.substring(0, 500));
        
        console.log('\n========================================');
        console.log('✅ 测试完成');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

main();
