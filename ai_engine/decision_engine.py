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


def worker_loop():
    """Persistent worker mode for Node.js stdin/stdout RPC."""
    engine = DecisionEngine()

    # Preload NFSP model to avoid timeout on first request
    print(json.dumps({"status": "loading", "message": "Preloading NFSP model..."}), flush=True)
    try:
        engine._get_agent('hard')
        print(json.dumps({"status": "ready", "pid": os.getpid(), "preloaded": "hard"}), flush=True)
    except Exception as e:
        print(json.dumps({"status": "ready", "pid": os.getpid(), "preload_error": str(e)}), flush=True)

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id = None
        try:
            payload = json.loads(line)
            request_id = payload.get('request_id')
            command = payload.get('command')

            if command == 'ping':
                print(json.dumps({"status": "pong", "request_id": request_id}), flush=True)
                continue

            if command == 'shutdown':
                print(json.dumps({"status": "shutdown", "request_id": request_id}), flush=True)
                break

            difficulty = payload.pop('difficulty', 'medium')
            timeout = payload.pop('timeout_ms', 100)
            payload.pop('request_id', None)
            payload.pop('command', None)

            decision = engine.decide(payload, difficulty=difficulty, timeout_ms=timeout)
            decision['request_id'] = request_id
            print(json.dumps(decision), flush=True)
        except json.JSONDecodeError as e:
            error_result = {
                **_fallback_decision({}, f'Invalid JSON: {e}'),
                'request_id': request_id,
                'error': f'Invalid JSON: {e}'
            }
            print(json.dumps(error_result), flush=True)
        except Exception as e:
            error_result = {
                **_fallback_decision({}, str(e)),
                'request_id': request_id,
                'error': str(e)
            }
            print(json.dumps(error_result), flush=True)


def main():
    """CLI entry point — reads JSON from stdin, outputs decision as JSON."""
    if len(sys.argv) > 1 and sys.argv[1] == '--worker':
        worker_loop()
        return

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
