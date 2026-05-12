#!/bin/bash

if [ -z "$1" ]; then
    echo "用法: ./confirm-tronlink-icon.sh <图标编号>"
    exit 1
fi

icon_num=$1
icon_file="test-results/icon-grid-$icon_num.png"

if [ ! -f "$icon_file" ]; then
    echo "错误: 找不到图标文件 $icon_file"
    exit 1
fi

echo "=== 确认TronLink图标 ==="
echo ""
echo "图标编号: $icon_num"
echo "图标文件: $icon_file"
echo ""

# 从found_icons数组中查找坐标
# 重新读取位置信息
for icon_info in $(grep "图标$icon_num:" test-results/icon-list.txt 2>/dev/null); do
    if [[ $icon_info =~ 坐标\(([0-9]+),([0-9]+)\) ]]; then
        x="${BASH_REMATCH[1]}"
        y="${BASH_REMATCH[2]}"

        echo "📍 图标位置:"
        echo "   逻辑坐标: ($x, $y)"
        echo "   物理坐标: ($((x*2)), $((y*2)))"
        echo ""

        # 复制为最终图标
        cp "$icon_file" test-results/tronlink-icon-confirmed.png

        echo "✅ TronLink图标已确认"
        echo ""
        echo "🖱️  点击命令:"
        echo "   cliclick c:$x,$y"
        echo ""

        # 保存位置信息
        cat > test-results/tronlink-confirmed-position.txt << EOF
TronLink图标确认位置
====================

逻辑坐标: ($x, $y)
物理坐标: ($((x*2)), $((y*2)))
图标大小: 32x32 像素（逻辑）/ 64x64 像素（物理）

点击命令:
  cliclick c:$x,$y

图标文件:
  test-results/tronlink-icon-confirmed.png
EOF

        echo "📄 位置信息已保存: test-results/tronlink-confirmed-position.txt"
        exit 0
    fi
done

echo "⚠️  无法找到图标坐标信息"
