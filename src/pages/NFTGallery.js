import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import Button from '../components/buttons/Button';
import globalContext from '../context/global/globalContext';
import modalContext from '../context/modal/modalContext';
import socket from '../socket';
import PokerCard from '../components/game/PokerCard';

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
`;

const NFTCard = styled.div`
  background: linear-gradient(145deg, #1e2130, #161820);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.05);

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    border-color: ${props => {
      switch(props.rarity) {
        case 'LEGENDARY': return 'rgba(255, 215, 0, 0.5)';
        case 'EPIC': return 'rgba(156, 39, 176, 0.5)';
        case 'RARE': return 'rgba(33, 150, 243, 0.5)';
        default: return 'rgba(255, 255, 255, 0.1)';
      }
    }};
  }
`;

const NFTImage = styled.div`
  width: 100%;
  height: 220px;
  background: ${props => {
    switch(props.rarity) {
      case 'LEGENDARY': return 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
      case 'EPIC': return 'linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 50%, #4a1259 100%)';
      case 'RARE': return 'linear-gradient(135deg, #1a1a2e 0%, #1a3a5c 50%, #0d4f8a 100%)';
      case 'UNCOMMON': return 'linear-gradient(135deg, #1a1a2e 0%, #1a3d2e 50%, #0d5a32 100%)';
      default: return 'linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 50%, #3a3a4e 100%)';
    }
  }};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: ${props => {
      switch(props.rarity) {
        case 'LEGENDARY': return 'radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 50%)';
        case 'EPIC': return 'radial-gradient(circle, rgba(156, 39, 176, 0.1) 0%, transparent 50%)';
        case 'RARE': return 'radial-gradient(circle, rgba(33, 150, 243, 0.1) 0%, transparent 50%)';
        default: return 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 50%)';
      }
    }};
    animation: rotate 20s linear infinite;
  }
  
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const AchievementIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  z-index: 1;
`;

const CardsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  z-index: 1;
  
  .poker-card-wrapper {
    margin: 0 !important;
    animation: none !important;
    opacity: 1 !important;
  }
  
  img {
    width: 40px !important;
    max-width: 40px !important;
    min-width: 40px !important;
    box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }
`;

const HoleCardsContainer = styled.div`
  display: flex;
  gap: -8px;
  margin-bottom: 0.25rem;
  z-index: 1;
  
  img {
    width: 45px !important;
    max-width: 45px !important;
    min-width: 45px !important;
    box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.4);
  }
`;

const BoardCardsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
  z-index: 1;
  
  img {
    width: 35px !important;
    max-width: 35px !important;
    min-width: 35px !important;
  }
`;

const NFTInfo = styled.div`
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
`;

const RarityBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  background: ${props => {
    switch(props.rarity) {
      case 'LEGENDARY': return 'linear-gradient(135deg, #FFD700, #FFA500)';
      case 'EPIC': return 'linear-gradient(135deg, #9C27B0, #7B1FA2)';
      case 'RARE': return 'linear-gradient(135deg, #2196F3, #1976D2)';
      case 'UNCOMMON': return 'linear-gradient(135deg, #4CAF50, #388E3C)';
      default: return 'linear-gradient(135deg, #607D8B, #455A64)';
    }
  }};
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const CardLabel = styled.div`
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 0.25rem;
  text-align: center;
`;

const AchievementType = styled.div`
  font-size: 0.8rem;
  color: ${(props) => props.theme.colors.textSecondary};
  margin-top: 0.5rem;
`;

const Tabs = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid ${(props) => props.theme.colors.border};
  padding-bottom: 0.5rem;
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 1rem;
  color: ${props => props.active ? props.theme.colors.primaryCta : props.theme.colors.textSecondary};
  border-bottom: 2px solid ${props => props.active ? props.theme.colors.primaryCta : 'transparent'};
  margin-bottom: -0.5rem;

  &:hover {
    color: ${(props) => props.theme.colors.primaryCta};
  }
`;

const CardDisplay = styled.div`
  display: flex;
  gap: 0.25rem;
  font-size: 1.5rem;
`;

