const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

mongoose.connect(process.env.MONGODB_URI);

const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }), 'nftclaims');

(async () => {
    // 查询所有记录，按 _id 倒序（_id 包含时间戳）
    const claims = await NFTClaim.find({}).sort({ _id: -1 }).limit(10);
    
    console.log('\n=== 所有NFT记录（最新10条，按ID倒序） ===');
    
    claims.forEach((c, i) => {
        const obj = c.toObject();
        console.log(`\n[${i+1}]`);
        console.log('  _id:', obj._id);
        console.log('  playerAddress:', obj.playerAddress);
        console.log('  achievementType:', obj.achievementType);
        console.log('  tokenId:', obj.tokenId);
        console.log('  txHash:', obj.txHash ? obj.txHash.substring(0, 20) + '...' : '无');
        console.log('  gameId:', obj.gameId);
    });
    
    await mongoose.disconnect();
})();
