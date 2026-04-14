/**
 * Game Resource Preloader
 * Preloads game assets while user is on the landing page
 * to eliminate loading delays when entering the game
 *
 * Strategy:
 * - P0: Only background + table (the 2 biggest images that block first paint)
 * - P1: UI elements (avatars, dealer, chips) - loaded via idle callback
 * - P2: 52 card SVGs - loaded lazily in batches (only needed when cards are dealt)
 */

// P0 - Critical: Only the 2 largest images that block game rendering
import bgImage from '../assets/img/background.png';
import tableImage from '../assets/game/table.webp';

// P1 - High: Needed shortly after game loads
import cardBack from '../assets/game/card_back.png';
import avatarImg from '../assets/game/avatar.png';

// P2 - UI elements (load during idle time)
let dealerPng, smallBlind, bigBlind, chipsGreen;
let player1, player2, player3, player4, player5, player6;

// P3 - Card SVGs (lazy load, only when needed)
const CARD_IMPORTS = () => [
  import('../assets/game/cards-svg/c2.svg'), import('../assets/game/cards-svg/c3.svg'),
  import('../assets/game/cards-svg/c4.svg'), import('../assets/game/cards-svg/c5.svg'),
  import('../assets/game/cards-svg/c6.svg'), import('../assets/game/cards-svg/c7.svg'),
  import('../assets/game/cards-svg/c8.svg'), import('../assets/game/cards-svg/c9.svg'),
  import('../assets/game/cards-svg/c10.svg'), import('../assets/game/cards-svg/cJ.svg'),
  import('../assets/game/cards-svg/cQ.svg'), import('../assets/game/cards-svg/cK.svg'),
  import('../assets/game/cards-svg/cA.svg'), import('../assets/game/cards-svg/d2.svg'),
  import('../assets/game/cards-svg/d3.svg'), import('../assets/game/cards-svg/d4.svg'),
  import('../assets/game/cards-svg/d5.svg'), import('../assets/game/cards-svg/d6.svg'),
  import('../assets/game/cards-svg/d7.svg'), import('../assets/game/cards-svg/d8.svg'),
  import('../assets/game/cards-svg/d9.svg'), import('../assets/game/cards-svg/d10.svg'),
  import('../assets/game/cards-svg/dJ.svg'), import('../assets/game/cards-svg/dQ.svg'),
  import('../assets/game/cards-svg/dK.svg'), import('../assets/game/cards-svg/dA.svg'),
  import('../assets/game/cards-svg/h2.svg'), import('../assets/game/cards-svg/h3.svg'),
  import('../assets/game/cards-svg/h4.svg'), import('../assets/game/cards-svg/h5.svg'),
  import('../assets/game/cards-svg/h6.svg'), import('../assets/game/cards-svg/h7.svg'),
  import('../assets/game/cards-svg/h8.svg'), import('../assets/game/cards-svg/h9.svg'),
  import('../assets/game/cards-svg/h10.svg'), import('../assets/game/cards-svg/hJ.svg'),
  import('../assets/game/cards-svg/hQ.svg'), import('../assets/game/cards-svg/hK.svg'),
  import('../assets/game/cards-svg/hA.svg'), import('../assets/game/cards-svg/s2.svg'),
  import('../assets/game/cards-svg/s3.svg'), import('../assets/game/cards-svg/s4.svg'),
  import('../assets/game/cards-svg/s5.svg'), import('../assets/game/cards-svg/s6.svg'),
  import('../assets/game/cards-svg/s7.svg'), import('../assets/game/cards-svg/s8.svg'),
  import('../assets/game/cards-svg/s9.svg'), import('../assets/game/cards-svg/s10.svg'),
  import('../assets/game/cards-svg/sJ.svg'), import('../assets/game/cards-svg/sQ.svg'),
  import('../assets/game/cards-svg/sK.svg'), import('../assets/game/cards-svg/sA.svg'),
];

// Resource lists by priority
const CRITICAL_ASSETS = [
  // Only the 2 biggest images that block first paint
  bgImage,
  tableImage,
];

// High priority - needed after game starts showing
const HIGH_PRIORITY_ASSETS = [
  cardBack,
  avatarImg,
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
 * Preload batch of images with concurrency control
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
 * Lazy load UI assets using dynamic import
 */
const lazyLoadUIAssets = async () => {
  try {
    const mods = await Promise.all([
      import('../assets/game/dealer.png'),
      import('../assets/game/small_blind.png'),
      import('../assets/game/big_blind.png'),
      import('../assets/game/gglab_green.png'),
      import('../assets/game/player1.png'),
      import('../assets/game/player2.png'),
      import('../assets/game/player3.png'),
      import('../assets/game/player4.png'),
      import('../assets/game/player5.png'),
      import('../assets/game/player6.png'),
    ]);
    // Preload all imported images
    await Promise.all(mods.map(m => preloadImage(m.default)));
    console.log('[Preload] UI assets loaded via dynamic import');
  } catch (e) {
    console.warn('[Preload] Failed to load some UI assets:', e.message);
  }
};

/**
 * Lazy load card SVGs using dynamic import (only when user is likely to enter game)
 */
const lazyLoadCards = async () => {
  try {
    const cardModules = await CARD_IMPORTS();
    await Promise.all(cardModules.map(m => preloadImage(m.default)));
    console.log('[Preload] All 52 card SVGs loaded');
  } catch (e) {
    console.warn('[Preload] Failed to load some card assets:', e.message);
  }
};

/**
 * Main preload function - call from Landing page
 * Uses requestIdleCallback for non-blocking loading
 * Optimized: only loads 2 critical images upfront, rest is lazy
 */
export const preloadGameAssets = () => {
  console.log('[Preload] Starting game asset preloading (optimized)...');
  const startTime = performance.now();
  
  // Phase 0: Only 2 critical images - background + table (the biggest blockers)
  // These are already imported at module level so they're in the bundle
  preloadBatch(CRITICAL_ASSETS, 2, 0).then(() => {
    console.log(`[Preload] Critical assets loaded (${(performance.now() - startTime).toFixed(0)}ms)`);
  });
  
  // Phase 1: Card back + avatar (needed right after game renders)
  const runPhase1 = () => {
    preloadBatch(HIGH_PRIORITY_ASSETS, 2, 0).then(() => {
      console.log(`[Preload] High-priority assets loaded (${(performance.now() - startTime).toFixed(0)}ms)`);
    });
  };
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(runPhase1, { timeout: 1000 });
  } else {
    setTimeout(runPhase1, 800);
  }
  
  // Phase 2: UI elements (dealer, chips, avatars) - dynamic import, not in initial bundle
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => lazyLoadUIAssets(), { timeout: 3000 });
  } else {
    setTimeout(lazyLoadUIAssets, 2500);
  }
  
  // Phase 3: Card SVGs - only load if user stays on page for a while
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => lazyLoadCards(), { timeout: 8000 });
  } else {
    setTimeout(lazyLoadCards, 6000);
  }
};

/**
 * Quick emergency preload for when user clicks "Enter Game"
 * Only preloads the most critical remaining assets
 */
export const emergencyPreload = async () => {
  // Ensure all critical and high-priority are ready
  await Promise.all([
    ...CRITICAL_ASSETS.map(preloadImage),
    ...HIGH_PRIORITY_ASSETS.map(preloadImage),
  ]);
  // Also start UI assets loading immediately
  lazyLoadUIAssets();
};

export default {
  preloadGameAssets,
  emergencyPreload,
};
