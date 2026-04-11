#!/usr/bin/env python3
"""
Decision Engine - Main entry point for AI decisions.

Wraps RLCardAgent with caching, timeout handling, and structured output.
Can be used as a CLI tool or imported as a Python module.

Usage (CLI, from Node.js):
    echo '{"hand":["Ah","Kd"],...,"difficulty":"hard"}' | python3 decision_engine.py

Usage (Python):
    from decision_engine import DecisionEngine
    engine = DecisionEngine()
    result = engine.decide(game_state, difficulty='hard')
"""

import sys
import os
import json
import time

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rlcard_agent import RLCardAgent, _fallback_decision
from game_converter import convert_game_state


class DecisionEngine:
    """High-level decision engine with agent caching and error handling."""

    def __init__(self):
        self._agents = {}  # Cache agents by difficulty

    def _get_agent(self, difficulty):
        """Get or create an agent for the given difficulty (cached)."""
        if difficulty not in self._agents:
            self._agents[difficulty] = RLCardAgent(difficulty=difficulty)
        return self._agents[difficulty]

    def decide(self, game_state, difficulty='medium', timeout_ms=100):
        """Make an AI decision for the given game state.

        Args:
            game_state: dict with hand, board, pot, callAmount, stack, etc.
            difficulty: 'easy', 'medium', 'hard', 'expert'
            timeout_ms: maximum decision time in milliseconds

        Returns:
            dict with action, amount, confidence, reason, decision_time_ms
        """
        start = time.time()

        try:
            agent = self._get_agent(difficulty)
            decision = agent.get_action(game_state)
        except Exception as e:
            state = convert_game_state(game_state) if isinstance(game_state, dict) else {}
            decision = _fallback_decision(state, str(e))

        elapsed_ms = (time.time() - start) * 1000
        decision['decision_time_ms'] = round(elapsed_ms, 1)
        decision['difficulty'] = difficulty

        return decision


def main():
    """CLI entry point — reads JSON from stdin, outputs decision as JSON."""
    input_data = sys.stdin.read().strip()

    if not input_data:
        print(json.dumps(_fallback_decision({}, 'No input')))
        return

    try:
        game_state = json.loads(input_data)
    except json.JSONDecodeError as e:
        print(json.dumps(_fallback_decision({}, f'Invalid JSON: {e}')))
        return

    difficulty = game_state.pop('difficulty', 'medium')
    timeout = game_state.pop('timeout_ms', 100)

    engine = DecisionEngine()
    decision = engine.decide(game_state, difficulty=difficulty, timeout_ms=timeout)

    print(json.dumps(decision))


if __name__ == '__main__':
    main()
