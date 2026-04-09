#!/usr/bin/env python3
"""
NFSP (Neural Fictitious Self-Play) Training Script
Trains a NFSP model for No-Limit Texas Hold'em

=== 与 CFR 对比 ===
  CFR:  遍历完整博弈树, 纯CPU, 极慢, 但理论保证收敛到纳什均衡
  NFSP: 通过自我对弈采样学习, GPU加速, 快速, 近似纳什均衡

=== 训练速度参考 ===
  设备              | 10万局  | 100万局 | 效果
  ------------------|---------|---------|------
  MacBook CPU       | ~30分钟 | ~5小时  | 业余玩家级
  Colab T4 GPU      | ~10分钟 | ~1.5小时| 业余玩家级
  Colab A100 GPU    | ~5分钟  | ~40分钟 | 业余玩家级

=== 推荐训练量 ===
  快速验证:  10万局 (几十分钟)
  标准训练:  100万局 (几小时, 推荐)
  深度训练:  500万局 (半天, 效果更好)
"""

import argparse
import os
import sys
import time
import json
import signal
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import logging
import io
# Suppress rlcard's verbose step-level logging
logging.basicConfig(level=logging.WARNING)

import rlcard
from rlcard.agents import NFSPAgent, RandomAgent, DQNAgent
from rlcard.utils import set_seed, reorganize, tournament


def _quiet_feed(agent, ts):
    """Feed transition to agent while suppressing rlcard's print() spam"""
    old_stdout = sys.stdout
    sys.stdout = io.StringIO()
    try:
        agent.feed(ts)
    finally:
        sys.stdout = old_stdout

# Graceful shutdown
_shutdown_requested = False


def _signal_handler(signum, frame):
    global _shutdown_requested
    if _shutdown_requested:
        print("\n\n强制退出!", flush=True)
        sys.exit(1)
    _shutdown_requested = True
    print("\n\n收到中断信号，将在当前episode完成后保存检查点并退出...", flush=True)


def format_duration(seconds):
    if seconds < 60:
        return f"{seconds:.0f}s"
    elif seconds < 3600:
        m, s = divmod(seconds, 60)
        return f"{int(m)}m{int(s)}s"
    else:
        h, remainder = divmod(seconds, 3600)
        m, s = divmod(remainder, 60)
        return f"{int(h)}h{int(m)}m{int(s)}s"


def progress_bar(progress, width=30):
    filled = int(width * progress)
    bar = '█' * filled + '░' * (width - filled)
    return f"[{bar}]"


