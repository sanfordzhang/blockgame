require('dotenv').config({ path: '.env.testnet' });
const mongoose = require('mongoose');

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridgepoker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    
    const db = mongoose.connection.db;
    const collection = db.collection('nftclaims');
    
    const unclaimed = await collection.find({ txHash: null }).toArray();
    console.log('找到', unclaimed.length, '个未铸造NFT');
    
    for (const nft of unclaimed) {
        const newGameId = 'nft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        await collection.updateOne(
            { _id: nft._id },
            { $set: { gameId: newGameId } }
        );
        console.log(nft.tokenId + ': ' + newGameId);
        await new Promise(r => setTimeout(r, 10));
    }
    
    console.log('完成');
    await mongoose.disconnect();
}

fix().catch(console.error);
