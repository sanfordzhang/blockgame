const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

// 手动指定要同步的Token IDs
const TOKENS_TO_SYNC = [10, 11]; // 添加更多需要的Token ID

async function syncNFTs() {
    try {
        await mongoose.connect('mongodb://localhost:27017/bridge-poker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功');

        console.log(`\n📝 同步 ${TOKENS_TO_SYNC.length} 个NFT...`);

        for (const tokenId of TOKENS_TO_SYNC) {
            // 检查是否已存在
            const existing = await NFTClaim.findOne({ tokenId });
            if (existing) {
                console.log(`   Token #${tokenId} 已存在，跳过`);
                continue;
            }

            console.log(`\n📝 创建 Token #${tokenId}...`);

            // 创建基础NFT记录
            const nft = new NFTClaim({
                playerAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'.toLowerCase(), // 测试钱包地址
                achievementTypeId: 6, // STRAIGHT
                achievementType: 'STRAIGHT',
                rarity: 'COMMON',
                tokenId: tokenId,
                handDescription: `Synced Token #${tokenId} - Straight hand`,
                gameId: `synced-${tokenId}`,
                cards: [
                    { rank: '10', suit: 'h' },
                    { rank: '9', suit: 'd' },
                    { rank: '8', suit: 'c' },
                    { rank: '7', suit: 's' },
                    { rank: '6', suit: 'h' }
                ],
                yearMonth: NFTClaim.getYearMonth()
            });

            await nft.save();
            console.log(`   ✅ Token #${tokenId} 已创建`);
        }

        // 验证
        const finalCount = await NFTClaim.countDocuments();
        console.log(`\n✅ 同步完成！数据库现在有 ${finalCount} 个NFT`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

syncNFTs();
