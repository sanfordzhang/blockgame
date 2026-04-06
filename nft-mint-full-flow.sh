#!/bin/bash
# === NFT 锻造完整游戏流程 ===
# 确保 Mock 模式开启，完成游戏流程并铸造 NFT

set -e

cd /Users/yingfengzhang/1JackSource/blockchain/game-core

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 坐标配置
SIGN_BTN_X=1414
SIGN_BTN_Y=635
TL_X=1127; TL_Y=34; TL_W=385; TL_H=953

log "=========================================="
log "  NFT 锻造完整游戏流程"
log "=========================================="

# Step 0: 启动机器人
log "[0] 启动机器人..."
if ! pgrep -f "scripts/game-bot.js" > /dev/null; then
    node scripts/game-bot.js > /tmp/bot.log 2>&1 &
    sleep 3
fi
log "✅ 机器人已运行"

# Step 1: 关闭所有 Chrome 窗口，重新打开
log "[1] 重新打开 Chrome..."
osascript -e 'tell application "Google Chrome" to close every window' 2>/dev/null || true
sleep 2

# 打开新的 Chrome 窗口
open -a "Google Chrome" "http://127.0.0.1:3001/tournament"
sleep 8

# Step 2: 检查页面并点击 Mock 开关
log "[2] 点击 Mock 开关..."
screencapture -x /tmp/step2-mock.png

# OCR 查找 Mock 开关位置
cd /Users/yingfengzhang/1JackSource/blockchain/game-core
MOCK_POS=$(swift ocr-vision.swift /tmp/step2-mock.png 2>/dev/null | grep -i "mock\|游戏模式" | /usr/bin/head -n 1)

if [[ -n "$MOCK_POS" ]]; then
    log "找到 Mock 开关: $MOCK_POS"
    # 点击 Mock 开关区域 (根据代码位置，应该在页面中部偏上)
    cliclick c:200,550
    sleep 1
    log "✅ Mock 模式已开启"
else
    warn "未找到 Mock 开关，继续..."
fi

# Step 3: 等待机器人创建锦标赛
log "[3] 等待机器人创建锦标赛..."
sleep 5

# Step 4: 刷新页面查看新锦标赛
log "[4] 刷新页面..."
cliclick 'kd:cmd' 't:r' 'ku:cmd'
sleep 5

screencapture -x /tmp/step4-list.png

# Step 5: 查找并点击 WAITING 状态的锦标赛
log "[5] 查找 WAITING 锦标赛..."
LIST_OCR=$(swift ocr-vision.swift /tmp/step4-list.png 2>/dev/null)
WAITING_POS=$(echo "$LIST_OCR" | grep -i "waiting\|1.*2" | /usr/bin/head -n 1)

if [[ -n "$WAITING_POS" ]]; then
    log "找到 WAITING 锦标赛"
    # 点击锦标赛卡片
    cliclick c:700,800
    sleep 3
fi

# Step 6: 点击 Confirm 加入
log "[6] 点击 Confirm..."
screencapture -x /tmp/step6-confirm.png
CONFIRM_OCR=$(swift ocr-vision.swift /tmp/step6-confirm.png 2>/dev/null)

if echo "$CONFIRM_OCR" | grep -qi "confirm"; then
    cliclick c:754,618
    sleep 5
fi

# Step 7: 游戏操作循环
log "[7] 开始游戏操作..."
for i in $(seq 1 20); do
    screencapture -x /tmp/game-round-$i.png
    OCR=$(swift ocr-vision.swift /tmp/game-round-$i.png 2>/dev/null)
    
    # 检查 NFT
    if echo "$OCR" | grep -qi "achievement\|nft\|成就\|铸造\|straight\|顺子"; then
        log "🎉 检测到 NFT 成就！"
        break
    fi
    
    # 操作
    if echo "$OCR" | grep -qi '"text":"Check"'; then
        cliclick c:606,876
    elif echo "$OCR" | grep -qi '"text":"Call"'; then
        cliclick c:687,876
    fi
    
    sleep 2
done

# Step 8: 点击铸造 NFT 按钮
log "[8] 点击铸造 NFT..."
sleep 3
screencapture -x /tmp/step8-nft.png
NFT_OCR=$(swift ocr-vision.swift /tmp/step8-nft.png 2>/dev/null)

if echo "$NFT_OCR" | grep -qi "mint\|铸造"; then
    cliclick c:718,650
    sleep 3
fi

# Step 9: 等待 TronLink 签名窗口
log "[9] 等待签名窗口..."
sleep 5

# 检查 TronLink 窗口
window_check=$(osascript -e 'tell application "Google Chrome" to get name of every window' 2>/dev/null || echo "")
if [[ "$window_check" != *"TronLink"* ]]; then
    cliclick c:1238,50
    sleep 3
fi

# Step 10: 点击签名按钮
log "[10] 点击签名按钮..."
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
sleep 1
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
sleep 1
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y

log "✅ 已点击签名按钮"

# Step 11: 等待铸造确认
log "[11] 等待铸造确认..."
sleep 15

# Step 12: 验证结果
log "[12] 验证 NFT 余额..."
NEW_BALANCE=$(node -e "
const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
tronWeb.setAddress('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv');
(async () => {
    const c = await tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
    const b = await c.balanceOf('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv').call();
    console.log(b.toString());
})();
" 2>/dev/null)

log "=========================================="
log "  ✅ 流程完成！NFT 余额: $NEW_BALANCE"
log "=========================================="

# 复制截图
cp /tmp/*.png test-results/ 2>/dev/null || true
