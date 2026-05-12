#!/bin/bash

# DAO Governance 测试快速启动脚本
# 用法: ./run-dao-test.sh [mock|full]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
FRONTEND_PORT=3001
BACKEND_PORT=7778
CDP_PORT=9222
PROJECT_ROOT="/Users/yingfengzhang/1JackSource/blockchain/game-core"

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      DAO Governance Test Runner            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# 检查参数
TEST_MODE=${1:-mock}

if [ "$TEST_MODE" != "mock" ] && [ "$TEST_MODE" != "full" ]; then
    echo -e "${RED}❌ Invalid test mode: $TEST_MODE${NC}"
    echo -e "Usage: $0 [mock|full]"
    echo -e "  mock - Run with Mock API (no backend needed)"
    echo -e "  full - Run with real backend"
    exit 1
fi

echo -e "${GREEN}📋 Test Mode: $TEST_MODE${NC}"
echo ""

# 清理函数
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"

    # 杀掉后台进程
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        echo "  Stopped frontend (PID: $FRONTEND_PID)"
    fi

    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        echo "  Stopped backend (PID: $BACKEND_PID)"
    fi

    # 清理端口
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
    if [ "$TEST_MODE" = "full" ]; then
        lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    fi

    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# 注册清理函数
trap cleanup EXIT INT TERM

# 进入项目目录
cd "$PROJECT_ROOT"

# ============================================================
# 1. 清理现有进程
# ============================================================
echo -e "${YELLOW}🧹 Step 1: Cleaning existing processes...${NC}"

lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
echo "  ✓ Cleaned port $FRONTEND_PORT"

if [ "$TEST_MODE" = "full" ]; then
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    echo "  ✓ Cleaned port $BACKEND_PORT"
fi

sleep 2

# ============================================================
# 2. 启动后端（仅 full 模式）
# ============================================================
if [ "$TEST_MODE" = "full" ]; then
    echo -e "\n${YELLOW}🚀 Step 2: Starting backend server...${NC}"

    ENV_FILE=.env.testnet node server/server.js > /tmp/dao-backend.log 2>&1 &
    BACKEND_PID=$!

    echo "  Backend PID: $BACKEND_PID"
    echo "  Log: /tmp/dao-backend.log"

    # 等待后端启动
    echo -n "  Waiting for backend"
    for i in {1..10}; do
        if curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done

    if ! curl -s http://localhost:$BACKEND_PORT/api/health > /dev/null 2>&1; then
        echo -e " ${RED}✗${NC}"
        echo -e "${RED}❌ Backend failed to start${NC}"
        echo "Check log: tail -f /tmp/dao-backend.log"
        exit 1
    fi
else
    echo -e "\n${YELLOW}⏭️  Step 2: Skipping backend (Mock mode)${NC}"
fi

# ============================================================
# 3. 启动前端
# ============================================================
echo -e "\n${YELLOW}🚀 Step 3: Starting frontend...${NC}"

if [ "$TEST_MODE" = "full" ]; then
    REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=$BACKEND_PORT PORT=$FRONTEND_PORT npm run start:client > /tmp/dao-frontend.log 2>&1 &
else
    REACT_APP_NETWORK=testnet PORT=$FRONTEND_PORT npm run start:client > /tmp/dao-frontend.log 2>&1 &
fi

FRONTEND_PID=$!

echo "  Frontend PID: $FRONTEND_PID"
echo "  Log: /tmp/dao-frontend.log"

# 等待前端启动
echo -n "  Waiting for frontend"
for i in {1..30}; do
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

if ! curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
    echo -e " ${RED}✗${NC}"
    echo -e "${RED}❌ Frontend failed to start${NC}"
    echo "Check log: tail -f /tmp/dao-frontend.log"
    exit 1
fi

# ============================================================
# 4. 检查 Chrome CDP
# ============================================================
echo -e "\n${YELLOW}🔍 Step 4: Checking Chrome CDP...${NC}"

if ! curl -s http://localhost:$CDP_PORT/json > /dev/null 2>&1; then
    echo -e "${RED}❌ Chrome CDP not available on port $CDP_PORT${NC}"
    echo ""
    echo "Please start Chrome with debugging enabled:"
    echo ""
    echo -e "${BLUE}/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome \\${NC}"
    echo -e "${BLUE}  --remote-debugging-port=$CDP_PORT \\${NC}"
    echo -e "${BLUE}  --user-data-dir=\"/tmp/chrome-debug\" \\${NC}"
    echo -e "${BLUE}  \"http://127.0.0.1:$FRONTEND_PORT/dao\" &${NC}"
    echo ""
    exit 1
fi

echo -e "  ${GREEN}✓ Chrome CDP is ready${NC}"

# ============================================================
# 5. 运行测试
# ============================================================
echo -e "\n${YELLOW}🧪 Step 5: Running tests...${NC}"
echo ""

if [ "$TEST_MODE" = "mock" ]; then
    TEST_FILE="tests/e2e/dao-cdp-mock-e2e.js"
else
    TEST_FILE="tests/e2e/dao-cdp-e2e.js"
fi

echo -e "${BLUE}Test file: $TEST_FILE${NC}"
echo ""

# 运行测试
node "$TEST_FILE"
TEST_EXIT_CODE=$?

# ============================================================
# 6. 测试结果
# ============================================================
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Test Execution Summary           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
else
    echo -e "${RED}❌ Some tests failed (exit code: $TEST_EXIT_CODE)${NC}"
fi

echo ""
echo -e "${BLUE}📁 Screenshots:${NC} tests/e2e/screenshots/dao/"
echo -e "${BLUE}📄 Frontend log:${NC} /tmp/dao-frontend.log"

if [ "$TEST_MODE" = "full" ]; then
    echo -e "${BLUE}📄 Backend log:${NC} /tmp/dao-backend.log"
fi

echo ""

# 询问是否查看截图
read -p "View screenshots? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open tests/e2e/screenshots/dao/ 2>/dev/null || echo "Cannot open screenshots directory"
fi

exit $TEST_EXIT_CODE
