/**
 * AMM API Routes
 * AMM流动性池API端点
 */
const express = require('express');
const router = express.Router();
const PoolState = require('../../models/PoolState');
const SwapEvent = require('../../models/SwapEvent');
const UserLiquidity = require('../../models/UserLiquidity');
const PriceHistory = require('../../models/PriceHistory');

// 服务实例（在server.js中注入）
let liquidityService = null;
let priceOracleService = null;
let tronWeb = null;
let poolAddress = null;
let routerAddress = null;
let tokenAddress = null;

/**
 * 设置服务实例
 */
function setServices(services) {
    liquidityService = services.liquidityService;
    priceOracleService = services.priceOracleService;
    tronWeb = services.tronWeb;
    poolAddress = services.poolAddress;
    routerAddress = services.routerAddress;
    tokenAddress = services.tokenAddress;
}

// ============ 池状态查询 ============

/**
 * GET /api/amm/pools
 * 查询所有流动性池
 */
router.get('/pools', async (req, res) => {
    try {
        const pools = await PoolState.find({}).sort({ updatedAt: -1 });
        res.json({
            success: true,
            data: pools.map(p => p.toAPIJSON())
        });
    } catch (error) {
        console.error('[AMM API] Get pools error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/amm/pool/:address
 * 查询指定池状态
 */
router.get('/pool/:address?', async (req, res) => {
    try {
        const address = req.params.address || poolAddress;
        
        if (!address) {
            return res.status(400).json({ success: false, error: 'Pool address required' });
        }
        
        const poolState = await PoolState.findOne({ poolAddress: address.toLowerCase() });
        
        if (!poolState) {
            return res.status(404).json({ success: false, error: 'Pool not found' });
        }
        
        res.json({
            success: true,
            data: poolState.toAPIJSON()
        });
    } catch (error) {
        console.error('[AMM API] Get pool error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ 价格查询 ============

/**
 * GET /api/amm/price
 * 查询实时汇率
 */
router.get('/price', async (req, res) => {
    try {
        if (!priceOracleService) {
            return res.status(503).json({ success: false, error: 'Service not initialized' });
        }
        
        const price = await priceOracleService.getCurrentPrice();
        
        res.json({
            success: true,
            data: {
                ...price,
                poolAddress,
                tokenAddress,
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('[AMM API] Get price error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/amm/quote
 * 预估交易输出
 */
router.get('/quote', async (req, res) => {
    try {
        const { amountIn, direction } = req.query;
        
        if (!amountIn || !direction) {
            return res.status(400).json({ success: false, error: 'amountIn and direction required' });
        }
        
        if (!priceOracleService) {
            return res.status(503).json({ success: false, error: 'Service not initialized' });
        }
        
        const isTRXToCHIP = direction.toUpperCase() === 'TRX_TO_CHIP';
        const quote = await priceOracleService.getQuote(amountIn, isTRXToCHIP);
        
        res.json({
            success: true,
            data: quote
        });
    } catch (error) {
        console.error('[AMM API] Get quote error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ 流动性查询 ============

/**
 * GET /api/amm/liquidity/:user
 * 查询用户流动性
 */
router.get('/liquidity/:user', async (req, res) => {
    try {
        const { user } = req.params;
        
        if (!liquidityService) {
            return res.status(503).json({ success: false, error: 'Service not initialized' });
        }
        
        const liquidity = await liquidityService.getUserLiquidity(user);
        
        res.json({
            success: true,
            data: liquidity
        });
    } catch (error) {
        console.error('[AMM API] Get user liquidity error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ 交易数据生成 ============

/**
 * POST /api/amm/tx/add-liquidity
 * 生成添加流动性交易数据
 */
router.post('/tx/add-liquidity', async (req, res) => {
    try {
        const { amountCHIPDesired, amountCHIPMin, amountTRXMin, deadline } = req.body;
        
        if (!amountCHIPDesired) {
            return res.status(400).json({ success: false, error: 'amountCHIPDesired required' });
        }
        
        if (!routerAddress) {
            return res.status(503).json({ success: false, error: 'Router not configured' });
        }
        
        // 构建交易数据
        const txData = {
            to: routerAddress,
            value: 0, // 需要用户发送时指定TRX数量
            data: {
                function: 'addLiquidity(uint256,uint256,uint256,address,uint256)',
                parameters: [
                    { type: 'uint256', value: amountCHIPDesired },
                    { type: 'uint256', value: amountCHIPMin || 0 },
                    { type: 'uint256', value: amountTRXMin || 0 },
                    { type: 'address', value: 'REPLACE_WITH_USER_ADDRESS' },
                    { type: 'uint256', value: deadline || Math.floor(Date.now() / 1000) + 1200 }
                ]
            },
            // 先授权CHIP
            approve: {
                token: tokenAddress,
                spender: routerAddress,
                amount: amountCHIPDesired
            }
        };
        
        res.json({
            success: true,
            data: txData
        });
    } catch (error) {
        console.error('[AMM API] Add liquidity tx error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/amm/tx/remove-liquidity
 * 生成移除流动性交易数据
 */
router.post('/tx/remove-liquidity', async (req, res) => {
    try {
        const { liquidity, amountTRXMin, amountCHIPMin, deadline } = req.body;
        
        if (!liquidity) {
            return res.status(400).json({ success: false, error: 'liquidity required' });
        }
        
        if (!routerAddress) {
            return res.status(503).json({ success: false, error: 'Router not configured' });
        }
        
        const txData = {
            to: routerAddress,
            value: 0,
            data: {
                function: 'removeLiquidity(uint256,uint256,uint256,address,uint256)',
                parameters: [
                    { type: 'uint256', value: liquidity },
                    { type: 'uint256', value: amountTRXMin || 0 },
                    { type: 'uint256', value: amountCHIPMin || 0 },
                    { type: 'address', value: 'REPLACE_WITH_USER_ADDRESS' },
                    { type: 'uint256', value: deadline || Math.floor(Date.now() / 1000) + 1200 }
                ]
            },
            // 先授权LP代币
            approve: {
                token: poolAddress, // LP代币就是pool合约
                spender: routerAddress,
                amount: liquidity
            }
        };
        
        res.json({
            success: true,
            data: txData
        });
    } catch (error) {
        console.error('[AMM API] Remove liquidity tx error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/amm/tx/swap
 * 生成交换交易数据
 */
router.post('/tx/swap', async (req, res) => {
    try {
        const { amountIn, amountOutMin, direction, deadline } = req.body;
        
        if (!amountIn || !direction) {
            return res.status(400).json({ success: false, error: 'amountIn and direction required' });
        }
        
        if (!routerAddress) {
            return res.status(503).json({ success: false, error: 'Router not configured' });
        }
        
        const isTRXToCHIP = direction.toUpperCase() === 'TRX_TO_CHIP';
        
        let txData;
        
        if (isTRXToCHIP) {
            // TRX -> CHIP
            txData = {
                to: routerAddress,
                value: amountIn,
                data: {
                    function: 'swapTRXForCHIP(uint256,address,uint256)',
                    parameters: [
                        { type: 'uint256', value: amountOutMin || 0 },
                        { type: 'address', value: 'REPLACE_WITH_USER_ADDRESS' },
                        { type: 'uint256', value: deadline || Math.floor(Date.now() / 1000) + 1200 }
                    ]
                }
            };
        } else {
            // CHIP -> TRX
            txData = {
                to: routerAddress,
                value: 0,
                data: {
                    function: 'swapCHIPForTRX(uint256,uint256,address,uint256)',
                    parameters: [
                        { type: 'uint256', value: amountIn },
                        { type: 'uint256', value: amountOutMin || 0 },
                        { type: 'address', value: 'REPLACE_WITH_USER_ADDRESS' },
                        { type: 'uint256', value: deadline || Math.floor(Date.now() / 1000) + 1200 }
                    ]
                },
                // 先授权CHIP
                approve: {
                    token: tokenAddress,
                    spender: routerAddress,
                    amount: amountIn
                }
            };
        }
        
        res.json({
            success: true,
            data: txData
        });
    } catch (error) {
        console.error('[AMM API] Swap tx error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ 历史记录 ============

/**
 * GET /api/amm/price/history
 * 价格历史
 */
router.get('/price/history', async (req, res) => {
    try {
        const { interval = '1m', from, to } = req.query;
        
        if (!liquidityService) {
            return res.status(503).json({ success: false, error: 'Service not initialized' });
        }
        
        const history = await liquidityService.getPriceHistory(
            interval,
            from ? parseInt(from) : null,
            to ? parseInt(to) : null
        );
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('[AMM API] Price history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/amm/user/:address/history
 * 用户交易历史
 */
router.get('/user/:address/history', async (req, res) => {
    try {
        const { address } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        if (!liquidityService) {
            return res.status(503).json({ success: false, error: 'Service not initialized' });
        }
        
        const history = await liquidityService.getSwapHistory({
            userAddress: address,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('[AMM API] User history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/amm/transactions
 * 所有交易记录
 */
router.get('/transactions', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const address = poolAddress;
        const transactions = await SwapEvent.find({ poolAddress: address })
            .sort({ blockTimestamp: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));
        
        res.json({
            success: true,
            data: transactions.map(t => t.toAPIJSON())
        });
    } catch (error) {
        console.error('[AMM API] Transactions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ 配置信息 ============

/**
 * GET /api/amm/config
 * 获取AMM配置信息
 */
router.get('/config', (req, res) => {
    res.json({
        success: true,
        data: {
            poolAddress,
            routerAddress,
            tokenAddress,
            fee: {
                numerator: 997,
                denominator: 1000,
                percentage: 0.3
            }
        }
    });
});

module.exports = {
    router,
    setServices
};
