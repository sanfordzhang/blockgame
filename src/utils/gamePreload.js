/**
 * Game Resource Preloader
 * Preloads game assets while user is on the landing page
 * to eliminate loading delays when entering the game.
 *
 * IMPORTANT: All assets use dynamic import() - nothing is statically imported
 * to avoid blocking the Landing page's first paint or initial JS bundle size.
 *
 * Strategy (all non-blocking via requestIdleCallback):
 * - Phase 0+1: background + table + cardBack + avatar (critical for game)
 * - Phase 2: UI elements (dealer, chips, players) - loaded during idle
 * - Phase 3: 52 card SVGs - only if user stays on page long enough
 */

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
 * Phase 0+1: Load critical game assets via dynamic import
 * Only runs when browser is idle — never blocks main thread
 */
const loadCriticalAssets = async () => {
  try {
    const [bgMod, tableMod, cardBackMod, avatarMod] = await Promise.all([
      import('../assets/img/background.png'),
      import('../assets/game/table.webp'),
      import('../assets/game/card_back.png'),
      import('../assets/game/avatar.png'),
    ]);
    await Promise.all([
      preloadImage(bgMod.default),
      preloadImage(tableMod.default),
      preloadImage(cardBackMod.default),
      preloadImage(avatarMod.default),
    ]);
    console.log('[Preload] Critical assets loaded (background, table, cardBack, avatar)');
  } catch (e) {
    console.warn('[Preload] Failed to load critical assets:', e.message);
  }
};

/**
 * Phase 2: Lazy load UI assets (dealer, chips, player images) via dynamic import
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
    await Promise.all(mods.map(m => preloadImage(m.default)));
    console.log('[Preload] UI assets loaded (dealer, chips, players)');
  } catch (e) {
    console.warn('[Preload] Failed to load some UI assets:', e.message);
  }
};

/**
 * Phase 3: Lazy load 52 card SVGs
 */
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
  import('../assets/game/cards-svg/cQ.svg'), import('../assets/game/cards-svg/cK.svg'),
  import('../assets/game/cards-svg/hA.svg'), import('../assets/game/cards-svg/s2.svg'),
  import('../assets/game/cards-svg/s3.svg'), import('../assets/game/cards-svg/s4.svg'),
  import('../assets/game/cards-svg/s5.svg'), import('../assets/game/cards-svg/s6.svg'),
  import('../assets/game/cards-svg/s7.svg'), import('../assets/game/cards-svg/s8.svg'),
  import('../assets/game/cards-svg/s9.svg'), import('../assets/game/cards-svg/s10.svg'),
  import('../assets/game/cards-svg/sJ.svg'), import('../assets/game/cards-svg/cQ.svg'),
  import('../assets/game/cards-svg/cK.svg'), import('../assets/game/cards-svg/cA.svg'),
];

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
 * Schedule a task to run when browser is idle (or fallback to setTimeout)
 */
const scheduleIdle = (fn, timeoutMs) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: timeoutMs });
  } else {
    setTimeout(fn, Math.min(timeoutMs / 2, 100));
  }
};

/**
 * Main preload function - call from Landing page
 * Uses requestIdleCallback for fully non-blocking loading.
 * Zero impact on Landing page's first paint or bundle size.
 */
export const preloadGameAssets = () => {
  console.log('[Preload] Starting non-blocking game asset preloading...');

  // Phase 0+1: Critical assets (background, table, cardBack, avatar)
  scheduleIdle(loadCriticalAssets, 2000);

  // Phase 2: UI elements (dealer, chips, players) — larger set, longer delay
  scheduleIdle(lazyLoadUIAssets, 5000);

  // Phase 3: Card SVGs — only if user stays on page long enough
  scheduleIdle(lazyLoadCards, 10000);
};

/**
 * Quick emergency preload for when user clicks "Enter Game"
 */
export const emergencyPreload = async () => {
  // Fire-and-forget all phases concurrently
  loadCriticalAssets();
  lazyLoadUIAssets();
};
