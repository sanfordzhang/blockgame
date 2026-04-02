/**
 * 测试云隧道方案 - TronLink钱包访问本地Cards信息
 * 
 * 完整流程：
 * 1. 检查MongoDB连接
 * 2. 检查后端服务是否运行
 * 3. 创建测试NFT数据
 * 4. 验证API返回的Cards信息
 * 5. 提供云隧道设置指南
 */

const mongoose = require('mongoose');
const axios = require('axios');
const NFTClaim = require('./server/models/NFTClaim');

const API_BASE = 'http://127.0.0.1:7778';

// 测试钱包地址
const TEST_WALLET = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

async function main() {
    console.log('========================================');
    console.log('🧪 测试云隧道方案 - NFT Cards信息访问');
    console.log('========================================\n');

    // 步骤1: 检查MongoDB连接
    console.log('📝 步骤1: 检查MongoDB连接...');
    try {
        await mongoose.connect('mongodb://localhost:27017/bridgepoker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');
    } catch (error) {
        console.error('❌ MongoDB连接失败:', error.message);
        console.log('请先启动MongoDB: brew services start mongodb-community\n');
        process.exit(1);
    }

    // 步骤2: 检查后端服务
    console.log('📝 步骤2: 检查后端服务...');
    try {
        const response = await axios.get(`${API_BASE}/api/health`, { timeout: 2000 });
        console.log('✅ 后端服务运行正常\n');
    } catch (error) {
        console.error('❌ 后端服务未运行');
        console.log('请先启动后端: ENV_FILE=.env.testnet node server/server.js\n');
        await mongoose.disconnect();
        process.exit(1);
    }

    // 步骤3: 创建测试NFT数据
    console.log('📝 步骤3: 创建测试NFT数据...');
    const testNFT = await NFTClaim.findOne({ playerAddress: TEST_WALLET.toLowerCase() });
    
    if (testNFT) {
        console.log('✅ 找到已存在的NFT数据:');
        console.log(`   Token ID: ${testNFT.tokenId}`);
        console.log(`   Achievement: ${testNFT.achievementType}`);
        console.log(`   Cards: ${testNFT.cards.map(c => `${c.rank}${c.suit}`).join(' ')}\n`);
    } else {
        console.log('⚠️  未找到测试NFT，创建新的测试数据...');
        
        const newNFT = new NFTClaim({
            playerAddress: TEST_WALLET.toLowerCase(),
            achievementTypeId: 1,
            achievementType: 'ROYAL_FLUSH',
            rarity: 'LEGENDARY',
            tokenId: Date.now(),
            handDescription: 'Royal Flush - Ah Kh Qh Jh 10h',
            gameId: `test-game-${Date.now()}`,
            cards: [
                { rank: 'A', suit: 'h' },
                { rank: 'K', suit: 'h' },
                { rank: 'Q', suit: 'h' },
                { rank: 'J', suit: 'h' },
                { rank: '10', suit: 'h' }
            ],
            yearMonth: NFTClaim.getYearMonth()
        });
        
        await newNFT.save();
        console.log('✅ 测试NFT创建成功:');
        console.log(`   Token ID: ${newNFT.tokenId}`);
        console.log(`   Achievement: ${newNFT.achievementType}`);
        console.log(`   Cards: ${newNFT.cards.map(c => `${c.rank}${c.suit}`).join(' ')}\n`);
        
        testNFT = newNFT;
    }

    // 步骤4: 验证API返回Cards信息
    console.log('📝 步骤4: 验证API返回Cards信息...');
    try {
        const metadataUrl = `${API_BASE}/api/nft/metadata/${testNFT.tokenId}`;
        console.log(`   请求: ${metadataUrl}`);
        
        const response = await axios.get(metadataUrl);
        const metadata = response.data;
        
        console.log('\n📦 NFT元数据:');
        console.log(`   Name: ${metadata.name}`);
        console.log(`   Description: ${metadata.description}`);
        console.log(`   Image: ${metadata.image.substring(0, 50)}...`);
        console.log('\n📋 Attributes:');
        
        metadata.attributes.forEach(attr => {
            console.log(`   - ${attr.trait_type}: ${attr.value}`);
        });
        
        // 检查Cards属性
        const cardsAttr = metadata.attributes.find(a => a.trait_type === 'Cards');
        if (cardsAttr) {
            console.log('\n✅ Cards信息已成功包含在NFT元数据中！');
            console.log(`   Cards: ${cardsAttr.value}`);
        } else {
            console.log('\n❌ Cards信息未包含在NFT元数据中');
        }
    } catch (error) {
        console.error('❌ API测试失败:', error.message);
    }

    // 步骤5: 提供云隧道设置指南
    console.log('\n========================================');
    console.log('🚀 下一步：设置云隧道');
    console.log('========================================\n');
    
    console.log('1️⃣  启动Cloudflare Tunnel:');
    console.log('   cloudflared tunnel --url http://localhost:7778\n');
    
    console.log('2️⃣  复制输出的公网URL（例如: https://abc-xyz.trycloudflare.com）\n');
    
    console.log('3️⃣  设置NFT合约baseURI:');
    console.log('   node set-nft-baseuri-public.js https://YOUR-TUNNEL-URL/api/nft/metadata/\n');
    
    console.log('4️⃣  在TronLink钱包中:');
    console.log('   - 切换到TRON Nile测试网');
    console.log('   - 添加NFT合约地址: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    console.log(`   - 查看Token ID: ${testNFT.tokenId}`);
    console.log('   - 应该能看到Cards信息: "Ah Kh Qh Jh 10h"\n');
    
    console.log('5️⃣  验证数据流:');
    console.log('   TronLink → https://tunnel-url/api/nft/metadata/{tokenId}');
    console.log('   → Cloudflare → 本地cloudflared → localhost:7778');
    console.log('   → MongoDB → 返回Cards信息\n');

    await mongoose.disconnect();
    console.log('✅ 测试完成！');
}

main().catch(console.error);
