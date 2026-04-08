/**
 * LiquidityService
 * 流动性池数据服务
 */
const mongoose = require('mongoose');
const PoolState = require('../models/PoolState');
const SwapEvent = require('../models/SwapEvent');
const UserLiquidity = require('../models/UserLiquidity');
const PriceHistory = require('../models/PriceHistory');

class LiquidityService {
    constructor(tronWeb, poolAddress, tokenAddress) {
        this.tronWeb = tronWeb;
        this.poolAddress = poolAddress;
        this.tokenAddress = tokenAddress;
        this.poolContract = null;
        this.tokenContract = null;
        this.syncInterval = null;
    }

    /**
     * 初始化服务
     */
    async initialize() {
        try {
            // 加载合约
            this.poolContract = await this.tronWeb.contract().at(this.poolAddress);
            this.tokenContract = await this.tronWeb.contract().at(this.tokenAddress);
            
            console.log('[LiquidityService] Initialized successfully');
            
            // 初始同步
            await this.syncPoolState();
            
            // 启动定时同步（30秒）
            this.startPeriodicSync(30000);
            
            return true;
        } catch (error) {
            console.error('[LiquidityService] Initialize error:', error);
            throw error;
        }
    }

    /**
     * 启动定时同步
     */
    startPeriodicSync(intervalMs = 30000) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(async () => {
            try {
                await this.syncPoolState();
            } catch (error) {
                console.error('[LiquidityService] Periodic sync error:', error);
            }
        }, intervalMs);
        
