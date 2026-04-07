/**
 * TransactionHistory Component
 * Displays user's AMM transaction history (swaps, liquidity operations)
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useTron } from '../../context/tron/TronContext';
import { useAMM } from '../../context/amm/AMMContext';

const HistoryContainer = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  padding: 1.5rem;
  margin-top: 1rem;
`;

const HistoryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  color: ${(props) => props.theme.colors.textPrimary};
`;

const FilterTabs = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const FilterTab = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  background: ${props => props.active ? props.theme.colors.primaryCta : 'transparent'};
  color: ${props => props.active ? 'white' : props.theme.colors.textSecondary};
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.active ? props.theme.colors.primaryCta : props.theme.colors.border};
  }
`;

const TransactionList = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

const TransactionItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid ${(props) => props.theme.colors.border};
  transition: background 0.2s;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${(props) => props.theme.colors.hoverBg || 'rgba(0,0,0,0.02)'};
  }
`;

const TxTypeBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => {
    switch(props.type) {
      case 'swap': return 'linear-gradient(135deg, #4CAF50, #8BC34A)';
      case 'add_liquidity': return 'linear-gradient(135deg, #2196F3, #03A9F4)';
      case 'remove_liquidity': return 'linear-gradient(135deg, #FF9800, #FFC107)';
      default: return '#9E9E9E';
    }
  }};
  color: white;
`;

const TxDetails = styled.div`
  flex: 1;
  margin-left: 1rem;
`;

const TxDescription = styled.div`
  font-size: 0.9rem;
  color: ${(props) => props.theme.colors.textPrimary};
  margin-bottom: 0.25rem;
`;

const TxTimestamp = styled.div`
  font-size: 0.75rem;
  color: ${(props) => props.theme.colors.textSecondary};
`;

const TxAmount = styled.div`
  text-align: right;
`;

const TxValue = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${props => props.negative ? '#f44336' : '#4CAF50'};
`;

const TxHash = styled.a`
  font-size: 0.75rem;
  color: ${(props) => props.theme.colors.primaryCta};
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: ${(props) => props.theme.colors.textSecondary};
`;

const LoadingSpinner = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem;
  
  &:after {
    content: '';
    width: 30px;
    height: 30px;
    border: 3px solid ${(props) => props.theme.colors.border};
    border-top-color: ${(props) => props.theme.colors.primaryCta};
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const NETWORK_CONFIG = {
  mainnet: {
    explorerUrl: 'https://tronscan.org/#/transaction/'
  },
  testnet: {
    explorerUrl: 'https://nile.tronscan.org/#/transaction/'
  }
};

const TransactionHistory = ({ limit = 20 }) => {
  const { address, network } = useTron();
  const { refreshUserHistory } = useAMM();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, swap, liquidity
  const [error, setError] = useState(null);

  useEffect(() => {
    if (address) {
      fetchHistory();
    }
  }, [address, filter]);

  const fetchHistory = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: limit.toString()
      });
      
      if (filter !== 'all') {
        params.append('type', filter === 'liquidity' ? 'add_liquidity,remove_liquidity' : 'swap');
      }
      
      const response = await fetch(`/api/amm/user/${address}/history?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error('Error fetching transaction history:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount, decimals = 2) => {
    return parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const getExplorerUrl = (txHash) => {
    const config = NETWORK_CONFIG[network] || NETWORK_CONFIG.testnet;
    return `${config.explorerUrl}${txHash}`;
  };

  const getTxDescription = (tx) => {
    switch(tx.type) {
      case 'swap':
        const fromSymbol = tx.tokenIn === 'TRX' ? 'TRX' : 'CHIP';
        const toSymbol = tx.tokenOut === 'TRX' ? 'TRX' : 'CHIP';
        return `Swap ${formatAmount(tx.amountIn)} ${fromSymbol} → ${formatAmount(tx.amountOut)} ${toSymbol}`;
      case 'add_liquidity':
        return `Add Liquidity: ${formatAmount(tx.trxAmount)} TRX + ${formatAmount(tx.chipAmount)} CHIP`;
      case 'remove_liquidity':
        return `Remove Liquidity: ${formatAmount(tx.trxAmount)} TRX + ${formatAmount(tx.chipAmount)} CHIP`;
      default:
        return 'Unknown transaction';
    }
  };

  return (
    <HistoryContainer>
      <HistoryHeader>
        <Title>Transaction History</Title>
        <FilterTabs>
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterTab>
          <FilterTab active={filter === 'swap'} onClick={() => setFilter('swap')}>
            Swaps
          </FilterTab>
          <FilterTab active={filter === 'liquidity'} onClick={() => setFilter('liquidity')}>
            Liquidity
          </FilterTab>
        </FilterTabs>
      </HistoryHeader>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState>Error: {error}</EmptyState>
      ) : transactions.length === 0 ? (
        <EmptyState>No transactions yet</EmptyState>
      ) : (
        <TransactionList>
          {transactions.map((tx, index) => (
            <TransactionItem key={tx._id || index}>
              <TxTypeBadge type={tx.type}>
                {tx.type === 'swap' ? 'Swap' : 
                 tx.type === 'add_liquidity' ? 'Add' : 'Remove'}
              </TxTypeBadge>
              
              <TxDetails>
                <TxDescription>{getTxDescription(tx)}</TxDescription>
                <TxTimestamp>{formatDate(tx.timestamp)}</TxTimestamp>
              </TxDetails>
              
              <TxAmount>
                <TxValue negative={tx.type === 'remove_liquidity'}>
                  {tx.type === 'swap' 
                    ? `+${formatAmount(tx.amountOut)} ${tx.tokenOut === 'TRX' ? 'TRX' : 'CHIP'}`
                    : tx.type === 'add_liquidity'
                      ? `LP Tokens`
                      : `+${formatAmount(tx.trxAmount)} TRX`
                  }
                </TxValue>
                {tx.txHash && (
                  <TxHash 
                    href={getExplorerUrl(tx.txHash)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                  </TxHash>
                )}
              </TxAmount>
            </TransactionItem>
          ))}
        </TransactionList>
      )}
    </HistoryContainer>
  );
};

export default TransactionHistory;
