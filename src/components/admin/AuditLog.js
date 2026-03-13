import React, { useState, useEffect } from 'react';
import './AuditLog.css';

/**
 * Audit Log - View admin action history
 */
const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: 'all',
    admin: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0
  });

  useEffect(() => {
    fetchLogs();
  }, [pagination.page, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });
      
      const response = await fetch(`/api/admin/audit?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setPagination(prev => ({ ...prev, total: data.total || 0 }));
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
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

  const getActionIcon = (action) => {
    const icons = {
      rake_rate_change: '📊',
      rake_withdraw: '💰',
      pause: '⏸️',
      unpause: '▶️',
      emergency: '🚨',
      login: '🔐',
      logout: '👋'
    };
    return icons[action] || '📝';
  };

  const getSeverityClass = (action) => {
    const critical = ['pause', 'unpause', 'emergency'];
    const important = ['rake_rate_change', 'rake_withdraw'];
    
    if (critical.includes(action)) return 'severity-critical';
    if (important.includes(action)) return 'severity-important';
    return 'severity-normal';
  };

  return (
    <div className="audit-log">
      <h1>Audit Log</h1>
      
      <div className="filters-card">
        <div className="filter-row">
          <div className="filter-group">
            <label>Action Type</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="rake_rate_change">Rake Rate Changes</option>
              <option value="rake_withdraw">Rake Withdrawals</option>
              <option value="pause">Pause Events</option>
              <option value="unpause">Unpause Events</option>
              <option value="login">Logins</option>
              <option value="logout">Logouts</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label>Admin Address</label>
            <input
              type="text"
              value={filters.admin}
              onChange={(e) => handleFilterChange('admin', e.target.value)}
              placeholder="Filter by admin address"
            />
          </div>
          
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="admin-loading">Loading audit logs...</div>
      ) : (
        <>
          <div className="logs-container">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry ${getSeverityClass(log.action)}`}>
                <div className="log-icon">{getActionIcon(log.action)}</div>
                <div className="log-content">
                  <div className="log-header">
                    <span className="log-action">{log.action.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="log-timestamp">{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="log-details">
                    <div className="log-admin">
                      <strong>Admin:</strong> {log.admin}
                    </div>
                    {log.details && (
                      <div className="log-extra">
                        <strong>Details:</strong> {JSON.stringify(log.details)}
                      </div>
                    )}
                    {log.txHash && (
                      <div className="log-tx">
                        <strong>Transaction:</strong>{' '}
                        <a 
                          href={`https://tronscan.org/#/transaction/${log.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tx-link"
                        >
                          {log.txHash.slice(0, 16)}...
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

export default AuditLog;
