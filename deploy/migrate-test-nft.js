const mongoose = require('mongoose');

(async () => {
    try {
        // 连接源数据库
        const sourceDb = await mongoose.createConnection('mongodb://localhost:27017/bridgepoker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        // 连接目标数据库
        const targetDb = await mongoose.createConnection('mongodb://localhost:27017/bridge-poker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ 连接到两个数据库');
        
        // 从源数据库读取测试NFT
        const sourceCollection = sourceDb.collection('nftclaims');
        const testNFT = await sourceCollection.findOne({ tokenId: 1774788248313 });
        
        if (!testNFT) {
            console.log('❌ 未找到测试NFT');
            process.exit(1);
        }
        
        console.log('✅ 找到测试NFT:');
        console.log('  Token ID:', testNFT.tokenId);
        console.log('  Achievement:', testNFT.achievementType);
        console.log('  Cards:', testNFT.cards.map(c => `${c.rank}${c.suit}`).join(' '));
        
        // 插入到目标数据库
        const targetCollection = targetDb.collection('nftclaims');
        
        // 先删除可能存在的重复数据
        await targetCollection.deleteOne({ tokenId: testNFT.tokenId });
        
        // 插入新数据
        await targetCollection.insertOne(testNFT);
        
        console.log('\n✅ 测试NFT已迁移到bridge-poker数据库');
        
        // 验证
        const verify = await targetCollection.findOne({ tokenId: 1774788248313 });
        if (verify) {
            console.log('✅ 验证成功:');
            console.log('  Token ID:', verify.tokenId);
            console.log('  Cards:', verify.cards.map(c => `${c.rank}${c.suit}`).join(' '));
        }
        
        await sourceDb.close();
        await targetDb.close();
        
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
})();
