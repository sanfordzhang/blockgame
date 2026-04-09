# Player Auto-Play Specification

## ADDED Requirements

### Requirement: Enable AI Auto-Play

The system SHALL allow players to enable AI auto-play for their seat.

#### Scenario: Player enables AI auto-play
- **WHEN** player sends CS_ENABLE_AI with selected AI level
- **THEN** system marks player seat with isAI=true
- **AND** system responds with SC_AI_ENABLED
- **AND** AI takes over on next turn

#### Scenario: AI level selection
- **WHEN** player enables AI auto-play
- **THEN** system accepts level parameter (easy/medium/hard/expert)
- **AND** defaults to "medium" if not specified

### Requirement: Disable AI Auto-Play

The system SHALL allow players to disable AI auto-play.

#### Scenario: Player disables AI auto-play
- **WHEN** player sends CS_DISABLE_AI
- **THEN** system sets isAI=false on player seat
- **AND** system responds with SC_AI_DISABLED
- **AND** player regains manual control

#### Scenario: Disable during AI turn
- **WHEN** player disables AI while AI is calculating
- **THEN** current AI decision is cancelled
- **AND** player must make manual decision or timeout

### Requirement: AI Decision Execution

The system SHALL execute AI decisions through existing game action system.

#### Scenario: AI executes fold action
- **WHEN** AI decides to fold
- **THEN** system calls existing seat.fold() method
- **AND** emits SC_TABLE_UPDATED with fold action

#### Scenario: AI executes raise action
- **WHEN** AI decides to raise
- **THEN** system validates raise amount
- **AND** calls existing seat.raise() method
- **AND** emits SC_TABLE_UPDATED with raise action

### Requirement: AI Notification

The system SHALL notify players when AI makes a decision.

#### Scenario: AI decision notification
- **WHEN** AI makes a decision
- **THEN** system emits SC_AI_DECISION event
- **AND** event contains action type and optional reasoning

### Requirement: Decision Suggestion

The system SHALL provide decision suggestions without executing them.

#### Scenario: Request decision suggestion
- **WHEN** player sends CS_GET_SUGGESTION
- **THEN** system returns SC_SUGGESTION with recommended action
- **AND** does NOT execute the action
- **AND** includes win probability and reasoning

#### Scenario: Suggestion during AI auto-play
- **WHEN** player requests suggestion while AI is enabled
- **THEN** system returns error (suggestions not available in AI mode)

### Requirement: AI Auto-Play Limits

The system SHALL enforce limits on AI auto-play usage.

#### Scenario: Maximum AI duration
- **WHEN** AI has been active for 30 consecutive minutes
- **THEN** system automatically disables AI
- **AND** notifies player that AI timed out

#### Scenario: AI in tournaments
- **WHEN** player tries to enable AI in tournament mode
- **THEN** system checks tournament configuration
- **AND** if AI not allowed, returns error

### Requirement: AI State Persistence

The system SHALL persist AI state across reconnections.

#### Scenario: Player reconnects with AI enabled
- **WHEN** player disconnects and reconnects
- **AND** AI was enabled before disconnect
- **THEN** AI remains enabled after reconnection
- **AND** AI state is restored from database

### Requirement: Manual Override

The system SHALL allow manual action to override AI during player's turn.

#### Scenario: Manual action during AI turn
- **WHEN** player sends manual action while AI is calculating
- **THEN** manual action takes priority
- **AND** AI calculation is cancelled

### Requirement: AI Statistics Tracking

The system SHALL track AI performance statistics.

#### Scenario: Record AI decision
- **WHEN** AI makes a decision
- **THEN** system logs action, confidence, and outcome
- **AND** updates player's AI statistics

#### Scenario: AI win rate calculation
- **WHEN** AI-controlled hand completes
- **THEN** system updates AI win rate for that player

### Requirement: Multiple AI Players

The system SHALL support multiple AI players at same table.

#### Scenario: Two AI players at table
- **WHEN** two different players have AI enabled
- **THEN** each AI makes independent decisions
- **AND** no interference between AI instances

### Requirement: AI Fallback Behavior

The system SHALL handle AI failure gracefully.

#### Scenario: AI service unavailable
- **WHEN** AI service fails to respond
- **THEN** system falls back to safe action (check if possible, else fold)
- **AND** logs error for investigation
