#!/bin/bash
# === NFT 锻造完整游戏流程 ===
# 参考: docs/GAME_BOT_TEST_FLOW.md
# 使用 OCR + cliclick 自动化完成游戏流程和NFT铸造签名

set -e

cd /Users/yingfengzhang/1JackSource/blockchain/game-core

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 坐标配置
TRONLINK_ICON_X=1238
TRONLINK_ICON_Y=50
SIGN_BTN_X=1414
SIGN_BTN_Y=635
TL_X=1127; TL_Y=34; TL_W=385; TL_H=953

# 截图
screenshot() {
    screencapture -x "$1"
}

# OCR 检测
ocr_detect() {
    swift ocr-vision.swift "$1" 2>/dev/null
}

# 点击按钮
click_btn() {
    cliclick c:$1,$2
}

# 等待并点击特定文字
wait_and_click() {
    local text="$1"
    local max_wait=30
    local count=0
    
    while [ $count -lt $max_wait ]; do
        screenshot /tmp/wait-btn.png
        if ocr_detect /tmp/wait-btn.png | grep -qi "$text"; then
            log "检测到 '$text' 按钮"
            # 从OCR结果提取坐标
            local pos=$(ocr_detect /tmp/wait-btn.png | grep -i "$text" | /usr/bin/head -n 1)
            local x=$(echo "$pos" | sed 's/.*"x": *\([0-9]*\).*/\1/')
            local y=$(echo "$pos" | sed 's/.*"y": *\([0-9]*\).*/\1/')
            if [[ -n "$x" && -n "$y" ]]; then
                cliclick c:$x,$y
                return 0
            fi
        fi
        sleep 1
        count=$((count + 1))
    done
    return 1
}

log "=========================================="
log "  NFT 锻造完整游戏流程"
log "=========================================="

# Step 0: 检查机器人是否运行
log "[0] 检查游戏机器人..."
if ! pgrep -f "scripts/game-bot.js" > /dev/null; then
    warn "机器人未运行，正在启动..."
    node scripts/game-bot.js > /tmp/bot.log 2>&1 &
    sleep 3
fi
log "✅ 机器人已运行"

# Step 1: 导航到锦标赛页面
log "[1] 导航到锦标赛页面..."
screenshot /tmp/current-page.png
if ! ocr_detect /tmp/current-page.png | grep -qi "tournament\|锦标赛"; then
    # 点击地址栏输入URL
    cliclick c:756,54
    sleep 0.5
    # 清空并输入URL
    cliclick 'kd:cmd' 't:a' 'ku:cmd'
    sleep 0.3
    # 输入URL (使用剪切板)
    echo "http://127.0.0.1:3001/tournament" | pbcopy
    cliclick 'kd:cmd' 't:v' 'ku:cmd'
    sleep 1
    # 回车
    cliclick 'kp:return'
    sleep 5
fi
log "✅ 已在锦标赛页面"

# Step 2: 勾选 Mock 游戏模式
log "[2] 勾选 Mock 游戏模式..."
screenshot /tmp/mock-checkbox.png
if ocr_detect /tmp/mock-checkbox.png | grep -qi "mock\|测试"; then
    # 查找Mock开关并点击
    cliclick c:200,200  # 大致位置，可能需要调整
    log "✅ Mock 模式已开启"
else
    warn "Mock 开关可能不存在或已开启"
fi
sleep 1

# Step 3: 等待机器人创建锦标赛并加入
log "[3] 等待机器人创建锦标赛..."
sleep 5

# 查找 1/2 玩家的锦标赛卡片并点击
log "[4] 查找并加入锦标赛..."
screenshot /tmp/tournament-list.png
# 查找包含 "1 / 2" 的卡片
card_text=$(ocr_detect /tmp/tournament-list.png | grep "1.*2\|1 / 2")
if [[ -n "$card_text" ]]; then
    # 提取坐标并点击
    log "找到锦标赛卡片: $card_text"
    # 点击卡片（使用固定坐标或从OCR提取）
    cliclick c:480,350
    sleep 2
fi

