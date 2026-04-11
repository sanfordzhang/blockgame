#!/usr/bin/env python3
"""
RLCard Agent Wrapper
Provides a unified interface for different AI difficulty levels.

Usage:
    # CLI mode (called from Node.js)
    echo '{"hand":["Ah","Kd"],"board":[],"pot":100,"callAmount":0,"stack":1000}' | \
        python3 rlcard_agent.py get_action --difficulty hard

    # Python import
    from rlcard_agent import RLCardAgent
    agent = RLCardAgent(difficulty='hard')
    decision = agent.get_action(game_state)
"""

import os
import sys
import json
import random

import torch
import rlcard
from rlcard.agents import RandomAgent as RLCardRandomAgent

from game_converter import convert_game_state, convert_action_to_nodejs


class RuleBasedAgent:
    """Simple rule-based agent for medium difficulty.

    Strategy:
    - Pre-flop: play tight, only call/raise with strong hands
    - Post-flop: bet when strong, check/fold when weak
    """

    # Pre-flop hand strength tiers
    PREMIUM_HANDS = {'AA', 'KK', 'QQ', 'AKs', 'AKo'}
    STRONG_HANDS = {'JJ', 'TT', 'AQs', 'AQo', 'AJs', 'KQs'}
    PLAYABLE_HANDS = {'99', '88', '77', 'ATs', 'AJo', 'KJs', 'KQo', 'QJs'}

    def __init__(self):
        self.num_actions = 5

    def _hand_category(self, hand):
        """Classify hand into strength category."""
        if len(hand) < 2:
            return 'weak'
        r1, r2 = hand[0][:-1], hand[1][:-1]
        s1, s2 = hand[0][-1], hand[1][-1]
        suited = 's' if s1 == s2 else 'o'

        # Normalize: higher rank first
        rank_order = '23456789TJQKA'
        if rank_order.index(r1) < rank_order.index(r2):
            r1, r2 = r2, r1

        if r1 == r2:
            pair = r1 + r2
        else:
            pair = r1 + r2 + suited

        if pair in self.PREMIUM_HANDS:
            return 'premium'
        elif pair in self.STRONG_HANDS:
            return 'strong'
        elif pair in self.PLAYABLE_HANDS:
            return 'playable'
        return 'weak'

    def get_action(self, state):
        """Return action based on simple rules.

        Returns:
            int: action_id (0=fold, 1=check/call, 2=raise_half, 3=raise_pot, 4=all_in)
        """
        hand = state.get('hand', [])
        board = state.get('board', [])
        pot = state.get('pot', 0)
        call_amount = state.get('call_amount', 0)
        stack = state.get('stack', 0)
        category = self._hand_category(hand)

        is_preflop = len(board) == 0

        if is_preflop:
            if category == 'premium':
                return 3  # raise pot
            elif category == 'strong':
                return random.choice([1, 2])  # call or raise half
            elif category == 'playable':
                if call_amount == 0:
                    return 1  # check
                elif call_amount <= stack * 0.1:
                    return 1  # call small bets
                else:
                    return 0  # fold to big bets
            else:
                if call_amount == 0:
                    return 1  # check for free
                return 0  # fold
        else:
            # Post-flop: simplified logic
            if category in ('premium', 'strong'):
                return random.choice([2, 3])  # raise
            elif category == 'playable':
                if call_amount == 0:
                    return random.choice([1, 2])  # check or small raise
                return 1  # call
            else:
                if call_amount == 0:
                    # Occasional bluff (10% chance)
                    return 2 if random.random() < 0.1 else 1
                elif call_amount <= pot * 0.3:
                    return 1  # call small bets
                return 0  # fold to large bets

    def eval_step(self, state):
        return self.get_action(state), {}


