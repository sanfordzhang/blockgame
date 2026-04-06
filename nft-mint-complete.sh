#!/bin/bash
# === NFT锻造 + 自动签名完整流程 ===
# 使用 OCR + cliclick，自动完成NFT锻造签名
# 参考: deposit-auto-final.sh

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

# 固定坐标（来自deposit-auto-final.sh验证）
TRONLINK_ICON_X=1238
TRONLINK_ICON_Y=50
SIGN_BTN_X=1414
SIGN_BTN_Y=635

# TronLink 窗口参数
TL_X=1127
TL_Y=34
TL_W=385
TL_H=953

# NFT合约地址
NFT_CONTRACT="TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC"
PLAYER_ADDRESS="TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv"

log "=========================================="
log "  NFT锻造 + 自动签名流程"
log "=========================================="

# Step 0: 截取当前页面
log "[0] 截取当前页面..."
screencapture -x /tmp/nft-before.png
cp /tmp/nft-before.png test-results/nft-before.png 2>/dev/null || true

# OCR检测锻造按钮
before_content=$(swift ocr-vision.swift /tmp/nft-before.png 2>/dev/null || echo "")
log "当前页面内容检测..."
echo "$before_content" | grep -i "锻造\|NFT\|Mint\|成就" && log "✓ 检测到NFT相关内容" || log "未检测到NFT内容"

# Step 1: 尝试点击页面上的锻造按钮（如果有）
log "[1] 检查是否有锻造按钮..."

# 使用CDP查找并点击锻造按钮
CLICK_RESULT=$(node -e "
const CDP = require('chrome-remote-interface');
(async () => {
    try {
        const client = await CDP({ port: 9222 });
        const { Runtime } = client;
        await Runtime.enable();
        
        const result = await Runtime.evaluate({
            expression: \`
                (function() {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        const text = btn.textContent.trim();
                        if (text.includes('锻造') || text.includes('NFT') || text.includes('Mint') || text.includes('铸造')) {
                            if (!btn.disabled) {
                                btn.click();
                                return 'CLICKED:' + text;
                            }
                        }
                    }
                    
                    // 检查成就弹窗
                    const achievement = document.querySelector('[class*=\"achievement\"], [class*=\"nft-achievement\"]');
                    if (achievement) {
                        const ab = achievement.querySelectorAll('button');
                        for (const btn of ab) {
                            if (!btn.disabled && (btn.textContent.includes('锻造') || btn.textContent.includes('Mint'))) {
                                btn.click();
                                return 'CLICKED_POPUP:' + btn.textContent.trim();
                            }
                        }
                    }
                    
                    return 'NOT_FOUND';
                })()
            \`,
            returnByValue: true
        });
        
        console.log(result.result.value);
        await client.close();
    } catch (e) {
        console.log('ERROR:' + e.message);
    }
})();
" 2>&1)

log "CDP点击结果: $CLICK_RESULT"

if [[ "$CLICK_RESULT" == CLICKED:* ]]; then
    log "✓ 已点击锻造按钮: ${CLICK_RESULT#CLICKED:}"
    sleep 3
elif [[ "$CLICK_RESULT" == CLICKED_POPUP:* ]]; then
    log "✓ 已点击弹窗锻造按钮: ${CLICK_RESULT#CLICKED_POPUP:}"
    sleep 3
else
    warn "未找到锻造按钮，继续检查TronLink..."
fi

# Step 2: 截取状态
log "[2] 截取当前状态..."
screencapture -x /tmp/nft-after-click.png
cp /tmp/nft-after-click.png test-results/nft-after-click.png 2>/dev/null || true

# Step 3: 点击TronLink图标打开窗口
log "[3] 点击TronLink图标..."
cliclick c:$TRONLINK_ICON_X,$TRONLINK_ICON_Y
sleep 2

# 截取TronLink窗口
log "[4] 截取TronLink窗口..."
screencapture -x -R${TL_X},${TL_Y},${TL_W},${TL_H} /tmp/tl-nft.png
cp /tmp/tl-nft.png test-results/tl-nft.png 2>/dev/null || true

# OCR检测TronLink内容
tl_content=$(swift ocr-vision.swift /tmp/tl-nft.png 2>/dev/null || echo "")
log "TronLink窗口内容:"
echo "$tl_content" | head -20

# 检测是否有签名按钮
if echo "$tl_content" | grep -qi "sign\|签名\|confirm"; then
    log "✓ 检测到签名请求"
    
    # Step 4: 点击签名按钮（多次点击确保成功）
    log "[5] 点击签名按钮..."
    cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
    sleep 1
    cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
    sleep 1
    cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
    
    log "✓ 已点击签名按钮 3 次"
    
    # Step 5: 等待交易确认
    log "[6] 等待交易确认 (10秒)..."
    sleep 10
    
    # Step 6: 验证结果
    log "[7] 验证NFT锻造结果..."
    screencapture -x /tmp/nft-final.png
    cp /tmp/nft-final.png test-results/nft-final.png 2>/dev/null || true
    
    final_content=$(swift ocr-vision.swift /tmp/nft-final.png 2>/dev/null || echo "")
    echo "$final_content" | grep -i "success\|成功\|NFT\|成就" && log "✓ 可能锻造成功" || log "请检查截图确认"
    
else
    warn "未检测到签名请求，可能需要先触发锻造"
fi

# Step 7: 查询区块链验证
log "[8] 查询Tronscan验证NFT..."
TRONSCAN_CHECK=$(curl -s "https://nileapi.tronscan.org/api/token/tokens?address=${PLAYER_ADDRESS}&limit=20" 2>/dev/null || echo "{}")

# 检查是否包含NFT合约
if echo "$TRONSCAN_CHECK" | grep -q "$NFT_CONTRACT"; then
    log "🎉 在Tronscan上找到NFT合约 $NFT_CONTRACT"
else
    log "Tronscan暂未显示NFT（可能需要几秒确认时间）"
fi

# 输出链接
log "=========================================="
log "  流程完成！"
log "  NFT合约: https://nile.tronscan.org/#/token20/${NFT_CONTRACT}"
log "  钱包地址: https://nile.tronscan.org/#/address/${PLAYER_ADDRESS}"
log "=========================================="
