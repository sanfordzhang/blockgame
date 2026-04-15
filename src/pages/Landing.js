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
import { connectMetamask } from '../utils/interact';
import globalContext from '../context/global/globalContext';
import socketContext from '../context/websocket/socketContext';
import locaContext from '../context/localization/locaContext';
import { CS_FETCH_LOBBY_INFO, CS_CHECK_DELEGATE, SC_DELEGATE_STATUS } from '../pokergame/actions';
import {
  isTronLinkInstalled,
  waitForTronLink,
  connectTronLink,
  isPlayerRegistered,
  registerPlayer,
  getCurrentAddress,
  formatAddress,
  getPlayerBalance,
  depositTrx,
  withdrawTrx,
  getTrxBalance,
  formatTrx,
  parseTrx,
  tryUnlockLockedBalance,
  getGameSession,
  setDelegate,
  revokeDelegate,
  isAuthorizedDelegate,
  getPlayerDelegate,
  getContractAddress
} from '../utils/tronInteract';

// Static import illustrations for reliable loading
import illustrationMobile from '../assets/img/main-illustration-mobile@2x.png';
import illustrationDesktop from '../assets/img/main-illustration-desktop@2x.png';

const MarketingHeadline = styled(Heading)`
  @media screen and (min-width: 1024px) {
    margin-bottom: 3rem;
  }
`;

