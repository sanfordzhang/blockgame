import React, { useContext, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import CenteredBlock from '../components/layout/CenteredBlock';
import Heading from '../components/typography/Heading';
import Button from '../components/buttons/Button';
import Hider from '../components/layout/Hider';
import styled from 'styled-components';
import useScrollToTopOnPageLoad from '../hooks/useScrollToTopOnPageLoad';
import { preloadGameAssets, emergencyPreload } from '../utils/gamePreload';
import Markdown from 'react-remarkable';
import globalContext from '../context/global/globalContext';
import socketContext from '../context/websocket/socketContext';
import locaContext from '../context/localization/locaContext';
import { CS_FETCH_LOBBY_INFO, CS_CHECK_DELEGATE, SC_DELEGATE_STATUS } from '../pokergame/actions';
import {
  isTronLinkInstalled,
  connectTronLink,
  isPlayerRegistered,
  registerPlayer,
  formatAddress,
  getPlayerBalance,
  depositTrx,
  withdrawTrx,
  getTrxBalance,
  formatTrx,
  parseTrx,
  tryUnlockLockedBalance,
  setDelegate,
  revokeDelegate,
  isAuthorizedDelegate,
  getPlayerDelegate,
  getContractAddress
} from '../utils/tronInteract';
import { buildApiUrl } from '../utils/serverConfig';

// Static import illustrations for reliable loading
import illustrationMobile from '../assets/img/main-illustration-mobile@2x.png';
import illustrationDesktop from '../assets/img/main-illustration-desktop@2x.png';

const loadZeroG = () => import('../utils/zeroGInteract');
const loadEthers = () => import('ethers');

const normalizeBalanceValue = (val) => {
  if (!val) return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (!isFinite(num)) return '0';
  if (num > 10000 && !(num > 0 && num < 10)) {
    return (num / 1e18).toString();
  }
  return num.toString();
};

const formatTokenAmount = (amount, maxDecimals = 6) => {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value.toFixed(maxDecimals).replace(/\.?0+$/, '');
};

const connectMetamaskFallback = async () => {
  if (window.ethereum) {
    try {
      const addressArr = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      return { event: 'connected', response: addressArr[0] };
    } catch (err) {
      console.log(err.message);
      return { event: 'error', response: err.message };
    }
  }

  console.log('plz install metamask on your browser');
  return { event: 'No Wallet', response: 'plz install metamask on your browser' };
};

const MarketingHeadline = styled(Heading)`
  @media screen and (min-width: 1024px) {
    margin-bottom: 3rem;
  }
`;

const Landing = () => {
  const { setWalletAddress, setChipsAmount, setWalletType, chipsAmount } = useContext(globalContext);
  const { socket } = useContext(socketContext);
  const { t } = useContext(locaContext);
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [walletAddress, setLocalWalletAddress] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [tronLinkInstalled, setTronLinkInstalled] = useState(true);
  const [contractBalance, setContractBalanceRaw] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [walletBalance, setWalletBalanceRaw] = useState(0);
  const holdUntilRef = useRef(0); // optimistic hold: skip wallet balance updates until this timestamp

  // Wrapper: update contractBalance AND sync to Navbar chipsAmount (right-top corner)
  const setContractBalance = useCallback((val) => {
    if (typeof val === 'function') {
      setContractBalanceRaw(prev => {
        const next = val(prev);
        setChipsAmount(next);
        return next;
      });
    } else {
      setContractBalanceRaw(val);
      setChipsAmount(val);
    }
  }, [setChipsAmount]);

  // Wrapper: skip if optimistic hold is active
  const setWalletBalance = useCallback((val) => {
    if (Date.now() < holdUntilRef.current) {
      console.log('[Landing] Skipping wallet balance update (optimistic hold active)');
      return;
    }
    setWalletBalanceRaw(val);
  }, []);

  // Force update regardless of hold
  const setWalletBalanceForce = useCallback((val) => {
    setWalletBalanceRaw(val);
  }, []);

  const holdWalletBalance = useCallback((ms = 20000) => {
    holdUntilRef.current = Date.now() + ms;
  }, []);
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // Delegate (Server Proxy) state
  const [delegateAuthorized, setDelegateAuthorized] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [serverAddress, setServerAddress] = useState(null);
  // 0G/EVM server wallet address (separate from TRON address for dual-chain)
  const [zeroGServerAddress, setZeroGServerAddress] = useState(null);
  // Track which wallet type is connected: 'tron' | 'zerog' | null
  const [localWalletType, setLocalWalletType] = useState(null);

  const applyZeroGGameBalance = useCallback((info, source = 'zerog') => {
    const available = parseFloat(normalizeBalanceValue(info?.balance || info?.available || '0')) || 0;
    const locked = parseFloat(normalizeBalanceValue(info?.locked || '0')) || 0;
    const total = available + locked;
    setContractBalanceRaw(available);
    setLockedBalance(locked);
    setChipsAmount(total);
    console.log('[Landing] 0G game balance:', { source, available, locked, total });
    return { available, locked, total };
  }, [setChipsAmount]);

  // Calculate balances
  // contractBalance = balance (available in contract)
  // lockedBalance = lockedAmount (in game)
  // gameBalance = total funds in contract (available + locked)
  // bankroll = available balance for games/withdraw
  const gameBalance = contractBalance + lockedBalance;
  const bankroll = contractBalance;
  const isZeroGWallet = localWalletType === 'zerog' || walletAddress?.toLowerCase?.().startsWith('0x');

  useScrollToTopOnPageLoad();

  // Check wallet installation on mount (passive detection only - NO connection requests)
  useEffect(() => {
    const checkWallets = async () => {
      // Delay to let page render first
      await new Promise(r => setTimeout(r, 500));

      // Passively check if wallets are installed (without triggering any popup)
      const tronReady = !!(window.tronLink || window.tronWeb);
      setTronLinkInstalled(tronReady);

      // === Auto-restore 0G connection from localStorage ===
      try {
        const savedType = localStorage.getItem('wallet_type');
        const savedAddress = localStorage.getItem('wallet_address');
        
        console.log('[Landing-RESTORE] Check:', { savedType, savedAddress, hasEthereum: !!window.ethereum });

        if (savedType === 'zerog' && savedAddress && window.ethereum) {
          console.log('[Landing-RESTORE] Entering 0G restore branch...');
          console.log('[Landing] Restoring 0G connection from localStorage:', savedAddress);

          // Silently verify session is still valid (eth_accounts does NOT trigger popup)
          try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });

            if (!accounts || accounts.length === 0) {
              // eth_accounts returned empty — MetaMask is locked or not authorized.
              // Must clear state so user stays on landing page and must re-connect.
              console.log('[Landing-RESTORE] eth_accounts empty (wallet locked?), clearing stale wallet state');
              localStorage.removeItem('wallet_type');
              localStorage.removeItem('wallet_address');
              setLocalWalletAddress('');
              setWalletAddress('');
              setLocalWalletType('');
              setWalletType('');
            } else if (accounts[0].toLowerCase() === savedAddress.toLowerCase()) {
              setLocalWalletAddress(savedAddress);
              setWalletAddress(savedAddress);
              setLocalWalletType('zerog');
              setWalletType('zerog');
              console.log('[Landing-RESTORE] 0G connection restored successfully (verified)');
            } else {
              // A DIFFERENT address is now active — stale data, clear it
              console.log('[Landing-RESTORE] Address changed, clearing. Got:', accounts[0], 'Expected:', savedAddress);
              localStorage.removeItem('wallet_type');
              localStorage.removeItem('wallet_address');
            }
          } catch (verifyErr) {
            console.warn('[Landing] Failed to verify 0G session:', verifyErr.message);
          }
        } else if (savedType === 'tron' && savedAddress) {
          // TRON: verify TronLink is still connected before restoring (aligns with 0G eth_accounts check)
          try {
            const tronReady = window.tronLink && window.tronLink.ready;
            const tronWeb = window.tronWeb || window.tronLink?.tronWeb;
            if (!tronReady || !tronWeb) {
              console.log('[Landing-RESTORE] TronLink not ready/installed, clearing stale TRON wallet state');
              localStorage.removeItem('wallet_type');
              localStorage.removeItem('wallet_address');
              setLocalWalletAddress('');
              setWalletAddress('');
              setLocalWalletType('');
              setWalletType('');
            } else {
              const currentAddress = tronWeb.defaultAddress
                ? tronWeb.defaultAddress.base58
                : null;
              if (!currentAddress || currentAddress.toLowerCase() !== savedAddress.toLowerCase()) {
                console.log('[Landing-RESTORE] TronLink address mismatch or disconnected, clearing stale state. Current:', currentAddress, 'Expected:', savedAddress);
                localStorage.removeItem('wallet_type');
                localStorage.removeItem('wallet_address');
                setLocalWalletAddress('');
                setWalletAddress('');
                setLocalWalletType('');
                setWalletType('');
              } else {
                setLocalWalletAddress(savedAddress);
                setWalletAddress(savedAddress);
                setLocalWalletType('tron');
                setWalletType('tron');
                console.log('[Landing] TRON connection restored from localStorage (verified)');
              }
            }
          } catch (tronVerifyErr) {
            console.warn('[Landing-RESTORE] Failed to verify TRON session:', tronVerifyErr.message);
            localStorage.removeItem('wallet_type');
            localStorage.removeItem('wallet_address');
          }
        }
      } catch (e) {
        console.warn('[Landing] Failed to restore wallet:', e.message);
      }
    };

    checkWallets();
  }, []);

  // Preload game assets after the first paint so entering the game does not
  // fetch card/table resources for the first time on the game screen.
  // Uses a two-stage approach:
  //   Stage 1: Wait briefly for Landing UI to render
  //   Stage 2: Use requestIdleCallback to prefetch at lowest priority
  useEffect(() => {
    const startPreload = () => {
      console.log('[Landing] Starting game asset prefetch...');
      
      if ('requestIdleCallback' in window) {
        requestIdleCallback(
          () => preloadGameAssets(),
          { timeout: 2500 }
        );
      } else {
        setTimeout(() => preloadGameAssets(), 500);
      }
    };

    const timer = setTimeout(startPreload, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Check registration status and balances when wallet address changes
  useEffect(() => {
    const checkRegistration = async () => {
      if (walletAddress) {
        try {
          // For 0G/EVM mode, skip TRON-specific checks (registration handled differently)
          // Check both localWalletType state AND address format (0x = EVM) for race condition safety
          const isEvmAddress = walletAddress.toLowerCase().startsWith('0x');
          if (localWalletType === 'zerog' || isEvmAddress) {
            const { getBalance: get0GBalance } = await loadZeroG();
            const bal = await get0GBalance(walletAddress);
            setIsRegistered(true);
            setWalletBalance(parseFloat(bal));

            // Fetch 0G game balance from PokerGame0G contract (custody + active-table locked)
            try {
              const { getGameBalance } = await loadZeroG();
              const gameBal = await getGameBalance(walletAddress);
              applyZeroGGameBalance(gameBal, 'checkReg');
            } catch (e) {
              console.warn('[Landing] Failed to fetch 0G game balance:', e.message);
            }
            return;
          }

          const registered = await isPlayerRegistered(walletAddress);
          setIsRegistered(registered);

          // Get balances
          if (registered) {
            const balance = await getPlayerBalance(walletAddress);
            setContractBalance(balance.balance);
            setLockedBalance(balance.locked || 0);
          }

          const trxBalance = await getTrxBalance(walletAddress);
          setWalletBalance(trxBalance);
        } catch (err) {
          console.error('Error checking registration:', err);
        }
      }
    };
    checkRegistration();
  }, [walletAddress, localWalletType, applyZeroGGameBalance]);

  // Sync contractBalance from GlobalState.chipsAmount when returning from game
  // GameState.js updates chipsAmount via SC_BALANCE_SYNCED during gameplay
  // This ensures Landing always shows the latest balance after games end
  useEffect(() => {
    if (chipsAmount !== null && chipsAmount !== undefined) {
      if (localWalletType === 'zerog' && walletAddress) {
        loadZeroG()
          .then(({ getGameBalance }) => getGameBalance(walletAddress))
          .then(gameBal => applyZeroGGameBalance(gameBal, 'chips-sync'))
          .catch(() => {});
        return;
      }
      const normalized = parseFloat(normalizeBalanceValue(chipsAmount));
      console.log('[Landing] Syncing contractBalance from chipsAmount:', { chipsAmount, normalized, current: contractBalance });
      setContractBalance(normalized);
    }
  }, [chipsAmount, localWalletType, walletAddress, applyZeroGGameBalance]);

  // On mount and when wallet changes, ALWAYS re-fetch 0G game balance from contract
  // This ensures the most accurate balance is shown (not relying solely on socket sync)
  useEffect(() => {
    if (walletAddress && localWalletType === 'zerog' && isRegistered) {
      loadZeroG()
        .then(({ getGameBalance }) => getGameBalance(walletAddress))
        .then(gameBal => applyZeroGGameBalance(gameBal, 'fresh'))
        .catch(() => {});
    }
  }, [walletAddress, localWalletType, isRegistered, applyZeroGGameBalance]);

  // Update default deposit amount based on chain type
  useEffect(() => {
    if (localWalletType === 'zerog') {
      setDepositAmount('0.1'); // ⚠️ TESTNET: faucet limit=0.1/day → PRODUCTION: change back to ~60 (market rate)
    } else {
      setDepositAmount('100');
    }
  }, [localWalletType]);

  // === Listen for external wallet disconnection (MetaMask lock/switch/disconnect) ===
  useEffect(() => {
    if (!window.ethereum || localWalletType !== 'zerog') return;

    const handleAccountsChanged = (accounts) => {
      console.log('[Landing] accountsChanged event:', accounts);

      if (!accounts || accounts.length === 0) {
        // User disconnected in MetaMask / locked wallet
        console.log('[Landing] Wallet disconnected externally');
        localStorage.removeItem('wallet_type');
        localStorage.removeItem('wallet_address');
        setLocalWalletAddress(null);
        setWalletAddress(null);
        setLocalWalletType(null);
        setWalletType(null);
        setIsRegistered(false);
        setContractBalance(0);
        setLockedBalance(0);
        setWalletBalanceRaw(0);
        loadZeroG().then(({ disconnectWallet }) => disconnectWallet()).catch(() => {});
      } else if (accounts[0].toLowerCase() !== walletAddress?.toLowerCase()) {
        // User switched to a different account
        console.log('[Landing] Account switched:', accounts[0]);
        localStorage.setItem('wallet_address', accounts[0]);
        setLocalWalletAddress(accounts[0]);
        setWalletAddress(accounts[0]);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      try {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      } catch (_) { /* ignore cleanup errors */ }
    };
  }, [localWalletType, walletAddress]);

  // Fetch server address on mount (don't wait for socket)
  useEffect(() => {
    const fetchServerAddress = async () => {
      try {
        const response = await fetch('/api/blockchain/config');
        const data = await response.json();
        if (data.serverWalletAddress) {
          setServerAddress(data.serverWalletAddress);
          console.log('[Landing] Server address from API:', data.serverWalletAddress);
        }
        if (data.zeroGServerWalletAddress) {
          setZeroGServerAddress(data.zeroGServerWalletAddress);
          console.log('[Landing] 0G Server address from API:', data.zeroGServerWalletAddress);
        }
      } catch (err) {
        console.error('[Landing] Failed to fetch server address:', err);
      }
    };
    fetchServerAddress();
  }, []);

  // Sync balance on landing page: emit CS_FETCH_LOBBY_INFO when socket+wallet are both ready
  useEffect(() => {
    if (socket && socket.connected && walletAddress) {
      const username = walletAddress.slice(0, 8);
      socket.emit(CS_FETCH_LOBBY_INFO, {
        walletAddress,
        socketId: socket.id,
        gameId: '1',
        username,
      });
    }
  }, [socket, walletAddress]);

  // Check delegate authorization when socket is connected and player is registered
  useEffect(() => {
    if (socket && socket.connected && walletAddress && isRegistered) {
      // Listen for delegate status from server
      const handleDelegateStatus = (data) => {
        console.log('[Landing] SC_DELEGATE_STATUS:', data);
        if (data.serverAddress) {
          setServerAddress(data.serverAddress);
        }
        if (data.zeroGServerAddress) {
          setZeroGServerAddress(data.zeroGServerAddress);
          console.log('[Landing] 0G server address received:', data.zeroGServerAddress);
        }
        setDelegateAuthorized(data.isAuthorized);
      };
      
      socket.on(SC_DELEGATE_STATUS, handleDelegateStatus);
      
      // Request delegate status from server (pass walletAddress for Landing page)
      socket.emit(CS_CHECK_DELEGATE, { walletAddress });
      
      return () => {
        socket.off(SC_DELEGATE_STATUS, handleDelegateStatus);
      };
    }
  }, [socket, walletAddress, isRegistered]);

  // Refresh all balances
  const refreshAllBalances = async () => {
    if (!walletAddress) return;
    
    setRefreshing(true);
    try {
      // For 0G/EVM mode, use 0G balance
      if (localWalletType === 'zerog') {
        const { getBalance: get0GBalance } = await loadZeroG();
            const bal = await get0GBalance(walletAddress);
        setWalletBalance(parseFloat(bal));

        // Also fetch game balance from PokerGame0G contract
        if (isRegistered) {
          try {
            const { getGameBalance } = await loadZeroG();
              const gameBal = await getGameBalance(walletAddress);
            applyZeroGGameBalance(gameBal, 'refresh');
          } catch (e) {
            console.warn('[Landing] Failed to fetch 0G game balance:', e.message);
          }
        }
      } else {
        // Get wallet TRX balance
        const trxBalance = await getTrxBalance(walletAddress);
        setWalletBalance(trxBalance);
        
        // Get game balance (if registered)
        if (isRegistered) {
          const balance = await getPlayerBalance(walletAddress);
          setContractBalance(balance.balance);
          setLockedBalance(balance.locked || 0);
        }
      }
    } catch (err) {
      console.error('Error refreshing balances:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleConnectWallet = async () => {
    setConnecting(true);
    setError(null);

    try {
      // Try TronLink first
      if (isTronLinkInstalled()) {
        const result = await connectTronLink();
        
        if (result.success) {
          const address = result.address;
          setLocalWalletAddress(address);
          setWalletAddress(address);
          setLocalWalletType('tron');
          setWalletType('tron'); // global for Navbar

          // Persist connection state so it survives page refresh
          localStorage.setItem('wallet_type', 'tron');
          localStorage.setItem('wallet_address', address);
          
          // Check if registered (don't auto-redirect, let user see the status)
          const registered = await isPlayerRegistered(address);
          setIsRegistered(registered);
          // User stays on Landing page to see registration/deposit options
        } else {
        setError(result.error || t('errConnectTronLink'));
        }
      } else {
        // Fallback to MetaMask
        const result = await connectMetamaskFallback();

        if (result?.event === 'connected') {
          const address = result.response;
          setLocalWalletAddress(address);
          setWalletAddress(address);
          proceedToHomepage(address);
        } else if (result?.event === 'No Wallet') {
          setError(t('errInstallWallet'));
          setTronLinkInstalled(false);
        } else if (result?.event === 'Wrong Chain') {
          setError(t('errWrongNetwork'));
        }
      }
    } catch (err) {
      setError(err.message || t('errConnectWallet'));
    } finally {
      setConnecting(false);
    }
  };

  const handleRegister = async () => {
    // Check TronLink first
    if (!isTronLinkInstalled()) {
      setError('Please install TronLink wallet to register on blockchain.');
      setTronLinkInstalled(false);
      return;
    }

    setRegistering(true);
    setError(null);

    try {
      const tx = await registerPlayer();
      console.log('Registration tx:', tx);
      
      // Optimistic update - set registered immediately
      setIsRegistered(true);
      
      // Refresh balance in background (don't wait)
      getPlayerBalance(walletAddress).then(balance => {
        setContractBalance(balance.balance);
      }).catch(console.error);
      
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || t('errRegister'));
    } finally {
      setRegistering(false);
    }
  };

  // Deposit handler (supports both TRON and 0G)
  const handleDeposit = async () => {
    setDepositing(true);
    setError(null);

    try {
      if (localWalletType === 'zerog') {
        // ====== 0G Deposit Path ======
        // Ensure we're on the correct 0G chain (fixes "invalid chain id for signer" error)
        try { const { ensureCorrectChain } = await loadZeroG();
          await ensureCorrectChain('testnet'); } catch (chainErr) {
          setError(chainErr.message);
          setDepositing(false);
          return;
        }

        const amountEth = parseFloat(depositAmount);
        if (!amountEth || amountEth <= 0) {
          setError(t('errDepositAmount'));
          return;
        }
        
        console.log('[Landing] Depositing', amountEth, '0G to contract...');
        const { getPokerGame0GAddress } = await loadZeroG();
        const POKERGAME_0G_ADDRESS = getPokerGame0GAddress();
        const DEPOSIT_ABI = ['function deposit() payable'];
        const { ethers } = await loadEthers();
        const valueWei = ethers.utils.parseEther(depositAmount).toHexString();
        
        const txParams = {
          from: walletAddress,
          to: POKERGAME_0G_ADDRESS,
          data: new ethers.utils.Interface(DEPOSIT_ABI).encodeFunctionData('deposit'),
          value: valueWei
        };
        
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams]
        });
        console.log('[Landing] 0G deposit tx:', txHash);
        
        holdWalletBalance(60000);
        // For 0G: store contract balance in same 0G token units (not SUN)
        // amountEth is already in 0G tokens, add directly
        setContractBalance(prev => prev + amountEth);
        setWalletBalanceForce(prev => Math.max(0, prev - amountEth));
      } else {
        // ====== TRON Deposit Path ======
        const amount = parseTrx(depositAmount);
        if (amount <= 0) {
          setError(t('errDepositAmount'));
          return;
        }

        console.log('Depositing', amount, 'SUN');
        const tx = await depositTrx(amount);
        console.log('Deposit tx:', tx);

        holdWalletBalance(60000);
        setContractBalance(prev => prev + amount);
        setWalletBalanceForce(prev => Math.max(0, prev - amount));
      }

      // Poll balance until confirmed
      const prevContractBalance = contractBalance;
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          if (localWalletType === 'zerog') {
            const { getBalance: get0GBalance } = await loadZeroG();
            const bal = await get0GBalance(walletAddress);
            setWalletBalance(parseFloat(bal));
            const { getGameBalance } = await loadZeroG();
              const gameBal = await getGameBalance(walletAddress);
            applyZeroGGameBalance(gameBal, 'deposit-poll');
          } else {
            const balance = await getPlayerBalance(walletAddress);
            setContractBalance(balance.balance);
            setLockedBalance(balance.locked || 0);
          }
          if (attempts >= 15) return;
        } catch (e) { console.error('Balance poll error:', e); }
        setTimeout(poll, 3000);
      };
      setTimeout(poll, 3000);
      
    } catch (err) {
      console.error('Deposit error:', err);
      if (localWalletType === 'zerog') {
        const errMsg = err.message || '';
        if (errMsg.includes('rejected') || errMsg.includes('4001')) {
          setError('Deposit rejected by user');
        } else if (errMsg.includes('insufficient funds')) {
          setError('Insufficient 0G balance');
        } else {
          setError(`0G Deposit failed: ${errMsg}`);
        }
      } else {
        setError(err.message || t('errDepositFailed'));
      }
    } finally {
      setDepositing(false);
    }
  };

  // Withdraw handler
  const handleWithdraw = async () => {
    if (!bankroll || bankroll <= 0) {
      setError(t('errNoBalance'));
      return;
    }

    const isZeroG = isZeroGWallet;

    // Check if there's locked balance
    if (!isZeroG && lockedBalance > 0) {
      setError(t('errLockedInGame')(formatTrx(lockedBalance)));
      return;
    }

    setWithdrawing(true);
    setError(null);

    try {
      let amount = bankroll; // Withdraw all available balance

      // === 0G Withdraw Path ===
      if (isZeroG) {
        if (amount <= 0) {
          setError(t('errNoBalance'));
          setWithdrawing(false);
          return;
        }
        console.log('Withdrawing', amount, '0G');
        const { withdrawFromContract } = await loadZeroG();
        const txHash = await withdrawFromContract(amount);
        console.log('0G Withdraw tx:', txHash);

        // Optimistic update (0G amount stays as-is)
        holdWalletBalance(60000);
        setContractBalance(0);
        setWalletBalanceForce(prev => prev + amount);

      // === TRON Withdraw Path ===
      } else {
        // Ensure amount is integer (TRX contract requires SUN as uint256)
        if (!Number.isInteger(amount)) {
          console.warn('[Landing] Non-integer bankroll, rounding down:', amount, '->', Math.floor(amount));
          amount = Math.floor(amount);
          if (amount <= 0) {
            setError(t('errNoBalance'));
            setWithdrawing(false);
            return;
          }
        }

        // Pre-flight: check contract balance >= withdraw amount
        try {
          const tronWeb = window.tronLink?.tronWeb || window.tronWeb;
          if (tronWeb) {
            const contractAddress = getContractAddress();
            const contractTrxBalance = await tronWeb.trx.getBalance(contractAddress);
            if (contractTrxBalance < amount) {
              setError(
                `Contract TRX insufficient (${formatTrx(contractTrxBalance)} TRX available). ` +
                `Please contact support — contract needs to be topped up.`
              );
              setWithdrawing(false);
              return;
            }
          }
        } catch (preflightErr) {
          console.warn('[Landing] Pre-flight balance check failed (non-fatal):', preflightErr.message);
        }

        console.log('Withdrawing', amount, 'SUN');
        const tx = await withdrawTrx(amount);
        console.log('Withdraw tx:', tx);

        // Optimistic update
        holdWalletBalance(60000);
        setContractBalance(0);
        setWalletBalanceForce(prev => prev + amount);
      }

      // Poll contract balance until confirmed (UI already shows correct value)
      const prevContractBalance = contractBalance;
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          if (isZeroG) {
            const { getGameBalance } = await loadZeroG();
            const gameBal = await getGameBalance(walletAddress);
            const { available } = applyZeroGGameBalance(gameBal, 'withdraw-poll');
            if (available < prevContractBalance || attempts >= 15) return;
          } else {
            const balance = await getPlayerBalance(walletAddress);
            setContractBalance(balance.balance);
            setLockedBalance(balance.locked || 0);
            if (balance.balance < prevContractBalance || attempts >= 15) return;
          }
        } catch (e) { console.error('Balance poll error:', e); }
        setTimeout(poll, 3000);
      };
      setTimeout(poll, 3000);

    } catch (err) {
      console.error('Withdraw error:', err);
      setError(err.message || t('errWithdrawFailed'));
    } finally {
      setWithdrawing(false);
    }
  };

  // Withdraw all (including locked - emergency withdraw)
  const handleWithdrawAll = async () => {
    const totalBalance = gameBalance; // Total game balance

    if (!totalBalance || totalBalance <= 0) {
      setError(t('errNoWithdrawBal'));
      return;
    }

    // If there's locked balance, show warning
    if (lockedBalance > 0) {
      const currency = localWalletType === 'zerog' ? '0G' : 'TRX';
      const confirmWithdrawAll = window.confirm(
        `You have ${formatTrx(lockedBalance)} ${currency} locked in an active game.\n` +
        `Withdrawing available balance ${formatTrx(bankroll)} ${currency} — locked balance will remain.\n` +
        `Continue?`
      );
      if (!confirmWithdrawAll) return;
    }

    setWithdrawing(true);
    setError(null);

    try {
      let amount = bankroll;
      const isZeroG = localWalletType === 'zerog';

      if (isZeroG) {
        if (amount <= 0) {
          setError(t('errNoWithdrawBal'));
          setWithdrawing(false);
          return;
        }
        console.log('Withdrawing all available:', amount, '0G');
        const { withdrawFromContract } = await loadZeroG();
        const txHash = await withdrawFromContract(amount);
        console.log('0G Withdraw tx:', txHash);
        setContractBalance(0);
      } else {
        if (!Number.isInteger(amount)) {
          console.warn('[Landing] Non-integer bankroll, rounding down:', amount, '->', Math.floor(amount));
          amount = Math.floor(amount);
          if (amount <= 0) {
            setError(t('errNoWithdrawBal'));
            setWithdrawing(false);
            return;
          }
        }
        console.log('Withdrawing all available:', amount, 'SUN');
        const tx = await withdrawTrx(amount);
        console.log('Withdraw tx:', tx);

        // Optimistic update - after withdraw, balance becomes 0 (locked remains)
        setContractBalance(0);
      }

      // Refresh actual balance in background
      setTimeout(async () => {
        try {
          const balance = await getPlayerBalance(walletAddress);
          setContractBalance(balance.balance);
          setLockedBalance(balance.locked || 0);
          const trxBalance = await getTrxBalance(walletAddress);
          setWalletBalance(trxBalance);
        } catch (e) {
          console.error('Balance refresh error:', e);
        }
      }, 5000);

    } catch (err) {
      console.error('Withdraw error:', err);
      setError(err.message || t('errWithdrawFailed'));
    } finally {
      setWithdrawing(false);
    }
  };

  // Handle unlock locked balance
  const handleUnlockLocked = async () => {
    if (!lockedBalance || lockedBalance <= 0) {
      setError(t('errNoLocked'));
      return;
    }

    setUnlocking(true);
    setError(null);

    try {
      let result;
      if (isZeroGWallet) {
        const lockedAmount = formatTokenAmount(lockedBalance, 18);

        console.log(`[Landing] Attempting to unlock ${lockedAmount} 0G via server...`);
        const response = await fetch(buildApiUrl('/api/0g/unlock'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || '0G unlock failed');
        }
        result = {
          success: true,
          tx: data.txHash,
          amountReturned: parseFloat(data.amountReturned || lockedAmount) || lockedBalance,
          balance: parseFloat(data.balance || '0') || 0,
          locked: parseFloat(data.locked || '0') || 0
        };
      } else {
        let stackToReturn = lockedBalance;
        if (!Number.isInteger(stackToReturn)) {
          console.warn('[Landing] Non-integer locked TRX balance, rounding down:', stackToReturn, '->', Math.floor(stackToReturn));
          stackToReturn = Math.floor(stackToReturn);
        }

        if (stackToReturn <= 0) {
          setError(t('errNoLocked'));
          setUnlocking(false);
          return;
        }

        console.log(`[Landing] Attempting to unlock ${stackToReturn} SUN (${stackToReturn / 1e6} TRX)...`);
        // Use leaveTableSession to unlock - works with PLAYING or FINISHED state
        result = await tryUnlockLockedBalance(1, stackToReturn);
      }
      console.log('Unlock result:', result);

      if (result.success) {
        // Update balances optimistically
        if (isZeroGWallet) {
          setContractBalance(result.balance);
          setLockedBalance(result.locked);
          setChipsAmount(result.balance + result.locked);
        } else {
          setContractBalance(prev => prev + result.amountReturned);
          setLockedBalance(0);
        }
        
        // Refresh actual balances after a short delay
        setTimeout(() => refreshAllBalances(), 3000);
      }
    } catch (err) {
      console.error('Unlock error:', err);
      // Show more helpful error message
      const errMsg = err.message || '';
      if (errMsg.includes('Player not in this table')) {
        setError('Unlock failed: You are not in that table. The tableId may differ — please try another method.');
      } else if (errMsg.includes('No locked funds')) {
        setError('No locked funds to unlock.');
        setLockedBalance(0);
      } else {
        setError(`Unlock failed: ${errMsg}`);
      }
    } finally {
      setUnlocking(false);
    }
  };

  // Handle delegate authorization (supports both TRON and 0G)
  const handleAuthorizeServer = async () => {
    const requiredServerAddress = localWalletType === 'zerog'
      ? (zeroGServerAddress || serverAddress)
      : serverAddress;

    if (!requiredServerAddress) {
      if (socket && socket.connected) {
        socket.emit(CS_CHECK_DELEGATE, { walletAddress });
        setError(t('errServerAddr'));
      } else {
        setError(t('errNoServerAddr'));
      }
      return;
    }

    setAuthorizing(true);
    setError(null);

    try {
      if (isZeroGWallet) {
        // ====== 0G Authorization Path ======
        // Ensure we're on the correct 0G chain
        try { const { ensureCorrectChain } = await loadZeroG();
          await ensureCorrectChain('testnet'); } catch (chainErr) {
          setError(chainErr.message);
          setAuthorizing(false);
          return;
        }

        console.log('[Landing] Authorizing server via 0G contract...');
        
        const { getPokerGame0GAddress } = await loadZeroG();
        const POKERGAME_0G_ADDRESS = getPokerGame0GAddress();
        const POKERGAME_ABI = [
          'function authorizeDelegate(address delegate) returns (bool)',
          'function isDelegateFor(address player, address delegate) view returns (bool)'
        ];
        
        const delegateAddr = zeroGServerAddress || serverAddress;
        if (!delegateAddr || !delegateAddr.startsWith('0x')) {
          throw new Error('0G server address not available. Please refresh and try again.');
        }
        
        const { ethers } = await loadEthers();
        const txParams = {
          from: walletAddress,
          to: POKERGAME_0G_ADDRESS,
          data: new ethers.utils.Interface(POKERGAME_ABI).encodeFunctionData(
            'authorizeDelegate', [delegateAddr]
          )
        };
        
        const txHash = await window.ethereum.request({
          method: 'eth_sendTransaction',
          params: [txParams]
        });
        console.log('[Landing] 0G authorize tx:', txHash);
        
        if (socket && socket.connected) {
          socket.emit('CS_SET_DELEGATE', { 
            delegateAddress: delegateAddr, 
            txId: txHash,
            chainType: 'zerog'
          });
        }
        setDelegateAuthorized(true);

      } else {
        // ====== TRON Authorization Path ======
        console.log('[Landing] Checking registration before authorize...');
        const registered = await isPlayerRegistered(walletAddress);
        if (!registered) {
          setError(t('errNotRegistered'));
          setIsRegistered(false);
          return;
        }

        console.log('[Landing] Authorizing server:', serverAddress);
        const result = await setDelegate(serverAddress);
        console.log('[Landing] setDelegate result:', result);
        
        if (result.success) {
          if (socket && socket.connected) {
            socket.emit('CS_SET_DELEGATE', { 
              delegateAddress: serverAddress, 
              txId: result.tx,
              chainType: 'tron'
            });
          }
          setDelegateAuthorized(true);
        }
      }
    } catch (err) {
      console.error('[Landing] Authorization error:', err);
      const errMsg = err.message || '';
      if (localWalletType === 'zerog') {
        if (errMsg.includes('rejected') || errMsg.includes('4001')) {
          setError('Authorization rejected by user');
        } else if (errMsg.includes('insufficient funds') || errMsg.includes('balance')) {
          setError('Insufficient 0G balance for gas fee');
        } else {
          setError(`0G Authorization failed: ${errMsg}`);
        }
      } else {
        if (errMsg.includes('REVERT') || errMsg.includes('not registered')) {
          setError('Authorization failed: Not registered. Please register first.');
          setIsRegistered(false);
        } else {
          setError(errMsg || 'Authorization failed, please try again');
        }
      }
    } finally {
      setAuthorizing(false);
    }
  };

  // Handle revoke delegate authorization
  const handleRevokeDelegate = async () => {
    setRevoking(true);
    setError(null);

    try {
      console.log('[Landing] Revoking delegate authorization...');
      const result = await revokeDelegate();
      console.log('[Landing] revokeDelegate result:', result);
      
      if (result.success) {
        // Notify server about the revocation
        if (socket && socket.connected) {
          socket.emit('CS_REVOKE_DELEGATE', { walletAddress });
        }
        
        // Update state
        setDelegateAuthorized(false);
      }
    } catch (err) {
      console.error('[Landing] Revoke error:', err);
      const errMsg = err.message || '';
      if (errMsg.includes('No delegate')) {
        setError(t('errNoAuth'));
        setDelegateAuthorized(false);
      } else {
        setError(errMsg || 'Revocation failed, please try again');
      }
    } finally {
      setRevoking(false);
    }
  };

  const proceedToGame = (address) => {
    // Check authorization — without it, blockchain actions (join/leave) will fail with signature requests
    if (!delegateAuthorized) {
      const lang = (typeof navigator !== 'undefined' && /^zh/.test(navigator.language)) ? 'zh' : 'en';
      window.alert(lang === 'zh'
        ? '请先授权服务器代理，否则进入游戏时需要反复签名。点击"Authorize Server"按钮完成授权后再开始游戏。'
        : 'Please authorize the server first, otherwise you\'ll be prompted to sign every action in the game. Click "Authorize Server" button below, then try again.');
      
      // Scroll to delegate section so user can see the Authorize Server button
      const el = document.getElementById('delegate-section') || document.querySelector('[data-delegate="true"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const safeAddress = address || 'guest_' + Math.random().toString(36).slice(2, 8);
    const username = safeAddress.slice(0, 8);
    const gameId = '1';

    // Use window.socket as fallback (set by WebsocketProvider)
    const activeSocket = (socket && socket.connected) ? socket : window.socket;

    const doEnter = (sock) => {
      // Emergency preload critical assets right before entering game
      emergencyPreload();
      sock.emit(CS_FETCH_LOBBY_INFO, {
        walletAddress: safeAddress,
        socketId: sock.id,
        gameId,
        username
      });
      navigate('/play');
    };

    if (activeSocket && activeSocket.connected) {
      doEnter(activeSocket);
      return;
    }

    // Socket not yet connected — wait up to 5s
    setError('Connecting to server...');
    const sock = activeSocket || window.socket;
    if (!sock) {
      setError('Socket not connected, please refresh the page');
      return;
    }
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        setError('Connection timeout, please refresh the page');
      }
    }, 5000);
    sock.once('connect', () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        setError(null);
        doEnter(sock);
      }
    });
  };


  const proceedToHomepage = (address) => {
    const username = address.slice(0, 8);
    const gameId = '1';

    if (socket && socket.connected) {
      socket.emit(CS_FETCH_LOBBY_INFO, {
        walletAddress: address,
        socketId: socket.id,
        gameId,
        username
      });
      //navigate('/play');
      navigate('/');
    } else {
      setError('Socket not connected, please refresh the page');
    }
  };

  return (
    <Container fullHeight contentCenteredMobile padding="4rem 2rem 2rem 2rem">
      <CenteredBlockWithAnimation>
        <Hider hideOnDesktop>
          <Suspense fallback={<div style={{ width: '70%', maxWidth: '380px', margin: '1rem auto', height: '200px', background: '#f0f0f0', borderRadius: '8px' }}></div>}>
            <MobileIllustration src={illustrationMobile} alt="Vintage Poker" />
          </Suspense>
        </Hider>
        <Markdown>
          <MarketingHeadline
            as="h2"
            headingClass="h1"
            textCenteredOnMobile
            dangerouslySetInnerHTML={{
              __html: "Join the world's most <span style=\"color: #24516a\">classy<br />online poker</span> experience!",
            }}
          />
        </Markdown>

        <Markdown>
          <MarketingHeadline
            as="h3"
            headingClass="h6"
            textCenteredOnMobile
            dangerouslySetInnerHTML={{
              __html: `Deposit ${localWalletType === 'zerog' ? '0G' : 'TRX'} to start playing. <span style="color: #24516a">Withdraw anytime.</span>`,
            }}
          />
        </Markdown>
        <Wrapper>
          {!walletAddress ? (
            <>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button
                large
                primary
                fullWidthOnMobile
                autoFocus
                onClick={handleConnectWallet}
                disabled={connecting}
                style={{ flex: 2 }}
              >
                {connecting ? 'Connecting...' : 'Connect TRON'}
              </Button>
              <Button
                large
                fullWidthOnMobile
                onClick={async () => {
                  // Check if EVM wallet is available first
                  if (!window.ethereum) {
                    setError('EVM wallet (MetaMask / OKX) not detected in this browser.\n\nOptions:\n• Install MetaMask extension and reload\n• Use OKX Wallet\n• For testing: run `node inject-metamask.js` to inject a mock wallet');
                    return;
                  }

                  try {
                    const { connectWallet: connectZeroGWallet, switchChain } = await loadZeroG();
                    const result = await connectZeroGWallet();
                    if (result?.address) {
                      // Auto-switch to 0G Testnet network
                      try {
                        await switchChain('testnet');
                        console.log('[Landing] Switched to 0G Testnet');
                      } catch (switchErr) {
                        console.warn('[Landing] Failed to auto-switch 0G network:', switchErr.message);

                        // If chain not added, provide helpful guidance
                        if (switchErr.code === 4902 || switchErr.message?.includes('add')) {
                          setError('0G network not found in wallet. Please add it manually:\nNetwork Name: 0G Testnet\nRPC URL: https://evmrpc-galileo.0g.ai\nChain ID: 16602\nSymbol: 0G');
                        } else {
                          setError(`Failed to switch to 0G network: ${switchErr.message}`);
                        }
                      }
                      setLocalWalletAddress(result.address);
                      setWalletAddress(result.address);
                      setLocalWalletType('zerog');
                      setWalletType('zerog'); // global for Navbar

                      // Persist connection state so it survives page refresh
                      localStorage.setItem('wallet_type', 'zerog');
                      localStorage.setItem('wallet_address', result.address);
                      console.log('[Landing] 0G connection saved to localStorage');
                    }
                  } catch (e) {
                    if (e.code === 4001) {
                      setError('Connection cancelled by user.');
                    } else if (e.message?.includes('not found') || e.message?.includes('Install')) {
                      setError(`${e.message}\n\nTip: For testing, run "node inject-metamask.js" to simulate a MetaMask wallet.`);
                    } else {
                      setError(e.message || 'Failed to connect 0G wallet');
                    }
                  }
                }}
                style={{ flex: 1, background: '#627eea', borderColor: '#627eea' }}
              >
                0G / EVM
              </Button>
            </div>
          </>
          ) : (
            <>
              <WalletInfo>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span>Wallet: {formatAddress(walletAddress)}</span>
                    <span>{localWalletType === 'zerog' ? '0G' : 'TRX'}: {localWalletType === 'zerog' ? parseFloat(walletBalance).toFixed(4) : formatTrx(walletBalance)}</span>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.removeItem('wallet_type');
                      localStorage.removeItem('wallet_address');
                      setLocalWalletAddress(null);
                      setWalletAddress(null);
                      setLocalWalletType(null);
                      setWalletType(null);
                      setIsRegistered(false);
                      setContractBalance(0);
                      setLockedBalance(0);
                      setWalletBalanceRaw(0);
                      loadZeroG().then(({ disconnectWallet }) => disconnectWallet()).catch(() => {});
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid #e74c3c',
                      color: '#e74c3c',
                      borderRadius: '6px',
                      padding: '0.25rem 0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap'
                    }}
                    title="Disconnect current wallet and switch network"
                  >
                    Disconnect
                  </button>
                </div>
                {walletBalance === 0 && (
                  <small style={{ color: '#f0883e', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
                    If you just topped up from faucet, please wait a few seconds for the balance to update, but you can continue to deposit.
                  </small>
                )}
              </WalletInfo>
              
              {/* Registration Section - Always visible */}
              <RegistrationSection>
                {isRegistered ? (
                  <RegisteredBadge>{t('registered')}</RegisteredBadge>
                ) : (
                  <>
                    <InfoText>
                      You need to register on the blockchain to play.
                      <br />
                      <small>This will create your player account in the game contract.</small>
                    </InfoText>
                    <Button
                      large
                      primary
                      fullWidthOnMobile
                      onClick={handleRegister}
                      disabled={registering}
                    >
                      {registering ? 'Registering...' : 'Register on Blockchain'}
                    </Button>
                    {/* Faucet hint for users without balance */}
                    {walletBalance === 0 && (
                      <FaucetLink>
                        Need test {localWalletType === 'zerog' ? '0G' : 'TRX'}?{' '}
                        {localWalletType === 'zerog' ? (
                          <span>Visit <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer">0G Faucet</a> for test tokens</span>
                        ) : (
                          <a href="https://nileex.io/join/getJoinPage" target="_blank" rel="noopener noreferrer">
                            Get from Nile Faucet
                          </a>
                        )}
                        <br />
                        <small style={{ color: '#888' }}>
                          After receiving, wait a few seconds for the balance to refresh automatically, but you can continue to deposit.
                        </small>
                      </FaucetLink>
                    )}
                  </>
                )}
              </RegistrationSection>
              
              {/* Balance and Deposit/Withdraw - Only show if registered */}
              {isRegistered && (
                <>
                  <BalanceInfo>
                    <BalanceRow>
                      <span>Wallet {localWalletType === 'zerog' ? '0G' : 'TRX'}:</span>
                      <span>{localWalletType === 'zerog' ? parseFloat(walletBalance).toFixed(4) : formatTrx(walletBalance)} {localWalletType === 'zerog' ? '0G' : 'TRX'}</span>
                    </BalanceRow>
                    <BalanceRow>
                      <span>Game Balance:</span>
                      <span>{localWalletType === 'zerog' ? parseFloat(gameBalance).toFixed(4) : formatTrx(gameBalance)} {localWalletType === 'zerog' ? '0G' : 'TRX'}</span>
                    </BalanceRow>
                    <BalanceRow>
                      <span>Bankroll:</span>
                      <span>{localWalletType === 'zerog' ? parseFloat(bankroll).toFixed(4) : formatTrx(bankroll)} {localWalletType === 'zerog' ? '0G' : 'TRX'}</span>
                    </BalanceRow>
                    {lockedBalance > 0 && (
                      <BalanceRow style={{ color: '#f0883e', fontSize: '0.8rem' }}>
                        <span>  └─ Locked:</span>
                        <span>{localWalletType === 'zerog' ? parseFloat(lockedBalance).toFixed(4) : formatTrx(lockedBalance)} {localWalletType === 'zerog' ? '0G' : 'TRX'}</span>
                      </BalanceRow>
                    )}
                  </BalanceInfo>
                  <DepositSection>
                    <DepositInput
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder={`Amount in ${localWalletType === 'zerog' ? '0G' : 'TRX'}`}
                      min="1"
                    />
                    <Button
                      primary
                      onClick={handleDeposit}
                      disabled={depositing}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      {depositing ? 'Depositing...' : 'Deposit'}
                    </Button>
                  </DepositSection>

                  {/* Enter Game — after Deposit, before Withdraw: must deposit chips first */}
                  <Button
                    large
                    primary
                    fullWidthOnMobile
                    onClick={() => proceedToGame(walletAddress)}
                    disabled={gameBalance <= 0}
                  >
                    {gameBalance <= 0 ? t('deposit') + ' Required to Play' : t('enterGame')}
                  </Button>

                  <WithdrawSection>
                    <WithdrawInfo>
                      <span>{t('withdrawable')} {localWalletType === 'zerog' ? parseFloat(bankroll).toFixed(4) : formatTrx(bankroll)} {localWalletType === 'zerog' ? '0G' : 'TRX'}</span>
                      {lockedBalance > 0 && (
                        <LockedWarning>
                          ⚠️ {localWalletType === 'zerog' ? parseFloat(lockedBalance).toFixed(4) : formatTrx(lockedBalance)} {localWalletType === 'zerog' ? '0G' : 'TRX'} {t('locked')}
                        </LockedWarning>
                      )}
                    </WithdrawInfo>
                    <WithdrawButtons>
                      <Button
                        onClick={handleWithdraw}
                        disabled={withdrawing || bankroll <= 0}
                        style={{ flex: 1 }}
                      >
                        {withdrawing ? t('withdrawing') : `Withdraw ${localWalletType === 'zerog' ? parseFloat(bankroll).toFixed(4) + ' 0G' : formatTrx(bankroll) + ' TRX'}`}
                      </Button>
                    </WithdrawButtons>
                    {lockedBalance > 0 && (
                      <UnlockSection>
                        <Button
                          onClick={handleUnlockLocked}
                          disabled={unlocking}
                          style={{ width: '100%', background: '#f0883e', borderColor: '#f0883e' }}
                        >
                          {unlocking ? t('unlocking') : t('tryUnlock')(formatTrx(lockedBalance))}
                        </Button>
                        <UnlockHint>
                          {t('lockedHint')}
                        </UnlockHint>
                      </UnlockSection>
                    )}
                  </WithdrawSection>
                  <FaucetLink>
                    Need test {localWalletType === 'zerog' ? '0G' : 'TRX'}?{' '}
                    {localWalletType === 'zerog' ? (
                      <span>Visit <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer">0G Faucet</a></span>
                    ) : (
                      <a href="https://nileex.io/join/getJoinPage" target="_blank" rel="noopener noreferrer">
                        Get from Nile Faucet
                      </a>
                    )}
                  </FaucetLink>
                  {/* Server Authorization Section */}
                  <DelegateSection id="delegate-section">
                    <DelegateHeader>
                      <span>{t('serverAuth')}</span>
                      {delegateAuthorized ? (
                        <AuthorizedBadge>{t('authorized')}</AuthorizedBadge>
                      ) : (
                        <NotAuthorizedBadge>{t('notAuthorized')}</NotAuthorizedBadge>
                      )}
                    </DelegateHeader>
                    <DelegateInfo>
                      {delegateAuthorized ? (
                        <span>{t('authorizedDesc')}</span>
                      ) : (
                        <span>{t('authWarning')}</span>
                      )}
                    </DelegateInfo>
                    {!delegateAuthorized && (
                      <Button
                        onClick={handleAuthorizeServer}
                        disabled={authorizing || (!serverAddress && !zeroGServerAddress)}
                        style={{ 
                          width: '100%', 
                          background: '#28a745', 
                          borderColor: '#28a745',
                          marginTop: '0.5rem'
                        }}
                      >
                        {authorizing ? t('authorizing') : t('authorizeServer')}
                      </Button>
                    )}
                    {delegateAuthorized && (
                      <Button
                        onClick={handleRevokeDelegate}
                        disabled={revoking}
                        style={{ 
                          width: '100%', 
                          background: '#dc3545', 
                          borderColor: '#dc3545',
                          marginTop: '0.5rem'
                        }}
                      >
                        {revoking ? t('revoking') : t('revokeAuth')}
                      </Button>
                    )}
                  </DelegateSection>
                </>
              )}
            </>
          )}
        </Wrapper>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {!tronLinkInstalled && (
          <InstallPrompt>
            <p>TronLink wallet not detected</p>
            <a href="https://www.tronlink.org/" target="_blank" rel="noopener noreferrer">
              Install TronLink
            </a>
          </InstallPrompt>
        )}
      </CenteredBlockWithAnimation>
      <Hider hideOnMobile>
        <Suspense fallback={<div style={{ width: '400px', height: '400px', background: '#f0f0f0', borderRadius: '8px' }}></div>}>
          <DesktopIllustration src={illustrationDesktop} alt="Vintage Poker" />
        </Suspense>
      </Hider>
    </Container>
  );
};

