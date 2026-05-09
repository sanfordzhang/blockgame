# Spec: Wallet Connection (Multi-Chain Enhanced)

## MODIFIED Requirements

### Requirement: Connect Wallet

系统 SHALL 允许用户连接钱包，**扩展支持 MetaMask/EVM 钱包用于 0G Chain**。

#### Scenario: User connects MetaMask wallet (NEW)
- **WHEN** user clicks "Connect 0G Wallet" button
- **AND** MetaMask (or compatible EVM wallet) extension is installed and unlocked
- **THEN** system calls `window.ethereum.request({ method: 'eth_requestAccounts' })`
- **AND** displays user's 0G EVM address after approval (format: "0xAbCd...")
- **AND** detects connected chain ID (16602 for testnet, 16661 for mainnet)

#### Scenario: User connects TronLink wallet (UNCHANGED)
- **WHEN** user clicks "Connect Wallet" button (original)
- **AND** TronLink extension is installed and unlocked
- **THEN** behavior unchanged: displays TRON address (format: "TJx...AbCd")

#### Scenario: No wallet installed (EVM)
- **WHEN** user clicks "Connect 0G Wallet" button
- **AND** `window.ethereum` is undefined
- **THEN** system displays prompt to install MetaMask or compatible wallet
- **AND** provides download links

#### Scenario: Wrong network on 0G (NEW)
- **WHEN** user connects wallet but chain ID doesn't match expected 0G network
- **THEN** system displays warning: "Please switch to 0G Testnet/Mainnet"
- **AND** optionally calls `wallet_switchChain` to prompt network switch
- **AND** shows current vs expected network IDs

---

### Requirement: Display Wallet Address

系统 SHALL 显示连接的钱包地址，**根据链类型适配格式**。

#### Scenario: Display 0G address (EVM format)
- **WHEN** 0G 钱包已连接
- **THEN** system displays address as "0xAbCd...EfGh" format (first 5 + last 4 characters, 0x prefix preserved)

#### Scenario: Display TRON address (unchanged)
- **WHEN** TRON 钱包已连接
- **THEN** system displays address as "TJx...AbCd" format (first 4 + last 4 characters, unchanged)

#### Scenario: Dual-wallet display
- **WHEN** both TRON and 0G wallets are connected simultaneously
- **THEN** header area shows both:
  - "TRON: TJx...AbCd"
  - "0G: 0xCd...Ef01"
- **AND** active/inactive wallet visually distinguished

---

### Requirement: Query Balance

系统 SHALL 查询并显示区块链余额，**支持双链余额**。

#### Scenario: Display 0G/ETH balance (NEW)
- **WHEN** 0G 钱包已连接
- **THEN** system queries native token balance via `ethers.provider.getBalance(address)`
- **AND** displays balance in ETH/0G token units
- **AND** also queries CHIP token balance if deployed on 0G

#### Scenario: Display TRX balance (UNCHANGED)
- **WHEN** TRON 钱包已连接
- **THEN** system queries balance via TronWeb (behavior unchanged)

#### Scenario: Multi-chain balance summary
- **WHEN** both wallets connected
- **THEN** wallet page shows tabbed view:
  - **Tab "TRON"**: TRX balance + CHIP token balance
  - **Tab "0G"**: 0G/ETH balance + custody balance (if deposited)

---

### Requirement: Sign Transactions

系统 SHALL 允许用户通过钱包签名交易，**支持 EVM 签名（personalSign + eth_signTypedData）**。

#### Scenario: Sign message for authentication (0G)
- **WHEN** user needs to authenticate on 0G mode
- **THEN** system generates login message: `Sign this message to login to 0G Poker: {nonce}:{timestamp}`
- **AND** calls `personalSign(address, message)` via MetaMask
- **AND** verifies signature on server using `ethers.verifyMessage(message, signature)`

#### Scenario: Sign deposit transaction (0G)
- **WHEN** user initiates deposit on 0G chain
- **THEN** system constructs Ethereum transaction:
```javascript
const tx = {
  to: pokerGame0GAddress,
  data: pokerGame0G.interface.encodeFunctionData('deposit', []),
  value: ethers.parseEther(depositAmount)
};
await window.ethereum.request({
  method: 'eth_sendTransaction',
  params: [tx]
});
```
- **AND** prompts user to sign via MetaMask
- **AND** submits transaction after signature

#### Scenario: Reject transaction (0G)
- **WHEN** user rejects signing in MetaMask
- **THEN** system displays "Transaction cancelled" message (consistent UX with TRON rejection)

---

### Requirement: Handle Wallet Events

系统 SHALL 响应钱包状态变化，**扩展 0G 钱包事件监听**。

#### Scenario: 0G account changed (NEW)
- **WHEN** user switches account in MetaMask
- **THEN** `ethereum.on('accountsChanged')` fires
- **AND** system updates displayed address
- **AND** refreshes balance for new account
- **AND** if mid-game, prompts user that account change may affect gameplay

#### Scenario: 0G chain changed (NEW)
- **WHEN** user switches network in MetaMask
- **THEN** `ethereum.on('chainChanged')` fires
- **AND** system re-initializes provider for new chain
- **AND** reloads contract instances
- **AND** warns user if new chain is not supported 0G network

#### Scenario: 0G wallet disconnected (NEW)
- **WHEN** user disconnects wallet in MetaMask (`ethereum.removeListener`)
- **THEN** system clears 0G wallet state
- **AND** if 0G is active chain, redirects to wallet connection page
- **OR** if TRON also connected, switches active context to TRON

#### Scenario: TRON wallet events (UNCHANGED)
- **WHEN** TronLink disconnect / account change events fire
- **THEN** behavior unchanged (existing handlers remain active)

---

## ADDED Requirements

### Requirement: Chain Switch UI

系统 SHALL 提供多链切换界面。

#### Scenario: Landing page dual wallet buttons
- **WHEN** user visits landing page (/)
- **THEN** two prominent wallet connection buttons shown:
  - "Connect with TronLink" (TRON icon)
  - "Connect with MetaMask" (MetaMask fox icon / 0G branding)
- **AND** below buttons: text "Choose your preferred blockchain network"

#### Scenario: Active chain indicator
- **WHEN** user has one or both wallets connected
- **THEN** navigation bar shows current active chain badge:
  - Green dot + "TRON Network" or
  - Blue dot + "0G Network" or
  - Both badges if dual-connected

#### Scenario: Switch active chain
- **WHEN** user clicks on non-active chain badge
- **THEN** system switches primary context to that chain
- **AND** updates all displayed balances and data sources
- **AND** shows brief toast: "Switched to {chain} mode"

#### Scenario: Feature availability per chain
- **WHEN** certain features are chain-specific
- **THEN** system grays out or hides unavailable features:
  - INFT features → only visible when 0G active
  - DA verification → only visible when 0G active
  - Traditional NFT → available on both but different collections
  - DAO governance → depends on which chain's DAO is active