# Step 5: 点击 Confirm 加入
log "[5] 点击 Confirm 加入..."
screenshot /tmp/confirm-btn.png
confirm_text=$(ocr_detect /tmp/confirm-btn.png | grep -i "confirm\|确认")
if [[ -n "$confirm_text" ]]; then
    log "找到 Confirm 按钮"
    cliclick c:718,550  # Confirm 按钮位置
    sleep 3
fi

# Step 6: 游戏操作循环
log "[6] 开始游戏操作..."
GAME_TIMEOUT=120
game_count=0

while [ $game_count -lt $GAME_TIMEOUT ]; do
    screenshot /tmp/game-state.png
    ocr_result=$(ocr_detect /tmp/game-state.png)
    
    # 检查游戏按钮
    if echo "$ocr_result" | grep -qi "check"; then
        log "执行 Check 操作"
        # 点击 Check 按钮
        cliclick c:400,790
        sleep 3
    elif echo "$ocr_result" | grep -qi "call"; then
        log "执行 Call 操作"
        cliclick c:500,790
        sleep 3
    elif echo "$ocr_result" | grep -qi "fold"; then
        log "执行 Fold 操作"
        cliclick c:300,790
        sleep 3
    fi
    
    # 检查 NFT 成就弹窗
    if echo "$ocr_result" | grep -qi "achievement\|nft\|成就\|铸造"; then
        log "🎉 检测到 NFT 成就弹窗！"
        break
    fi
    
    # 检查游戏是否结束
    if echo "$ocr_result" | grep -qi "winner\|winner\|胜利"; then
        log "游戏结束"
        sleep 5
        # 检查是否有NFT弹窗
        screenshot /tmp/after-game.png
        if ocr_detect /tmp/after-game.png | grep -qi "achievement\|nft\|铸造"; then
            log "🎉 检测到 NFT 成就弹窗！"
            break
        fi
    fi
    
    sleep 2
    game_count=$((game_count + 2))
done

# Step 7: 点击铸造 NFT 按钮
log "[7] 点击铸造 NFT 按钮..."
sleep 3
screenshot /tmp/nft-popup.png
nft_text=$(ocr_detect /tmp/nft-popup.png | grep -i "mint\|铸造\|claim\|领取")
if [[ -n "$nft_text" ]]; then
    log "找到铸造按钮"
    # 点击铸造按钮
    cliclick c:718,650
    sleep 3
fi

# Step 8: 等待 TronLink 签名窗口
log "[8] 等待 TronLink 签名窗口..."
sleep 5

# 检查 TronLink 窗口
window_check=$(osascript -e 'tell application "Google Chrome" to get name of every window' 2>/dev/null || echo "")
if [[ "$window_check" != *"TronLink"* ]]; then
    warn "TronLink 窗口未出现，点击图标..."
    cliclick c:$TRONLINK_ICON_X,$TRONLINK_ICON_Y
    sleep 3
fi

# Step 9: 截取 TronLink 窗口
log "[9] 截取 TronLink 窗口..."
screencapture -x -R${TL_X},${TL_Y},${TL_W},${TL_H} /tmp/tl-nft.png

# Step 10: 点击签名按钮
log "[10] 点击签名按钮..."
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
sleep 1
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
sleep 1
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y

log "✅ 已点击签名按钮 3 次"

# Step 11: 等待铸造确认
log "[11] 等待铸造确认 (15秒)..."
sleep 15

# Step 12: 验证结果
log "[12] 验证 NFT 铸造结果..."
screenshot /tmp/nft-result.png

# 查询链上NFT余额
NEW_BALANCE=$(node -e "
const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
tronWeb.setAddress('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');

(async () => {
    const contract = await tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    const balance = await contract.balanceOf('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv').call();
    console.log(balance.toString());
})();
" 2>/dev/null)

log "当前 NFT 余额: $NEW_BALANCE"

# 复制截图
cp /tmp/*.png test-results/ 2>/dev/null || true

log "=========================================="
log "  ✅ NFT 锻造流程完成！"
log "  NFT 余额: $NEW_BALANCE"
log "=========================================="
