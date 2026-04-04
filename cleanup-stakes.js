const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poker-game', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    
    const db = mongoose.connection.db;
    
    console.log('清理无效的Stake记录...\n');
    
    // 删除所有unlockAt为undefined的记录
    const result = await db.collection('stakes').deleteMany({
        unlockAt: { $exists: false }
    });
    
    console.log('已删除', result.deletedCount, '条无效记录');
    
    // 检查剩余记录
    const remaining = await db.collection('stakes').find({}).toArray();
    console.log('剩余记录数:', remaining.length);
    
    await mongoose.disconnect();
})();
