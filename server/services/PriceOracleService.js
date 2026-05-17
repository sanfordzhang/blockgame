/**
 * PriceOracleService
 * 价格预言机服务
 */
const PoolState = require('../models/PoolState');

class PriceOracleService {
    constructor(tronWeb, poolAddress, tokenAddress) {
        this.tronWeb = tronWeb;
        this.poolAddress = poolAddress;
        this.tokenAddress = tokenAddress;
        this.poolContract = null;
        
        // 价格缓存
        this.priceCache = {
            price0: 0,
            price1: 0,
            reserve0: '0',
            reserve1: '0',
            timestamp: 0,
            ttl: 5000 // 5秒缓存
        };
    }

    /**
     * 初始化服务
     */
    async initialize() {
        try {
            this.poolContract = await this.tronWeb.contract().at(this.poolAddress);
            console.log('[PriceOracleService] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[PriceOracleService] Initialize error:', error);
            throw error;
        }
    }

    /**
     * 获取即时价格
     */
    async getCurrentPrice() {
        // 检查缓存
        if (Date.now() - this.priceCache.timestamp < this.priceCache.ttl) {
            return {
                priceTRXToCHIP: this.priceCache.price0,
                priceCHIPToTRX: this.priceCache.price1,
                reserveTRX: this.priceCache.reserve0,
                reserveCHIP: this.priceCache.reserve1,
                cached: true
            };
        }
        
        try {
            const reserves = await this.poolContract.getReserves().call();
            const reserveTRX = BigInt(reserves[0].toString());
            const reserveCHIP = BigInt(reserves[1].toString());
            
            if (reserveTRX === 0n || reserveCHIP === 0n) {
                return {
                    priceTRXToCHIP: 0,
                    priceCHIPToTRX: 0,
                    reserveTRX: '0',
                    reserveCHIP: '0',
                    cached: false
                };
            }
            
            // 计算价格
            const priceTRXToCHIP = Number(reserveCHIP * 1000000n / reserveTRX) / 1000000;
            const priceCHIPToTRX = Number(reserveTRX * 1000000n / reserveCHIP) / 1000000;
            
            // 更新缓存
            this.priceCache = {
                price0: priceTRXToCHIP,
                price1: priceCHIPToTRX,
                reserve0: reserveTRX.toString(),
                reserve1: reserveCHIP.toString(),
                timestamp: Date.now(),
                ttl: 5000
            };
            
            return {
                priceTRXToCHIP,
                priceCHIPToTRX,
                reserveTRX: reserveTRX.toString(),
                reserveCHIP: reserveCHIP.toString(),
                cached: false
            };
        } catch (error) {
            console.error('[PriceOracleService] Get current price error:', error);
            throw error;
        }
    }

    /**
     * 计算交易输出
     */
    async getAmountOut(amountIn, isTRXToCHIP) {
        try {
            let amountOut;
            
            if (isTRXToCHIP) {
                amountOut = await this.poolContract.getAmountOutTRXToCHIP(amountIn).call();
            } else {
                amountOut = await this.poolContract.getAmountOutCHIPToTRX(amountIn).call();
            }
            
            return amountOut.toString();
        } catch (error) {
            console.error('[PriceOracleService] Get amount out error:', error);
            throw error;
        }
    }

    /**
     * 计算滑点
     */
    async calculateSlippage(amountIn, isTRXToCHIP) {
        try {
            const { reserveTRX, reserveCHIP } = await this.getCurrentPrice();
            
            const reserveIn = BigInt(isTRXToCHIP ? reserveTRX : reserveCHIP);
            const amountInBN = BigInt(amountIn);
            
            if (reserveIn === 0n) return 0;
            
            // 价格影响 = amountIn / (reserveIn + amountIn)
            const priceImpact = Number(amountInBN * 10000n / (reserveIn + amountInBN)) / 10000;
            
            return priceImpact;
        } catch (error) {
            console.error('[PriceOracleService] Calculate slippage error:', error);
            return 0;
        }
    }

    /**
     * 计算TWAP（时间加权平均价格）
     */
    async calculateTWAP(durationSeconds = 3600) {
        try {
            const poolState = await PoolState.findOne({ poolAddress: this.poolAddress });
            if (!poolState) return null;
            
            const price0CumulativeLast = BigInt(poolState.price0CumulativeLast || '0');
            const price1CumulativeLast = BigInt(poolState.price1CumulativeLast || '0');
            const blockTimestampLast = poolState.blockTimestamp || 0;
            
            // 获取当前累积价格
            const currentPrice0Cumulative = await this.poolContract.price0CumulativeLast().call();
            const currentPrice1Cumulative = await this.poolContract.price1CumulativeLast().call();
            const currentTimestamp = Math.floor(Date.now() / 1000);
            
            // 计算时间差
            const timeElapsed = currentTimestamp - blockTimestampLast;
            if (timeElapsed < durationSeconds) {
                return null; // 时间不够
            }
            
            // 计算TWAP
            const price0Diff = BigInt(currentPrice0Cumulative.toString()) - price0CumulativeLast;
            const price1Diff = BigInt(currentPrice1Cumulative.toString()) - price1CumulativeLast;
            
            const twap0 = Number(price0Diff / BigInt(timeElapsed)) / 1e18;
            const twap1 = Number(price1Diff / BigInt(timeElapsed)) / 1e18;
            
            return {
                twapTRXToCHIP: twap0,
                twapCHIPToTRX: twap1,
                duration: durationSeconds
            };
        } catch (error) {
            console.error('[PriceOracleService] Calculate TWAP error:', error);
            return null;
        }
    }

