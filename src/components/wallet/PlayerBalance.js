import React, { useState, useEffect } from 'react';
import { useTron } from '../../context/tron/TronContext';
import './PlayerBalance.css';

/**
 * Player Balance Display - Shows contract balance with available/locked separation
 */
const PlayerBalance = ({ onRefresh }) => {
  const { address, contract, isConnected } = useTron();
  const [balance, setBalance] = useState({
    available: 0,
    locked: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  const LOW_BALANCE_THRESHOLD = 10; // TRX

  useEffect(() => {
    if (isConnected && contract) {
      fetchBalance();
    }
  }, [isConnected, contract, address]);

  const fetchBalance = async () => {
    if (!contract || !address) return;
    
    try {
      setLoading(true);
      
      const playerData = await contract.players(address).call();
      
      const available = Number(playerData.balance) / 1e6;
      const locked = Number(playerData.lockedBalance) / 1e6;
      const total = available + locked;
      
      setBalance({ available, locked, total });
      setLastUpdate(new Date());
      setShowWarning(available < LOW_BALANCE_THRESHOLD && available > 0);
      
      if (onRefresh) {
        onRefresh({ available, locked, total });
      }
    } catch (err) {
      console.error('Failed to fetch balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTRX = (amount) => {
    return amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  if (!isConnected) {
    return (
      <div className="player-balance disconnected">
        <span className="balance-label">Balance</span>
        <span className="balance-value">Connect Wallet</span>
      </div>
    );
  }

  return (
    <div className="player-balance">
      {showWarning && (
        <div className="low-balance-warning">
          ⚠️ Low balance: Consider depositing more TRX
        </div>
      )}
      
      <div className="balance-header">
        <span className="balance-label">Your Balance</span>
        <button 
          className="refresh-btn" 
          onClick={fetchBalance}
          disabled={loading}
        >
          {loading ? '⟳' : '↻'}
        </button>
      </div>
      
      <div className="balance-main">
        <span className="balance-total">{formatTRX(balance.total)}</span>
        <span className="balance-unit">TRX</span>
      </div>
      
      <div className="balance-breakdown">
        <div className="balance-row">
          <span className="balance-type">Available</span>
          <span className="balance-amount available">{formatTRX(balance.available)} TRX</span>
        </div>
        <div className="balance-row">
          <span className="balance-type">In Play</span>
          <span className="balance-amount locked">{formatTRX(balance.locked)} TRX</span>
        </div>
      </div>
      
      {lastUpdate && (
        <div className="balance-footer">
          <span className="last-update">
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
};

export default PlayerBalance;
