# 0G Poker - AI-Powered Decentralized Texas Hold'em

Repository: https://github.com/sanfordzhang/blockgame

> For hackathon submission: make sure this repository is public, or explicitly grant repository access to the judges before submitting the link.

## Project Overview

0G Poker is a full-stack Web3 Texas Hold'em application for real-time cash games and tournament mode. The current hackathon build focuses on 0G Galileo Testnet cash-game custody, delegated gameplay authorization, table balance locking, leave-table settlement, and achievement INFT flows.

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

| Contract | Address | Explorer |
| --- | --- | --- |
| `PokerGame0G` | `0xc4975D55aD2607B14616E97B9a8E5622778eF5aE` | https://chainscan-galileo.0g.ai/address/0xc4975D55aD2607B14616E97B9a8E5622778eF5aE |
| `PokerHandINFT` | `0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5` | https://chainscan-galileo.0g.ai/address/0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5 |

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

1. Open `http://127.0.0.1:3001`.
2. Connect MetaMask on 0G Galileo Testnet.
3. Use the faucet to fund the connected wallet with testnet 0G.
4. In the app, authorize the backend delegate when prompted.
5. Deposit a small amount, for example `0.1` 0G, into Game Balance.
6. Enter normal cash-game mode.
7. Join a table and start a hand.
8. Leave the table and confirm that locked table funds are returned or settled into Game Balance.
9. Start a second normal game to verify rejoin and delegate authorization still work.

For two-player testing, use two browser profiles or two browsers with different MetaMask accounts. Both accounts need faucet 0G and both must deposit into Game Balance before joining the same table.

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
