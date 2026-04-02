const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

(async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/bridgepoker');
        console.log('✅ MongoDB连接成功');
        
        const testWallet = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
        
        // 查找或创建测试NFT
        let nft = await NFTClaim.findOne({ playerAddress: testWallet.toLowerCase() });
        
        if (!nft) {
            nft = new NFTClaim({
                playerAddress: testWallet.toLowerCase(),
                achievementTypeId: 1,
                achievementType: 'ROYAL_FLUSH',
                rarity: 'LEGENDARY',
                tokenId: Date.now(),
                handDescription: 'Royal Flush - Ah Kh Qh Jh 10h',
                gameId: 'test-' + Date.now(),
                cards: [
                    { rank: 'A', suit: 'h' },
                    { rank: 'K', suit: 'h' },
                    { rank: 'Q', suit: 'h' },
                    { rank: 'J', suit: 'h' },
                    { rank: '10', suit: 'h' }
                ],
                yearMonth: NFTClaim.getYearMonth()
            });
            await nft.save();
            console.log('✅ 创建新测试NFT');
        } else {
            console.log('✅ 找到已存在的NFT');
        }
        
        console.log('\n📊 测试NFT数据:');
        console.log('  Token ID:', nft.tokenId);
        console.log('  Achievement:', nft.achievementType);
        console.log('  Cards:', nft.cards.map(c => c.rank + c.suit).join(' '));
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
})();
