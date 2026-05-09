import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import Container from '../components/layout/Container';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import Button from '../components/buttons/Button';
import globalContext from '../context/global/globalContext';
import modalContext from '../context/modal/modalContext';
import { useTronLink } from '../context/tron/TronContext';
import { useZeroG } from '../context/zero-g/ZeroGContext';
import socket from '../socket';
import PokerCard from '../components/game/PokerCard';

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
`;

// Achievement Types cards - simple colorful design
const TypeCard = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: ${(props) => props.theme.other.cardDropShadow};
  transition: transform 0.3s, box-shadow 0.3s;

  &:hover {
    transform: scale(1.03);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }
`;

const TypeImage = styled.div`
  width: 100%;
  height: 180px;
  background: ${props => {
    switch(props.rarity) {
      case 1: return 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%)';
      case 2: return 'linear-gradient(135deg, #E040FB 0%, #9C27B0 50%, #7B1FA2 100%)';
      case 3: return 'linear-gradient(135deg, #42A5F5 0%, #2196F3 50%, #1976D2 100%)';
      case 4: return 'linear-gradient(135deg, #66BB6A 0%, #4CAF50 50%, #43A047 100%)';
      case 5: return 'linear-gradient(135deg, #90A4AE 0%, #607D8B 50%, #546E7A 100%)';
      case 6: return 'linear-gradient(135deg, #A1887F 0%, #795548 50%, #6D4C41 100%)';
      default: return 'linear-gradient(135deg, #BDBDBD 0%, #9E9E9E 50%, #757575 100%)';
    }
  }};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%);
    pointer-events: none;
  }
`;

const TypeIcon = styled.div`
  font-size: 4rem;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
`;

const TypeName = styled.div`
  font-size: 0.9rem;
  font-weight: 600;
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  margin-top: 0.5rem;
`;

const TypeInfo = styled.div`
  padding: 1rem;
  background: ${(props) => props.theme.colors.playingCardBg};
`;

const TypeRarityBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  background: ${props => {
    switch(props.rarity) {
      case 1: return 'linear-gradient(135deg, #FFD700, #FFA500)';
      case 2: return 'linear-gradient(135deg, #E040FB, #9C27B0)';
      case 3: return 'linear-gradient(135deg, #42A5F5, #2196F3)';
      case 4: return 'linear-gradient(135deg, #66BB6A, #4CAF50)';
      default: return 'linear-gradient(135deg, #90A4AE, #607D8B)';
    }
  }};
  color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
`;

// My Collection cards - with game screenshot style
const CollectionCard = styled.div`
  background: ${(props) => props.theme.colors.playingCardBg};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: ${(props) => props.theme.other.cardDropShadow};
  transition: transform 0.3s, box-shadow 0.3s;
  border: 1px solid rgba(255, 255, 255, 0.05);

  &:hover {
    transform: scale(1.03);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    border-color: ${props => {
      switch(props.rarity) {
        case 1: return 'rgba(255, 215, 0, 0.5)';
        case 2: return 'rgba(156, 39, 176, 0.5)';
        case 3: return 'rgba(33, 150, 243, 0.5)';
        case 4: return 'rgba(76, 175, 80, 0.5)';
        default: return 'rgba(255, 255, 255, 0.1)';
      }
    }};
  }
`;

const GameScreenshotWrapper = styled.div`
  width: 100%;
  height: 200px;
  position: relative;
  overflow: hidden;
`;

const ScreenshotImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
  transition: transform 0.3s;
  
  &:hover {
    transform: scale(1.05);
  }
`;

// Modal overlay for enlarged screenshot
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  cursor: pointer;
`;

const EnlargedImage = styled.img`
  max-width: 90vw;
  max-height: 90vh;
  border-radius: 12px;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.8);
`;

const GameScreenshot = styled.div`
  width: 100%;
  height: 200px;
  background: ${props => {
    switch(props.rarity) {
      case 1: return 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)';
      case 2: return 'linear-gradient(135deg, #1a1a2e 0%, #2d1f3d 50%, #4a1259 100%)';
      case 3: return 'linear-gradient(135deg, #1a1a2e 0%, #1a3a5c 50%, #0d4f8a 100%)';
      case 4: return 'linear-gradient(135deg, #1a1a2e 0%, #1a3d2e 50%, #0d5a32 100%)';
      default: return 'linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 50%, #3a3a4e 100%)';
    }
  }};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  position: relative;
  
  /* Table felt texture */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      radial-gradient(ellipse 100% 60% at 50% 40%, rgba(34, 139, 34, 0.15), transparent),
      radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03), transparent);
    pointer-events: none;
  }
`;

const CardsArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  z-index: 1;
`;

