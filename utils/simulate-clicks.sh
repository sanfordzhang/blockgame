#!/bin/bash

source test-results/mouse-click-log.txt

TRONLINK_X=$(echo $CLICK_1 | cut -d',' -f1)
TRONLINK_Y=$(echo $CLICK_1 | cut -d',' -f2)
COLLECT_X=$(echo $CLICK_2 | cut -d',' -f1)
COLLECT_Y=$(echo $CLICK_2 | cut -d',' -f2)

echo "=== 模拟点击操作 ==="
echo "TronLink图标: ($TRONLINK_X, $TRONLINK_Y)"
echo "收藏品位置: ($COLLECT_X, $COLLECT_Y)"
echo ""

# 点击TronLink图标
echo "1. 点击TronLink图标..."
cliclick c:$TRONLINK_X,$TRONLINK_Y
sleep 2

screencapture -x test-results/after-tronlink-click.png
echo "✅ 截图: after-tronlink-click.png"
echo ""

# 点击收藏品
echo "2. 点击收藏品..."
cliclick c:$COLLECT_X,$COLLECT_Y
sleep 2

screencapture -x test-results/after-collectibles-click.png
echo "✅ 截图: after-collectibles-click.png"
echo ""

echo "✅ 完成！请查看截图确认NFT收藏品界面"
