#!/bin/bash
# === NFT 锻造完整测试流程 ===
# 按照 docs/GAME_BOT_TEST_FLOW.md 执行

set -e

cd /Users/yingfengzhang/1JackSource/blockchain/game-core

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
step() { echo -e "${CYAN}[STEP]${NC} $1"; }

# 玩家地址
PLAYER1_ADDRESS='TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
PLAYER2_ADDRESS='TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'
NFT_CONTRACT='TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC'

echo ""
echo "=========================================="
echo "  🎮 NFT 锻造完整测试流程"
echo "=========================================="
echo "  玩家1: $PLAYER1_ADDRESS"
echo "  玩家2 (机器人): $PLAYER2_ADDRESS"
echo "  NFT 合约: $NFT_CONTRACT"
echo "  Tronscan: https://nile.tronscan.org/#/token20/$NFT_CONTRACT"
echo "=========================================="
echo ""

# Step 1: 检查服务状态
step "1. 检查服务状态..."

# 检查 MongoDB
if ! brew services list | grep mongodb-community | grep started > /dev/null; then
    error "MongoDB 未运行！"
    echo "启动命令: brew services start mongodb-community"
    exit 1
fi
log "✅ MongoDB 运行正常"

# 检查后端
if ! pgrep -f "node server/server.js" > /dev/null; then
    error "后端服务未运行！"
    echo "启动命令: ENV_FILE=.env.testnet node server/server.js"
    exit 1
fi
log "✅ 后端服务运行正常 (端口 7778)"

# 检查前端
if ! pgrep -f "node scripts/start.js" > /dev/null; then
    error "前端服务未运行！"
    echo "启动命令: REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client"
    exit 1
fi
log "✅ 前端服务运行正常 (端口 3001)"

# 检查 Chrome CDP
if ! pgrep -f "Google Chrome.*remote-debugging-port=9222" > /dev/null; then
    warn "Chrome CDP 未运行，尝试启动..."
    
    # 关闭现有 Chrome
    osascript -e 'quit app "Google Chrome"' 2>/dev/null || true
    sleep 2
    
    # 启动 Chrome CDP
    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
        --remote-debugging-port=9222 \
        --user-data-dir="/tmp/chrome-debug" \
        "http://127.0.0.1:3001/" > /dev/null 2>&1 &
    
    sleep 3
    log "✅ Chrome CDP 已启动 (端口 9222)"
else
    log "✅ Chrome CDP 运行正常 (端口 9222)"
fi

echo ""

# Step 2: 启动机器人
step "2. 启动机器人..."

# 清理旧的机器人进程
pkill -f "node scripts/game-bot.js" 2>/dev/null || true
sleep 1

# 启动机器人（后台）
node scripts/game-bot.js > bot.log 2>&1 &
BOT_PID=$!
log "机器人已启动 (PID: $BOT_PID)"

# 等待机器人创建锦标赛
log "等待机器人创建锦标赛..."
TOURNAMENT_ID=""
for i in {1..15}; do
    sleep 1
    TOURNAMENT_ID=$(grep "锦标赛创建成功" bot.log | tail -1 | grep -oE "tournament-[0-9]+" || echo "")
    if [ -n "$TOURNAMENT_ID" ]; then
        success "检测到锦标赛: $TOURNAMENT_ID"
        break
    fi
done

if [ -z "$TOURNAMENT_ID" ]; then
    error "未检测到锦标赛创建！"
    echo "=== 机器人日志 ==="
    cat bot.log
    exit 1
fi

echo ""

# Step 3: CDP 控制浏览器加入游戏
step "3. CDP 控制浏览器加入游戏..."

log "执行 CDP 脚本..."
node cdp-nft-mint-auto.js

# 检查执行结果
if [ $? -eq 0 ]; then
    success "CDP 脚本执行完成"
else
    error "CDP 脚本执行失败"
    exit 1
fi

echo ""

# Step 4: 验证 NFT 锻造结果
step "4. 验证 NFT 锻造结果..."

log "查询数据库中的 NFT..."
DB_NFT_COUNT=$(node -e "
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

async function check() {
    await mongoose.connect('mongodb://localhost:27017/poker-game');
    const nfts = await NFTClaim.findByPlayer('$PLAYER1_ADDRESS');
    console.log(nfts.length);
    if (nfts.length > 0) {
        const latest = nfts[0];
        console.error('最新 NFT: ' + latest.achievementType + ' - ' + latest.handDescription);
    }
    await mongoose.disconnect();
}

check().catch(() => console.log(0));
" 2>&1 | head -1)

log "数据库中 NFT 数量: $DB_NFT_COUNT"

log "查询链上 NFT..."
CHAIN_NFT_COUNT=$(curl -s "https://nile.tronscan.org/api/token20/$NFT_CONTRACT/holders?address=$PLAYER1_ADDRESS" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
console.log(data.data?.[0]?.balance || 0);
" 2>/dev/null || echo "0")

log "链上 NFT 数量: $CHAIN_NFT_COUNT"

echo ""

# Step 5: 清理和总结
step "5. 清理资源..."

kill $BOT_PID 2>/dev/null || true
log "已停止机器人"

echo ""
echo "=========================================="
echo "  ✅ 测试流程完成"
echo "=========================================="
echo "  数据库 NFT: $DB_NFT_COUNT"
echo "  链上 NFT: $CHAIN_NFT_COUNT"
echo ""

if [ "$DB_NFT_COUNT" -gt 0 ]; then
    success "🎉 NFT 锻造成功！"
    echo ""
    echo "查看 NFT:"
    echo "  Tronscan: https://nile.tronscan.org/#/token20/$NFT_CONTRACT"
    echo "  钱包页面: http://127.0.0.1:3001/nft"
    echo ""
    
    # 显示最新的 NFT 详情
    node -e "
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

async function showLatest() {
    await mongoose.connect('mongodb://localhost:27017/poker-game');
    const nfts = await NFTClaim.findByPlayer('$PLAYER1_ADDRESS');
    if (nfts.length > 0) {
        const nft = nfts[0];
        console.log('最新 NFT 详情:');
        console.log('  类型:', nft.achievementType);
        console.log('  描述:', nft.handDescription);
        console.log('  牌型:', nft.cards?.map(c => c.rank + c.suit).join(' ') || 'N/A');
        console.log('  Token ID:', nft.tokenId);
        console.log('  交易哈希:', nft.txHash || '未上链');
        console.log('  创建时间:', nft.claimedAt);
    }
    await mongoose.disconnect();
}

showLatest().catch(console.error);
"
else
    warn "⚠️ 未检测到 NFT 锻造成功"
    echo ""
    echo "排查建议:"
    echo "1. 检查游戏是否完成（bot.log 中是否有 '锦标赛开始' 和 '游戏结束'）"
    echo "2. 检查 TronLink 签名是否成功（test-results/ 中的截图）"
    echo "3. 检查前端控制台日志（浏览器开发者工具）"
    echo "4. 检查后端日志（server.log）"
    echo ""
    echo "调试命令:"
    echo "  查看机器人日志: cat bot.log"
    echo "  查看截图: open test-results/"
fi

echo "=========================================="
