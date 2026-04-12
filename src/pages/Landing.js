import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import CenteredBlock from '../components/layout/CenteredBlock';
import Heading from '../components/typography/Heading';
import Button from '../components/buttons/Button';
import Hider from '../components/layout/Hider';
import illustrationMobile from '../assets/img/main-illustration-mobile@2x.png';
import illustrationDesktop from '../assets/img/main-illustration-desktop@2x.png';
import jackImg from '../assets/img/jack-rounded-img@2x.png';
import kingImg from '../assets/img/king-rounded-img@2x.png';
import queenImg from '../assets/img/queen-rounded-img@2x.png';
import queen2Img from '../assets/img/queen2-rounded-img@2x.png';
import styled from 'styled-components';
import useScrollToTopOnPageLoad from '../hooks/useScrollToTopOnPageLoad';
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
  getPlayerDelegate
} from '../utils/tronInteract';

const MarketingHeadline = styled(Heading)`
  @media screen and (min-width: 1024px) {
    margin-bottom: 3rem;
  }
`;

const Landing = () => {
  const { setWalletAddress } = useContext(globalContext);
  const { socket } = useContext(socketContext);
  const { t } = useContext(locaContext);
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [walletAddress, setLocalWalletAddress] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [tronLinkInstalled, setTronLinkInstalled] = useState(true);
  const [contractBalance, setContractBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [walletBalance, setWalletBalanceRaw] = useState(0);
  const holdUntilRef = useRef(0); // optimistic hold: skip wallet balance updates until this timestamp

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

  // Check TronLink installation on mount
  useEffect(() => {
    const checkTronLink = async () => {
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
          setError(result.error || '连接 TronLink 失败');
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
          setError('请先安装 TronLink 或 MetaMask 钱包');
          setTronLinkInstalled(false);
        } else if (result?.event === 'Wrong Chain') {
          setError('请切换到正确的网络');
        }
      }
    } catch (err) {
      setError(err.message || '连接钱包失败');
    } finally {
      setConnecting(false);
    }
  };

  const handleRegister = async () => {
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
      setError(err.message || '注册失败，请重试');
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
        setError('请输入有效的充值金额');
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
      setError(err.message || '充值失败，请重试');
    } finally {
      setDepositing(false);
    }
  };

  // Withdraw handler
  const handleWithdraw = async () => {
    if (!bankroll || bankroll <= 0) {
      setError('没有可用余额可提现');
      return;
    }

    // Check if there's locked balance
    if (lockedBalance > 0) {
      setError(`有 ${formatTrx(lockedBalance)} TRX 正在游戏中使用，请先离开游戏后再提现`);
      return;
    }

    setWithdrawing(true);
    setError(null);

    try {
      const amount = bankroll; // Withdraw all available balance
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
      setError(err.message || '提现失败，请重试');
    } finally {
      setWithdrawing(false);
    }
  };

  // Withdraw all (including locked - emergency withdraw)
  const handleWithdrawAll = async () => {
    const totalBalance = gameBalance; // Total game balance

    if (!totalBalance || totalBalance <= 0) {
      setError('没有余额可提现');
      return;
    }

    // If there's locked balance, show warning
    if (lockedBalance > 0) {
      const confirmWithdraw = window.confirm(
        `您有 ${formatTrx(lockedBalance)} TRX 正在游戏中。\n` +
        `提现可用余额 ${formatTrx(bankroll)} TRX 后，锁定余额将保留在游戏中。\n` +
        `确定要继续吗？`
      );
      if (!confirmWithdraw) return;
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
      setError(err.message || '提现失败，请重试');
    } finally {
      setWithdrawing(false);
    }
  };

  // Handle unlock locked balance
  const handleUnlockLocked = async () => {
    if (!lockedBalance || lockedBalance <= 0) {
      setError('没有锁定余额需要解锁');
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
        setError('解锁失败：您不在该桌子中。可能是不同的 tableId，请尝试其他方法。');
      } else if (errMsg.includes('No locked funds')) {
        setError('没有锁定资金可解锁。');
        setLockedBalance(0);
      } else {
        setError(`解锁失败: ${errMsg}`);
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
        setError('正在获取服务器地址，请稍后重试');
      } else {
        setError('服务器地址未配置，请刷新页面');
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
        setError('您还未在合约中注册，请先点击 "Register on Blockchain" 按钮');
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
        setError('授权失败：您还未在合约中注册。请先注册后再授权。');
        setIsRegistered(false);
      } else {
        setError(errMsg || '授权失败，请重试');
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
        setError('没有授权可取消');
        setDelegateAuthorized(false);
      } else {
        setError(errMsg || '取消授权失败，请重试');
      }
    } finally {
      setRevoking(false);
    }
  };

  const proceedToGame = (address) => {
    const username = address.slice(0, 8);
    const gameId = '1';

    if (socket && socket.connected) {
      socket.emit(CS_FETCH_LOBBY_INFO, {
        walletAddress: address,
        socketId: socket.id,
        gameId,
        username
      });
      navigate('/play');
    } else {
      setError('Socket 未连接，请刷新页面重试');
    }
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
      setError('Socket 未连接，请刷新页面重试');
    }
  };

  return (
    <Container fullHeight contentCenteredMobile padding="4rem 2rem 2rem 2rem">
      <CenteredBlockWithAnimation>
        <Hider hideOnDesktop>
          <MobileIllustration src={illustrationMobile} alt="Vintage Poker" />
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
              __html: 'You receive <span style=\"color: #24516a\">100 TRX free chips</span> on connection',
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
              </WalletInfo>
              
              {/* Registration Section - Always visible */}
              <RegistrationSection>
                {isRegistered ? (
                  <RegisteredBadge>✓ 已注册</RegisteredBadge>
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
                  <RefreshButton 
                    onClick={refreshAllBalances} 
                    disabled={refreshing}
                  >
                    {refreshing ? '⟳' : '↻'} 刷新余额
                  </RefreshButton>
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
                  <WithdrawSection>
                    <WithdrawInfo>
                      <span>可提现: {formatTrx(bankroll)} TRX</span>
                      {lockedBalance > 0 && (
                        <LockedWarning>
                          ⚠️ {formatTrx(lockedBalance)} TRX 已锁定
                        </LockedWarning>
                      )}
                    </WithdrawInfo>
                    <WithdrawButtons>
                      <Button
                        onClick={handleWithdraw}
                        disabled={withdrawing || bankroll <= 0}
                        style={{ flex: 1 }}
                      >
                        {withdrawing ? '提现中...' : `提现 ${formatTrx(bankroll)} TRX`}
                      </Button>
                    </WithdrawButtons>
                    {lockedBalance > 0 && (
                      <UnlockSection>
                        <Button
                          onClick={handleUnlockLocked}
                          disabled={unlocking}
                          style={{ width: '100%', background: '#f0883e', borderColor: '#f0883e' }}
                        >
                          {unlocking ? '解锁中...' : `尝试解锁 ${formatTrx(lockedBalance)} TRX`}
                        </Button>
                        <UnlockHint>
                          💡 锁定余额通常在游戏结束时自动释放。如果游戏异常结束，请点击上方按钮尝试解锁。
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
                  <DelegateSection>
                    <DelegateHeader>
                      <span>服务器授权</span>
                      {delegateAuthorized ? (
                        <AuthorizedBadge>✓ 已授权</AuthorizedBadge>
                      ) : (
                        <NotAuthorizedBadge>未授权</NotAuthorizedBadge>
                      )}
                    </DelegateHeader>
                    <DelegateInfo>
                      {delegateAuthorized ? (
                        <span>✅ 已授权服务器代理操作，进入/退出游戏无需签名</span>
                      ) : (
                        <span>⚠️ 授权后，服务器可代为执行游戏操作，无需每次签名</span>
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
                        {authorizing ? '授权中...' : '授权服务器 (一次签名)'}
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
                        {revoking ? '取消中...' : '取消服务器授权'}
                      </Button>
                    )}
                  </DelegateSection>
                </>
              )}
              
              {/* Enter Game Without Wallet Button */}
              <Button
                large
                fullWidthOnMobile
                onClick={() => proceedToGame(walletAddress)}
                style={{ marginTop: '0.5rem' }}
              >
                Enter Game (Without Wallet)
              </Button>
              
              {/* Enter Game Button */}
              {isRegistered && (
                <Button
                  large
                  primary
                  fullWidthOnMobile
                  onClick={() => proceedToGame(walletAddress)}
                  disabled={contractBalance < 100000000}
                  style={{ marginTop: '1rem' }}
                >
                  {contractBalance < 100000000 ? t('deposit') + ' Required to Play' : t('enterGame')}
                </Button>
              )}
              
              {/* Feature Entries - Show if registered */}
              {isRegistered && (
                <FeatureSection data-testid="feature-section">
                  <FeatureTitle>{t('navPlay') + ' & Explore'}</FeatureTitle>
                  <FeatureGrid>
                    <FeatureCard onClick={() => navigate('/tournament')} data-testid="feature-tournament">
                      <FeatureIcon src={queen2Img} alt="Tournament" />
                      <FeatureName>{t('navTournament')}</FeatureName>
                      <FeatureDesc>Tournament</FeatureDesc>
                    </FeatureCard>
                    <FeatureCard onClick={() => navigate('/nft')} data-testid="feature-nft">
                      <FeatureIcon src={jackImg} alt="NFT Gallery" />
                      <FeatureName>{t('navNFT')}</FeatureName>
                      <FeatureDesc>NFT Gallery</FeatureDesc>
                    </FeatureCard>
                    <FeatureCard onClick={() => navigate('/wallet')} data-testid="feature-wallet">
                      <FeatureIcon src={queenImg} alt="CHIP Wallet" />
                      <FeatureName>{t('navWallet')}</FeatureName>
                      <FeatureDesc>CHIP Wallet</FeatureDesc>
                    </FeatureCard>
                    <FeatureCard onClick={() => navigate('/dao')} data-testid="feature-dao">
                      <FeatureIcon src={kingImg} alt="DAO" />
                      <FeatureName>{t('navDAO')}</FeatureName>
                      <FeatureDesc>Governance</FeatureDesc>
                    </FeatureCard>
                    <FeatureCard onClick={() => navigate('/dex')} data-testid="feature-dex">
                      <DEXIcon>💱</DEXIcon>
                      <FeatureName>{t('navDEX')}</FeatureName>
                      <FeatureDesc>TRX/CHIP DEX</FeatureDesc>
                    </FeatureCard>
                  </FeatureGrid>
                </FeatureSection>
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
        <DesktopIllustration src={illustrationDesktop} alt="Vintage Poker" />
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

const FeatureTitle = styled.h3`
  text-align: center;
  color: #24516a;
  font-size: 1rem;
  margin-bottom: 1rem;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  
  @media screen and (min-width: 624px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const FeatureCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  background: rgba(36, 81, 106, 0.05);
  border: 1px solid rgba(36, 81, 106, 0.15);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(36, 81, 106, 0.1);
    border-color: rgba(36, 81, 106, 0.3);
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

const FeatureIcon = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-bottom: 0.5rem;
  
  @media screen and (max-width: 468px) {
    width: 36px;
    height: 36px;
  }
`;

const DEXIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: linear-gradient(135deg, #00d9ff, #00ff88);
  
  @media screen and (max-width: 468px) {
    width: 36px;
    height: 36px;
    font-size: 22px;
  }
`;

const FeatureName = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #24516a;
  text-align: center;
  
  @media screen and (max-width: 468px) {
    font-size: 0.75rem;
  }
`;

const FeatureDesc = styled.span`
  font-size: 0.7rem;
  color: #888;
  text-align: center;
  
  @media screen and (max-width: 468px) {
    font-size: 0.6rem;
  }
`;

export default Landing;