const NFTGallery = () => {
  const contextWalletAddress = useContext(globalContext)?.walletAddress;
  const { openModal, closeModal } = useContext(modalContext);
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('collection');
  const [mintingStatus, setMintingStatus] = useState(null);
  const [monthlyLimits, setMonthlyLimits] = useState({});
  
  // Get wallet address from context, URL params, or localStorage
  const walletAddress = useMemo(() => {
    if (contextWalletAddress) return contextWalletAddress;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('address') || localStorage.getItem('testWalletAddress');
  }, [contextWalletAddress]);

  const achievementTypes = {
    ROYAL_FLUSH: { name: 'Royal Flush', rarity: 'LEGENDARY', icon: '👑' },
    STRAIGHT_FLUSH: { name: 'Straight Flush', rarity: 'EPIC', icon: '🔥' },
    FOUR_OF_A_KIND: { name: 'Four of a Kind', rarity: 'RARE', icon: '💎' },
    FULL_HOUSE: { name: 'Full House', rarity: 'RARE', icon: '🏠' },
    FLUSH: { name: 'Flush', rarity: 'COMMON', icon: '♠️' },
    STRAIGHT: { name: 'Straight', rarity: 'COMMON', icon: '📊' },
    // Also support numeric keys from database
    1: { name: 'Royal Flush', rarity: 'LEGENDARY', icon: '👑' },
    2: { name: 'Straight Flush', rarity: 'EPIC', icon: '🔥' },
    3: { name: 'Four of a Kind', rarity: 'RARE', icon: '💎' },
    4: { name: 'Full House', rarity: 'RARE', icon: '🏠' },
    5: { name: 'Flush', rarity: 'COMMON', icon: '♠️' },
    6: { name: 'Straight', rarity: 'COMMON', icon: '📊' }
  };

  useEffect(() => {
    if (walletAddress && tab === 'collection') {
      fetchNFTs();
    }
  }, [walletAddress, tab]);

  // Task 17.3: Listen for achievement unlock events
  useEffect(() => {
    socket.on('SC_NFT_ACHIEVEMENT_EARNED', handleAchievementEarned);
    socket.on('SC_NFT_MINT_READY', handleMintReady);
    socket.on('SC_NFT_MINT_ERROR', handleMintError);
    
    return () => {
      socket.off('SC_NFT_ACHIEVEMENT_EARNED');
      socket.off('SC_NFT_MINT_READY');
      socket.off('SC_NFT_MINT_ERROR');
    };
  }, [walletAddress]);

  // Task 17.3: Handle achievement earned - show popup
  const handleAchievementEarned = useCallback((data) => {
    const achievement = achievementTypes[data.achievementType] || {};
    
    openModal(
      () => (
        <Container flexDirection="column" alignItems="center" gap="1rem">
          <Text size="3rem">{achievement.icon || '🃏'}</Text>
          <Heading as="h2">{achievement.name} Achievement!</Heading>
          <Text textCentered>Congratulations! You've earned a rare hand achievement.</Text>
          {data.cards && (
            <CardDisplay>
              {data.cards.map((card, i) => (
                <span key={i}>{card.rank}{card.suit}</span>
              ))}
            </CardDisplay>
          )}
          <Button onClick={() => startMintProcess(data)} text="Mint NFT" />
        </Container>
      ),
      'Achievement Unlocked!',
      null,
      true
    );
  }, [openModal]);

  // Task 17.4: Start mint process with signature
  const startMintProcess = async (achievementData) => {
    closeModal();
    setMintingStatus('preparing');
    
    socket.emit('CS_NFT_PREPARE_MINT', {
      walletAddress,
      achievementType: achievementData.achievementType,
      gameSessionId: achievementData.gameId,
      handData: { cards: achievementData.cards }
    });
  };

  // Task 17.4: Handle mint ready with signature
  const handleMintReady = useCallback((data) => {
    setMintingStatus('signing');
    
    openModal(
      () => (
        <Container flexDirection="column" alignItems="center" gap="1rem">
          <Text size="3rem">✍️</Text>
          <Heading as="h2">Sign to Mint</Heading>
          <Text textCentered>
            Sign the transaction in your wallet to mint your NFT achievement.
          </Text>
          <Text size="0.8rem" color="textSecondary">
            NFT Type: {achievementTypes[data.achievementType]?.name}
          </Text>
          <Text size="0.8rem" color="textSecondary">
            Gas Fee: ~{data.estimatedGas || '0.1'} TRX
          </Text>
          {data.signature && (
            <Container 
              background="rgba(0,0,0,0.3)" 
              padding="0.5rem" 
              borderRadius="4px"
              marginTop="0.5rem"
            >
              <Text size="0.7rem" color="textSecondary">
                Server signature ready: {data.signature.slice?.(0, 20)}...
              </Text>
            </Container>
          )}
        </Container>
      ),
      'Minting NFT',
      null,
      true
    );
    
    // Here you would call the contract with the signature
    // For now, we'll just show success after a delay
    setTimeout(() => {
      handleMintSuccess(data);
    }, 2000);
  }, [openModal]);

  const handleMintSuccess = (data) => {
    setMintingStatus(null);
    closeModal();
    
    openModal(
      () => (
        <Container flexDirection="column" alignItems="center" gap="1rem">
          <Text size="3rem">🎉</Text>
          <Heading as="h2">NFT Minted!</Heading>
          <Text textCentered>
            Your {achievementTypes[data.achievementType]?.name} achievement NFT has been minted!
          </Text>
          <Button onClick={() => { closeModal(); fetchNFTs(); }} text="View Collection" />
        </Container>
      ),
      'Success!',
      null,
      true
    );
  };

  const handleMintError = useCallback((data) => {
    setMintingStatus(null);
    closeModal();
    
    openModal(
      () => (
        <Container flexDirection="column" alignItems="center" gap="1rem">
          <Text size="3rem">❌</Text>
          <Heading as="h2">Minting Failed</Heading>
          <Text textCentered color="#f44336">{data.error}</Text>
          <Button onClick={closeModal} text="Close" />
        </Container>
      ),
      'Error',
      null,
      true
    );
  }, [openModal, closeModal]);

  const fetchNFTs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/nft/collection/${walletAddress}`);
      const data = await response.json();
      if (data.success) {
        setNfts(data.nfts);
      }
    } catch (error) {
      console.error('Failed to fetch NFTs:', error);
    }
    setLoading(false);
  };

  // Convert card data to PokerCard format
  const toPokerCard = (card) => {
    if (!card) return null;
    // Handle both {rank, suit} and string format
    let rank = card.rank || card;
    let suit = card.suit || '';
    
    // If it's a string like 'Ah', parse it
    if (typeof card === 'string') {
      rank = card.slice(0, -1);
      suit = card.slice(-1);
    }
    
    // Normalize rank for card images (10 -> '10', etc)
    const rankMap = { 'A': 'A', 'K': 'K', 'Q': 'Q', 'J': 'J' };
    const normalizedRank = rankMap[rank] || rank;
    
    // Normalize suit to lowercase single letter
    const suitMap = { 'hearts': 'h', 'diamonds': 'd', 'clubs': 'c', 'spades': 's' };
    const normalizedSuit = suitMap[suit?.toLowerCase()] || suit?.toLowerCase();
    
    return { suit: normalizedSuit, rank: normalizedRank };
  };

  // Render cards in NFT display
  const renderCards = (cards) => {
    if (!cards || cards.length === 0) return null;
    
    // Separate hole cards (first 2) and board cards (rest)
    const holeCards = cards.slice(0, 2);
    const boardCards = cards.slice(2);
    
    return (
      <>
        {holeCards.length > 0 && (
          <>
            <HoleCardsContainer>
              {holeCards.map((card, i) => {
                const pokerCard = toPokerCard(card);
                return pokerCard ? <PokerCard key={i} card={pokerCard} /> : null;
              })}
            </HoleCardsContainer>
            <CardLabel>Your Hand</CardLabel>
          </>
        )}
        {boardCards.length > 0 && (
          <>
            <BoardCardsContainer>
              {boardCards.map((card, i) => {
                const pokerCard = toPokerCard(card);
                return pokerCard ? <PokerCard key={i} card={pokerCard} /> : null;
              })}
            </BoardCardsContainer>
            <CardLabel>Board</CardLabel>
          </>
        )}
      </>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Container
      fullHeight
      flexDirection="column"
      padding="6rem 2rem 2rem 2rem"
      background="linear-gradient(180deg, #0a0a12 0%, #1a1a2e 100%)"
    >
      <Heading as="h1" textCentered color="#fff">NFT Achievements</Heading>
      <Text textCentered color="rgba(255,255,255,0.6)" marginTop="0.5rem">
        Collect rare poker hand achievements as NFTs
      </Text>
      
      <Tabs>
        <Tab active={tab === 'collection'} onClick={() => setTab('collection')}>
          My Collection ({nfts.length})
        </Tab>
        <Tab active={tab === 'types'} onClick={() => setTab('types')}>
          Achievement Types
        </Tab>
      </Tabs>

      {tab === 'collection' ? (
        loading ? (
          <Text textCentered>Loading your NFTs...</Text>
        ) : !walletAddress ? (
          <Container flexDirection="column" alignItems="center" gap="1rem">
            <Text textCentered color="#fff">Connect your wallet to view your NFT collection</Text>
            <Button 
              primary 
              onClick={() => window.location.href = '/'}
              text="Connect Wallet"
            />
          </Container>
        ) : nfts.length === 0 ? (
          <Container flexDirection="column" alignItems="center" gap="1rem">
            <Text textCentered color="#fff">You don't have any NFT achievements yet.</Text>
            <Text textCentered color="rgba(255,255,255,0.6)">
              Play games and achieve rare hands to mint NFTs!
            </Text>
            <Button 
              primary 
              marginTop="1rem"
              onClick={() => window.location.href = '/tournament'}
              text="Play Now"
            />
          </Container>
        ) : (
          <NFTGrid>
            {nfts.map((nft) => {
              const achievement = achievementTypes[nft.achievementType] || achievementTypes[nft.achievementTypeId] || {};
              return (
                <NFTCard key={nft.tokenId} rarity={achievement.rarity}>
                  <NFTImage rarity={nft.rarity || achievement.rarity}>
                    <AchievementIcon>{achievement.icon || '🃏'}</AchievementIcon>
                    {nft.cards && renderCards(nft.cards)}
                  </NFTImage>
                  <NFTInfo>
                    <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                      <Heading as="h4" color="#fff">{achievement.name || nft.displayName || `NFT #${nft.tokenId}`}</Heading>
                      <RarityBadge rarity={nft.rarity || achievement.rarity}>
                        {nft.rarity || achievement.rarity || 'COMMON'}
                      </RarityBadge>
                    </Container>
                    {nft.handDescription && (
                      <Text size="0.85rem" color="rgba(255,255,255,0.7)" marginTop="0.5rem">
                        {nft.handDescription}
                      </Text>
                    )}
                    <AchievementType>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Minted: </span>
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>{formatDate(nft.claimedAt || nft.createdAt)}</span>
                    </AchievementType>
                    {nft.gameId && (
                      <Text size="0.7rem" color="rgba(255,255,255,0.4)" marginTop="0.25rem">
                        Game: {nft.gameId}
                      </Text>
                    )}
                  </NFTInfo>
                </NFTCard>
              );
            })}
          </NFTGrid>
        )
      ) : (
        <NFTGrid>
          {Object.entries(achievementTypes).filter(([k]) => isNaN(k)).map(([type, info]) => (
            <NFTCard key={type} rarity={info.rarity}>
              <NFTImage rarity={info.rarity}>
                <AchievementIcon>{info.icon}</AchievementIcon>
                <Text color="rgba(255,255,255,0.7)" marginTop="0.5rem">{info.name}</Text>
              </NFTImage>
              <NFTInfo>
                <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                  <Heading as="h4" color="#fff">{info.name}</Heading>
                  <RarityBadge rarity={info.rarity}>
                    {info.rarity}
                  </RarityBadge>
                </Container>
                <AchievementType>
                  Rare hand achievement • Limited minting
                </AchievementType>
              </NFTInfo>
            </NFTCard>
          ))}
        </NFTGrid>
      )}
    </Container>
  );
};

export default NFTGallery;