const CenteredBlockWithAnimation = styled(CenteredBlock)`
  opacity: 0;
  -webkit-animation-duration: 0.3s;
  animation-duration: 0.3s;
  -webkit-animation-delay: 0.3s;
  animation-delay: 0.3s;
  -webkit-animation-fill-mode: both;
  animation-fill-mode: both;
  -webkit-animation-name: fadeInLeft;
  animation-name: fadeInLeft;

  @-webkit-keyframes fadeInLeft {
    from {
      -webkit-transform: translate3d(-40px, 0, 0);
      transform: translate3d(-40px, 0, 0);
    }

    to {
      -webkit-transform: translate3d(0, 0, 0);
      transform: translate3d(0, 0, 0);
      opacity: 1;
    }
  }
  @keyframes fadeInLeft {
    from {
      -webkit-transform: translate3d(-40px, 0, 0);
      transform: translate3d(-40px, 0, 0);
    }

    to {
      -webkit-transform: translate3d(0, 0, 0);
      transform: translate3d(0, 0, 0);
      opacity: 1;
    }
  }
`;

const MobileIllustration = styled.img`
  margin: 1rem auto;
  width: 70%;
  max-width: 380px;

  @media screen and (orientation: landscape) {
    display: none;
  }
`;

const DesktopIllustration = styled.img`
  position: relative;
  margin-left: 2rem;
  right: 2rem;
  max-width: 400px;
  -webkit-transform: scale(1.25);
  transform: scale(1.25);
  transition: all 0.5s;
  opacity: 0;
  animation-duration: 0.3s;
  animation-delay: 0.6s;
  animation-fill-mode: both;
  -webkit-animation-duration: 0.3s;
  -webkit-animation-delay: 0.6s;
  -webkit-animation-fill-mode: both;
  animation-name: fadeInRight;
  -webkit-animation-name: fadeInRight;

  @keyframes fadeInRight {
    from {
      -webkit-transform: translate3d(40px, 0, 0);
      transform: translate3d(40px, 0, 0);
    }

    to {
      -webkit-transform: translate3d(0, 0, 0);
      transform: translate3d(0, 0, 0);
      opacity: 1;
    }
  }

  @-webkit-keyframes fadeInRight {
    from {
      -webkit-transform: translate3d(40px, 0, 0);
      transform: translate3d(40px, 0, 0);
    }

    to {
      -webkit-transform: translate3d(0, 0, 0);
      transform: translate3d(0, 0, 0);
      opacity: 1;
    }
  }
`;

