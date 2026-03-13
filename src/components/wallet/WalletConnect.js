/**
 * WalletConnect Component
 * Button and modal for connecting TronLink wallet
 */

import React, { useState } from 'react';
import { useTron } from '../../context/tron/TronContext';
import './WalletConnect.css';

const WalletConnect = () => {
  const {
    isConnected,
    isConnecting,
    isInstalled,
    address,
    formattedAddress,
    error,
    connect,
    disconnect,
    clearError
  } = useTron();

  const [showDropdown, setShowDropdown] = useState(false);

  const handleConnect = async () => {
    if (!isInstalled) {
      window.open('https://www.tronlink.org/', '_blank');
      return;
    }
    
    await connect();
  };

  if (!isConnected) {
    return (
      <div className="wallet-connect">
        {error && (
          <div className="wallet-error">
            <span>{error}</span>
            <button onClick={clearError}>×</button>
          </div>
        )}
        
        <button
          className={`connect-btn ${isConnecting ? 'connecting' : ''}`}
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <span className="loading">Connecting...</span>
          ) : !isInstalled ? (
            <>
              <span className="icon">📥</span>
              <span>Install TronLink</span>
            </>
          ) : (
            <>
              <span className="icon">🔗</span>
              <span>Connect Wallet</span>
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connected">
      <button
        className="address-btn"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <span className="status-dot connected"></span>
        <span className="address">{formattedAddress}</span>
        <span className="dropdown-icon">▼</span>
      </button>
      
      {showDropdown && (
        <div className="wallet-dropdown">
          <div className="dropdown-item address-full">
            <span className="label">Address:</span>
            <span className="value">{address}</span>
          </div>
          
          <div className="dropdown-divider"></div>
          
          <button
            className="dropdown-item action"
            onClick={() => {
              navigator.clipboard.writeText(address);
              setShowDropdown(false);
            }}
          >
            📋 Copy Address
          </button>
          
          <a
            href={`https://nile.tronscan.org/#/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="dropdown-item action"
          >
            🔍 View on TronScan
          </a>
          
          <div className="dropdown-divider"></div>
          
          <button
            className="dropdown-item action disconnect"
            onClick={() => {
              disconnect();
              setShowDropdown(false);
            }}
          >
            ⚠️ Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
