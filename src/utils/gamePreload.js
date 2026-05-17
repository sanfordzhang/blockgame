/**
 * Game Resource Preloader — Delayed Image Prefetch (v3)
 *
 * Strategy: Dynamically import a preloadManifest chunk that contains all
 * statically-resolved image URLs. The manifest is a separate webpack chunk
 * that's NOT in the initial bundle — it loads only when preloading starts.
 *
 * After the manifest chunk resolves, use new Image().src for each URL
 * to warm the browser cache without blocking rendering.
 */

/**
 * Preload game route bundles so React.lazy() has them cached before navigation.
 */
export const preloadGameBundles = () => {
  console.log('[Preload] Starting game bundle preload...');
  return Promise.allSettled([
    import('../pages/Play'),
    import('../pages/TournamentTable'),
    import('../pages/TournamentWaitingRoom'),
  ]).then((results) => {
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) {
      console.warn(`[Preload] Game bundle preload completed with ${failed.length} failures`);
    } else {
      console.log('[Preload] Game bundles ready');
    }
  });
};

/**
 * Prefetch all game images into browser cache.
 * - Does NOT block: returns Promise.resolve() immediately
 * - Manifest chunk loads lazily (separate JS file, ~2KB)
 * - Images download at idle priority via new Image().src
 */
export const preloadGameAssets = () => {
  const t0 = performance.now();
  console.log('[Preload] Starting image preloading...');
  preloadGameBundles();

  // Dynamic import → webpack creates a separate chunk for this.
  // The chunk contains all image URLs resolved by webpack at build time.
  import('./preloadManifest').then(({ GAME_ASSETS }) => {
    let loaded = 0;
    let failed = 0;
    const assets = Array.from(new Set(
      GAME_ASSETS.filter((url) => url && typeof url === 'string')
    ));
    const total = assets.length;

    console.log(`[Preload] Manifest loaded: ${total} images to prefetch`);

    assets.forEach((url) => {
      const img = new window.Image();
      img.onload = () => {
        loaded++;
        if (loaded + failed === total) {
          const ms = Math.round(performance.now() - t0);
          console.log(`[Preload] Complete: ${loaded}/${total} images (${failed} failed) in ${ms}ms`);
        }
      };
      img.onerror = () => {
        failed++;
        if (loaded + failed === total) {
          const ms = Math.round(performance.now() - t0);
          console.log(`[Preload] Complete: ${loaded}/${total} images (${failed} failed) in ${ms}ms`);
        }
      };
      img.src = url;
    });

  }).catch((err) => {
    console.error('[Preload] Failed to load manifest:', err);
  });

  // Return immediately — never block caller
  return Promise.resolve();
};

/**
 * Emergency preload — called right before navigate('/play').
 * Eagerly loads Play page bundle so React.lazy() resolves instantly.
 */
export const emergencyPreload = async () => {
  console.log('[Preload] Emergency: eager-loading Play bundle...');
  try {
    await Promise.allSettled([
      import('../pages/Play'),
      import('./preloadManifest'),
    ]);
    console.log('[Preload] Emergency: Play bundle ready');
  } catch (e) {
    console.warn('[Preload] Emergency preload failed:', e);
  }
};
