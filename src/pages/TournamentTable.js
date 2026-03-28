import React, { useContext, useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import Button from '../components/buttons/Button';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import globalContext from '../context/global/globalContext';
import { TournamentGameProvider, TournamentGameContext } from '../context/game/TournamentGameContext';
import PokerTable from '../components/game/PokerTable';
import { RotateDevicePrompt } from '../components/game/RotateDevicePrompt';
import { PositionedUISlot } from '../components/game/PositionedUISlot';
import { PokerTableWrapper } from '../components/game/PokerTableWrapper';
import { Seat } from '../components/game/Seat/Seat';
import { InfoPill } from '../components/game/InfoPill';
import { GameUI } from '../components/game/GameUI';
import { GameStateInfo } from '../components/game/GameStateInfo';
import BrandingImage from '../components/game/BrandingImage';
import PokerCard from '../components/game/PokerCard';
import background from '../assets/img/background.png';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';
import './Play.scss';

// NFT Achievement types mapping
const achievementTypes = {
  'STRAIGHT': { name: '顺子', icon: '🃏' },
  'FLUSH': { name: '同花', icon: '♠️' },
  'FULL_HOUSE': { name: '葫芦', icon: '🏠' },
  'FOUR_OF_A_KIND': { name: '四条', icon: '🎯' },
  'STRAIGHT_FLUSH': { name: '同花顺', icon: '🌟' },
  'ROYAL_FLUSH': { name: '皇家同花顺', icon: '👑' },
};

/**
 * TournamentTableGame - 内部游戏组件，复用 Play.js 的 UI
 * 必须在 TournamentGameProvider 内部使用
 */
const TournamentTableGame = ({ tournamentId }) => {
  const navigate = useNavigate();
  const globalCtx = useContext(globalContext);
  const {
    messages,
    currentTable,
    seatId,
    isLeaving,
    leaveTable,
    fold,
    check,
    call,
    raise,
    tournament,
    walletAddress,  // Get walletAddress from context
    tournamentEnded,
    finalRankings,
    nftAchievement,
    setNftAchievement,
  } = useContext(TournamentGameContext);

  const [bet, setBet] = useState(0);

  // Track previous turn state to only reset bet when turn changes
  const prevTurnRef = useRef(null);
  const prevHandRef = useRef(null);

  // Handle NFT Achievement notification
  useEffect(() => {
    if (nftAchievement) {
      console.log('[TournamentTable] Showing NFT achievement notification:', nftAchievement);
      const achievement = achievementTypes[nftAchievement.achievementType] || {};

      // Format cards for display
      const formatCard = (card) => {
        if (typeof card === 'object' && card !== null) {
          return `${card.rank}${card.suit}`;
        }
        return card;
      };

      const handCards = nftAchievement.hand?.map(formatCard).join(' ') || '';
      const boardCards = nftAchievement.board?.map(formatCard).join(' ') || '';

      // === CAPTURE SCREENSHOT BEFORE SHOWING POPUP ===
      // Use async IIFE to capture screenshot before showing popup
      (async () => {
        let screenshotBase64 = null;
        try {
          console.log('[TournamentTable] Capturing screenshot BEFORE showing popup...');
          
          // Find the best element to capture - prefer specific game containers
          const gameElement = document.querySelector('.play-area') || 
                              document.querySelector('[class*="PokerTableWrapper"]') ||
                              document.querySelector('[class*="Container"]');
          
          if (!gameElement) {
            console.warn('[TournamentTable] No suitable game element found for screenshot');
          }
          
          // Get the element dimensions for logging
          const elementWidth = gameElement?.offsetWidth || 0;
          const elementHeight = gameElement?.offsetHeight || 0;
          console.log('[TournamentTable] Element dimensions:', elementWidth, 'x', elementHeight);
          
          const canvas = await html2canvas(gameElement, {
            backgroundColor: '#0a0a0f',
            scale: 1.0,
            logging: false,
            useCORS: true,
            allowTaint: true,
            // Limit the canvas size to reasonable dimensions
            width: Math.min(elementWidth, 1920),
            height: Math.min(elementHeight, 1080),
            windowWidth: elementWidth,
            windowHeight: elementHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            // Use onclone to fix styles before rendering
            onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.querySelector('.play-area') || 
                                    clonedDoc.querySelector('[class*="PokerTableWrapper"]') ||
                                    clonedDoc.querySelector('[class*="Container"]');
              if (clonedElement) {
                // Remove pseudo-element effects by setting explicit background
                clonedElement.style.background = 'linear-gradient(180deg, #0a0a12 0%, #1a1a2e 50%, #0a0a0f 100%)';
                clonedElement.style.backgroundImage = 'none';
                // Remove any shadow effects
                clonedElement.style.boxShadow = 'none';
                clonedElement.style.filter = 'none';
                // Ensure proper sizing
                clonedElement.style.overflow = 'hidden';
              }
              
              // Add style to hide pseudo-elements
              const style = clonedDoc.createElement('style');
              style.textContent = `
                .play-area::before,
                .play-area::after {
                  display: none !important;
                  content: none !important;
                }
              `;
              clonedDoc.head.appendChild(style);
              
              // Remove backdrop-filter from all elements (not supported by html2canvas)
              clonedDoc.querySelectorAll('[style*="backdrop"], [style*="filter"]').forEach(el => {
                el.style.backdropFilter = 'none';
                el.style.webkitBackdropFilter = 'none';
                el.style.filter = 'none';
              });
            }
          });
          screenshotBase64 = canvas.toDataURL('image/png').split(',')[1];
          console.log('[TournamentTable] Screenshot captured successfully, size:', screenshotBase64.length);
        } catch (err) {
          console.warn('[TournamentTable] Screenshot capture failed:', err);
        }

        // Show popup after screenshot is captured
        Swal.fire({
          title: '🎉 成就解锁！',
          html: `
            <div style="text-align: center;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">${achievement.icon || '🃏'}</div>
              <h2 style="color: #ffd700; margin-bottom: 0.5rem;">${achievement.name || nftAchievement.handType}</h2>
              <p style="margin-bottom: 1rem;">恭喜！您获得了一个稀有牌型成就！</p>
              ${handCards ? `<p><strong>手牌:</strong> ${handCards}</p>` : ''}
              ${boardCards ? `<p><strong>公共牌:</strong> ${boardCards}</p>` : ''}
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #888;">点击下方按钮铸造您的成就 NFT</p>
            </div>
          `,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: '铸造 NFT',
          cancelButtonText: '稍后再说',
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#6c757d',
          background: '#1a1a2e',
          color: '#fff',
        }).then(async (result) => {
          if (result.isConfirmed) {
            // Screenshot already captured before popup was shown
            
            // Mint NFT via socket
            const socket = require('../socket').default;
            socket.emit('CS_NFT_PREPARE_MINT', {
            walletAddress: walletAddress,  // Use from context
            achievementType: nftAchievement.achievementType,
            gameSessionId: nftAchievement.gameId,
            handData: { 
              cards: nftAchievement.cards,
              hand: nftAchievement.hand,
              board: nftAchievement.board
            },
            screenshot: screenshotBase64
          });
          
          // Show minting in progress
          Swal.fire({
            title: '铸造中...',
            html: '<p>正在铸造您的 NFT...</p>',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          
          // Listen for mint result
          socket.once('SC_NFT_MINT_READY', (data) => {
            Swal.fire({
              title: '🎉 铸造成功！',
              html: `
                <div style="text-align: center;">
                  <p>您的 ${achievement.name || nftAchievement.handType} NFT 已铸造成功！</p>
                  <p style="font-size: 0.9rem; color: #888;">Token ID: ${data.tokenId || 'N/A'}</p>
                </div>
              `,
              icon: 'success',
              confirmButtonText: '查看收藏',
              confirmButtonColor: '#3085d6',
            }).then(() => {
              navigate('/nft');
            });
          });
          
          socket.once('SC_NFT_MINT_ERROR', (data) => {
            Swal.fire({
              title: '铸造失败',
              text: data.error || '未知错误',
              icon: 'error',
            });
          });
        }
      }); // end of Swal.then()
    })(); // end of async IIFE
    
    setNftAchievement(null);
  }
  }, [nftAchievement, setNftAchievement, walletAddress, navigate]);

  // Update bet amount only when turn starts or hand changes
  useEffect(() => {
    if (currentTable && currentTable.seats && currentTable.seats[seatId]) {
      const currentTurn = currentTable.seats[seatId].turn;
      const currentHand = currentTable.handId;
      const playerStack = currentTable.seats[seatId].stack || 0;
      
      // Only reset bet when:
      // 1. Turn transitions to true (it becomes player's turn)
      // 2. Hand ID changes (new hand started)
      const turnChanged = currentTurn && prevTurnRef.current === false;
      const handChanged = currentHand !== prevHandRef.current;
      const firstTime = prevTurnRef.current === null;
      
      if (firstTime || turnChanged || handChanged) {
        // For raise, use minRaise (minimum raise amount)
        // minRaise is the total bet amount for a minimum raise
        const minRaise = currentTable.minRaise || currentTable.minBet;
        const maxBet = playerStack;
        
        // Set bet to minRaise, but ensure it's within valid range
        const newBet = Math.min(minRaise, maxBet);
        setBet(Math.max(newBet, 0));
      }
      
      prevTurnRef.current = currentTurn;
      prevHandRef.current = currentHand;
    }
  }, [currentTable, seatId]);

  // Handle leave
  const handleLeave = () => {
    leaveTable();
    navigate('/tournament');
  };

  // Tournament ended - show final results
  if (tournamentEnded) {
    const walletAddress = globalCtx?.walletAddress?.toLowerCase();
    const myRank = finalRankings.find(r => {
      const addr = (r.address || r)?.toLowerCase();
      return addr === walletAddress;
    });
    const myPosition = myRank ? finalRankings.indexOf(myRank) + 1 : finalRankings.length;
    const isWinner = myPosition === 1;
    
    return (
      <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
        <Heading as="h2" textCentered color={isWinner ? '#ffd700' : '#fff'}>
          {isWinner ? '🎉 Tournament Champion! 🎉' : 'Tournament Ended'}
        </Heading>
        <Text textCentered marginTop="1rem" color="#fff">Tournament #{tournamentId}</Text>

        <div style={{ marginTop: '2rem', width: '100%', maxWidth: '500px', margin: '2rem auto 0' }}>
          <Heading as="h3" textCentered marginBottom="1rem" color="#fff">Final Rankings</Heading>
          {finalRankings.map((ranking, index) => {
            const address = ranking.address || ranking;
            const isMe = address?.toLowerCase() === walletAddress;
            const position = index + 1;
            return (
              <div
                key={index}
                style={{
                  padding: '0.75rem 1rem',
                  margin: '0.5rem 0',
                  background: isMe ? 'linear-gradient(135deg, #2a5a2a 0%, #1a4a1a 100%)' : 'rgba(70, 130, 180, 0.4)',
                  borderRadius: '8px',
                  border: isMe ? '2px solid #5c5' : '1px solid rgba(70, 130, 180, 0.6)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  color: '#fff'
                }}
              >
                <span style={{ fontSize: '1rem', fontWeight: '500' }}>
                  {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
                  {' '}
                  {isMe ? 'You' : `${address?.substring(0, 10)}...`}
                </span>
                {ranking.prizeAmount && (
                  <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1rem' }}>
                    {(ranking.prizeAmount / 1e6).toLocaleString()} TRX
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {myPosition > 1 && (
          <Text textCentered marginTop="1.5rem" color="#ccc">
            You finished #{myPosition}
          </Text>
        )}

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Button primary onClick={() => navigate('/tournament')}>
            Back to Tournaments
          </Button>
        </div>
      </Container>
    );
  }

  // Waiting room state
  if (tournament && tournament.status === 'WAITING') {
    const players = tournament.players || [];
    const playerCount = tournament.playerCount || 2;
    const walletAddress = globalCtx?.walletAddress;

    return (
      <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
        <Heading as="h2" textCentered color="#fff">Waiting for Players</Heading>
        <Text textCentered marginTop="1rem" color="#fff">Tournament #{tournamentId}</Text>
        <Text textCentered marginTop="0.5rem" color="#fff">{players.length} / {playerCount} players</Text>

        <div style={{ marginTop: '2rem', maxWidth: '500px', margin: '2rem auto 0' }}>
          {players.map((p, i) => (
            <div
              key={i}
              style={{
                padding: '0.75rem 1rem',
                margin: '0.5rem 0',
                background: p.address === walletAddress ? 'linear-gradient(135deg, #2a5a2a 0%, #1a4a1a 100%)' : 'rgba(70, 130, 180, 0.3)',
                borderRadius: '8px',
                border: p.address === walletAddress ? '2px solid #5c5' : '1px solid rgba(70, 130, 180, 0.5)',
                color: '#fff',
                fontWeight: '500',
                fontSize: '1rem'
              }}
            >
              {p.address === walletAddress ? '✓ You' : `Player ${i+1}`}: {p.address?.substring(0, 10)}...
            </div>
          ))}
          {Array.from({ length: playerCount - players.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                padding: '0.75rem 1rem',
                margin: '0.5rem 0',
                background: 'rgba(100, 100, 100, 0.2)',
                borderRadius: '8px',
                border: '1px dashed rgba(150, 150, 150, 0.4)',
                color: '#999',
                fontWeight: '400',
                fontSize: '1rem'
              }}
            >
              Waiting for player...
            </div>
          ))}
        </div>

        <Text textCentered marginTop="2rem" color="#ffd700" style={{ fontSize: '1.1rem' }}>
          Game will start automatically when all players join
        </Text>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Button secondary onClick={handleLeave}>Leave Tournament</Button>
        </div>
      </Container>
    );
  }

  // No game state yet (loading)
  if (!currentTable) {
    return (
      <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
        <Heading as="h2" textCentered>Starting Game...</Heading>
        <Text textCentered marginTop="1rem">Tournament status: {tournament?.status || 'Loading...'}</Text>
      </Container>
    );
  }

  // Main game UI - same as Play.js
  return (
    <>
      <RotateDevicePrompt />
      <Container
        fullHeight
        style={{
          backgroundImage: `url(${background})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'contain',
          backgroundPosition: 'center center',
          backgroundAttachment: 'fixed',
          backgroundColor: 'black',
        }}
        className="play-area"
      >
        {currentTable && (
          <>
            {/* Tournament info header */}
            <PositionedUISlot
              top="2vh"
              left="1.5rem"
              scale="0.65"
              style={{ zIndex: '50' }}
            >
              <Button small secondary onClick={handleLeave} disabled={isLeaving}>
                {isLeaving ? 'Leaving...' : 'Leave Tournament'}
              </Button>
            </PositionedUISlot>
            
            {/* Tournament ID badge */}
            <PositionedUISlot
              top="2vh"
              right="1.5rem"
              scale="0.65"
              style={{ zIndex: '50' }}
            >
              <div style={{ 
                background: 'rgba(0,0,0,0.7)', 
                padding: '0.5rem 1rem', 
                borderRadius: '8px',
                color: '#ffd700',
                fontSize: '0.9rem'
              }}>
                Tournament #{tournamentId}
              </div>
            </PositionedUISlot>
          </>
        )}
        
        <PokerTableWrapper>
          <PokerTable />
          {currentTable && (
            <>
              {/* Seat 1 */}
              <PositionedUISlot
                top="-5%"
                left="0"
                scale="0.55"
                origin="top left"
              >
                <Seat
                  seatNumber={1}
                  currentTable={currentTable}
                  sitDown={() => {}}
                />
              </PositionedUISlot>
              
              {/* Seat 2 */}
              <PositionedUISlot
                top="-5%"
                right="2%"
                scale="0.55"
                origin="top right"
              >
                <Seat
                  seatNumber={2}
                  currentTable={currentTable}
                  sitDown={() => {}}
                />
              </PositionedUISlot>
              
              {/* Seat 3 */}
              <PositionedUISlot
                bottom="15%"
                right="2%"
                scale="0.55"
                origin="bottom right"
              >
                <Seat
                  seatNumber={3}
                  currentTable={currentTable}
                  sitDown={() => {}}
                />
              </PositionedUISlot>
              
              {/* Seat 4 */}
              <PositionedUISlot bottom="8%" scale="0.55" origin="bottom center">
                <Seat
                  seatNumber={4}
                  currentTable={currentTable}
                  sitDown={() => {}}
                />
              </PositionedUISlot>
              
              {/* Seat 5 */}
              <PositionedUISlot
                bottom="15%"
                left="0"
                scale="0.55"
                origin="bottom left"
              >
                <Seat
                  seatNumber={5}
                  currentTable={currentTable}
                  sitDown={() => {}}
                />
              </PositionedUISlot>
              
              {/* Branding */}
              <PositionedUISlot
                top="-25%"
                scale="0.55"
                origin="top center"
                style={{ zIndex: '1' }}
              >
                <BrandingImage />
              </PositionedUISlot>
              
              {/* Community Cards */}
              <PositionedUISlot
                width="100%"
                origin="center center"
                scale="0.60"
                style={{
                  display: 'flex',
                  textAlign: 'center',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {currentTable.board && currentTable.board.length > 0 && (
                  <>
                    {currentTable.board.map((card, index) => (
                      <PokerCard key={index} card={card} />
                    ))}
                  </>
                )}
              </PositionedUISlot>
              
              {/* Messages */}
              <PositionedUISlot top="-5%" scale="0.60" origin="bottom center">
                {messages && messages.length > 0 && (
                  <>
                    <InfoPill>{messages[messages.length - 1]}</InfoPill>
                    {currentTable.winMessages && currentTable.winMessages.length > 0 && (
                      <InfoPill>
                        {currentTable.winMessages[currentTable.winMessages.length - 1]}
                      </InfoPill>
                    )}
                  </>
                )}
              </PositionedUISlot>
              
              {/* Game state info */}
              <PositionedUISlot top="12%" scale="0.60" origin="center center">
                {(!currentTable.winMessages || currentTable.winMessages.length === 0) && (
                  <GameStateInfo currentTable={currentTable} />
                )}
              </PositionedUISlot>
            </>
          )}
        </PokerTableWrapper>

        {/* Game UI - action buttons */}
        {currentTable &&
          currentTable.seats[seatId] &&
          currentTable.seats[seatId].turn && (
            <GameUI
              currentTable={currentTable}
              seatId={seatId}
              bet={bet}
              setBet={setBet}
              raise={raise}
              standUp={() => {}}
              fold={fold}
              check={check}
              call={call}
            />
          )}
      </Container>
    </>
  );
};

/**
 * TournamentTable - 锦标赛游戏页面
 * 包装 TournamentGameProvider 来复用 Play.js 的 UI 组件
 */
const TournamentTable = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { walletAddress: contextWalletAddress } = useContext(globalContext);
  
  // Get wallet address
  const walletAddress = useMemo(() => {
    if (contextWalletAddress) return contextWalletAddress;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('address') || localStorage.getItem('testWalletAddress');
  }, [contextWalletAddress]);

  // No wallet address - show error
  if (!walletAddress) {
    return (
      <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
        <Heading as="h2" textCentered color="#f44336">Wallet Not Connected</Heading>
        <Text textCentered marginTop="1rem">Please connect your wallet to join the tournament.</Text>
        <Button primary marginTop="2rem" onClick={() => navigate('/')}>
          Go to Home
        </Button>
      </Container>
    );
  }

  return (
    <TournamentGameProvider tournamentId={tournamentId} walletAddress={walletAddress}>
      <TournamentTableGame tournamentId={tournamentId} />
    </TournamentGameProvider>
  );
};

export default TournamentTable;
