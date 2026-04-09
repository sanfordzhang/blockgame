#!/usr/bin/env python3
"""
CFR (Counterfactual Regret Minimization) Training Script
Trains a CFR model for Texas Hold'em

=== 训练速度参考 (MacBook, Apple Silicon / x86_64) ===

  游戏类型          | 每次迭代 | 10,000次预估 | 建议
  ------------------|----------|-------------|------
  leduc-holdem      | ~0.05s   | ~8 分钟      | 快速验证/开发测试 (推荐起步)
  limit-holdem      | ~35s     | ~96 小时     | 需要服务器或减少迭代
  limit-holdem(r=1) | ~2-5s    | ~7-14 小时   | 本地可行的折中方案
  no-limit-holdem   | 数分钟+  | 数周+       | 本地不可行

=== 推荐训练策略 ===
  1. 先用 leduc-holdem 验证流程是否正确 (几分钟)
  2. 用 limit-holdem --raise-limit 1 做快速训练 (几小时)
  3. 最终用 limit-holdem 完整训练 (需要服务器)
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

import rlcard
from rlcard.agents import CFRAgent, RandomAgent
from rlcard.utils import set_seed


# Global flag for graceful shutdown
_shutdown_requested = False
_current_agent = None
_current_save_path = None


def _signal_handler(signum, frame):
    """Handle Ctrl+C: save checkpoint and exit gracefully"""
    global _shutdown_requested
    if _shutdown_requested:
        print("\n\n强制退出!", flush=True)
        sys.exit(1)
    _shutdown_requested = True
    print("\n\n收到中断信号，将在当前迭代完成后保存检查点并退出...", flush=True)
    print("(再次 Ctrl+C 强制退出)", flush=True)


def format_duration(seconds):
    """Format seconds to human readable string"""
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
    """Generate a text progress bar"""
    filled = int(width * progress)
    bar = '█' * filled + '░' * (width - filled)
    return f"[{bar}]"


def save_progress_file(progress_path, data):
    """Save progress to a JSON file for external monitoring"""
    try:
        with open(progress_path, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass  # Don't let progress file errors interrupt training


def benchmark_speed(agent, num_iters=3):
    """Run a few iterations to estimate per-iteration time"""
    print(f"\n  基准测试: 运行 {num_iters} 次迭代来估算速度...", flush=True)
    times = []
    for i in range(num_iters):
        t0 = time.time()
        agent.train()
        elapsed = time.time() - t0
        times.append(elapsed)
        print(f"    迭代 {i+1}/{num_iters}: {elapsed:.2f}s", flush=True)
    avg = sum(times) / len(times)
    return avg, times


def train_cfr(iterations=10000, save_path='./models/cfr_v1', seed=42,
              game='leduc-holdem', chips=None, eval_interval=None,
              checkpoint_interval=None, raise_limit=None):
    """Train CFR model for Hold'em

    Args:
        iterations: 训练迭代次数
        save_path: 模型保存路径
        seed: 随机种子
        game: 游戏类型 (leduc-holdem/limit-holdem/no-limit-holdem)
        chips: No-Limit模式初始筹码
        eval_interval: 评估间隔
        checkpoint_interval: 检查点间隔
        raise_limit: limit-holdem 每轮最大加注次数 (默认4, 减小可加速)
    """
    global _current_agent, _current_save_path, _shutdown_requested

    print("=" * 65)
    print("CFR Training for Texas Hold'em")
    print("=" * 65)
    print(f"  游戏类型:     {game}")
    print(f"  目标迭代:     {iterations:,}")
    print(f"  保存路径:     {save_path}")
    print(f"  随机种子:     {seed}")
    if chips:
        print(f"  初始筹码:     {chips}")
    if raise_limit is not None:
        print(f"  加注限制:     {raise_limit} (默认4)")
    print("=" * 65)

    # Set random seed
    set_seed(seed)

    # Create environment
    print("\n[1/4] 创建游戏环境...", flush=True)
    env_config = {'allow_step_back': True}
    if chips and 'no-limit' in game:
        env_config['game_num_players'] = 2
    env = rlcard.make(game, config=env_config)

    # Reduce raise limit for limit-holdem to speed up training
    if raise_limit is not None and game == 'limit-holdem':
        try:
            env.game.allowed_raise_num = raise_limit
            print(f"      ✅ 加注限制已设为 {raise_limit} (原始值: 4)")
        except AttributeError:
            print(f"      ⚠️  无法修改加注限制，使用默认值")

    print(f"      动作数: {env.num_actions}")
    print(f"      状态维度: {env.state_shape}")

    # Create CFR agent (model_path controls where save() writes)
    print("\n[2/4] 初始化 CFR Agent...", flush=True)
    os.makedirs(save_path, exist_ok=True)
    agent = CFRAgent(env, model_path=save_path)
    _current_agent = agent
    _current_save_path = save_path

    # Setup signal handler for graceful shutdown
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    # Benchmark speed
    print("\n[3/4] 速度基准测试...", flush=True)
    avg_iter_time, bench_times = benchmark_speed(agent, num_iters=3)
    bench_iterations = 3  # These count toward training

    estimated_total = avg_iter_time * iterations
    print(f"\n  ┌─────────────────────────────────────────────┐")
    print(f"  │ 速度估算结果                                │")
    print(f"  ├─────────────────────────────────────────────┤")
    print(f"  │ 平均每次迭代:  {avg_iter_time:>10.2f}s                  │")
    print(f"  │ 预估总时间:    {format_duration(estimated_total):>10s}                  │")
    print(f"  │ 预计完成时间:  {(datetime.now() + timedelta(seconds=estimated_total)).strftime('%Y-%m-%d %H:%M'):>16s}    │")
    print(f"  └─────────────────────────────────────────────┘")
    print(flush=True)

    # Set default intervals based on iteration speed
    if eval_interval is None:
        if avg_iter_time > 10:
            eval_interval = max(50, iterations // 20)
        elif avg_iter_time > 1:
            eval_interval = max(200, iterations // 20)
        else:
            eval_interval = max(500, iterations // 20)

    if checkpoint_interval is None:
        if avg_iter_time > 10:
            checkpoint_interval = max(20, iterations // 10)
        elif avg_iter_time > 1:
            checkpoint_interval = max(100, iterations // 10)
        else:
            checkpoint_interval = max(500, iterations // 10)

    print(f"  评估间隔: 每 {eval_interval} 次迭代")
    print(f"  检查点间隔: 每 {checkpoint_interval} 次迭代")

    # Prepare progress file
    os.makedirs(save_path, exist_ok=True)
    progress_path = os.path.join(save_path, 'training_progress.json')

    # Training metrics
    start_time = time.time() - sum(bench_times)  # Include benchmark time
    metrics = {
        'iterations': [],
        'win_rates': [],
        'times': [],
        'iter_times': []
    }

    # Moving average for ETA calculation
    recent_times = list(bench_times)
    max_recent = 20

    # Training loop
    print(f"\n[4/4] 开始训练 (从迭代 {bench_iterations + 1} 开始)...", flush=True)
    print("-" * 65, flush=True)

    for i in range(bench_iterations, iterations):
        if _shutdown_requested:
            print(f"\n中断: 在迭代 {i}/{iterations} 保存检查点...", flush=True)
            break

        iter_start = time.time()
        agent.train()
        iter_time = time.time() - iter_start

        # Update moving average
        recent_times.append(iter_time)
        if len(recent_times) > max_recent:
            recent_times.pop(0)
        avg_recent = sum(recent_times) / len(recent_times)

        completed = i + 1
        remaining = iterations - completed
        elapsed = time.time() - start_time
        eta = avg_recent * remaining
        progress = completed / iterations

        # Print progress for EVERY iteration (since each iteration is slow)
        pct = progress * 100
        print(f"\r{progress_bar(progress)} {pct:>5.1f}% | "
              f"迭代 {completed:>{len(str(iterations))}}/{iterations} | "
              f"本次 {iter_time:.1f}s | "
              f"已用 {format_duration(elapsed)} | "
              f"剩余 {format_duration(eta)} | "
              f"预计完成 {(datetime.now() + timedelta(seconds=eta)).strftime('%H:%M:%S')}",
              end='', flush=True)

        metrics['iter_times'].append(iter_time)

        # Save progress file for external monitoring
        save_progress_file(progress_path, {
            'status': 'training',
            'game': game,
            'current_iteration': completed,
            'total_iterations': iterations,
            'progress_percent': round(progress * 100, 1),
            'elapsed_seconds': round(elapsed, 1),
            'eta_seconds': round(eta, 1),
            'avg_iter_time': round(avg_recent, 2),
            'last_update': datetime.now().isoformat(),
            'estimated_completion': (datetime.now() + timedelta(seconds=eta)).isoformat()
        })

        # Evaluation
        if completed % eval_interval == 0:
            print()  # New line after progress bar
            eval_games = 50 if avg_iter_time > 10 else 100
            win_rate = evaluate_agent(agent, env, num_games=eval_games)

            metrics['iterations'].append(completed)
            metrics['win_rates'].append(win_rate)
            metrics['times'].append(elapsed)

            trend = ""
            if len(metrics['win_rates']) >= 2:
                diff = metrics['win_rates'][-1] - metrics['win_rates'][-2]
                trend = f" ({'↑' if diff > 0 else '↓'}{abs(diff):.1%})"

            print(f"  >>> 评估: 胜率 vs Random: {win_rate:.1%}{trend}", flush=True)

        # Checkpoint save
        if completed % checkpoint_interval == 0 and completed < iterations:
            # Save checkpoint to sub-directory
            checkpoint_path = os.path.join(save_path, f'checkpoint_iter{completed}')
            os.makedirs(checkpoint_path, exist_ok=True)
            original_path = agent.model_path
            agent.model_path = checkpoint_path
            agent.save()
            # Also save to main path as latest
            agent.model_path = original_path
            agent.save()
            print(f"\n  💾 检查点已保存 (迭代 {completed})", flush=True)

    total_time = time.time() - start_time
    completed_iterations = i if _shutdown_requested else i + 1

    # Final save
    print("\n" + "-" * 65)
    print(f"保存模型到 {save_path}...", flush=True)
    os.makedirs(save_path, exist_ok=True)
    agent.model_path = save_path
    agent.save()

    # Final evaluation
    if not _shutdown_requested:
        print("最终评估...", flush=True)
        final_win_rate = evaluate_agent(agent, env, num_games=200)
    else:
        final_win_rate = metrics['win_rates'][-1] if metrics['win_rates'] else 0

    # Save training metrics
    metrics_path = os.path.join(save_path, 'training_metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump({
            'game': game,
            'iterations_target': iterations,
            'iterations_completed': completed_iterations,
            'total_time': total_time,
            'avg_iter_time': sum(metrics['iter_times']) / len(metrics['iter_times']) if metrics['iter_times'] else 0,
            'final_win_rate': final_win_rate,
            'metrics': {k: v for k, v in metrics.items() if k != 'iter_times'},
            'interrupted': _shutdown_requested,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)

    # Update progress file
    save_progress_file(progress_path, {
        'status': 'interrupted' if _shutdown_requested else 'completed',
        'game': game,
        'current_iteration': completed_iterations,
        'total_iterations': iterations,
        'progress_percent': round(completed_iterations / iterations * 100, 1),
        'total_time_seconds': round(total_time, 1),
        'final_win_rate': final_win_rate,
        'last_update': datetime.now().isoformat()
    })

    # Summary
    print("\n" + "=" * 65)
    if _shutdown_requested:
        print("训练中断 - 检查点已保存!")
    else:
        print("训练完成!")
    print("=" * 65)
    print(f"  游戏类型:       {game}")
    print(f"  完成迭代:       {completed_iterations:,}/{iterations:,}")
    print(f"  总耗时:         {format_duration(total_time)}")
    print(f"  平均每次迭代:   {total_time/completed_iterations:.2f}s")
    print(f"  最终胜率:       {final_win_rate:.1%}")
    print(f"  模型保存位置:   {save_path}")
    if _shutdown_requested:
        print(f"\n  提示: 可以从检查点恢复训练继续")
    print("=" * 65)

    return agent, metrics


def evaluate_agent(agent, env, num_games=1000):
    """Evaluate agent against RandomAgent"""

    random_agent = RandomAgent(num_actions=env.num_actions)
    wins = 0

    for g in range(num_games):
        state, _ = env.reset()
        if hasattr(agent, 'reset'):
            agent.reset()

        while not env.is_over():
            current_player = env.get_player_id()
            if current_player == 0:
                action, _ = agent.eval_step(state)
            else:
                action = random_agent.step(state)
            state, _ = env.step(action)

        # Compatible with different env types
        # Some envs have get_winner(), others only have get_payoffs()
        if hasattr(env, 'get_winner'):
            winner = env.get_winner()
            if winner == 0:
                wins += 1
        else:
            payoffs = env.get_payoffs()
            if payoffs[0] > payoffs[1]:
                wins += 1

    return wins / num_games


def main():
    parser = argparse.ArgumentParser(
        description='Train CFR model for Texas Hold\'em',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 推荐起步: leduc-holdem, 快速验证 (~8分钟)
  python train_cfr.py --game leduc-holdem --iterations 10000

  # limit-holdem 快速版: 减少加注次数 (~数小时)
  python train_cfr.py --game limit-holdem --iterations 1000 --raise-limit 1

  # limit-holdem 完整版: 需要服务器 (~96小时)
  python train_cfr.py --game limit-holdem --iterations 10000

  # No-Limit (极慢, 不推荐本地训练)
  python train_cfr.py --game no-limit-holdem --iterations 100 --chips 20

  # 查看训练进度 (另一个终端):
  cat models/cfr_v1/training_progress.json | python3 -m json.tool

  # Ctrl+C 可安全中断，自动保存检查点
        """)
    parser.add_argument('--iterations', type=int, default=10000,
                        help='训练迭代次数 (default: 10000)')
    parser.add_argument('--save', type=str, default='./models/cfr_v1',
                        help='模型保存路径 (default: ./models/cfr_v1)')
    parser.add_argument('--seed', type=int, default=42,
                        help='随机种子 (default: 42)')
    parser.add_argument('--game', type=str, default='leduc-holdem',
                        choices=['leduc-holdem', 'limit-holdem', 'no-limit-holdem'],
                        help='游戏类型 (default: leduc-holdem, 推荐起步)')
    parser.add_argument('--chips', type=int, default=None,
                        help='No-Limit模式初始筹码 (越小越快, 建议20)')
    parser.add_argument('--raise-limit', type=int, default=None,
                        help='limit-holdem每轮最大加注次数 (默认4, 设1可加速~16x)')
    parser.add_argument('--eval-interval', type=int, default=None,
                        help='评估间隔迭代数 (自动根据速度设定)')
    parser.add_argument('--checkpoint-interval', type=int, default=None,
                        help='检查点保存间隔 (自动根据速度设定)')

    args = parser.parse_args()

    # Get absolute path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ai_engine_dir = os.path.dirname(script_dir)
    save_path = os.path.join(ai_engine_dir, args.save.lstrip('./'))

    train_cfr(
        iterations=args.iterations,
        save_path=save_path,
        seed=args.seed,
        game=args.game,
        chips=args.chips,
        eval_interval=args.eval_interval,
        checkpoint_interval=args.checkpoint_interval,
        raise_limit=args.raise_limit
    )


if __name__ == '__main__':
    main()
