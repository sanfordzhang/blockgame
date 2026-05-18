# 0G Poker - AI-Powered Decentralized Texas Hold'em

Repository: https://github.com/sanfordzhang/blockgame

> For hackathon submission: make sure this repository is public, or explicitly grant repository access to the judges before submitting the link.

## Live Demo For Hackathon Judges

Verified live on May 18, 2026.

| Environment | URL | Purpose |
| --- | --- | --- |
| Mainnet | http://43.163.114.175:3000/ | Separate production/mainnet deployment for independent smoke testing. |
| Testnet | http://43.163.114.175:3001/ | Recommended judging entry for the full wallet, deposit, delegate auth, join/leave table, and 0G-integrated gameplay flow. |

Quick backend checks:

- Mainnet config: http://43.163.114.175:3000/api/blockchain/config
- Testnet config: http://43.163.114.175:3001/api/blockchain/config

Contract explorer URLs:

| Environment | Network | Contract | Address | Explorer |
| --- | --- | --- | --- | --- |
| Mainnet | 0G Mainnet | `PokerGame0G` | `0x4A39B124A0660BBbE403B02D5B37C9878B0BC8bc` | https://chainscan.0g.ai/address/0x4A39B124A0660BBbE403B02D5B37C9878B0BC8bc |
| Mainnet | 0G Mainnet | `PokerHandINFT` | `0xc6F5495D411405630dF5d5ad32225d7F51dC1645` | https://chainscan.0g.ai/address/0xc6F5495D411405630dF5d5ad32225d7F51dC1645 |
| Mainnet | TRON Mainnet compatibility | `BridgeGame` | `THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd` | https://tronscan.org/#/contract/THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd |
| Mainnet | TRON Mainnet compatibility | `AchievementNFT` | `TZ44KG9TPtWzFWKHy4SJxHFmzwbgTZU9fc` | https://tronscan.org/#/contract/TZ44KG9TPtWzFWKHy4SJxHFmzwbgTZU9fc |
| Testnet | 0G Galileo | `PokerGame0G` | `0xc4975D55aD2607B14616E97B9a8E5622778eF5aE` | https://chainscan-galileo.0g.ai/address/0xc4975D55aD2607B14616E97B9a8E5622778eF5aE |
| Testnet | 0G Galileo | `PokerHandINFT` | `0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5` | https://chainscan-galileo.0g.ai/address/0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5 |
| Testnet | TRON Nile | `BridgeGame` | `TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c` | https://nile.tronscan.org/#/contract/TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c |
| Testnet | TRON Nile | `AchievementNFT` | `TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC` | https://nile.tronscan.org/#/contract/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC |
| Testnet | TRON Nile | `CHIPToken` | `TFWScXGFALnK9D79zf5Jrnw5on7aqJiaY3` | https://nile.tronscan.org/#/contract/TFWScXGFALnK9D79zf5Jrnw5on7aqJiaY3 |
| Testnet | TRON Nile | `Staking` | `TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc` | https://nile.tronscan.org/#/contract/TBz2FDnQtfAqUfjeZhcTTKhuC15SHqXmdc |

Notes for judges:

- Mainnet and testnet are deployed separately and can be tested independently.
- If you want to verify the full hackathon flow end to end without using real funds, start with the testnet deployment.
- The public testnet deployment is the recommended environment for validating the 0G judging flow.
- The landing page defaults to the 0G / EVM wallet flow for judging. TRON integration remains in the codebase but `Connect TRON` is hidden unless the frontend is built with `REACT_APP_SHOW_TRON_CONNECT=true`.
- Rare or special poker hands are naturally low-probability on mainnet, so they should not be treated as a reliable mainnet smoke-test step.
- For special-hand, achievement, or NFT/INFT-related verification, use the testnet deployment, where the UI exposes `Simulate Special Hand` / `模拟特殊牌型` for easier validation.

## Project Overview

