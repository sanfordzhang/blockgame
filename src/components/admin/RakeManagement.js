import React, { useState, useEffect } from 'react';
import { useTron } from '../../context/tron/TronContext';
import './RakeManagement.css';

/**
 * Rake Rate Management - Adjust rake rate with time lock
 */
const RakeManagement = () => {
  const { contract, address } = useTron();
  const [currentRate, setCurrentRate] = useState(250);
  const [newRate, setNewRate] = useState(250);
  const [pendingRate, setPendingRate] = useState(null);
  const [timeLockEnd, setTimeLockEnd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const MIN_RATE = 100; // 1%
  const MAX_RATE = 1000; // 10%
  const MAX_CHANGE = 100; // 1% max single change

  useEffect(() => {
    fetchRakeInfo();
  }, [contract]);

  const fetchRakeInfo = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      const [rate, pending, lockEnd] = await Promise.all([
        contract.rakeRate().call(),
        contract.pendingRakeRate().call(),
        contract.rakeRateTimeLockEnd().call()
      ]);
      
      setCurrentRate(Number(rate));
      setNewRate(Number(rate));
      setPendingRate(Number(pending) || null);
      setTimeLockEnd(Number(lockEnd) || null);
    } catch (err) {
      console.error('Failed to fetch rake info:', err);
      setError('Failed to load rake rate info');
    } finally {
      setLoading(false);
    }
  };

  const validateRate = (rate) => {
    if (rate < MIN_RATE) return `Minimum rate is ${MIN_RATE / 100}%`;
    if (rate > MAX_RATE) return `Maximum rate is ${MAX_RATE / 100}%`;
    if (Math.abs(rate - currentRate) > MAX_CHANGE) {
      return `Maximum single change is ${MAX_CHANGE / 100}%`;
    }
    return null;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    
    const validationError = validateRate(newRate);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (newRate === currentRate) {
      setError('New rate must be different from current rate');
      return;
    }
    
    try {
      setSubmitting(true);
      
      const tx = await contract.setRakeRate(newRate).send({
        from: address,
        feeLimit: 100_000_000
      });
      
      setSuccess(`Rake rate change initiated. Transaction: ${tx}`);
      setPendingRate(newRate);
      setTimeLockEnd(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Refresh after delay
      setTimeout(fetchRakeInfo, 5000);
    } catch (err) {
      setError('Failed to submit rake rate change: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      
      const tx = await contract.confirmRakeRateChange().send({
        from: address,
        feeLimit: 100_000_000
      });
      
      setSuccess(`Rake rate change confirmed. Transaction: ${tx}`);
      setPendingRate(null);
      setTimeLockEnd(null);
      setCurrentRate(newRate);
      
      fetchRakeInfo();
    } catch (err) {
      setError('Failed to confirm rake rate change: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeRemaining = () => {
    if (!timeLockEnd) return null;
    
    const remaining = timeLockEnd - Date.now();
    if (remaining <= 0) return 'Ready to confirm';
    
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m remaining`;
  };

  if (loading) {
    return <div className="admin-loading">Loading rake management...</div>;
  }

  return (
    <div className="rake-management">
      <h1>Rake Rate Management</h1>
      
      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {success && <div className="admin-alert admin-alert-success">{success}</div>}
      
      <div className="rake-info-card">
        <h2>Current Rake Rate</h2>
        <p className="rake-current-value">{currentRate / 100}%</p>
      </div>
      
      {pendingRate && pendingRate !== currentRate && (
        <div className="rake-pending-card">
          <h3>Pending Rate Change</h3>
          <div className="rake-pending-info">
            <span>New Rate: <strong>{pendingRate / 100}%</strong></span>
            <span>Time Lock: <strong>{formatTimeRemaining()}</strong></span>
          </div>
          {timeLockEnd && timeLockEnd <= Date.now() && (
            <button 
              className="confirm-btn" 
              onClick={handleConfirm}
              disabled={submitting}
            >
              Confirm Rate Change
            </button>
          )}
        </div>
      )}
      
      <div className="rake-form-card">
        <h2>Adjust Rake Rate</h2>
        
        <div className="rake-slider-container">
          <input
            type="range"
            min={MIN_RATE}
            max={MAX_RATE}
            step={10}
            value={newRate}
            onChange={(e) => setNewRate(Number(e.target.value))}
            className="rake-slider"
          />
          <div className="rake-slider-labels">
            <span>1%</span>
            <span className="rake-slider-value">{newRate / 100}%</span>
            <span>10%</span>
          </div>
        </div>
        
        <div className="rake-input-container">
          <label>Exact Value (basis points):</label>
          <input
            type="number"
            min={MIN_RATE}
            max={MAX_RATE}
            value={newRate}
            onChange={(e) => setNewRate(Number(e.target.value))}
            className="rake-input"
          />
        </div>
        
        <div className="rake-change-info">
          <span>Change: </span>
          <span className={newRate > currentRate ? 'rate-increase' : 'rate-decrease'}>
            {newRate > currentRate ? '+' : ''}{(newRate - currentRate) / 100}%
          </span>
        </div>
        
        <button 
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting || newRate === currentRate}
        >
          {submitting ? 'Submitting...' : 'Request Rate Change'}
        </button>
        
        <p className="rake-notice">
          ⏰ Rate changes require 24-hour time lock before confirmation.
          Maximum single change: 1%
        </p>
      </div>
    </div>
  );
};

export default RakeManagement;
