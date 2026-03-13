# Spec: Game Fund Custody

## ADDED Requirements

### Requirement: Deposit TRX to Contract

The system SHALL allow users to deposit TRX to the game smart contract.

#### Scenario: Successful deposit
- **WHEN** user specifies deposit amount
- **AND** amount is within allowed range (10-1000 TRX)
- **AND** user has sufficient TRX balance
- **THEN** system creates deposit transaction
- **AND** transfers TRX to contract address
- **AND** updates user's contract balance

#### Scenario: Deposit below minimum
- **WHEN** user specifies deposit amount below 10 TRX
- **THEN** system displays error "Minimum deposit is 10 TRX"
- **AND** prevents transaction

#### Scenario: Deposit above maximum
- **WHEN** user specifies deposit amount above 1000 TRX
- **THEN** system displays error "Maximum deposit is 1000 TRX"
- **AND** prevents transaction

#### Scenario: Insufficient balance
- **WHEN** user specifies deposit amount
- **AND** user's TRX balance is insufficient
- **THEN** system displays error "Insufficient TRX balance"
- **AND** prevents transaction

### Requirement: Withdraw TRX from Contract

The system SHALL allow users to withdraw their contract balance to their wallet.

#### Scenario: Successful withdrawal
- **WHEN** user requests withdrawal
- **AND** user has sufficient contract balance
- **AND** no funds are locked in active games
- **THEN** system transfers TRX from contract to user wallet
- **AND** updates user's contract balance

#### Scenario: Withdraw with locked funds
- **WHEN** user requests full withdrawal
- **AND** user has some funds locked in active games
- **THEN** system allows withdrawal of unlocked balance only
- **AND** displays warning about locked funds

#### Scenario: Withdrawal transaction fails
- **WHEN** withdrawal transaction fails on blockchain
- **THEN** system displays error message
- **AND** user's balance remains unchanged

### Requirement: Lock Funds on Join Table

The system SHALL lock player funds when joining a game table.

#### Scenario: Lock funds for buy-in
- **WHEN** player joins a table with specified buy-in amount
- **THEN** system moves amount from available balance to locked balance
- **AND** player cannot withdraw locked amount during game

#### Scenario: Insufficient available balance
- **WHEN** player attempts to join table
- **AND** available balance is less than buy-in amount
- **THEN** system displays error "Insufficient available balance"
- **AND** prompts user to deposit more funds

### Requirement: Unlock and Distribute Funds on Settlement

The system SHALL unlock and distribute funds based on game results.

#### Scenario: Winner receives payout
- **WHEN** game ends with winner determination
- **THEN** system calculates winner's share minus rake
- **AND** moves amount from locked to available balance for winner

#### Scenario: Loser loses locked amount
- **WHEN** game ends and player loses
- **THEN** system removes lost amount from player's locked balance

#### Scenario: Rake collection
- **WHEN** game settles with winner payout
- **THEN** system calculates rake based on current rake rate
- **AND** adds rake to contract's accumulated rake balance

### Requirement: Query Contract Balance

The system SHALL allow querying user's balance in the contract.

#### Scenario: Query available balance
- **WHEN** user views their balance
- **THEN** system displays available (unlocked) balance

#### Scenario: Query locked balance
- **WHEN** user views their balance during active game
- **THEN** system displays both available and locked amounts separately

### Requirement: Contract Balance Limits

The system SHALL enforce balance limits for security.

#### Scenario: Maximum contract balance
- **WHEN** deposit would cause user's contract balance to exceed maximum
- **THEN** system displays warning
- **AND** suggests withdrawing excess funds
