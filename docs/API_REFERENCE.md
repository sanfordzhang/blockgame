# API Reference

## Base URL

- **Testnet**: `http://127.0.0.1:7778`
- **Mainnet**: `https://api.yourgame.com`

## Authentication

Most endpoints require authentication via wallet signature. Include the following header:

```
x-wallet-address: <wallet_address>
Authorization: Bearer <session_token>
```

---

## Tournament API

### GET /api/tournament/list

Get all tournaments with optional filter.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: WAITING, IN_PROGRESS, COMPLETED, CANCELLED |
| type | string | No | Filter by tournament type |

**Response:**
```json
{
  "success": true,
  "tournaments": [
    {
      "_id": "tournament_id",
      "configId": 1,
      "status": "WAITING",
      "players": [],
      "prizePool": 0,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /api/tournament/waiting

Get all waiting tournaments.

**Response:** Same as `/list`

### GET /api/tournament/active

Get all active tournaments (WAITING or IN_PROGRESS).

**Response:** Same as `/list`

### GET /api/tournament/configs/list

Get available tournament configurations.

**Response:**
```json
{
  "success": true,
  "configs": [
    {
      "configId": 1,
      "tournamentType": "SIT_AND_GO",
      "playerCount": 2,
      "buyIn": "10000000",
      "rakeRate": 500,
      "prizeDistribution": [7000, 3000],
      "initialChips": 10000
    }
  ]
}
```

### GET /api/tournament/history/:walletAddress

Get player tournament history.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| walletAddress | string | Yes | Player's wallet address |

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "tournamentId": "...",
      "finalPosition": 1,
      "prizeAmount": "7000000",
      "endedAt": "2024-01-01T01:00:00.000Z"
    }
  ]
}
```

### GET /api/tournament/:tournamentId

Get tournament details.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tournamentId | string | Yes | Tournament ID |

### POST /api/tournament/create

Create a new tournament (admin only, test mode available).

**Request Body:**
```json
{
  "configId": 1,
  "walletAddress": "optional_test_mode_address"
}
```

### POST /api/tournament/:tournamentId/join

Join a tournament.

**Request Body:**
```json
{
  "socketId": "optional_socket_id_for_realtime_updates"
}
```

**Headers:**
- `x-wallet-address`: Player's wallet address (required)

### POST /api/tournament/:tournamentId/cancel

Cancel tournament join (refund entry fee).

**Requires Authentication**

### POST /api/tournament/:tournamentId/start

Start a tournament (server/internal only).

### POST /api/tournament/:tournamentId/finish

Finish a tournament with rankings.

**Request Body:**
```json
{
  "rankings": ["address1", "address2", "address3"]
}
```

### GET /api/tournament/:tournamentId/players

Get tournament players.

### POST /api/tournament/:tournamentId/claim

Claim tournament prize.

**Headers:**
- `x-wallet-address`: Player's wallet address (required)

---

## NFT API

### GET /api/nft/types

Get all achievement types.

**Response:**
```json
{
  "success": true,
  "types": [
    {
      "id": 0,
      "name": "Royal Flush",
      "rarity": "LEGENDARY",
      "monthlyLimit": 10,
      "mintPrice": "5000000"
    },
    {
      "id": 1,
      "name": "Straight Flush",
      "rarity": "EPIC",
      "monthlyLimit": 50,
      "mintPrice": "3000000"
    },
    {
      "id": 2,
      "name": "Four of a Kind",
      "rarity": "RARE",
      "monthlyLimit": 100,
      "mintPrice": "2000000"
    },
    {
      "id": 3,
      "name": "Full House",
      "rarity": "RARE",
      "monthlyLimit": 100,
      "mintPrice": "1500000"
    },
    {
      "id": 4,
      "name": "Flush",
      "rarity": "COMMON",
      "monthlyLimit": 200,
      "mintPrice": "1000000"
    },
    {
      "id": 5,
      "name": "Straight",
      "rarity": "COMMON",
      "monthlyLimit": 200,
      "mintPrice": "1000000"
    }
  ]
}
```

### GET /api/nft/collection/:walletAddress

Get user's NFT collection.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| walletAddress | string | Yes | Owner's wallet address |

**Response:**
```json
{
  "success": true,
  "nfts": [
    {
      "tokenId": 1,
      "achievementType": 0,
      "name": "Royal Flush #1",
      "rarity": "LEGENDARY",
      "mintedAt": "2024-01-01T00:00:00.000Z",
      "handData": { ... }
    }
  ]
}
```

### GET /api/nft/:tokenId

Get NFT details by token ID.

### GET /api/nft/limit/:walletAddress/:achievementType

Check monthly limit for achievement type.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| walletAddress | string | Yes | Player's wallet address |
| achievementType | number | Yes | Achievement type ID (0-5) |

**Response:**
```json
{
  "success": true,
  "achievementType": 0,
  "monthlyLimit": 10,
  "mintedThisMonth": 3,
  "remaining": 7,
  "canMint": true
}
```

### POST /api/nft/prepare-mint

Prepare NFT mint with signature (requires achievement).

**Requires Authentication**

**Request Body:**
```json
{
  "achievementType": 0,
  "gameSessionId": "session_id",
  "handData": {
    "cards": ["Ah", "Kh", "Qh", "Jh", "Th"],
    "handRank": "Royal Flush"
  }
}
```

**Response:**
```json
{
  "success": true,
  "signature": "0x...",
  "timestamp": 1704067200,
  "expiresAt": 1704672000,
  "achievementType": 0,
  "mintPrice": "5000000"
}
```

### GET /api/nft/stats/:walletAddress

