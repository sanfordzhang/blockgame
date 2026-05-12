#!/bin/bash

# 重新扫描，使用更准确的Y坐标范围

echo "=== 重新扫描工具栏图标（调整Y坐标） ==="
echo ""

# 清理旧的候选文件
rm -f test-results/icon-candidate-*.png 2>/dev/null

# 扩展Y坐标范围，从60到140
y_positions=(80 90 100 110 120)

counter=1
for y in "${y_positions[@]}"; do
    echo "扫描 Y=$y 的位置..."

    # X坐标从右到左
    for x in 2900 2840 2780 2720 2660 2600 2540 2480 2420 2360 2300 2240 2180 2120 2060 2000; do
        # 截取64x64的图标
        crop_x=$((x - 32))
        crop_y=$((y - 32))

        sips --cropToHeightWidth 64 64 --cropOffset $crop_y $crop_x \
             test-results/analyze-screen.png \
             --out "test-results/scan-$counter.png" > /dev/null 2>&1

        # 检查文件大小
        size=$(stat -f%z "test-results/scan-$counter.png" 2>/dev/null || echo "0")

        # 计算逻辑坐标
        logical_x=$((x / 2))
        logical_y=$((y / 2))

        # 只保留有内容的图标（文件大小>2KB）
        if [ $size -gt 2000 ]; then
            mv "test-results/scan-$counter.png" "test-results/icon-found-$counter.png"
            echo "  ✓ 找到图标 $counter: 物理($x,$y) 逻辑($logical_x,$logical_y) 大小:${size}字节"
        else
            rm -f "test-results/scan-$counter.png" 2>/dev/null
        fi

        counter=$((counter + 1))
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 统计找到的图标数量
found_count=$(ls test-results/icon-found-*.png 2>/dev/null | wc -l | tr -d ' ')

if [ $found_count -gt 0 ]; then
    echo "✅ 找到 $found_count 个图标"
    echo ""
    echo "📂 打开图标文件夹..."
    open test-results/
    echo ""
    echo "请查看 icon-found-*.png 文件"
    echo "找到蓝色/紫色的TronLink图标"
else
    echo "⚠️  未找到图标，可能需要调整搜索范围"
fi

echo ""
