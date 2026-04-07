/**
 * AMMListener
 * AMM合约事件监听器
 */
const EventEmitter = require('events');

class AMMListener extends EventEmitter {
    constructor(tronWeb, poolAddress, liquidityService) {
        super();
        this.tronWeb = tronWeb;
        this.poolAddress = poolAddress;
        this.liquidityService = liquidityService;
        this.poolContract = null;
        
        // 事件监听状态
        this.isListening = false;
        this.lastBlockNumber = 0;
        this.pollInterval = null;
        
        // 重试配置
        this.maxRetries = 3;
        this.retryDelay = 5000;
    }

    /**
     * 初始化监听器
     */
    async initialize() {
        try {
            this.poolContract = await this.tronWeb.contract().at(this.poolAddress);
            
            // 获取当前区块号
            const currentBlock = await this.tronWeb.trx.getCurrentBlock();
            this.lastBlockNumber = currentBlock ? currentBlock.block_header.raw_data.number : 0;
            
            console.log(`[AMMListener] Initialized at block ${this.lastBlockNumber}`);
            return true;
        } catch (error) {
            console.error('[AMMListener] Initialize error:', error);
            throw error;
        }
    }

    /**
     * 开始监听事件
     */
    async startListening(pollIntervalMs = 3000) {
        if (this.isListening) {
            console.log('[AMMListener] Already listening');
            return;
        }
        
        this.isListening = true;
        
        // 使用轮询模式监听事件（TRON的event监听不太稳定）
        this.pollInterval = setInterval(async () => {
            try {
                await this.pollEvents();
            } catch (error) {
                console.error('[AMMListener] Poll events error:', error);
                this.emit('error', error);
            }
        }, pollIntervalMs);
        
        console.log(`[AMMListener] Started listening (${pollIntervalMs}ms interval)`);
    }

    /**
     * 停止监听
     */
    stopListening() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.isListening = false;
        console.log('[AMMListener] Stopped listening');
    }

    /**
     * 轮询事件
     */
    async pollEvents() {
        try {
            const currentBlock = await this.tronWeb.trx.getCurrentBlock();
            const currentBlockNumber = currentBlock ? currentBlock.block_header.raw_data.number : 0;
            
            if (currentBlockNumber <= this.lastBlockNumber) {
                return; // 没有新区块
            }
            
            // 查询新区块中的事件
            await this.querySwapEvents(this.lastBlockNumber + 1, currentBlockNumber);
            await this.queryMintEvents(this.lastBlockNumber + 1, currentBlockNumber);
            await this.queryBurnEvents(this.lastBlockNumber + 1, currentBlockNumber);
            
            this.lastBlockNumber = currentBlockNumber;
        } catch (error) {
            console.error('[AMMListener] Poll events error:', error);
            throw error;
        }
    }

    /**
     * 查询Swap事件
     */
    async querySwapEvents(fromBlock, toBlock) {
        try {
            // TRON事件查询
            const events = await this.tronWeb.event.getEventsByContractAddress(
                this.poolAddress,
                {
                    eventName: 'Swap',
                    blockNumber: fromBlock,
                    size: 100
                }
            ).catch(() => null);
            
            if (!events || !events.data) return;
            
            for (const event of events.data) {
                if (event.name !== 'Swap') continue;
                
                const txHash = event.transaction_id;
                const blockNumber = event.block_number;
                const blockTimestamp = event.block_timestamp || Date.now();
                
                const { sender, amount0In, amount1In, amount0Out, amount1Out, to } = event.result;
                
                // 记录事件
                const swapEvent = await this.liquidityService.recordSwapEvent({
                    txHash,
                    sender,
                    amount0In,
                    amount1In,
                    amount0Out,
                    amount1Out,
                    blockNumber,
                    blockTimestamp
                });
                
                // 发射事件
                this.emit('swap', swapEvent.toAPIJSON());
                
                console.log(`[AMMListener] Swap event: ${txHash}`);
            }
        } catch (error) {
            console.error('[AMMListener] Query swap events error:', error);
        }
    }

    /**
     * 查询Mint事件
     */
    async queryMintEvents(fromBlock, toBlock) {
        try {
            const events = await this.tronWeb.event.getEventsByContractAddress(
                this.poolAddress,
                {
                    eventName: 'Mint',
                    blockNumber: fromBlock,
                    size: 100
                }
            ).catch(() => null);
            
            if (!events || !events.data) return;
            
            for (const event of events.data) {
                if (event.name !== 'Mint') continue;
                
                const txHash = event.transaction_id;
                const blockNumber = event.block_number;
                const blockTimestamp = event.block_timestamp || Date.now();
                
                const { sender, amount0, amount1, liquidity } = event.result;
                
                // 记录事件
                const userLiquidity = await this.liquidityService.recordMintEvent({
                    sender,
                    amount0,
                    amount1,
                    liquidity,
                    txHash,
                    blockNumber,
                    blockTimestamp
                });
                
                // 发射事件
                this.emit('mint', {
                    txHash,
                    sender,
                    amount0,
                    amount1,
                    liquidity,
                    userLiquidity: userLiquidity?.toAPIJSON()
                });
                
                console.log(`[AMMListener] Mint event: ${txHash}`);
            }
        } catch (error) {
            console.error('[AMMListener] Query mint events error:', error);
        }
    }

    /**
     * 查询Burn事件
     */
    async queryBurnEvents(fromBlock, toBlock) {
        try {
            const events = await this.tronWeb.event.getEventsByContractAddress(
                this.poolAddress,
                {
                    eventName: 'Burn',
                    blockNumber: fromBlock,
                    size: 100
                }
            ).catch(() => null);
            
            if (!events || !events.data) return;
            
            for (const event of events.data) {
                if (event.name !== 'Burn') continue;
                
                const txHash = event.transaction_id;
                const blockNumber = event.block_number;
                const blockTimestamp = event.block_timestamp || Date.now();
                
                const { sender, amount0, amount1, liquidity } = event.result;
                
                // 记录事件
                const userLiquidity = await this.liquidityService.recordBurnEvent({
                    sender,
                    amount0,
                    amount1,
                    liquidity,
                    txHash,
                    blockNumber,
                    blockTimestamp
                });
                
                // 发射事件
                this.emit('burn', {
                    txHash,
                    sender,
                    amount0,
                    amount1,
                    liquidity,
                    userLiquidity: userLiquidity?.toAPIJSON()
                });
                
                console.log(`[AMMListener] Burn event: ${txHash}`);
            }
        } catch (error) {
            console.error('[AMMListener] Query burn events error:', error);
        }
    }

    /**
     * 回溯历史事件
     */
    async replayHistory(fromBlock, toBlock) {
        console.log(`[AMMListener] Replaying events from block ${fromBlock} to ${toBlock}`);
        
        await this.querySwapEvents(fromBlock, toBlock);
        await this.queryMintEvents(fromBlock, toBlock);
        await this.queryBurnEvents(fromBlock, toBlock);
        
        console.log('[AMMListener] Replay complete');
    }

    /**
     * 关闭监听器
     */
    async close() {
        this.stopListening();
        console.log('[AMMListener] Listener closed');
    }
}

module.exports = AMMListener;