    /**
     * 预估交易输出（本地计算）
     */
    estimateAmountOut(amountIn, isTRXToCHIP) {
        const { reserve0, reserve1 } = this.priceCache;

        const reserveIn = BigInt(isTRXToCHIP ? reserve0 : reserve1);
        const reserveOut = BigInt(isTRXToCHIP ? reserve1 : reserve0);
        const amountInBN = BigInt(amountIn);
        
        if (reserveIn === 0n || reserveOut === 0n) return '0';
        
        // 公式: amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
        const numerator = amountInBN * 997n * reserveOut;
        const denominator = reserveIn * 1000n + amountInBN * 997n;
        
        return (numerator / denominator).toString();
    }

    /**
     * 计算无偿损失
     */
    calculateImpermanentLoss(
        depositedTRX,
        depositedCHIP,
        currentReserveTRX,
        currentReserveCHIP,
        currentTotalSupply,
        lpBalance
    ) {
        try {
            // 当前价值
            const lpBalanceBN = BigInt(lpBalance || '0');
            const totalSupplyBN = BigInt(currentTotalSupply || '1');
            const reserveTRXBN = BigInt(currentReserveTRX || '0');
            const reserveCHIPBN = BigInt(currentReserveCHIP || '0');
            
            if (totalSupplyBN === 0n) return { impermanentLoss: 0, currentValue: { trx: '0', chip: '0' } };
            
            const currentTRX = lpBalanceBN * reserveTRXBN / totalSupplyBN;
            const currentCHIP = lpBalanceBN * reserveCHIPBN / totalSupplyBN;
            
            // 假设持有价值（如果不提供流动性）
            const depositedTRXBN = BigInt(depositedTRX || '0');
            const depositedCHIPBN = BigInt(depositedCHIP || '0');
            
            // 计算价值变化
            const holdValueTRX = depositedTRXBN;
            const holdValueCHIP = depositedCHIPBN;
            
            // 无偿损失 = (当前价值 / 持有价值) - 1
            // 简化计算：比较TRX和CHIP的比例变化
            
            const currentRatio = Number(currentTRX) / Number(currentCHIP || 1n);
            const depositedRatio = Number(depositedTRXBN) / Number(depositedCHIPBN || 1n);
            
            const ratioChange = Math.abs(currentRatio - depositedRatio) / (depositedRatio || 1);
            
            // 无偿损失估算（简化版）
            const impermanentLoss = ratioChange * 0.5; // 近似值
            
            return {
                impermanentLoss,
                currentValue: {
                    trx: currentTRX.toString(),
                    chip: currentCHIP.toString()
                },
                holdValue: {
                    trx: holdValueTRX.toString(),
                    chip: holdValueCHIP.toString()
                },
                pnl: {
                    trx: (currentTRX - holdValueTRX).toString(),
                    chip: (currentCHIP - holdValueCHIP).toString()
                }
            };
        } catch (error) {
            console.error('[PriceOracleService] Calculate impermanent loss error:', error);
            return { impermanentLoss: 0, currentValue: { trx: '0', chip: '0' } };
        }
    }

    /**
     * 获取价格影响警告级别
     */
    getPriceImpactLevel(priceImpact) {
        if (priceImpact < 0.01) return 'low';       // < 1%
        if (priceImpact < 0.03) return 'medium';    // < 3%
        if (priceImpact < 0.05) return 'high';      // < 5%
        return 'very_high';                         // >= 5%
    }

    /**
     * 生成交易报价
     */
    async getQuote(amountIn, isTRXToCHIP) {
        try {
            const amountOut = await this.getAmountOut(amountIn, isTRXToCHIP);
            const priceImpact = await this.calculateSlippage(amountIn, isTRXToCHIP);
            const { priceTRXToCHIP, priceCHIPToTRX } = await this.getCurrentPrice();
            
            // 执行价格
            const amountInBN = BigInt(amountIn);
            const amountOutBN = BigInt(amountOut);
            const executionPrice = amountInBN > 0n 
                ? Number(amountOutBN * 1000000n / amountInBN) / 1000000 
                : 0;
            
            // 最小输出（默认1%滑点保护）
            const minimumOut = (amountOutBN * 99n / 100n).toString();
            
            return {
                amountIn,
                amountOut,
                executionPrice,
                priceImpact: priceImpact * 100, // 转为百分比
                priceImpactLevel: this.getPriceImpactLevel(priceImpact),
                minimumOut,
                route: isTRXToCHIP ? 'TRX -> CHIP' : 'CHIP -> TRX',
                marketPrice: isTRXToCHIP ? priceTRXToCHIP : priceCHIPToTRX
            };
        } catch (error) {
            console.error('[PriceOracleService] Get quote error:', error);
            throw error;
        }
    }
}

module.exports = PriceOracleService;
