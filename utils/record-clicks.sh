#!/bin/bash

LOG="test-results/mouse-click-log.txt"
> "$LOG"

echo "=== 鼠标点击录制（倒计时方式）==="
echo ""

for i in 1 2; do
    case $i in
        1) label="TronLink钱包图标" ;;
        2) label="收藏品位置" ;;
    esac

    echo "准备记录第$i次: $label"
    echo "请将鼠标移动到目标位置，5秒后自动记录..."
    echo ""

    for t in 5 4 3 2 1; do
        echo -ne "  $t 秒后记录...\r"
        sleep 1
    done

    pos=$(cliclick p)
    x=$(echo "$pos" | cut -d',' -f1)
    y=$(echo "$pos" | cut -d',' -f2)

    echo "CLICK_$i=$x,$y  # $label" >> "$LOG"
    echo "✅ 已记录: $label -> ($x, $y)"
    echo ""

    if [ $i -eq 1 ]; then
        echo "请点击TronLink图标打开钱包，然后将鼠标移到收藏品位置..."
        echo "等待3秒后开始第2次记录..."
        sleep 3
    fi
done

echo "📄 记录完成: $LOG"
echo ""
cat "$LOG"