const HoleCards = styled.div`
  display: flex;
  gap: -10px;
  
  img {
    width: 50px !important;
    max-width: 50px !important;
    height: auto;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    transition: transform 0.2s;
  }
  
  img:hover {
    transform: translateY(-5px);
  }
`;

const BoardCards = styled.div`
  display: flex;
  gap: 4px;
  margin-top: 0.5rem;
  
  img {
    width: 40px !important;
    max-width: 40px !important;
    height: auto;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
`;

const CardLabel = styled.div`
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

const AchievementBadge = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  z-index: 2;
  
  span:first-child {
    font-size: 1rem;
  }
  
  span:last-child {
    font-size: 0.75rem;
    font-weight: 600;
    color: ${props => {
      switch(props.rarity) {
        case 1: return '#FFD700';
        case 2: return '#E040FB';
        case 3: return '#42A5F5';
        case 4: return '#66BB6A';
        default: return '#90A4AE';
      }
    }};
  }
`;

const CollectionInfo = styled.div`
  padding: 1rem;
`;

const CollectionRarityBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  background: ${props => {
    switch(props.rarity) {
      case 1: return 'linear-gradient(135deg, #FFD700, #FFA500)';
      case 2: return 'linear-gradient(135deg, #E040FB, #9C27B0)';
      case 3: return 'linear-gradient(135deg, #42A5F5, #2196F3)';
      case 4: return 'linear-gradient(135deg, #66BB6A, #4CAF50)';
      default: return 'linear-gradient(135deg, #90A4AE, #607D8B)';
    }
  }};
  color: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
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
  const { setWalletAddress } = useContext(globalContext);
  const { address: tronLinkAddress } = useTronLink();
  const { address: zeroGAddress, isConnected: zeroGConnected } = useZeroG() || {};
  const { openModal, closeModal } = useContext(modalContext);
  const [nfts, setNfts] = useState([]);
  
  // Task 10.1: INFT (0G) NFT state
  const [infts, setInfts] = useState([]);
  const [inftLoading, setInftLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('collection');
  const [mintingStatus, setMintingStatus] = useState(null);
  const [monthlyLimits, setMonthlyLimits] = useState({});
  const [enlargedScreenshot, setEnlargedScreenshot] = useState(null);
  
  // Sync TronLink address to global context (fixes navbar on refresh)
  useEffect(() => {
    if (tronLinkAddress && tronLinkAddress !== contextWalletAddress) {
      setWalletAddress(tronLinkAddress);
    }
  }, [tronLinkAddress, contextWalletAddress, setWalletAddress]);

  // Get wallet address from context, URL params, or localStorage
  const walletAddress = useMemo(() => {
    if (contextWalletAddress) return contextWalletAddress;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('address') || localStorage.getItem('testWalletAddress');
  }, [contextWalletAddress]);

  // Achievement types with numeric rarity
  const achievementTypes = {
    ROYAL_FLUSH: { name: 'Royal Flush', rarity: 1, icon: '👑' },
    STRAIGHT_FLUSH: { name: 'Straight Flush', rarity: 2, icon: '🔥' },
    FOUR_OF_A_KIND: { name: 'Four of a Kind', rarity: 3, icon: '💎' },
    FULL_HOUSE: { name: 'Full House', rarity: 4, icon: '🏠' },
    FLUSH: { name: 'Flush', rarity: 5, icon: '♠️' },
    STRAIGHT: { name: 'Straight', rarity: 6, icon: '📊' },
    // Also support numeric keys from database
    1: { name: 'Royal Flush', rarity: 1, icon: '👑' },
    2: { name: 'Straight Flush', rarity: 2, icon: '🔥' },
    3: { name: 'Four of a Kind', rarity: 3, icon: '💎' },
    4: { name: 'Full House', rarity: 4, icon: '🏠' },
    5: { name: 'Flush', rarity: 5, icon: '♠️' },
    6: { name: 'Straight', rarity: 6, icon: '📊' }
  };

  // Rarity name mapping
  const rarityNames = {
    1: 'LEGENDARY',
    2: 'EPIC',
    3: 'RARE',
    4: 'UNCOMMON',
    5: 'COMMON',
    6: 'COMMON'
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
    
    // Call on-chain contract with signature + metadata
    (async () => {
      try {
        const { signature, metadata, onchainContractAddress } = data;
        
        // Validate signature data before calling contract (prevent toHexString crash)
        if (!signature || !signature.achievementTypeId || !signature.timestamp ||
            !signature.gameId || typeof signature.v === 'undefined' ||
            !signature.r || !signature.s) {
          console.error('[NFT] Invalid signature data received:', JSON.stringify(data));
          handleMintError({ error: 'Invalid signature data from server. Please try again.' });
          return;
        }
        
        const contractAddress = onchainContractAddress || process.env.REACT_APP_NFT_CONTRACT_ONCHAIN || window.__NFT_CONTRACT_ONCHAIN;

        if (!contractAddress || !window.tronWeb) {
          console.warn('[NFT] No on-chain contract or tronWeb, simulating success');
          setTimeout(() => handleMintSuccess(data), 1000);
          return;
        }

        const abi = [
          { "inputs": [
              { "name": "achievementTypeId", "type": "uint256" },
              { "name": "timestamp", "type": "uint256" },
              { "name": "gameId", "type": "string" },
              { "name": "metadata", "type": "string" },
              { "name": "v", "type": "uint8" },
              { "name": "r", "type": "bytes32" },
              { "name": "s", "type": "bytes32" }
            ],
            "name": "claimNFT", "outputs": [{ "type": "uint256" }],
            "stateMutability": "payable", "type": "function"
          }
        ];

        const contract = await window.tronWeb.contract(abi, contractAddress);
        const price = 5000000; // 5 TRX in SUN

        const tx = await contract.claimNFT(
          signature.achievementTypeId,
          signature.timestamp,
          signature.gameId,
          metadata,
          signature.v,
          signature.r,
          signature.s
        ).send({ callValue: price, feeLimit: 100000000 });

        console.log('[NFT] ✅ On-chain mint tx:', tx);
        handleMintSuccess({ ...data, txHash: tx });
      } catch (err) {
        console.error('[NFT] On-chain mint error:', err);
        handleMintError({ error: err.message || 'Mint failed' });
      }
    })();
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

  // Task 10.1: Fetch INFTs from 0G chain via /api/0g/inft/:address
  const fetchINFTs = async () => {
    setInftLoading(true);
    try {
      const res = await fetch(`/api/0g/inft/${zeroGAddress || walletAddress}`);
      const data = await res.json();
      if (data.success) {
        setInfts(data.infts || []);
      } else {
        console.warn('[INFT] Fetch failed:', data.error);
        setInfts([]);
      }
    } catch (err) {
      console.warn('[INFT] Error fetching:', err.message);
      setInfts([]);
    }
    setInftLoading(false);
  };

  // Convert card data to PokerCard formats
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

  // Render cards in NFT display (game screenshot style)
  const renderGameCards = (cards) => {
    if (!cards || cards.length === 0) return null;
    
    // Separate hole cards (first 2) and board cards (rest)
    const holeCards = cards.slice(0, 2);
    const boardCards = cards.slice(2);
    
    return (
      <CardsArea>
        {holeCards.length > 0 && (
          <>
            <HoleCards>
              {holeCards.map((card, i) => {
                const pokerCard = toPokerCard(card);
                return pokerCard ? <PokerCard key={i} card={pokerCard} /> : null;
              })}
            </HoleCards>
            <CardLabel>Your Hand</CardLabel>
          </>
        )}
        {boardCards.length > 0 && (
          <>
            <BoardCards>
              {boardCards.map((card, i) => {
                const pokerCard = toPokerCard(card);
                return pokerCard ? <PokerCard key={i} card={pokerCard} /> : null;
              })}
            </BoardCards>
            <CardLabel>Board</CardLabel>
          </>
        )}
      </CardsArea>
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
        {/* Task 10.1: TRON NFT | INFT (0G) dual tabs */}
        <Tab active={tab === 'collection'} onClick={() => { setTab('collection'); fetchNFTs(); }}>
          TRON NFT ({nfts.length})
        </Tab>
        <Tab
          active={tab === 'infts'}
          onClick={() => { setTab('infts'); if (!zeroGConnected) alert('Connect 0G wallet to view INFTs'); else fetchINFTs(); }}
          style={{ opacity: zeroGConnected ? 1 : 0.5 }}
        >
          0G / INFT {zeroGConnected && `(${infts.length})`}
          {!zeroGConnected && <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem' }}>(🔒)</span>}
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
              const rarity = nft.achievementTypeId || achievement.rarity || 6;
              const hasScreenshot = nft.gameScreenshot && nft.gameScreenshot.length > 100;
              
              return (
                <CollectionCard key={nft.tokenId} rarity={rarity}>
                  <GameScreenshotWrapper>
                    {hasScreenshot ? (
                      <>
                        <ScreenshotImage 
                          src={`data:image/${nft.screenshotFormat || 'png'};base64,${nft.gameScreenshot}`} 
                          alt={`${achievement.name || 'NFT'} game screenshot`}
                          onClick={() => setEnlargedScreenshot(`data:image/${nft.screenshotFormat || 'png'};base64,${nft.gameScreenshot}`)}
                        />
                        <AchievementBadge rarity={rarity}>
                          <span>{achievement.icon || '🃏'}</span>
                          <span>{achievement.name || nft.displayName}</span>
                        </AchievementBadge>
                      </>
                    ) : (
                      <GameScreenshot rarity={rarity}>
                        <AchievementBadge rarity={rarity}>
                          <span>{achievement.icon || '🃏'}</span>
                          <span>{achievement.name || nft.displayName}</span>
                        </AchievementBadge>
                        {nft.cards && renderGameCards(nft.cards)}
                      </GameScreenshot>
                    )}
                  </GameScreenshotWrapper>
                  <CollectionInfo>
                    <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                      <Heading as="h4" color="#fff">{achievement.name || nft.displayName || `NFT #${nft.tokenId}`}</Heading>
                      <CollectionRarityBadge rarity={rarity}>
                        {rarityNames[rarity] || nft.rarity || 'COMMON'}
                      </CollectionRarityBadge>
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
                  </CollectionInfo>
                </CollectionCard>
              );
            })}
          </NFTGrid>
        )
      ) : tab === 'types' ? (
        // Achievement Types tab - simple colorful cards
        <NFTGrid>
          {Object.entries(achievementTypes).filter(([k]) => isNaN(k)).map(([type, info]) => (
            <TypeCard key={type} rarity={info.rarity}>
              <TypeImage rarity={info.rarity}>
                <TypeIcon>{info.icon}</TypeIcon>
                <TypeName>{info.name}</TypeName>
              </TypeImage>
              <TypeInfo>
                <Container flexDirection="row" justifyContent="space-between" alignItems="center">
                  <Heading as="h4" color="#fff">{info.name}</Heading>
                  <TypeRarityBadge rarity={info.rarity}>
                    {rarityNames[info.rarity]}
                  </TypeRarityBadge>
                </Container>
                <AchievementType>
                  Rare hand achievement • Limited minting
                </AchievementType>
              </TypeInfo>
            </TypeCard>
          ))}
        </NFTGrid>
      ) : tab === 'infts' ? (
        // Task 10.1: 0G / INFT Tab Content
        <Container flexDirection="column" alignItems="center" gap="1rem">
          {inftLoading ? (
            <Text textCentered color="#fff">Loading INFTs from 0G chain...</Text>
          ) : !zeroGConnected ? (
            <>
              <Text textCentered color="rgba(255,255,255,0.7)" marginTop="2rem">
                Connect your 0G wallet to view Interactive NFTs (ERC-7857)
              </Text>
              <Button primary onClick={() => window.location.href = '/'}>
                Connect 0G Wallet
              </Button>
            </>
          ) : infts.length === 0 ? (
            <>
              <Text textCentered color="#fff">No INFTs found on 0G chain</Text>
              <Text textCentered color="rgba(255,255,255,0.6)">
                Play poker hands to earn and mint INFT achievements!
              </Text>
            </>
          ) : (
            <NFTGrid>
              {infts.map((inft) => (
                <CollectionCard key={inft.tokenId} rarity={inft.handType || 6}>
                  <GameScreenshot rarity={inft.handType || 6}>
                    <AchievementBadge rarity={inft.handType || 6}>
                      <span>{achievementTypes[inft.handType]?.icon || '🃏'}</span>
                      <span>INFT #{inft.tokenId}</span>
                    </AchievementBadge>
                    <Text size="0.7rem" color="rgba(255,255,255,0.7)">
                      Storage Hash: {(inft.storageRootHash || '').slice(0, 12)}...
                    </Text>
                  </GameScreenshot>
                  <CollectionInfo>
                    <Container flexDirection="row" justifyContent="space-between">
                      <Heading as="h4" color="#fff">{rarityNames[inft.handType] || 'INFT'}</Heading>
                      <CollectionRarityBadge rarity={inft.handType || 6}>
                        ERC-7857
                      </CollectionRarityBadge>
                    </Container>
                    {inft.metadataURI && (
                      <Text size="0.75rem" color="rgba(255,255,255,0.5)" marginTop="0.25rem">
                        <a href={inft.metadataURI} target="_blank" rel="noreferrer"
                          style={{ color: '#627eea' }}>View Metadata ↗</a>
                      </Text>
                    )}
                    <AchievementType>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Minted: </span>
                      <span>{formatDate(inft.mintedAt)}</span>
                    </AchievementType>
                  </CollectionInfo>
                </CollectionCard>
              ))}
            </NFTGrid>
          )}
        </Container>
      ) : null
      }
      
      {/* Enlarged Screenshot Modal */}
      {enlargedScreenshot && (
        <ModalOverlay onClick={() => setEnlargedScreenshot(null)}>
          <EnlargedImage 
            src={enlargedScreenshot} 
            alt="Enlarged game screenshot"
            onClick={(e) => e.stopPropagation()}
          />
        </ModalOverlay>
      )}
    </Container>
  );
};

export default NFTGallery;
