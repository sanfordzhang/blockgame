import React, { useState, useEffect } from 'react';
import { useTron } from '../../context/tron/TronContext';
import './RakeWithdraw.css';

/**
 * Rake Withdrawal - Withdraw accumulated rake
 */
const RakeWithdraw = () => {
  const { contract, address } = useTron();
  const [pendingRake, setPendingRake] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [withdrawHistory, setWithdrawHistory] = useState([]);

  useEffect(() => {
    fetchRakeInfo();
    fetchWithdrawHistory();
  }, [contract]);

  const fetchRakeInfo = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      const rake = await contract.pendingRake().call();
      setPendingRake(Number(rake) / 1e6);
      setWithdrawAddress(address || '');
    } catch (err) {
      console.error('Failed to fetch rake info:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawHistory = async () => {
    try {
      const response = await fetch('/api/admin/rake/history');
      if (response.ok) {
        const data = await response.json();
        setWithdrawHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch withdraw history:', err);
    }
  };

  const handleWithdrawAll = async () => {
    if (!withdrawAddress) {
      setError('Please enter a withdrawal address');
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      const tx = await contract.withdrawRake(
        withdrawAddress,
        Math.floor(pendingRake * 1e6)
      ).send({
        from: address,
        feeLimit: 100_000_000
      });
      
      setSuccess(`Withdrawal successful. Transaction: ${tx}`);
      setPendingRake(0);
      fetchWithdrawHistory();
    } catch (err) {
      setError('Withdrawal failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawPartial = async () => {
    const amount = parseFloat(withdrawAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    if (amount > pendingRake) {
      setError('Amount exceeds pending rake');
      return;
    }
    
    if (!withdrawAddress) {
      setError('Please enter a withdrawal address');
      return;
    }
    
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      const tx = await contract.withdrawRake(
        withdrawAddress,
        Math.floor(amount * 1e6)
      ).send({
        from: address,
        feeLimit: 100_000_000
      });
      
      setSuccess(`Withdrawal successful. Transaction: ${tx}`);
      setWithdrawAmount('');
      fetchRakeInfo();
      fetchWithdrawHistory();
    } catch (err) {
      setError('Withdrawal failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <div className="rake-withdraw">
      <h1>Withdraw Rake</h1>
      
      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {success && <div className="admin-alert admin-alert-success">{success}</div>}
      
      <div className="rake-balance-card">
        <h2>Pending Rake Available</h2>
        <p className="rake-balance-value">{pendingRake.toFixed(2)} TRX</p>
      </div>
      
      <div className="withdraw-form-card">
        <h2>Withdraw Rake</h2>
        
        <div className="form-group">
          <label>Recipient Address</label>
          <input
            type="text"
            value={withdrawAddress}
            onChange={(e) => setWithdrawAddress(e.target.value)}
            placeholder="TRX address to receive rake"
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label>Amount (TRX)</label>
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Leave empty to withdraw all"
            step="0.01"
            min="0"
            max={pendingRake}
            className="form-input"
          />
        </div>
        
        <div className="withdraw-actions">
          <button
            className="withdraw-btn withdraw-all"
            onClick={handleWithdrawAll}
            disabled={submitting || pendingRake === 0}
          >
            Withdraw All ({pendingRake.toFixed(2)} TRX)
          </button>
          
          <button
            className="withdraw-btn withdraw-partial"
            onClick={handleWithdrawPartial}
            disabled={submitting || !withdrawAmount}
          >
            Withdraw Partial
          </button>
        </div>
      </div>
      
      <div className="withdraw-history-card">
        <h2>Withdrawal History</h2>
        
        {withdrawHistory.length === 0 ? (
          <p className="no-history">No withdrawals yet</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Address</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {withdrawHistory.map((item, index) => (
                <tr key={index}>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                  <td>{item.amount} TRX</td>
                  <td className="truncate">{item.address}</td>
                  <td>
                    <a 
                      href={`https://tronscan.org/#/transaction/${item.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RakeWithdraw;
