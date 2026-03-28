#!/bin/bash
# 游戏机器人启动脚本
# 使用方法: ./start-bot.sh 或 bash start-bot.sh

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "🤖 游戏机器人"
echo "========================================"
echo ""
echo "机器人会自动："
echo "  1. 创建2人锦标赛"
echo "  2. 加入并等待你"
echo "  3. 游戏中自动操作"
echo ""
echo "请确保后端服务器运行在 7778 端口"
echo ""

node scripts/game-bot.js