0G Poker is a full-stack Web3 Texas Hold'em application for real-time cash games and tournament mode. The current hackathon build focuses on 0G Galileo Testnet cash-game custody, delegated gameplay authorization, table balance locking, leave-table settlement, and achievement INFT flows. For judging, the project now exposes separate live mainnet and testnet deployments so each environment can be tested independently.

Key features:

- Real-time multiplayer Texas Hold'em with Socket.IO.
- Normal cash games and tournament game mode.
- 0G Galileo Testnet smart contracts for custody, game-balance locking, delegated table joins/leaves, settlement, and withdrawals.
- MetaMask based 0G wallet flow with automatic 0G network switching.
- Server-side delegated gameplay actions so players do not need to sign every in-game move.
- AI poker engine integration for bot/opponent behavior.
- Commit/reveal fairness records and state hashes.
- Poker achievement INFT contract for collectible hand results.
- REST endpoints for 0G status, custody balance, fairness proofs, storage, and INFT data.

## Architecture

```text
Browser / React app
  - Landing, Play, wallet, tournament, INFT, fairness views
  - MetaMask 0G wallet integration
  - Socket.IO client and REST API client
        |
        | Socket.IO + HTTP REST
        v
Node.js / Express game server
  - Poker table and game-flow services
  - Normal cash-game and tournament services
  - Balance cache and disconnect cleanup
  - AI engine bridge
  - Fairness/state-hash services
  - 0G blockchain service layer
        |
        | ethers v6, JSON-RPC, contract calls, event polling
        v
0G Galileo Testnet
  - PokerGame0G: custody, deposit, withdraw, delegate auth, table locks, settlement
  - PokerHandINFT: poker hand achievement INFTs
  - 0G DA/Storage adapters for fairness and metadata boundaries

MongoDB
  - Player/session/game data and service state
```

## 0G Component Usage

### 0G EVM / Galileo Testnet

The primary live 0G integration is 0G EVM on Galileo Testnet. The backend uses `ethers` v6 through `server/blockchain/ZeroGService.js` and `server/blockchain/ZeroGContractService.js` to call deployed Solidity contracts on 0G.

This solves the core Web3 game problem: poker funds are not only held in an off-chain database. Players deposit testnet 0G into a custody contract, authorize the game server as a delegate, and the server can lock/unlock table buy-ins and settle game results through contract calls.

Used 0G APIs/services:

- 0G Galileo JSON-RPC: `https://evmrpc-galileo.0g.ai`
- Chain ID: `16602`
- Block explorer: `https://chainscan-galileo.0g.ai`
- Wallet integration: MetaMask EVM provider with 0G Galileo network configuration.
- Contract integration: Solidity contracts deployed to 0G Galileo and called with `ethers` v6.

### Deployed 0G Contracts

| Environment | Network | Contract | Address | Explorer |
| --- | --- | --- | --- | --- |
| Mainnet | 0G Mainnet | `PokerGame0G` | `0x4A39B124A0660BBbE403B02D5B37C9878B0BC8bc` | https://chainscan.0g.ai/address/0x4A39B124A0660BBbE403B02D5B37C9878B0BC8bc |
| Mainnet | 0G Mainnet | `PokerHandINFT` | `0xc6F5495D411405630dF5d5ad32225d7F51dC1645` | https://chainscan.0g.ai/address/0xc6F5495D411405630dF5d5ad32225d7F51dC1645 |
| Testnet | 0G Galileo Testnet | `PokerGame0G` | `0xc4975D55aD2607B14616E97B9a8E5622778eF5aE` | https://chainscan-galileo.0g.ai/address/0xc4975D55aD2607B14616E97B9a8E5622778eF5aE |
| Testnet | 0G Galileo Testnet | `PokerHandINFT` | `0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5` | https://chainscan-galileo.0g.ai/address/0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5 |

### Contract Responsibilities

`contracts/0g/PokerGame0G.sol`

