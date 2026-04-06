#!/bin/bash
# === Deposit + 自动签名完整流程 ===
# 使用 OCR + cliclick，默认充值 100 TRX

set -e

cd /Users/yingfengzhang/1JackSource/blockchain/game-core

log() { echo -e "\033[0;32m[$(date +%H:%M:%S)]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }

# 截图
screenshot() {
    screencapture -x "$1"
    log "📸 $1"
}

# OCR 查找按钮
find_button() {
    local img="$1"
    local text="$2"
    local result=$(swift ocr-vision.swift "$img" 2>/dev/null | grep -i "$text" | /usr/bin/head -n 1)
    if [[ -n "$result" ]]; then
        local x=$(echo "$result" | sed 's/.*"x": *\([0-9]*\).*/\1/')
        local y=$(echo "$result" | sed 's/.*"y": *\([0-9]*\).*/\1/')
        echo "$x $y"
        return 0
    fi
    return 1
}

log "=========================================="
log "  Deposit + 自动签名流程 (100 TRX)"
log "=========================================="

# Step 0: 关闭可能存在的弹窗
log "[0] 关闭可能存在的弹窗..."
cliclick c:400,400
sleep 1

# Step 1: 检测 Deposit 按钮
log "[1] 检测 Deposit 按钮..."
screenshot "/tmp/dp-step1.png"
deposit_pos=$(find_button "/tmp/dp-step1.png" "deposit")
if [[ -z "$deposit_pos" ]]; then
    warn "OCR 未检测到 Deposit，使用默认坐标 (718, 788)"
    deposit_x=718
    deposit_y=788
else
    deposit_x=$(echo $deposit_pos | cut -d' ' -f1)
    deposit_y=$(echo $deposit_pos | cut -d' ' -f2)
    log "✅ Deposit 按钮位置: ($deposit_x, $deposit_y)"
fi

# Step 2: 点击 Deposit
log "[2] 点击 Deposit 按钮..."
cliclick m:$deposit_x,$deposit_y
sleep 0.5
cliclick c:$deposit_x,$deposit_y

# Step 3: 等待按钮状态变化
log "[3] 等待处理 (5秒)..."
sleep 5

# Step 4: 截图检测签名弹窗
log "[4] 检测签名弹窗..."
screenshot "/tmp/dp-step4.png"

# 检查按钮状态
btn_state=$(swift ocr-vision.swift "/tmp/dp-step4.png" 2>/dev/null | grep -i "depositing\|deposit" | /usr/bin/head -n 1)
log "按钮状态: $btn_state"

# Step 5: 点击 TronLink 图标打开签名窗口
log "[5] 打开 TronLink 签名窗口..."
cliclick m:1364,100
sleep 0.3
cliclick c:1364,100
sleep 3

# 截图
screenshot "/tmp/dp-step5-tronlink.png"

# Step 6: 检测签名按钮
log "[6] 检测签名按钮..."
sign_pos=$(find_button "/tmp/dp-step5-tronlink.png" "sign\|签名\|confirm\|确认")
if [[ -z "$sign_pos" ]]; then
    warn "OCR 未检测到签名按钮，使用文档坐标 (1414, 635)"
    sign_x=1414
    sign_y=635
else
    sign_x=$(echo $sign_pos | cut -d' ' -f1)
    sign_y=$(echo $sign_pos | cut -d' ' -f2)
    log "✅ 签名按钮位置: ($sign_x, $sign_y)"
fi

# Step 7: 点击签名按钮（多次点击确保触发）
log "[7] 点击签名按钮..."
cliclick m:$sign_x,$sign_y
sleep 1
cliclick c:$sign_x,$sign_y
sleep 2
cliclick c:$sign_x,$sign_y
sleep 2
cliclick c:$sign_x,$sign_y
log "✅ 已点击签名按钮 3 次"

# Step 8: 等待交易确认
log "[8] 等待交易确认 (10秒)..."
sleep 10

# Step 9: 截图验证结果
log "[9] 验证结果..."
screenshot "/tmp/dp-step9-result.png"

# 复制截图
cp /tmp/dp-step*.png test-results/ 2>/dev/null || true

log "=========================================="
log "  流程完成！截图已保存到 test-results/"
log "=========================================="
