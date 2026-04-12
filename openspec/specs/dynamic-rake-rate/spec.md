# Spec: Dynamic Rake Rate

## ADDED Requirements

### Requirement: Adjustable Rake Rate

The system SHALL allow administrators to adjust the rake rate within defined bounds.

#### Scenario: Administrator adjusts rake rate
- **WHEN** administrator sets new rake rate
- **AND** new rate is within allowed range (1%-10%)
- **THEN** system schedules rate change
- **AND** applies change after time lock expires

#### Scenario: Rate below minimum
- **WHEN** administrator sets rate below 1%
- **THEN** system rejects change
- **AND** displays error "Minimum rake rate is 1%"

#### Scenario: Rate above maximum
- **WHEN** administrator sets rate above 10%
- **THEN** system rejects change
- **AND** displays error "Maximum rake rate is 10%"

### Requirement: Rake Rate Time Lock

The system SHALL enforce a time lock before rake rate changes take effect.

#### Scenario: Time lock notification
- **WHEN** administrator initiates rake rate change
- **THEN** system displays pending change with effective time (24 hours later)
- **AND** notifies all active players

#### Scenario: Cancel pending change
- **WHEN** administrator cancels a pending rate change
- **AND** cancellation is before effective time
- **THEN** system removes pending change
- **AND** current rate remains unchanged

#### Scenario: Automatic application after time lock
- **WHEN** time lock period expires
- **THEN** system automatically applies new rate
- **AND** logs the change in audit trail

### Requirement: Rake Rate Change Frequency Limit

The system SHALL limit how often the rake rate can be changed.

#### Scenario: Frequency limit enforced
- **WHEN** administrator attempts to change rate
- **AND** a change was made within last 24 hours
- **THEN** system rejects change
- **AND** displays when next change is allowed

### Requirement: Single Change Amplitude Limit

The system SHALL limit the maximum change per adjustment.

#### Scenario: Amplitude within limit
- **WHEN** administrator changes rate from 2.5% to 4%
- **AND** change is within ±2% limit
- **THEN** system accepts the change

#### Scenario: Amplitude exceeds limit
- **WHEN** administrator attempts to change rate from 2.5% to 6%
- **AND** change exceeds ±2% limit
- **THEN** system rejects change
- **AND** suggests incremental changes

### Requirement: Display Current Rake Rate

The system SHALL display the current rake rate to users.

#### Scenario: Show current rate
- **WHEN** user views game info
- **THEN** system displays current rake rate as percentage

#### Scenario: Show pending rate change
- **WHEN** user views game info
- **AND** a rate change is pending
- **THEN** system displays current rate and pending rate with effective date

### Requirement: Rake Rate Audit Trail

The system SHALL maintain an audit trail of all rake rate changes.

#### Scenario: View change history
- **WHEN** administrator views rake rate history
- **THEN** system displays all past changes with:
  - Timestamp
  - Old rate
  - New rate
  - Administrator who made the change

### Requirement: Rake Rate Used in Settlement

The system SHALL use the effective rake rate at settlement time.

#### Scenario: Rate change during game
- **WHEN** game starts with rate A
- **AND** rate changes to B during game
- **THEN** settlement uses rate A (rate at game start)

#### Scenario: Pending rate during settlement
- **WHEN** settlement occurs
- **AND** a rate change is pending but not yet effective
- **THEN** settlement uses current (not pending) rate
