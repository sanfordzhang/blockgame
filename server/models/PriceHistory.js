/**
 * PriceHistory Model
 * 价格历史记录
 */
const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    poolAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    // 时间戳（秒）
    timestamp: {
        type: Number,
        required: true
    },
    // 价格
    price0: {
        type: Number,  // 1 TRX = ? CHIP
        required: true
    },
    price1: {
        type: Number,  // 1 CHIP = ? TRX
        required: true
    },
    // 储备量
    reserve0: {
        type: String,
        required: true
    },
    reserve1: {
        type: String,
        required: true
    },
    // 时间周期（用于K线）
    interval: {
        type: String,
        enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
        default: '1m'
    },
    // K线数据
    open: {
        type: Number,
        required: true
    },
    high: {
        type: Number,
        required: true
    },
    low: {
        type: Number,
        required: true
    },
    close: {
        type: Number,
        required: true
    },
    // 成交量
    volumeTRX: {
        type: String,
        default: '0'
    },
    volumeCHIP: {
        type: String,
        default: '0'
    },
    // 交易次数
    txCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// 索引
priceHistorySchema.index({ poolAddress: 1, timestamp: -1 });
priceHistorySchema.index({ poolAddress: 1, interval: 1, timestamp: -1 });

// 获取格式化数据
priceHistorySchema.methods.toAPIJSON = function() {
    return {
        timestamp: this.timestamp,
        price: {
            trxToChip: this.price0,
            chipToTrx: this.price1
        },
        reserves: {
            trx: this.reserve0,
            chip: this.reserve1
        },
        ohlc: {
            open: this.open,
            high: this.high,
            low: this.low,
            close: this.close
        },
        volume: {
            trx: this.volumeTRX,
            chip: this.volumeCHIP
        },
        txCount: this.txCount
    };
};

// 转换为图表数据格式
priceHistorySchema.methods.toChartData = function() {
    return {
        time: this.timestamp,
        open: this.open,
        high: this.high,
        low: this.low,
        close: this.close,
        volume: Number(this.volumeTRX)
    };
};

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

module.exports = PriceHistory;
