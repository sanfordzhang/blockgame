const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poker-game', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    
    const db = mongoose.connection.db;
    const yourAddress = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    
    // 检查所有CHIP交易
    const allTxs = await db.collection('chiptransactions').find({}).toArray();
    console.log('总交易记录数:', allTxs.length);
    
    if (allTxs.length > 0) {
        console.log('\n钱包地址列表:');
        [...new Set(allTxs.map(tx => tx.walletAddress))].forEach(addr => 
            console.log('  -', addr)
        );
    }
    
    // 计算您的余额（大小写都查）
    const result = await db.collection('chiptransactions').aggregate([
        { $match: { 
            $or: [
                { walletAddress: yourAddress },
                { walletAddress: yourAddress.toLowerCase() }
            ]
        }},
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]).toArray();
    
    console.log('\n========================================');
    console.log('您的CHIP统计:', result.length > 0 ? result[0] : '无记录');
    
    // 查看您的交易详情
    const yourTxs = await db.collection('chiptransactions').find({
        $or: [
            { walletAddress: yourAddress },
            { walletAddress: yourAddress.toLowerCase() }
        ]
    }).sort({ timestamp: -1 }).limit(10).toArray();
    
    if (yourTxs.length > 0) {
        console.log('\n最近的交易:');
        yourTxs.forEach(tx => {
            console.log(`  ${tx.type}: ${tx.amount} CHIP - ${tx.description || ''}`);
        });
    }
    
    await mongoose.disconnect();
})();