- Accepts 0G deposits into per-player custody balances.
- Allows players to withdraw available custody balance.
- Supports delegate authorization so the game server can perform table operations for the player.
- Locks buy-ins when a player joins a table.
- Releases or settles locked funds when a player leaves a table or when a game/tournament is settled.
- Exposes custody and locked balance reads used by the frontend and backend.

`contracts/0g/PokerHandINFT.sol`

- ERC721-based poker achievement INFT.
- Stores poker hand achievement metadata URI references.
- Supports encrypted metadata transfer, clone, and AI-agent binding interfaces.

### 0G Storage and DA

This repository includes service boundaries for 0G Storage and 0G DA:

- `server/services/ZeroGStorageService.js`
- `server/services/ZeroGDAService.js`

These adapters are used by the app architecture for INFT metadata and verifiable fairness/state-hash records. For local judging they are intentionally fault-tolerant and can run in mock/degraded mode if real 0G Storage or DA endpoints are not configured. The live end-to-end 0G path used by the cash-game flow is the 0G EVM contract integration above.

## Local Deployment

### Prerequisites

- Node.js 18 or 20.
- npm.
- MongoDB running locally.
- MetaMask browser extension.
- 0G Galileo testnet tokens for the wallet used during testing.

### 1. Clone and Install

```bash
git clone https://github.com/sanfordzhang/blockgame.git
cd blockgame
npm install
```

### 2. Configure Environment

Create `.env.0g` in the project root. Do not commit private keys.

```bash
ENV_FILE=.env.0g

SERVER_PORT=7778
PORT=7778
MONGODB_URI=mongodb://127.0.0.1:27017/bridge-poker
JWT_SECRET=replace_with_a_local_secret

BLOCKCHAIN_ENABLED=true
ZEROG_ENABLED=true
BLOCKCHAIN_MODE=0g
ZEROG_NETWORK=testnet
ZEROG_RPC_URL=https://evmrpc-galileo.0g.ai
ZEROG_PRIVATE_KEY=0xYOUR_SERVER_OR_OPERATOR_PRIVATE_KEY

ZEROG_POKERGAME_ADDRESS=0xc4975D55aD2607B14616E97B9a8E5622778eF5aE
ZEROG_INFT_ADDRESS=0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5
REACT_APP_ZEROG_POKERGAME_ADDRESS=0xc4975D55aD2607B14616E97B9a8E5622778eF5aE
REACT_APP_ZEROG_INFT_ADDRESS=0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5
REACT_APP_SERVER_PORT=7778
```

Notes:

- `ZEROG_PRIVATE_KEY` is the backend/operator wallet. It needs enough 0G for gas when calling delegated table operations.
- Player wallets are connected in the browser through MetaMask. Do not place player private keys in `.env.0g`.
- If you redeploy contracts, update both backend and `REACT_APP_*` contract address variables.

### 3. Start MongoDB

Use whichever MongoDB install method is available on your system.

macOS Homebrew example:

```bash
brew services start mongodb-community
```

Manual example:

```bash
mongod --dbpath ./data/db
```

### 4. Start Backend

```bash
ENV_FILE=.env.0g node server/server.js
```

The backend listens on `http://127.0.0.1:7778`.

Useful health checks:

```bash
curl http://127.0.0.1:7778/api/0g/status
curl http://127.0.0.1:7778/api/0g/balance/0xYOUR_WALLET_ADDRESS
```

### 5. Start Frontend

In a second terminal:

```bash
PORT=3001 BROWSER=none REACT_APP_SERVER_PORT=7778 npm run start:client
```

Open:

```text
http://127.0.0.1:3001
```

### 6. Configure MetaMask for 0G Galileo

The app can request this network automatically. If adding it manually:

| Field | Value |
| --- | --- |
| Network name | `0G Galileo Testnet` |
| RPC URL | `https://evmrpc-galileo.0g.ai` |
| Chain ID | `16602` |
| Currency symbol | `0G` |
| Explorer | `https://chainscan-galileo.0g.ai` |

