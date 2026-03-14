import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import CenteredBlock from '../components/layout/CenteredBlock';
import Heading from '../components/typography/Heading';
import Button from '../components/buttons/Button';
import Hider from '../components/layout/Hider';
import illustrationMobile from '../assets/img/main-illustration-mobile@2x.png';
import illustrationDesktop from '../assets/img/main-illustration-desktop@2x.png';
import styled from 'styled-components';
import useScrollToTopOnPageLoad from '../hooks/useScrollToTopOnPageLoad';
import Markdown from 'react-remarkable';
import { connectMetamask } from '../utils/interact';
import globalContext from '../context/global/globalContext';
import socketContext from '../context/websocket/socketContext';
import { CS_FETCH_LOBBY_INFO } from '../pokergame/actions';
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
  getGameSession
} from '../utils/tronInteract';

const MarketingHeadline = styled(Heading)`
  @media screen and (min-width: 1024px) {
    margin-bottom: 3rem;
  }
`;

const Landing = () => {
  const { setWalletAddress } = useContext(globalContext);
  const { socket } = useContext(socketContext);
  const navigate = useNavigate();
  const [connecting, setConnecting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [walletAddress, setLocalWalletAddress] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [tronLinkInstalled, setTronLinkInstalled] = useState(true);
  const [contractBalance, setContractBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Calculate bankroll (available balance = total - locked)
  const bankroll = contractBalance - lockedBalance;

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
          
          // Check if registered
          const registered = await isPlayerRegistered(address);
          setIsRegistered(registered);
          
          // If registered, proceed to game
          if (registered) {
            proceedToGame(address);
          }
          // If not registered, show registration button (state will update)
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
          proceedToGame(address);
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
      
      // Optimistic update - add amount to balance immediately
      setContractBalance(prev => prev + amount);
      setWalletBalance(prev => Math.max(0, prev - amount));
      
      // Refresh actual balance in background after a short delay
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
      }, 5000);  // Check actual balance after 5 seconds
      
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

      // Optimistic update
      setContractBalance(0);
      setWalletBalance(prev => prev + amount);

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

  // Withdraw all (including locked - emergency withdraw)
  const handleWithdrawAll = async () => {
    const totalBalance = contractBalance; // Total game balance

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

      // Optimistic update
      setContractBalance(lockedBalance); // Only locked remains
      setWalletBalance(prev => prev + amount);

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
      // First check game session state
      const session = await getGameSession(1);
      console.log('Game session:', session);

      if (session && session.stateName === 'PLAYING') {
        // Try to leave table to unlock funds
        console.log('Attempting to leave table to unlock funds...');
        const result = await tryUnlockLockedBalance(1);
        console.log('Unlock result:', result);

        // Refresh balances
        await refreshAllBalances();
      } else {
        // Game not in playing state - cannot unlock via leaveTable
        setError(
          `无法解锁：游戏状态为 ${session?.stateName || '未知'}。\n` +
          `锁定余额需要在游戏中才能通过 leaveTable 解锁。\n` +
          `请联系管理员或等待游戏结算。`
        );
      }
    } catch (err) {
      console.error('Unlock error:', err);
      setError(err.message || '解锁失败，请重试');
    } finally {
      setUnlocking(false);
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
          ) : !isRegistered ? (
            <>
              <WalletInfo>
                <span>Wallet: {formatAddress(walletAddress)}</span>
                <span>TRX: {formatTrx(walletBalance)}</span>
              </WalletInfo>
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
              <Button
                large
                fullWidthOnMobile
                onClick={() => proceedToGame(walletAddress)}
                style={{ marginTop: '0.5rem' }}
              >
                Skip (Dev Mode)
              </Button>
            </>
          ) : (
            <>
              <WalletInfo>
                <span>Wallet: {formatAddress(walletAddress)}</span>
                <RegisteredBadge>✓ Registered</RegisteredBadge>
              </WalletInfo>
              <BalanceInfo>
                <BalanceRow>
                  <span>Wallet TRX:</span>
                  <span>{formatTrx(walletBalance)} TRX</span>
                </BalanceRow>
                <BalanceRow>
                  <span>Game Balance:</span>
                  <span>{formatTrx(contractBalance)} TRX</span>
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
              <Button
                large
                primary
                fullWidthOnMobile
                onClick={() => proceedToGame(walletAddress)}
                disabled={contractBalance < 100000000}
                style={{ marginTop: '1rem' }}
              >
                {contractBalance < 100000000 ? 'Deposit Required to Play' : 'Enter Game'}
              </Button>
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

export default Landing;
