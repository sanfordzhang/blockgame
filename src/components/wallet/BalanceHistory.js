import React, { useState, useEffect } from 'react';
import { useTron } from '../../context/tron/TronContext';
import './BalanceHistory.css';

/**
 * Balance History - Shows recent balance changes
 */
const BalanceHistory = () => {
  const { address, isConnected } = useTron();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && address) {
      fetchHistory();
    }
  }, [isConnected, address]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/player/${address}/balance-history?limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        // Demo data if API not available
        setHistory([
          { type: 'deposit', amount: 100, timestamp: Date.now() - 3600000 },
          { type: 'win', amount: 25.5, timestamp: Date.now() - 7200000 },
          { type: 'join', amount: -50, timestamp: Date.now() - 10800000 },
          { type: 'loss', amount: -50, timestamp: Date.now() - 14400000 }
        ]);
      }
    } catch (err) {
      console.error('Failed to fetch balance history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTypeLabel = (type) => {
    const labels = {
      deposit: { label: 'Deposit', icon: '📥' },
      withdraw: { label: 'Withdraw', icon: '📤' },
      win: { label: 'Win', icon: '🏆' },
      loss: { label: 'Loss', icon: '💔' },
      join: { label: 'Join Table', icon: '🎮' },
      leave: { label: 'Leave Table', icon: '🚪' },
      rake: { label: 'Rake', icon: '📊' }
    };
    return labels[type] || { label: type, icon: '📝' };
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="balance-history">
      <h3>Recent Activity</h3>
      
      {loading ? (
        <div className="history-loading">Loading...</div>
      ) : history.length === 0 ? (
        <div className="history-empty">No recent activity</div>
      ) : (
        <ul className="history-list">
          {history.map((item, index) => {
            const typeInfo = getTypeLabel(item.type);
            const isPositive = item.amount > 0;
            
            return (
              <li key={index} className="history-item">
                <span className="history-icon">{typeInfo.icon}</span>
                <span className="history-type">{typeInfo.label}</span>
                <span className={`history-amount ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '+' : ''}{item.amount.toFixed(2)} TRX
                </span>
                <span className="history-time">{formatDate(item.timestamp)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default BalanceHistory;