const Wrapper = styled.div`
  max-width: 624px;
  margin: 0 auto;

  & ${Button}:not(:first-child) {
    margin-top: 1rem;
  }

  @media screen and (min-width: 1024px) {
    margin: 0;
    margin-top: 1.5rem;

    & ${Button}:not(:first-child) {
      margin-left: 1rem;
      margin-top: 0;
    }
  }
`;

const ErrorMessage = styled.p`
  color: #e94560;
  margin-top: 1rem;
  text-align: center;
`;

const WalletInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(36, 81, 106, 0.1);
  border-radius: 8px;
  font-family: monospace;
  font-size: 0.9rem;
`;

const RegisteredBadge = styled.span`
  background: #28a745;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
`;

const RegistrationSection = styled.div`
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(40, 167, 69, 0.1);
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 8px;
  text-align: center;
`;

const InfoText = styled.p`
  text-align: center;
  margin-bottom: 1rem;
  color: #666;
  line-height: 1.5;
  
  small {
    color: #999;
  }
`;

const BalanceInfo = styled.div`
  background: rgba(36, 81, 106, 0.05);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  width: 100%;
`;

const BalanceRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  font-size: 0.9rem;
  
  &:not(:last-child) {
    border-bottom: 1px solid rgba(36, 81, 106, 0.1);
  }
`;

const RefreshButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 1rem;
  margin-bottom: 1rem;
  background: rgba(36, 81, 106, 0.1);
  border: 1px solid rgba(36, 81, 106, 0.2);
  border-radius: 4px;
  color: #24516a;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgba(36, 81, 106, 0.2);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DepositSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  width: 100%;
`;

const DepositInput = styled.input`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;

  &:focus {
    outline: none;
    border-color: #24516a;
  }
`;

const WithdrawSection = styled.div`
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  background: rgba(36, 81, 106, 0.05);
  border-radius: 8px;
  width: 100%;
`;

const WithdrawInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
`;

const LockedWarning = styled.span`
  color: #f0883e;
  font-size: 0.8rem;
`;

const WithdrawButtons = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const UnlockSection = styled.div`
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: rgba(240, 136, 62, 0.1);
  border: 1px solid rgba(240, 136, 62, 0.3);
  border-radius: 8px;
`;

const UnlockHint = styled.p`
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.5rem;
  line-height: 1.4;
`;

const FaucetLink = styled.p`
  text-align: center;
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.5rem;
  
  a {
    color: #24516a;
    text-decoration: underline;
    
    &:hover {
      color: #1a3d4d;
    }
  }
`;

const DelegateSection = styled.div`
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  background: rgba(40, 167, 69, 0.1);
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 8px;
  width: 100%;
`;

const DelegateHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-weight: 500;
`;

const AuthorizedBadge = styled.span`
  background: #28a745;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
`;

const NotAuthorizedBadge = styled.span`
  background: #dc3545;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
`;

const DelegateInfo = styled.div`
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.5rem;
`;

const InstallPrompt = styled.div`
  margin-top: 1rem;
  text-align: center;
  
  p {
    color: #e94560;
    margin-bottom: 0.5rem;
  }
  
  a {
    color: #24516a;
    text-decoration: underline;
    
    &:hover {
      color: #1a3d4d;
    }
  }
`;

const FeatureSection = styled.div`
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(36, 81, 106, 0.2);
  width: 100%;
`;

export default Landing;