def train_nfsp(
    num_episodes=1000000,
    save_path='./models/nfsp_v1',
    seed=42,
    game='no-limit-holdem',
    eval_every=10000,
    eval_games=1000,
    save_every=50000,
    hidden_layers=None,
    q_layers=None,
    anticipatory_param=0.1,
    rl_lr=0.01,
    sl_lr=0.005,
    reservoir_size=2000000,
    batch_size=256,
):
    """Train NFSP model for Hold'em via self-play"""
    global _shutdown_requested

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    if hidden_layers is None:
        hidden_layers = [512, 512]
    if q_layers is None:
        q_layers = [512, 512]

    print("=" * 65)
    print("NFSP Training for Texas Hold'em")
    print("=" * 65)
    print(f"  游戏类型:       {game}")
    print(f"  训练局数:       {num_episodes:,}")
    print(f"  设备:           {device} {'(GPU加速)' if device.type == 'cuda' else '(CPU)'}")
    if device.type == 'cuda':
        print(f"  GPU:            {torch.cuda.get_device_name(0)}")
    print(f"  SL网络:         {hidden_layers}")
    print(f"  Q网络:          {q_layers}")
    print(f"  anticipatory:   {anticipatory_param}")
    print(f"  保存路径:       {save_path}")
    print(f"  评估间隔:       每 {eval_every:,} 局")
    print(f"  保存间隔:       每 {save_every:,} 局")
    print("=" * 65)

    # Setup
    set_seed(seed)
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # Create environment (no need for allow_step_back!)
    print("\n[1/3] 创建游戏环境...", flush=True)
    env = rlcard.make(game, config={'seed': seed})
    eval_env = rlcard.make(game, config={'seed': seed + 1})
    print(f"      动作数: {env.num_actions}")
    print(f"      状态维度: {env.state_shape}")

    # Create NFSP agents (self-play: both players use NFSP)
    print("\n[2/3] 初始化 NFSP Agents...", flush=True)
    agents = []
    for i in range(env.num_players):
        agent = NFSPAgent(
            num_actions=env.num_actions,
            state_shape=env.state_shape[i],
            hidden_layers_sizes=hidden_layers,
            q_mlp_layers=q_layers,
            anticipatory_param=anticipatory_param,
            rl_learning_rate=rl_lr,
            sl_learning_rate=sl_lr,
            reservoir_buffer_capacity=reservoir_size,
            batch_size=batch_size,
            device=device,
            evaluate_with='average_policy',
        )
        agents.append(agent)
    env.set_agents(agents)
    eval_env.set_agents(agents)
    print(f"      创建了 {len(agents)} 个 NFSP agent (自我对弈)")

    # Prepare save directory
    os.makedirs(save_path, exist_ok=True)
    progress_path = os.path.join(save_path, 'training_progress.json')

    # Metrics
    metrics = {
        'episodes': [],
        'win_rates_vs_random': [],
        'win_rates_vs_self': [],
        'times': [],
    }

    # Speed benchmark
    print("\n[3/3] 开始训练...", flush=True)
    print("-" * 65, flush=True)

    start_time = time.time()
    last_log_time = start_time
    episodes_since_log = 0

    for episode in range(1, num_episodes + 1):
        if _shutdown_requested:
            print(f"\n中断: 在第 {episode:,} 局保存检查点...", flush=True)
            break

        # Sample episode policy for each agent
        for agent in agents:
            agent.sample_episode_policy()

        # Run one episode of self-play
        trajectories, payoffs = env.run(is_training=True)

        # Reorganize trajectories and feed to agents
        trajectories = reorganize(trajectories, payoffs)
        for i, agent in enumerate(agents):
            for ts in trajectories[i]:
                _quiet_feed(agent, ts)

        episodes_since_log += 1

        # Progress display (every 1000 episodes or every 5 seconds)
        now = time.time()
        if episode % 1000 == 0 or now - last_log_time > 5:
            elapsed = now - start_time
            speed = episode / elapsed
            progress = episode / num_episodes
            eta = (num_episodes - episode) / max(speed, 0.01)
            pct = progress * 100

            print(f"\r{progress_bar(progress)} {pct:>5.1f}% | "
                  f"局 {episode:>{len(str(num_episodes))}}/{num_episodes:,} | "
                  f"{speed:.0f} 局/s | "
                  f"已用 {format_duration(elapsed)} | "
                  f"剩余 {format_duration(eta)} | "
                  f"ETA {(datetime.now() + timedelta(seconds=eta)).strftime('%H:%M')}",
                  end='', flush=True)
            last_log_time = now

        # Evaluation
        if episode % eval_every == 0:
            print()  # newline
            print(f"  评估中 ({eval_games} 局)...", end='', flush=True)

            # vs Random
            random_agent = RandomAgent(num_actions=eval_env.num_actions)
            eval_env.set_agents([agents[0], random_agent])
            wr_random = tournament(eval_env, eval_games)[0]

            # vs Self (average payoff)
            eval_env.set_agents(agents)
            wr_self = tournament(eval_env, eval_games)[0]

            metrics['episodes'].append(episode)
            metrics['win_rates_vs_random'].append(wr_random)
            metrics['win_rates_vs_self'].append(wr_self)
            metrics['times'].append(time.time() - start_time)

            trend = ""
            if len(metrics['win_rates_vs_random']) >= 2:
                diff = metrics['win_rates_vs_random'][-1] - metrics['win_rates_vs_random'][-2]
                trend = f" ({'↑' if diff > 0 else '↓'}{abs(diff):.3f})"

            print(f"\r  >>> 第 {episode:,} 局 | "
                  f"vs Random: {wr_random:+.4f}{trend} | "
                  f"vs Self: {wr_self:+.4f}", flush=True)

            # Restore self-play agents
            env.set_agents(agents)
            eval_env.set_agents(agents)

            # Save progress file
            try:
                elapsed = time.time() - start_time
                speed = episode / elapsed
                with open(progress_path, 'w') as f:
                    json.dump({
                        'status': 'training',
                        'game': game,
                        'current_episode': episode,
                        'total_episodes': num_episodes,
                        'progress_percent': round(pct, 1),
                        'speed_eps_per_sec': round(speed, 1),
                        'elapsed_seconds': round(elapsed, 1),
                        'eta_seconds': round(eta, 1),
                        'latest_wr_vs_random': wr_random,
                        'device': str(device),
                        'last_update': datetime.now().isoformat(),
                    }, f, indent=2)
            except Exception:
                pass

        # Checkpoint save
        if episode % save_every == 0:
            _save_model(agents, save_path, episode, metrics)
            print(f"  💾 检查点已保存 (第 {episode:,} 局)", flush=True)

    # Final save
    total_time = time.time() - start_time
    final_episode = episode if _shutdown_requested else num_episodes

    print("\n" + "-" * 65)
    print(f"保存最终模型到 {save_path}...", flush=True)
    _save_model(agents, save_path, final_episode, metrics)

    # Final evaluation
    if not _shutdown_requested:
        print("最终评估 (2000局)...", flush=True)
        random_agent = RandomAgent(num_actions=eval_env.num_actions)
        eval_env.set_agents([agents[0], random_agent])
        final_wr = tournament(eval_env, 2000)[0]
    else:
        final_wr = metrics['win_rates_vs_random'][-1] if metrics['win_rates_vs_random'] else 0

    # Save final metrics
    with open(os.path.join(save_path, 'training_metrics.json'), 'w') as f:
        json.dump({
            'game': game,
            'algorithm': 'NFSP',
            'episodes_target': num_episodes,
            'episodes_completed': final_episode,
            'total_time': total_time,
            'speed_eps_per_sec': final_episode / total_time,
            'final_wr_vs_random': final_wr,
            'device': str(device),
            'hidden_layers': hidden_layers,
            'q_layers': q_layers,
            'anticipatory_param': anticipatory_param,
            'metrics': metrics,
            'interrupted': _shutdown_requested,
            'timestamp': datetime.now().isoformat(),
        }, f, indent=2)

    # Summary
    print("\n" + "=" * 65)
    if _shutdown_requested:
        print("训练中断 - 检查点已保存!")
    else:
        print("训练完成!")
    print("=" * 65)
    print(f"  游戏类型:       {game}")
    print(f"  算法:           NFSP")
    print(f"  设备:           {device}")
    print(f"  完成局数:       {final_episode:,}/{num_episodes:,}")
    print(f"  总耗时:         {format_duration(total_time)}")
    print(f"  平均速度:       {final_episode/total_time:.0f} 局/秒")
    print(f"  最终收益:       {final_wr:+.4f} (vs Random)")
    print(f"  模型保存位置:   {save_path}")
    print("=" * 65)


