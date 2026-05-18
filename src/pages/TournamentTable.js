import React, { useContext, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../components/layout/Container';
import Button from '../components/buttons/Button';
import Heading from '../components/typography/Heading';
import Text from '../components/typography/Text';
import globalContext from '../context/global/globalContext';
import locaContext from '../context/localization/locaContext';
import { getPlayerBalance } from '../utils/tronInteract';
import { getCustodyBalance, switchChain } from '../utils/zeroGInteract';
import { ethers } from 'ethers';
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
import socket from '../socket';
import { buildApiUrl } from '../utils/serverConfig';
import './Play.scss';

// Detect language for i18n
const browserLang = (typeof navigator !== 'undefined' && /^zh/.test(navigator.language)) ? 'zh' : 'en';

const POKERHAND_INFT_ADDRESS = process.env.REACT_APP_NETWORK === 'mainnet'
  ? (process.env.REACT_APP_ZEROG_INFT_ADDRESS_MAINNET || process.env.REACT_APP_ZEROG_INFT_ADDRESS || '0xc6F5495D411405630dF5d5ad32225d7F51dC1645')
  : (process.env.REACT_APP_ZEROG_INFT_ADDRESS || '0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5');
const ZEROG_WEI_PER_SUN = 1e9;

const toDisplayTournamentAmount = (amountSun, isZeroGPlayer) => {
  const amount = Number(amountSun || 0);
  return amount / (isZeroGPlayer ? ZEROG_WEI_PER_SUN : 1e6);
};

const toBalanceUnits = (value, isZeroGPlayer) => {
  if (value === null || value === undefined) return null;
  const raw = String(value);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  if (!isZeroGPlayer) return parsed;
  return raw.includes('.') ? parsed * 1e18 : parsed;
};

const resizeCanvasForNFT = (canvas, { maxWidth = 1280, maxHeight = 720 } = {}) => {
  const ratio = Math.min(1, maxWidth / canvas.width, maxHeight / canvas.height);
  if (ratio >= 1) return canvas;

  const resized = document.createElement('canvas');
  resized.width = Math.max(1, Math.round(canvas.width * ratio));
  resized.height = Math.max(1, Math.round(canvas.height * ratio));
  const context = resized.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, 0, 0, resized.width, resized.height);
  return resized;
};

const canvasToCompressedImage = (canvas, { maxLength = 360000 } = {}) => {
  const outputCanvas = resizeCanvasForNFT(canvas);
  const qualitySteps = [0.78, 0.68, 0.58, 0.48, 0.38, 0.3];

  for (const quality of qualitySteps) {
    const dataUrl = outputCanvas.toDataURL('image/jpeg', quality);
    if (dataUrl && dataUrl.length <= maxLength) {
      return dataUrl;
    }
  }

  return outputCanvas.toDataURL('image/jpeg', 0.24);
};

const isCanvasVisuallyBlank = (canvas) => {
  const width = canvas?.width || 0;
  const height = canvas?.height || 0;
  if (width < 10 || height < 10) return true;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return true;

  const sampleSize = 9;
  const stepX = Math.max(1, Math.floor(width / sampleSize));
  const stepY = Math.max(1, Math.floor(height / sampleSize));
  let brightPixels = 0;
  let variedPixels = 0;
  let lastColor = null;

  for (let y = Math.floor(stepY / 2); y < height; y += stepY) {
    for (let x = Math.floor(stepX / 2); x < width; x += stepX) {
      const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
      if (a > 0 && (r + g + b) > 90) brightPixels += 1;
      const color = `${r},${g},${b}`;
      if (lastColor && color !== lastColor) variedPixels += 1;
      lastColor = color;
    }
  }

  return brightPixels < 4 || variedPixels < 3;
};

