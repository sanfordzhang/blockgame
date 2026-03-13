/**
 * WalletConnect Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletConnect } from '../../src/components/wallet';
import { TronProvider } from '../../src/context/tron/TronContext';

// Mock TronContext
const mockTronContext = {
  address: null,
  balance: 0,
  isConnected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  chainId: null,
  isFunMode: true
};

jest.mock('../../src/context/tron/TronContext', () => ({
  useTron: () => mockTronContext,
  TronProvider: ({ children }) => <div>{children}</div>
}));

describe('WalletConnect Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should render connect button when not connected', () => {
    mockTronContext.isConnected = false;
    render(<WalletConnect />);
    
    expect(screen.getByText('Connect TronLink')).toBeInTheDocument();
  });
  
  it('should show address when connected', () => {
    mockTronContext.isConnected = true;
    mockTronContext.address = 'TRX1234567890abcdef1234567890abcdef1234';
    
    render(<WalletConnect />);
    
    expect(screen.getByText(/TRX12345...1234/)).toBeInTheDocument();
  });
  
  it('should call connect when button clicked', async () => {
    mockTronContext.isConnected = false;
    render(<WalletConnect />);
    
    fireEvent.click(screen.getByText('Connect TronLink'));
    
    expect(mockTronContext.connect).toHaveBeenCalled();
  });
  
  it('should show balance when connected', async () => {
    mockTronContext.isConnected = true;
    mockTronContext.balance = 100.5;
    mockTronContext.address = 'TRX1234567890abcdef1234567890abcdef1234';
    
    render(<WalletConnect />);
    
    expect(screen.getByText('100.50 TRX')).toBeInTheDocument();
  });
  
  it('should show mode indicator', () => {
    mockTronContext.isConnected = true;
    mockTronContext.isFunMode = true;
    mockTronContext.address = 'TRX1234567890abcdef1234567890abcdef1234';
    
    render(<WalletConnect />);
    
    expect(screen.getByText('Fun Mode')).toBeInTheDocument();
  });
});
