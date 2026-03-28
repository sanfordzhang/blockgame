const mongoose = require('mongoose');

const NFTClaimSchema = new mongoose.Schema({
    playerAddress: { type: String, required: true, lowercase: true, index: true },
    achievementTypeId: { type: Number, required: true, min: 1, max: 6 },
    achievementType: { type: String, required: true },
    rarity: { type: String, required: true },
    tokenId: { type: Number, required: true },
    txHash: { type: String, default: null },
    handDescription: { type: String, default: null },
    gameId: { type: String, default: null },
    cards: [{ rank: String, suit: String }],
    yearMonth: { type: Number, required: true, index: true },
    claimedAt: { type: Date, default: Date.now, index: true }
});

NFTClaimSchema.statics.getYearMonth = function(date = new Date()) {
    return date.getFullYear() * 100 + (date.getMonth() + 1);
};

async function createNFT() {
    // 使用正确的数据库: bridge-poker
    await mongoose.connect('mongodb://127.0.0.1:27017/bridge-poker');
    console.log('连接到数据库: bridge-poker');
    
    const NFTClaim = mongoose.models.NFTClaim || mongoose.model('NFTClaim', NFTClaimSchema);
    
    // 检查是否已存在
    const existing = await NFTClaim.findOne({ playerAddress: 'tu8rhtpfqusgpbe9sxqafg8bdxf52ggsmv' });
    if (existing) {
        console.log('NFT已存在:', existing.achievementType, existing.tokenId);
    } else {
        // 创建NFT记录
        const nft = new NFTClaim({
            playerAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
            achievementTypeId: 6,
            achievementType: 'STRAIGHT',
            rarity: 'COMMON',
            tokenId: Date.now(),
            handDescription: 'A高顺子 (Broadway Straight) - A-K-Q-J-10',
            gameId: 'game-test-' + Date.now(),
            cards: [
                { rank: 'A', suit: 'h' },
                { rank: 'K', suit: 'h' },
                { rank: 'Q', suit: 'c' },
                { rank: 'J', suit: 'd' },
                { rank: '10', suit: 's' }
            ],
            yearMonth: NFTClaim.getYearMonth()
        });
        
        await nft.save();
        console.log('✅ NFT记录已创建:', nft.achievementType, nft.tokenId);
    }
    
    // 验证
    const all = await NFTClaim.find({ playerAddress: 'tu8rhtpfqusgpbe9sxqafg8bdxf52ggsmv' });
    console.log('数据库中的NFT记录:', all.length);
    all.forEach(n => console.log('  -', n.achievementType, n.tokenId, n.handDescription));
    
    await mongoose.disconnect();
}

createNFT().catch(console.error);
