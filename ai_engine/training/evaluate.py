#!/usr/bin/env python3
"""
Model Evaluation Script
Evaluates trained models against various opponents
"""

import argparse
import os
import sys
import json
import time
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import rlcard
from rlcard.agents import CFRAgent, RandomAgent
from rlcard.utils import set_seed


class RuleBasedAgent:
    """Simple rule-based agent for comparison"""
    
    def __init__(self, num_actions=6):
        self.num_actions = num_actions
        self.action_map = {0: 'fold', 1: 'check', 2: 'call', 3: 'raise', 4: 'raise', 5: 'raise'}
    
    def step(self, state):
        """Simple heuristic strategy"""
        # Get current state info
        raw_legal_actions = state.get('raw_legal_actions', ['check', 'call'])
        
        # Simple rules:
        # - If can check, check
        # - If can call, call
        # - Otherwise random
        
        if 'check' in raw_legal_actions:
            action_idx = 1  # check
        elif 'call' in raw_legal_actions:
            action_idx = 2  # call
        elif 'fold' in raw_legal_actions:
            action_idx = 0  # fold
        else:
            action_idx = 1  # default check
        
        # Find matching action index
        legal_actions = state.get('legal_actions', [1])
        if action_idx not in legal_actions:
            action_idx = legal_actions[0] if legal_actions else 0
        
        return action_idx
    
    def eval_step(self, state):
        return self.step(state), {}


def load_cfr_agent(model_path, env):
    """Load CFR agent from saved model"""
    agent = CFRAgent(env, model_path=model_path)
    agent.load()
    return agent


def play_match(agent1, agent2, env, num_games=1000, verbose=False):
    """Play matches between two agents"""
    
    wins = {'agent1': 0, 'agent2': 0, 'ties': 0}
    total_rewards = {'agent1': 0, 'agent2': 0}
    
    for game in range(num_games):
        state, _ = env.reset()
        
        # Reset agents if they have state
        if hasattr(agent1, 'reset'):
            agent1.reset()
        if hasattr(agent2, 'reset'):
            agent2.reset()
        
        # Play game
        while not env.is_over():
            current_player = env.get_player_id()
            
            if current_player == 0:
                if hasattr(agent1, 'eval_step'):
                    action, _ = agent1.eval_step(state)
                else:
                    action = agent1.step(state)
            else:
                if hasattr(agent2, 'eval_step'):
                    action, _ = agent2.eval_step(state)
                else:
                    action = agent2.step(state)
            
            state, _ = env.step(action)
        
        # Get results
        winner = env.get_winner()
        payoffs = env.get_payoffs()
        
        if winner == 0:
            wins['agent1'] += 1
        elif winner == 1:
            wins['agent2'] += 1
        else:
            wins['ties'] += 1
        
        total_rewards['agent1'] += payoffs[0]
        total_rewards['agent2'] += payoffs[1]
        
        if verbose and game % 100 == 0:
            print(f"Game {game}/{num_games} complete")
    
    return wins, total_rewards


