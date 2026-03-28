# NFT Achievement Guide

## Overview

Earn exclusive NFT achievements by achieving rare poker hands! Each NFT is unique and can be traded on TRON NFT marketplaces.

---

## Achievement Types

### Rarity Levels

| Rarity | Achievement | Description |
|--------|-------------|-------------|
| **LEGENDARY** | Royal Flush | A, K, Q, J, 10 of the same suit |
| **EPIC** | Straight Flush | Five consecutive cards of the same suit |
| **RARE** | Four of a Kind | Four cards of the same rank |
| **RARE** | Full House | Three of a kind + a pair |
| **COMMON** | Flush | Five cards of the same suit |
| **COMMON** | Straight | Five consecutive cards |

### Monthly Limits

To maintain rarity, each NFT type has a monthly mint limit:

| Achievement | Monthly Limit | Mint Price |
|-------------|---------------|------------|
| Royal Flush | 10 | 5 TRX |
| Straight Flush | 50 | 3 TRX |
| Four of a Kind | 100 | 2 TRX |
| Full House | 100 | 1.5 TRX |
| Flush | 200 | 1 TRX |
| Straight | 200 | 1 TRX |

> **Note:** Monthly limits reset on the 1st of each month. Mint price is a small fee to cover gas costs.

---

## How to Earn NFTs

### Step 1: Play Games

1. Join a cash game or tournament
2. Play normally - the system automatically detects achievements
3. When you achieve a qualifying hand, you'll see a notification

### Step 2: Claim Your NFT

1. After achieving a hand, you'll see an **"Achievement Unlocked"** notification
2. Click **"View Achievement"** or navigate to **NFT Gallery**
3. Find your unlocked achievement with a **"Claim NFT"** button
4. Click **"Claim NFT"**
5. Confirm the transaction in TronLink (pay the mint price)
6. Your NFT will be minted to your wallet!

### Step 3: View Your Collection

1. Navigate to **NFT Gallery** page
2. See all your earned NFTs with:
   - Achievement type and rarity
   - Date minted
   - Hand details (cards, game session)
   - Token ID for trading

---

## NFT Details

### What's Included

Each NFT contains:

1. **Visual Art** - Unique artwork for each achievement type
2. **Metadata** - On-chain record of:
   - Achievement type
   - Rarity level
   - Date achieved
   - Hand cards
   - Game session ID
   - Block number

### Example Metadata

```json
{
  "name": "Royal Flush #42",
  "description": "Achieved a Royal Flush on 2024-01-15",
  "image": "ipfs://QmX.../royal-flush.png",
  "attributes": [
    { "trait_type": "Rarity", "value": "LEGENDARY" },
    { "trait_type": "Achievement", "value": "Royal Flush" },
    { "trait_type": "Cards", "value": "A♠ K♠ Q♠ J♠ 10♠" },
    { "trait_type": "Date", "value": "2024-01-15" }
  ]
}
```

---

## Trading NFTs

### Supported Marketplaces

Your NFTs can be traded on any TRON-compatible NFT marketplace:

1. **APENFT** - apenft.io
2. **TronSea** - tronsea.io
3. **IMX** - (if bridged)

### How to Sell

1. Connect your wallet to the marketplace
2. Import or find your NFT
3. Set your price and listing duration
4. Confirm the listing transaction
5. When sold, the marketplace will transfer the NFT and credit your wallet

### How to Buy

1. Browse the marketplace for game NFTs
2. Find the NFT you want to purchase
3. Ensure you have enough TRX
4. Confirm the purchase transaction
5. NFT will be transferred to your wallet

---

## Rarity & Value

### Factors Affecting Value

