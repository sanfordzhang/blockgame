import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTron } from '../../context/tron/TronContext';
import './AdminLogin.css';

/**
 * Admin Login Page - Requires TronLink connection and admin role
 */
const AdminLogin = () => {
  const { connect, isConnected, address, isAdmin, checkAdminRole } = useTron();
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleConnect = async () => {
    try {
      setError('');
      await connect();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerifyAdmin = async () => {
    try {
      const isAdminUser = await checkAdminRole();
      if (isAdminUser) {
        navigate('/admin/dashboard');
      } else {
        setError('Access denied. Your address is not authorized as admin.');
      }
    } catch (err) {
      setError('Failed to verify admin role: ' + err.message);
    }
  };

  // Auto-redirect if already admin
  React.useEffect(() => {
    if (isConnected && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isConnected, isAdmin, navigate]);

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <h1>Admin Portal</h1>
        <p className="admin-login-subtitle">Connect your admin wallet to continue</p>
        
        {error && <div className="admin-error">{error}</div>}
        
        {!isConnected ? (
          <button className="admin-connect-btn" onClick={handleConnect}>
            Connect TronLink
          </button>
        ) : (
          <div className="admin-connected">
            <div className="admin-address-display">
              <span>Connected:</span>
              <code>{address?.slice(0, 10)}...{address?.slice(-8)}</code>
            </div>
            <button className="admin-verify-btn" onClick={handleVerifyAdmin}>
              Verify Admin Access
            </button>
          </div>
        )}
        
        <div className="admin-login-footer">
          <p>Only authorized admin addresses can access this panel.</p>
          <p>Make sure you are connected to the correct network.</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
