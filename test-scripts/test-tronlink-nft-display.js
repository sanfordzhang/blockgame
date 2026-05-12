/**
 * TronLink NFT显示端到端测试
 * 测试NFT #10的牌型显示
 */

const axios = require('axios');
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

// 获取当前云隧道URL
async function getTunnelURL() {
    try {
        const response = await axios.get('http://localhost:7778/api/nft/types', { timeout: 2000 });
        return 'http://localhost:7778';
    } catch (error) {
        console.log('⚠️  本地服务未响应，需要云隧道URL');
        return null;
    }
}

async function testNFT10() {
    console.log('========================================');
    console.log('🧪 测试NFT #10 TronLink显示');
    console.log('========================================\n');

    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/bridge-poker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    // 1. 检查数据库中的NFT #10
    console.log('📊 步骤1: 检查数据库...');
    const nft10 = await NFTClaim.findOne({ tokenId: '10' });

    if (!nft10) {
        console.log('❌ 数据库中没有NFT #10');
        process.exit(1);
    }

    console.log(`✅ 找到NFT #10:`);
    console.log(`   - achievementType: ${nft10.achievementType}`);
    console.log(`   - achievementTypeId: ${nft10.achievementTypeId}`);
    console.log(`   - cards: ${nft10.cards}`);
    console.log(`   - tokenId: ${nft10.tokenId}\n`);

    // 2. 测试API端点
    console.log('🌐 步骤2: 测试API端点...');
    const baseURL = await getTunnelURL();

    if (!baseURL) {
        console.log('❌ 无法连接到服务器');
        process.exit(1);
    }

    const achievementTypeId = nft10.achievementTypeId || 6;
    const testURLs = [
        `${baseURL}/api/nft/metadata/${achievementTypeId}/${nft10.tokenId}`,
        `${baseURL}/api/nft/metadata/${nft10.tokenId}`
    ];

    for (const url of testURLs) {
        try {
            console.log(`\n🔗 测试: ${url}`);
            const response = await axios.get(url, { timeout: 5000 });
            const metadata = response.data;

            console.log(`✅ API响应成功`);
            console.log(`   - name: ${metadata.name}`);
            console.log(`   - description: ${metadata.description}`);

            // 检查Cards属性
            const cardsAttr = metadata.attributes?.find(a => a.trait_type === 'Cards');
            if (cardsAttr) {
                console.log(`   ✅ Cards: ${cardsAttr.value}`);
            } else {
                console.log(`   ❌ 缺少Cards属性`);
            }

            // 显示所有属性
            console.log(`\n   📋 所有属性:`);
            metadata.attributes?.forEach(attr => {
                console.log(`      - ${attr.trait_type}: ${attr.value}`);
            });

        } catch (error) {
            console.log(`❌ API请求失败: ${error.message}`);
        }
    }

    // 3. 检查合约baseURI配置
    console.log('\n\n🔧 步骤3: 检查合约配置...');
    console.log('请确认以下配置:');
    console.log(`   1. 合约地址: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC`);
    console.log(`   2. 网络: Nile测试网`);
    console.log(`   3. baseURI应该指向云隧道URL`);

    await mongoose.disconnect();

    console.log('\n========================================');
    console.log('✅ 测试完成');
    console.log('========================================\n');
}

testNFT10().catch(console.error);