## Judge Test Flow

### AI Autopilot & Special Hand Testing Guide

> **Important: AI Autopilot mode is only available in normal cash-game mode and is intentionally disabled in tournament mode to ensure competitive fairness.**

| Mode | AI Autopilot | Simulate Special Hand | Purpose |
|------|-------------|---------------------|---------|
| **Normal Cash Game** (普通游戏) | ✅ Enabled - use to test AI poker engine behavior | ❌ Not available | Test AI decision-making, fold/call/raise logic, bot vs player interaction |
| **Tournament** (锦标赛) | ❌ Disabled - prevents unfair AI advantage | ✅ Enabled via `模拟特殊牌型` switch | Test rare hand types (straight, flush, etc.) and achievement INFT minting flow |

**How to test AI features:**

1. Enter **normal cash-game mode** (`/play` page).
2. Look for the **AI Autopilot toggle** on the game table UI.
3. Enable it to let the AI engine play automatically for the connected player.
4. Observe AI decisions (fold, check, call, raise) in real-time through Socket.IO events.
5. Use browser DevTools Console or backend logs (`server/services/AIService.js`) to trace AI reasoning.

**How to test special/rare hands:**

1. Enter **tournament mode** (`/tournament` page).
2. Join or create a tournament table.
3. Enable `Simulate Special Hand` / `模拟特殊牌型` from the tournament UI.
4. In simulation mode, Player 1 receives a pre-determined strong hand (e.g., straight) to trigger:
   - Rare hand win detection
   - Achievement INFT minting (`PokerHandINFT`)
   - NFT metadata generation with 0G Storage
   - Fairness state-hash verification for that hand
5. This bypasses natural probability so judges can verify special-hand flows without waiting for random deals.

### Mainnet smoke test

1. Open `http://43.163.114.175:3000/`.
2. Confirm the production site loads normally.
3. Optionally open `http://43.163.114.175:3000/api/blockchain/config` and confirm the backend is serving the mainnet environment.

### Recommended full judging flow on public testnet

1. Open `http://43.163.114.175:3001/`.
2. Connect MetaMask on 0G Galileo Testnet.
3. Use the faucet to fund the connected wallet with testnet 0G.
4. In the app, authorize the backend delegate when prompted.
5. Deposit a small amount, for example `0.1` 0G, into Game Balance.
6. Enter normal cash-game mode.
7. Join a table and start a hand.
8. Leave the table and confirm that locked table funds are returned or settled into Game Balance.
9. Start a second normal game to verify rejoin and delegate authorization still work.

For special-hand testing:

- The mainnet deployment uses normal gameplay probability, so rare hands may take a long time to appear.
- On the public testnet deployment, go to the tournament flow and enable `Simulate Special Hand` / `模拟特殊牌型`.
- In that mode, Player 1 receives a straight hand, which is useful for judging the special-hand and achievement-triggered flow without waiting on mainnet randomness.

If you are running locally instead of using the public deployment, use `http://127.0.0.1:3000` for mainnet and `http://127.0.0.1:3001` for testnet.

For two-player testing, use two browser profiles or two browsers with different MetaMask accounts. Both accounts need faucet 0G and both must deposit into Game Balance before joining the same table.

## Dual-Network Deployment And Restart

Full dual-network deployment uses:

```bash
SERVER_HOST=<server-ip-or-domain> SSH_PASS=your_ssh_password deploy/deploy-dual.sh
```

`SERVER_HOST` is intentionally passed at runtime so the shared deployment script can be reused across multiple servers. Do not put one machine's IP address into shared env files. The generated PM2 runtime config derives CORS and NFT public URLs from `SERVER_HOST` / `PUBLIC_HOST`, while `CORS_ORIGINS`, `NFT_PUBLIC_BASE_URL`, and `PUBLIC_API_BASE_URL` can remain empty in the shared config.

Dual-network restart uses:

```bash
scripts/restart-dual.sh
```