Get user's NFT statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalNFTs": 5,
    "byRarity": {
      "LEGENDARY": 1,
      "EPIC": 1,
      "RARE": 2,
      "COMMON": 1
    },
    "byType": {
      "Royal Flush": 1,
      "Straight Flush": 1,
      "Four of a Kind": 2,
      "Flush": 1
    }
  }
}
```

### GET /api/nft/metadata/:tokenId

Get NFT metadata (for external platforms like OpenSea).

---

## CHIP Token API

### GET /api/chip/balance/:walletAddress

Get user's CHIP balance and info.

**Response:**
```json
{
  "success": true,
  "balance": "1000000000",
  "stakedAmount": "500000000",
  "votingPower": "1000000000"
}
```

### GET /api/chip/vip-status/:walletAddress

Get user's VIP status and discount.

**Response:**
```json
{
  "success": true,
  "isVIP": true,
  "level": 2,
  "rakeDiscount": 10,
  "stakedAmount": "500000000"
}
```

### POST /api/chip/transfer

Transfer CHIP tokens.

**Requires Authentication**

**Request Body:**
```json
{
  "to": "recipient_address",
  "amount": "1000000"
}
```

### GET /api/chip/supply

Get total CHIP supply info.

**Response:**
```json
{
  "success": true,
  "totalSupply": "1000000000000000",
  "maxSupply": "1000000000000000",
  "circulatingSupply": "850000000000000",
  "stakedSupply": "150000000000000"
}
```

### GET /api/chip/rewards/:walletAddress

Get pending CHIP rewards for user.

### POST /api/chip/claim-rewards

Claim pending CHIP rewards.

**Requires Authentication**

### GET /api/chip/history/:walletAddress

Get user's CHIP transaction history.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

---

## Staking API

### GET /api/stake/info/:walletAddress

Get user's staking info.

**Response:**
```json
{
  "success": true,
  "stakes": [
    {
      "id": "stake_id",
      "amount": "100000000",
      "startTime": "2024-01-01T00:00:00.000Z",
      "lockedUntil": "2024-02-01T00:00:00.000Z",
      "isLocked": false,
      "pendingReward": "5000000"
    }
  ],
  "totalStaked": "100000000",
  "totalPendingReward": "5000000"
}
```

### POST /api/stake/create

Create a new stake.

**Requires Authentication**

**Request Body:**
```json
{
  "amount": "100000000",
  "lockDays": 30
}
```

**Lock Period Options:**
- Minimum: 7 days
- Maximum: 365 days
- Longer lock = higher reward rate

### POST /api/stake/unstake

Unstake tokens (with penalty if early).

**Requires Authentication**

**Request Body:**
```json
{
  "stakeId": "stake_id"
}
```

**Note:** Early unstake incurs 10% penalty.

### POST /api/stake/claim-reward

Claim staking rewards.

**Requires Authentication**

**Request Body:**
```json
{
  "stakeId": "stake_id"
}
```

### GET /api/stake/pending-reward/:walletAddress

Get pending staking reward.

### GET /api/stake/history/:walletAddress

Get user's staking history.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

### GET /api/stake/stats

Get global staking statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalStaked": "10000000000000",
    "totalStakers": 1500,
    "avgLockPeriod": 45,
    "rewardRate": "5"
  }
}
```

---

## DAO Governance API

### GET /api/dao/proposals

Get all proposals with optional filter.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| state | string | - | Filter by state: PENDING, ACTIVE, SUCCEEDED, DEFEATED, EXECUTED |
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

### GET /api/dao/proposals/active

Get active proposals.

### GET /api/dao/proposals/:proposalId

Get proposal details.

### POST /api/dao/proposals/create

Create a new proposal.

**Requires Authentication**

**Prerequisites:**
- Minimum 1000 CHIP tokens

**Request Body:**
```json
{
  "title": "Proposal Title",
  "description": "Proposal description",
  "targetContract": "contract_address",
  "callData": "0x..."
}
```

### POST /api/dao/proposals/rake-rate

Create a rake rate change proposal.

**Requires Authentication**

**Request Body:**
```json
{
  "newRakeRate": 400,
  "description": "Reduce rake rate from 5% to 4%"
}
```

### POST /api/dao/proposals/:proposalId/vote

Cast vote on a proposal.

**Requires Authentication**

**Request Body:**
```json
{
  "support": true
}
```

**Note:** `support: true` = For, `support: false` = Against

### POST /api/dao/proposals/:proposalId/execute

Execute a passed proposal.

**Note:** Can only be called after voting period ends and proposal succeeded.

### GET /api/dao/votes/:walletAddress

Get user's voting history.

### GET /api/dao/voting-power/:walletAddress

Get user's voting power.

**Response:**
```json
{
  "success": true,
  "votingPower": "1000000000"
}
```

**Note:** 1 CHIP = 1 Vote

### GET /api/dao/threshold

Get proposal threshold (minimum CHIP to create proposal).

### GET /api/dao/quorum

Get quorum requirement (minimum participation for valid vote).

---

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (authentication required) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Public GET | 100 requests/minute |
| Authenticated GET | 300 requests/minute |
| POST (write operations) | 30 requests/minute |
| Authenticated POST | 60 requests/minute |

---

## WebSocket Events

Real-time updates are available via Socket.io at the same host.

### Tournament Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `CS_JOIN_TOURNAMENT` | Client → Server | Request to join tournament |
| `SC_TOURNAMENT_JOINED` | Server → Client | Tournament join confirmation |
| `SC_TOURNAMENT_STARTED` | Server → Client | Tournament started notification |
| `SC_TOURNAMENT_ENDED` | Server → Client | Tournament ended with results |

### NFT Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `SC_ACHIEVEMENT_UNLOCKED` | Server → Client | Achievement unlocked, NFT available |
| `SC_NFT_MINTED` | Server → Client | NFT successfully minted |
