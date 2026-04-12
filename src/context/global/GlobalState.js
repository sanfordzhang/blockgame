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

  // Clear chipsAmount when wallet address changes, preventing balance bleed between accounts
  const setWalletAddress = useCallback((addr) => {
    setWalletAddressRaw((prev) => {
      if (prev && addr && prev !== addr) {
        setChipsAmount(null);
      }
      return addr;
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
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export default GlobalState;
