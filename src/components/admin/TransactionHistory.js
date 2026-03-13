import React, { useState, useEffect } from 'react';
import './TransactionHistory.css';

/**
 * Transaction History - View all blockchain transactions
 */
const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    fromBlock: '',
    toBlock: '',
    player: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, filters]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });
      
      const response = await fetch(`/api/admin/transactions?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setPagination(prev => ({ ...prev, total: data.total || 0 }));
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTypeLabel = (type) => {
    const types = {
      deposit: { label: 'Deposit', class: 'type-deposit' },
      withdraw: { label: 'Withdraw', class: 'type-withdraw' },
      join_table: { label: 'Join Table', class: 'type-game' },
      leave_table: { label: 'Leave Table', class: 'type-game' },
      settlement: { label: 'Settlement', class: 'type-settlement' },
      rake_withdraw: { label: 'Rake Withdraw', class: 'type-admin' },
      rake_rate_change: { label: 'Rake Rate', class: 'type-admin' },
      pause: { label: 'Pause', class: 'type-emergency' },
      unpause: { label: 'Unpause', class: 'type-emergency' }
    };
    return types[type] || { label: type, class: '' };
  };

  const getStatusLabel = (status) => {
    const statuses = {
      pending: { label: 'Pending', class: 'status-pending' },
      confirmed: { label: 'Confirmed', class: 'status-confirmed' },
      failed: { label: 'Failed', class: 'status-failed' }
    };
    return statuses[status] || { label: status, class: '' };
  };

  return (
    <div className="transaction-history">
      <h1>Transaction History</h1>
      
      <div className="filters-card">
        <div className="filter-row">
          <div className="filter-group">
            <label>Type</label>
            <select 
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="deposit">Deposits</option>
              <option value="withdraw">Withdrawals</option>
              <option value="join_table">Join Table</option>
              <option value="leave_table">Leave Table</option>
              <option value="settlement">Settlements</option>
              <option value="rake_withdraw">Rake Withdrawals</option>
              <option value="rake_rate_change">Rake Rate Changes</option>
              <option value="pause">Pause/Unpause</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Player Address</label>
            <input
              type="text"
              value={filters.player}
              onChange={(e) => handleFilterChange('player', e.target.value)}
              placeholder="Filter by address"
            />
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="admin-loading">Loading transactions...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Player</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => {
                  const typeInfo = getTypeLabel(tx.type);
                  const statusInfo = getStatusLabel(tx.status);
                  
                  return (
                    <tr key={index}>
                      <td>{formatDate(tx.timestamp)}</td>
                      <td>
                        <span className={`type-badge ${typeInfo.class}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="truncate">{tx.player}</td>
                      <td>
                        {tx.amount ? `${(tx.amount / 1e6).toFixed(2)} TRX` : '-'}
                      </td>
                      <td>
                        <span className={`status-badge ${statusInfo.class}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        <a 
                          href={`https://tronscan.org/#/transaction/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tx-link"
                        >
                          {tx.hash?.slice(0, 10)}...
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="pagination">
            <button
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
            </span>
            <button
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TransactionHistory;
