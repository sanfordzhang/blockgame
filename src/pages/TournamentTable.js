import React, { useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import Button from '../components/buttons/Button';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import globalContext from '../context/global/globalContext';
import { getPlayerBalance } from '../utils/tronInteract';
import { TournamentGameProvider, TournamentGameContext } from '../context/game/TournamentGameContext';
import PokerTable from '../components/game/PokerTable';
// AI components hidden in tournaments for fairness
// import AIControlPanel from '../components/game/AIControlPanel';
// import DecisionSuggestion from '../components/game/DecisionSuggestion';
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

// Detect language for i18n
const _lang = (typeof navigator !== 'undefined' && /^zh/.test(navigator.language)) ? 'zh' : 'en';

const API_BASE = process.env.REACT_APP_SERVER_URI || 'http://127.0.0.1:7777';

// NFT Achievement types mapping
const achievementTypes = {
  'STRAIGHT': { name: '顺子', icon: '🃏' },
  'FLUSH': { name: '同花', icon: '♠️' },
  'FULL_HOUSE': { name: '葫芦', icon: '🏠' },
  'FOUR_OF_A_KIND': { name: '四条', icon: '🎯' },
  'STRAIGHT_FLUSH': { name: '同花顺', icon: '🌟' },
  'ROYAL_FLUSH': { name: '皇家同花顺', icon: '👑' },
};

// Helper to format address
const formatAddress = (addr) => {
  if (!addr) return '';
  const normalized = addr.toUpperCase();
  const knownAddresses = {
    'TU8RHTPFQUSGPBE9SXQAFG8BXF52GGSMV': 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    'TX27LJDQK64D4NVBXKT1TAAYX5DPF4JPL4': 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'
  };
  return knownAddresses[normalized] || addr;
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
    setIsLeaving,
    leaveTable,
    fold,
    check,
    call,
    raise,
    tournament,
    walletAddress,  // Get walletAddress from context
    tournamentEnded,
    finalRankings,
    chipRewards,
    rakeAmount,
    nftAchievement,
    setNftAchievement,
  } = useContext(TournamentGameContext);

  const [bet, setBet] = useState(0);

  // GameBalance state
  const [gameBalance, setGameBalance] = useState(0);
  const [balanceBefore, setBalanceBefore] = useState(0);
  const [chipBalanceBefore, setChipBalanceBefore] = useState(0);
  const [chipBalanceAfter, setChipBalanceAfter] = useState(0);
  const prevTournamentEnded = useRef(false);

  // Track previous turn state to only reset bet when turn changes
  const prevTurnRef = useRef(null);
  const prevHandRef = useRef(null);

  // Fetch GameBalance from contract
  const fetchGameBalance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const balance = await getPlayerBalance(walletAddress);
      const total = (balance.balance || 0) + (balance.locked || 0);
      setGameBalance(total);
      return total;
    } catch (e) {
      console.error('[TournamentTable] Failed to fetch balance:', e);
      return null;
    }
  }, [walletAddress]);

  // Fetch CHIP balance from API
  const fetchChipBalance = useCallback(async () => {
    if (!walletAddress) return 0;
    try {
      const res = await fetch(`${API_BASE}/api/chip/onchain/balance/${walletAddress}`);
      const data = await res.json();
      return data.balance || 0;
    } catch (e) {
      console.error('[TournamentTable] Failed to fetch CHIP balance:', e);
      return 0;
    }
  }, [walletAddress]);

  // Fetch balance on mount and when walletAddress changes
  useEffect(() => {
    if (walletAddress) {
      fetchGameBalance().then(balance => {
        if (balance !== null && !prevTournamentEnded.current) {
          setBalanceBefore(balance);
        }
      });
      fetchChipBalance().then(chipBalance => {
        if (!prevTournamentEnded.current) {
          setChipBalanceBefore(chipBalance);
        }
      });
    }
  }, [walletAddress, fetchGameBalance, fetchChipBalance]);

  // When tournament ends, fetch new balance to show change
  useEffect(() => {
    if (tournamentEnded && !prevTournamentEnded.current) {
      prevTournamentEnded.current = true;
      setBalanceBefore(gameBalance); // Save balance before end
      setChipBalanceBefore(chipBalanceBefore); // Keep CHIP balance before
      // Fetch new balance after a short delay to allow settlement
      setTimeout(() => {
        fetchGameBalance();
        fetchChipBalance().then(chipBalance => {
          setChipBalanceAfter(chipBalance);
        });
      }, 2000);
      
      // If player was leaving, show end screen briefly then navigate
      if (isLeaving) {
        console.log('[TournamentTable] Player was leaving, will show end screen then navigate');
        // The end screen will show, and user can click "Back to Tournaments" to leave
        // Or we can auto-navigate after a delay (currently letting user see results)
      }
    }
  }, [tournamentEnded, gameBalance, chipBalanceBefore, fetchGameBalance, fetchChipBalance, isLeaving]);

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
          title: _lang === 'zh' ? '🎉 成就解锁！' : '🎉 Achievement Unlocked!',
          html: `
            <div style="text-align: center;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">${achievement.icon || '🃏'}</div>
              <h2 style="color: #ffd700; margin-bottom: 0.5rem;">${achievement.name || nftAchievement.handType}</h2>
              <p style="margin-bottom: 1rem;">${_lang === 'zh' ? '恭喜！您获得了一个稀有牌型成就！' : 'Congratulations! You earned a rare hand achievement!'}</p>
              ${handCards ? `<p><strong>${_lang === 'zh' ? '手牌:' : 'Hand:'}</strong> ${handCards}</p>` : ''}
              ${boardCards ? `<p><strong>${_lang === 'zh' ? '公共牌:' : 'Board:'}</strong> ${boardCards}</p>` : ''}
              <p style="margin-top: 1rem; font-size: 0.9rem; color: #888;">${_lang === 'zh' ? '点击下方按钮铸造您的成就 NFT' : 'Click below to mint your achievement NFT'}</p>
            </div>
          `,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: _lang === 'zh' ? '铸造 NFT' : 'Mint NFT',
          cancelButtonText: _lang === 'zh' ? '稍后再说' : 'Later',
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
            title: _lang === 'zh' ? '铸造中...' : 'Minting...',
            html: '<p>' + (_lang === 'zh' ? '正在铸造您的 NFT...' : 'Minting your NFT...') + '</p>',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          
          // Listen for mint result
          socket.once('SC_NFT_MINT_READY', async (data) => {
            try {
              // Call on-chain contract to mint NFT
              const { signature, onchainContractAddress } = data;
              
              // Validate signature data before calling contract
              if (!signature || !signature.achievementTypeId || !signature.timestamp ||
                  !signature.gameId || typeof signature.v === 'undefined' ||
                  !signature.r || !signature.s) {
                console.error('[NFT] Invalid signature data received:', JSON.stringify(data));
                Swal.fire({
                  title: _lang === 'zh' ? '铸造失败' : 'Mint Failed',
                  text: _lang === 'zh' 
                    ? '签名数据无效，请稍后重试' 
                    : 'Invalid signature data. Please try again.',
                  icon: 'error',
                });
                return;
              }
              
              console.log('[NFT] Signature validated:', { 
                typeId: signature.achievementTypeId, 
                v: signature.v,
                rLen: signature.r?.length,
                sLen: signature.s?.length
              });
              
              const contractAddress = onchainContractAddress || process.env.REACT_APP_NFT_CONTRACT_ONCHAIN || window.__NFT_CONTRACT_ONCHAIN;

              if (!contractAddress || !window.tronWeb) {
                console.warn('[NFT] No on-chain contract or tronWeb, simulating success');
                Swal.fire({
                  title: _lang === 'zh' ? '🎉 铸造成功！' : '🎉 Mint Successful!',
                  html: '<p>' + (_lang === 'zh' 
                    ? `您的 ${achievement.name || nftAchievement.handType} NFT 已记录！`
                    : `Your ${achievement.name || nftAchievement.handType} NFT has been recorded!`) + '</p>',
                  icon: 'success',
                  confirmButtonText: _lang === 'zh' ? '查看收藏' : 'View Collection',
                }).then(() => navigate('/nft'));
                return;
              }

              // Show signing prompt
              Swal.fire({
                title: _lang === 'zh' ? '✍️ 请签名' : '✍️ Please Sign',
                html: '<p>' + (_lang === 'zh' ? '请在钱包中确认交易以铸造 NFT' : 'Please confirm the transaction in your wallet to mint the NFT') + '</p>',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
              });

              const abi = [
                { "inputs": [
                    { "name": "achievementTypeId", "type": "uint256" },
                    { "name": "timestamp", "type": "uint256" },
                    { "name": "gameId", "type": "string" },
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
                signature.v,
                signature.r,
                signature.s
              ).send({ callValue: price, feeLimit: 100000000 });

              console.log('[NFT] ✅ On-chain mint tx:', tx);

              // Poll transaction to get on-chain tokenId from AchievementMinted event
              let onchainTokenId = null;
              try {
                for (let i = 0; i < 10; i++) {
                  await new Promise(r => setTimeout(r, 3000));
                  const txInfo = await window.tronWeb.trx.getTransactionInfo(tx);
                  if (txInfo?.log?.length) {
                    // AchievementMinted event: topics[1]=player, topics[2]=tokenId
                    const mintLog = txInfo.log.find(l => l.topics?.length === 3);
                    if (mintLog?.topics?.[2]) {
                      onchainTokenId = parseInt(mintLog.topics[2], 16);
                    }
                    break;
                  }
                }
              } catch (e) { console.warn('[NFT] Could not get onchain tokenId:', e.message); }

              // Update database with txHash and onchainTokenId
              try {
                await fetch(`${API_BASE}/api/nft/confirm-mint`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    walletAddress: walletAddress,
                    gameId: signature.gameId,
                    txHash: tx,
                    tokenId: onchainTokenId || data.tokenId
                  })
                });
                console.log('[NFT] ✅ Database updated, onchainTokenId:', onchainTokenId);
              } catch (dbErr) {
                console.error('[NFT] Failed to update database:', dbErr);
              }

              Swal.fire({
                title: _lang === 'zh' ? '🎉 铸造成功！' : '🎉 Mint Successful!',
                html: `
                  <div style="text-align: center;">
                    <p>${_lang === 'zh' 
                      ? `您的 ${achievement.name || nftAchievement.handType} NFT 已上链铸造成功！`
                      : `Your ${achievement.name || nftAchievement.handType} NFT has been minted on-chain!`}</p>
                    <p style="font-size: 0.9rem; color: #888;">${_lang === 'zh' ? '交易:' : 'Tx:'} ${tx?.substring(0, 16)}...</p>
                  </div>
                `,
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: _lang === 'zh' ? '查看收藏' : 'View Collection',
                cancelButtonText: _lang === 'zh' ? '返回游戏' : 'Back to Game',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#28a745',
              }).then((result) => {
                if (result.isConfirmed) {
                  // User clicked "查看收藏" - set leaving flag before navigating
                  setIsLeaving(true);
                  navigate('/nft');
                }
                // If cancelled (返回游戏), just close the popup and continue playing
                // No need to set isLeaving flag - player stays in game
              });

            } catch (err) {
              console.error('[NFT] On-chain mint error:', err);
              Swal.fire({
                title: _lang === 'zh' ? '铸造失败' : 'Mint Failed',
                text: err.message || (_lang === 'zh' ? '请稍后重试' : 'Please try again later'),
                icon: 'error',
              });
            }
          });
          
          socket.once('SC_NFT_MINT_ERROR', (data) => {
            Swal.fire({
              title: _lang === 'zh' ? '铸造失败' : 'Mint Failed',
              text: data.error || (_lang === 'zh' ? '未知错误' : 'Unknown error'),
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

  // Handle leave - player forfeits and will see end screen
  const handleLeave = () => {
    // Set leaving flag but don't navigate yet - wait for tournament to end
    // The tournament will end when player leaves (only 1 player remaining)
    // Then SC_TOURNAMENT_ENDED will be received and end screen will show
    setIsLeaving(true);
    leaveTable();
    // Note: Don't navigate immediately - wait for tournamentEnded to become true
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

    // Find my CHIP reward
    const myChipReward = chipRewards?.find(r => r.address?.toLowerCase() === walletAddress);

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
            const chipReward = chipRewards?.find(r => r.address?.toLowerCase() === address?.toLowerCase());

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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                  {ranking.prizeAmount && (
                    <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1rem' }}>
                      {(ranking.prizeAmount / 1e6).toLocaleString()} TRX
                    </span>
                  )}
                  {chipReward && chipReward.chipReward > 0 && (
                    <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '0.9rem' }}>
                      +{chipReward.chipReward} CHIP 🎁
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CHIP奖励详情卡片 */}
        {myChipReward && myChipReward.chipReward > 0 && (
          <div style={{
            marginTop: '1.5rem',
            width: '100%',
            maxWidth: '500px',
            margin: '1.5rem auto 0',
            background: 'linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            border: '2px solid #4CAF50',
          }}>
            <Text color="#4CAF50" style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
              🎁 CHIP Bonus Reward
            </Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff' }}>Amount:</span>
              <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.25rem' }}>
                +{myChipReward.chipReward} CHIP
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ color: '#aaa' }}>VIP Level:</span>
              <span style={{ color: myChipReward.vipLevel === 'PLATINUM' ? '#E5E4E2' :
                            myChipReward.vipLevel === 'GOLD' ? '#FFD700' :
                            myChipReward.vipLevel === 'SILVER' ? '#C0C0C0' : '#CD7F32' }}>
                {myChipReward.vipLevel}
              </span>
            </div>
            {myChipReward.txid && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span style={{ color: '#aaa' }}>TX:</span>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>
                  {myChipReward.txid.substring(0, 10)}...
                </span>
              </div>
            )}
          </div>
        )}

        {/* 抽成信息 */}
        {rakeAmount > 0 && (
          <Text textCentered marginTop="1rem" color="#888" style={{ fontSize: '0.85rem' }}>
            Rake: {rakeAmount} TRX (5%)
          </Text>
        )}

        {/* 详细结算卡片 */}
        <div style={{
          marginTop: '1.5rem',
          width: '100%',
          maxWidth: '500px',
          margin: '1.5rem auto 0',
          background: 'rgba(70, 130, 180, 0.3)',
          borderRadius: '12px',
          padding: '1rem 1.5rem',
          border: '1px solid rgba(70, 130, 180, 0.5)',
        }}>
          <Text color="#ffd700" style={{ fontWeight: 'bold', marginBottom: '0.75rem' }}>
            💰 结算详情
          </Text>
          
          {/* TRX 部分 */}
          <div style={{ 
            borderBottom: '1px solid rgba(255,255,255,0.1)', 
            paddingBottom: '0.75rem', 
            marginBottom: '0.75rem' 
          }}>
            <Text color="#aaa" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>TRX (GameBalance)</Text>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>游戏前:</span>
              <span style={{ color: '#fff', fontSize: '1rem' }}>
                {(balanceBefore / 1e6).toFixed(2)} TRX
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>输赢:</span>
              <span style={{
                color: gameBalance > balanceBefore ? '#4CAF50' : gameBalance < balanceBefore ? '#f44336' : '#888',
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                {gameBalance > balanceBefore ? '+' : ''}{((gameBalance - balanceBefore) / 1e6).toFixed(2)} TRX
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ color: '#ffd700', fontSize: '0.9rem' }}>结束后:</span>
              <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1.25rem' }}>
                {(gameBalance / 1e6).toFixed(2)} TRX
              </span>
            </div>
          </div>
          
          {/* CHIP 部分 */}
          <div>
            <Text color="#4CAF50" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>CHIP Token</Text>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>游戏前:</span>
              <span style={{ color: '#fff', fontSize: '1rem' }}>
                {chipBalanceBefore.toLocaleString()} CHIP
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>奖励:</span>
              <span style={{
                color: (chipBalanceAfter - chipBalanceBefore) > 0 ? '#4CAF50' : '#888',
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                {(chipBalanceAfter - chipBalanceBefore) > 0 ? '+' : ''}{(chipBalanceAfter - chipBalanceBefore).toLocaleString()} CHIP
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ color: '#4CAF50', fontSize: '0.9rem' }}>结束后:</span>
              <span style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '1.25rem' }}>
                {chipBalanceAfter.toLocaleString()} CHIP
              </span>
            </div>
          </div>
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

            {/* GameBalance display */}
            <PositionedUISlot
              top="8vh"
              right="1.5rem"
              scale="0.65"
              style={{ zIndex: '50' }}
            >
              <div style={{ 
                background: 'rgba(0,0,0,0.7)', 
                padding: '0.5rem 1rem', 
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem'
              }}>
                💰 GameBalance: {(gameBalance / 1e6).toFixed(2)} TRX
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

        {/* AI Components - Hidden in tournaments for fairness */}
        {/* {currentTable && <AIControlPanel />} */}
        {/* {currentTable && currentTable.seats[seatId] && currentTable.seats[seatId].turn && <DecisionSuggestion />} */}
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
