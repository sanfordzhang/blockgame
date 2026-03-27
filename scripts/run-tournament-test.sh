#!/bin/bash
# 运行锦标赛端对端测试脚本
# 自动连接到已存在的Chrome实例

set -e

CDP_PORT=${CDP_PORT:-9222}
TEST_FILE=${1:-"tests/e2e/tournament.spec.js"}

echo "=========================================="
echo "锦标赛端对端测试"
echo "=========================================="
echo ""

# 检查Chrome是否在调试端口运行
echo "检查Chrome调试端口 ($CDP_PORT)..."
WS_ENDPOINT=$(curl -s http://localhost:$CDP_PORT/json/version 2>/dev/null | grep -o '"webSocketDebuggerUrl":"[^"]*"' | cut -d'"' -f4)

if [ -z "$WS_ENDPOINT" ]; then
    echo "❌ 未检测到Chrome调试端口"
    echo ""
    echo "请先启动Chrome并开启远程调试:"
    echo ""
    echo "macOS:"
    echo "  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug"
    echo ""
    echo "或者使用已有的Chrome配置:"
    echo "  /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222"
    echo ""
    exit 1
fi

echo "✅ 已连接到Chrome"
echo "WebSocket Endpoint: $WS_ENDPOINT"
echo ""

# 检查服务器是否运行
echo "检查服务器状态..."
if curl -s http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ 服务器已在运行"
else
    echo "⚠️  服务器未运行，Playwright将自动启动"
fi

echo ""
echo "运行测试: $TEST_FILE"
echo "=========================================="
echo ""

# 运行Playwright测试
CDP_ENDPOINT="$WS_ENDPOINT" npx playwright test "$TEST_FILE" --project=chromium --headed

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
