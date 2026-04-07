# AMM Liquidity Pool - User Guide

## Overview

The AMM (Automated Market Maker) allows users to:
- Swap between TRX and CHIP tokens
- Provide liquidity to earn trading fees
- View real-time price charts and transaction history

## Getting Started

### 1. Access the DEX

Navigate to `/dex` in your browser or click the "DEX" link in the navigation menu.

### 2. Connect Your Wallet

1. Click "Connect Wallet" in the top right
2. Approve the connection in TronLink
3. Ensure you have both TRX and CHIP tokens for trading

## Trading (Swap)

### Swapping TRX for CHIP

1. In the Trading Panel, ensure "TRX → CHIP" is selected
2. Enter the amount of TRX you want to swap
3. Review the estimated output (CHIP)
4. Check the price impact and slippage settings
5. Click "Swap" and confirm in TronLink

### Swapping CHIP for TRX

1. Click the direction toggle to switch to "CHIP → TRX"
2. Enter the amount of CHIP to swap
3. Review the estimated output (TRX)
4. Confirm the transaction

### Slippage Settings

- **0.5%**: Recommended for stable markets
- **1%**: Default setting, good for most situations
- **2%**: For volatile markets
- **Custom**: Set your own tolerance

> ⚠️ Higher slippage tolerance increases the risk of getting a worse price

## Liquidity Provision

### Adding Liquidity

1. Go to the "Liquidity" tab
2. Enter amounts of TRX and CHIP (must maintain price ratio)
3. Review the expected LP tokens
4. Click "Add Liquidity" and approve transactions

### Rewards

- Earn 0.3% fee on all trades proportional to your share
- Fees are automatically added to your position
- View your share in "My Liquidity"

### Removing Liquidity

1. Go to "My Liquidity" tab
2. Click "Remove" on your position
3. Enter the amount of LP tokens to remove
4. Confirm the transaction

> ⚠️ Removing liquidity may result in impermanent loss

## Understanding Impermanent Loss

When you provide liquidity, the value of your assets may differ from simply holding them due to price changes.

**Example:**
- Initial: 100 TRX + 1000 CHIP (price 10 CHIP/TRX)
- Price changes to 15 CHIP/TRX
- Pool rebalances automatically
- Your position value may be less than holding

## Price Charts

The price chart shows:
- **Price**: CHIP per TRX
- **Volume**: Trading volume over time
- **Timeframes**: 1H, 4H, 1D, 1W

Use the chart to:
- Track price movements
- Identify trading opportunities
- Monitor market trends

## Transaction History

View all your AMM transactions:
- Swaps
- Liquidity additions
- Liquidity removals

Click on transaction hashes to view on TronScan.

## Fees

| Action | Fee |
|--------|-----|
| Swap | 0.3% of trade amount |
| Add Liquidity | Gas fee only |
| Remove Liquidity | Gas fee only |

## Safety Tips

1. **Start small**: Test with small amounts first
2. **Check slippage**: Use appropriate slippage settings
3. **Monitor positions**: Check your liquidity regularly
4. **Understand risks**: Be aware of impermanent loss
5. **Secure wallet**: Keep your TronLink secure

## Common Issues

### Transaction Failed

- Check you have enough TRX for gas
- Verify slippage tolerance is sufficient
- Ensure token approvals are complete

### Price Impact Too High

- Reduce trade amount
- Try splitting into multiple smaller trades
- Wait for more liquidity to be added

### Cannot Connect Wallet

- Ensure TronLink is installed and unlocked
- Check network (testnet/mainnet) matches
- Refresh the page

## Support

For help and support:
- GitHub Issues: [project-repo]/issues
- Discord: [discord-link]
- Documentation: /docs/amm

## Contract Addresses

### Testnet (Nile)
- AMM Pool: `TBD`
- AMM Router: `TBD`
- CHIP Token: `TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c`

### Mainnet
- AMM Pool: `TBD`
- AMM Router: `TBD`
- CHIP Token: `THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd`
