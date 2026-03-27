#!/bin/bash
# 简化的集成测试脚本 - 只启动后端并运行测试

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "  集成测试 - 启动服务并测试"
echo "=========================================="

# 清理旧进程
echo ""
echo "[1/5] 清理旧进程..."
lsof -ti:7777 | xargs kill -9 2>/dev/null || true
lsof -ti:7778 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# 启动后端
echo ""
echo "[2/5] 启动后端服务..."
export ENV_FILE=.env.testnet
export SERVER_PORT=7777
node server/server.js &
BACKEND_PID=$!
echo "后端PID: $BACKEND_PID"

# 等待后端启动
echo "等待后端服务启动..."
for i in {1..30}; do
    if curl -s http://localhost:7777 > /dev/null 2>&1; then
        echo "✅ 后端服务已启动 (端口7777)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 后端启动超时"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# 运行单元测试
echo ""
echo "[3/5] 运行单元测试..."
echo "--- API 测试 ---"
npm run test:api 2>&1 | tail -15

echo ""
echo "--- 服务层测试 ---"
npm run test:services 2>&1 | tail -15

echo ""
echo "--- 集成测试 ---"
npm run test:integration 2>&1 | tail -15

echo ""
echo "--- Bot测试 ---"
npm run test:bot 2>&1 | tail -10

echo ""
echo "--- 安全测试 ---"
npm run test:security 2>&1 | tail -10

# 测试API端点
echo ""
echo "[4/5] 测试API端点..."
echo "--- 健康检查 ---"
curl -s http://localhost:7777/api/health 2>/dev/null || echo "(无健康检查端点)"

echo ""
echo "--- 测试芯片余额API ---"
curl -s "http://localhost:7777/api/chip/balance/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b" 2>/dev/null | head -c 200 || echo "(请求失败)"

echo ""
echo "--- 测试NFT API ---"
curl -s "http://localhost:7777/api/nft/list/TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b" 2>/dev/null | head -c 200 || echo "(请求失败)"

echo ""
echo "--- 测试锦标赛API ---"
curl -s "http://localhost:7777/api/tournament/list" 2>/dev/null | head -c 200 || echo "(请求失败)"

# 启动前端并测试
echo ""
echo "[5/5] 启动前端服务..."
# 使用BROWSER=none避免自动打开浏览器
BROWSER=none npm start &
FRONTEND_PID=$!

# 等待前端启动
echo "等待前端服务启动..."
for i in {1..90}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "✅ 前端服务已启动 (端口3000)"
        break
    fi
    if [ $i -eq 90 ]; then
        echo "⚠️ 前端启动超时（可能需要更多时间）"
    fi
    sleep 1
done

# 运行E2E测试
echo ""
echo "=== 运行E2E测试 ==="
npm run test:e2e 2>&1 | tail -30 || true

# 清理
echo ""
echo "=========================================="
echo "  清理进程"
echo "=========================================="
kill $BACKEND_PID 2>/dev/null || true
kill $FRONTEND_PID 2>/dev/null || true
lsof -ti:7777 | xargs kill -9 2>/dev/null || true
lsof -ti:7778 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo ""
echo "=========================================="
echo "  测试完成"
echo "=========================================="