const requestINFTImportToMetaMask = async (input) => {
  const tokenId = typeof input === 'object' ? input?.tokenId : input;
  const claimId = typeof input === 'object' ? input?.claimId : null;
  const imageUrl = typeof input === 'object'
    ? input?.imageUrl
    : (claimId ? buildApiUrl(`/api/nft/preview/${claimId}`) : null);

  if (!window.ethereum || !tokenId) return false;
  try {
    await switchChain(process.env.REACT_APP_NETWORK || 'testnet');
    if (imageUrl) {
      try {
        await fetch(imageUrl, { cache: 'reload' });
      } catch (previewErr) {
        console.warn('[NFT] Preview warmup failed:', previewErr.message);
      }
    }
    const options = {
      address: POKERHAND_INFT_ADDRESS,
      tokenId: String(tokenId),
    };
    if (imageUrl) {
      options.image = imageUrl;
    }

    try {
      return await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC721',
          options,
        },
      });
    } catch (err) {
      if (!imageUrl) throw err;
      console.warn('[NFT] MetaMask import with image failed, retrying minimal payload:', err.message);
      return await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC721',
        options: {
          address: POKERHAND_INFT_ADDRESS,
          tokenId: String(tokenId),
        },
      },
    });
    }
  } catch (err) {
    console.warn('[NFT] MetaMask auto-import failed:', err.message);
    return false;
  }
};

const getMetaMaskImportCopy = (tokenId) => {
  if (!tokenId) {
    return browserLang === 'zh'
      ? '未拿到链上 Token ID，无法自动请求 MetaMask 添加 NFT。请先在收藏页确认铸造记录。'
      : 'No on-chain Token ID was returned, so MetaMask import cannot be requested automatically. Check the collection page first.';
  }

  return browserLang === 'zh'
    ? `如果 MetaMask 没有弹出确认，请手动导入 NFT。合约: ${POKERHAND_INFT_ADDRESS}，Token ID: ${tokenId}`
    : `If MetaMask did not show a confirmation, import the NFT manually. Contract: ${POKERHAND_INFT_ADDRESS}, Token ID: ${tokenId}`;
};

const showINFTMintSuccess = ({
  _lang,
  achievementName,
  mintedTokenId,
  claimId,
  txHash,
  warning,
  navigate
}) => {
  const importCopy = getMetaMaskImportCopy(mintedTokenId);

  Swal.fire({
    title: _lang === 'zh' ? '🎉 铸造成功！' : '🎉 Mint Successful!',
    html: `
      <div style="text-align:center">
        <p>${_lang === 'zh'
          ? `您的 ${achievementName} INFT 已上链铸造！`
          : `Your ${achievementName} INFT has been minted!`}</p>
        <p style="font-size:0.85rem;color:#888">Token ID: ${mintedTokenId || '-'}</p>
        <p style="font-size:0.85rem;color:#888">${_lang === 'zh' ? '交易:' : 'Tx:'} ${txHash ? `${txHash.substring(0, 18)}...` : '-'}</p>
        <p style="font-size:0.75rem;color:#aaa;word-break:break-all">${importCopy}</p>
        <p style="font-size:0.8rem;color:#aaa">${warning || ''}</p>
      </div>`,
    icon: 'success',
    showCancelButton: true,
    showDenyButton: !!mintedTokenId,
    confirmButtonText: mintedTokenId ? (_lang === 'zh' ? '添加到 MetaMask' : 'Add to MetaMask') : (_lang === 'zh' ? '查看收藏' : 'View Collection'),
    denyButtonText: _lang === 'zh' ? '查看收藏' : 'View Collection',
    cancelButtonText: _lang === 'zh' ? '返回游戏' : 'Back to Game',
  }).then(async (result) => {
    if (result.isConfirmed && mintedTokenId) {
      await requestINFTImportToMetaMask({
        tokenId: mintedTokenId,
        claimId,
        imageUrl: claimId ? buildApiUrl(`/api/nft/preview/${claimId}`) : null,
      });
      return;
    }
    if (result.isConfirmed || result.isDenied) {
      navigate('/nft');
    }
  });
};

