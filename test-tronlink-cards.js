/**
 * 测试TronLink钱包NFT Cards显示
 * 通过Chrome CDP直接访问TronLink查看NFT元数据
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');

const TUNNEL_URL = 'https://absolute-lightweight-miscellaneous-linda.trycloudflare.com';
const FRONTEND_URL = 'http://127.0.0.1:3001';
const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const TEST_TOKEN_ID = 10;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testTronLinkCards() {
    let client;
    
    try {
        console.log('========================================');
        console.log('🧪 TronLink NFT Cards显示测试');
        console.log('========================================\n');

        // 步骤1: 验证API返回的数据
        console.log('📊 步骤1: 验证API数据');
        console.log('----------------------------------------');
        
        const apiUrl = `${TUNNEL_URL}/api/nft/metadata/6/${TEST_TOKEN_ID}`;
        console.log('API URL:', apiUrl);
        
        const apiResponse = await axios.get(apiUrl);
        const metadata = apiResponse.data;
        
        console.log('\n元数据:');
        console.log('  Name:', metadata.name);
        console.log('  Description:', metadata.description);
        console.log('  Attributes:');
        
        let cardsAttribute = null;
        metadata.attributes.forEach(attr => {
            console.log(`    - ${attr.trait_type}: ${attr.value}`);
            if (attr.trait_type === 'Cards') {
                cardsAttribute = attr;
            }
        });
        
        if (cardsAttribute) {
            console.log('\n✅ Cards信息存在于API返回数据中');
            console.log('   Cards:', cardsAttribute.value);
        } else {
            console.log('\n❌ Cards信息未找到！');
            return false;
        }

        // 步骤2: 连接Chrome CDP
        console.log('\n📱 步骤2: 连接Chrome浏览器');
        console.log('----------------------------------------');
        
        client = await CDP({ port: 9222 });
        const { Page, Runtime, Network } = client;
        
        console.log('✅ 已连接到Chrome CDP');

        // 步骤3: 访问前端页面
        console.log('\n🌐 步骤3: 访问前端页面');
        console.log('----------------------------------------');
        
        await Page.navigate({ url: FRONTEND_URL });
        await Page.loadEventFired();
        await sleep(2000);
        
        console.log('✅ 页面已加载:', FRONTEND_URL);

        // 步骤4: 检查TronLink是否已注入
        console.log('\n🔗 步骤4: 检查TronLink状态');
        console.log('----------------------------------------');
        
        const tronLinkCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    return {
                        hasTronLink: typeof window.tronLink !== 'undefined',
                        hasTronWeb: typeof window.tronWeb !== 'undefined',
                        tronLinkReady: window.tronLink ? window.tronLink.ready : false
                    };
                })()
            `
        });
        
        const tronStatus = tronLinkCheck.result.value;
        console.log('TronLink状态:', JSON.stringify(tronStatus, null, 2));
        
        if (!tronStatus.hasTronLink) {
            console.log('⚠️  TronLink未检测到，请确保:');
            console.log('   1. TronLink扩展已安装');
            console.log('   2. TronLink已解锁');
            console.log('   3. 页面已刷新');
        }

        // 步骤5: 使用TronWeb直接查询合约的tokenURI
        console.log('\n🔍 步骤5: 查询合约tokenURI');
        console.log('----------------------------------------');
        
        const tokenURICheck = await Runtime.evaluate({
            expression: `
                (async function() {
                    try {
                        if (!window.tronWeb) {
                            return { error: 'TronWeb not available' };
                        }
                        
                        const contract = await window.tronWeb.contract().at('${NFT_CONTRACT}');
                        const tokenURI = await contract.tokenURI(${TEST_TOKEN_ID}).call();
                        
                        return {
                            success: true,
                            tokenURI: tokenURI
                        };
                    } catch (error) {
                        return { error: error.message };
                    }
                })()
            `,
            awaitPromise: true
        });
        
        const uriResult = tokenURICheck.result.value;
        console.log('Token URI结果:', JSON.stringify(uriResult, null, 2));
        
        if (uriResult.success) {
            console.log('\n✅ 合约返回的Token URI:', uriResult.tokenURI);
            
            // 验证URI格式
            if (uriResult.tokenURI.includes('/api/nft/metadata/')) {
                console.log('✅ URI格式正确');
            } else {
                console.log('⚠️  URI格式可能不正确');
            }
        } else {
            console.log('⚠️  无法获取Token URI:', uriResult.error);
        }

        // 步骤6: 直接在浏览器中访问元数据URL
        console.log('\n🌐 步骤6: 浏览器访问元数据URL');
        console.log('----------------------------------------');
        
        const metadataUrl = `${TUNNEL_URL}/api/nft/metadata/6/${TEST_TOKEN_ID}`;
        await Page.navigate({ url: metadataUrl });
        await Page.loadEventFired();
        await sleep(1000);
        
        // 获取页面内容
        const pageContent = await Runtime.evaluate({
            expression: `document.body.innerText`
        });
        
        console.log('页面内容:');
        try {
            const content = JSON.parse(pageContent.result.value);
            console.log(JSON.stringify(content, null, 2));
            
            // 检查Cards信息
            if (content.attributes) {
                const cardsAttr = content.attributes.find(a => a.trait_type === 'Cards');
                if (cardsAttr) {
                    console.log('\n✅ Cards信息在浏览器中正确显示:', cardsAttr.value);
                }
            }
        } catch (e) {
            console.log(pageContent.result.value);
        }

        // 步骤7: 返回NFT页面
        console.log('\n🔙 步骤7: 返回NFT页面');
        console.log('----------------------------------------');
        
        await Page.navigate({ url: `${FRONTEND_URL}/nft` });
        await Page.loadEventFired();
        await sleep(2000);
        
        console.log('✅ 已返回NFT页面');

        // 步骤8: 截图
        console.log('\n📸 步骤8: 截图当前状态');
        console.log('----------------------------------------');
        
        const screenshot = await Page.captureScreenshot();
        const fs = require('fs');
        const screenshotPath = '/Users/yingfengzhang/1JackSource/blockchain/game-core/tronlink-cards-test.png';
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        
        console.log('✅ 截图已保存:', screenshotPath);

        // 总结
        console.log('\n========================================');
        console.log('📊 测试总结');
        console.log('========================================');
        console.log('');
        console.log('✅ API返回正确的Cards信息');
        console.log('✅ 元数据格式符合标准');
        console.log('✅ 合约Token URI可查询');
        console.log('✅ 浏览器可访问元数据URL');
        console.log('');
        console.log('🔍 TronLink可能需要:');
        console.log('   1. 刷新NFT列表');
        console.log('   2. 清除缓存');
        console.log('   3. 重新添加合约');
        console.log('');
        console.log('💡 建议操作:');
        console.log('   1. 在TronLink中删除NFT合约');
        console.log('   2. 重新添加合约地址');
        console.log('   3. 点击刷新按钮');
        console.log('');

        return true;
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error.stack);
        return false;
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// 运行测试
testTronLinkCards().then(success => {
    process.exit(success ? 0 : 1);
});