def evaluate_model(model_path, num_games=1000, verbose=True, seed=42):
    """Comprehensive model evaluation"""
    
    print("=" * 70)
    print("MODEL EVALUATION REPORT")
    print("=" * 70)
    print(f"Model path: {model_path}")
    print(f"Games per opponent: {num_games}")
    print(f"Seed: {seed}")
    print("=" * 70)
    
    set_seed(seed)
    
    # Create environment
    env = rlcard.make('no-limit-holdem', config={'allow_step_back': True})
    
    # Load model
    print("\n[1/4] Loading CFR model...")
    try:
        cfr_agent = load_cfr_agent(model_path, env)
        print("      Model loaded successfully!")
    except Exception as e:
        print(f"      Error loading model: {e}")
        return None
    
    # Create opponents
    print("\n[2/4] Preparing opponents...")
    random_agent = RandomAgent(num_actions=env.num_actions)
    rule_agent = RuleBasedAgent(num_actions=env.num_actions)
    print("      - RandomAgent (easy)")
    print("      - RuleBasedAgent (medium)")
    
    results = {}
    
    # Test vs Random
    print("\n[3/4] Evaluating against RandomAgent...")
    start_time = time.time()
    wins, rewards = play_match(cfr_agent, random_agent, env, num_games)
    elapsed = time.time() - start_time
    
    results['vs_random'] = {
        'wins': wins['agent1'],
        'losses': wins['agent2'],
        'ties': wins['ties'],
        'win_rate': wins['agent1'] / num_games,
        'avg_reward': rewards['agent1'] / num_games,
        'time': elapsed
    }
    
    print(f"      Win rate: {results['vs_random']['win_rate']:.1%}")
    print(f"      Wins: {wins['agent1']} | Losses: {wins['agent2']} | Ties: {wins['ties']}")
    print(f"      Avg reward: {results['vs_random']['avg_reward']:.2f}")
    print(f"      Time: {elapsed:.1f}s")
    
    # Test vs RuleBased
    print("\n[4/4] Evaluating against RuleBasedAgent...")
    start_time = time.time()
    wins, rewards = play_match(cfr_agent, rule_agent, env, num_games)
    elapsed = time.time() - start_time
    
    results['vs_rule'] = {
        'wins': wins['agent1'],
        'losses': wins['agent2'],
        'ties': wins['ties'],
        'win_rate': wins['agent1'] / num_games,
        'avg_reward': rewards['agent1'] / num_games,
        'time': elapsed
    }
    
    print(f"      Win rate: {results['vs_rule']['win_rate']:.1%}")
    print(f"      Wins: {wins['agent1']} | Losses: {wins['agent2']} | Ties: {wins['ties']}")
    print(f"      Avg reward: {results['vs_rule']['avg_reward']:.2f}")
    print(f"      Time: {elapsed:.1f}s")
    
    # Generate report
    print("\n" + "=" * 70)
    print("EVALUATION SUMMARY")
    print("=" * 70)
    print(f"\n{'Opponent':<20} {'Win Rate':<15} {'Avg Reward':<15} {'Result'}")
    print("-" * 70)
    
    for opponent, data in results.items():
        if data['win_rate'] >= 0.6:
            grade = "PASS ✓"
        elif data['win_rate'] >= 0.5:
            grade = "MARGINAL ~"
        else:
            grade = "FAIL ✗"
        
        print(f"{opponent:<20} {data['win_rate']:>10.1%}    {data['avg_reward']:>10.2f}    {grade}")
    
    print("-" * 70)
    
    # Overall assessment
    avg_win_rate = (results['vs_random']['win_rate'] + results['vs_rule']['win_rate']) / 2
    overall_grade = "EXCELLENT" if avg_win_rate >= 0.7 else \
                    "GOOD" if avg_win_rate >= 0.6 else \
                    "FAIR" if avg_win_rate >= 0.5 else "NEEDS IMPROVEMENT"
    
    print(f"\nOverall Win Rate: {avg_win_rate:.1%}")
    print(f"Overall Grade: {overall_grade}")
    
    # Save results
    report_path = os.path.join(model_path, 'evaluation_report.json')
    with open(report_path, 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'num_games': num_games,
            'seed': seed,
            'results': results,
            'overall_win_rate': avg_win_rate,
            'overall_grade': overall_grade
        }, f, indent=2)
    
    print(f"\nReport saved to: {report_path}")
    print("=" * 70)
    
    return results


def main():
    parser = argparse.ArgumentParser(description='Evaluate trained poker AI models')
    parser.add_argument('--model', type=str, default='./models/cfr_v1',
                        help='Path to the trained model (default: ./models/cfr_v1)')
    parser.add_argument('--games', type=int, default=1000,
                        help='Number of games per opponent (default: 1000)')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed (default: 42)')
    parser.add_argument('--verbose', action='store_true',
                        help='Enable verbose output')
    
    args = parser.parse_args()
    
    # Get absolute path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ai_engine_dir = os.path.dirname(script_dir)
    model_path = os.path.join(ai_engine_dir, args.model.lstrip('./'))
    
    evaluate_model(model_path, args.games, args.verbose, args.seed)


if __name__ == '__main__':
    main()
