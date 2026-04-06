#!/bin/bash

# 智能搜索TronLink图标 - 基于颜色和位置特征

echo "=== 智能搜索TronLink图标 ==="
echo ""

# 清理旧文件
rm -f test-results/icon-grid-*.png 2>/dev/null

# 创建一个更大的搜索网格
# 扩展搜索范围：X=1900-2950, Y=50-150 (物理坐标)

echo "📸 创建搜索网格..."
echo "   搜索范围: 浏览器右上角大面积区域"
echo ""

counter=1
found_icons=()

# Y坐标范围（物理）
for y in 70 80 90 100 110 120 130; do
    # X坐标范围（物理，从右到左）
    for x in 2900 2850 2800 2750 2700 2650 2600 2550 2500 2450 2400 2350 2300 2250 2200 2150 2100 2050 2000 1950; do

        # 截取64x64区域
        crop_x=$((x - 32))
        crop_y=$((y - 32))

        output_file="test-results/icon-grid-$counter.png"

        sips --cropToHeightWidth 64 64 --cropOffset $crop_y $crop_x \
             test-results/analyze-screen.png \
             --out "$output_file" > /dev/null 2>&1

        # 检查文件大小
        if [ -f "$output_file" ]; then
            size=$(stat -f%z "$output_file")

            # 如果文件大小>2KB，说明有内容
            if [ $size -gt 2000 ]; then
                logical_x=$((x / 2))
                logical_y=$((y / 2))
                found_icons+=("$counter:$logical_x:$logical_y:$size")
                echo "  ✓ 网格$counter: 逻辑($logical_x,$logical_y) 大小:${size}字节"
            else
                # 删除空白图标
                rm -f "$output_file"
            fi
        fi

        counter=$((counter + 1))
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 统计找到的图标
icon_count=${#found_icons[@]}

if [ $icon_count -gt 0 ]; then
    echo "✅ 找到 $icon_count 个可能的图标"
    echo ""
    echo "图标列表："
    echo ""

    for icon_info in "${found_icons[@]}"; do
        IFS=':' read -r num x y size <<< "$icon_info"
        echo "  图标$num: 坐标($x,$y) 大小:${size}字节 -> icon-grid-$num.png"
    done

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📂 打开图标文件夹..."
    open test-results/

    echo ""
    echo "💡 请查看 icon-grid-*.png 文件"
    echo "   找到蓝色/紫色的TronLink图标"
    echo ""
    echo "找到后，记录图标编号，然后运行："
    echo "   ./confirm-tronlink-icon.sh <编号>"
    echo ""

    # 创建确认脚本
    cat > confirm-tronlink-icon.sh << 'CONFIRM_SCRIPT'
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
CONFIRM_SCRIPT

    chmod +x confirm-tronlink-icon.sh

    # 保存图标列表
    echo "图标列表" > test-results/icon-list.txt
    for icon_info in "${found_icons[@]}"; do
        IFS=':' read -r num x y size <<< "$icon_info"
        echo "图标$num: 坐标($x,$y) 大小:${size}字节" >> test-results/icon-list.txt
    done

else
    echo "⚠️  未找到任何图标"
    echo ""
    echo "可能的原因："
    echo "  1. 搜索范围不正确"
    echo "  2. 浏览器窗口位置与预期不同"
    echo ""
    echo "建议："
    echo "  1. 查看 toolbar-full-right.png 确认工具栏位置"
    echo "  2. 手动运行 interactive-locate-tronlink.sh"
fi

echo ""
