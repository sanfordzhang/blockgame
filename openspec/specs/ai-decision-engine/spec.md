# AI Decision Engine Specification

## ADDED Requirements

### Requirement: Hand Strength Evaluation

The system SHALL evaluate hand strength at any game stage (pre-flop, flop, turn, river).

#### Scenario: Pre-flop hand evaluation
- **WHEN** AI receives starting hand cards
- **THEN** system returns hand strength score (0-100) based on starting hand chart

#### Scenario: Post-flop hand evaluation
- **WHEN** AI has hole cards and community cards are dealt
- **THEN** system evaluates hand strength considering all possible opponent hands

### Requirement: Win Probability Calculation

The system SHALL calculate win probability using Monte Carlo simulation.

#### Scenario: Win probability with known opponent count
- **WHEN** AI requests win probability calculation
- **THEN** system runs Monte Carlo simulation and returns probability percentage
- **AND** simulation runs at least 1000 iterations for accuracy

#### Scenario: Win probability calculation timeout
- **WHEN** simulation exceeds 50ms
- **THEN** system returns cached or estimated probability

### Requirement: Pot Odds Calculation

The system SHALL calculate pot odds for decision making.

#### Scenario: Calculate pot odds
- **WHEN** AI needs to decide between call and fold
- **THEN** system returns pot odds ratio (pot size / call amount)
- **AND** compares with win probability to determine +EV decisions

### Requirement: Position-Aware Strategy

The system SHALL adjust strategy based on table position.

#### Scenario: Early position strategy
- **WHEN** AI is in UTG (Under The Gun) position
- **THEN** system recommends tighter play with fewer starting hands

#### Scenario: Late position strategy
- **WHEN** AI is on Button or Cutoff position
- **THEN** system allows wider starting hand range

### Requirement: Betting History Analysis

The system SHALL analyze opponent betting patterns.

#### Scenario: Detect aggressive opponent
- **WHEN** opponent has raised 3+ times in last 10 hands
- **THEN** system flags opponent as aggressive and adjusts calling range

#### Scenario: Detect passive opponent
- **WHEN** opponent has only called or folded in last 10 hands
- **THEN** system flags opponent as passive and may bluff more

### Requirement: Decision Output Format

The system SHALL return standardized decision output.

#### Scenario: Decision with all required fields
- **WHEN** AI makes a decision
- **THEN** output contains action (fold/check/call/raise)
- **AND** output contains amount (for raise actions)
- **AND** output contains confidence score (0-1)
- **AND** output contains win probability estimate

### Requirement: Decision Response Time

The system SHALL respond within performance limits.

#### Scenario: Decision within time limit
- **WHEN** AI is requested to make decision
- **THEN** system returns decision within 100ms
- **AND** if calculation exceeds limit, returns safe default action

### Requirement: Multi-Level Strategy Support

The system SHALL support multiple difficulty levels.

#### Scenario: Easy level decision
- **WHEN** AI level is set to "easy"
- **THEN** system uses basic hand strength only, no advanced calculations

#### Scenario: Expert level decision
- **WHEN** AI level is set to "expert"
- **THEN** system uses GTO-based strategy with opponent modeling

### Requirement: Outs Calculation

The system SHALL calculate outs for drawing hands.

#### Scenario: Flush draw outs
- **WHEN** AI has 4 cards of same suit on flop
- **THEN** system calculates 9 outs for flush completion

#### Scenario: Straight draw outs
- **WHEN** AI has open-ended straight draw
- **THEN** system calculates 8 outs for straight completion

### Requirement: Implied Odds Consideration

The system SHALL consider implied odds for drawing decisions.

#### Scenario: Deep stack implied odds
- **WHEN** AI and opponent both have 100+ BB stacks
- **THEN** system adds implied odds to pot odds calculation
