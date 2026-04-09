#!/usr/bin/env python3
"""
CFR 训练速度对比测试
对比 leduc-holdem / limit-holdem / no-limit-holdem 的训练速度
帮助用户选择合适的训练配置
"""

import time
import sys

import rlcard
from rlcard.agents import CFRAgent


def test_game(game_name, num_iters=5, modify_env=None, label=None):
    """Test training speed for a specific game type

    Args:
        game_name: rlcard game name
        num_iters: number of iterations to benchmark
        modify_env: optional function to modify env after creation
        label: display label (defaults to game_name)
    """
    display = label or game_name
    print(f"\n{'─' * 55}")
    print(f"测试: {display}")
    print(f"{'─' * 55}")

    print(f"  创建环境...", flush=True)
    t0 = time.time()
    env = rlcard.make(game_name, config={'allow_step_back': True})
    if modify_env:
        modify_env(env)
    print(f"  环境创建耗时: {time.time() - t0:.2f}s")
    print(f"  动作数: {env.num_actions}")

    print(f"  创建 CFR Agent...", flush=True)
    t0 = time.time()
    agent = CFRAgent(env)
    print(f"  Agent 创建耗时: {time.time() - t0:.2f}s")

    print(f"\n  运行 {num_iters} 次迭代:", flush=True)
    times = []
    for i in range(num_iters):
        t0 = time.time()
        agent.train()
        elapsed = time.time() - t0
        times.append(elapsed)

        eta_10k = sum(times) / len(times) * 10000
        if eta_10k < 3600:
            eta_str = f"{eta_10k/60:.0f}分钟"
        elif eta_10k < 86400:
            eta_str = f"{eta_10k/3600:.1f}小时"
        else:
            eta_str = f"{eta_10k/86400:.1f}天"

        print(f"    [{i+1}/{num_iters}] {elapsed:.3f}s "
              f"(平均: {sum(times)/len(times):.3f}s, "
              f"预估10000次: {eta_str})", flush=True)

        # If a single iteration takes more than 120s, skip remaining
        if elapsed > 120:
            print(f"    ⚠️  单次迭代超过2分钟，跳过剩余测试", flush=True)
            break

    avg = sum(times) / len(times)
    return avg, times


def format_time_est(seconds):
    """Format estimated time for 10000 iterations"""
    total = seconds * 10000
    if total < 60:
        return f"{total:.0f} 秒"
    elif total < 3600:
        return f"{total/60:.0f} 分钟"
    elif total < 86400:
        return f"{total/3600:.1f} 小时"
    else:
        return f"{total/86400:.1f} 天"


def main():
    print("=" * 55)
    print("CFR 训练速度对比测试")
    print("=" * 55)
    print(f"Python: {sys.version.split()[0]}")
    print(f"用途: 帮助选择合适的游戏类型和参数进行CFR训练")

    results = {}

    # 1. Test leduc holdem (should be very fast)
    avg, _ = test_game('leduc-holdem', num_iters=20, label='leduc-holdem (6张牌, 2轮)')
    results['leduc-holdem'] = avg

    # 2. Test limit holdem with raise_limit=1 (should be faster than default)
    def set_raise_1(env):
        env.game.allowed_raise_num = 1

    avg, _ = test_game('limit-holdem', num_iters=3,
                       modify_env=set_raise_1,
                       label='limit-holdem (raise=1, 简化版)')
    results['limit-holdem (raise=1)'] = avg

    # 3. Test limit holdem default (slow)
    print("\n⚠️  limit-holdem 默认配置较慢，测试2次迭代")
    avg, _ = test_game('limit-holdem', num_iters=2,
                       label='limit-holdem (raise=4, 默认)')
    results['limit-holdem (raise=4)'] = avg

    # 4. Test no-limit holdem (very slow, only 1 iteration)
    print("\n⚠️  No-Limit Hold'em 非常慢，仅测试1次迭代")
    avg, _ = test_game('no-limit-holdem', num_iters=1,
                       label='no-limit-holdem (极慢)')
    results['no-limit-holdem'] = avg

    # Summary
    print(f"\n{'=' * 70}")
    print("速度对比结果")
    print(f"{'=' * 70}")
    print(f"\n  {'游戏类型':<30} {'平均/次':>10} {'预估10000次':>14} {'可行性':>10}")
    print(f"  {'─' * 64}")

    for game, avg in results.items():
        total_est = avg * 10000
        est_str = format_time_est(avg)

        if total_est < 3600:
            feasible = "✅ 推荐"
        elif total_est < 28800:
            feasible = "✅ 可行"
        elif total_est < 86400:
            feasible = "⚠️ 较慢"
        else:
            feasible = "❌ 不可行"

        print(f"  {game:<30} {avg:>8.3f}s  {est_str:>12s}  {feasible}")

    # Speed ratios
    if 'leduc-holdem' in results and 'limit-holdem (raise=4)' in results:
        ratio = results['limit-holdem (raise=4)'] / max(results['leduc-holdem'], 0.001)
        print(f"\n  Limit vs Leduc: 慢 {ratio:.0f}x")
    if 'limit-holdem (raise=1)' in results and 'limit-holdem (raise=4)' in results:
        ratio = results['limit-holdem (raise=4)'] / max(results['limit-holdem (raise=1)'], 0.001)
        print(f"  raise=4 vs raise=1: 慢 {ratio:.0f}x")

    print(f"\n{'─' * 70}")
    print("推荐训练策略:")
    print("  1. 先用 leduc-holdem 验证训练流程 (几分钟即可完成)")
    print("     python train_cfr.py --game leduc-holdem --iterations 10000")
    print()
    print("  2. 用 limit-holdem + raise-limit 1 做快速训练 (数小时)")
    print("     python train_cfr.py --game limit-holdem --raise-limit 1 --iterations 5000")
    print()
    print("  3. 完整 limit-holdem 训练建议在服务器上运行")
    print("     python train_cfr.py --game limit-holdem --iterations 10000")
    print(f"{'=' * 70}")


if __name__ == '__main__':
    main()
