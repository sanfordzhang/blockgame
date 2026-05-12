/**
 * 快速测试TronLink获取的NFT元数据
 */

const CDP = require('chrome-remote-interface');

async function quickTest() {
    let client;
    
    try {
        client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        console.log('🔍 测试TronLink获取的元数据...\n');
        
        // 访问前端
        await Page.navigate({ url: 'http://127.0.0.1:3001' });
        await Page.loadEventFired();
        
        // 等待TronLink加载
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 直接获取NFT #10的元数据
        const result = await Runtime.evaluate({
            expression: `
                (async function() {
                    try {
                        const contract = await window.tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
                        const tokenURI = await contract.tokenURI(10).call();
                        
                        const response = await fetch(tokenURI);
                        const data = await response.json();
                        
                        return {
                            tokenURI: tokenURI,
                            name: data.name,
                            attributes: data.attributes
                        };
                    } catch (e) {
                        return { error: e.message };
                    }
                })()
            `,
            awaitPromise: true
        });
        
        console.log('📊 Token #10 元数据:\n');
        const data = result.result.value;
        
        if (data.error) {
            console.log('❌ 错误:', data.error);
        } else {
            console.log('Token URI:', data.tokenURI);
            console.log('Name:', data.name);
            console.log('\nAttributes:');
            
            data.attributes.forEach(attr => {
                const marker = attr.trait_type === 'Cards' ? '✅' : '  ';
                console.log(`${marker} ${attr.trait_type}: ${attr.value}`);
            });
            
            const cards = data.attributes.find(a => a.trait_type === 'Cards');
            
            if (cards) {
                console.log('\n✅✅✅ Cards信息存在:', cards.value);
                console.log('\nTronLink应该能够显示这个信息！');
            } else {
                console.log('\n❌ Cards信息缺失');
            }
        }
        
        // 截图
        const screenshot = await Page.captureScreenshot();
        const fs = require('fs');
        fs.writeFileSync('/Users/yingfengzhang/1JackSource/blockchain/game-core/quick-test-result.png', 
            Buffer.from(screenshot.data, 'base64'));
        
        console.log('\n📸 截图已保存: quick-test-result.png');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    } finally {
        if (client) await client.close();
    }
}

quickTest();
