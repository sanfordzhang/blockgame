#!/bin/bash
# === Deposit + 自动签名完整流程 (OCR + cliclick) ===
# 默认充值 100 TRX

set -e

cd /Users/yingfengzhang/1JackSource/blockchain/game-core

log() { echo -e "\033[0;32m[$(date +%H:%M:%S)]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }

# TronLink 窗口位置 (从 Chrome 窗口信息获取)
TRONLINK_X=1127
TRONLINK_Y=34
TRONLINK_W=385
TRONLINK_H=953

# Deposit 按钮坐标 (从 OCR 检测)
DEPOSIT_X=717
DEPOSIT_Y=790

# 签名按钮坐标 (屏幕绝对坐标)
SIGN_X=1414
SIGN_Y=635

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

# Step 1: 点击 Deposit 按钮
log "[1] 点击 Deposit 按钮..."
cliclick c:$DEPOSIT_X,$DEPOSIT_Y

# Step 2: 等待 TronLink 窗口出现
log "[2] 等待 TronLink 窗口..."
sleep 3

# 检查 TronLink 窗口是否存在
window_check=$(osascript -e 'tell application "Google Chrome" to get name of every window' 2>/dev/null)
if [[ "$window_check" != *"TronLink"* ]]; then
    warn "TronLink 窗口未出现，点击图标..."
    cliclick c:1238,50
    sleep 3
fi

# Step 3: 截取 TronLink 窗口并 OCR 检测
log "[3] 检测签名按钮..."
screencapture -x -R${TRONLINK_X},${TRONLINK_Y},${TRONLINK_W},${TRONLINK_H} /tmp/tl-deposit.png

# OCR 检测签名按钮
sign_text=$(swift ocr-vision.swift /tmp/tl-deposit.png 2>/dev/null | grep -i "sign\|签名\|confirm\|approve")

if [[ -n "$sign_text" ]]; then
    log "检测到签名请求: $sign_text"
fi

# Step 4: 点击签名按钮（多次点击确保触发）
log "[4] 点击签名按钮..."
cliclick c:$SIGN_X,$SIGN_Y
sleep 1
cliclick c:$SIGN_X,$SIGN_Y
sleep 1
cliclick c:$SIGN_X,$SIGN_Y

log "✅ 已点击签名按钮 3 次"

# Step 5: 等待交易确认
log "[5] 等待交易确认 (10秒)..."
sleep 10

# Step 6: 验证结果
log "[6] 验证结果..."
screencapture -x /tmp/deposit-result.png

# OCR 检查余额变化
result=$(swift ocr-vision.swift /tmp/deposit-result.png 2>/dev/null | grep -i "Wallet.*TRX\|Game Balance")
log "余额信息: $result"

# 复制截图
cp /tmp/tl-deposit.png test-results/ 2>/dev/null || true
cp /tmp/deposit-result.png test-results/ 2>/dev/null || true

log "=========================================="
log "  流程完成！"
log "=========================================="
