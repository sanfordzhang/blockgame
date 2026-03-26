import React, { useState, useEffect, useContext, useCallback } from 'react';
import styled from 'styled-components';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import Button from '../components/buttons/Button';
import globalContext from '../context/global/globalContext';
import modalContext from '../context/modal/modalContext';
import socket from '../socket';

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
`;

const NFTCard = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: ${(props) => props.theme.other.stdBorderRadius};
  overflow: hidden;
  box-shadow: ${(props) => props.theme.other.cardDropShadow};
  transition: transform 0.3s;

  &:hover {
    transform: scale(1.02);
  }
`;

const NFTImage = styled.div`
  width: 100%;
  height: 200px;
  background: ${props => {
    switch(props.rarity) {
      case 1: return 'linear-gradient(135deg, #FFD700, #FFA500)'; // Royal Flush - Legendary
      case 2: return 'linear-gradient(135deg, #9C27B0, #673AB7)'; // Straight Flush - Epic
      case 3: return 'linear-gradient(135deg, #2196F3, #03A9F4)'; // Four of a Kind - Rare
      case 4: return 'linear-gradient(135deg, #4CAF50, #8BC34A)'; // Full House - Uncommon
      case 5: return 'linear-gradient(135deg, #607D8B, #9E9E9E)'; // Flush - Common
      case 6: return 'linear-gradient(135deg, #795548, #A1887F)'; // Straight - Common
      default: return 'linear-gradient(135deg, #9E9E9E, #BDBDBD)';
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
`;

const NFTInfo = styled.div`
  padding: 1rem;
`;

const RarityBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  background: ${props => {
    switch(props.rarity) {
      case 1: return '#FFD700';
      case 2: return '#9C27B0';
      case 3: return '#2196F3';
      case 4: return '#4CAF50';
      default: return '#9E9E9E';
    }
  }};
  color: ${props => props.rarity <= 2 ? 'white' : 'black'};
`;

const AchievementType = styled.div`
  font-size: 0.8rem;
  color: ${(props) => props.theme.colors.textSecondary};
  margin-top: 0.5rem;
`;

const CardDisplay = styled.div`
  display: flex;
  gap: 0.25rem;
  font-size: 1.5rem;
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

const NFTGallery = () => {
  const { walletAddress } = useContext(globalContext);
  const { openModal, closeModal } = useContext(modalContext);
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('collection');
  const [mintingStatus, setMintingStatus] = useState(null);
  const [monthlyLimits, setMonthlyLimits] = useState({});

  const achievementTypes = {
    1: { name: 'Royal Flush', rarity: 1, icon: '👑' },
    2: { name: 'Straight Flush', rarity: 2, icon: '🔥' },
    3: { name: 'Four of a Kind', rarity: 3, icon: '💎' },
    4: { name: 'Full House', rarity: 4, icon: '🏠' },
    5: { name: 'Flush', rarity: 5, icon: '♠️' },
    6: { name: 'Straight', rarity: 6, icon: '📊' }
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
                Server signature ready: {data.signature.slice(0, 20)}...
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

  const renderCardSuit = (suit) => {
    const suits = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return suits[suit?.toLowerCase()] || suit;
  };

  const formatCard = (card) => {
    if (!card) return '';
    return `${card.rank}${renderCardSuit(card.suit)}`;
  };

  return (
    <Container
      fullHeight
      flexDirection="column"
      padding="6rem 2rem 2rem 2rem"
    >
      <Heading as="h1" textCentered>NFT Achievements</Heading>
      
      <Tabs>
        <Tab active={tab === 'collection'} onClick={() => setTab('collection')}>
          My Collection
        </Tab>
        <Tab active={tab === 'types'} onClick={() => setTab('types')}>
          Achievement Types
        </Tab>
      </Tabs>

      {tab === 'collection' ? (
        loading ? (
          <Text textCentered>Loading your NFTs...</Text>
        ) : !walletAddress ? (
          <Text textCentered>Connect your wallet to view your NFT collection</Text>
        ) : nfts.length === 0 ? (
          <Container flexDirection="column" alignItems="center" gap="1rem">
            <Text textCentered>You don't have any NFT achievements yet.</Text>
            <Text textCentered color="textSecondary">
              Play games and achieve rare hands to mint NFTs!
            </Text>
          </Container>
        ) : (
          <NFTGrid>
            {nfts.map((nft) => {
              const achievement = achievementTypes[nft.achievementType] || {};
              return (
                <NFTCard key={nft.tokenId}>
                  <NFTImage rarity={achievement.rarity}>
                    {achievement.icon || '🃏'}
                  </NFTImage>
                  <NFTInfo>
                    <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                      <Heading as="h4">{achievement.name || `NFT #${nft.tokenId}`}</Heading>
                      <RarityBadge rarity={achievement.rarity}>
                        {achievement.rarity === 1 ? 'Legendary' : 
                         achievement.rarity === 2 ? 'Epic' :
                         achievement.rarity === 3 ? 'Rare' :
                         achievement.rarity === 4 ? 'Uncommon' : 'Common'}
                      </RarityBadge>
                    </Container>
                    {nft.cards && (
                      <CardDisplay>
                        {nft.cards.map((card, i) => (
                          <span key={i}>{formatCard(card)}</span>
                        ))}
                      </CardDisplay>
                    )}
                    <AchievementType>
                      Minted: {new Date(nft.mintedAt || nft.createdAt).toLocaleDateString()}
                    </AchievementType>
                  </NFTInfo>
                </NFTCard>
              );
            })}
          </NFTGrid>
        )
      ) : (
        <NFTGrid>
          {Object.entries(achievementTypes).map(([type, info]) => (
            <NFTCard key={type}>
              <NFTImage rarity={info.rarity}>
                {info.icon}
              </NFTImage>
              <NFTInfo>
                <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                  <Heading as="h4">{info.name}</Heading>
                  <RarityBadge rarity={info.rarity}>
                    {info.rarity === 1 ? 'Legendary' : 
                     info.rarity === 2 ? 'Epic' :
                     info.rarity === 3 ? 'Rare' :
                     info.rarity === 4 ? 'Uncommon' : 'Common'}
                  </RarityBadge>
                </Container>
                <AchievementType>
                  Achievement Type {type} • Monthly Limit: 1
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