| Factor | Impact |
|--------|--------|
| **Rarity Level** | Legendary > Epic > Rare > Common |
| **Token Number** | Lower numbers (e.g., #1, #42) may be more valuable |
| **Historical Significance** | First achievements of their type |
| **Season** | Early month NFTs may be more sought after |

### Estimated Rarity

Based on poker probabilities:

| Hand | Probability | Est. NFTs/Year |
|------|-------------|----------------|
| Royal Flush | 0.000154% | ~10 per year (2M hands) |
| Straight Flush | 0.00139% | ~90 per year |
| Four of a Kind | 0.024% | ~1,600 per year |
| Full House | 0.144% | ~9,600 per year |
| Flush | 0.197% | ~13,000 per year |
| Straight | 0.392% | ~26,000 per year |

---

## Viewing NFT Stats

### Personal Statistics

1. Navigate to **NFT Gallery**
2. Click **"Stats"** tab
3. View:
   - Total NFTs owned
   - Breakdown by rarity
   - Breakdown by achievement type
   - Monthly achievements

### Global Statistics

View overall platform NFT statistics:

| Stat | Description |
|------|-------------|
| Total NFTs Minted | All-time platform total |
| Monthly Minted | Current month's mints |
| Remaining Monthly | NFTs still available this month |
| Holders | Unique wallet addresses with NFTs |

---

## Tips for Collectors

### Strategy Tips

1. **Play More Hands** - More hands = more chances for achievements
2. **Target Rarities** - Focus on higher value hands (Royal Flush, Straight Flush)
3. **Early Bird** - NFTs minted early in the month may have lower token numbers
4. **Tournaments** - More hands played in tournaments = more opportunities

### Checking Availability

Before aiming for a specific NFT type:

1. Check the **remaining monthly limit** in the NFT Gallery
2. If limit is reached, wait for next month's reset
3. Higher rarity NFTs fill up faster

---

## Security Notes

### NFT Ownership

- NFTs are stored on the TRON blockchain
- You own the NFT as long as you hold it in your wallet
- Selling transfers ownership permanently
- There is no way to "revoke" or "freeze" your NFT

### Anti-Fraud Protection

The NFT system includes protection against fraud:

1. **Signature Verification** - Only the server can authorize NFT mints
2. **Hand Verification** - Achievements are verified against actual game data
3. **One-Time Claim** - Each achievement can only mint one NFT
4. **Monthly Limits** - Prevents mass minting of rare NFTs

### What Cannot Be Faked

- Minting without actually achieving the hand
- Duplicating existing NFTs
- Modifying NFT metadata after minting

---

## FAQ

### Can I mint the same achievement multiple times?

No, each specific achievement instance can only mint one NFT. However, you can achieve the same hand type multiple times and mint each one separately.

### What if the monthly limit is reached?

If all monthly NFTs for a type are minted, you'll see "Limit Reached" and cannot mint until next month. Your achievement is still recorded in your history.

### Do NFTs expire?

No, NFTs are permanent on the blockchain and never expire.

### Can I mint from any wallet?

No, NFTs can only be minted by the wallet that achieved the hand. You cannot transfer achievements between wallets.

### What if my transaction fails?

Common reasons for failure:
1. **Insufficient TRX** - Add more TRX for gas fees
2. **Network congestion** - Try again with higher gas
3. **Monthly limit reached** - Wait for next month

### Can I mint an NFT later?

You have 7 days from the achievement to mint the NFT. After that, the signature expires and you cannot mint that specific achievement.

---

## Troubleshooting

### Issue: Achievement not showing

**Solution:**
1. Refresh the page
2. Check that you're on the correct wallet address
3. Verify the hand was actually a qualifying achievement

### Issue: Mint transaction failed

**Solution:**
1. Check your TRX balance (need mint price + gas)
2. Ensure you're on the correct network
3. Try with a higher gas limit

### Issue: NFT not appearing in wallet

**Solution:**
1. Wait a few minutes for blockchain confirmation
2. Refresh your wallet/NFT gallery
3. Check the transaction on TRONSCAN

### Issue: Can't sell on marketplace

**Solution:**
1. Ensure the marketplace supports TRC-721
2. Check if you've approved the marketplace contract
3. Verify the NFT is in the wallet connected to the marketplace

---

## Support

Need help with NFTs?

- **Discord:** [Join our community](https://discord.gg/yourgame)
- **Telegram:** @yourgamesupport
- **Email:** support@yourgame.com
- **NFT Support:** nft@yourgame.com