def _save_model(agents, save_path, episode, metrics):
    """Save model checkpoint"""
    for i, agent in enumerate(agents):
        ckpt_path = os.path.join(save_path, f'agent_{i}_checkpoint.pt')
        agent.save_checkpoint(path=save_path, filename=f'agent_{i}_checkpoint.pt')


def main():
    parser = argparse.ArgumentParser(
        description='Train NFSP model for No-Limit Hold\'em',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 快速验证 (10万局, ~30分钟 CPU)
  python train_nfsp.py --episodes 100000

  # 标准训练 (100万局, ~1.5小时 GPU)
  python train_nfsp.py --episodes 1000000

  # 深度训练 (500万局)
  python train_nfsp.py --episodes 5000000

  # 指定游戏类型
  python train_nfsp.py --game limit-holdem --episodes 500000

  # 查看训练进度:
  cat models/nfsp_v1/training_progress.json | python3 -m json.tool

  # Ctrl+C 安全中断，自动保存检查点
        """)
    parser.add_argument('--episodes', type=int, default=1000000,
                        help='训练局数 (default: 1000000)')
    parser.add_argument('--save', type=str, default='./models/nfsp_v1',
                        help='模型保存路径')
    parser.add_argument('--seed', type=int, default=42,
                        help='随机种子')
    parser.add_argument('--game', type=str, default='no-limit-holdem',
                        choices=['leduc-holdem', 'limit-holdem', 'no-limit-holdem'],
                        help='游戏类型 (default: no-limit-holdem)')
    parser.add_argument('--eval-every', type=int, default=10000,
                        help='评估间隔 (default: 10000)')
    parser.add_argument('--save-every', type=int, default=50000,
                        help='保存间隔 (default: 50000)')
    parser.add_argument('--hidden-layers', type=int, nargs='+', default=[512, 512],
                        help='SL网络层大小 (default: 512 512)')
    parser.add_argument('--q-layers', type=int, nargs='+', default=[512, 512],
                        help='Q网络层大小 (default: 512 512)')
    parser.add_argument('--lr', type=float, default=0.01,
                        help='RL学习率 (default: 0.01)')
    parser.add_argument('--sl-lr', type=float, default=0.005,
                        help='SL学习率 (default: 0.005)')
    parser.add_argument('--batch-size', type=int, default=256,
                        help='批大小 (default: 256)')

    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    ai_engine_dir = os.path.dirname(script_dir)
    save_path = os.path.join(ai_engine_dir, args.save.lstrip('./'))

    train_nfsp(
        num_episodes=args.episodes,
        save_path=save_path,
        seed=args.seed,
        game=args.game,
        eval_every=args.eval_every,
        save_every=args.save_every,
        hidden_layers=args.hidden_layers,
        q_layers=args.q_layers,
        rl_lr=args.lr,
        sl_lr=args.sl_lr,
        batch_size=args.batch_size,
    )


if __name__ == '__main__':
    main()
