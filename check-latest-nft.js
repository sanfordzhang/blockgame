const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

mongoose.connect(process.env.MONGODB_URI);

const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }), 'nftclaims');

(async () => {
    const claims = await NFTClaim.find({ 
        playerAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
    }).sort({ createdAt: -1 }).limit(5);
    
    console.log('\n=== 最新NFT记录 ===');
    console.log('总数:', claims.length);
    
    claims.forEach((c, i) => {
        const obj = c.toObject();
        console.log(`\n[${i+1}] ${obj.achievementType}`);
        console.log('  tokenId:', obj.tokenId || '无');
        console.log('  txHash:', obj.txHash || '无');
        console.log('  minted:', obj.minted);
        console.log('  status:', obj.status);
        console.log('  gameId:', obj.gameId);
        console.log('  createdAt:', obj.createdAt);
    });
    
    await mongoose.disconnect();
})();
