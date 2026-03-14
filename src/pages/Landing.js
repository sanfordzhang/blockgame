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
  getTrxBalance,
  formatTrx,
  parseTrx
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
  const [walletBalance, setWalletBalance] = useState(0);
  const [depositing, setDepositing] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100');

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
      
      // Wait a bit for the transaction to be confirmed
      setTimeout(async () => {
        const registered = await isPlayerRegistered(walletAddress);
        setIsRegistered(registered);
        
        // Refresh balances
        const balance = await getPlayerBalance(walletAddress);
        setContractBalance(balance.balance);
      }, 2000);
      
      setIsRegistered(true);
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
      
      // Wait for confirmation and refresh balance
      setTimeout(async () => {
        const balance = await getPlayerBalance(walletAddress);
        setContractBalance(balance.balance);
        const trxBalance = await getTrxBalance(walletAddress);
        setWalletBalance(trxBalance);
      }, 3000);
      
    } catch (err) {
      console.error('Deposit error:', err);
      setError(err.message || '充值失败，请重试');
    } finally {
      setDepositing(false);
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
              __html: 'You receive <span style=\"color: #24516a\">100,000 free chips</span> on connection',
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
              </BalanceInfo>
              {contractBalance < 1000000 && (
                <>
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
                  <FaucetLink>
                    Need test TRX?{' '}
                    <a href="https://nileex.io/join/getJoinPage" target="_blank" rel="noopener noreferrer">
                      Get from Nile Faucet
                    </a>
                  </FaucetLink>
                </>
              )}
              <Button
                large
                primary
                fullWidthOnMobile
                onClick={() => proceedToGame(walletAddress)}
                disabled={contractBalance < 1000000}
                style={{ marginTop: '1rem' }}
              >
                {contractBalance < 1000000 ? 'Deposit Required to Play' : 'Enter Game'}
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