class RLCardAgent:
    """Unified AI agent that supports multiple difficulty levels.

    Difficulty levels:
        easy:   RandomAgent — random actions
        medium: RuleBasedAgent — hand strength rules
        hard:   NFSPAgent — pre-trained NFSP model
        expert: NFSPAgent — deeply trained NFSP model (500万局+)
    """

    MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')

    def __init__(self, difficulty='medium'):
        self.difficulty = difficulty
        self.agent = None
        self._load_agent(difficulty)

    def _load_agent(self, difficulty):
        """Load the appropriate agent for the given difficulty."""
        if difficulty == 'easy':
            self.agent = _RandomAgentWrapper()

        elif difficulty == 'medium':
            self.agent = RuleBasedAgent()

        elif difficulty == 'hard':
            self.agent = self._load_nfsp_agent('nfsp_v1')

        elif difficulty == 'expert':
            # Try expert model first, fallback to hard
            self.agent = self._load_nfsp_agent('nfsp_expert')
            if self.agent is None:
                self.agent = self._load_nfsp_agent('nfsp_v1')

        if self.agent is None:
            # Ultimate fallback
            print(f"[AI] Warning: Could not load {difficulty} agent, using RuleBasedAgent",
                  file=sys.stderr)
            self.agent = RuleBasedAgent()

    def _load_nfsp_agent(self, model_name):
        """Load a pre-trained NFSP model."""
        model_path = os.path.join(self.MODEL_DIR, model_name, 'agent_0_checkpoint.pt')

        if not os.path.exists(model_path):
            print(f"[AI] Model not found: {model_path}", file=sys.stderr)
            return None

        try:
            from rlcard.agents import NFSPAgent
            checkpoint = torch.load(model_path, map_location='cpu', weights_only=False)
            agent = NFSPAgent.from_checkpoint(checkpoint)
            print(f"[AI] Loaded NFSP model: {model_name}", file=sys.stderr)
            return agent
        except Exception as e:
            print(f"[AI] Error loading model {model_name}: {e}", file=sys.stderr)
            return None

    def get_action(self, game_state):
        """Get AI decision for the given game state.

        Args:
            game_state: dict from Node.js (raw or pre-converted)

        Returns:
            dict with 'action', 'amount', 'confidence', 'reason'
        """
        state = convert_game_state(game_state)

        try:
            if hasattr(self.agent, 'get_action'):
                # Our custom agents (Random, RuleBased)
                action_id = self.agent.get_action(state)
            elif hasattr(self.agent, 'eval_step'):
                # NFSP/DQN agent — needs rlcard obs format
                # Build a minimal state dict that eval_step expects
                obs = self._build_rlcard_obs(state)
                if obs is not None:
                    action_id, _ = self.agent.eval_step(obs)
                else:
                    # Fallback to rule-based if we can't build obs
                    fallback = RuleBasedAgent()
                    action_id = fallback.get_action(state)
            else:
                action_id = 1  # default check/call
        except Exception as e:
            return _fallback_decision(state, str(e))

        result = convert_action_to_nodejs(action_id, state)
        result['confidence'] = _estimate_confidence(self.difficulty, state)
        result['reason'] = _generate_reason(result['action'], state, self.difficulty)

        return result

    def _build_rlcard_obs(self, state):
        """Build rlcard-compatible observation for NFSP eval_step.

        The NFSP agent expects a dict with 'obs' (numpy array) and
        'legal_actions' keys matching the rlcard environment format.
        """
        try:
            import numpy as np

            # no-limit-holdem state shape is [54]
            # Encoding: 52 card bits (hand+board) + pot ratio + stack ratio
            obs = np.zeros(54, dtype=np.float32)

            # Encode hand cards
            for card_str in state.get('hand', []):
                idx = self._card_to_index(card_str)
                if idx >= 0:
                    obs[idx] = 1

            # Encode board cards
            for card_str in state.get('board', []):
                idx = self._card_to_index(card_str)
                if idx >= 0:
                    obs[idx] = 1

            # Pot and stack ratios
            stack = max(state.get('stack', 1), 1)
            pot = state.get('pot', 0)
            obs[52] = min(pot / stack, 10.0) / 10.0
            obs[53] = 1.0  # normalized stack

            # Legal actions: all actions available (dict format for NFSP)
            call_amount = state.get('call_amount', 0)
            if call_amount == 0:
                # Can't fold when it's free to check
                legal_actions = {1: 0, 2: 1, 3: 2, 4: 3}
                raw_legal_actions = ['check', 'raise_half_pot', 'raise_pot', 'all_in']
            else:
                legal_actions = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4}
                raw_legal_actions = ['fold', 'call', 'raise_half_pot', 'raise_pot', 'all_in']

            return {
                'obs': obs,
                'legal_actions': legal_actions,
                'raw_legal_actions': raw_legal_actions,
            }
        except Exception:
            return None

    @staticmethod
    def _card_to_index(card_str):
        """Convert card string like 'AH' to 0-51 index."""
        if len(card_str) < 2:
            return -1
        rank_str = card_str[:-1]
        suit_str = card_str[-1].upper()
        ranks = '23456789TJQKA'
        suits = 'SHDC'
        r = ranks.find(rank_str)
        s = suits.find(suit_str)
        if r < 0 or s < 0:
            return -1
        return r * 4 + s


