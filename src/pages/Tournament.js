import React, { useState, useEffect, useContext, useCallback } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import globalContext from '../context/global/globalContext';
import locaContext from '../context/localization/locaContext';
import modalContext from '../context/modal/modalContext';
import { useTron } from '../context/tron/TronContext';
import { useZeroG } from '../context/zero-g/ZeroGContext';
import { getPlayerBalance } from '../utils/tronInteract';
import { getCustodyBalance } from '../utils/zeroGInteract';
import { buildApiUrl } from '../utils/serverConfig';

const MOCK_GAME_ENABLED = process.env.REACT_APP_TOURNAMENT_MOCK_GAME_ENABLED === 'true';

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

const ChipRewardBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #4CAF50, #8BC34A);
  color: white;
  font-size: 0.75rem;
  font-weight: bold;
  margin-left: 0.5rem;
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

const InfoBanner = styled.div`
  background: rgba(36, 81, 106, 0.1);
  border: 1px solid rgba(36, 81, 106, 0.2);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  text-align: center;
`;

const CreateSection = styled.div`
  background: rgba(40, 167, 69, 0.1);
  border: 1px solid rgba(40, 167, 69, 0.3);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  text-align: center;
`;

const MockSection = styled.div`
  background: rgba(147, 51, 234, 0.1);
  border: 1px solid rgba(147, 51, 234, 0.3);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
`;

const MockCheckbox = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  
  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
`;

const MockInfo = styled.span`
  color: #9333ea;
  font-weight: 500;
`;

const CreateButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
`;

const CreateButton = styled.button`
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: #218838;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const RankingModal = styled.div`
  max-width: 400px;
  width: 100%;
`;

const RankingItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  background: ${props => props.isMe ? 'linear-gradient(135deg, #2a5a2a 0%, #1a4a1a 100%)' : 'rgba(70, 130, 180, 0.4)'};
  border-radius: 8px;
  border: ${props => props.isMe ? '2px solid #5c5' : '1px solid rgba(70, 130, 180, 0.6)'};
  color: #fff;
  font-weight: 500;
`;

const Medal = styled.span`
  font-size: 1.2rem;
  margin-right: 0.5rem;
`;

const ErrorBanner = styled.div`
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.3);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  color: #dc3545;
  text-align: center;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  background: rgba(36, 81, 106, 0.05);
  border-radius: 8px;
`;

