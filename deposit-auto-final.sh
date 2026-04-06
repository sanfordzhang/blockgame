#!/bin/bash
# === Deposit + 自动签名完整流程 ===
# 使用 OCR + cliclick，默认充值 100 TRX
# 参考: docs/Tronlink_Deposit_AutoSign.md

set -e

cd /Users/yingfengzhang/1JackSource/blockchain/game-core

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 固定坐标（来自文档和测试验证）
DEPOSIT_BTN_X=717
DEPOSIT_BTN_Y=790
TRONLINK_ICON_X=1238
TRONLINK_ICON_Y=50
SIGN_BTN_X=1414
SIGN_BTN_Y=635

# TronLink 窗口参数
TL_X=1127
TL_Y=34
TL_W=385
TL_H=953

log "=========================================="
log "  Deposit + 自动签名流程 (100 TRX)"
log "=========================================="

# Step 0: 刷新页面重置状态
log "[0] 刷新页面..."
cliclick 'kd:cmd' 't:r' 'ku:cmd'
sleep 5

# 关闭可能存在的 TronLink 窗口
osascript -e 'tell application "Google Chrome" to try to close window "TronLink"' 2>/dev/null || true
sleep 1

# 获取初始余额
screencapture -x /tmp/before-deposit.png
before_balance=$(swift ocr-vision.swift /tmp/before-deposit.png 2>/dev/null | grep -o "Game Balance.*TRX" | /usr/bin/head -n 1)
log "初始余额: $before_balance"

# Step 1: 点击 Deposit 按钮
log "[1] 点击 Deposit 按钮..."
cliclick c:$DEPOSIT_BTN_X,$DEPOSIT_BTN_Y

# Step 2: 等待 TronLink 签名请求
log "[2] 等待 TronLink 签名请求..."
sleep 3

# 检查 TronLink 窗口
window_check=$(osascript -e 'tell application "Google Chrome" to get name of every window' 2>/dev/null || echo "")
if [[ "$window_check" != *"TronLink"* ]]; then
    warn "TronLink 窗口未出现，点击图标..."
    cliclick c:$TRONLINK_ICON_X,$TRONLINK_ICON_Y
    sleep 3
fi

# Step 3: 截取 TronLink 窗口
log "[3] 截取 TronLink 窗口..."
screencapture -x -R${TL_X},${TL_Y},${TL_W},${TL_H} /tmp/tl-window.png

# OCR 检测（可选，用于日志）
tl_content=$(swift ocr-vision.swift /tmp/tl-window.png 2>/dev/null | grep -i "sign\|签名\|confirm" || echo "未检测到签名按钮")
log "TronLink 内容: $tl_content"

# Step 4: 点击签名按钮（文档建议多次点击）
log "[4] 点击签名按钮..."
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
sleep 1
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
sleep 1
cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y

log "✅ 已点击签名按钮 3 次"

# Step 5: 等待交易确认
log "[5] 等待交易确认 (10秒)..."
sleep 10

# Step 6: 验证结果
log "[6] 验证结果..."
screencapture -x /tmp/after-deposit.png
after_balance=$(swift ocr-vision.swift /tmp/after-deposit.png 2>/dev/null | grep -o "Game Balance.*TRX" | /usr/bin/head -n 1)
log "最终余额: $after_balance"

# 检查按钮状态
btn_state=$(swift ocr-vision.swift /tmp/after-deposit.png 2>/dev/null | grep -o '"text":"Deposit"' && echo "按钮已重置" || echo "按钮可能仍在处理")

# 复制截图
cp /tmp/before-deposit.png test-results/ 2>/dev/null || true
cp /tmp/tl-window.png test-results/ 2>/dev/null || true
cp /tmp/after-deposit.png test-results/ 2>/dev/null || true

log "=========================================="
log "  ✅ 流程完成！"
log "  之前: $before_balance"
log "  之后: $after_balance"
log "=========================================="
