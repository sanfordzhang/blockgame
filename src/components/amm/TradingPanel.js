/**
 * TradingPanel Component
 * 交易面板组件
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useAMM } from '../../context/amm/AMMContext';
import { useTronLink } from '../../context/tron/TronContext';

const Panel = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border-radius: 16px;
    padding: 24px;
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
    font-size: 24px;
    font-weight: 600;
    outline: none;
    
    &::placeholder {
        color: #555;
    }
`;

const TokenSelector = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    
    &:hover {
        background: rgba(255, 255, 255, 0.2);
    }
`;

const DirectionToggle = styled.button`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid #00d9ff;
    background: transparent;
    color: #00d9ff;
    font-size: 20px;
    cursor: pointer;
    margin: 8px auto;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    
    &:hover {
        background: rgba(0, 217, 255, 0.1);
        transform: rotate(180deg);
    }
`;

const InfoRow = styled.div`
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    
    &:last-child {
        border-bottom: none;
    }
`;

const InfoLabel = styled.span`
    color: #888;
`;

const InfoValue = styled.span`
    color: ${props => props.highlight ? '#00ff88' : '#fff'};
    font-weight: 500;
`;

const SwapButton = styled.button`
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 12px;
    font-size: 18px;
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
        box-shadow: 0 8px 20px rgba(0, 217, 255, 0.3);
    }
    
    &:disabled {
        cursor: not-allowed;
    }
`;

const WarningBox = styled.div`
    background: rgba(255, 165, 0, 0.1);
    border: 1px solid rgba(255, 165, 0, 0.3);
    border-radius: 8px;
    padding: 12px;
    margin-top: 16px;
    font-size: 13px;
    color: #ffa500;
`;

const SlippageSettings = styled.div`
    margin: 16px 0;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
`;

const SlippageOptions = styled.div`
    display: flex;
    gap: 8px;
    margin-top: 8px;
`;

const SlippageOption = styled.button`
    flex: 1;
    padding: 8px;
    border: 1px solid ${props => props.active ? '#00d9ff' : 'rgba(255, 255, 255, 0.1)'};
    border-radius: 6px;
    background: ${props => props.active ? 'rgba(0, 217, 255, 0.1)' : 'transparent'};
    color: ${props => props.active ? '#00d9ff' : '#888'};
    cursor: pointer;
    font-size: 13px;
    
    &:hover {
        border-color: #00d9ff;
    }
`;

function TradingPanel() {
    const { price, getQuote, getSwapTxData, userAddress, config } = useAMM();
    const { connected, address, signAndSendTransaction, approveToken, getTokenBalance } = useTronLink();
    
    // CHIP Token 地址
    const chipTokenAddress = config?.tokenAddress;
    
    // 输入状态
    const [fromAmount, setFromAmount] = useState('');
    const [toAmount, setToAmount] = useState('');
    const [direction, setDirection] = useState('TRX_TO_CHIP'); // 'TRX_TO_CHIP' | 'CHIP_TO_TRX'
    
    // 报价信息
    const [quote, setQuote] = useState(null);
    
    // 滑点设置
    const [slippage, setSlippage] = useState(1); // 1%
    
    // 交易状态
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txHash, setTxHash] = useState(null);
    const [error, setError] = useState(null);
    
    // 余额
    const [balances, setBalances] = useState({ trx: 0, chip: 0 });
    
    // 获取余额
    useEffect(() => {
        const fetchBalances = async () => {
            if (address && chipTokenAddress) {
                const trxBalance = await getTokenBalance(null, address);
                const chipBalance = await getTokenBalance(chipTokenAddress, address);
                setBalances({
                    trx: parseFloat(trxBalance || 0) / 1e6,
                    chip: parseFloat(chipBalance || 0) / 1e6
                });
            }
        };
        
        fetchBalances();
        const interval = setInterval(fetchBalances, 10000);
        return () => clearInterval(interval);
    }, [address, chipTokenAddress, getTokenBalance]);
    
    // 计算报价
    useEffect(() => {
        const calculateQuote = async () => {
            if (!fromAmount || parseFloat(fromAmount) <= 0) {
                setToAmount('');
                setQuote(null);
                return;
            }
            
            // 转换为微单位
            const amountInMicro = Math.floor(parseFloat(fromAmount) * 1e6).toString();
            const quoteResult = await getQuote(amountInMicro, direction);
            
            if (quoteResult) {
                setQuote(quoteResult);
                // 转换回正常单位
                const output = parseFloat(quoteResult.amountOut) / 1e6;
                setToAmount(output.toFixed(4));
            }
        };
        
        const timeout = setTimeout(calculateQuote, 300);
        return () => clearTimeout(timeout);
    }, [fromAmount, direction, getQuote]);
    
    // 切换方向
    const toggleDirection = () => {
        setDirection(prev => prev === 'TRX_TO_CHIP' ? 'CHIP_TO_TRX' : 'TRX_TO_CHIP');
        setFromAmount(toAmount);
        setToAmount('');
        setQuote(null);
    };
    
    // 执行交易
    const handleSwap = async () => {
        if (!connected || !address) {
            alert('Please connect your wallet first');
            return;
        }
        
        if (!quote || !fromAmount) {
            return;
        }
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            const amountInMicro = Math.floor(parseFloat(fromAmount) * 1e6).toString();
            const amountOutMin = Math.floor(parseFloat(quote.amountOut) * (100 - slippage) / 100).toString();
            
            // 获取交易数据
            const txData = await getSwapTxData(amountInMicro, direction, amountOutMin);
            
            if (!txData) {
                throw new Error('Failed to get transaction data');
            }
            
            // 如果是CHIP -> TRX，需要先授权
            if (direction === 'CHIP_TO_TRX' && txData.approve) {
                console.log('[TradingPanel] Approving CHIP...');
                const approveResult = await approveToken(txData.approve.token, txData.approve.spender, txData.approve.amount);
                if (!approveResult) {
                    throw new Error('Failed to approve CHIP');
                }
                console.log('[TradingPanel] CHIP approved');
            }
            
            // 发送交易
            console.log('[TradingPanel] Sending transaction...', {
                to: txData.to,
                value: txData.value,
                data: txData.data
            });
            const result = await signAndSendTransaction(
                txData.to,
                txData.value || 0,
                txData.data
            );
            
            if (result) {
                setTxHash(result);
                setFromAmount('');
                setToAmount('');
                setQuote(null);
                alert(`Swap successful! TX: ${result}`);
            } else {
                throw new Error('Transaction failed');
            }
        } catch (err) {
            console.error('[TradingPanel] Swap error:', err);
            setError(err.message || 'Transaction failed');
            alert(`Error: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // 判断是否可交易
    const canSwap = () => {
        if (!connected || !quote || !fromAmount || isSubmitting) return false;
        
        const fromAmountNum = parseFloat(fromAmount);
        const balance = direction === 'TRX_TO_CHIP' ? balances.trx : balances.chip;
        
        return fromAmountNum > 0 && fromAmountNum <= balance;
    };
    
    // 获取余额显示
    const getBalanceDisplay = () => {
        const token = direction === 'TRX_TO_CHIP' ? 'TRX' : 'CHIP';
        const balance = direction === 'TRX_TO_CHIP' ? balances.trx : balances.chip;
        return `Balance: ${balance.toFixed(4)} ${token}`;
    };
    
    return (
        <Panel>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Swap Tokens</h3>
            
            {/* From Input */}
            <InputGroup>
                <InputLabel>
                    <span>From</span>
                    <span style={{ fontSize: '12px' }}>{getBalanceDisplay()}</span>
                </InputLabel>
                <InputContainer>
                    <Input
                        type="number"
                        placeholder="0.0"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                    />
                    <TokenSelector>
                        {direction === 'TRX_TO_CHIP' ? 'TRX' : 'CHIP'}
                    </TokenSelector>
                </InputContainer>
            </InputGroup>
            
            {/* Direction Toggle */}
            <DirectionToggle onClick={toggleDirection}>
                ↓
            </DirectionToggle>
            
            {/* To Input */}
            <InputGroup>
                <InputLabel>To</InputLabel>
                <InputContainer>
                    <Input
                        type="number"
                        placeholder="0.0"
                        value={toAmount}
                        readOnly
                    />
                    <TokenSelector>
                        {direction === 'TRX_TO_CHIP' ? 'CHIP' : 'TRX'}
                    </TokenSelector>
                </InputContainer>
            </InputGroup>
            
            {/* Slippage Settings */}
            <SlippageSettings>
                <InputLabel>Slippage Tolerance</InputLabel>
                <SlippageOptions>
                    <SlippageOption 
                        active={slippage === 0.5} 
                        onClick={() => setSlippage(0.5)}
                    >
                        0.5%
                    </SlippageOption>
                    <SlippageOption 
                        active={slippage === 1} 
                        onClick={() => setSlippage(1)}
                    >
                        1%
                    </SlippageOption>
                    <SlippageOption 
                        active={slippage === 3} 
                        onClick={() => setSlippage(3)}
                    >
                        3%
                    </SlippageOption>
                </SlippageOptions>
            </SlippageSettings>
            
            {/* Quote Info */}
            {quote && (
                <>
                    <InfoRow>
                        <InfoLabel>Rate</InfoLabel>
                        <InfoValue>1 {direction === 'TRX_TO_CHIP' ? 'TRX' : 'CHIP'} = {quote.executionPrice.toFixed(6)} {direction === 'TRX_TO_CHIP' ? 'CHIP' : 'TRX'}</InfoValue>
                    </InfoRow>
                    <InfoRow>
                        <InfoLabel>Price Impact</InfoLabel>
                        <InfoValue highlight={quote.priceImpact < 1}>
                            {quote.priceImpact.toFixed(2)}%
                        </InfoValue>
                    </InfoRow>
                    <InfoRow>
                        <InfoLabel>Fee</InfoLabel>
                        <InfoValue>0.3%</InfoValue>
                    </InfoRow>
                    
                    {quote.priceImpact >= 3 && (
                        <WarningBox>
                            ⚠️ High price impact! Consider reducing the trade amount.
                        </WarningBox>
                    )}
                </>
            )}
            
            {/* Swap Button */}
            {!connected ? (
                <SwapButton disabled>
                    Connect Wallet
                </SwapButton>
            ) : (
                <SwapButton 
                    disabled={!canSwap()} 
                    onClick={handleSwap}
                >
                    {isSubmitting ? 'Swapping...' : 'Swap'}
                </SwapButton>
            )}
            
            {/* Error Display */}
            {error && (
                <div style={{ marginTop: '16px', color: '#ff4444', fontSize: '14px' }}>
                    {error}
                </div>
            )}
        </Panel>
    );
}

export default TradingPanel;
