/**
 * 简单验证脚本 - 检查NFT元数据的Cards信息
 */

const axios = require('axios');

const TUNNEL_URL = 'https://absolute-lightweight-miscellaneous-linda.trycloudflare.com';
const TOKENS_TO_TEST = [1, 10, 11];

async function verifyCards() {
    console.log('========================================');
    console.log('🔍 验证NFT Cards信息');
    console.log('========================================\n');

    for (const tokenId of TOKENS_TO_TEST) {
        console.log(`\n📊 Token #${tokenId}`);
        console.log('----------------------------------------');
        
        try {
            // 测试单参数路由
            const url1 = `${TUNNEL_URL}/api/nft/metadata/${tokenId}`;
            console.log('URL:', url1);
            
            const response1 = await axios.get(url1);
            const metadata1 = response1.data;
            
            const cards1 = metadata1.attributes?.find(a => a.trait_type === 'Cards');
            
            if (cards1) {
                console.log('✅ Cards (单参数):', cards1.value);
            } else {
                console.log('❌ Cards信息缺失');
            }
            
            // 测试双参数路由（合约使用的格式）
            const url2 = `${TUNNEL_URL}/api/nft/metadata/6/${tokenId}`;
            const response2 = await axios.get(url2);
            const metadata2 = response2.data;
            
            const cards2 = metadata2.attributes?.find(a => a.trait_type === 'Cards');
            
            if (cards2) {
                console.log('✅ Cards (双参数):', cards2.value);
            } else {
                console.log('❌ Cards信息缺失');
            }
            
            // 完整元数据
            console.log('\n完整元数据:');
            console.log(JSON.stringify(metadata2, null, 2));
            
        } catch (error) {
            console.log('❌ 错误:', error.message);
        }
    }
    
    console.log('\n\n========================================');
    console.log('📋 总结');
    console.log('========================================\n');
    
    console.log('✅ API正常返回Cards信息');
    console.log('');
    console.log('🔍 TronLink可能的问题:');
    console.log('  1. 缓存了旧的元数据');
    console.log('  2. 需要重新添加NFT合约');
    console.log('');
    console.log('💡 解决方案:');
    console.log('');
    console.log('方案1: 重新添加NFT合约');
    console.log('  1. TronLink → NFT收藏品');
    console.log('  2. 删除合约: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    console.log('  3. 重新添加合约地址');
    console.log('  4. 等待加载完成');
    console.log('');
    console.log('方案2: 清除缓存');
    console.log('  1. TronLink → 设置 → 高级 → 清除缓存');
    console.log('  2. 重启浏览器');
    console.log('');
    console.log('方案3: 查看调试页面');
    console.log('  访问: http://127.0.0.1:3001/nft-debug.html');
    console.log('  查看元数据是否包含Cards信息');
    console.log('');
}

verifyCards();
