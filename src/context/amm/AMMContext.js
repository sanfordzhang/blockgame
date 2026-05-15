/**
 * AMM Context
 * AMM流动性池状态管理
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getServerBaseUrl } from '../../utils/serverConfig';

const AMMContext = createContext(null);
const API_BASE = getServerBaseUrl();

export function AMMProvider({ children, tronLink }) {
    // 池状态
    const [poolState, setPoolState] = useState(null);
    const [price, setPrice] = useState({
        priceTRXToCHIP: 0,
        priceCHIPToTRX: 0
    });
    
    // 用户流动性
    const [userLiquidity, setUserLiquidity] = useState(null);
    
    // 交易历史
    const [swapHistory, setSwapHistory] = useState([]);
    
    // 价格历史（图表数据）
    const [priceHistory, setPriceHistory] = useState([]);
    
    // 加载状态
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // 配置
    const [config, setConfig] = useState({
        poolAddress: null,
        routerAddress: null,
        tokenAddress: null
    });
    const ammConfigured = !!(config.poolAddress && config.routerAddress && config.tokenAddress);
    
    // 用户地址
    const [userAddress, setUserAddress] = useState(null);
    
    // 获取配置
    const fetchConfig = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/amm/config`);
            setConfig(res.data.data);
            return res.data.data;
        } catch (err) {
            console.error('[AMM Context] Fetch config error:', err);
            return null;
        }
    }, []);
    
    // 获取池状态
    const fetchPoolState = useCallback(async () => {
        if (!ammConfigured) return;
        try {
            const res = await axios.get(`${API_BASE}/api/amm/pool`);
            if (res.data.success) {
                setPoolState(res.data.data);
            }
        } catch (err) {
            console.error('[AMM Context] Fetch pool state error:', err);
        }
    }, [ammConfigured]);
    
    // 获取价格
    const fetchPrice = useCallback(async () => {
        if (!ammConfigured) return;
        try {
            const res = await axios.get(`${API_BASE}/api/amm/price`);
            if (res.data.success) {
                setPrice(res.data.data);
            }
        } catch (err) {
            console.error('[AMM Context] Fetch price error:', err);
        }
    }, [ammConfigured]);
    
    // 获取用户流动性
    const fetchUserLiquidity = useCallback(async (address) => {
        if (!address || !ammConfigured) return;
        
        try {
            const res = await axios.get(`${API_BASE}/api/amm/liquidity/${address}`);
            if (res.data.success) {
                setUserLiquidity(res.data.data);
            }
        } catch (err) {
            console.error('[AMM Context] Fetch user liquidity error:', err);
        }
    }, [ammConfigured]);
    
    // 获取价格历史
    const fetchPriceHistory = useCallback(async (interval = '1m') => {
        if (!ammConfigured) return;
        try {
            const res = await axios.get(`${API_BASE}/api/amm/price/history`, {
                params: { interval }
            });
            if (res.data.success) {
                setPriceHistory(res.data.data);
            }
        } catch (err) {
            console.error('[AMM Context] Fetch price history error:', err);
        }
    }, [ammConfigured]);
    
    // 获取交易历史
    const fetchSwapHistory = useCallback(async (address = null, limit = 50) => {
        if (!ammConfigured) return;
        try {
            const url = address 
                ? `${API_BASE}/api/amm/user/${address}/history?limit=${limit}`
                : `${API_BASE}/api/amm/transactions?limit=${limit}`;
            
            const res = await axios.get(url);
            if (res.data.success) {
                setSwapHistory(res.data.data);
            }
        } catch (err) {
            console.error('[AMM Context] Fetch swap history error:', err);
        }
    }, [ammConfigured]);
    
    // 获取交易报价
    const getQuote = useCallback(async (amountIn, direction) => {
        if (!ammConfigured) return null;
        try {
            const res = await axios.get(`${API_BASE}/api/amm/quote`, {
                params: { amountIn, direction }
            });
            return res.data.success ? res.data.data : null;
        } catch (err) {
            console.error('[AMM Context] Get quote error:', err);
            return null;
        }
    }, [ammConfigured]);
    
    // 获取交易数据
    const getSwapTxData = useCallback(async (amountIn, direction, amountOutMin = 0) => {
        if (!ammConfigured) return null;
        try {
            const res = await axios.post(`${API_BASE}/api/amm/tx/swap`, {
                amountIn,
                direction,
                amountOutMin,
                deadline: Math.floor(Date.now() / 1000) + 1200
            });
            return res.data.success ? res.data.data : null;
        } catch (err) {
            console.error('[AMM Context] Get swap tx data error:', err);
            return null;
        }
    }, [ammConfigured]);
    
    // 获取添加流动性交易数据
    const getAddLiquidityTxData = useCallback(async (amountTRX, amountCHIPDesired) => {
        if (!ammConfigured) return null;
        try {
            const res = await axios.post(`${API_BASE}/api/amm/tx/add-liquidity`, {
                amountCHIPDesired,
                amountCHIPMin: Math.floor(amountCHIPDesired * 0.99), // 1% 滑点
                amountTRXMin: Math.floor(amountTRX * 0.99),
                deadline: Math.floor(Date.now() / 1000) + 1200
            });
            return res.data.success ? res.data.data : null;
        } catch (err) {
            console.error('[AMM Context] Get add liquidity tx data error:', err);
            return null;
        }
    }, [ammConfigured]);
    
    // 获取移除流动性交易数据
    const getRemoveLiquidityTxData = useCallback(async (liquidity) => {
        if (!ammConfigured) return null;
        try {
            const res = await axios.post(`${API_BASE}/api/amm/tx/remove-liquidity`, {
                liquidity,
                amountTRXMin: 0,
                amountCHIPMin: 0,
                deadline: Math.floor(Date.now() / 1000) + 1200
            });
            return res.data.success ? res.data.data : null;
        } catch (err) {
            console.error('[AMM Context] Get remove liquidity tx data error:', err);
            return null;
        }
    }, [ammConfigured]);
    
    // 刷新所有数据
    const refreshAll = useCallback(async () => {
        setLoading(true);
        await Promise.all([
            fetchPoolState(),
            fetchPrice(),
            fetchPriceHistory(),
            fetchSwapHistory(),
            userAddress ? fetchUserLiquidity(userAddress) : Promise.resolve()
        ]);
        setLoading(false);
    }, [fetchPoolState, fetchPrice, fetchPriceHistory, fetchSwapHistory, fetchUserLiquidity, userAddress]);
    
    // 初始化 - 延迟到页面加载完成后再开始
    useEffect(() => {
        // Don't start fetching immediately - wait for page to render first
        const initTimer = setTimeout(async () => {
            try {
                await fetchConfig();
                // Only do full refresh on DEX page (check path)
                if (window.location.pathname === '/dex' || window.location.pathname.startsWith('/dex')) {
                    await refreshAll();
                }
            } catch(e) { /* ignore */ }
        }, 3000); // 3s delay
        
        // 定时刷新（只在DEX页面频繁刷新，其他页面30秒一次）
        let interval;
        const startInterval = () => {
            interval = setInterval(() => {
                if (window.location.pathname === '/dex' || window.location.pathname.startsWith('/dex')) {
                    fetchPrice();
                    fetchPoolState();
                }
                // Other pages don't need frequent AMM updates
            }, window.location.pathname === '/dex' ? 10000 : 30000);
        };
        
        // Start interval after initial load
        setTimeout(startInterval, 4000);
        
        return () => {
            clearTimeout(initTimer);
            clearInterval(interval);
        };
    }, [fetchConfig, refreshAll, fetchPrice, fetchPoolState]);
    
    // 监听用户地址变化
    useEffect(() => {
        if (userAddress) {
            fetchUserLiquidity(userAddress);
        }
    }, [userAddress, fetchUserLiquidity]);
    
    const value = {
        // 状态
        poolState,
        price,
        userLiquidity,
        swapHistory,
        priceHistory,
        config,
        loading,
        error,
        userAddress,
        
        // 方法
        setUserAddress,
        fetchPoolState,
        fetchPrice,
        fetchUserLiquidity,
        fetchPriceHistory,
        fetchSwapHistory,
        getQuote,
        getSwapTxData,
        getAddLiquidityTxData,
        getRemoveLiquidityTxData,
        refreshAll
    };
    
    return (
        <AMMContext.Provider value={value}>
            {children}
        </AMMContext.Provider>
    );
}

export function useAMM() {
    const context = useContext(AMMContext);
    if (!context) {
        throw new Error('useAMM must be used within AMMProvider');
    }
    return context;
}

export default AMMContext;
