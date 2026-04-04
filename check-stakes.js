const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poker-game', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    
    const db = mongoose.connection.db;
    
    // 检查stakes集合
    const stakes = await db.collection('stakes').find({}).toArray();
    console.log('总Stake记录数:', stakes.length);
    
    if (stakes.length > 0) {
        console.log('\nStake记录详情:');
        stakes.forEach((s, i) => {
            console.log(`\n--- Stake ${i+1} ---`);
            console.log('  playerAddress:', s.playerAddress);
            console.log('  amount:', s.amount);
            console.log('  lockDuration:', s.lockDuration);
            console.log('  startTime:', s.startTime);
            console.log('  isActive:', s.isActive);
            console.log('  unlockAt:', s.unlockAt);
        });
    }
    
    await mongoose.disconnect();
})();
