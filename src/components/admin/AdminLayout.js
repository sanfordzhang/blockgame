import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useTron } from '../../context/tron/TronContext';
import './AdminLayout.css';

/**
 * Admin Layout - Protects admin routes and provides navigation
 */
const AdminLayout = () => {
  const { address, isAdmin, isConnected } = useTron();

  // Redirect to login if not connected or not admin
  if (!isConnected || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <h1>Bridge Game Admin Panel</h1>
        <div className="admin-info">
          <span className="admin-address">{address?.slice(0, 8)}...{address?.slice(-6)}</span>
        </div>
      </header>
      
      <nav className="admin-nav">
        <a href="/admin/dashboard">Dashboard</a>
        <a href="/admin/rake">Rake Rate</a>
        <a href="/admin/withdraw">Withdraw Rake</a>
        <a href="/admin/emergency">Emergency</a>
        <a href="/admin/transactions">Transactions</a>
        <a href="/admin/audit">Audit Log</a>
      </nav>
      
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