const Tournament = () => {
  const navigate = useNavigate();
  const { walletAddress, setWalletAddress, setWalletType } = useContext(globalContext);
  const { t } = useContext(locaContext);
  const { openModal } = useContext(modalContext);
  const { connect, isConnecting, isConnected, address } = useTron();
  const {
    address: zeroGAddress,
    isConnected: zeroGConnected,
    connectWallet: connectZeroGWallet,
    switchTo0GNetwork,
  } = useZeroG() || {};

  // Detect blockchain mode from wallet address
  const currentAddress = walletAddress || address || zeroGAddress || localStorage.getItem('wallet_address');
  const isZeroG = (currentAddress || '').startsWith('0x') ||
                   localStorage.getItem('wallet_type') === 'zerog';
  const currencySymbol = isZeroG ? '0G' : 'TRX';
  const currencyDivisor = isZeroG ? 1e9 : 1e6;

  const [tournaments, setTournaments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [mockGame, setMockGame] = useState(() => {
    if (!MOCK_GAME_ENABLED) return false;
    return localStorage.getItem('mockGame') === 'true';
  });

  useEffect(() => {
    if (MOCK_GAME_ENABLED) return;
    try {
      localStorage.removeItem('mockGame');
    } catch (err) {
      // Ignore storage access failures.
    }
    setMockGame(false);
  }, []);

  // 同步 TronContext 地址到 globalContext
  useEffect(() => {
    if (address && address !== walletAddress) {
      setWalletAddress(address);
    }
  }, [address, walletAddress, setWalletAddress]);

  // 同步 ZeroGContext 地址到 globalContext
  useEffect(() => {
    if (zeroGAddress && zeroGAddress !== walletAddress) {
      setWalletAddress(zeroGAddress);
      if (setWalletType) setWalletType('zerog');
      localStorage.setItem('wallet_type', 'zerog');
      localStorage.setItem('wallet_address', zeroGAddress);
    }
  }, [zeroGAddress, walletAddress, setWalletAddress, setWalletType]);

  const persistWallet = useCallback((walletType, nextAddress) => {
    if (!nextAddress) return;
    setWalletAddress(nextAddress);
    if (setWalletType) setWalletType(walletType);
    localStorage.setItem('wallet_type', walletType);
    localStorage.setItem('wallet_address', nextAddress);
    localStorage.setItem('testWalletAddress', nextAddress);
  }, [setWalletAddress, setWalletType]);

  const connectPreferredWallet = useCallback(async () => {
    const savedType = localStorage.getItem('wallet_type');
    const shouldUseZeroG = savedType === 'zerog' ||
      zeroGConnected ||
      (walletAddress || zeroGAddress || '').startsWith('0x') ||
      (!!window.ethereum && !address);

    if (shouldUseZeroG) {
      if (!connectZeroGWallet) {
        throw new Error('0G wallet connector is unavailable');
      }
      const connectedAddress = zeroGAddress || await connectZeroGWallet();
      try {
        await switchTo0GNetwork?.('testnet');
      } catch (networkErr) {
        console.warn('[Tournament] Failed to switch to 0G network:', networkErr.message);
      }
      persistWallet('zerog', connectedAddress);
      return connectedAddress;
    }

    await connect();
    const tronAddress = address || localStorage.getItem('wallet_address');
    if (tronAddress) {
      persistWallet('tron', tronAddress);
    }
    return tronAddress;
  }, [
    address,
    connect,
    connectZeroGWallet,
    persistWallet,
    switchTo0GNetwork,
    walletAddress,
    zeroGAddress,
    zeroGConnected,
  ]);

  // 默认测试配置（当合约未配置时使用）
  const DEFAULT_CONFIGS = [
    { id: 1, playerCount: 6, buyIn: 100000000, rakeRate: 500, name: t('players')(6) + ' (100 ' + currencySymbol + ')' },
    { id: 2, playerCount: 4, buyIn: 100000000, rakeRate: 500, name: t('players')(4) + ' (100 ' + currencySymbol + ')' },
    { id: 3, playerCount: 2, buyIn: 100000000, rakeRate: 500, name: t('players')(2) + ' (100 ' + currencySymbol + ')' },
  ];

  useEffect(() => {
    fetchTournaments();
    fetchConfigs();
  }, [filter]);

  const fetchTournaments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('status', filter);
      }
      const response = await fetch(buildApiUrl(`/api/tournament/list?${params}`));
      const data = await response.json();
      if (data.success) {
        setTournaments(data.tournaments || []);
      } else {
        setError(data.error || t('errLoadFailed'));
      }
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
      setError(t('errNetworkError'));
    }
    setLoading(false);
  };

  const fetchConfigs = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/tournament/configs/list'));
      const data = await response.json();
      if (data.success && data.configs && data.configs.length > 0) {
        setConfigs(data.configs);
      } else {
        // 使用默认配置
        setConfigs(DEFAULT_CONFIGS);
      }
    } catch (error) {
      console.error('Failed to fetch configs, using defaults:', error);
      // 使用默认配置
      setConfigs(DEFAULT_CONFIGS);
    }
  };

  // 创建测试锦标赛
  const handleCreateTestTournament = async (configId) => {
    if (!configId) {
      setError(t('errNoConfig'));
      return;
    }
    
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl('/api/tournament/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          configId, 
          walletAddress,
          mockGame: MOCK_GAME_ENABLED && mockGame
        })
      });
      const data = await response.json();
      if (data.success) {
        fetchTournaments();
      } else {
        setError(t('errCreateFailed') + data.error);
      }
    } catch (error) {
      console.error('Failed to create tournament:', error);
      setError(t('errCreateFailed') + error.message);
    }
    setCreating(false);
  };

  const handleJoinTournament = async (tournamentId, buyIn, addressOverride) => {
    const joinTournament = async (joinAddress) => {
      const effectiveAddress = joinAddress || address || zeroGAddress || walletAddress || localStorage.getItem('wallet_address');
      if (!effectiveAddress) {
        throw new Error(t('errNoAddress'));
      }

      try {
        setError(null);
        const isJoiningZeroG = effectiveAddress.startsWith('0x') ||
          localStorage.getItem('wallet_type') === 'zerog';
        
        // Fetch game balance from contract (0G uses custody balance, TRON uses player balance)
        let clientBalance = 0;
        try {
          if (isJoiningZeroG) {
            const custBal = await getCustodyBalance(effectiveAddress);
            clientBalance = parseFloat(custBal) * 1e18;
            console.log('[Tournament] Client-side 0G custody balance:', custBal, '0G');
          } else {
            const balInfo = await getPlayerBalance(effectiveAddress);
            clientBalance = (balInfo.balance || 0) + (balInfo.locked || 0);
            console.log('[Tournament] Client-side TRX balance:', clientBalance / 1e6, 'TRX');
          }
        } catch (e) {
          console.warn('[Tournament] Failed to get client balance, will use server check:', e.message);
        }
        
        const response = await fetch(buildApiUrl(`/api/tournament/${tournamentId}/join`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            walletAddress: effectiveAddress,
            clientBalance  // Pass browser-fetched balance for server-side validation
          })
        });
        const data = await response.json();
        if (data.success) {
          // 关闭弹窗 - 通过触发closeModal
          const modal = document.querySelector('[id="wrapper"]');
          if (modal) modal.click();
          
          persistWallet(isJoiningZeroG ? 'zerog' : 'tron', effectiveAddress);
          
          // 导航到游戏页面，传递钱包地址参数
          navigate(`/tournament/${tournamentId}/play?address=${effectiveAddress}`);
        } else {
          throw new Error(t('errJoinFailed') + (data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Failed to join tournament:', error);
        setError(error.message.startsWith(t('errJoinFailed')) ? error.message : t('errJoinFailed') + error.message);
        throw error;
      }
    };

    const existingAddress = addressOverride || address || zeroGAddress || walletAddress || localStorage.getItem('wallet_address');
    if (!existingAddress && !isConnected && !zeroGConnected) {
      const handleConnectAndJoin = async () => {
        try {
          const connectedAddress = await connectPreferredWallet();
          if (!connectedAddress) {
            throw new Error(t('errNoAddress'));
          }
          await joinTournament(connectedAddress);
        } catch (err) {
          setError(t('errConnectFailed') + err.message);
          throw err;
        }
      };

      openModal(
        () => <Text>Please connect your wallet to join a tournament.</Text>,
        'Wallet Required',
        isConnecting ? 'Connecting...' : 'Connect Wallet',
        handleConnectAndJoin
      );
      return;
    }

    openModal(
      () => (
        <Container flexDirection="column" gap="1rem">
          <Text>Buy-in: {(buyIn / currencyDivisor).toFixed(isZeroG ? 2 : 0)} {currencySymbol}</Text>
          <Text>Are you sure you want to join this tournament?</Text>
        </Container>
      ),
      'Join Tournament',
      'Confirm',
      () => joinTournament(existingAddress)
    );
  };

  const formatPrizePool = (tournament) => {
    const totalPot = tournament.buyIn * tournament.playerCount;
    const afterRake = totalPot * (1 - tournament.rakeRate / 10000);
    return `${(afterRake / currencyDivisor).toFixed(isZeroG ? 2 : 0)} ${currencySymbol}`;
  };

  // View tournament rankings (for completed tournaments)
  const handleViewRankings = async (tournament) => {
    try {
      const response = await fetch(buildApiUrl(`/api/tournament/${tournament.tournamentId}`));
      const data = await response.json();

      if (!data.success) {
        setError(t('errGetRankFailed') + data.error);
        return;
      }

      const rankings = data.tournament?.rankings || [];
      const players = data.tournament?.players || [];
      const rakeAmount = data.tournament?.rakeAmount || 0;

      openModal(
        () => (
          <RankingModal>
            <Heading as="h3" textCentered marginBottom="1rem">
              Tournament #{tournament.tournamentId} Results
            </Heading>
            {rankings.length === 0 ? (
              <Text textCentered color="textSecondary">No rankings available</Text>
            ) : (
              rankings.map((ranking, index) => {
                const address = ranking.address || ranking;
                const isMe = address === walletAddress || address === address;
                const position = index + 1;
                const playerInfo = players.find(p =>
                  p.address === address || p.address?.toLowerCase() === address?.toLowerCase()
                );
                const chipReward = playerInfo?.chipReward;

                return (
                  <RankingItem key={index} isMe={address === walletAddress}>
                    <span>
                      <Medal>
                        {position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`}
                      </Medal>
                      {address === walletAddress ? 'You' : `${address.substring(0, 10)}...`}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      {playerInfo?.prizeAmount > 0 && (
                        <span style={{ color: '#ffd700' }}>
                          {(playerInfo.prizeAmount / currencyDivisor).toLocaleString()} {currencySymbol}
                        </span>
                      )}
                      {chipReward > 0 && (
                        <span style={{ color: '#4CAF50', fontSize: '0.85rem' }}>
                          +{chipReward} CHIP 🎁
                        </span>
                      )}
                    </div>
                  </RankingItem>
                );
              })
            )}
            {rakeAmount > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <Text size="0.8rem" color="textSecondary" textCentered>
                  Rake: {(rakeAmount / currencyDivisor).toFixed(isZeroG ? 4 : 1)} {currencySymbol} (5%)
                </Text>
              </div>
            )}
          </RankingModal>
        ),
        'Final Rankings',
        'Close',
        () => {}
      );
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
      setError(t('errGetRankFailed') + error.message);
    }
  };

  return (
    <Container
      fullHeight
      flexDirection="column"
      padding="6rem 2rem 2rem 2rem"
      data-testid="tournament-page"
    >
      <Heading as="h1" textCentered>Tournaments</Heading>
      
      <InfoBanner>
        <Text>{t("tournamentHint")}</Text>
      </InfoBanner>
      
      {/* Mock 游戏开关 - 仅测试网显示 */}
      {process.env.REACT_APP_NETWORK === 'testnet' && MOCK_GAME_ENABLED && (
      <MockSection data-testid="mock-game-section">
        <MockCheckbox>
          <input
            type="checkbox"
            checked={mockGame}
            onChange={(e) => {
              const newValue = e.target.checked;
              setMockGame(newValue);
              localStorage.setItem('mockGame', newValue);
              console.log('[Mock Game] Set to:', newValue);
            }}
            data-testid="mock-game-checkbox"
          />
          <MockInfo>{t("mockMode")}</MockInfo>
        </MockCheckbox>
        <Text size="0.8rem" color="textSecondary">
          {mockGame ? t('mockModeOn') : t('mockModeOff')}
        </Text>
      </MockSection>
      )}
      
      {/* 测试：创建锦标赛按钮 - 始终显示 */}
      <CreateSection data-testid="create-tournament-section">
        <Text size="0.85rem">{t("testModeTitle")}</Text>
        <CreateButtons>
          {configs.map(config => (
            <CreateButton 
              key={config.id}
              onClick={() => handleCreateTestTournament(config.id)}
              disabled={creating}
              data-testid={`create-tournament-btn-${config.id}`}
            >
              {creating ? t('creating') : t('players')(config.playerCount) + ' (' + (config.buyIn / currencyDivisor).toFixed(isZeroG ? 2 : 0) + ' ' + currencySymbol + ')'}
            </CreateButton>
          ))}
        </CreateButtons>
      </CreateSection>
      
      {/* 错误提示 */}
      {error && <ErrorBanner data-testid="error-message">{error}</ErrorBanner>}
      
      <FilterBar>
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} data-testid="filter-all">
          All
        </FilterButton>
        <FilterButton active={filter === 'WAITING'} onClick={() => setFilter('WAITING')} data-testid="filter-waiting">
          Waiting
        </FilterButton>
        <FilterButton active={filter === 'IN_PROGRESS'} onClick={() => setFilter('IN_PROGRESS')} data-testid="filter-in-progress">
          In Progress
        </FilterButton>
        <FilterButton active={filter === 'COMPLETED'} onClick={() => setFilter('COMPLETED')} data-testid="filter-completed">
          Completed
        </FilterButton>
      </FilterBar>

      {loading ? (
        <Text textCentered data-testid="loading-text">Loading tournaments...</Text>
      ) : tournaments.length === 0 ? (
        <EmptyState data-testid="empty-state">
          <Text textCentered>No tournaments available</Text>
          <Text size="0.85rem" color="textSecondary">{t("noTournaments")}</Text>
        </EmptyState>
      ) : (
        <TournamentGrid>
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.tournamentId}
              onClick={() => {
                if (tournament.status === 'WAITING') {
                  handleJoinTournament(tournament.tournamentId, tournament.buyIn);
                } else if (tournament.status === 'COMPLETED') {
                  handleViewRankings(tournament);
                }
              }}
              data-testid={`tournament-card-${tournament.tournamentId}`}
            >
              <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                <Heading as="h3">{tournament.config?.name || `Tournament #${tournament.tournamentId}`}</Heading>
                <StatusBadge status={tournament.status}>{tournament.status}</StatusBadge>
              </Container>
              
              <Container flexDirection="row" justifyContent="space-between" marginTop="1rem">
                <div>
                  <Text size="0.8rem" color="textSecondary">Buy-in</Text>
                  <BuyInAmount>{(tournament.buyIn / currencyDivisor).toFixed(isZeroG ? 2 : 0)} {currencySymbol}</BuyInAmount>
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

              {/* CHIP Reward提示 */}
              {tournament.status === 'WAITING' && (
                <Container marginTop="0.75rem">
                  <Text size="0.75rem" color="#4CAF50">
                    🎁 Winner gets CHIP bonus based on VIP level!
                  </Text>
                </Container>
              )}

              {/* 已完成锦标赛的CHIP奖励显示 */}
              {tournament.status === 'COMPLETED' && tournament.rakeAmount && (
                <Container marginTop="0.75rem">
                  <Text size="0.75rem" color="#4CAF50">
                    🎁 CHIP rewards distributed!
                  </Text>
                </Container>
              )}
              
              <Container marginTop="1rem">
                <Text size="0.8rem" color="textSecondary">
                  {tournament.config?.tournamentType === 'SNG' ? 'Sit & Go' : 'Scheduled'} • 
                  {tournament.config?.startMode === 'INSTANT' ? ' Starts when full' : ` Starts at ${new Date(tournament.startTime).toLocaleString()}`}
                </Text>
              </Container>
              
              {/* Show hint for completed tournaments */}
              {tournament.status === 'COMPLETED' && (
                <Container marginTop="0.5rem">
                  <Text size="0.75rem" color="textSecondary" style={{ fontStyle: 'italic' }}>
                    📊 Click to view final rankings
                  </Text>
                </Container>
              )}
            </TournamentCard>
          ))}
        </TournamentGrid>
      )}
    </Container>
  );
};

export default Tournament;