        console.log(`[LiquidityService] Started periodic sync (${intervalMs}ms)`);
    }

    /**
     * 停止定时同步
     */
    stopPeriodicSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * 同步流动性池状态
     */
    async syncPoolState() {
        try {
            // 获取链上储备量
            const reserves = await this.poolContract.getReserves().call();
            const totalSupply = await this.poolContract.totalSupply().call();
            
            const reserveTRX = reserves[0].toString();
            const reserveCHIP = reserves[1].toString();
            const blockTimestamp = Number(reserves[2]);
            
            // 获取价格累积
            const price0Cumulative = await this.poolContract.price0CumulativeLast().call();
            const price1Cumulative = await this.poolContract.price1CumulativeLast().call();
            
            // 获取当前区块号
            const blockNumber = await this.tronWeb.trx.getCurrentBlock();
            const currentBlockNumber = blockNumber ? blockNumber.block_header.raw_data.number : 0;
            
            // 更新或创建PoolState
            const poolState = await PoolState.findOneAndUpdate(
                { poolAddress: this.poolAddress },
                {
                    $set: {
                        token0: 'TRX',
                        token1: this.tokenAddress,
                        reserve0: reserveTRX,
                        reserve1: reserveCHIP,
                        totalSupply: totalSupply.toString(),
                        blockNumber: currentBlockNumber,
                        blockTimestamp: blockTimestamp,
                        price0CumulativeLast: price0Cumulative.toString(),
                        price1CumulativeLast: price1Cumulative.toString()
                    }
                },
                { upsert: true, new: true }
            );
            
            // 计算价格
            poolState.calculatePrices();
            await poolState.save();
            
            // 记录价格历史（按分钟聚合）
            await this.recordPriceHistory(poolState);
            
            console.log(`[LiquidityService] Synced pool state: reserveTRX=${reserveTRX}, reserveCHIP=${reserveCHIP}`);
            
            return poolState;
        } catch (error) {
            console.error('[LiquidityService] Sync pool state error:', error);
            throw error;
        }
    }

    /**
     * 获取池状态
     */
    async getPoolState() {
        const poolState = await PoolState.findOne({ poolAddress: this.poolAddress });
        return poolState;
    }

    /**
     * 获取用户流动性
     */
    async getUserLiquidity(userAddress) {
        try {
            // 获取链上LP余额
            const lpBalance = await this.poolContract.balanceOf(userAddress).call();
            const totalSupply = await this.poolContract.totalSupply().call();
            
            let userLiquidity = await UserLiquidity.findOne({
                userAddress: userAddress.toLowerCase(),
                poolAddress: this.poolAddress
            });
            
            if (!userLiquidity) {
                userLiquidity = new UserLiquidity({
                    userAddress: userAddress.toLowerCase(),
                    poolAddress: this.poolAddress,
                    lpBalance: lpBalance.toString()
                });
            } else {
                userLiquidity.lpBalance = lpBalance.toString();
            }
            
            // 更新占比
            userLiquidity.updateShare(totalSupply.toString());
            await userLiquidity.save();
            
            // 计算当前价值
            const poolState = await this.getPoolState();
            if (poolState) {
                const currentValue = userLiquidity.calculateCurrentValue(
                    poolState.reserve0,
                    poolState.reserve1,
                    poolState.totalSupply
                );
                
                return {
                    ...userLiquidity.toAPIJSON(),
                    currentValue
                };
            }
            
            return userLiquidity.toAPIJSON();
        } catch (error) {
            console.error('[LiquidityService] Get user liquidity error:', error);
            throw error;
        }
    }

    /**
     * 记录Swap事件
     */
    async recordSwapEvent(eventData) {
        try {
            const { txHash, sender, amount0In, amount1In, amount0Out, amount1Out, blockNumber, blockTimestamp } = eventData;
            
            let swapEvent = await SwapEvent.findOne({ txHash });
            if (swapEvent) {
                return swapEvent; // 已存在
            }
            
            swapEvent = new SwapEvent({
                txHash,
                poolAddress: this.poolAddress,
                sender: sender.toLowerCase(),
                amount0In: amount0In?.toString() || '0',
                amount1In: amount1In?.toString() || '0',
                amount0Out: amount0Out?.toString() || '0',
                amount1Out: amount1Out?.toString() || '0',
                blockNumber,
                blockTimestamp
            });
            
            // 确定交易类型
            swapEvent.determineSwapType();
            
            // 计算价格影响（需要池状态）
            const poolState = await this.getPoolState();
            if (poolState) {
                const reserveTRX = BigInt(poolState.reserve0);
                const reserveCHIP = BigInt(poolState.reserve1);
                
                let amountIn, reserveIn;
                if (swapEvent.swapType === 'TRX_TO_CHIP') {
                    amountIn = BigInt(swapEvent.amount0In);
                    reserveIn = reserveTRX;
                } else if (swapEvent.swapType === 'CHIP_TO_TRX') {
                    amountIn = BigInt(swapEvent.amount1In);
                    reserveIn = reserveCHIP;
                }
                
                if (amountIn && reserveIn > 0n) {
                    swapEvent.priceImpact = Number(amountIn * 10000n / (reserveIn + amountIn)) / 10000 * 100;
                }
            }
            
            await swapEvent.save();
            
            // 更新价格历史
            await this.updatePriceHistory(swapEvent);
            
            console.log(`[LiquidityService] Recorded swap: ${txHash}`);
            return swapEvent;
        } catch (error) {
            console.error('[LiquidityService] Record swap error:', error);
            throw error;
        }
    }

    /**
     * 记录价格历史（定时同步时调用）
     */
    async recordPriceHistory(poolState) {
        try {
            const timestamp = Math.floor(Date.now() / 1000 / 60) * 60; // 按分钟聚合
            const price = poolState.price0;
            
            let priceHistory = await PriceHistory.findOne({
                poolAddress: this.poolAddress,
                timestamp,
                interval: '1m'
            });
            
            if (!priceHistory) {
                // 创建新记录
                priceHistory = new PriceHistory({
                    poolAddress: this.poolAddress,
                    timestamp,
                    interval: '1m',
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    reserve0: poolState.reserve0,
                    reserve1: poolState.reserve1,
                    price0: poolState.price0,
                    price1: poolState.price1,
                    volumeTRX: '0',
                    volumeCHIP: '0',
                    txCount: 0
                });
                console.log(`[LiquidityService] Created new price history at ${new Date(timestamp * 1000).toLocaleTimeString()}`);
            } else {
                // 更新K线（只更新 high/low/close，保留 open）
                priceHistory.high = Math.max(priceHistory.high, price);
                priceHistory.low = Math.min(priceHistory.low, price);
                priceHistory.close = price;
                priceHistory.reserve0 = poolState.reserve0;
                priceHistory.reserve1 = poolState.reserve1;
                priceHistory.price0 = poolState.price0;
                priceHistory.price1 = poolState.price1;
            }
            
            await priceHistory.save();
            return priceHistory;
        } catch (error) {
            console.error('[LiquidityService] Record price history error:', error);
        }
    }

    /**
     * 记录Mint事件（添加流动性）
     */
    async recordMintEvent(eventData) {
        try {
            const { sender, amount0, amount1, liquidity, txHash, blockNumber, blockTimestamp } = eventData;
            
            let userLiquidity = await UserLiquidity.findOne({
                userAddress: sender.toLowerCase(),
                poolAddress: this.poolAddress
            });
            
            if (!userLiquidity) {
                userLiquidity = new UserLiquidity({
                    userAddress: sender.toLowerCase(),
                    poolAddress: this.poolAddress,
                    lpBalance: '0',
                    depositedTRX: '0',
                    depositedCHIP: '0',
                    firstDepositAt: new Date()
                });
            }
            
            // 更新数据
            const currentLP = BigInt(userLiquidity.lpBalance || '0');
            const currentDepositedTRX = BigInt(userLiquidity.depositedTRX || '0');
            const currentDepositedCHIP = BigInt(userLiquidity.depositedCHIP || '0');
            
            userLiquidity.lpBalance = (currentLP + BigInt(liquidity)).toString();
            userLiquidity.depositedTRX = (currentDepositedTRX + BigInt(amount0)).toString();
            userLiquidity.depositedCHIP = (currentDepositedCHIP + BigInt(amount1)).toString();
            userLiquidity.lastUpdateAt = new Date();
            
            // 更新占比
            const totalSupply = await this.poolContract.totalSupply().call();
            userLiquidity.updateShare(totalSupply.toString());
            
            await userLiquidity.save();
            
            console.log(`[LiquidityService] Recorded mint: ${txHash}`);
            return userLiquidity;
        } catch (error) {
            console.error('[LiquidityService] Record mint error:', error);
            throw error;
        }
    }

    /**
     * 记录Burn事件（移除流动性）
     */
    async recordBurnEvent(eventData) {
        try {
            const { sender, amount0, amount1, liquidity, txHash, blockNumber, blockTimestamp } = eventData;
            
            let userLiquidity = await UserLiquidity.findOne({
                userAddress: sender.toLowerCase(),
                poolAddress: this.poolAddress
            });
            
            if (!userLiquidity) {
                return null;
            }
            
            // 更新数据
            const currentLP = BigInt(userLiquidity.lpBalance || '0');
            const currentWithdrawnTRX = BigInt(userLiquidity.withdrawnTRX || '0');
            const currentWithdrawnCHIP = BigInt(userLiquidity.withdrawnCHIP || '0');
            
            userLiquidity.lpBalance = (currentLP - BigInt(liquidity)).toString();
            userLiquidity.withdrawnTRX = (currentWithdrawnTRX + BigInt(amount0)).toString();
            userLiquidity.withdrawnCHIP = (currentWithdrawnCHIP + BigInt(amount1)).toString();
            userLiquidity.lastUpdateAt = new Date();
            
            // 更新占比
            const totalSupply = await this.poolContract.totalSupply().call();
            userLiquidity.updateShare(totalSupply.toString());
            
            await userLiquidity.save();
            
            console.log(`[LiquidityService] Recorded burn: ${txHash}`);
            return userLiquidity;
        } catch (error) {
            console.error('[LiquidityService] Record burn error:', error);
            throw error;
        }
    }

    /**
     * 更新价格历史
     */
    async updatePriceHistory(swapEvent) {
        try {
            const poolState = await this.getPoolState();
            if (!poolState) return;
            
            const timestamp = Math.floor(swapEvent.blockTimestamp / 60) * 60; // 按分钟聚合
            
            let priceHistory = await PriceHistory.findOne({
                poolAddress: this.poolAddress,
                timestamp,
                interval: '1m'
            });
            
            const price = poolState.price0;
            
            if (!priceHistory) {
                priceHistory = new PriceHistory({
                    poolAddress: this.poolAddress,
                    timestamp,
                    interval: '1m',
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    reserve0: poolState.reserve0,
                    reserve1: poolState.reserve1,
                    price0: poolState.price0,
                    price1: poolState.price1,
                    volumeTRX: swapEvent.amount0In,
                    volumeCHIP: swapEvent.amount1In,
                    txCount: 1
                });
            } else {
                // 更新K线
                priceHistory.high = Math.max(priceHistory.high, price);
                priceHistory.low = Math.min(priceHistory.low, price);
                priceHistory.close = price;
                priceHistory.reserve0 = poolState.reserve0;
                priceHistory.reserve1 = poolState.reserve1;
                
                // 累加成交量
                const volumeTRX = BigInt(priceHistory.volumeTRX || '0') + BigInt(swapEvent.amount0In || '0');
                const volumeCHIP = BigInt(priceHistory.volumeCHIP || '0') + BigInt(swapEvent.amount1In || '0');
                priceHistory.volumeTRX = volumeTRX.toString();
                priceHistory.volumeCHIP = volumeCHIP.toString();
                priceHistory.txCount += 1;
            }
            
            await priceHistory.save();
            return priceHistory;
        } catch (error) {
            console.error('[LiquidityService] Update price history error:', error);
        }
    }

    /**
     * 获取交易历史
     */
    async getSwapHistory(options = {}) {
        const { userAddress, limit = 50, offset = 0 } = options;
        
        const query = { poolAddress: this.poolAddress };
        if (userAddress) {
            query.sender = userAddress.toLowerCase();
        }
        
        const events = await SwapEvent.find(query)
            .sort({ blockTimestamp: -1 })
            .skip(offset)
            .limit(limit);
        
        return events.map(e => e.toAPIJSON());
    }

    /**
     * 获取价格历史
     */
    async getPriceHistory(interval = '1m', from = null, to = null) {
        const query = {
            poolAddress: this.poolAddress,
            interval
        };
        
        if (from) query.timestamp = { ...query.timestamp, $gte: from };
        if (to) query.timestamp = { ...query.timestamp, $lte: to };
        
        const history = await PriceHistory.find(query)
            .sort({ timestamp: 1 })
            .limit(1000);
        
        return history.map(h => h.toChartData());
    }

    /**
     * 关闭服务
     */
    async close() {
        this.stopPeriodicSync();
        console.log('[LiquidityService] Service closed');
    }
}

module.exports = LiquidityService;
