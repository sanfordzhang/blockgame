import React, { useState, useCallback } from 'react';
import GlobalContext from './globalContext';

const GlobalState = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [id, setId] = useState(null);
  const [userName, setUserName] = useState(null);
  const [email, setEmail] = useState(null);
  const [chipsAmount, setChipsAmount] = useState(null);
  const [tables, setTables] = useState(null);
  const [players, setPlayers] = useState(null);
  const [walletAddress, setWalletAddressRaw] = useState('');
  // Track which chain the user connected with: 'tron' | 'zerog' | null
  const [walletType, setWalletTypeRaw] = useState(null);

  // Clear chipsAmount when wallet address changes, preventing balance bleed between accounts
  const setWalletAddress = useCallback((addr) => {
    setWalletAddressRaw((prev) => {
      if (prev && addr && prev !== addr) {
        setChipsAmount(null);
      }
      return addr;
    });
  }, []);

  // Set wallet type and clear chips on chain switch
  const setWalletType = useCallback((type) => {
    setWalletTypeRaw((prev) => {
      if (prev && type && prev !== type) {
        setChipsAmount(null);
      }
      return type;
    });
  }, []);

  return (
    <GlobalContext.Provider
      value={{
        isLoading,
        setIsLoading,
        userName,
        setUserName,
        email,
        setEmail,
        chipsAmount,
        setChipsAmount,
        id,
        setId,
        tables,
        setTables,
        players,
        setPlayers,
        walletAddress,
        setWalletAddress,
        walletType,
        setWalletType,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export default GlobalState;
