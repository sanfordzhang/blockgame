#!/usr/bin/env node
/**
 * Main CDP game-flow entry point.
 *
 * The active tournament E2E target is 0G, so delegate to the maintained 0G
 * browser + bot flow.
 */
require('./cdp-play-game-0g');
