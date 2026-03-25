# Implementation Tasks: Tournament, NFT, CHIP Token, and DAO

## 1. Project Setup & Configuration

- [ ] 1.1 Install OpenZeppelin contracts dependency for TRON
- [ ] 1.2 Update tronbox.js configuration for new contracts
- [ ] 1.3 Create environment variables for contract addresses
- [ ] 1.4 Create database migration files for new tables

---

## 2. Tournament System - Smart Contracts

- [ ] 2.1 Create `contracts/Tournament.sol` with basic structure
- [ ] 2.2 Implement TournamentConfig and Tournament structs
- [ ] 2.3 Implement `createTournament()` function
- [ ] 2.4 Implement `joinTournament()` with payment handling
- [ ] 2.5 Implement `cancelJoin()` with refund logic
- [ ] 2.6 Implement `startTournament()` with rake calculation
- [ ] 2.7 Implement `cancelTournament()` for timeout scenario
- [ ] 2.8 Implement `finishTournament()` with prize distribution
- [ ] 2.9 Implement `claimPrize()` function
- [ ] 2.10 Implement view functions for tournament queries
- [ ] 2.11 Add default tournament configurations in constructor
- [ ] 2.12 Write unit tests for Tournament.sol

---

## 3. NFT Achievement System - Smart Contracts

- [ ] 3.1 Create `contracts/AchievementNFT.sol` extending TRC721
- [ ] 3.2 Implement AchievementInfo struct and enums
- [ ] 3.3 Implement `claimNFT()` with signature verification
- [ ] 3.4 Implement monthly limit mechanism with `_getYearMonth()`
- [ ] 3.5 Implement signature recovery functions
- [ ] 3.6 Add default achievement types in constructor
- [ ] 3.7 Implement `tokenURI()` for metadata
- [ ] 3.8 Write unit tests for AchievementNFT.sol

---

## 4. CHIP Token - Smart Contracts

- [ ] 4.1 Create `contracts/ChipToken.sol` extending TRC20
- [ ] 4.2 Implement transfer/approve/transferFrom with pause check
- [ ] 4.3 Implement `mint()` with minter whitelist
- [ ] 4.4 Implement `burn()` and `burnFrom()` functions
- [ ] 4.5 Implement minter management functions
- [ ] 4.6 Write unit tests for ChipToken.sol

---

## 5. Staking System - Smart Contracts

- [ ] 5.1 Create `contracts/Staking.sol`
- [ ] 5.2 Implement `stake()` with lock duration validation
- [ ] 5.3 Implement `unstake()` with penalty calculation
- [ ] 5.4 Implement `claimReward()` function
- [ ] 5.5 Implement `addReward()` for platform injection
- [ ] 5.6 Implement reward calculation logic (`_updateReward`)
- [ ] 5.7 Implement view functions for stake info and pending rewards
- [ ] 5.8 Write unit tests for Staking.sol

---

## 6. DAO Governance - Smart Contracts

- [ ] 6.1 Create `contracts/Governance.sol`
- [ ] 6.2 Implement Proposal struct and states
- [ ] 6.3 Implement `createProposal()` with threshold check
- [ ] 6.4 Implement `castVote()` with weight calculation
- [ ] 6.5 Implement `_updateState()` for state transitions
- [ ] 6.6 Implement `executeProposal()` with callData execution
- [ ] 6.7 Implement quorum requirement check
- [ ] 6.8 Implement view functions for proposal queries
- [ ] 6.9 Write unit tests for Governance.sol

---

## 7. Tournament System - Backend Services

- [ ] 7.1 Create `server/services/TournamentService.js` skeleton
- [ ] 7.2 Implement `init()` with contract instance setup
- [ ] 7.3 Implement `createTournament()` calling contract
- [ ] 7.4 Implement `joinTournament()` with payment handling
- [ ] 7.5 Implement `startTournament()` creating TournamentTable
- [ ] 7.6 Implement `handleElimination()` callback
- [ ] 7.7 Implement `handleTournamentEnd()` submitting rankings
- [ ] 7.8 Implement `startWaitingCheck()` for timeout monitoring
- [ ] 7.9 Implement `broadcastTableState()` for game updates
- [ ] 7.10 Add Socket event handlers for tournament events

---

## 8. NFT Achievement System - Backend Services

- [ ] 8.1 Create `server/services/NFTService.js` skeleton
- [ ] 8.2 Implement `checkAchievement()` for hand type detection
- [ ] 8.3 Implement `generateMintSignature()` for NFT claims
- [ ] 8.4 Implement `processGameEnd()` integrating with Table.js
- [ ] 8.5 Implement `checkMonthlyLimit()` querying contract
- [ ] 8.6 Implement `getPlayerNFTs()` for user NFT list
- [ ] 8.7 Add Socket event handlers for NFT events

