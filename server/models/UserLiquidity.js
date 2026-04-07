/**
 * UserLiquidity Model
 * 用户流动性记录
 */
const mongoose = require('mongoose');

const userLiquiditySchema = new mongoose.Schema({
    userAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    poolAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    // LP代币余额
    lpBalance: {
        type: String,
        default: '0'
    },
    // 占比（百分比 * 10000）
    share: {
        type: Number,
        default: 0
    },
    // 累计存入
    depositedTRX: {
        type: String,
        default: '0'
    },
    depositedCHIP: {
        type: String,
        default: '0'
    },
    // 累计取回
    withdrawnTRX: {
        type: String,
        default: '0'
    },
    withdrawnCHIP: {
        type: String,
        default: '0'
    },
    // 累计手续费收益
    earnedTRX: {
        type: String,
        default: '0'
    },
    earnedCHIP: {
        type: String,
        default: '0'
    },
    // 首次添加流动性时间
    firstDepositAt: {
        type: Date
    },
    // 最后更新时间
    lastUpdateAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// 联合索引
userLiquiditySchema.index({ userAddress: 1, poolAddress: 1 }, { unique: true });
userLiquiditySchema.index({ userAddress: 1 });

// 更新占比
userLiquiditySchema.methods.updateShare = function(totalSupply) {
    const lpBalanceBN = BigInt(this.lpBalance || '0');
    const totalSupplyBN = BigInt(totalSupply || '1');
    
    if (totalSupplyBN > 0n) {
        // 占比 = (lpBalance / totalSupply) * 100 * 10000
        this.share = Number(lpBalanceBN * 1000000n / totalSupplyBN) / 10000;
    } else {
        this.share = 0;
    }
};

// 计算当前价值
userLiquiditySchema.methods.calculateCurrentValue = function(reserveTRX, reserveCHIP, totalSupply) {
    const lpBalanceBN = BigInt(this.lpBalance || '0');
    const totalSupplyBN = BigInt(totalSupply || '1');
    const reserveTRXBN = BigInt(reserveTRX || '0');
    const reserveCHIPBN = BigInt(reserveCHIP || '0');
    
    if (totalSupplyBN > 0n) {
        const valueTRX = lpBalanceBN * reserveTRXBN / totalSupplyBN;
        const valueCHIP = lpBalanceBN * reserveCHIPBN / totalSupplyBN;
        
        return {
            trx: valueTRX.toString(),
            chip: valueCHIP.toString()
        };
    }
    
    return { trx: '0', chip: '0' };
};

// 计算无偿损失
userLiquiditySchema.methods.calculateImpermanentLoss = function(
    currentReserveTRX,
    currentReserveCHIP,
    currentTotalSupply,
    initialPrice
) {
    const currentValue = this.calculateCurrentValue(
        currentReserveTRX,
        currentReserveCHIP,
        currentTotalSupply
    );
    
    // 假设用户持有时价值
    const depositedTRXBN = BigInt(this.depositedTRX || '0');
    const depositedCHIPBN = BigInt(this.depositedCHIP || '0');
    
    // 简化计算：当前价值 vs 存入价值
    // 实际无偿损失需要更复杂的计算
    
    return {
        currentValue,
        depositedValue: {
            trx: this.depositedTRX,
            chip: this.depositedCHIP
        },
        pnl: {
            trx: (BigInt(currentValue.trx) - depositedTRXBN).toString(),
            chip: (BigInt(currentValue.chip) - depositedCHIPBN).toString()
        }
    };
};

// 获取格式化数据
userLiquiditySchema.methods.toAPIJSON = function() {
    return {
        userAddress: this.userAddress,
        poolAddress: this.poolAddress,
        lpBalance: this.lpBalance,
        share: this.share,
        deposited: {
            trx: this.depositedTRX,
            chip: this.depositedCHIP
        },
        withdrawn: {
            trx: this.withdrawnTRX,
            chip: this.withdrawnCHIP
        },
        earned: {
            trx: this.earnedTRX,
            chip: this.earnedCHIP
        },
        firstDepositAt: this.firstDepositAt,
        lastUpdateAt: this.lastUpdateAt
    };
};

const UserLiquidity = mongoose.model('UserLiquidity', userLiquiditySchema);

module.exports = UserLiquidity;
