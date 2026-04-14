/**
 * Game Resource Preloader
 * Preloads game assets while user is on the landing page
 * to eliminate loading delays when entering the game
 */

// P0 - Critical: Visible immediately when game starts
import bgImage from '../assets/img/background.png';
import tableImage from '../assets/game/table.webp';
import cardBack from '../assets/game/card_back.png';
import avatarImg from '../assets/game/avatar.png';
import rotateGif from '../assets/game/rotate.gif';

// P1 - High: Needed shortly after game loads
import dealerPng from '../assets/game/dealer.png';
import smallBlind from '../assets/game/small_blind.png';
import bigBlind from '../assets/game/big_blind.png';
import chipsGreen from '../assets/game/gglab_green.png';

// Player avatars
import player1 from '../assets/game/player1.png';
import player2 from '../assets/game/player2.png';
import player3 from '../assets/game/player3.png';
import player4 from '../assets/game/player4.png';
import player5 from '../assets/game/player5.png';
import player6 from '../assets/game/player6.png';

// All 52 card SVGs
import c2 from '../assets/game/cards-svg/c2.svg';
import c3 from '../assets/game/cards-svg/c3.svg';
import c4 from '../assets/game/cards-svg/c4.svg';
import c5 from '../assets/game/cards-svg/c5.svg';
import c6 from '../assets/game/cards-svg/c6.svg';
import c7 from '../assets/game/cards-svg/c7.svg';
import c8 from '../assets/game/cards-svg/c8.svg';
import c9 from '../assets/game/cards-svg/c9.svg';
import c10 from '../assets/game/cards-svg/c10.svg';
import cJ from '../assets/game/cards-svg/cJ.svg';
import cQ from '../assets/game/cards-svg/cQ.svg';
import cK from '../assets/game/cards-svg/cK.svg';
import cA from '../assets/game/cards-svg/cA.svg';
import d2 from '../assets/game/cards-svg/d2.svg';
import d3 from '../assets/game/cards-svg/d3.svg';
import d4 from '../assets/game/cards-svg/d4.svg';
import d5 from '../assets/game/cards-svg/d5.svg';
import d6 from '../assets/game/cards-svg/d6.svg';
import d7 from '../assets/game/cards-svg/d7.svg';
import d8 from '../assets/game/cards-svg/d8.svg';
import d9 from '../assets/game/cards-svg/d9.svg';
import d10 from '../assets/game/cards-svg/d10.svg';
import dJ from '../assets/game/cards-svg/dJ.svg';
import dQ from '../assets/game/cards-svg/dQ.svg';
import dK from '../assets/game/cards-svg/dK.svg';
import dA from '../assets/game/cards-svg/dA.svg';
import h2 from '../assets/game/cards-svg/h2.svg';
import h3 from '../assets/game/cards-svg/h3.svg';
import h4 from '../assets/game/cards-svg/h4.svg';
import h5 from '../assets/game/cards-svg/h5.svg';
import h6 from '../assets/game/cards-svg/h6.svg';
import h7 from '../assets/game/cards-svg/h7.svg';
import h8 from '../assets/game/cards-svg/h8.svg';
import h9 from '../assets/game/cards-svg/h9.svg';
import h10 from '../assets/game/cards-svg/h10.svg';
import hJ from '../assets/game/cards-svg/hJ.svg';
import hQ from '../assets/game/cards-svg/hQ.svg';
import hK from '../assets/game/cards-svg/hK.svg';
import hA from '../assets/game/cards-svg/hA.svg';
import s2 from '../assets/game/cards-svg/s2.svg';
import s3 from '../assets/game/cards-svg/s3.svg';
import s4 from '../assets/game/cards-svg/s4.svg';
import s5 from '../assets/game/cards-svg/s5.svg';
import s6 from '../assets/game/cards-svg/s6.svg';
import s7 from '../assets/game/cards-svg/s7.svg';
import s8 from '../assets/game/cards-svg/s8.svg';
import s9 from '../assets/game/cards-svg/s9.svg';
import s10 from '../assets/game/cards-svg/s10.svg';
import sJ from '../assets/game/cards-svg/sJ.svg';
import sQ from '../assets/game/cards-svg/sQ.svg';
import sK from '../assets/game/cards-svg/sK.svg';
import sA from '../assets/game/cards-svg/sA.svg';

// Resource lists by priority
const CRITICAL_ASSETS = [
  // Background and table - largest files that block rendering
  bgImage,
  tableImage,
  cardBack,
  avatarImg,
  rotateGif,
];

const HIGH_PRIORITY_ASSETS = [
  dealerPng,
  smallBlind,
  bigBlind,
  chipsGreen,
  player1,
  player2,
  player3,
  player4,
  player5,
  player6,
];

const CARD_ASSETS = [
  c2, c3, c4, c5, c6, c7, c8, c9, c10, cJ, cQ, cK, cA,
  d2, d3, d4, d5, d6, d7, d8, d9, d10, dJ, dQ, dK, dA,
  h2, h3, h4, h5, h6, h7, h8, h9, h10, hJ, hQ, hK, hA,
  s2, s3, s4, s5, s6, s7, s8, s9, s10, sJ, sQ, sK, sA,
];

let preloadCache = new Set();

/**
 * Preload an image using Image object (caches in browser)
 */
const preloadImage = (src) => {
  if (!src || preloadCache.has(src)) return Promise.resolve();
  preloadCache.add(src);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // Don't fail on error
    img.src = src;
  });
};

/**
 * Preload batch of images sequentially (to avoid overwhelming network)
 */
const preloadBatch = async (urls, batchSize = 4, delayMs = 100) => {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.all(batch.map(preloadImage));
    if (i + batchSize < urls.length && delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
};

/**
 * Main preload function - call from Landing page
 * Uses requestIdleCallback for non-blocking loading
 */
export const preloadGameAssets = () => {
  console.log('[Preload] Starting game asset preloading...');
  const startTime = performance.now();
  
  // Phase 1: Critical assets - load immediately
  preloadBatch(CRITICAL_ASSETS).then(() => {
    console.log(`[Preload] Critical assets loaded (${(performance.now() - startTime).toFixed(0)}ms)`);
  });
  
  // Phase 2: High priority - short delay then load
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      preloadBatch(HIGH_PRIORITY_ASSETS).then(() => {
        console.log(`[Preload] High-priority assets loaded (${(performance.now() - startTime).toFixed(0)}ms)`);
      });
    }, { timeout: 2000 });
  } else {
    setTimeout(() => {
      preloadBatch(HIGH_PRIORITY_ASSETS);
    }, 1500);
  }
  
  // Phase 3: Card SVGs - load during idle time
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Cards are smaller but many - use larger batches
      preloadBatch(CARD_ASSETS, 8, 50).then(() => {
        console.log(`[Preload] All ${CARD_ASSETS.length} cards loaded (${(performance.now() - startTime).toFixed(0)}ms)`);
        console.log('[Preload] Game assets fully preloaded!');
      });
    }, { timeout: 5000 });
  } else {
    setTimeout(() => {
      preloadBatch(CARD_ASSETS, 8, 50);
    }, 4000);
  }
};

/**
 * Quick emergency preload for when user clicks "Enter Game"
 * Only preloads the most critical remaining assets
 */
export const emergencyPreload = () => {
  // Just ensure critical assets are loaded
  preloadBatch(CRITICAL_ASSETS, 2, 0);
};

export default {
  preloadGameAssets,
  emergencyPreload,
};
