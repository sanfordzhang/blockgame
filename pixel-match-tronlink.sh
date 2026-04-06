#!/bin/bash

echo "=== TronLink图标像素级匹配 ==="
echo ""

# 1. 准备模板图标（你提供的图标）
echo "📸 准备TronLink模板图标..."

# 你提供的图标应该是32x32，蓝紫色背景+白色纸飞机
# 我需要你将图标文件放到 test-results/TronLink_Icon.png

if [ ! -f "test-results/TronLink_Icon.png" ]; then
    echo "❌ 找不到模板图标: test-results/TronLink_Icon.png"
    echo ""
    echo "请将TronLink图标（32x32像素）保存为:"
    echo "  test-results/TronLink_Icon.png"
    echo ""
    exit 1
fi

# 获取模板尺寸
template_info=$(sips -g pixelWidth -g pixelHeight test-results/TronLink_Icon.png)
template_width=$(echo "$template_info" | grep pixelWidth | awk '{print $2}')
template_height=$(echo "$template_info" | grep pixelHeight | awk '{print $2}')

echo "✅ 模板图标尺寸: ${template_width}x${template_height}"
echo ""

# 如果是逻辑尺寸32x32，物理尺寸应该是64x64
if [ "$template_width" -eq 32 ]; then
    echo "模板是逻辑尺寸，转换为物理尺寸..."
    physical_width=64
    physical_height=64
else
    physical_width=$template_width
    physical_height=$template_height
fi

echo "搜索尺寸: ${physical_width}x${physical_height} (物理像素)"
echo ""

# 2. 在主屏截图中进行密集扫描
echo "🔍 开始像素级扫描..."
echo "   搜索范围: 浏览器工具栏区域"
echo "   方法: 逐像素对比"
echo ""

rm -f test-results/pixel-match-*.png 2>/dev/null
rm -f test-results/pixel-match-results.csv 2>/dev/null

match_count=0
best_matches=()

# 获取模板文件大小作为参考
template_size=$(stat -f%z "test-results/TronLink_Icon.png")

# 搜索范围：浏览器右上角
# X: 1800-3000 (物理), 步长2像素（精确扫描）
# Y: 40-200 (物理), 步长2像素

total_positions=$(( (3000-1800)/2 * (200-40)/2 ))
current=0

for y in $(seq 40 2 200); do
    for x in $(seq 1800 2 3000); do

        current=$((current + 1))

        # 每1000个位置显示进度
        if [ $((current % 1000)) -eq 0 ]; then
            progress=$((current * 100 / total_positions))
            echo "  进度: $progress% ($current/$total_positions)"
        fi

        # 计算裁剪起点（中心对齐）
        crop_x=$((x - physical_width / 2))
        crop_y=$((y - physical_height / 2))

        # 边界检查
        if [ $crop_x -lt 0 ] || [ $crop_y -lt 0 ]; then
            continue
        fi

        # 截取相同尺寸的区域
        test_file="test-results/pixel-test-$match_count.png"

        sips --cropToHeightWidth $physical_height $physical_width \
             --cropOffset $crop_y $crop_x \
             test-results/analyze-screen.png \
             --out "$test_file" > /dev/null 2>&1

        if [ -f "$test_file" ]; then
            # 比较文件大小（第一轮筛选）
            test_size=$(stat -f%z "$test_file")

            # 大小差异在±10%以内
            diff=$((template_size - test_size))
            diff_abs=${diff#-}
            threshold=$((template_size / 10))

            if [ $diff_abs -lt $threshold ]; then
                # 可能匹配，保存候选
                logical_x=$((x / 2))
                logical_y=$((y / 2))

                # 计算匹配度（基于文件大小相似度）
                similarity=$((100 - diff_abs * 100 / template_size))

                echo "  🎯 候选匹配: ($logical_x, $logical_y) - 相似度: ${similarity}%"

                cp "$test_file" "test-results/pixel-match-$match_count.png"
                echo "$match_count,$logical_x,$logical_y,$x,$y,$similarity" >> test-results/pixel-match-results.csv

                best_matches+=("$match_count:$logical_x:$logical_y:$similarity")

                match_count=$((match_count + 1))
            fi

            rm -f "$test_file"
        fi
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $match_count -gt 0 ]; then
    echo "✅ 找到 $match_count 个可能的匹配"
    echo ""

    # 按相似度排序
    echo "按相似度排序（最高的最可能）:"
    sort -t',' -k6 -nr test-results/pixel-match-results.csv | while IFS=',' read num lx ly px py sim; do
        echo "  匹配$num: 坐标($lx, $ly) - 相似度: ${sim}%"
    done

    echo ""
    echo "📂 打开匹配结果..."
    open test-results/

    # 获取最佳匹配
    best=$(sort -t',' -k6 -nr test-results/pixel-match-results.csv | head -1)
    IFS=',' read best_num best_lx best_ly best_px best_py best_sim <<< "$best"

    echo ""
    echo "🎯 最佳匹配:"
    echo "   编号: $best_num"
    echo "   逻辑坐标: ($best_lx, $best_ly)"
    echo "   相似度: ${best_sim}%"
    echo ""

    # 保存最佳匹配
    cp "test-results/pixel-match-$best_num.png" "test-results/tronlink-found.png"

    echo "✅ TronLink图标已找到并保存: test-results/tronlink-found.png"
    echo ""
    echo "📍 TronLink图标位置:"
    echo "   逻辑坐标: ($best_lx, $best_ly)"
    echo "   图标大小: 32x32 像素（逻辑）"
    echo ""
    echo "🖱️  点击命令:"
    echo "   cliclick c:$best_lx,$best_ly"
    echo ""

    # 保存位置信息
    cat > test-results/tronlink-final-location.txt << EOF
TronLink图标最终位置
====================

逻辑坐标: ($best_lx, $best_ly)
物理坐标: ($best_px, $best_py)
图标大小: 32x32 像素（逻辑）/ 64x64 像素（物理）
匹配相似度: ${best_sim}%

点击命令:
  cliclick c:$best_lx,$best_ly

图标文件:
  test-results/tronlink-found.png
EOF

    echo "📄 位置信息已保存: test-results/tronlink-final-location.txt"

else
    echo "⚠️  未找到匹配"
    echo ""
    echo "可能的原因:"
    echo "  1. 模板图标尺寸不正确"
    echo "  2. 搜索范围不包含TronLink图标"
    echo "  3. 需要调整相似度阈值"
fi

echo ""
EOF

chmod +x pixel-match-tronlink.sh

echo "脚本已创建"
echo ""
echo "⚠️  重要：请先将TronLink图标（32x32像素）保存为:"
echo "   test-results/TronLink_Icon.png"
echo ""
echo "然后运行:"
echo "   ./pixel-match-tronlink.sh"
echo ""
