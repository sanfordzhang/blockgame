/**
 * 验证TronLink钱包NFT显示修复
 */

const axios = require('axios');
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

const TUNNEL_URL = 'https://absolute-lightweight-miscellaneous-linda.trycloudflare.com';

async function verifyAll() {
    console.log('========================================');
    console.log('🔍 验证TronLink NFT Cards信息显示');
    console.log('========================================\n');

    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/bridge-poker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    // 获取所有NFT
    const allNFTs = await NFTClaim.find({}, { tokenId: 1, achievementType: 1 }).sort({ tokenId: 1 });
    console.log(`📊 数据库中共有 ${allNFTs.length} 个NFT\n`);

    // 测试每个NFT
    const results = [];
    for (const nft of allNFTs) {
        const tokenId = nft.tokenId;
        const achievementType = nft.achievementTypeId || 6; // 默认6

        try {
            // 测试双参数路由（合约格式）
            const url = `${TUNNEL_URL}/api/nft/metadata/${achievementType}/${tokenId}`;
            const response = await axios.get(url, { timeout: 5000 });
            const metadata = response.data;

            // 检查Cards信息
            const cardsAttr = metadata.attributes?.find(a => a.trait_type === 'Cards');
            const hasCards = cardsAttr && cardsAttr.value;

            results.push({
                tokenId,
                achievementType: nft.achievementType,
                hasCards,
                cardsValue: cardsAttr?.value || 'N/A',
                status: hasCards ? '✅' : '❌'
            });

            console.log(`${hasCards ? '✅' : '❌'} Token #${tokenId} (${nft.achievementType}): ${hasCards ? cardsAttr.value : '无Cards信息'}`);
        } catch (error) {
            results.push({
                tokenId,
                achievementType: nft.achievementType,
                hasCards: false,
                cardsValue: 'Error',
                status: '❌'
            });
            console.log(`❌ Token #${tokenId}: API访问失败 - ${error.message}`);
        }
    }

    // 统计结果
    const successCount = results.filter(r => r.hasCards).length;
    const failCount = results.filter(r => !r.hasCards).length;

    console.log('\n========================================');
    console.log('📊 验证结果统计');
    console.log('========================================');
    console.log(`✅ 成功: ${successCount}/${allNFTs.length}`);
    console.log(`❌ 失败: ${failCount}/${allNFTs.length}`);
    console.log(`成功率: ${((successCount / allNFTs.length) * 100).toFixed(1)}%`);

    if (failCount > 0) {
        console.log('\n❌ 失败的Token IDs:');
        results.filter(r => !r.hasCards).forEach(r => {
            console.log(`   Token #${r.tokenId} (${r.achievementType})`);
        });
    }

    console.log('\n========================================');
    console.log('📱 TronLink钱包验证步骤');
    console.log('========================================');
    console.log('1. 打开TronLink钱包');
    console.log('2. 切换到TRON Nile测试网');
    console.log('3. 进入NFT收藏品页面');
    console.log('4. 添加NFT合约: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    console.log('5. 点击任意NFT查看详情');
    console.log('6. 在"属性"(Attributes)中查看Cards信息');
    console.log('========================================\n');

    await mongoose.disconnect();

    return failCount === 0;
}

verifyAll().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ 验证失败:', error);
    process.exit(1);
});