---

## 9. CHIP Token - Backend Services

- [ ] 9.1 Create `server/services/ChipService.js` skeleton
- [ ] 9.2 Implement `rewardGameplay()` for game rewards
- [ ] 9.3 Implement `calculateVIPDiscount()` for VIP status
- [ ] 9.4 Implement `getUserInfo()` for balance and stake info
- [ ] 9.5 Implement `distributeRakeToStakers()` for reward injection
- [ ] 9.6 Add Socket event handlers for CHIP events

---

## 10. DAO Governance - Backend Services

- [ ] 10.1 Create `server/services/DAOService.js` skeleton
- [ ] 10.2 Implement `createProposal()` calling contract
- [ ] 10.3 Implement `createRakeRateProposal()` helper
- [ ] 10.4 Implement `getActiveProposals()` for active list
- [ ] 10.5 Implement `encodeSetRakeRate()` for callData encoding
- [ ] 10.6 Add Socket event handlers for DAO events

---

## 11. Tournament Table - Game Logic

- [ ] 11.1 Create `server/pokergame/TournamentTable.js` extending Table
- [ ] 11.2 Implement constructor with tournament-specific properties
- [ ] 11.3 Override `endHand()` for elimination detection
- [ ] 11.4 Implement `checkEliminatedPlayers()` method
- [ ] 11.5 Implement `getRemainingPlayers()` method
- [ ] 11.6 Implement `getFinalRankings()` method
- [ ] 11.7 Implement `handleDisconnect()` for auto-fold
- [ ] 11.8 Implement `handleTimeout()` with time bank logic
- [ ] 11.9 Write unit tests for TournamentTable.js

---

## 12. Socket Events - Integration

- [ ] 12.1 Add tournament event handlers to `server/socket/index.js`
- [ ] 12.2 Add NFT event handlers
- [ ] 12.3 Add CHIP event handlers
- [ ] 12.4 Add DAO event handlers
- [ ] 12.5 Implement room management for tournament rooms
- [ ] 12.6 Update game state events for tournament mode

---

## 13. Database Migrations

- [ ] 13.1 Create `tournaments` table migration
- [ ] 13.2 Create `tournament_players` table migration
- [ ] 13.3 Create `nft_claims` table migration
- [ ] 13.4 Create `stakes` table migration
- [ ] 13.5 Create `proposals` table migration
- [ ] 13.6 Create `votes` table migration
- [ ] 13.7 Run migrations on development database
- [ ] 13.8 Verify migration rollback scripts

---

## 14. API Routes

- [ ] 14.1 Create `/api/tournament` routes (list, detail, join)
- [ ] 14.2 Create `/api/nft/user/:address` route
- [ ] 14.3 Create `/api/chip/balance/:address` route
- [ ] 14.4 Create `/api/stake/info/:address` route
- [ ] 14.5 Create `/api/stake` route (stake, unstake, claim)
- [ ] 14.6 Create `/api/dao/proposals` routes (list, detail, vote)
- [ ] 14.7 Create `/api/dao/proposal` route (create)
- [ ] 14.8 Add authentication middleware to protected routes

---

## 15. Frontend - Tournament Lobby

- [ ] 15.1 Create tournament lobby page component
- [ ] 15.2 Implement tournament list display with filters
- [ ] 15.3 Implement tournament detail modal
- [ ] 15.4 Implement join tournament button with payment
- [ ] 15.5 Implement waiting room with player count
- [ ] 15.6 Implement countdown for scheduled tournaments

---

## 16. Frontend - Tournament Game Table

- [ ] 16.1 Create tournament table component extending game table
- [ ] 16.2 Display initial chips and fixed blinds info
- [ ] 16.3 Implement elimination notification
- [ ] 16.4 Implement final ranking display
- [ ] 16.5 Implement prize claim button
- [ ] 16.6 Handle disconnect/reconnect scenarios

---

## 17. Frontend - NFT Gallery

- [ ] 17.1 Create NFT gallery page component
- [ ] 17.2 Implement NFT card with rarity indicator
- [ ] 17.3 Implement achievement unlock popup
- [ ] 17.4 Implement mint NFT flow with signature
- [ ] 17.5 Display monthly limit progress
- [ ] 17.6 Implement NFT detail modal with metadata

---

## 18. Frontend - CHIP Wallet

- [ ] 18.1 Create CHIP wallet page component
- [ ] 18.2 Display CHIP balance and staked amount
- [ ] 18.3 Implement stake CHIP form with lock duration
- [ ] 18.4 Implement unstake CHIP with penalty warning
- [ ] 18.5 Implement claim reward button
- [ ] 18.6 Display VIP status badge and benefits
- [ ] 18.7 Implement transaction history list

