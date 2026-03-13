/**
 * GameModeSwitch Component
 * Toggle between Fun Mode (testnet) and Real Mode (mainnet)
 */

import React from 'react';
import { useTron } from '../../context/tron/TronContext';
import './GameModeSwitch.css';

const GameModeSwitch = () => {
  const { gameMode, switchGameMode, isConnected } = useTron();

  const handleModeChange = (mode) => {
    if (mode !== gameMode) {
      switchGameMode(mode);
    }
  };

  return (
    <div className="game-mode-switch">
      <div className="mode-labels">
        <span 
          className={`mode-label ${gameMode === 'fun' ? 'active' : ''}`}
          onClick={() => handleModeChange('fun')}
        >
          🎮 Fun Mode
        </span>
        <span 
          className={`mode-label ${gameMode === 'real' ? 'active' : ''}`}
          onClick={() => handleModeChange('real')}
        >
          💰 Real Mode
        </span>
      </div>
      
      <div className="mode-toggle">
        <button
          className={`toggle-btn fun ${gameMode === 'fun' ? 'active' : ''}`}
          onClick={() => handleModeChange('fun')}
        >
          Fun
        </button>
        <button
          className={`toggle-btn real ${gameMode === 'real' ? 'active' : ''}`}
          onClick={() => handleModeChange('real')}
        >
          Real
        </button>
      </div>
      
      <div className="mode-info">
        {gameMode === 'fun' ? (
          <div className="info-fun">
            <p className="info-text">
              🧪 Playing with Testnet TRX (no real value)
            </p>
            <a 
              href="https://nileex.io/join/getJoinPage"
              target="_blank"
              rel="noopener noreferrer"
              className="faucet-link"
            >
              Get Free Testnet TRX →
            </a>
          </div>
        ) : (
          <div className="info-real">
            <p className="info-text warning">
              ⚠️ Playing with Real TRX - Real money at stake!
            </p>
            <p className="info-subtext">
              Make sure you understand the risks involved
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameModeSwitch;
