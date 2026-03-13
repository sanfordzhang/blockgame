import React, { useState, useEffect } from 'react';
import { useTron } from '../../context/tron/TronContext';
import './AdminDashboard.css';

/**
 * Admin Dashboard - Shows operational statistics
 */
const AdminDashboard = () => {
  const { contract } = useTron();
  const [stats, setStats] = useState({
    totalDeposited: 0,
    totalWithdrawn: 0,
    totalRakeCollected: 0,
    pendingRake: 0,
    activePlayers: 0,
    gamesPlayed: 0,
    contractBalance: 0,
    rakeRate: 250,
    isPaused: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [contract]);

  const fetchStats = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      
      // Fetch contract state
      const [rakeRate, isPaused, contractBalance, pendingRake] = await Promise.all([
        contract.rakeRate().call(),
        contract.paused().call(),
        contract.getContractBalance().call(),
        contract.pendingRake().call()
      ]);
      
      setStats(prev => ({
        ...prev,
        rakeRate: Number(rakeRate) / 100,
        isPaused,
        contractBalance: Number(contractBalance) / 1e6,
        pendingRake: Number(pendingRake) / 1e6
      }));
      
      // Fetch server stats
      const response = await fetch('/api/admin/stats', {
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const serverStats = await response.json();
        setStats(prev => ({
          ...prev,
          ...serverStats
        }));
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTRX = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TRX';
  };

  if (loading) {
    return <div className="admin-loading">Loading dashboard...</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>Dashboard</h1>
      
      {stats.isPaused && (
        <div className="admin-alert admin-alert-warning">
          ⚠️ Contract is currently PAUSED. All game operations are suspended.
        </div>
      )}
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Contract Balance</h3>
          <p className="stat-value">{formatTRX(stats.contractBalance)}</p>
        </div>
        
        <div className="stat-card">
          <h3>Current Rake Rate</h3>
          <p className="stat-value">{stats.rakeRate}%</p>
        </div>
        
        <div className="stat-card">
          <h3>Pending Rake</h3>
          <p className="stat-value">{formatTRX(stats.pendingRake)}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Rake Collected</h3>
          <p className="stat-value">{formatTRX(stats.totalRakeCollected)}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Deposited</h3>
          <p className="stat-value">{formatTRX(stats.totalDeposited)}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Withdrawn</h3>
          <p className="stat-value">{formatTRX(stats.totalWithdrawn)}</p>
        </div>
        
        <div className="stat-card">
          <h3>Active Players</h3>
          <p className="stat-value">{stats.activePlayers}</p>
        </div>
        
        <div className="stat-card">
          <h3>Games Played</h3>
          <p className="stat-value">{stats.gamesPlayed}</p>
        </div>
      </div>
      
      <div className="admin-actions">
        <button onClick={fetchStats} className="refresh-btn">
          Refresh Stats
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