---

## 19. Frontend - DAO Governance

- [ ] 19.1 Create DAO governance page component
- [ ] 19.2 Implement proposal list with status filters
- [ ] 19.3 Implement proposal detail with voting UI
- [ ] 19.4 Implement vote buttons (for/against/abstain)
- [ ] 19.5 Display voting progress and quorum status
- [ ] 19.6 Implement create proposal form
- [ ] 19.7 Display proposal execution status

---

## 20. Test Infrastructure Setup

- [ ] 20.1 Create `tests/mock/poker-hands.js` with NFT牌型模拟数据 ✅
- [ ] 20.2 Create `tests/helpers/bot-player.js` with 机器人玩家实现 ✅
- [ ] 20.3 Create `tests/TEST_PLAN.md` 测试方案文档 ✅
- [ ] 20.4 Configure test directories and structure
- [ ] 20.5 Set up test coverage reporting (nyc/istanbul)
- [ ] 20.6 Configure Playwright for E2E testing
- [ ] 20.7 Create test fixtures and seed data

---

## 21. Unit Testing - Contracts

- [ ] 21.1 Write unit tests for `Tournament.sol`
  - [ ] Tournament creation and configuration
  - [ ] Player join/leave logic
  - [ ] Tournament start/end conditions
  - [ ] Prize distribution calculation
- [ ] 21.2 Write unit tests for `AchievementNFT.sol`
  - [ ] Signature verification
  - [ ] Monthly limit mechanism
  - [ ] NFT minting flow
- [ ] 21.3 Write unit tests for `ChipToken.sol`
  - [ ] Mint/burn operations
  - [ ] Minter management
  - [ ] Transfer with pause check
- [ ] 21.4 Write unit tests for `Staking.sol`
  - [ ] Stake/unstake operations
  - [ ] Lock duration validation
  - [ ] Reward calculation
  - [ ] Early unstake penalty
- [ ] 21.5 Write unit tests for `Governance.sol`
  - [ ] Proposal creation
  - [ ] Voting mechanism
  - [ ] Quorum check
  - [ ] Proposal execution

---

## 22. Unit Testing - Services

- [ ] 22.1 Write unit tests for `TournamentService.js`
- [ ] 22.2 Write unit tests for `NFTService.js`
- [ ] 22.3 Write unit tests for `ChipService.js`
- [ ] 22.4 Write unit tests for `DAOService.js`
- [ ] 22.5 Write unit tests for `TournamentTable.js`
  - [ ] Elimination detection
  - [ ] Final ranking calculation
  - [ ] Disconnect handling
  - [ ] Timeout with time bank

---

## 23. Integration Testing

- [ ] 23.1 Write integration test for 2-player tournament flow ✅
- [ ] 23.2 Write integration test for 6-player tournament flow ✅
- [ ] 23.3 Write integration test for NFT minting flow ✅
  - [ ] Hand type detection (all 6 achievement types)
  - [ ] Signature generation and verification
  - [ ] Monthly limit enforcement
  - [ ] Replay attack prevention
- [ ] 23.4 Write integration test for staking and reward claiming
- [ ] 23.5 Write integration test for DAO proposal and voting
- [ ] 23.6 Write integration test for VIP discount application
- [ ] 23.7 Write integration test for player disconnect/reconnect
- [ ] 23.8 Write integration test for tournament prize distribution

---

## 24. E2E Testing (Playwright)

- [ ] 24.1 Write E2E test for tournament lobby ✅
  - [ ] Tournament list display
  - [ ] Filter functionality
  - [ ] Tournament detail view
- [ ] 24.2 Write E2E test for tournament join flow ✅
  - [ ] Unauthenticated user flow
  - [ ] Authenticated user flow
  - [ ] Payment confirmation
- [ ] 24.3 Write E2E test for tournament game play
  - [ ] Game table display
  - [ ] Action buttons
  - [ ] Chip count updates
- [ ] 24.4 Write E2E test for NFT gallery ✅
  - [ ] NFT list display
  - [ ] NFT detail modal
  - [ ] Rarity indicators
- [ ] 24.5 Write E2E test for NFT minting flow
  - [ ] Achievement selection
  - [ ] Payment flow
  - [ ] Success confirmation
- [ ] 24.6 Write E2E test for CHIP wallet
  - [ ] Balance display
  - [ ] Stake flow
  - [ ] Unstake flow
  - [ ] Reward claim
- [ ] 24.7 Write E2E test for DAO governance
  - [ ] Proposal list
  - [ ] Vote casting
  - [ ] Proposal creation

---

## 25. API Testing

