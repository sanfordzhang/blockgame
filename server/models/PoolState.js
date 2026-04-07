/**
 * PoolState Model
 * 流动性池状态缓存
 */
const mongoose = require('mongoose');

const poolStateSchema = new mongoose.Schema({
    poolAddress: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    token0: {
        type: String,
        required: true,
        default: 'TRX'  // TRX用特殊标记
    },
    token1: {
        type: String,
        required: true,
        lowercase: true
    },
    reserve0: {
        type: String,  // TRX储备量（wei），用String避免精度问题
        required: true,
        default: '0'
    },
    reserve1: {
        type: String,  // CHIP储备量（microCHIP）
        required: true,
        default: '0'
    },
    totalSupply: {
        type: String,  // LP代币总量
        required: true,
        default: '0'
    },
    price0: {
        type: Number,  // 1 TRX = ? CHIP
        default: 0
    },
    price1: {
        type: Number,  // 1 CHIP = ? TRX
        default: 0
    },
    blockNumber: {
        type: Number,
        default: 0
    },
    blockTimestamp: {
        type: Number,
        default: 0
    },
    kValue: {
        type: String,  // K值 = reserve0 * reserve1
        default: '0'
    },
    price0CumulativeLast: {
        type: String,
        default: '0'
    },
    price1CumulativeLast: {
        type: String,
        default: '0'
    }
}, {
    timestamps: true
});

// 索引
poolStateSchema.index({ poolAddress: 1 }, { unique: true });
poolStateSchema.index({ updatedAt: -1 });

// 计算价格
poolStateSchema.methods.calculatePrices = function() {
    const reserve0BN = BigInt(this.reserve0);
    const reserve1BN = BigInt(this.reserve1);
    
    if (reserve0BN > 0n && reserve1BN > 0n) {
        // 1 TRX = ? CHIP (保留6位小数)
        this.price0 = Number(reserve1BN * 1000000n / reserve0BN) / 1000000;
        // 1 CHIP = ? TRX (保留6位小数)
        this.price1 = Number(reserve0BN * 1000000n / reserve1BN) / 1000000;
        // K值
        this.kValue = (reserve0BN * reserve1BN).toString();
    }
};

// 获取格式化数据
poolStateSchema.methods.toAPIJSON = function() {
    return {
        poolAddress: this.poolAddress,
        token0: this.token0,
        token1: this.token1,
        reserves: {
            trx: this.reserve0,
            chip: this.reserve1
        },
        totalSupply: this.totalSupply,
        price: {
            trxToChip: this.price0,
            chipToTrx: this.price1
        },
        kValue: this.kValue,
        blockNumber: this.blockNumber,
        updatedAt: this.updatedAt
    };
};

const PoolState = mongoose.model('PoolState', poolStateSchema);

module.exports = PoolState;
