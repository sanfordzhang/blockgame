// 在后端环境中测试数据库连接
require('dotenv').config({ path: '.env.testnet' });
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');
const NFTService = require('./server/services/NFTService');

(async () => {
    try {
        // 连接数据库
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bridgepoker';
        console.log('连接MongoDB:', mongoUri);
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ MongoDB连接成功');
        
        // 测试直接查询
        const tokenId = 1774788248313;
        console.log('\n测试直接查询:', { tokenId });
        
        const nft = await NFTClaim.findOne({ tokenId: parseInt(tokenId) });
        if (nft) {
            console.log('✅ 直接查询成功:');
            console.log('  Achievement:', nft.achievementType);
            console.log('  Cards:', nft.cards.map(c => `${c.rank}${c.suit}`).join(' '));
        } else {
            console.log('❌ 直接查询失败');
        }
        
        // 测试NFTService
        console.log('\n测试NFTService.getNFTMetadata:');
        const metadata = await NFTService.getNFTMetadata(tokenId);
        console.log('返回的元数据:', JSON.stringify(metadata, null, 2));
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
})();
