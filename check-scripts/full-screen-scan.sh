#!/bin/bash

# 在整个主屏幕进行密集扫描，寻找TronLink图标

echo "=== 全屏密集扫描TronLink图标 ==="
echo ""
echo "TronLink图标特征："
echo "  - 蓝紫色背景 (#5B6FED)"
echo "  - 白色纸飞机/箭头图案"
echo "  - 32x32像素（逻辑）"
echo ""

# 清理
rm -f test-results/full-scan-*.png 2>/dev/null

counter=1
found_icons=()

# 全屏扫描：整个屏幕的上半部分
# X: 0-3000 (物理), 步长40
# Y: 0-400 (物理), 步长20

echo "🔍 开始全屏扫描..."
echo "   扫描范围: 整个屏幕上半部分"
echo "   这可能需要1-2分钟..."
echo ""

for y in $(seq 40 20 200); do
    for x in $(seq 1800 40 3000); do

        crop_x=$((x - 32))
        crop_y=$((y - 32))

        # 确保坐标在有效范围内
        if [ $crop_x -lt 0 ] || [ $crop_y -lt 0 ]; then
            continue
        fi

        sips --cropToHeightWidth 64 64 --cropOffset $crop_y $crop_x \
             test-results/analyze-screen.png \
             --out "test-results/full-scan-$counter.png" > /dev/null 2>&1

        if [ -f "test-results/full-scan-$counter.png" ]; then
            size=$(stat -f%z "test-results/full-scan-$counter.png")

            # 只保留有内容的图标（>2KB）
            if [ $size -gt 2000 ]; then
                logical_x=$((x / 2))
                logical_y=$((y / 2))
                found_icons+=("$counter:$logical_x:$logical_y:$size:$x:$y")

                # 每找到10个显示一次进度
                if [ $((${#found_icons[@]} % 10)) -eq 0 ]; then
                    echo "  已找到 ${#found_icons[@]} 个图标..."
                fi
            else
                rm -f "test-results/full-scan-$counter.png"
            fi
        fi

        counter=$((counter + 1))
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 扫描完成！找到 ${#found_icons[@]} 个图标"
echo ""

if [ ${#found_icons[@]} -gt 0 ]; then
    echo "保存图标列表..."

    # 保存详细列表
    echo "编号,逻辑X,逻辑Y,物理X,物理Y,大小" > test-results/full-scan-list.csv

    for item in "${found_icons[@]}"; do
        IFS=':' read -r num lx ly size px py <<< "$item"
        echo "$num,$lx,$ly,$px,$py,$size" >> test-results/full-scan-list.csv
    done

    echo "✅ 图标列表已保存: test-results/full-scan-list.csv"
    echo ""
    echo "📂 打开文件夹查看所有 full-scan-*.png"
    open test-results/

    echo ""
    echo "💡 提示："
    echo "   1. 查看所有 full-scan-*.png 文件"
    echo "   2. 找到蓝紫色+白色纸飞机的图标"
    echo "   3. 记录文件名中的编号"
    echo "   4. 运行: grep \"^编号,\" test-results/full-scan-list.csv"
    echo ""

    # 显示前20个
    echo "前20个图标："
    head -20 test-results/full-scan-list.csv | tail -20

else
    echo "⚠️  未找到任何图标"
fi

echo ""
