/**
 * 手动初始化价格历史
 * 从链上读取当前价格并创建历史记录
 */
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

const POOL_ADDRESS = 'TDoYGYAgPLrWTSjsANUuAjEFaAKr3oBo3v';
const CHIP_TOKEN = 'TFWScXGFALnK9D79zf5Jrnw5on7aqJiaY3';

async function initPriceHistory() {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker');
    console.log('✓ Connected to MongoDB');
    
    // 初始化 TronWeb
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io'
    });
    tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');
    
    // 获取合约
    const poolContract = await tronWeb.contract().at(POOL_ADDRESS);
    
    // 获取当前储备量
    const reserves = await poolContract.getReserves().call();
    const reserveTRX = parseInt(reserves[0].toString());
    const reserveCHIP = parseInt(reserves[1].toString());
    
    // 计算价格
    const price0 = reserveCHIP / reserveTRX; // 1 TRX = ? CHIP
    const price1 = reserveTRX / reserveCHIP; // 1 CHIP = ? TRX
    
    console.log(`\n当前状态:`);
    console.log(`  TRX Reserve: ${(reserveTRX / 1e6).toFixed(4)}`);
    console.log(`  CHIP Reserve: ${(reserveCHIP / 1e6).toFixed(4)}`);
    console.log(`  Price: ${price0.toFixed(4)} CHIP/TRX\n`);
    
    // 定义 PriceHistory 模型
    const priceHistorySchema = new mongoose.Schema({
        poolAddress: { type: String, required: true, lowercase: true },
        timestamp: { type: Number, required: true },
        interval: { type: String, default: '1m' },
        open: Number,
        high: Number,
        low: Number,
        close: Number,
        reserve0: String,
        reserve1: String,
        price0: Number,
        price1: Number,
        volumeTRX: { type: String, default: '0' },
        volumeCHIP: { type: String, default: '0' },
        txCount: { type: Number, default: 0 }
    });
    priceHistorySchema.index({ poolAddress: 1, timestamp: -1 });
    
    const PriceHistory = mongoose.models.PriceHistory || mongoose.model('PriceHistory', priceHistorySchema);
    
    // 创建过去 60 分钟的价格历史（模拟）
    const now = Math.floor(Date.now() / 1000);
    const oneMinuteAgo = Math.floor(now / 60) * 60;
    
    console.log('创建价格历史记录...\n');
    
    for (let i = 60; i >= 0; i--) {
        const timestamp = oneMinuteAgo - (i * 60);
        
        // 添加一些随机波动（模拟真实价格变化）
        const randomFactor = 1 + (Math.random() - 0.5) * 0.02; // ±1% 波动
        const simulatedPrice = price0 * randomFactor;
        
        const existing = await PriceHistory.findOne({
            poolAddress: POOL_ADDRESS.toLowerCase(),
            timestamp
        });
        
        if (!existing) {
            await PriceHistory.create({
                poolAddress: POOL_ADDRESS.toLowerCase(),
                timestamp,
                interval: '1m',
                open: simulatedPrice,
                high: simulatedPrice * 1.005,
                low: simulatedPrice * 0.995,
                close: simulatedPrice,
                reserve0: reserveTRX.toString(),
                reserve1: reserveCHIP.toString(),
                price0: simulatedPrice,
                price1: 1 / simulatedPrice,
                volumeTRX: (Math.random() * 10).toFixed(0),
                volumeCHIP: (Math.random() * 200).toFixed(0),
                txCount: Math.floor(Math.random() * 3)
            });
        }
    }
    
    console.log(`✓ 创建了 61 条价格历史记录`);
    
    // 验证
    const count = await PriceHistory.countDocuments({ poolAddress: POOL_ADDRESS.toLowerCase() });
    console.log(`✓ 数据库中共有 ${count} 条价格历史记录\n`);
    
    // 显示最近 5 条
    const recent = await PriceHistory.find({ poolAddress: POOL_ADDRESS.toLowerCase() })
        .sort({ timestamp: -1 })
        .limit(5);
    
    console.log('最近 5 条记录:');
    for (const h of recent) {
        console.log(`  ${new Date(h.timestamp * 1000).toLocaleTimeString()} - 价格: ${h.close?.toFixed(4)}`);
    }
    
    await mongoose.connection.close();
    console.log('\n✓ 完成！刷新 DEX 页面查看价格图表。');
}

initPriceHistory().catch(console.error);
