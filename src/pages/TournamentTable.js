import React, { useState, useEffect, useContext, useCallback } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import Button from '../components/buttons/Button';
import globalContext from '../context/global/globalContext';
import socket from '../socket';

const GameTable = styled.div`
  background: linear-gradient(180deg, #1a472a 0%, #0d2818 100%);
  border-radius: 20px;
  padding: 2rem;
  min-height: 500px;
  position: relative;
  border: 8px solid #2d1b0e;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
`;

const TableInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  margin-bottom: 1rem;
`;

const ChipStack = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffd700;
`;

const PlayerSeat = styled.div`
  position: absolute;
  width: 120px;
  padding: 1rem;
  background: ${props => props.isActive ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)'};
  border-radius: 10px;
  text-align: center;
  border: 2px solid ${props => props.isFolded ? '#666' : props.isActive ? '#ffd700' : '#333'};
  
  /* Position based on seat index */
  ${props => {
    const positions = {
      1: { top: '10%', left: '50%', transform: 'translateX(-50%)' },
      2: { top: '30%', right: '5%' },
      3: { bottom: '30%', right: '5%' },
      4: { bottom: '10%', left: '50%', transform: 'translateX(-50%)' },
      5: { bottom: '30%', left: '5%' },
      6: { top: '30%', left: '5%' }
    };
    return positions[props.seatId] || {};
  }}
`;

const CardDisplay = styled.div`
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  margin: 0.5rem 0;
`;

const Card = styled.div`
  width: 40px;
  height: 56px;
  background: ${props => props.hidden ? 'linear-gradient(135deg, #1a237e, #3949ab)' : 'white'};
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: bold;
  color: ${props => props.hidden ? 'transparent' : props.suit === '♥' || props.suit === '♦' ? '#d32f2f' : '#000'};
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;

const CommunityCards = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin: 2rem 0;
`;

const PotDisplay = styled.div`
  text-align: center;
  margin: 1rem 0;
  
  .pot-amount {
    font-size: 2rem;
    font-weight: bold;
    color: #ffd700;
    text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
`;

const TournamentInfo = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  margin-bottom: 1rem;
  
  .info-item {
    text-align: center;
    
    .label {
      font-size: 0.75rem;
      color: #aaa;
    }
    
    .value {
      font-size: 1.1rem;
      font-weight: bold;
      color: #fff;
    }
  }
`;

const EliminationPopup = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.95);
  padding: 2rem 3rem;
  border-radius: 20px;
  text-align: center;
  z-index: 1000;
  border: 3px solid #f44336;
  box-shadow: 0 0 50px rgba(244, 67, 54, 0.5);
  
  h2 {
    color: #f44336;
    margin-bottom: 1rem;
  }
`;

const RankingDisplay = styled.div`
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  padding: 2rem;
  border-radius: 15px;
  margin-top: 1rem;
  
  .rank-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    margin: 0.5rem 0;
    background: rgba(255,255,255,0.1);
    border-radius: 8px;
    
    &.you {
      background: rgba(255, 215, 0, 0.2);
      border: 1px solid #ffd700;
    }
    
    .position {
      font-weight: bold;
      color: ${props => props.position <= 3 ? '#ffd700' : '#fff'};
    }
    
    .prize {
      color: #4caf50;
    }
  }
`;

