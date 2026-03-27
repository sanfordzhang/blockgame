import React, { useContext, useEffect, useState, useMemo } from 'react';
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
import './Play.scss';

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
  } = useContext(TournamentGameContext);

  const [bet, setBet] = useState(0);

  // Update bet amount based on current table state
  useEffect(() => {
    if (currentTable) {
      if (currentTable.callAmount > currentTable.minBet) {
        setBet(currentTable.callAmount);
      } else if (currentTable.pot > 0) {
        setBet(currentTable.minRaise);
      } else {
        setBet(currentTable.minBet);
      }
    }
  }, [currentTable]);

  // Handle leave
  const handleLeave = () => {
    leaveTable();
    navigate('/tournament');
  };

  // Waiting room state
  if (tournament && tournament.status === 'WAITING') {
    const players = tournament.players || [];
    const playerCount = tournament.playerCount || 2;
    const walletAddress = globalCtx?.walletAddress;
    
    return (
      <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
        <Heading as="h2" textCentered>Waiting for Players</Heading>
        <Text textCentered marginTop="1rem">Tournament #{tournamentId}</Text>
        <Text textCentered marginTop="0.5rem">{players.length} / {playerCount} players</Text>
        
        <div style={{ marginTop: '2rem' }}>
          {players.map((p, i) => (
            <div key={i} style={{ padding: '0.5rem', margin: '0.5rem', background: '#2a2a2a', borderRadius: '8px' }}>
              {p.address === walletAddress ? '✓ You' : `Player ${i+1}`}: {p.address?.substring(0, 10)}...
            </div>
          ))}
          {Array.from({ length: playerCount - players.length }).map((_, i) => (
            <div key={`empty-${i}`} style={{ padding: '0.5rem', margin: '0.5rem', background: '#1a1a1a', borderRadius: '8px', color: '#666' }}>
              Waiting for player...
            </div>
          ))}
        </div>
        
        <Text textCentered marginTop="2rem" color="#ffd700">
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
