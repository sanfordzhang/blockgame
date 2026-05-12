/**
 * 查询数据库原始数据
 */
const mongoose = require('mongoose');

// 加载环境变量
require('dotenv').config({ path: '.env.testnet' });

async function checkDB() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    console.log('✓ Connected to MongoDB');

    // 查询 UserLiquidity
    const UserLiquidity = mongoose.model('UserLiquidity', new mongoose.Schema({}, { 
        strict: false,
        collection: 'userliquidities'
    }));
    
    console.log('\n=== UserLiquidity Collection ===');
    const userLiquidities = await UserLiquidity.find({}).lean();
    console.log('Count:', userLiquidities.length);
    console.log('Data:', JSON.stringify(userLiquidities, null, 2));

    // 查询 PoolState
    const PoolState = mongoose.model('PoolState', new mongoose.Schema({}, { 
        strict: false,
        collection: 'poolstates'
    }));
    
    console.log('\n=== PoolState Collection ===');
    const poolStates = await PoolState.find({}).sort({ updatedAt: -1 }).limit(3).lean();
    console.log('Count:', poolStates.length);
    console.log('Data:', JSON.stringify(poolStates, null, 2));

    // 查询 SwapEvent
    const SwapEvent = mongoose.model('SwapEvent', new mongoose.Schema({}, { 
        strict: false,
        collection: 'swapevents'
    }));
    
    console.log('\n=== SwapEvent Collection ===');
    const swapEvents = await SwapEvent.find({}).sort({ blockTimestamp: -1 }).limit(5).lean();
    console.log('Count:', swapEvents.length);
    if (swapEvents.length > 0) {
        console.log('Sample:', JSON.stringify(swapEvents[0], null, 2));
    }

    await mongoose.disconnect();
}

checkDB()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