const getConnectedSocket = async (fallbackSocket, timeoutMs = 5000) => {
  const activeSocket =
    (typeof window !== 'undefined' && window.socket && window.socket.connected)
      ? window.socket
      : fallbackSocket;

  if (!activeSocket) return null;
  if (activeSocket.connected) return activeSocket;

  try {
    if (typeof activeSocket.connect === 'function') {
      activeSocket.connect();
    }
  } catch (err) {
    console.warn('[NFT] Socket connect attempt failed:', err.message);
  }

  return await new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      if (typeof activeSocket.off === 'function') {
        activeSocket.off('connect', onConnect);
      }
      resolve(activeSocket.connected ? activeSocket : null);
    }, timeoutMs);

    function onConnect() {
      clearTimeout(timeoutId);
      resolve(activeSocket);
    }

    if (typeof activeSocket.once === 'function') {
      activeSocket.once('connect', onConnect);
    }
  });
};

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
  const { lang: appLang } = useContext(locaContext);
  const _lang = appLang || browserLang;
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
  const balancePollTimerRef = useRef(null);
  const balanceSyncInFlightRef = useRef(false);
  const latestGameScreenshotRef = useRef(null);

  // Track previous turn state to only reset bet when turn changes
  const prevTurnRef = useRef(null);
  const prevHandRef = useRef(null);

  // Detect if player is using 0G (EVM address with 0x prefix)
  const isZeroGPlayer = walletAddress?.startsWith('0x');
  const tournamentBuyIn = tournament?.buyIn || 100000000;

  const waitForPaint = useCallback(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }), []);

  const waitForFinalAchievementRender = useCallback(async (achievement, timeoutMs = 1800) => {
    const expectedBoardLength = achievement?.gameState?.board?.length || achievement?.board?.length || 0;
    const finalStateRequired = !!achievement?.gameState?.showFinalHand || !!achievement?.gameState?.handOver;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const tableElement = document.querySelector('[data-nft-capture="tournament-table"]');
      const boardImages = tableElement?.querySelectorAll('img[alt]') || [];
      const hasExpectedBoard = expectedBoardLength === 0 || boardImages.length >= expectedBoardLength;
      const hasWinMessage = !achievement?.gameState?.winMessages?.length ||
        achievement.gameState.winMessages.some((message) => document.body.innerText.includes(message));

      if (!finalStateRequired || (hasExpectedBoard && hasWinMessage)) {
        await waitForPaint();
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, 80));
    }

    console.warn('[TournamentTable] Timed out waiting for final achievement render');
    return false;
  }, [waitForPaint]);

  const captureGameScreenshot = useCallback(async (source = 'manual') => {
    await waitForPaint();
    console.log(`[TournamentTable] Capturing game screenshot (${source})...`);

    const gameElement =
      document.querySelector('[data-nft-capture="tournament-table"]') ||
      document.querySelector('[data-nft-capture="poker-table"]') ||
      document.querySelector('.play-area') ||
      document.querySelector('[class*="PokerTableWrapper"]');

    if (!gameElement) {
      console.warn('[TournamentTable] No suitable game element found for screenshot');
      return null;
    }

    const rect = gameElement.getBoundingClientRect();
    const elementWidth = Math.round(rect.width || gameElement.offsetWidth || 0);
    const elementHeight = Math.round(rect.height || gameElement.offsetHeight || 0);
    console.log('[TournamentTable] Screenshot element dimensions:', elementWidth, 'x', elementHeight);

    if (elementWidth < 100 || elementHeight < 100) {
      console.warn('[TournamentTable] Screenshot element too small');
      return null;
    }

    try {
      const canvas = await html2canvas(gameElement, {
        backgroundColor: '#0a0a0f',
        scale: 1,
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 8000,
        width: Math.min(elementWidth, 1920),
        height: Math.min(elementHeight, 1080),
        windowWidth: elementWidth,
        windowHeight: elementHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const clonedElement =
            clonedDoc.querySelector('[data-nft-capture="tournament-table"]') ||
            clonedDoc.querySelector('[data-nft-capture="poker-table"]') ||
            clonedDoc.querySelector('.play-area') ||
            clonedDoc.querySelector('[class*="PokerTableWrapper"]');
          if (clonedElement) {
            clonedElement.style.backgroundColor = '#0a0a0f';
            clonedElement.style.boxShadow = 'none';
            clonedElement.style.filter = 'none';
            clonedElement.style.overflow = 'hidden';
          }

          const style = clonedDoc.createElement('style');
          style.textContent = `
            .play-area::before,
            .play-area::after {
              display: none !important;
              content: none !important;
            }
            * {
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      if (isCanvasVisuallyBlank(canvas)) {
        console.warn('[TournamentTable] Screenshot canvas appears visually blank');
        return null;
      }

      const screenshot = canvasToCompressedImage(canvas);
      if (!screenshot || screenshot.length < 1000) {
        console.warn('[TournamentTable] Screenshot canvas produced empty image');
        return null;
      }
      console.log('[TournamentTable] Screenshot captured successfully, size:', screenshot.length);
      return screenshot;
    } catch (err) {
      console.warn('[TournamentTable] Screenshot capture failed:', err?.message || err);
      return null;
    }
  }, [waitForPaint]);

  useEffect(() => {
    if (!currentTable || tournamentEnded) return;

    const timer = setTimeout(async () => {
      const screenshot = await captureGameScreenshot('cache');
      if (screenshot) latestGameScreenshotRef.current = screenshot;
    }, 350);

    return () => clearTimeout(timer);
  }, [currentTable, tournamentEnded, captureGameScreenshot]);

  // Fetch GameBalance from contract
  const fetchGameBalance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      let total;

      if (isZeroGPlayer) {
        // 0G EVM: get custody balance from PokerGame0G contract
        const custBal = await getCustodyBalance(walletAddress);
        total = parseFloat(custBal) * 1e18; // Convert to internal units for display
        console.log('[TournamentTable] 0G custody balance:', custBal, '0G');
      } else {
        // TRON: get balance from TRON contract
        const balance = await getPlayerBalance(walletAddress);
        total = (balance.balance || 0) + (balance.locked || 0);
      }

      setGameBalance(total);
      return total;
    } catch (e) {
      console.error('[TournamentTable] Failed to fetch balance:', e);
      return null;
    }
  }, [walletAddress, isZeroGPlayer]);

  // Fetch CHIP balance from API
  const fetchChipBalance = useCallback(async () => {
    if (!walletAddress) return 0;
    try {
      const res = await fetch(buildApiUrl(`/api/chip/onchain/balance/${walletAddress}`));
      const data = await res.json();
      return data.balance || 0;
    } catch (e) {
      console.error('[TournamentTable] Failed to fetch CHIP balance:', e);
      return 0;
    }
  }, [walletAddress]);

  const refreshGameBalance = useCallback(async () => {
    if (!walletAddress || balanceSyncInFlightRef.current) return null;

    balanceSyncInFlightRef.current = true;
    try {
      return await fetchGameBalance();
    } finally {
      balanceSyncInFlightRef.current = false;
    }
  }, [walletAddress, fetchGameBalance]);

  // Fetch balance on mount and when walletAddress changes
  useEffect(() => {
    if (walletAddress) {
      refreshGameBalance().then(balance => {
        if (balance !== null && !prevTournamentEnded.current) {
          const buyInUnits = isZeroGPlayer ? (Number(tournamentBuyIn) * ZEROG_WEI_PER_SUN) : 0;
          setBalanceBefore(balance + buyInUnits);
        }
      });
      fetchChipBalance().then(chipBalance => {
        if (!prevTournamentEnded.current) {
          setChipBalanceBefore(chipBalance);
        }
      });
    }
  }, [walletAddress, refreshGameBalance, fetchChipBalance, isZeroGPlayer, tournamentBuyIn]);

  useEffect(() => {
    const handleBalanceSynced = (data) => {
      const eventAddress = data?.walletAddress?.toLowerCase();
      if (eventAddress && eventAddress !== walletAddress?.toLowerCase()) return;

      const nextBalance = toBalanceUnits(data?.total ?? data?.available ?? data?.balance, isZeroGPlayer);
      if (nextBalance !== null) {
        console.log('[TournamentTable] Balance synced from socket:', data);
        setGameBalance(nextBalance);
      }
    };

    socket.on('SC_BALANCE_SYNCED', handleBalanceSynced);
    return () => socket.off('SC_BALANCE_SYNCED', handleBalanceSynced);
  }, [walletAddress, isZeroGPlayer]);

  // Fallback: keep re-syncing 0G custody balance even if socket events are missed
  useEffect(() => {
    if (!walletAddress || !isZeroGPlayer) return;

    let cancelled = false;
    const syncBalance = async () => {
      if (cancelled) return;
      await refreshGameBalance();
    };

    syncBalance();
    balancePollTimerRef.current = setInterval(syncBalance, 10000);

    return () => {
      cancelled = true;
      if (balancePollTimerRef.current) clearInterval(balancePollTimerRef.current);
      balancePollTimerRef.current = null;
    };
  }, [walletAddress, isZeroGPlayer, refreshGameBalance]);

  // When tournament ends, fetch new balance to show change
  useEffect(() => {
    if (tournamentEnded && !prevTournamentEnded.current) {
      prevTournamentEnded.current = true;
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
  }, [tournamentEnded, chipBalanceBefore, fetchGameBalance, fetchChipBalance, isLeaving]);

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

      (async () => {
        await waitForFinalAchievementRender(nftAchievement);
        let screenshotReady = false;
        const screenshotPromise = captureGameScreenshot('final-achievement')
          .then((screenshot) => {
            if (screenshot) latestGameScreenshotRef.current = screenshot;
            return screenshot;
          })
          .catch((err) => {
            console.warn('[TournamentTable] Final achievement screenshot failed:', err?.message || err);
            return null;
          })
          .finally(() => {
            screenshotReady = true;
          });

        // Show the achievement popup immediately while the final screenshot is captured in parallel.
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
            if (!screenshotReady) {
              Swal.fire({
                title: _lang === 'zh' ? '准备截图...' : 'Preparing Screenshot...',
                html: '<p>' + (_lang === 'zh' ? '正在保存最终牌局画面...' : 'Saving the final hand view...') + '</p>',
                allowOutsideClick: false,
                didOpen: () => {
                  Swal.showLoading();
                }
              });
            }

            // Screenshot capture starts before the popup, from the final hand state.
            const screenshotBase64 = await screenshotPromise;
            if (!screenshotBase64) {
              await Swal.fire({
                title: _lang === 'zh' ? '截图失败' : 'Screenshot Failed',
                text: _lang === 'zh'
                  ? '没有捕获到完整的最终游戏画面，已取消铸造。请保持结算后的游戏桌面可见后重试。'
                  : 'No complete final game screenshot was captured, so minting was cancelled. Keep the completed game table visible and try again.',
                icon: 'error',
                background: '#1a1a2e',
                color: '#fff',
              });
              return;
            }
            
            // Mint NFT via socket. Register listeners before emitting, because the
            // server can return SC_NFT_MINT_READY very quickly in 0G server-mint mode.
            const mintSocket = await getConnectedSocket(socket);
            const achievementOwner = nftAchievement.playerAddress || walletAddress;
            if (!mintSocket || !mintSocket.connected) {
              await Swal.fire({
                title: _lang === 'zh' ? '铸造失败' : 'Mint Failed',
                text: _lang === 'zh'
                  ? 'Socket 未连接，无法发送铸造请求。请刷新页面后重试。'
                  : 'Socket is not connected, so the mint request could not be sent. Refresh and try again.',
                icon: 'error',
              });
              return;
            }

            const mintPayload = {
              walletAddress: achievementOwner,
              achievementType: nftAchievement.achievementType,
              gameSessionId: nftAchievement.gameId,
              publicBaseUrl: window.location.origin,
              handData: {
                cards: nftAchievement.cards,
                hand: nftAchievement.hand,
                board: nftAchievement.board
              },
              screenshot: screenshotBase64
            };

            let mintCompleted = false;
            let mintTimeoutId = null;
            let handleMintReady;
            let handleMintError;
            let handleMintDisconnect;
            const cleanupMintListeners = () => {
              if (mintTimeoutId) {
                clearTimeout(mintTimeoutId);
                mintTimeoutId = null;
              }
              if (handleMintReady) mintSocket.off('SC_NFT_MINT_READY', handleMintReady);
              if (handleMintError) mintSocket.off('SC_NFT_MINT_ERROR', handleMintError);
              if (handleMintDisconnect) mintSocket.off('disconnect', handleMintDisconnect);
            };
            const finishMintRequest = () => {
              if (mintCompleted) return false;
              mintCompleted = true;
              cleanupMintListeners();
              return true;
            };

            handleMintReady = async (data) => {
              if (!finishMintRequest()) return;
            try {
              const { signature, onchainContractAddress } = data;

              // === Check if server already minted on-chain (0G mode) ===
              if (data.txHash || data.onchainResult?.success || data.chain === '0G') {
                console.log('[NFT] Server already minted on-chain, showing success:', {
                  txHash: data.txHash || data.onchainResult?.txHash,
                  tokenId: data.tokenId || data.onchainResult?.tokenId
                });
                showINFTMintSuccess({
                  _lang,
                  achievementName: achievement.name || nftAchievement.handType,
                  mintedTokenId: data.onchainTokenId || data.onchainResult?.onchainTokenId || data.onchainResult?.tokenId || data.tokenId,
                  claimId: data.claimId,
                  txHash: data.txHash || data.onchainResult?.txHash,
                  warning: data.warning,
                  navigate
                });
                return;
              }

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

              // Detect 0G player by wallet address prefix
              const isZeroGMinter = achievementOwner?.startsWith('0x');

              // === 0G NFT Mint Path (MetaMask/Ethers) ===
              if (isZeroGMinter) {
                console.log('[NFT] Using 0G INFT mint path via MetaMask');
                try {
                  if (!window.ethereum) {
                    throw new Error('No Ethereum wallet (MetaMask) found');
                  }

                  const abi = [
                    'function mint(address to, string handType, string storageRootHash, string metadataURI) returns (uint256)'
                  ];

                  // Map typeId to hand type name and representative cards
                  const HAND_TYPES = [
                    { name: 'Royal Flush', cards: ['A♥','K♥','Q♥','J♥','10♥'], color: '#FFD700' },
                    { name: 'Straight Flush', cards: ['9♠','8♠','7♠','6♠','5♠'], color: '#E040FB' },
                    { name: 'Four of a Kind', cards: ['A♠','A♥','A♦','A♣','K♠'], color: '#42A5F5' },
                    { name: 'Full House', cards: ['K♣','K♦','K♥','Q♠','Q♥'], color: '#66BB6A' },
                    { name: 'Flush', cards: ['10♦','8♦','7♦','4♦','2♦'], color: '#26C6DA' },
                    { name: 'Straight', cards: ['5♠','4♥','3♦','2♣','A♠'], color: '#FF7043' },
                    { name: 'Three of a Kind', cards: ['J♠','J♥','J♦','7♣','3♠'], color: '#AB47BC' },
                    { name: 'Two Pair', cards: ['10♠','10♥','5♦','5♣','K♠'], color: '#FFCA28' },
                    { name: 'One Pair', cards: ['9♥','9♦','A♠','5♣','3♦'], color: '#78909C' }
                  ];
                  const handType = HAND_TYPES[signature.achievementTypeId] || HAND_TYPES[8];
                  const handTypeName = handType.name;

                  const metadataURI = data.metadataURI || (
                    data.claimId
                      ? buildApiUrl(`/api/nft/metadata/inft/${data.claimId}`)
                      : null
                  );

                  if (!metadataURI) {
                    throw new Error('Missing metadata URI for INFT mint');
                  }

                  const iface = new ethers.utils.Interface(abi);
                  const mintData = iface.encodeFunctionData('mint', [
                    achievementOwner,
                    handTypeName,
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    metadataURI
                  ]);

                  const txHash = await window.ethereum.request({
                      method: 'eth_sendTransaction',
                      params: [{
                      from: achievementOwner,
                      to: POKERHAND_INFT_ADDRESS,
                      data: mintData
                    }]
                  });

                  console.log('[NFT] 0G INFT mint tx:', txHash);

                  // Update database with txHash
                  let mintedTokenId = data.onchainTokenId || data.onchainResult?.onchainTokenId || data.onchainResult?.tokenId || data.tokenId;
                  try {
                    const confirmResponse = await fetch(buildApiUrl('/api/nft/confirm-mint'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        walletAddress: achievementOwner,
                        gameId: signature.gameId,
                        txHash: txHash,
                        tokenId: data.tokenId
                      })
                    });
                    const confirmData = await confirmResponse.json().catch(() => ({}));
                    mintedTokenId = confirmData.onchainTokenId || confirmData.tokenId || mintedTokenId;
                  } catch (dbErr) {
                    console.error('[NFT] Failed to update database:', dbErr);
                  }
                  showINFTMintSuccess({
                    _lang,
                    achievementName: achievement.name || nftAchievement.handType,
                    mintedTokenId,
                    claimId: data.claimId,
                    txHash,
                    navigate
                  });
                } catch (zeroGErr) {
                  console.error('[NFT] 0G mint error:', zeroGErr);
                  Swal.fire({
                    title: _lang === 'zh' ? '铸造失败' : 'Mint Failed',
                    text: zeroGErr.message || (_lang === 'zh' ? '0G 铸造错误' : '0G mint error'),
                    icon: 'error'
                  });
                }
                return;
              }

              // === TRON NFT Mint Path (TronWeb) ===
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
                await fetch(buildApiUrl('/api/nft/confirm-mint'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    walletAddress: achievementOwner,
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
	          };

	          handleMintError = (data = {}) => {
	            if (!finishMintRequest()) return;
	            Swal.fire({
	              title: _lang === 'zh' ? '铸造失败' : 'Mint Failed',
	              text: data.error || (_lang === 'zh' ? '未知错误' : 'Unknown error'),
	              icon: 'error',
	            });
	          };

	          handleMintDisconnect = (reason) => {
	            if (!finishMintRequest()) return;
	            Swal.fire({
	              title: _lang === 'zh' ? '铸造失败' : 'Mint Failed',
	              text: _lang === 'zh'
	                ? `Socket 连接在发送铸造请求时断开: ${reason || 'unknown'}`
	                : `Socket disconnected while sending the mint request: ${reason || 'unknown'}`,
	              icon: 'error',
	            });
	          };

	          mintSocket.once('SC_NFT_MINT_READY', handleMintReady);
	          mintSocket.once('SC_NFT_MINT_ERROR', handleMintError);
	          mintSocket.once('disconnect', handleMintDisconnect);
	          mintTimeoutId = setTimeout(() => {
	            if (!finishMintRequest()) return;
	            Swal.fire({
	              title: _lang === 'zh' ? '铸造超时' : 'Mint Timeout',
	              text: _lang === 'zh'
	                ? '服务器在 120 秒内没有返回铸造结果。请检查后台日志或稍后重试。'
	                : 'The server did not return a mint result within 120 seconds. Check server logs or try again later.',
	              icon: 'error',
	            });
	          }, 120000);

	          // Show minting in progress
	          Swal.fire({
	            title: _lang === 'zh' ? '铸造中...' : 'Minting...',
	            html: '<p>' + (_lang === 'zh' ? '正在铸造您的 NFT...' : 'Minting your NFT...') + '</p>',
	            allowOutsideClick: false,
	            didOpen: () => {
	              Swal.showLoading();
	            }
	          });

	          console.log('[NFT] Preparing mint request:', {
	            achievementOwner,
	            achievementType: nftAchievement.achievementType,
	            gameId: nftAchievement.gameId,
	            hasScreenshot: !!screenshotBase64,
	            socketId: mintSocket.id,
	            socketConnected: mintSocket.connected
	          });
	          mintSocket.emit('CS_NFT_PREPARE_MINT', mintPayload);
	        }
	      }); // end of Swal.then()
    })(); // end of async IIFE
    
    setNftAchievement(null);
  }
  }, [captureGameScreenshot, navigate, nftAchievement, setNftAchievement, waitForFinalAchievementRender, walletAddress]);

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
    leaveTable({ forceNavigate: tournamentEnded });
    // Note: Don't navigate immediately - wait for tournamentEnded to become true
  };

  // Tournament ended - show final results
  if (tournamentEnded) {
    const normalizedWalletAddress = (globalCtx?.walletAddress || walletAddress || '').toLowerCase();
    const myRank = finalRankings.find(r => {
      const addr = (r.address || r)?.toLowerCase();
      return addr === normalizedWalletAddress;
    });
    const myPosition = myRank ? finalRankings.indexOf(myRank) + 1 : finalRankings.length;
    const isWinner = myPosition === 1;

    // Find my CHIP reward
    const myChipReward = chipRewards?.find(r => r.address?.toLowerCase() === normalizedWalletAddress);

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
            const isMe = address?.toLowerCase() === normalizedWalletAddress;
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
                      {toDisplayTournamentAmount(ranking.prizeAmount, isZeroGPlayer).toLocaleString()} {isZeroGPlayer ? '0G' : 'TRX'}
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
            Rake: {toDisplayTournamentAmount(rakeAmount, isZeroGPlayer).toFixed(isZeroGPlayer ? 4 : 1)} {isZeroGPlayer ? '0G' : 'TRX'} (5%)
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
            <Text color="#aaa" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              {isZeroGPlayer ? '0G' : 'TRX'} (GameBalance)
            </Text>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>游戏前:</span>
              <span style={{ color: '#fff', fontSize: '1rem' }}>
                {isZeroGPlayer
                  ? (balanceBefore / 1e18).toFixed(4) + ' 0G'
                  : (balanceBefore / 1e6).toFixed(2) + ' TRX'
                }
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ color: '#888', fontSize: '0.9rem' }}>输赢:</span>
              <span style={{
                color: gameBalance > balanceBefore ? '#4CAF50' : gameBalance < balanceBefore ? '#f44336' : '#888',
                fontWeight: 'bold',
                fontSize: '1.1rem'
              }}>
                {gameBalance > balanceBefore ? '+' : ''}{isZeroGPlayer
                  ? ((gameBalance - balanceBefore) / 1e18).toFixed(4)
                  : ((gameBalance - balanceBefore) / 1e6).toFixed(2)
                } {isZeroGPlayer ? '0G' : 'TRX'}
              </span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
              <span style={{ color: '#ffd700', fontSize: '0.9rem' }}>结束后:</span>
              <span style={{ color: '#ffd700', fontWeight: 'bold', fontSize: '1.25rem' }}>
                {(gameBalance / (isZeroGPlayer ? 1e18 : 1e6)).toFixed(2)} {isZeroGPlayer ? '0G' : 'TRX'}
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

  // Player left / eliminated mid-tournament (multi-player: tournament continues without us)
  if (isLeaving && !tournamentEnded) {
    const browserLang = navigator.language || 'en';
    return (
      <Container fullHeight flexDirection="column" padding="6rem 2rem 2rem 2rem" alignItems="center" justifyContent="center">
        <Heading as="h2" textCentered color="#ff9800" style={{ fontSize: '2rem' }}>
          {browserLang === 'zh' ? '已退出锦标赛' : 'Left Tournament'}
        </Heading>
        <Text textCentered marginTop="1.5rem" color="#fff" style={{ fontSize: '1.1rem' }}>
          Tournament #{tournamentId}
        </Text>
        <div style={{
          margin: '3rem auto',
          padding: '1.5rem 2.5rem',
          background: 'rgba(255,152,0,0.12)',
          borderRadius: '16px',
          border: '1px solid rgba(255,152,0,0.35)',
          textAlign: 'center',
          maxWidth: '420px'
        }}>
          <Text textCentered color="#ccc" style={{ lineHeight: 1.7, fontSize: '0.95rem' }}>
            {browserLang === 'zh'
              ? '您已退出本次锦标赛。锦标赛仍在进行中，祝其他玩家好运！'
              : 'You have left this tournament. The tournament continues — good luck to the remaining players!'}
          </Text>
        </div>
        <Button primary onClick={() => navigate('/tournament')} style={{ marginTop: '2rem', padding: '0.75rem 2.5rem', fontSize: '1rem' }}>
          {browserLang === 'zh' ? '返回锦标赛列表' : 'Back to Tournaments'}
        </Button>
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
          <Button secondary onClick={handleLeave} disabled={isLeaving}>
            {isLeaving ? 'Leaving...' : 'Leave Tournament'}
          </Button>
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
        data-nft-capture="tournament-table"
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
                💰 GameBalance: {isZeroGPlayer
                  ? (gameBalance / 1e18).toFixed(4) + ' 0G'
                  : (gameBalance / 1e6).toFixed(2) + ' TRX'
                }
              </div>
            </PositionedUISlot>
          </>
        )}
        
        <PokerTableWrapper data-nft-capture="poker-table">
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
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('address') ||
      contextWalletAddress ||
      localStorage.getItem('wallet_address') ||
      localStorage.getItem('testWalletAddress');
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
