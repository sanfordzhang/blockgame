# 🃏 0G Poker — AI-Powered Decentralized Texas Hold'em

> Built on **[0G (ZeroGravity)](https://0g.ai)** — The Blockchain for AI Agents

## 🎯 Overview

A full-stack Web3 poker game featuring:
- **🎮 Multiplayer Online Texas Hold'em** — Real-time gameplay via Socket.io
- **🤖 AI Poker Agent** — CFR-based decision engine with persistent memory
- **🔗 Dual-Chain Architecture** — TRON + 0G EVM multi-chain support
- **🖼️ ERC-7857 INFTs** — Interactive NFT achievements with encrypted transfer, clone & AI agent binding
- **🛡️ Verifiable Fairness** — Commit-reveal shuffle seeds with DA anchoring to 0G chain
- **💰 Smart Contract Settlement** — On-chain custody, deposit, withdraw & game settlement
- **📦 0G Storage Integration** — NFT metadata/images permanently stored on decentralized storage

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  Landing │ Play │ Wallet │ NFT Gallery │ Fairness Verify │
│  ┌──────────┐ ┌─────────┐ ┌──────┐ ┌──────────┐        │
│  │ TRON     │ │ 0G/EVM  │ │ AI   │ │ INFT      │        │
│  │ TronLink │ │ MetaMask│ │Agent │ │ERC-7857   │        │
│  └──────────┘ └─────────┘ └──────┘ └──────────┘        │
└────────────────────┬────────────────────────────────────┘
                     │ Socket.io + REST API
┌────────────────────▼────────────────────────────────────┐
│                   Backend (Express)                       │
│  ┌───────────┐ ┌──────────┐ ┌─────────────────────┐    │
│  │Game Engine│ │AI Service│ │Blockchain Services   │    │
│  │Table/Deck │ │←Python → │ │TronService|ZeroGSvc │    │
│  │Tournament │ │CFR Engine│ │ContractSrv|Settlement│    │
│  └───────────┘ └──────────┘ └─────────────────────┘    │
│  ┌───────────┐ ┌──────────┐ ┌─────────────────────┐    │
│  │NFT Minting│ │Fairness  │ │Storage / DA          │    │
│  │INFT+TRON  │ │Commit-Rev│ │0G Stor | 0G DA       │    │
│  └───────────┘ └──────────┘ └─────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ TRON     │ │ 0G EVM   │ │ MongoDB  │
   │ Nile/Test│ │Galileo   │ │ Players  │
   └──────────┘ └──────────┘ └──────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- MongoDB (brew install mongodb-community)
- MetaMask browser extension (for 0G mode)

### 1. Install & Configure

```bash
git clone <repo-url>
cd game-core
npm install
```

### 2. Environment Setup

```bash
cp .env.0g .env.0g.local  # Edit with your private key
```

Key `.env.0g` variables:
| Variable | Description |
|---|---|
| `ZEROG_RPC_URL` | 0G RPC endpoint (`https://evmrpc-galileo.0g.ai`) |
| `ZEROG_PRIVATE_KEY` | Deployer wallet private key |
| `ZEROG_POKERGAME_ADDRESS` | PokerGame0G contract address |
| `ZEROG_INFT_ADDRESS` | PokerHandINFT contract address |
| `BLOCKCHAIN_MODE` | `'tron'` \| `'zerog'` \| `'both'` |

### 3. Start Services

```bash
# Start MongoDB
brew services start mongodb-community

# Start Backend (port 7778)
ENV_FILE=.env.0g node server/server.js

# Start Frontend (port 3001)
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client
```

### 4. Play!

1. Open http://127.0.0.1:3001
2. Click **"Connect 0G Wallet"** (MetaMask will prompt to add 0G network)
3. Join a table and play!

## 🔧 Development Commands

```bash
# Compile smart contracts
npx hardhat compile

# Deploy to 0G testnet
ENV_FILE=.env.0g npx hardhat run deploy-0g.js --network zerogTestnet

# Run tests
npm test                          # All tests
npm run test:contracts            # Contract unit tests
npm run test:services             # Service layer tests
mocha tests/0g/e2e-full-flow.test.js --timeout 60000  # 0G E2E

# Build for production
npm run build

# Verify fairness offline
node scripts/verify-fairness.js <handId>
```

## 📁 Project Structure

```
game-core/
├── contracts/0g/           # 0G Solidity contracts
│   ├── PokerGame0G.sol     # Game main contract (deposit/settle/delegate)
│   └── PokerHandINFT.sol   # ERC-7857 Interactive NFT
├── server/
│   ├── blockchain/         # Multi-chain service layer
│   │   ├── ZeroGService.js       # 0G EVM adapter (ethers v6)
│   │   ├── ZeroGContractService.js  # Contract interaction
│   │   ├── ZeroGEventListener.js   # Event monitoring
│   │   └── blockchainFactory.js    # Factory by BLOCKCHAIN_MODE
│   ├── services/
│   │   ├── ZeroGStorageService.js # 0G decentralized storage
│   │   ├── ZeroGDAService.js      # Data Availability layer
│   │   ├── AIService.js           # AI engine communication
│   │   ├── AIMemoryService.js     # AI opponent profiling
│   │   └── SettlementRouter.js    # Dual-chain routing
│   └── routes/api/0g.js     # 0G API endpoints
├── src/
│   ├── context/zero-g/      # 0G wallet context
│   ├── pages/
│   │   ├── FairnessVerify.js     # Fairness verification UI
│   │   ├── CHIPWallet.js         # Multi-chain wallet (TRON|0G tabs)
│   │   └── NFTGallery.js         # NFT gallery (TRON NFT|INFT)
│   └── utils/zeroGInteract.js    # MetaMask interaction utils
├── ai_engine/               # Python CFR-based AI decision engine
├── tests/0g/                # 0G-specific test suite
└── scripts/verify-fairness.js  # Offline fairness verifier
```

## ⛓️ Smart Contracts (Deployed on 0G Galileo Testnet)

| Contract | Address | Features |
|---|---|---|
| **PokerGame0G** | [`0xc6F5...1645`](https://chainscan-galileo.0g.ai/address/0xc6F5495D411405630dF5d5ad32225d7F51dC1645) | Deposit/Withdraw/Settle/Delegate |
| **PokerHandINFT** | [`0xC963...ccC3`](https://chainscan-galileo.0g.ai/address/0xC96368bbE503a13BCDBE0d38E06c167486d9ccC3) | ERC-7857 mint/clone/bindAgent |

**Chain ID**: 16602 (Galileo Testnet)
**Explorer**: https://chainscan-galileo.0g.ai

## ✨ Key Features Detail

### 🤖 AI Poker Agent
- **CFR (Counterfactual Regret Minimization)** based decision engine in Python
- Persistent opponent profiles stored in MongoDB (`AIMemoryService`)
- Auto-fills empty seats at tables (`AITableManager`)
- Configurable difficulty: easy / medium / hard

### 🖼️ ERC-7857 Interactive NFTs
- **Mint**: Awarded for poker hand achievements (Royal Flush → Common Straight)
- **Encrypted Transfer**: Secure metadata transfer between wallets
- **Clone**: Copy INFT structure (Legendary excluded)
- **AI Agent Binding**: Attach AI agent for autonomous gameplay assistance
- Monthly rarity limits prevent inflation

### 🛡️ Verifiable Fairness
- **Commit-Reveal Shuffle**: Seed committed before deal, revealed after settlement
- **DA Anchoring**: Hash pinned to 0G Data Availability layer
- **On-chain StateHash**: Each hand's state verifiable via `getHandStateHash(handId)`
- **Offline Verification**: `node scripts/verify-fairness.js <handId>` — no trusted party needed

### 💰 Dual-Chain Settlement
- TRON mode: Original TronLink + TRON contracts
- 0G mode: MetaMask + 0G EVM contracts
- Both mode: Parallel settlement with unified router (`SettlementRouter.js`)

## 🧪 Testing

```bash
# Unit tests
npm test

# 0G specific tests
mocha tests/0g/zeroservice.test.js --timeout 10000
mocha tests/0g/inft-flow.test.js --timeout 30000
mocha tests/0g/fairness.test.js --timeout 10000
mocha tests/0g/ai-agent.test.js --timeout 10000
mocha tests/0g/e2e-full-flow.test.js --timeout 60000

# Contract compilation check
npx hardhat compile
```

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 16, React Router 6, styled-components, Bootstrap 5 |
| Backend | Express, Socket.io 4, Mongoose |
| Blockchain (TRON) | TronWeb v6, Solidity |
| Blockchain (0G) | ethers v6, Solidity ^0.8.20, Hardhat |
| AI Engine | Python 3, numpy, CFR algorithm |
| Storage | 0G Storage (decentralized) |
| Data Availability | 0G DA (commit-reveal anchor) |
| Testing | Mocha, Chai, Playwright, Hardhat |

## 📋 Demo Checklist

For hackathon demo, demonstrate this flow:

1. **Connect Wallet** → MetaMask connects, 0G network added automatically
2. **Join Game** → Enter a poker table, see cards dealt
3. **Play a Hand** → Fold / Check / Call / Raise actions
4. **AI Opponent** → Watch AI make decisions at the same table
5. **Win & NFT Mint** → Victory triggers INFT achievement mint
6. **View INFT Gallery** → See ERC-7857 NFT with storage root hash
7. **Verify Fairness** → Click shield icon → see on-chain proof

## 📄 License

MIT
