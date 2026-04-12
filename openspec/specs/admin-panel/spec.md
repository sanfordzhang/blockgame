# Spec: Admin Panel

## ADDED Requirements

### Requirement: Admin Authentication

The system SHALL restrict admin panel access to authorized administrators.

#### Scenario: Admin login
- **WHEN** administrator provides valid credentials
- **THEN** system grants access to admin panel
- **AND** logs admin login event

#### Scenario: Unauthorized access
- **WHEN** non-admin user attempts to access admin panel
- **THEN** system denies access
- **AND** redirects to home page

### Requirement: Adjust Rake Rate

The system SHALL allow administrators to adjust the rake rate via admin panel.

#### Scenario: View current rake rate
- **WHEN** administrator opens rake rate settings
- **THEN** system displays current rate, pending changes (if any), and change history

#### Scenario: Initiate rate change
- **WHEN** administrator submits new rake rate
- **AND** rate is within bounds and frequency limits
- **THEN** system schedules change with time lock
- **AND** displays pending change with effective date

### Requirement: Withdraw Accumulated Rake

The system SHALL allow administrators to withdraw accumulated rake from the contract.

#### Scenario: View accumulated rake
- **WHEN** administrator views rake management page
- **THEN** system displays total accumulated rake in contract

#### Scenario: Withdraw rake
- **WHEN** administrator initiates rake withdrawal
- **THEN** system creates transaction to transfer rake to admin wallet
- **AND** requires admin signature
- **AND** logs withdrawal in audit trail

#### Scenario: Withdrawal limits
- **WHEN** administrator attempts large withdrawal
- **AND** amount exceeds daily limit
- **THEN** system requires additional confirmation
- **OR** splits withdrawal across multiple days

### Requirement: Emergency Pause

The system SHALL allow administrators to pause the game contract.

#### Scenario: Pause contract
- **WHEN** administrator clicks "Emergency Pause"
- **THEN** system calls contract pause function
- **AND** all game operations stop immediately
- **AND** deposits and new games are blocked

#### Scenario: Resume contract
- **WHEN** administrator clicks "Resume"
- **THEN** system calls contract unpause function
- **AND** normal operations resume

#### Scenario: Pause status indicator
- **WHEN** contract is paused
- **THEN** admin panel displays prominent "PAUSED" status
- **AND** frontend displays maintenance message to users

### Requirement: View Operational Statistics

The system SHALL display operational statistics to administrators.

#### Scenario: View dashboard
- **WHEN** administrator views admin dashboard
- **THEN** system displays:
    - Total players count
    - Active players count
    - Total TRX deposited (contract balance)
    - Total volume (lifetime)
    - Total rake collected (lifetime)
    - Games played today

#### Scenario: Filter statistics by time period
- **WHEN** administrator selects time period
- **THEN** system displays statistics for selected period

### Requirement: View Recent Transactions

The system SHALL display recent blockchain transactions.

#### Scenario: View transaction list
- **WHEN** administrator views transactions page
- **THEN** system displays recent transactions with:
    - Transaction hash
    - Type (deposit/withdraw/settlement)
    - Player address
    - Amount
    - Timestamp
    - Status

### Requirement: Audit Log

The system SHALL maintain an audit log of all admin actions.

#### Scenario: View audit log
- **WHEN** administrator views audit log
- **THEN** system displays all admin actions with:
    - Timestamp
    - Action type
    - Administrator address
    - Details/parameters

### Requirement: Admin Action Notifications

The system SHALL notify relevant parties of sensitive admin actions.

#### Scenario: Rake rate change notification
- **WHEN** administrator initiates rake rate change
- **THEN** system sends notification to all active players
- **AND** logs to admin channel (if configured)

#### Scenario: Pause notification
- **WHEN** administrator pauses contract
- **THEN** system sends immediate notification to all online users
- **AND** logs critical event

### Requirement: Multiple Administrator Support

The system SHALL support multiple administrators with individual access.

#### Scenario: List administrators
- **WHEN** super admin views admin management page
- **THEN** system displays all administrators with their roles

#### Scenario: Add administrator
- **WHEN** super admin adds new administrator
- **AND** provides wallet address
- **THEN** system grants admin privileges to that address