class _RandomAgentWrapper:
    """Wrapper to make RandomAgent compatible with our interface."""

    def __init__(self):
        self.num_actions = 5

    def get_action(self, state):
        # Weighted random: less likely to fold, more likely to check/call
        weights = [0.15, 0.40, 0.20, 0.15, 0.10]  # fold, check/call, raise_half, raise_pot, all_in
        return random.choices(range(5), weights=weights, k=1)[0]

    def eval_step(self, state):
        return self.get_action(state), {}


def _fallback_decision(state, error_msg=''):
    """Safe fallback decision when AI encounters errors."""
    call_amount = state.get('call_amount', 0)
    if call_amount == 0:
        return {
            'action': 'check',
            'amount': 0,
            'confidence': 0.0,
            'reason': f'Fallback: {error_msg}' if error_msg else 'Fallback decision',
        }
    return {
        'action': 'fold',
        'amount': 0,
        'confidence': 0.0,
        'reason': f'Fallback: {error_msg}' if error_msg else 'Fallback decision',
    }


def _estimate_confidence(difficulty, state):
    """Estimate confidence score based on difficulty and game state."""
    base = {'easy': 0.3, 'medium': 0.5, 'hard': 0.7, 'expert': 0.85}
    return base.get(difficulty, 0.5)


def _generate_reason(action, state, difficulty):
    """Generate human-readable reason for the decision."""
    reasons = {
        'fold': 'Weak hand, folding to save chips',
        'check': 'Checking to see more cards',
        'call': 'Calling to stay in the hand',
        'raise': 'Raising with a strong position',
    }
    return reasons.get(action, 'AI decision')


# ─── CLI Interface (called from Node.js via subprocess) ───────────────────

def main():
    """CLI entry point for Node.js subprocess calls."""
    import argparse

    parser = argparse.ArgumentParser(description='Poker AI Decision Engine')
    parser.add_argument('command', choices=['get_action', 'init'],
                        help='Command to execute')
    parser.add_argument('--difficulty', type=str, default='medium',
                        choices=['easy', 'medium', 'hard', 'expert'],
                        help='AI difficulty level')

    args = parser.parse_args()

    if args.command == 'init':
        # Verify agent can be loaded
        agent = RLCardAgent(difficulty=args.difficulty)
        result = {
            'status': 'ok',
            'difficulty': args.difficulty,
            'agent_type': type(agent.agent).__name__,
        }
        print(json.dumps(result))
        return

    elif args.command == 'get_action':
        # Read game state from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            print(json.dumps(_fallback_decision({}, 'No input')))
            return

        try:
            game_state = json.loads(input_data)
        except json.JSONDecodeError as e:
            print(json.dumps(_fallback_decision({}, f'Invalid JSON: {e}')))
            return

        # Get difficulty from input or args
        difficulty = game_state.pop('difficulty', args.difficulty)

        agent = RLCardAgent(difficulty=difficulty)
        decision = agent.get_action(game_state)
        print(json.dumps(decision))


if __name__ == '__main__':
    main()
