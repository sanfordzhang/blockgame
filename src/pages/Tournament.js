import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import globalContext from '../context/global/globalContext';
import modalContext from '../context/modal/modalContext';

const TournamentCard = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: ${(props) => props.theme.other.cardDropShadow};
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-2px);
  }
`;

const TournamentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const StatusBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: bold;
  background: ${props => {
    switch(props.status) {
      case 'WAITING': return '#FFA500';
      case 'IN_PROGRESS': return '#4CAF50';
      case 'COMPLETED': return '#2196F3';
      case 'CANCELLED': return '#f44336';
      default: return '#9E9E9E';
    }
  }};
  color: white;
`;

const PlayerCount = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: ${(props) => props.theme.colors.textSecondary};
`;

const BuyInAmount = styled.div`
  font-size: 1.25rem;
  font-weight: bold;
  color: ${(props) => props.theme.colors.primaryCta};
`;

const PrizePool = styled.div`
  background: linear-gradient(135deg, #FFD700, #FFA500);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 1.1rem;
  font-weight: bold;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const FilterButton = styled.button`
  padding: 0.5rem 1rem;
  border: 2px solid ${(props) => props.active ? props.theme.colors.primaryCta : 'transparent'};
  border-radius: 0.5rem;
  background: ${(props) => props.active ? props.theme.colors.primaryCta : props.theme.colors.playingCardBg};
  color: ${(props) => props.active ? 'white' : props.theme.colors.textPrimary};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: ${(props) => props.theme.colors.primaryCta};
  }
`;

const Tournament = () => {
  const navigate = useNavigate();
  const { walletAddress } = useContext(globalContext);
  const { openModal } = useContext(modalContext);
  
  const [tournaments, setTournaments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, [filter]);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('status', filter);
      }
      const response = await fetch(`/api/tournament/list?${params}`);
      const data = await response.json();
      if (data.success) {
        setTournaments(data.tournaments);
      }
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
    }
    setLoading(false);
  };

  const handleJoinTournament = async (tournamentId, buyIn) => {
    if (!walletAddress) {
      openModal(
        () => <Text>Please connect your wallet to join a tournament.</Text>,
        'Wallet Required',
        'Connect Wallet'
      );
      return;
    }

    openModal(
      () => (
        <Container flexDirection="column" gap="1rem">
          <Text>Buy-in: {buyIn} TRX</Text>
          <Text>Are you sure you want to join this tournament?</Text>
        </Container>
      ),
      'Join Tournament',
      'Confirm',
      async () => {
        try {
          const response = await fetch(`/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress })
          });
          const data = await response.json();
          if (data.success) {
            navigate(`/tournament/${tournamentId}/play`);
          }
        } catch (error) {
          console.error('Failed to join tournament:', error);
        }
      }
    );
  };

  const formatPrizePool = (tournament) => {
    const totalPot = tournament.buyIn * tournament.playerCount;
    const afterRake = totalPot * (1 - tournament.rakeRate / 10000);
    return `${afterRake.toFixed(0)} TRX`;
  };

  return (
    <Container
      fullHeight
      flexDirection="column"
      padding="6rem 2rem 2rem 2rem"
    >
      <Heading as="h1" textCentered>Tournaments</Heading>
      
      <FilterBar>
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterButton>
        <FilterButton active={filter === 'WAITING'} onClick={() => setFilter('WAITING')}>
          Waiting
        </FilterButton>
        <FilterButton active={filter === 'IN_PROGRESS'} onClick={() => setFilter('IN_PROGRESS')}>
          In Progress
        </FilterButton>
        <FilterButton active={filter === 'COMPLETED'} onClick={() => setFilter('COMPLETED')}>
          Completed
        </FilterButton>
      </FilterBar>

      {loading ? (
        <Text textCentered>Loading tournaments...</Text>
      ) : tournaments.length === 0 ? (
        <Text textCentered>No tournaments available</Text>
      ) : (
        <TournamentGrid>
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              onClick={() => tournament.status === 'WAITING' && handleJoinTournament(tournament.id, tournament.buyIn)}
            >
              <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                <Heading as="h3">{tournament.config?.name || `Tournament #${tournament.id}`}</Heading>
                <StatusBadge status={tournament.status}>{tournament.status}</StatusBadge>
              </Container>
              
              <Container flexDirection="row" justifyContent="space-between" marginTop="1rem">
                <div>
                  <Text size="0.8rem" color="textSecondary">Buy-in</Text>
                  <BuyInAmount>{tournament.buyIn} TRX</BuyInAmount>
                </div>
                <div>
                  <Text size="0.8rem" color="textSecondary">Prize Pool</Text>
                  <PrizePool>{formatPrizePool(tournament)}</PrizePool>
                </div>
                <div>
                  <Text size="0.8rem" color="textSecondary">Players</Text>
                  <PlayerCount>
                    {tournament.players?.length || 0} / {tournament.config?.playerCount || 6}
                  </PlayerCount>
                </div>
              </Container>
              
              <Container marginTop="1rem">
                <Text size="0.8rem" color="textSecondary">
                  {tournament.config?.tournamentType === 'SNG' ? 'Sit & Go' : 'Scheduled'} • 
                  {tournament.config?.startMode === 'INSTANT' ? ' Starts when full' : ` Starts at ${new Date(tournament.startTime).toLocaleString()}`}
                </Text>
              </Container>
            </TournamentCard>
          ))}
        </TournamentGrid>
      )}
    </Container>
  );
};

export default Tournament;