const Landing = () => {
  const { setWalletAddress, setChipsAmount } = useContext(globalContext);
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

  // Calculate balances
  // contractBalance = balance (available in contract)
  // lockedBalance = lockedAmount (in game)
  // gameBalance = total funds in contract (available + locked)
  // bankroll = available balance for games/withdraw
  const gameBalance = contractBalance + lockedBalance;
  const bankroll = contractBalance;

  useScrollToTopOnPageLoad();

  // Check TronLink installation on mount (delayed to let page render first)
  useEffect(() => {
    const checkTronLink = async () => {
      // Delay wallet detection by 500ms so landing page renders first
      await new Promise(r => setTimeout(r, 500));
      
      // Wait for TronLink to inject
      const ready = await waitForTronLink(2000);
      setTronLinkInstalled(ready);
      
      // If already connected, get address
      if (ready) {
        const address = getCurrentAddress();
        if (address) {
          setLocalWalletAddress(address);
          setWalletAddress(address);
        }
      }
    };
    
    checkTronLink();
  }, []);

  // Preload game assets — ONLY after page is fully rendered and user has been idle.
  // Uses a two-stage approach:
  //   Stage 1: Wait 4 seconds for Landing UI + wallet data to fully render
  //   Stage 2: Use requestIdleCallback to prefetch at lowest priority
  // This ensures game resource preloading NEVER blocks or slows down the Landing experience.
  useEffect(() => {
    const startPreload = () => {
      console.log('[Landing] Starting delayed game asset prefetch...');
      
      if ('requestIdleCallback' in window) {
        // Browser will run this only when main thread is idle
        requestIdleCallback(
          () => preloadGameAssets(),
          { timeout: 8000 } // fallback if browser never goes idle
        );
      } else {
        setTimeout(() => preloadGameAssets(), 2000);
      }
    };

    // Delay: wait for Landing to be fully interactive (wallet connected, balances shown)
    const timer = setTimeout(startPreload, 4000);
    return () => clearTimeout(timer);
  }, []);

  // Check registration status and balances when wallet address changes
  useEffect(() => {
    const checkRegistration = async () => {
      if (walletAddress) {
        try {
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
  }, [walletAddress]);

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
      // Get wallet TRX balance
      const trxBalance = await getTrxBalance(walletAddress);
      setWalletBalance(trxBalance);
      
      // Get game balance (if registered)
      if (isRegistered) {
        const balance = await getPlayerBalance(walletAddress);
        setContractBalance(balance.balance);
        setLockedBalance(balance.locked || 0);
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
          
          // Check if registered (don't auto-redirect, let user see the status)
          const registered = await isPlayerRegistered(address);
          setIsRegistered(registered);
          // User stays on Landing page to see registration/deposit options
        } else {
        setError(result.error || t('errConnectTronLink'));
        }
      } else {
        // Fallback to MetaMask
        const result = await connectMetamask();

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

  const handleDeposit = async () => {
    setDepositing(true);
    setError(null);

    try {
      const amount = parseTrx(depositAmount);
      if (amount <= 0) {
        setError(t('errDepositAmount'));
        return;
      }

      console.log('Depositing', amount, 'SUN');
      const tx = await depositTrx(amount);
      console.log('Deposit tx:', tx);

      // Optimistic update: immediately reflect deposit in both balances, hold 60s
      holdWalletBalance(60000);
      setContractBalance(prev => prev + amount);
      setWalletBalanceForce(prev => Math.max(0, prev - amount));

      // Poll contract balance until confirmed (UI already shows correct value)
      const prevContractBalance = contractBalance;
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          const balance = await getPlayerBalance(walletAddress);
          setContractBalance(balance.balance);
          setLockedBalance(balance.locked || 0);
          if (balance.balance > prevContractBalance || attempts >= 15) return;
        } catch (e) { console.error('Balance poll error:', e); }
        setTimeout(poll, 3000);
      };
      setTimeout(poll, 3000);
      
    } catch (err) {
      console.error('Deposit error:', err);
      setError(err.message || t('errDepositFailed'));
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

    // Check if there's locked balance
    if (lockedBalance > 0) {
      setError(t('errLockedInGame')(formatTrx(lockedBalance)));
      return;
    }

    setWithdrawing(true);
    setError(null);

    try {
      const amount = bankroll; // Withdraw all available balance

      // Pre-flight: check contract TRX balance >= withdraw amount
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
        // Non-fatal: proceed with withdraw, let contract reject if needed
      }

      console.log('Withdrawing', amount, 'SUN');
      const tx = await withdrawTrx(amount);
      console.log('Withdraw tx:', tx);

      // Optimistic update: immediately reflect withdrawal in both balances, hold 60s
      holdWalletBalance(60000);
      setContractBalance(0);
      setWalletBalanceForce(prev => prev + amount);

      // Poll contract balance until confirmed (UI already shows correct value)
      const prevContractBalance = contractBalance;
      let attempts = 0;
      const poll = async () => {
        attempts++;
        try {
          const balance = await getPlayerBalance(walletAddress);
          setContractBalance(balance.balance);
          setLockedBalance(balance.locked || 0);
          if (balance.balance < prevContractBalance || attempts >= 15) return;
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
      const confirmWithdrawAll = window.confirm(
        `You have ${formatTrx(lockedBalance)} TRX locked in an active game.\n` +
        `Withdrawing available balance ${formatTrx(bankroll)} TRX — locked balance will remain.\n` +
        `Continue?`
      );
      if (!confirmWithdrawAll) return;
    }

    setWithdrawing(true);
    setError(null);

    try {
      // Only withdraw available balance (bankroll)
      const amount = bankroll;
      console.log('Withdrawing all available:', amount, 'SUN');
      const tx = await withdrawTrx(amount);
      console.log('Withdraw tx:', tx);

      // Optimistic update - after withdraw, balance becomes 0 (locked remains)
      setContractBalance(0);

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
      console.log(`[Landing] Attempting to unlock ${lockedBalance} SUN (${lockedBalance/1e6} TRX)...`);
      
      // Use leaveTableSession to unlock - works with PLAYING or FINISHED state
      const result = await tryUnlockLockedBalance(1, lockedBalance);
      console.log('Unlock result:', result);

      if (result.success) {
        // Update balances optimistically
        setContractBalance(prev => prev + result.amountReturned);
        setLockedBalance(0);
        
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

  // Handle delegate authorization
  const handleAuthorizeServer = async () => {
    if (!serverAddress) {
      // Request server address if not available
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
      // Verify registration status before authorizing
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
        // Notify server about the authorization
        if (socket && socket.connected) {
          socket.emit('CS_SET_DELEGATE', { 
            delegateAddress: serverAddress, 
            txId: result.tx 
          });
        }
        
        // Optimistically update state
        setDelegateAuthorized(true);
      }
    } catch (err) {
      console.error('[Landing] Authorization error:', err);
      // Handle specific contract errors
      const errMsg = err.message || '';
      if (errMsg.includes('REVERT') || errMsg.includes('not registered')) {
        setError('Authorization failed: Not registered. Please register first.');
        setIsRegistered(false);
      } else {
        setError(errMsg || 'Authorization failed, please try again');
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
              __html: 'Deposit TRX to start playing. <span style=\"color: #24516a\">Withdraw anytime.</span>',
            }}
          />
        </Markdown>
        <Wrapper>
          {!walletAddress ? (
            <Button
              large
              primary
              fullWidthOnMobile
              autoFocus
              onClick={handleConnectWallet}
              disabled={connecting}
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          ) : (
            <>
              <WalletInfo>
                <span>Wallet: {formatAddress(walletAddress)}</span>
                <span>TRX: {formatTrx(walletBalance)}</span>
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
                    {/* Faucet hint for users without TRX */}
                    {walletBalance === 0 && (
                      <FaucetLink>
                        Need test TRX?{' '}
                        <a href="https://nileex.io/join/getJoinPage" target="_blank" rel="noopener noreferrer">
                          Get from Nile Faucet
                        </a>
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
                      <span>Wallet TRX:</span>
                      <span>{formatTrx(walletBalance)} TRX</span>
                    </BalanceRow>
                    <BalanceRow>
                      <span>Game Balance:</span>
                      <span>{formatTrx(gameBalance)} TRX</span>
                    </BalanceRow>
                    <BalanceRow>
                      <span>Bankroll:</span>
                      <span>{formatTrx(bankroll)} TRX</span>
                    </BalanceRow>
                    {lockedBalance > 0 && (
                      <BalanceRow style={{ color: '#f0883e', fontSize: '0.8rem' }}>
                        <span>  └─ Locked:</span>
                        <span>{formatTrx(lockedBalance)} TRX</span>
                      </BalanceRow>
                    )}
                  </BalanceInfo>
                  <DepositSection>
                    <DepositInput
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount in TRX"
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
                      <span>{t('withdrawable')} {formatTrx(bankroll)} TRX</span>
                      {lockedBalance > 0 && (
                        <LockedWarning>
                          ⚠️ {formatTrx(lockedBalance)} TRX {t('locked')}
                        </LockedWarning>
                      )}
                    </WithdrawInfo>
                    <WithdrawButtons>
                      <Button
                        onClick={handleWithdraw}
                        disabled={withdrawing || bankroll <= 0}
                        style={{ flex: 1 }}
                      >
                        {withdrawing ? t('withdrawing') : t('withdrawAmount')(formatTrx(bankroll))}
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
                    Need test TRX?{' '}
                    <a href="https://nileex.io/join/getJoinPage" target="_blank" rel="noopener noreferrer">
                      Get from Nile Faucet
                    </a>
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
                        disabled={authorizing || !serverAddress}
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
