#!/bin/bash
# Setup script for Poker AI Engine
set -e

echo "=== Poker AI Engine Setup ==="

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found. Please install Python 3.8+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python: $PYTHON_VERSION"

# Create virtual environment (optional)
AI_DIR="$(cd "$(dirname "$0")/.." && pwd)/ai_engine"
echo "AI Engine dir: $AI_DIR"

if [ "$1" = "--venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$AI_DIR/.venv"
    source "$AI_DIR/.venv/bin/activate"
    echo "Virtual environment activated"
fi

# Install dependencies
echo "Installing dependencies..."
pip install -r "$AI_DIR/requirements.txt"

# Verify installation
echo ""
echo "Verifying installation..."
python3 -c "import rlcard; print(f'rlcard: {rlcard.__version__}')" 2>/dev/null || echo "WARNING: rlcard import failed"
python3 -c "import torch; print(f'torch: {torch.__version__}')" 2>/dev/null || echo "WARNING: torch import failed"

# Test agent
echo ""
echo "Testing AI agent..."
cd "$AI_DIR"
python3 rlcard_agent.py init --difficulty medium 2>/dev/null

# Check for pre-trained models
if [ -f "$AI_DIR/models/nfsp_v1/agent_0_checkpoint.pt" ]; then
    echo "Pre-trained NFSP model found"
else
    echo "WARNING: No pre-trained model found at models/nfsp_v1/"
    echo "Train one with: python3 training/train_nfsp.py --episodes 100000"
fi

echo ""
echo "=== Setup Complete ==="
