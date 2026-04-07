/**
 * SwapEvent Model
 * 交易记录
 */
const mongoose = require('mongoose');

const swapEventSchema = new mongoose.Schema({
    txHash: {
        type: String,
        required: true,
        unique: true
    },
    poolAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    sender: {
        type: String,
        required: true,
        lowercase: true
    },
    // 输入
    amount0In: {
        type: String,  // 输入TRX
        default: '0'
    },
    amount1In: {
        type: String,  // 输入CHIP
        default: '0'
    },
    // 输出
    amount0Out: {
        type: String,  // 输出TRX
        default: '0'
    },
    amount1Out: {
        type: String,  // 输出CHIP
        default: '0'
    },
    // 价格影响
    priceImpact: {
        type: Number,
        default: 0
    },
    // 交易类型
    swapType: {
        type: String,
        enum: ['TRX_TO_CHIP', 'CHIP_TO_TRX', 'UNKNOWN'],
        default: 'UNKNOWN'
    },
    // 执行价格
    executionPrice: {
        type: Number,
        default: 0
    },
    blockNumber: {
        type: Number,
        required: true
    },
    blockTimestamp: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

// 索引
swapEventSchema.index({ txHash: 1 }, { unique: true });
swapEventSchema.index({ poolAddress: 1, blockTimestamp: -1 });
swapEventSchema.index({ sender: 1, blockTimestamp: -1 });
swapEventSchema.index({ blockTimestamp: -1 });

// 确定交易类型
swapEventSchema.methods.determineSwapType = function() {
    const amount0In = BigInt(this.amount0In || '0');
    const amount1In = BigInt(this.amount1In || '0');
    const amount0Out = BigInt(this.amount0Out || '0');
    const amount1Out = BigInt(this.amount1Out || '0');
    
    if (amount0In > 0n && amount1Out > 0n) {
        this.swapType = 'TRX_TO_CHIP';
        // 计算执行价格 (获得CHIP / 支付TRX)
        this.executionPrice = Number(amount1Out * 1000000n / amount0In) / 1000000;
    } else if (amount1In > 0n && amount0Out > 0n) {
        this.swapType = 'CHIP_TO_TRX';
        // 计算执行价格 (获得TRX / 支付CHIP)
        this.executionPrice = Number(amount0Out * 1000000n / amount1In) / 1000000;
    } else {
        this.swapType = 'UNKNOWN';
    }
};

// 获取格式化数据
swapEventSchema.methods.toAPIJSON = function() {
    return {
        txHash: this.txHash,
        poolAddress: this.poolAddress,
        sender: this.sender,
        type: this.swapType,
        input: {
            trx: this.amount0In,
            chip: this.amount1In
        },
        output: {
            trx: this.amount0Out,
            chip: this.amount1Out
        },
        priceImpact: this.priceImpact,
        executionPrice: this.executionPrice,
        blockNumber: this.blockNumber,
        timestamp: this.blockTimestamp,
        createdAt: this.createdAt
    };
};

const SwapEvent = mongoose.model('SwapEvent', swapEventSchema);

module.exports = SwapEvent;
