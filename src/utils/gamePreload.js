/**
 * Game Resource Preloader — DISABLED
 * 
 * Previously used dynamic import() to preload game assets on the Landing page.
 * However, each import() caused webpack to create a separate .chunk.js (~50 files),
 * which added more overhead than it saved.
 *
 * Game assets are now loaded naturally via React.lazy() when the user
 * navigates to /play or /tournament/:id/play.
 *
 * This module is kept as a no-op stub so existing imports don't break.
 */

/** No-op: preloading disabled to avoid webpack chunk explosion */
export const preloadGameAssets = () => {
  console.log('[Preload] Skipped — assets load on-demand via lazy routes');
};

/** No-op */
export const emergencyPreload = async () => {
  // Lazy routes handle asset loading when navigating to game pages
};
