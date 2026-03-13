import React, { useState, useEffect } from 'react';
import { useTron } from '../../context/tron/TronContext';
import './EmergencyControls.css';

/**
 * Emergency Controls - Pause/Unpause contract
 */
const EmergencyControls = () => {
  const { contract, address } = useTron();
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pauseHistory, setPauseHistory] = useState([]);

  useEffect(() => {
    fetchPauseState();
    fetchPauseHistory();
  }, [contract]);

  const fetchPauseState = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      const paused = await contract.paused().call();
      setIsPaused(paused);
    } catch (err) {
      console.error('Failed to fetch pause state:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPauseHistory = async () => {
    try {
      const response = await fetch('/api/admin/emergency/history');
      if (response.ok) {
        const data = await response.json();
        setPauseHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch pause history:', err);
    }
  };

  const handlePause = async () => {
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      const tx = await contract.pause().send({
        from: address,
        feeLimit: 100_000_000
      });
      
      setSuccess('Contract paused successfully');
      setIsPaused(true);
      fetchPauseHistory();
    } catch (err) {
      setError('Failed to pause contract: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpause = async () => {
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      
      const tx = await contract.unpause().send({
        from: address,
        feeLimit: 100_000_000
      });
      
      setSuccess('Contract unpaused successfully');
      setIsPaused(false);
      fetchPauseHistory();
    } catch (err) {
      setError('Failed to unpause contract: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <div className="emergency-controls">
      <h1>Emergency Controls</h1>
      
      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {success && <div className="admin-alert admin-alert-success">{success}</div>}
      
      <div className={`status-card ${isPaused ? 'status-paused' : 'status-active'}`}>
        <h2>Contract Status</h2>
        <p className="status-value">
          {isPaused ? '⚠️ PAUSED' : '✅ ACTIVE'}
        </p>
        <p className="status-description">
          {isPaused 
            ? 'All game operations are currently suspended. Players cannot deposit, withdraw, or join games.'
            : 'Contract is operating normally. All functions are available.'}
        </p>
      </div>
      
      <div className="controls-card">
        <h2>Emergency Actions</h2>
        
        {isPaused ? (
          <div className="control-group">
            <h3>Resume Operations</h3>
            <p>Unpause the contract to resume normal operations.</p>
            <button
              className="action-btn unpause-btn"
              onClick={handleUnpause}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Unpause Contract'}
            </button>
          </div>
        ) : (
          <div className="control-group">
            <h3>⚠️ Emergency Pause</h3>
            <p>
              Pausing will immediately suspend all contract operations.
              This should only be used in emergency situations.
            </p>
            <button
              className="action-btn pause-btn"
              onClick={handlePause}
              disabled={submitting}
            >
              {submitting ? 'Processing...' : 'Pause Contract'}
            </button>
          </div>
        )}
        
        <div className="warning-box">
          <h4>⚠️ Important Warning</h4>
          <ul>
            <li>Pausing will stop all deposits, withdrawals, and game operations</li>
            <li>Players will not be able to access their funds while paused</li>
            <li>All pause/unpause actions are logged and auditable</li>
            <li>Use this feature responsibly</li>
          </ul>
        </div>
      </div>
      
      <div className="history-card">
        <h2>Pause History</h2>
        
        {pauseHistory.length === 0 ? (
          <p className="no-history">No pause events recorded</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Initiated By</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {pauseHistory.map((item, index) => (
                <tr key={index}>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                  <td className={item.action === 'pause' ? 'action-pause' : 'action-unpause'}>
                    {item.action === 'pause' ? 'Paused' : 'Unpaused'}
                  </td>
                  <td className="truncate">{item.admin}</td>
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

export default EmergencyControls;
