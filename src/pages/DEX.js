/**
 * DEX Page
 * 去中心化交易所页面
 */
import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import { useAMM } from '../context/amm/AMMContext';
import { useTronLink } from '../context/tron/TronContext';
import globalContext from '../context/global/globalContext';
import TradingPanel from '../components/amm/TradingPanel';
import LiquidityPanel from '../components/amm/LiquidityPanel';
import PriceChart from '../components/amm/PriceChart';

const PageContainer = styled.div`
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 6rem 2rem 2rem 2rem;
    color: #fff;
`;

const Header = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16px;
`;

const Title = styled.h1`
    font-size: 28px;
    font-weight: 700;
    background: linear-gradient(90deg, #00d9ff, #00ff88);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin: 0;
`;

const PriceInfo = styled.div`
    display: flex;
    gap: 30px;
    align-items: center;
`;

const PriceItem = styled.div`
    text-align: right;
`;

const PriceLabel = styled.div`
    font-size: 12px;
    color: #888;
    margin-bottom: 4px;
`;

const PriceValue = styled.div`
    font-size: 20px;
    font-weight: 600;
    color: #00d9ff;
`;

const MainContent = styled.div`
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 20px;
    
    @media (max-width: 1200px) {
        grid-template-columns: 1fr;
    }
`;

const LeftPanel = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const Tabs = styled.div`
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
`;

const Tab = styled.button`
    flex: 1;
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    
    background: ${props => props.active ? 'linear-gradient(135deg, #00d9ff, #00ff88)' : 'rgba(255, 255, 255, 0.1)'};
    color: ${props => props.active ? '#1a1a2e' : '#fff'};
    
    &:hover {
        background: ${props => props.active ? 'linear-gradient(135deg, #00d9ff, #00ff88)' : 'rgba(255, 255, 255, 0.2)'};
    }
`;

const PoolStats = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 20px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    
    @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
    }
`;

const StatItem = styled.div`
    text-align: center;
`;

const StatLabel = styled.div`
    font-size: 12px;
    color: #888;
    margin-bottom: 8px;
`;

const StatValue = styled.div`
    font-size: 18px;
    font-weight: 600;
    color: #fff;
`;

const ChartContainer = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 20px;
    min-height: 400px;
`;

const LoadingContainer = styled.div`
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    color: #888;
`;

function DEX() {
    const { poolState, price, priceHistory, loading, userAddress, setUserAddress } = useAMM();
    const { address, connected, connect } = useTronLink();
    const { walletAddress: globalWalletAddr, setWalletAddress } = useContext(globalContext);
    
    // Sync TronLink address to global context (fixes navbar on refresh)
    useEffect(() => {
        if (address && address !== globalWalletAddr) {
            setWalletAddress(address);
        }
    }, [address, globalWalletAddr, setWalletAddress]);
    
    const [activeTab, setActiveTab] = useState('swap'); // 'swap' | 'liquidity'
    
    // 同步用户地址
    useEffect(() => {
        if (address && address !== userAddress) {
            setUserAddress(address);
        }
    }, [address, userAddress, setUserAddress]);
    
    // 格式化数字
    const formatNumber = (num, decimals = 2) => {
        if (!num) return '0';
        const n = typeof num === 'string' ? parseFloat(num) : num;
        return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
    };
    
    // 格式化大数字
    const formatBigNumber = (numStr) => {
        if (!numStr) return '0';
        const num = parseFloat(numStr) / 1e6; // micro to normal
        if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        }
        return num.toFixed(2);
    };
    
    if (loading && !poolState) {
        return (
            <PageContainer>
                <LoadingContainer>
                    <div>Loading DEX...</div>
                </LoadingContainer>
            </PageContainer>
        );
    }
    
    return (
        <PageContainer>
            {/* Header */}
            <Header>
                <div>
                    <Title>TRX / CHIP Exchange</Title>
                    <div style={{ fontSize: '14px', color: '#888', marginTop: '8px' }}>
                        Automated Market Maker
                    </div>
                </div>
                <PriceInfo>
                    <PriceItem>
                        <PriceLabel>TRX Price (CHIP)</PriceLabel>
                        <PriceValue>{formatNumber(price.priceTRXToCHIP, 4)}</PriceValue>
                    </PriceItem>
                    <PriceItem>
                        <PriceLabel>CHIP Price (TRX)</PriceLabel>
                        <PriceValue>{formatNumber(price.priceCHIPToTRX, 4)}</PriceValue>
                    </PriceItem>
                </PriceInfo>
            </Header>
            
            {/* Pool Stats */}
            <PoolStats style={{ marginBottom: '20px' }}>
                <StatItem>
                    <StatLabel>TRX Reserve</StatLabel>
                    <StatValue>{formatBigNumber(poolState?.reserves?.trx)}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>CHIP Reserve</StatLabel>
                    <StatValue>{formatBigNumber(poolState?.reserves?.chip)}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>K Value</StatLabel>
                    <StatValue>{formatBigNumber(poolState?.kValue)}</StatValue>
                </StatItem>
                <StatItem>
                    <StatLabel>Fee</StatLabel>
                    <StatValue>0.3%</StatValue>
                </StatItem>
            </PoolStats>
            
            {/* Main Content */}
            <MainContent>
                <LeftPanel>
                    {/* Chart */}
                    <ChartContainer>
                        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px' }}>Price Chart</h3>
                        <PriceChart data={priceHistory} />
                    </ChartContainer>
                </LeftPanel>
                
                {/* Right Panel */}
                <div>
                    <Tabs>
                        <Tab 
                            active={activeTab === 'swap'} 
                            onClick={() => setActiveTab('swap')}
                        >
                            Swap
                        </Tab>
                        <Tab 
                            active={activeTab === 'liquidity'} 
                            onClick={() => setActiveTab('liquidity')}
                        >
                            Liquidity
                        </Tab>
                    </Tabs>
                    
                    {activeTab === 'swap' ? (
                        <TradingPanel />
                    ) : (
                        <LiquidityPanel />
                    )}
                </div>
            </MainContent>
        </PageContainer>
    );
}

export default DEX;
