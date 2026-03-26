import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import Button from '../components/buttons/Button';
import socket from '../socket';

const WaitingRoomContainer = styled.div`
  max-width: 600px;
  margin: 0 auto;
`;

const PlayerList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
`;

const PlayerCard = styled.div`
  background: ${props => props.theme.colors.playingCardBg};
  padding: 1rem;
  border-radius: ${props => props.theme.other.stdBorderRadius};
  text-align: center;
  border: 2px solid ${props => props.isMe ? props.theme.colors.primaryCta : 'transparent'};
  position: relative;
  
  .avatar {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    margin: 0 auto 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }
`;

const CountdownDisplay = styled.div`
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  padding: 2rem;
  border-radius: 15px;
  text-align: center;
  margin: 1.5rem 0;
  
  .timer {
    font-size: 3rem;
    font-weight: bold;
    color: #ffd700;
    font-family: monospace;
  }
  
  .progress-bar {
    height: 8px;
    background: rgba(255,255,255,0.1);
    border-radius: 4px;
    margin-top: 1rem;
    overflow: hidden;
    
    .progress {
      height: 100%;
      background: linear-gradient(90deg, #4caf50, #8bc34a);
      transition: width 1s linear;
    }
  }
`;

const TournamentInfo = styled.div`
  background: rgba(0, 0, 0, 0.3);
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    
    &:last-child {
      border-bottom: none;
    }
    
    .label {
      color: ${props => props.theme.colors.textSecondary};
    }
    
    .value {
      font-weight: bold;
      color: ${props => props.theme.colors.textPrimary};
    }
  }
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  background: ${props => props.isReady ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)'};
  border-radius: 8px;
  margin-bottom: 1rem;
  
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${props => props.isReady ? '#4caf50' : '#ff9800'};
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
`;

const TournamentWaitingRoom = ({ walletAddress }) => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [requiredPlayers, setRequiredPlayers] = useState(6);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [waitingTime, setWaitingTime] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch tournament details
    fetchTournamentDetails();
    
    // Join tournament room
    socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
      tournamentId,
      walletAddress
    });
    
    // Listen for updates
    socket.on('SC_TOURNAMENT_ROOM_JOINED', handleRoomJoined);
    socket.on('SC_TOURNAMENT_PLAYER_JOINED_ROOM', handlePlayerJoined);
    socket.on('SC_TOURNAMENT_PLAYER_LEFT_ROOM', handlePlayerLeft);
    socket.on('tournament_update', handleTournamentUpdate);
    socket.on('SC_TOURNAMENT_STARTED', handleTournamentStarted);
    socket.on('SC_TOURNAMENT_CANCELLED', handleTournamentCancelled);
    
    return () => {
      socket.off('SC_TOURNAMENT_ROOM_JOINED');
      socket.off('SC_TOURNAMENT_PLAYER_JOINED_ROOM');
      socket.off('SC_TOURNAMENT_PLAYER_LEFT_ROOM');
      socket.off('tournament_update');
      socket.off('SC_TOURNAMENT_STARTED');
      socket.off('SC_TOURNAMENT_CANCELLED');
      socket.emit('CS_TOURNAMENT_ROOM_LEAVE', { tournamentId });
    };
  }, [tournamentId, walletAddress]);

  const fetchTournamentDetails = async () => {
    try {
      const response = await fetch(`/api/tournament/${tournamentId}`);
      const data = await response.json();
      
      if (data.success) {
        setTournament(data.tournament);
        setPlayers(data.tournament.players || []);
        setPlayerCount(data.tournament.players?.length || 0);
        setRequiredPlayers(data.tournament.config?.playerCount || 6);
      }
    } catch (err) {
      setError('Failed to load tournament details');
    }
  };

  const handleRoomJoined = useCallback((data) => {
    setTournament(data.tournament);
    setPlayers(data.tournament?.players || []);
    setPlayerCount(data.playerCount);
  }, []);

  const handlePlayerJoined = useCallback((data) => {
    setPlayerCount(data.playerCount);
    fetchTournamentDetails(); // Refresh player list
  }, []);

  const handlePlayerLeft = useCallback((data) => {
    setPlayerCount(data.playerCount);
    fetchTournamentDetails();
  }, []);

  const handleTournamentUpdate = useCallback((data) => {
    if (data.type === 'waiting_status') {
      setPlayerCount(data.playersJoined);
      setRequiredPlayers(data.playersRequired);
      setTimeRemaining(data.timeRemaining);
      setWaitingTime(data.waitingTime);
    }
  }, []);

  const handleTournamentStarted = useCallback(() => {
    setIsStarting(true);
    // Navigate to game table
    setTimeout(() => {
      navigate(`/tournament/${tournamentId}/play`);
    }, 1000);
  }, [navigate, tournamentId]);

  const handleTournamentCancelled = useCallback((data) => {
    setError(`Tournament cancelled: ${data.reason}`);
    setTimeout(() => navigate('/tournament'), 3000);
  }, [navigate]);

  const handleLeaveTournament = async () => {
    try {
      await fetch(`/api/tournament/${tournamentId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
      navigate('/tournament');
    } catch (err) {
      setError('Failed to leave tournament');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = requiredPlayers > 0 ? (playerCount / requiredPlayers) * 100 : 0;
  const isReady = playerCount >= requiredPlayers;

  return (
    <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem">
      <WaitingRoomContainer>
        <Heading as="h1" textCentered>Waiting Room</Heading>
        
        {error && (
          <Container 
            background="rgba(244, 67, 54, 0.2)" 
            padding="1rem" 
            borderRadius="8px"
            marginTop="1rem"
          >
            <Text color="#f44336">{error}</Text>
          </Container>
        )}

        {/* Status Indicator (Task 15.5) */}
        <StatusIndicator isReady={isReady}>
          <div className="dot" />
          <Text bold>
            {isStarting ? 'Starting...' : 
             isReady ? 'Tournament Ready!' : 
             `Waiting for ${requiredPlayers - playerCount} more player(s)...`}
          </Text>
        </StatusIndicator>

        {/* Countdown for scheduled tournaments (Task 15.6) */}
        {tournament?.config?.startMode === 'SCHEDULED' && timeRemaining > 0 && (
          <CountdownDisplay>
            <Text size="0.9rem" color="textSecondary">Tournament starts in</Text>
            <div className="timer">{formatTime(timeRemaining)}</div>
            <div className="progress-bar">
              <div 
                className="progress" 
                style={{ width: `${Math.max(0, 100 - (timeRemaining / 600) * 100)}%` }}
              />
            </div>
          </CountdownDisplay>
        )}

        {/* Player Count (Task 15.5) */}
        <CountdownDisplay>
          <Text size="0.9rem" color="textSecondary">Players Joined</Text>
          <div className="timer">{playerCount} / {requiredPlayers}</div>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progressPercent}%` }} />
          </div>
        </CountdownDisplay>

        {/* Tournament Info */}
        <TournamentInfo>
          <div className="info-row">
            <span className="label">Buy-in</span>
            <span className="value">{tournament?.buyIn || '?'} TRX</span>
          </div>
          <div className="info-row">
            <span className="label">Prize Pool</span>
            <span className="value">
              {tournament?.prizePool || (tournament?.buyIn * requiredPlayers * 0.95)?.toFixed(0)} TRX
            </span>
          </div>
          <div className="info-row">
            <span className="label">Initial Chips</span>
            <span className="value">{tournament?.config?.initialChips?.toLocaleString() || '1,000'}</span>
          </div>
          <div className="info-row">
            <span className="label">Type</span>
            <span className="value">
              {tournament?.config?.tournamentType === 'SNG' ? 'Sit & Go' : 'Scheduled'}
            </span>
          </div>
          {waitingTime > 0 && (
            <div className="info-row">
              <span className="label">Time Waiting</span>
              <span className="value">{formatTime(waitingTime)}</span>
            </div>
          )}
        </TournamentInfo>

        {/* Player List (Task 15.5) */}
        <Heading as="h3">Players ({playerCount}/{requiredPlayers})</Heading>
        <PlayerList>
          {players.map((player, index) => (
            <PlayerCard key={index} isMe={player.address === walletAddress}>
              <div className="avatar">🃏</div>
              <Text bold size="0.9rem">
                {player.name || player.address?.slice(0, 8)}...
              </Text>
              {player.address === walletAddress && (
                <Text size="0.7rem" color="primaryCta">(You)</Text>
              )}
            </PlayerCard>
          ))}
          {/* Empty slots */}
          {[...Array(Math.max(0, requiredPlayers - players.length))].map((_, i) => (
            <PlayerCard key={`empty-${i}`}>
              <div className="avatar" style={{ background: '#333' }}>?</div>
              <Text size="0.9rem" color="textSecondary">Waiting...</Text>
            </PlayerCard>
          ))}
        </PlayerList>

        {/* Actions */}
        <Container marginTop="2rem" gap="1rem" flexDirection="row" justifyContent="center">
          <Button 
            onClick={handleLeaveTournament} 
            text="Leave Tournament"
            disabled={isStarting}
          />
        </Container>
      </WaitingRoomContainer>
    </Container>
  );
};

export default TournamentWaitingRoom;
