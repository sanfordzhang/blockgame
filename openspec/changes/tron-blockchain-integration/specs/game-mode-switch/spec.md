# Spec: Game Mode Switch

## ADDED Requirements

### Requirement: Select Game Mode

The system SHALL allow users to select between Fun Mode and Real Mode.

#### Scenario: Select Fun Mode
- **WHEN** user selects "Fun Mode"
- **THEN** system configures for Nile Testnet
- **AND** displays "Fun Mode - Testnet TRX" indicator
- **AND** uses testnet contract address

#### Scenario: Select Real Mode
- **WHEN** user selects "Real Mode"
- **THEN** system configures for Tron Mainnet
- **AND** displays "Real Mode - Real TRX" indicator
- **AND** uses mainnet contract address

### Requirement: Network Detection and Warning

The system SHALL warn users about network mismatches.

#### Scenario: Fun Mode with mainnet wallet
- **WHEN** user selected Fun Mode
- **AND** wallet is connected to mainnet
- **THEN** system displays warning "Please switch to Nile Testnet for Fun Mode"
- **AND** provides button to switch network

#### Scenario: Real Mode with testnet wallet
- **WHEN** user selected Real Mode
- **AND** wallet is connected to testnet
- **THEN** system displays warning "Please switch to Mainnet for Real Mode"
- **AND** provides button to switch network

### Requirement: Separate Contract Instances

The system SHALL maintain separate contract instances for each mode.

#### Scenario: Fun Mode uses testnet contract
- **WHEN** user in Fun Mode makes a deposit
- **THEN** transaction goes to testnet contract
- **AND** uses testnet TRX

#### Scenario: Real Mode uses mainnet contract
- **WHEN** user in Real Mode makes a deposit
- **THEN** transaction goes to mainnet contract
- **AND** uses real TRX

### Requirement: Balance Separation

The system SHALL keep Fun Mode and Real Mode balances separate.

#### Scenario: Display mode-specific balance
- **WHEN** user views balance
- **THEN** system displays balance for current mode only
- **AND** clearly labels which mode the balance belongs to

#### Scenario: Switch modes with balance check
- **WHEN** user switches mode
- **THEN** system queries balance for new mode's contract
- **AND** displays appropriate balance (may be zero in new mode)

### Requirement: Mode Persistence

The system SHALL remember user's preferred mode.

#### Scenario: Remember mode selection
- **WHEN** user selects a mode
- **THEN** system saves preference to localStorage
- **AND** restores preference on next visit

### Requirement: Mode Indicator

The system SHALL prominently display the current mode.

#### Scenario: Visible mode indicator
- **WHEN** user is in Fun Mode
- **THEN** system displays green "FUN MODE" badge in header

#### Scenario: Visible mode indicator for Real Mode
- **WHEN** user is in Real Mode
- **THEN** system displays orange "REAL MODE" badge in header

### Requirement: Mode-Specific Messaging

The system SHALL display appropriate messages for each mode.

#### Scenario: Fun Mode deposit message
- **WHEN** user deposits in Fun Mode
- **THEN** system displays "Get free testnet TRX from faucet"
- **AND** provides link to faucet

#### Scenario: Real Mode deposit warning
- **WHEN** user deposits in Real Mode
- **THEN** system displays "You are depositing real TRX"
- **AND** requires confirmation

### Requirement: Testnet TRX Acquisition

The system SHALL help users obtain testnet TRX for Fun Mode.

#### Scenario: Display faucet link
- **WHEN** user is in Fun Mode
- **AND** user has zero balance
- **THEN** system displays "Get Testnet TRX" button
- **AND** links to official Tron testnet faucet

### Requirement: Prevent Cross-Mode Games

The system SHALL prevent players from different modes joining the same table.

#### Scenario: Mode-based table filtering
- **WHEN** user views available tables
- **THEN** system shows only tables for current mode
- **AND** hides tables from other mode
