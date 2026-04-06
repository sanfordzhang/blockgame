#!/bin/bash
# === Deposit + 自动签名完整流程 ===
# 使用 OCR 检测按钮位置，cliclick 模拟点击

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# OCR 检测按钮位置 (使用 Swift Vision)
find_button() {
    local image_path="$1"
    local search_text="$2"
    
    # 使用 swift OCR
    result=$(swift ocr-vision.swift "$image_path" 2>/dev/null | \
        grep -i "$search_text" | /usr/bin/head -n 1)
    
    if [[ -n "$result" ]]; then
        # 提取坐标
        x=$(echo "$result" | sed 's/.*"x": *\([0-9]*\).*/\1/')
        y=$(echo "$result" | sed 's/.*"y": *\([0-9]*\).*/\1/')
        echo "$x $y"
        return 0
    fi
    return 1
}

# 截图
screenshot() {
    local path="$1"
    screencapture -x "$path"
    log "📸 截图: $path"
}

# 主流程
main() {
    log "=========================================="
    log "  Deposit + 自动签名流程开始"
    log "=========================================="
    
    # Step 0: 关闭可能存在的弹窗
    log "[0] 关闭可能存在的弹窗..."
    cliclick c:400,400
    sleep 1
    
    # Step 1: 截图检测 Deposit 按钮
    log "[1] 检测 Deposit 按钮位置..."
    screenshot "/tmp/step1-deposit-page.png"
    
    # OCR 查找 Deposit 按钮
    deposit_pos=$(find_button "/tmp/step1-deposit-page.png" "deposit")
    
    if [[ -z "$deposit_pos" ]]; then
        warn "OCR 未找到 Deposit 按钮，使用默认坐标 (718, 788)"
        deposit_x=718
        deposit_y=788
    else
        deposit_x=$(echo $deposit_pos | cut -d' ' -f1)
        deposit_y=$(echo $deposit_pos | cut -d' ' -f2)
        log "✅ Deposit 按钮位置: ($deposit_x, $deposit_y)"
    fi
    
    # Step 2: 点击 Deposit 按钮
    log "[2] 点击 Deposit 按钮..."
    cliclick m:$deposit_x,$deposit_y
    sleep 0.5
    cliclick c:$deposit_x,$deposit_y
    
    # Step 3: 等待 TronLink 签名弹窗
    log "[3] 等待 TronLink 签名弹窗..."
    sleep 5
    
    # Step 4: 截图检测签名按钮
    log "[4] 检测签名按钮位置..."
    screenshot "/tmp/step4-sign-popup.png"
    
    # OCR 查找签名按钮 (支持中英文)
    sign_pos=$(find_button "/tmp/step4-sign-popup.png" "sign\|签名\|confirm\|确认")
    
    if [[ -z "$sign_pos" ]]; then
        warn "OCR 未找到签名按钮，使用文档坐标 (1414, 635)"
        sign_x=1414
        sign_y=635
    else
        sign_x=$(echo $sign_pos | cut -d' ' -f1)
        sign_y=$(echo $sign_pos | cut -d' ' -f2)
        log "✅ 签名按钮位置: ($sign_x, $sign_y)"
    fi
    
    # Step 5: 点击签名按钮（文档建议多次点击）
    log "[5] 点击签名按钮..."
    
    # 第一次点击 - 聚焦窗口
    cliclick m:$sign_x,$sign_y
    sleep 1
    cliclick c:$sign_x,$sign_y
    sleep 2
    
    # 第二次点击 - 确认签名
    cliclick c:$sign_x,$sign_y
    sleep 2
    
    # 第三次点击 - 确保触发
    cliclick c:$sign_x,$sign_y
    
    log "✅ 已点击签名按钮 3 次"
    
    # Step 6: 等待交易确认
    log "[6] 等待交易确认 (10秒)..."
    sleep 10
    
    # Step 7: 截图验证结果
    log "[7] 验证交易结果..."
    screenshot "/tmp/step7-result.png"
    
    # OCR 检查结果
    result_check=$(swift ocr-vision.swift "/tmp/step7-result.png" 2>/dev/null | \
        grep -i "success\|成功\|complete\|完成\|error\|失败" | /usr/bin/head -n 3)
    
    if [[ -n "$result_check" ]]; then
        log "交易结果: $result_check"
    else
        log "请检查截图确认结果"
    fi
    
    # 复制截图到项目目录
    cp /tmp/step*.png test-results/ 2>/dev/null || true
    
    log "=========================================="
    log "  Deposit + 签名流程完成"
    log "=========================================="
    log "截图已保存到 test-results/ 目录"
}

main "$@"