On a deployed server, the script detects `ecosystem.config.js` and PM2, restarts `mainnet-server` and `testnet-server`, then reloads nginx. Locally, when no PM2 ecosystem exists, it starts mainnet backend `7777`, testnet backend `7778`, mainnet frontend `3000`, and testnet frontend `3001`. To force local mode:

```bash
DUAL_RESTART_MODE=local scripts/restart-dual.sh
```

## Testnet Faucet Instructions

Judges should use their own MetaMask accounts. This repository does not publish private test account keys.

0G Galileo faucet options:

- Official faucet: https://faucet.0g.ai
- Google Cloud Web3 faucet: https://cloud.google.com/application/web3/faucet/ethereum/0g-galileo-testnet

After receiving faucet tokens, wait a few seconds and refresh the wallet balance in MetaMask or the app. The app uses 0G testnet tokens for:

- Player deposits into `PokerGame0G`.
- Player MetaMask transactions such as deposit, withdraw, and delegate authorization.
- Backend/operator gas when the server performs delegated joins, leaves, and settlements.

## Smart Contract Deployment

Compile contracts:

```bash
npx hardhat compile
```

Deploy to 0G Galileo Testnet:

```bash
ENV_FILE=.env.0g npx hardhat run deploy/deploy-0g.js --network zerogTestnet
```

After deployment, update `.env.0g` with the printed `ZEROG_POKERGAME_ADDRESS`, `ZEROG_INFT_ADDRESS`, `REACT_APP_ZEROG_POKERGAME_ADDRESS`, and `REACT_APP_ZEROG_INFT_ADDRESS` values, then restart both backend and frontend.

## Automated Tests

Focused tests used for the 0G cash-game flow:

```bash
npx mocha tests/services/normal-game-flow.test.js --timeout 30000
ENV_FILE=.env.0g npx mocha tests/e2e/zerog-normal-cash-game.test.js --timeout 240000
npx hardhat test tests/contracts/PokerGame0G.cash.test.js
ENV_FILE=.env.0g npx mocha tests/0g/contractservice.test.js tests/0g/zeroservice.test.js tests/0g/e2e-full-flow.test.js --timeout 60000
```

General project test scripts:

```bash
npm run test:contracts
npm run test:services
npm run test:api
npm run test:integration
npm run test:e2e
```

## Project Structure

```text
contracts/0g/
  PokerGame0G.sol          0G custody and game settlement contract
  PokerHandINFT.sol        Poker achievement INFT contract

server/blockchain/
  ZeroGService.js          0G RPC provider and wallet setup
  ZeroGContractService.js  Contract call wrapper
  ZeroGEventListener.js    0G contract event polling

server/services/
  GameFlowIntegration.js   Cash-game balance locking and cleanup integration
  ZeroGStorageService.js   0G Storage adapter
  ZeroGDAService.js        0G DA adapter

server/routes/api/
  0g.js                    0G status, balance, fairness, storage, and INFT routes

src/
  React frontend, wallet flow, game screens, and 0G browser utilities

src/utils/zeroGInteract.js
  MetaMask 0G network, balance, contract deposit/withdraw/delegate helpers
```

## Troubleshooting

- If MetaMask cannot start a game, confirm the player has both wallet 0G and deposited Game Balance.
- If joining a table fails with insufficient Game Balance, check `GET /api/0g/balance/<wallet>` and confirm the backend is using the same deployed `PokerGame0G` address as the frontend.
- If delegated joins/leaves fail, re-run delegate authorization in the app and make sure the backend/operator wallet has 0G for gas.
- If a browser is closed during a game, restart the app and query the balance endpoint to confirm locked funds are cleaned up or settled.
- AMM warnings in the console are not required for the normal 0G poker cash-game flow unless AMM contract addresses are configured.

## License

This hackathon prototype is currently marked `UNLICENSED` in `package.json`. Add a production/open-source license file before publishing it as a reusable open-source package.
