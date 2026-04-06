#!/bin/bash
# === NFT 锻造自动化完整流程 ===
# 按照 docs/GAME_BOT_TEST_FLOW.md 流程：
# 1. 创建 Mock 模式锦标赛
# 2. 启动机器人
# 3. CDP 控制浏览器加入游戏
# 4. 完成一手牌（玩家1获得顺子）
# 5. 自动处理 NFT 锻造签名
# 6. 验证 NFT 是否锻造成功

set -e

cd /Users/yingfengzhang/1JackSource/blockchain/game-core

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# 固定坐标（来自 deposit-auto-final.sh）
TRONLINK_ICON_X=1238
TRONLINK_ICON_Y=50
SIGN_BTN_X=1414
SIGN_BTN_Y=635

# TronLink 窗口参数
TL_X=1127
TL_Y=34
TL_W=385
TL_H=953

# 玩家地址
PLAYER1_ADDRESS='TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
PLAYER2_ADDRESS='TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'

log "=========================================="
log "  NFT 锻造自动化完整流程"
log "=========================================="

# Step 0: 检查服务状态
log "[0] 检查服务状态..."
if ! pgrep -f "node server/server.js" > /dev/null; then
    error "后端服务未运行！请先启动："
    echo "  brew services start mongodb-community && ENV_FILE=.env.testnet node server/server.js"
    exit 1
fi

if ! pgrep -f "node scripts/start.js" > /dev/null; then
    error "前端服务未运行！请先启动："
    echo "  REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client"
    exit 1
fi

log "✅ 服务状态正常"

# Step 1: 启动机器人（后台）
log "[1] 启动机器人..."
pkill -f "node scripts/game-bot.js" 2>/dev/null || true
sleep 1
node scripts/game-bot.js > bot.log 2>&1 &
BOT_PID=$!
log "✅ 机器人已启动 (PID: $BOT_PID)"
sleep 2

# Step 2: 等待机器人创建锦标赛
log "[2] 等待机器人创建锦标赛..."
TOURNAMENT_ID=""
for i in {1..10}; do
    sleep 1
    TOURNAMENT_ID=$(grep "锦标赛创建成功" bot.log | tail -1 | grep -o "tournament-[0-9]*" || echo "")
    if [ -n "$TOURNAMENT_ID" ]; then
        log "✅ 检测到锦标赛: $TOURNAMENT_ID"
        break
    fi
done

if [ -z "$TOURNAMENT_ID" ]; then
    error "未检测到锦标赛创建"
    cat bot.log
    exit 1
fi

# Step 3: CDP 连接浏览器并加入游戏
log "[3] CDP 连接浏览器并加入游戏..."
node -e "
const CDP = require('chrome-remote-interface');