const TournamentTable = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { walletAddress } = useContext(globalContext);
  
  const [gameState, setGameState] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [isEliminated, setIsEliminated] = useState(false);
  const [finalPosition, setFinalPosition] = useState(null);
  const [showRankings, setShowRankings] = useState(false);
  const [rankings, setRankings] = useState([]);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    
    // Join tournament room
    socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
      tournamentId,
      walletAddress
    });
    
    // Listen for game state updates
    socket.on('tournament_game_state', handleGameState);
    socket.on('tournament_update', handleTournamentUpdate);
    socket.on('SC_TOURNAMENT_RECONNECTED', handleReconnected);
    socket.on('SC_TOURNAMENT_RECONNECT_FAILED', handleReconnectFailed);
    
    return () => {
      socket.off('tournament_game_state');
      socket.off('tournament_update');
      socket.off('SC_TOURNAMENT_RECONNECTED');
      socket.off('SC_TOURNAMENT_RECONNECT_FAILED');
      socket.emit('CS_TOURNAMENT_ROOM_LEAVE', { tournamentId });
    };
  }, [tournamentId, walletAddress]);

  const handleGameState = useCallback((state) => {
    setGameState(state);
    
    // Check if current player is eliminated
    const mySeat = Object.values(state.seats || {}).find(
      seat => seat?.player?.id === walletAddress
    );
    
    if (mySeat?.folded && mySeat?.stack === 0) {
      setIsEliminated(true);
    }
  }, [walletAddress]);

  const handleTournamentUpdate = useCallback((data) => {
    if (data.type === 'player_eliminated' && data.player === walletAddress) {
      setFinalPosition(data.position);
      setIsEliminated(true);
    }
    
    if (data.type === 'tournament_ended') {
      setRankings(data.rankings || []);
      setShowRankings(true);
    }
  }, [walletAddress]);

  const handleReconnected = useCallback((data) => {
    setReconnecting(false);
    console.log('Reconnected to tournament:', data);
  }, []);

  const handleReconnectFailed = useCallback((data) => {
    setReconnecting(false);
    console.error('Reconnect failed:', data.error);
    navigate('/tournament');
  }, [navigate]);

  const handleAction = (actionType, amount = 0) => {
    socket.emit(`CS_TOURNAMENT_${actionType.toUpperCase()}`, {
      tournamentId,
      amount
    });
  };

  const handleClaimPrize = async () => {
    try {
      const response = await fetch(`/api/tournament/${tournamentId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      
      const data = await response.json();
      if (data.success) {
        // Show success and redirect
        navigate('/tournament');
      }
    } catch (error) {
      console.error('Failed to claim prize:', error);
    }
  };

  const renderCard = (card, hidden = false) => {
    if (hidden || !card || card.rank === 'hidden') {
      return <Card hidden key={Math.random()} />;
    }
    return (
      <Card suit={card.suit} key={Math.random()}>
        {card.rank}{card.suit}
      </Card>
    );
  };

  const mySeat = gameState?.seats ? 
    Object.entries(gameState.seats).find(([_, seat]) => seat?.player?.id === walletAddress) : null;
  const isMyTurn = gameState?.turn && mySeat && gameState.turn === parseInt(mySeat[0]);
  const myStack = mySeat ? mySeat[1].stack : 0;

  if (!gameState) {
    return (
      <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
        <Heading as="h2" textCentered>Loading tournament...</Heading>
      </Container>
    );
  }

  return (
    <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
      {/* Tournament Info Bar */}
      <TournamentInfo>
        <div className="info-item">
          <div className="label">Tournament</div>
          <div className="value">#{tournamentId}</div>
        </div>
        <div className="info-item">
          <div className="label">Initial Chips</div>
          <div className="value">{gameState.initialChips?.toLocaleString()}</div>
        </div>
        <div className="info-item">
          <div className="label">Blinds</div>
          <div className="value">{gameState.smallBlind}/{gameState.bigBlind}</div>
        </div>
        <div className="info-item">
          <div className="label">Remaining</div>
          <div className="value">{gameState.remainingPlayers?.length || '?'}</div>
        </div>
      </TournamentInfo>

      {/* Player Info */}
      <TableInfo>
        <ChipStack>
          <span>💰</span>
          <span>My Stack: {myStack.toLocaleString()}</span>
        </ChipStack>
        {isMyTurn && (
          <Text color="#ffd700" bold>YOUR TURN!</Text>
        )}
      </TableInfo>

      {/* Game Table */}
      <GameTable>
        {/* Player Seats */}
        {Object.entries(gameState.seats || {}).map(([seatId, seat]) => {
          if (!seat || !seat.player) return null;
          
          const isMe = seat.player.id === walletAddress;
          const isActive = gameState.turn === parseInt(seatId);
          
          return (
            <PlayerSeat 
              key={seatId} 
              seatId={parseInt(seatId)}
              isActive={isActive}
              isFolded={seat.folded}
            >
              <Text size="0.85rem" bold={isMe}>
                {seat.player.name || seat.player.id.slice(0, 8)}
                {isMe && ' (You)'}
              </Text>
              <Text size="0.8rem" color="#ffd700">
                {seat.stack.toLocaleString()}
              </Text>
              <CardDisplay>
                {seat.hand?.map((card, i) => 
                  renderCard(card, !isMe && !gameState.wentToShowdown && !seat.folded)
                ) || (seat.folded && <Text size="0.7rem" color="#666">Folded</Text>)}
              </CardDisplay>
              {seat.lastAction && (
                <Text size="0.7rem" color="#aaa">{seat.lastAction}</Text>
              )}
            </PlayerSeat>
          );
        })}

        {/* Community Cards */}
        <CommunityCards>
          {gameState.board?.map((card, i) => renderCard(card))}
        </CommunityCards>

        {/* Pot */}
        <PotDisplay>
          <Text size="0.8rem" color="#aaa">POT</Text>
          <div className="pot-amount">{gameState.pot?.toLocaleString()}</div>
        </PotDisplay>
      </GameTable>

      {/* Action Buttons */}
      {isMyTurn && !isEliminated && (
        <ActionButtons>
          <Button onClick={() => handleAction('fold')} text="Fold" />
          {gameState.callAmount === 0 && (
            <Button onClick={() => handleAction('check')} text="Check" />
          )}
          {gameState.callAmount > 0 && (
            <Button onClick={() => handleAction('call')} text={`Call ${gameState.callAmount}`} />
          )}
          <Button 
            onClick={() => {
              const raiseAmount = prompt('Enter raise amount:', gameState.minBet);
              if (raiseAmount) handleAction('raise', parseInt(raiseAmount));
            }} 
            text="Raise" 
          />
        </ActionButtons>
      )}

      {/* Elimination Popup (Task 16.3) */}
      {isEliminated && !showRankings && (
        <EliminationPopup>
          <Heading as="h2">Eliminated!</Heading>
          <Text size="1.2rem">You finished in position #{finalPosition || '?'}</Text>
          <Container marginTop="1rem">
            <Button onClick={() => navigate('/tournament')} text="Back to Lobby" />
          </Container>
        </EliminationPopup>
      )}

      {/* Final Rankings (Task 16.4) */}
      {showRankings && (
        <RankingDisplay position={finalPosition}>
          <Heading as="h3" textCentered>Final Rankings</Heading>
          {rankings.map((rank, i) => (
            <div key={i} className={`rank-item ${rank.address === walletAddress ? 'you' : ''}`}>
              <span className="position">#{rank.position}</span>
              <span>{rank.address?.slice(0, 10)}...</span>
              <span className="prize">{rank.prize?.toLocaleString()} TRX</span>
            </div>
          ))}
          <Container marginTop="1rem">
            <Button onClick={handleClaimPrize} text="Claim Prize" />
          </Container>
        </RankingDisplay>
      )}

      {/* Reconnecting Overlay (Task 16.6) */}
      {reconnecting && (
        <EliminationPopup>
          <Heading as="h2">Reconnecting...</Heading>
          <Text>Please wait while we restore your game session.</Text>
        </EliminationPopup>
      )}
    </Container>
  );
};

export default TournamentTable;
