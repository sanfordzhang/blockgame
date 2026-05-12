/**
 * 检查价格历史记录
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

async function check() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker');
    console.log('✓ Connected to MongoDB\n');
    
    // 检查 PriceHistory
    const PriceHistory = mongoose.model('PriceHistory', new mongoose.Schema({}, { 
        strict: false,
        collection: 'pricehistories'
    }));
    
    const priceHistories = await PriceHistory.find({}).sort({ timestamp: -1 }).limit(10).lean();
    
    console.log('--- PriceHistory 记录 ---');
    if (priceHistories.length === 0) {
        console.log('❌ 没有价格历史记录！\n');
    } else {
        console.log(`找到 ${priceHistories.length} 条记录:\n`);
        for (const h of priceHistories) {
            console.log(`时间: ${new Date(h.timestamp * 1000).toLocaleString()}`);
            console.log(`  开: ${h.open?.toFixed(4)} 高: ${h.high?.toFixed(4)} 低: ${h.low?.toFixed(4)} 收: ${h.close?.toFixed(4)}`);
            console.log(`  成交量: ${h.volumeTRX} TRX, ${h.volumeCHIP} CHIP`);
            console.log('');
        }
    }
    
    // 检查 SwapEvent
    const SwapEvent = mongoose.model('SwapEvent', new mongoose.Schema({}, { 
        strict: false,
        collection: 'swapevents'
    }));
    
    const swapEvents = await SwapEvent.find({}).sort({ blockTimestamp: -1 }).limit(5).lean();
    
    console.log('--- SwapEvent 记录 ---');
    if (swapEvents.length === 0) {
        console.log('❌ 没有 Swap 交易记录！\n');
    } else {
        console.log(`找到 ${swapEvents.length} 条记录:\n`);
        for (const s of swapEvents) {
            console.log(`交易: ${s.transactionHash?.substring(0, 20)}...`);
            console.log(`  发送者: ${s.sender}`);
            console.log(`  TRX In: ${s.amount0In} Out: ${s.amount0Out}`);
            console.log(`  CHIP In: ${s.amount1In} Out: ${s.amount1Out}`);
            console.log('');
        }
    }
    
    // 检查 PoolState
    const PoolState = mongoose.model('PoolState', new mongoose.Schema({}, { 
        strict: false,
        collection: 'poolstates'
    }));
    
    const poolState = await PoolState.findOne({}).lean();
    
    console.log('--- PoolState 记录 ---');
    if (!poolState) {
        console.log('❌ 没有 Pool 状态记录！\n');
    } else {
        console.log(`TRX Reserve: ${(parseInt(poolState.reserve0) / 1e6).toFixed(4)}`);
        console.log(`CHIP Reserve: ${(parseInt(poolState.reserve1) / 1e6).toFixed(4)}`);
        console.log(`Price: ${poolState.price0?.toFixed(4)} CHIP/TRX`);
        console.log(`Updated: ${poolState.updatedAt}`);
    }
    
    await mongoose.connection.close();
}

check();