- [ ] 25.1 Write API tests for `/api/tournament` endpoints
- [ ] 25.2 Write API tests for `/api/nft` endpoints
- [ ] 25.3 Write API tests for `/api/chip` endpoints
- [ ] 25.4 Write API tests for `/api/stake` endpoints
- [ ] 25.5 Write API tests for `/api/dao` endpoints
- [ ] 25.6 Test authentication middleware
- [ ] 25.7 Test rate limiting
- [ ] 25.8 Test error responses

---

## 26. Bot Player Testing

- [ ] 26.1 Test bot connection to server
- [ ] 26.2 Test bot join table/tournament
- [ ] 26.3 Test bot game actions (fold/check/call/raise)
- [ ] 26.4 Test different bot strategies
  - [ ] Random strategy
  - [ ] Aggressive strategy
  - [ ] Passive strategy
  - [ ] Optimal strategy
- [ ] 26.5 Test bot disconnect handling
- [ ] 26.6 Test multi-bot tournament simulation

---

## 27. Performance Testing

- [ ] 27.1 Test concurrent tournament join (100 players)
- [ ] 27.2 Test game latency under load
- [ ] 27.3 Test Socket connection stability
- [ ] 27.4 Test database query performance
- [ ] 27.5 Test hand evaluation performance (1000 hands < 100ms)
- [ ] 27.6 Test bot creation performance (100 bots < 1s)

---

## 28. Security Testing

- [ ] 28.1 Test reentrancy attack scenarios on contracts
- [ ] 28.2 Test signature replay attacks on NFT minting
- [ ] 28.3 Test unauthorized contract calls
- [ ] 28.4 Test SQL injection on API endpoints
- [ ] 28.5 Test XSS on frontend components
- [ ] 28.6 Test CSRF protection
- [ ] 28.7 Test input validation

---

## 23. Deployment

- [ ] 23.1 Deploy smart contracts to TRON Shasta testnet
- [ ] 23.2 Verify contract deployments
- [ ] 23.3 Set up minter permissions for ChipToken
- [ ] 23.4 Run database migrations on test environment
- [ ] 23.5 Deploy backend services to test server
- [ ] 23.6 Deploy frontend to test environment
- [ ] 23.7 Perform end-to-end testing on testnet
- [ ] 23.8 Document deployment checklist for mainnet
- [ ] 23.9 Deploy smart contracts to TRON mainnet
- [ ] 23.10 Deploy backend services to production
- [ ] 23.11 Deploy frontend to production CDN
- [ ] 23.12 Verify all systems operational

---

## 24. Documentation

- [ ] 24.1 Update API documentation with new endpoints
- [ ] 24.2 Create user guide for tournament system
- [ ] 24.3 Create user guide for NFT minting
- [ ] 24.4 Create user guide for staking and rewards
- [ ] 24.5 Create user guide for DAO voting
- [ ] 24.6 Document contract ABIs
- [ ] 24.7 Create admin operations guide

---

## Summary

| Phase | Tasks | Priority | Status |
|-------|-------|----------|--------|
| Setup & Configuration | 4 | P0 | Pending |
| Smart Contracts | 32 | P0 | Pending |
| Backend Services | 26 | P0 | Pending |
| Game Logic | 9 | P0 | Pending |
| Socket Integration | 6 | P1 | Pending |
| Database | 8 | P0 | Pending |
| API Routes | 8 | P1 | Pending |
| Frontend | 24 | P1 | Pending |
| Test Infrastructure | 7 | P0 | **3 Done** |
| Unit Testing - Contracts | 25 | P0 | Pending |
| Unit Testing - Services | 15 | P0 | Pending |
| Integration Testing | 8 | P0 | **3 Done** |
| E2E Testing | 21 | P0 | **3 Done** |
| API Testing | 8 | P0 | Pending |
| Bot Player Testing | 6 | P0 | Pending |
| Performance Testing | 6 | P0 | Pending |
| Security Testing | 7 | P0 | Pending |
| Deployment | 12 | P0 | Pending |
| Documentation | 7 | P2 | Pending |
| **Total** | **233** | - | **9 Done** |

### Test Files Created

```
tests/
├── TEST_PLAN.md                    ✅ 测试方案文档
├── mock/
│   └── poker-hands.js              ✅ NFT牌型模拟数据
├── helpers/
│   └── bot-player.js               ✅ 机器人玩家实现
├── integration/
│   ├── nft.mint.test.js            ✅ NFT铸造集成测试
│   └── tournament.flow.test.js     ✅ 锦标赛流程集成测试
└── e2e/
    ├── tournament.spec.js          ✅ 锦标赛E2E测试
    └── nft-gallery.spec.js         ✅ NFT画廊E2E测试
```
