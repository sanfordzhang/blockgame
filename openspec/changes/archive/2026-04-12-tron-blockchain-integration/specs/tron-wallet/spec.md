# Spec: TRON Wallet Integration

## ADDED Requirements

### Requirement: Connect TronLink Wallet

The system SHALL allow users to connect their TronLink wallet to the application.

#### Scenario: User connects wallet successfully
- **WHEN** user clicks "Connect Wallet" button
- **AND** TronLink extension is installed and unlocked
- **THEN** system requests wallet connection permission
- **AND** displays user's TRON address after approval

#### Scenario: TronLink not installed
- **WHEN** user clicks "Connect Wallet" button
- **AND** TronLink extension is not installed
- **THEN** system displays prompt to install TronLink
- **AND** provides link to TronLink download page

#### Scenario: User rejects connection
- **WHEN** user clicks "Connect Wallet" button
- **AND** user rejects the connection request in TronLink
- **THEN** system displays "Connection rejected" message
- **AND** remains in disconnected state

### Requirement: Display Wallet Address

The system SHALL display the connected wallet address in a truncated format.

#### Scenario: Display truncated address
- **WHEN** wallet is connected
- **THEN** system displays address as "TJx...AbCd" format (first 4 + last 4 characters)

### Requirement: Query TRX Balance

The system SHALL query and display the user's TRX balance from the blockchain.

#### Scenario: Display TRX balance
- **WHEN** wallet is connected
- **THEN** system queries TRX balance from TronWeb
- **AND** displays balance in TRX (not sun)

#### Scenario: Balance refresh
- **WHEN** user clicks refresh button
- **THEN** system re-queries balance from blockchain
- **AND** updates displayed balance

### Requirement: Detect Network

The system SHALL detect which TRON network the wallet is connected to.

#### Scenario: Detect mainnet
- **WHEN** wallet is connected to Tron Mainnet
- **THEN** system detects chain ID and sets mode to "Real Mode"

#### Scenario: Detect testnet
- **WHEN** wallet is connected to Nile Testnet
- **THEN** system detects chain ID and sets mode to "Fun Mode"

#### Scenario: Network mismatch warning
- **WHEN** user switches network in TronLink
- **AND** the new network doesn't match selected game mode
- **THEN** system displays warning message
- **AND** prompts user to switch network or game mode

### Requirement: Sign Transactions

The system SHALL allow users to sign blockchain transactions via TronLink.

#### Scenario: User signs deposit transaction
- **WHEN** user initiates a deposit
- **THEN** system creates transaction parameters
- **AND** prompts user to sign via TronLink
- **AND** submits transaction after signature

#### Scenario: User rejects transaction
- **WHEN** user rejects signing a transaction in TronLink
- **THEN** system displays "Transaction cancelled" message
- **AND** returns to previous state

### Requirement: Handle Wallet Events

The system SHALL respond to wallet state changes.

#### Scenario: Wallet disconnected
- **WHEN** user disconnects wallet in TronLink
- **THEN** system clears stored address
- **AND** redirects to wallet connection page

#### Scenario: Account changed
- **WHEN** user switches account in TronLink
- **THEN** system updates displayed address
- **AND** refreshes balance for new account
