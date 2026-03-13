# Spec: Player Balance

## MODIFIED Requirements

### Requirement: Balance Storage

The system SHALL store player balance on the blockchain smart contract instead of in-memory.

#### Scenario: Query balance from contract
- **WHEN** user views their balance
- **THEN** system queries smart contract for player balance
- **AND** displays available and locked amounts

#### Scenario: Balance synchronization
- **WHEN** blockchain balance differs from local cache
- **THEN** system updates local cache with blockchain value
- **AND** reflects change in UI

## ADDED Requirements

### Requirement: Dual Balance Display

The system SHALL display both wallet TRX balance and contract balance.

#### Scenario: Display wallet balance
- **WHEN** user views balance section
- **THEN** system displays TRX balance in connected wallet

#### Scenario: Display contract balance
- **WHEN** user views balance section
- **THEN** system displays balance in game contract
- **AND** separates available and locked portions

### Requirement: Balance Update Events

The system SHALL provide real-time balance updates via events.

#### Scenario: Deposit confirmed
- **WHEN** deposit transaction is confirmed on blockchain
- **THEN** system updates displayed contract balance
- **AND** shows success notification

#### Scenario: Settlement completed
- **WHEN** game settlement transaction is confirmed
- **THEN** system updates winner's balance
- **AND** shows winnings notification

### Requirement: Balance History

The system SHALL display transaction history for user's contract balance.

#### Scenario: View transaction history
- **WHEN** user views balance history
- **THEN** system displays list of transactions:
    - Deposits (incoming)
    - Withdrawals (outgoing)
    - Game winnings
    - Game losses
    - Timestamps and amounts

### Requirement: Minimum Balance Warning

The system SHALL warn users when balance is low.

#### Scenario: Low balance warning
- **WHEN** user's contract balance falls below minimum buy-in
- **THEN** system displays "Low balance" warning
- **AND** prompts user to deposit more funds
