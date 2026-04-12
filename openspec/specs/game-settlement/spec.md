# Spec: Game Settlement

## MODIFIED Requirements

### Requirement: Settlement Execution

The system SHALL execute game settlement via smart contract transaction.

#### Scenario: Settlement triggered
- **WHEN** game ends with winner determination
- **THEN** system generates settlement data (winners, amounts, proof)
- **AND** submits transaction to smart contract
- **AND** waits for blockchain confirmation

#### Scenario: Settlement confirmed
- **WHEN** settlement transaction is confirmed on blockchain
- **THEN** system updates player balances on-chain
- **AND** collects rake to contract balance
- **AND** notifies winners of their winnings

## ADDED Requirements

### Requirement: Settlement Data Generation

The system SHALL generate verifiable settlement data.

#### Scenario: Generate settlement proof
- **WHEN** game ends
- **THEN** system calculates:
    - Winner addresses
    - Winning amounts per winner
    - Game random seed
    - Cryptographic proof

#### Scenario: Settlement data validation
- **WHEN** settlement transaction is submitted
- **THEN** smart contract validates the proof
- **AND** ensures amounts match pot total

### Requirement: Settlement Failure Handling

The system SHALL handle settlement transaction failures gracefully.

#### Scenario: Transaction fails
- **WHEN** settlement transaction fails on blockchain
- **THEN** system retries with exponential backoff
- **AND** logs failure reason
- **AND** notifies administrators if retries exhausted

#### Scenario: Out of gas
- **WHEN** settlement transaction runs out of gas
- **THEN** system resubmits with higher gas limit
- **AND** maintains pending settlement state

### Requirement: Settlement Queue

The system SHALL queue settlements for processing.

#### Scenario: Multiple games end simultaneously
- **WHEN** multiple games end at the same time
- **THEN** system queues settlements
- **AND** processes them sequentially
- **AND** provides status updates to waiting players

### Requirement: Settlement Status Display

The system SHALL display settlement status to players.

#### Scenario: Settlement in progress
- **WHEN** settlement is submitted but not confirmed
- **THEN** system displays "Processing settlement..."
- **AND** shows transaction hash for tracking

#### Scenario: Settlement completed
- **WHEN** settlement is confirmed
- **THEN** system displays "Settlement complete"
- **AND** shows updated balance

### Requirement: Commit-Reveal Pattern

The system SHALL use commit-reveal pattern for settlement to prevent front-running.

#### Scenario: Commit phase
- **WHEN** game ends
- **THEN** system submits hash of settlement data to contract
- **AND** waits for commit confirmation

#### Scenario: Reveal phase
- **WHEN** commit is confirmed
- **THEN** system waits for reveal delay (e.g., 3 blocks)
- **AND** submits full settlement data
- **AND** contract verifies data matches committed hash

### Requirement: Partial Settlement

The system SHALL support partial settlements for multi-winner games.

#### Scenario: Multiple winners
- **WHEN** game has multiple winners (e.g., split pot)
- **THEN** system calculates each winner's share
- **AND** distributes accordingly in single transaction
- **AND** applies rake to total winnings

### Requirement: Settlement Audit Trail

The system SHALL maintain an audit trail of all settlements.

#### Scenario: View settlement record
- **WHEN** user or admin views game history
- **THEN** system displays settlement details:
    - Game ID
    - Transaction hash
    - Winners and amounts
    - Rake collected
    - Timestamp
