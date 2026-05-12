#!/bin/bash
# ========================================
# 完整 Deposit + 自动签名流程
# 参考: docs/Tronlink_Deposit_AutoSign.md
# ========================================

AMOUNT=${1:-10}
echo "========================================"
echo " 完整 Deposit + 自动签名流程"
echo "========================================"
echo "充值金额: ${AMOUNT} TRX"

# 坐标配置（来自文档）
DEPOSIT_X=718
DEPOSIT_Y=788
SIGN_X=1406
SIGN_Y=638

# Step 1: 关闭可能存在的弹窗
echo "[1] 关闭可能存在的弹窗..."
cliclick c:400,400
sleep 1

# Step 2: 点击 Deposit 按钮
echo "[2] 点击 Deposit 按钮..."
cliclick m:${DEPOSIT_X},${DEPOSIT_Y} && sleep 0.5 && cliclick c:${DEPOSIT_X},${DEPOSIT_Y}
sleep 2

# Step 3: 输入金额
echo "[3] 输入金额 ${AMOUNT}..."
INPUT_Y=$((DEPOSIT_Y - 100))
cliclick m:${DEPOSIT_X},${INPUT_Y} && sleep 0.3 && cliclick c:${DEPOSIT_X},${INPUT_Y}
sleep 0.5

# 清空并输入
cliclick kp:delete && sleep 0.1 && cliclick kp:delete
for char in $(echo $AMOUNT | grep -o .); do
    cliclick t:$char
    sleep 0.1
done

# Step 4: 点击确认
echo "[4] 点击确认..."
sleep 0.5
cliclick c:${DEPOSIT_X},${DEPOSIT_Y}

# Step 5: 等待签名弹窗
echo "[5] 等待签名弹窗（5秒）..."
sleep 5

# 截图保存
screencapture -x /tmp/deposit-before-sign.png
echo "📸 截图: /tmp/deposit-before-sign.png"

# Step 6: 自动签名（三次点击）
echo "[6] 自动签名..."
echo "  第一次点击（聚焦）..."
cliclick m:${SIGN_X},${SIGN_Y}
sleep 2

echo "  第二次点击（确认）..."
cliclick c:${SIGN_X},${SIGN_Y}
sleep 2

echo "  第三次点击（确保）..."
cliclick c:${SIGN_X},${SIGN_Y}
sleep 2

# Step 7: 等待交易确认
echo "[7] 等待交易确认（10秒）..."
sleep 10

# 最终截图
screencapture -x /tmp/deposit-result.png
echo "📸 截图: /tmp/deposit-result.png"

echo ""
echo "========================================"
echo " 流程完成"
echo "========================================"
echo "请检查截图验证结果:"
echo "  /tmp/deposit-before-sign.png"
echo "  /tmp/deposit-result.png"
