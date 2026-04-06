#!/bin/bash

# 分析候选图标，找到TronLink（蓝色/紫色图标）

echo "=== 分析候选图标颜色特征 ==="
echo ""

# 使用sips获取每个候选图标的主要颜色信息
echo "正在分析15个候选图标..."
echo ""

for i in {1..15}; do
    file="test-results/icon-candidate-$i.png"

    if [ -f "$file" ]; then
        # 获取文件大小（可以帮助判断是否是空白区域）
        size=$(stat -f%z "$file")

        echo "候选 $i:"
        echo "  文件: $file"
        echo "  大小: $size 字节"

        # 如果文件很小，可能是空白区域
        if [ $size -lt 2000 ]; then
            echo "  状态: ⚪ 可能是空白区域"
        else
            echo "  状态: ✓ 包含内容"
        fi
        echo ""
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 TronLink图标特征："
echo "  - 颜色：蓝色或紫色"
echo "  - 可能带有白色的'T'字母或链条图案"
echo "  - 通常是圆形或圆角方形"
echo ""
echo "请手动查看候选图标，找到符合特征的图标"
echo ""
echo "查看方法："
echo "  open test-results/icon-candidate-*.png"
echo ""

# 创建一个组合图方便对比
echo "📸 创建组合对比图..."

# 使用ImageMagick如果可用
if command -v magick &> /dev/null || command -v convert &> /dev/null; then
    echo "  使用ImageMagick创建组合图..."

    # 尝试使用convert或magick命令
    if command -v magick &> /dev/null; then
        CMD="magick"
    else
        CMD="convert"
    fi

    # 创建3行5列的组合图
    $CMD test-results/icon-candidate-{1..5}.png +append test-results/row1.png 2>/dev/null
    $CMD test-results/icon-candidate-{6..10}.png +append test-results/row2.png 2>/dev/null
    $CMD test-results/icon-candidate-{11..15}.png +append test-results/row3.png 2>/dev/null
    $CMD test-results/row{1..3}.png -append test-results/all-candidates.png 2>/dev/null

    if [ -f "test-results/all-candidates.png" ]; then
        echo "  ✅ 组合图已创建: test-results/all-candidates.png"
        open test-results/all-candidates.png
        rm test-results/row{1..3}.png 2>/dev/null
    else
        echo "  ⚠️  组合图创建失败"
    fi
else
    echo "  ⚠️  未安装ImageMagick，跳过组合图创建"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "请告诉我哪个候选图标是TronLink（编号1-15）"
echo ""
