/**
 * LiquidityPanel Component
 * 流动性管理组件
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useAMM } from '../../context/amm/AMMContext';
import { useTronLink } from '../../context/tron/TronContext';

const Panel = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 24px;
`;

const Tabs = styled.div`
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
`;

const Tab = styled.button`
    flex: 1;
    padding: 10px;
    border: 1px solid ${props => props.active ? '#00d9ff' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 8px;
    background: ${props => props.active ? 'rgba(0, 217, 255, 0.1)' : 'transparent'};
    color: ${props => props.active ? '#00d9ff' : '#888'};
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    
    &:hover {
        border-color: #00d9ff;
    }
`;

const InputGroup = styled.div`
    margin-bottom: 16px;
`;

const InputLabel = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 14px;
    color: #888;
`;

const InputContainer = styled.div`
    display: flex;
    gap: 12px;
    align-items: center;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    padding: 12px 16px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    
    &:focus-within {
        border-color: #00d9ff;
    }
`;

const Input = styled.input`
    flex: 1;
    background: none;
    border: none;
    color: #fff;
    font-size: 20px;
    font-weight: 600;
    outline: none;
    
    &::placeholder {
        color: #555;
    }
`;

const TokenLabel = styled.div`
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    font-weight: 600;
`;

const InfoRow = styled.div`
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`;

const InfoLabel = styled.span`
    color: #888;
`;

const InfoValue = styled.span`
    color: #fff;
    font-weight: 500;
`;

const ActionButton = styled.button`
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 20px;
    transition: all 0.3s ease;
    
    background: ${props => props.disabled 
        ? 'rgba(255, 255, 255, 0.1)' 
        : 'linear-gradient(135deg, #00d9ff, #00ff88)'};
    color: ${props => props.disabled ? '#555' : '#1a1a2e'};
    
    &:hover:not(:disabled) {
        transform: translateY(-2px);
    }
    
    &:disabled {
        cursor: not-allowed;
    }
`;

const UserLiquidityInfo = styled.div`
    background: rgba(0, 217, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
`;

const BalanceRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    
    &:first-child {
        padding-top: 0;
    }
`;

function LiquidityPanel() {
    const { poolState, price, userLiquidity, getAddLiquidityTxData, getRemoveLiquidityTxData, userAddress, config } = useAMM();
    const { connected, address, signAndSendTransaction, approveToken, getTokenBalance } = useTronLink();
    
    // CHIP Token 地址
    const chipTokenAddress = config?.tokenAddress;
    
    const [activeTab, setActiveTab] = useState('add'); // 'add' | 'remove'
    
    // Add liquidity state
    const [trxAmount, setTrxAmount] = useState('');
    const [chipAmount, setChipAmount] = useState('');
    
    // Remove liquidity state
    const [lpAmount, setLpAmount] = useState('');
    
    // 余额
    const [balances, setBalances] = useState({ trx: 0, chip: 0, lp: 0 });
    
    // 状态
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    
    // 获取余额
    useEffect(() => {
        const fetchBalances = async () => {
            if (address && chipTokenAddress) {
                const trxBalance = await getTokenBalance(null, address);
                const chipBalance = await getTokenBalance(chipTokenAddress, address);
                const lpBalance = userLiquidity?.lpBalance || '0';
                
                setBalances({
                    trx: parseFloat(trxBalance || 0) / 1e6,
                    chip: parseFloat(chipBalance || 0) / 1e6,
                    lp: parseFloat(lpBalance || 0) / 1e6
                });
            }
        };
        
        fetchBalances();
    }, [address, chipTokenAddress, getTokenBalance, userLiquidity]);
    
    // 根据TRX计算CHIP
    useEffect(() => {
        if (activeTab === 'add' && trxAmount && price.priceTRXToCHIP > 0) {
            const chip = parseFloat(trxAmount) * price.priceTRXToCHIP;
            setChipAmount(chip.toFixed(4));
        }
    }, [trxAmount, price.priceTRXToCHIP, activeTab]);
    
    // 添加流动性
    const handleAddLiquidity = async () => {
        if (!connected || !address) {
            alert('Please connect your wallet first');
            return;
        }
        
        if (!trxAmount || !chipAmount) return;
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            const trxAmountMicro = Math.floor(parseFloat(trxAmount) * 1e6).toString();
            const chipAmountMicro = Math.floor(parseFloat(chipAmount) * 1e6).toString();
            
            // 获取交易数据
            const txData = await getAddLiquidityTxData(trxAmountMicro, chipAmountMicro);
            
            if (!txData) {
                throw new Error('Failed to get transaction data');
            }
            
            // 授权CHIP
            if (txData.approve) {
                console.log('[LiquidityPanel] Approving CHIP...');
                const approveResult = await approveToken(txData.approve.token, txData.approve.spender, txData.approve.amount);
                if (!approveResult) {
                    throw new Error('Failed to approve CHIP');
                }
            }
            
            // 发送交易
            console.log('[LiquidityPanel] Sending add liquidity transaction...');
            const result = await signAndSendTransaction(
                txData.to,
                trxAmountMicro,
                txData.data
            );
            
            if (result) {
                alert(`Liquidity added successfully! TX: ${result}`);
                setTrxAmount('');
                setChipAmount('');
            } else {
                throw new Error('Transaction failed');
            }
        } catch (err) {
            console.error('[LiquidityPanel] Add liquidity error:', err);
            setError(err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // 移除流动性
    const handleRemoveLiquidity = async () => {
        if (!connected || !address) {
            alert('Please connect your wallet first');
            return;
        }
        
        if (!lpAmount) return;
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            const lpAmountMicro = Math.floor(parseFloat(lpAmount) * 1e6).toString();
            
            // 获取交易数据
            const txData = await getRemoveLiquidityTxData(lpAmountMicro);
            
            if (!txData) {
                throw new Error('Failed to get transaction data');
            }
            
            // 授权LP代币
            if (txData.approve) {
                console.log('[LiquidityPanel] Approving LP token...');
                const approveResult = await approveToken(txData.approve.token, txData.approve.spender, txData.approve.amount);
                if (!approveResult) {
                    throw new Error('Failed to approve LP token');
                }
            }
            
            // 发送交易
            console.log('[LiquidityPanel] Sending remove liquidity transaction...');
            const result = await signAndSendTransaction(
                txData.to,
                0,
                txData.data
            );
            
            if (result) {
                alert(`Liquidity removed successfully! TX: ${result}`);
                setLpAmount('');
            } else {
                throw new Error('Transaction failed');
            }
        } catch (err) {
            console.error('[LiquidityPanel] Remove liquidity error:', err);
            setError(err.message);
            alert(`Error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // 用户流动性信息
    const renderUserLiquidityInfo = () => {
        if (!userLiquidity || parseFloat(userLiquidity.lpBalance || '0') === 0) {
            return null;
        }
        
        const lpBalance = parseFloat(userLiquidity.lpBalance || '0') / 1e6;
        const currentTRX = parseFloat(userLiquidity.currentValue?.trx || '0') / 1e6;
        const currentCHIP = parseFloat(userLiquidity.currentValue?.chip || '0') / 1e6;
        const share = userLiquidity.share || 0;
        
        return (
            <UserLiquidityInfo>
                <div style={{ fontWeight: '600', marginBottom: '12px' }}>Your Liquidity</div>
                <BalanceRow>
                    <span>LP Tokens</span>
                    <span>{lpBalance.toFixed(4)} ALP</span>
                </BalanceRow>
                <BalanceRow>
                    <span>Pool Share</span>
                    <span>{share.toFixed(4)}%</span>
                </BalanceRow>
                <BalanceRow>
                    <span>TRX Value</span>
                    <span>{currentTRX.toFixed(4)} TRX</span>
                </BalanceRow>
                <BalanceRow>
                    <span>CHIP Value</span>
                    <span>{currentCHIP.toFixed(4)} CHIP</span>
                </BalanceRow>
            </UserLiquidityInfo>
        );
    };
    
    return (
        <Panel>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Manage Liquidity</h3>
            
            {/* User Liquidity Info */}
            {renderUserLiquidityInfo()}
            
            {/* Tabs */}
            <Tabs>
                <Tab active={activeTab === 'add'} onClick={() => setActiveTab('add')}>
                    Add
                </Tab>
                <Tab active={activeTab === 'remove'} onClick={() => setActiveTab('remove')}>
                    Remove
                </Tab>
            </Tabs>
            
            {activeTab === 'add' ? (
                <>
                    {/* Add Liquidity */}
                    <InputGroup>
                        <InputLabel>
                            <span>TRX Amount</span>
                            <span style={{ fontSize: '12px' }}>Balance: {balances.trx.toFixed(4)}</span>
                        </InputLabel>
                        <InputContainer>
                            <Input
                                type="number"
                                placeholder="0.0"
                                value={trxAmount}
                                onChange={(e) => setTrxAmount(e.target.value)}
                            />
                            <TokenLabel>TRX</TokenLabel>
                        </InputContainer>
                    </InputGroup>
                    
                    <InputGroup>
                        <InputLabel>
                            <span>CHIP Amount</span>
                            <span style={{ fontSize: '12px' }}>Balance: {balances.chip.toFixed(4)}</span>
                        </InputLabel>
                        <InputContainer>
                            <Input
                                type="number"
                                placeholder="0.0"
                                value={chipAmount}
                                onChange={(e) => setChipAmount(e.target.value)}
                            />
                            <TokenLabel>CHIP</TokenLabel>
                        </InputContainer>
                    </InputGroup>
                    
                    {poolState && (
                        <InfoRow>
                            <InfoLabel>Rate</InfoLabel>
                            <InfoValue>1 TRX = {price.priceTRXToCHIP?.toFixed(4) || '0'} CHIP</InfoValue>
                        </InfoRow>
                    )}
                    
                    <ActionButton 
                        disabled={!connected || !trxAmount || !chipAmount || isSubmitting}
                        onClick={handleAddLiquidity}
                    >
                        {!connected ? 'Connect Wallet' : isSubmitting ? 'Adding...' : 'Add Liquidity'}
                    </ActionButton>
                </>
            ) : (
                <>
                    {/* Remove Liquidity */}
                    <InputGroup>
                        <InputLabel>
                            <span>LP Token Amount</span>
                            <span style={{ fontSize: '12px' }}>Balance: {balances.lp.toFixed(4)}</span>
                        </InputLabel>
                        <InputContainer>
                            <Input
                                type="number"
                                placeholder="0.0"
                                value={lpAmount}
                                onChange={(e) => setLpAmount(e.target.value)}
                            />
                            <TokenLabel>ALP</TokenLabel>
                        </InputContainer>
                    </InputGroup>
                    
                    {lpAmount && poolState && (
                        <>
                            <InfoRow>
                                <InfoLabel>You will receive</InfoLabel>
                            </InfoRow>
                            <InfoRow>
                                <InfoLabel>TRX</InfoLabel>
                                <InfoValue>
                                    {(parseFloat(lpAmount) * parseFloat(poolState.reserves?.trx || '0') / (parseFloat(poolState.totalSupply || '1') * 1e6)).toFixed(4)}
                                </InfoValue>
                            </InfoRow>
                            <InfoRow>
                                <InfoLabel>CHIP</InfoLabel>
                                <InfoValue>
                                    {(parseFloat(lpAmount) * parseFloat(poolState.reserves?.chip || '0') / (parseFloat(poolState.totalSupply || '1') * 1e6)).toFixed(4)}
                                </InfoValue>
                            </InfoRow>
                        </>
                    )}
                    
                    <ActionButton 
                        disabled={!connected || !lpAmount || isSubmitting}
                        onClick={handleRemoveLiquidity}
                    >
                        {!connected ? 'Connect Wallet' : isSubmitting ? 'Removing...' : 'Remove Liquidity'}
                    </ActionButton>
                </>
            )}
            
            {error && (
                <div style={{ marginTop: '16px', color: '#ff4444', fontSize: '14px' }}>
                    {error}
                </div>
            )}
        </Panel>
    );
}

export default LiquidityPanel;
