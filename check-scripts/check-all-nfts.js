const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }), 'nftclaims');

(async () => {
    // 查询所有记录
    const all = await NFTClaim.find({}).sort({ createdAt: -1 }).limit(10);
    
    console.log('\n=== 所有NFT记录 (最新10条) ===');
    console.log('总数:', all.length);
    
    all.forEach((c, i) => {
        const obj = c.toObject();
        console.log(`\n[${i+1}]`);
        console.log('  walletAddress:', obj.walletAddress);
        console.log('  type:', obj.achievementType || obj.type);
        console.log('  tokenId:', obj.tokenId);
        console.log('  txHash:', obj.txHash);
        console.log('  minted:', obj.minted);
        console.log('  status:', obj.status);
        console.log('  createdAt:', obj.createdAt);
    });
    
    await mongoose.disconnect();
})();
