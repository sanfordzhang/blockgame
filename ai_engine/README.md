# Poker AI Engine

AI decision engine for the No-Limit Texas Hold'em game, powered by RLCard and NFSP.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Test the engine
echo '{"hand":["Ah","Kd"],"board":[],"pot":100,"callAmount":0,"stack":1000,"difficulty":"medium"}' | python3 decision_engine.py
```

## Difficulty Levels

| Level | Agent | Description |
|-------|-------|-------------|
| easy | RandomAgent | Weighted random actions |
| medium | RuleBasedAgent | Hand strength rules, position awareness |
| hard | NFSPAgent | Pre-trained NFSP neural network |
| expert | NFSPAgent | Deeply trained NFSP (500万局+) |

## Architecture

```
ai_engine/
├── decision_engine.py    # Main entry point (CLI)
├── rlcard_agent.py       # Agent wrapper for all difficulties
├── game_converter.py     # Node.js ↔ RLCard state conversion
├── models/               # Pre-trained models
│   └── nfsp_v1/          # NFSP model checkpoint
├── training/             # Training scripts
│   ├── train_nfsp.py     # NFSP training (local)
│   ├── train_nfsp_colab.ipynb  # Colab GPU training
│   ├── train_cfr.py      # CFR training (backup)
│   ├── evaluate.py       # Model evaluation
│   └── test_speed.py     # Speed benchmarks
└── requirements.txt
```

## Training

### Quick Training (CPU, ~15 min)
```bash
python3 training/train_nfsp.py --episodes 100000
```

### Standard Training (Colab GPU, ~1.5 hours)
1. Upload `training/train_nfsp_colab.ipynb` to Google Colab
2. Select GPU runtime (T4)
3. Run all cells
4. Download `nfsp_model.zip`
5. Extract to `models/nfsp_v1/`

### Training Progress Monitoring
```bash
# In another terminal
cat models/nfsp_v1/training_progress.json | python3 -m json.tool
```

## API

### CLI (called from Node.js)
```bash
# Get AI decision
echo '<game_state_json>' | python3 decision_engine.py

# Initialize agent
python3 rlcard_agent.py init --difficulty hard
```

### Input Format
```json
{
  "hand": ["Ah", "Kd"],
  "board": ["Qs", "Jc", "Th"],
  "pot": 500,
  "callAmount": 100,
  "minRaise": 200,
  "stack": 1000,
  "numPlayers": 2,
  "difficulty": "hard"
}
```

### Output Format
```json
{
  "action": "raise",
  "amount": 300,
  "confidence": 0.85,
  "reason": "Raising with a strong position",
  "decision_time_ms": 12.5,
  "difficulty": "hard"
}
```

## Card Format

Both string and object formats are supported:
- String: `"Ah"`, `"Kd"`, `"10h"`
- Object: `{"rank": "A", "suit": "hearts"}`
