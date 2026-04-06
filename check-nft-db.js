const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }), 'nftclaims');

(async () => {
    const claims = await NFTClaim.find({ 
        walletAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' 
    }).sort({ createdAt: -1 }).limit(5);
    
    console.log('\n=== 最新NFT记录 ===');
    claims.forEach((c, i) => {
        const obj = c.toObject();
        console.log(`\n[${i+1}] ${obj.achievementType || obj.type}`);
        console.log('  Token ID:', obj.tokenId || '无');
        console.log('  TX Hash:', obj.txHash || '无');
        console.log('  Minted:', obj.minted);
        console.log('  Status:', obj.status);
        console.log('  Created:', obj.createdAt);
        console.log('  Game ID:', obj.gameId);
    });
    
    await mongoose.disconnect();
})();
