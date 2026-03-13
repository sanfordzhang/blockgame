/**
 * DepositWithdraw Component
 * UI for depositing and withdrawing TRX from the game contract
 */

import React, { useState } from 'react';
import { useTron } from '../../context/tron/TronContext';
import { depositTrx, withdrawTrx, formatTrx, parseTrx } from '../../utils/tronInteract';
import './DepositWithdraw.css';

const MIN_DEPOSIT = 10; // TRX
const MAX_DEPOSIT = 1000; // TRX

const DepositWithdraw = ({ onClose }) => {
  const {
    address,
    isConnected,
    trxWalletBalance,
    contractBalance,
    availableBalance,
    lockedBalance,
    refreshBalances,
    networkName
  } = useTron();

  const [activeTab, setActiveTab] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  const [error, setError] = useState(null);

  const handleDeposit = async () => {
    if (!isConnected || !amount) return;
    
    const amountNum = parseFloat(amount);
    
    if (amountNum < MIN_DEPOSIT) {
      setError(`Minimum deposit is ${MIN_DEPOSIT} TRX`);
      return;
    }
    
    if (amountNum > MAX_DEPOSIT) {
      setError(`Maximum deposit is ${MAX_DEPOSIT} TRX`);
      return;
    }
    
    if (amountNum > parseFloat(formatTrx(trxWalletBalance))) {
      setError('Insufficient wallet balance');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setTxStatus({ status: 'pending', message: 'Confirm transaction in TronLink...' });
    
    try {
      const sunAmount = parseTrx(amount);
      const tx = await depositTrx(sunAmount);
      
      setTxStatus({ 
        status: 'success', 
        message: 'Deposit successful!',
        txId: tx.txid || tx
      });
      
      // Refresh balances
      await refreshBalances();
      setAmount('');
      
    } catch (err) {
      console.error('Deposit error:', err);
      setError(err.message || 'Transaction failed');
      setTxStatus({ status: 'error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected || !amount) return;
    
    const amountNum = parseFloat(amount);
    const availableNum = parseFloat(formatTrx(availableBalance));
    
    if (amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (amountNum > availableNum) {
      setError(`Insufficient available balance. Available: ${availableNum.toFixed(2)} TRX`);
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setTxStatus({ status: 'pending', message: 'Confirm transaction in TronLink...' });
    
    try {
      const sunAmount = parseTrx(amount);
      const tx = await withdrawTrx(sunAmount);
      
      setTxStatus({ 
        status: 'success', 
        message: 'Withdrawal successful!',
        txId: tx.txid || tx
      });
      
      // Refresh balances
      await refreshBalances();
      setAmount('');
      
    } catch (err) {
      console.error('Withdraw error:', err);
      setError(err.message || 'Transaction failed');
      setTxStatus({ status: 'error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetAmount = (percentage) => {
    if (activeTab === 'deposit') {
      const max = Math.min(
        parseFloat(formatTrx(trxWalletBalance)),
        MAX_DEPOSIT
      );
      setAmount((max * percentage).toFixed(2));
    } else {
      const available = parseFloat(formatTrx(availableBalance));
      setAmount((available * percentage).toFixed(2));
    }
  };

  const resetState = () => {
    setAmount('');
    setError(null);
    setTxStatus(null);
  };

  return (
    <div className="deposit-withdraw-modal">
      <div className="dw-header">
        <h2>Manage Balance</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="dw-network">
        <span className="network-label">Network:</span>
        <span className="network-value">{networkName}</span>
      </div>
      
      <div className="dw-tabs">
        <button
          className={`tab ${activeTab === 'deposit' ? 'active' : ''}`}
          onClick={() => { setActiveTab('deposit'); resetState(); }}
        >
          Deposit
        </button>
        <button
          className={`tab ${activeTab === 'withdraw' ? 'active' : ''}`}
          onClick={() => { setActiveTab('withdraw'); resetState(); }}
        >
          Withdraw
        </button>
      </div>
      
      <div className="dw-balances">
        <div className="balance-item">
          <span className="label">Wallet Balance:</span>
          <span className="value">{formatTrx(trxWalletBalance)} TRX</span>
        </div>
        <div className="balance-item">
          <span className="label">Game Balance:</span>
          <span className="value">{formatTrx(contractBalance.balance)} TRX</span>
        </div>
        <div className="balance-item locked">
          <span className="label">Locked in Games:</span>
          <span className="value">{formatTrx(lockedBalance)} TRX</span>
        </div>
      </div>
      
      <div className="dw-input-section">
        <label>
          {activeTab === 'deposit' ? 'Deposit Amount (TRX)' : 'Withdraw Amount (TRX)'}
        </label>
        
        <div className="input-wrapper">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`Min: ${MIN_DEPOSIT}, Max: ${MAX_DEPOSIT}`}
            disabled={isProcessing}
          />
          <span className="suffix">TRX</span>
        </div>
        
        <div className="quick-amounts">
          <button onClick={() => handleSetAmount(0.25)}>25%</button>
          <button onClick={() => handleSetAmount(0.5)}>50%</button>
          <button onClick={() => handleSetAmount(0.75)}>75%</button>
          <button onClick={() => handleSetAmount(1)}>MAX</button>
        </div>
      </div>
      
      {error && (
        <div className="dw-error">
          {error}
        </div>
      )}
      
      {txStatus && (
        <div className={`dw-status ${txStatus.status}`}>
          <span className="status-icon">
            {txStatus.status === 'pending' && '⏳'}
            {txStatus.status === 'success' && '✅'}
            {txStatus.status === 'error' && '❌'}
          </span>
          <span className="status-message">{txStatus.message}</span>
          {txStatus.txId && (
            <a
              href={`https://nile.tronscan.org/#/transaction/${txStatus.txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              View Transaction
            </a>
          )}
        </div>
      )}
      
      <button
        className={`dw-action-btn ${activeTab}`}
        onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
        disabled={isProcessing || !amount}
      >
        {isProcessing ? (
          'Processing...'
        ) : activeTab === 'deposit' ? (
          `Deposit ${amount || '0'} TRX`
        ) : (
          `Withdraw ${amount || '0'} TRX`
        )}
      </button>
    </div>
  );
};

export default DepositWithdraw;