async function joinGame() {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    
    // 导航到锦标赛页面
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    console.log('[CDP] 已导航到锦标赛页面');
    
    // 等待页面加载
    await new Promise(r => setTimeout(r, 3000));
    
    // 勾选 Mock 游戏开关
    await Runtime.evaluate({
        expression: \`
            const checkbox = document.querySelector('input[data-testid=\"mock-game-checkbox\"]');
            if (checkbox && !checkbox.checked) {
                checkbox.click();
                console.log('[CDP] Mock 开关已勾选');
            }
        \`
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 点击锦标赛卡片（找到 1 / 2 玩家的）
    await Runtime.evaluate({
        expression: \`
            const cards = document.querySelectorAll('.sc-bypJrT.ilegoF');
            for (const card of cards) {
                if ((card.innerText || '').includes('1 / 2')) {
                    card.click();
                    console.log('[CDP] 已点击锦标赛卡片');
                    return;
                }
            }
            console.log('[CDP] 未找到锦标赛卡片');
        \`
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    // 点击 Confirm 加入
    await Runtime.evaluate({
        expression: \`
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent.trim() === 'Confirm') {
                    btn.click();
                    console.log('[CDP] 已点击 Confirm');
                    return;
                }
            }
            console.log('[CDP] 未找到 Confirm 按钮');
        \`
    });
    
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('[CDP] 已加入游戏，等待游戏开始...');
    
    await client.close();
}

joinGame().catch(console.error);
"

log "✅ 已加入游戏"

# Step 4: 等待游戏完成
log "[4] 等待游戏完成（约30秒）..."
sleep 30

# Step 5: 检查是否有 NFT 成就弹窗
log "[5] 检查 NFT 成就弹窗并点击锻造..."
node -e "
const CDP = require('chrome-remote-interface');

async function checkNFTModal() {
    const client = await CDP({ port: 9222 });
    const { Runtime } = client;
    
    // 检查 NFT 弹窗是否存在
    const result = await Runtime.evaluate({
        expression: \`
            const modal = document.querySelector('.swal2-popup');
            const nftTitle = document.querySelector('.swal2-title');
            if (modal && nftTitle && nftTitle.textContent.includes('成就达成')) {
                console.log('[CDP] 检测到 NFT 成就弹窗:', nftTitle.textContent);
                true;
            } else {
                console.log('[CDP] 未检测到 NFT 成就弹窗');
                false;
            }
        \`
    });
    
    if (result.result.value) {
        // 点击"锻造 NFT"按钮
        await Runtime.evaluate({
            expression: \`
                const buttons = document.querySelectorAll('.swal2-confirm');
                for (const btn of buttons) {
                    if (btn.textContent.includes('锻造 NFT')) {
                        btn.click();
                        console.log('[CDP] 已点击锻造 NFT 按钮');
                        return;
                    }
                }
                console.log('[CDP] 未找到锻造 NFT 按钮');
            \`
        });
        
        console.log('[CDP] 等待 TronLink 签名请求...');
    }
    
    await client.close();
}

checkNFTModal().catch(console.error);
"

# Step 6: 处理 TronLink 签名
log "[6] 处理 TronLink 签名..."
sleep 3

# 检查 TronLink 窗口
window_check=$(osascript -e 'tell application "Google Chrome" to get name of every window' 2>/dev/null || echo "")
if [[ "$window_check" != *"TronLink"* ]]; then
    warn "TronLink 窗口未出现，点击图标..."
    cliclick c:$TRONLINK_ICON_X,$TRONLINK_ICON_Y
    sleep 3
fi

# 截取 TronLink 窗口
screencapture -x -R${TL_X},${TL_Y},${TL_W},${TL_H} /tmp/tl-nft-window.png
tl_content=$(swift ocr-vision.swift /tmp/tl-nft-window.png 2>/dev/null | grep -i "sign\|签名\|confirm" || echo "未检测到签名按钮")
log "TronLink 内容: $tl_content"

# 点击签名按钮（多次尝试）
log "点击签名按钮..."
for i in {1..3}; do
    cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
    sleep 1
done

log "✅ 已点击签名按钮 3 次"

# Step 7: 等待锻造完成
log "[7] 等待 NFT 锻造完成（15秒）..."
sleep 15

# Step 8: 验证 NFT 是否锻造成功
log "[8] 验证 NFT 是否锻造成功..."

# 查询数据库中的 NFT
NFT_COUNT=$(node -e "
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

async function checkNFT() {
    await mongoose.connect('mongodb://localhost:27017/poker-game');
    const nfts = await NFTClaim.findByPlayer('$PLAYER1_ADDRESS');
    console.log(nfts.length);
    await mongoose.disconnect();
}

checkNFT().catch(() => console.log(0));
" 2>/dev/null || echo "0")

log "数据库中 NFT 数量: $NFT_COUNT"

# 查询链上 NFT（通过 Tronscan API）
log "查询链上 NFT..."
CHAIN_NFT_COUNT=$(curl -s "https://nile.tronscan.org/api/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC/holders?address=$PLAYER1_ADDRESS" | node -e "
const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
const count = data.data?.[0]?.balance || 0;
console.log(count);
" 2>/dev/null || echo "0")

log "链上 NFT 数量: $CHAIN_NFT_COUNT"

# Step 9: 截图保存结果
log "[9] 保存截图..."
screencapture -x /tmp/nft-final-result.png
cp /tmp/nft-final-result.png test-results/ 2>/dev/null || true
cp /tmp/tl-nft-window.png test-results/ 2>/dev/null || true

# 清理
log "[10] 清理资源..."
kill $BOT_PID 2>/dev/null || true

log "=========================================="
log "  ✅ 流程完成！"
log "  数据库 NFT: $NFT_COUNT"
log "  链上 NFT: $CHAIN_NFT_COUNT"
log "=========================================="

if [ "$NFT_COUNT" -gt 0 ]; then
    log "🎉 NFT 锻造成功！"
    log "查看 NFT: https://nile.tronscan.org/#/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC"
else
    warn "⚠️ 未检测到 NFT 锻造成功"
    log "请检查："
    log "1. 游戏是否完成（查看 bot.log）"
    log "2. TronLink 签名是否成功（查看截图）"
    log "3. 前端控制台日志（浏览器开发者工具）"
fi
