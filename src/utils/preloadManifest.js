/**
 * Preload Manifest — Game Asset URLs
 *
 * This file is ONLY imported dynamically via import() in gamePreload.js.
 * It gets compiled into its own separate webpack chunk, so it does NOT bloat
 * the initial JS bundle. The chunk is loaded on-demand when preloading starts.
 *
 * All images are statically imported here so webpack can properly hash and
 * emit them to /static/media/*.hash.ext at build time.
 */

// Background (used by Play.js & TournamentTable.js)
import backgroundImage from '../assets/img/background.png';

// Table
import tableImage from '../assets/game/table.webp';

// Dealer & blind buttons
import dealerImage from '../assets/game/dealer.png';
import smallBlindImage from '../assets/game/small_blind.png';
import bigBlindImage from '../assets/game/big_blind.png';

// Cards
import cardBackImage from '../assets/game/card_back.png';

// Branding / avatar UI
import avatarImage from '../assets/game/avatar.png';
import circleImage from '../assets/game/circle.png';
import brandingImage from '../assets/game/branding_outline.png';
import chipGreenImage from '../assets/game/gglab_green.png';

// Player avatars (6 seats) — these are referenced by PokerTable.js
// Note: player1~6.png exist in src/assets/game/
import player1Image from '../assets/game/player1.png';
import player2Image from '../assets/game/player2.png';
import player3Image from '../assets/game/player3.png';
import player4Image from '../assets/game/player4.png';
import player5Image from '../assets/game/player5.png';
import player6Image from '../assets/game/player6.png';

/** Export all URLs as a plain object for easy iteration */
export const GAME_ASSETS = [
  backgroundImage,
  tableImage,
  dealerImage,
  smallBlindImage,
  bigBlindImage,
  cardBackImage,
  avatarImage,
  circleImage,
  brandingImage,
  chipGreenImage,
  player1Image,
  player2Image,
  player3Image,
  player4Image,
  player5Image,
  player6Image,
];

export default GAME_ASSETS;
