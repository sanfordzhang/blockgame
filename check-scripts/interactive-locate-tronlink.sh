#!/bin/bash

# 交互式定位TronLink图标

echo "=========================================="
echo "  TronLink图标交互式定位工具"
echo "=========================================="
echo ""

# 打开工具栏图片
echo "📸 打开工具栏图片..."
open test-results/toolbar-full-right.png
echo ""
echo "工具栏图片信息："
echo "  文件: toolbar-full-right.png"
echo "  尺寸: 1200x140 像素（物理）"
echo "  对应逻辑尺寸: 600x70 像素"
echo "  覆盖范围: 浏览器右侧扩展图标区域"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "请在打开的图片中找到TronLink图标"
echo ""
echo "TronLink图标特征："
echo "  ✓ 颜色：蓝色或紫色"
echo "  ✓ 可能有白色的'T'字母或链条图案"
echo "  ✓ 圆形或圆角方形"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 询问图标位置
echo "请估算TronLink图标在工具栏图片中的位置："
echo ""
echo "从左边缘算起，大约在多少像素？"
echo "  提示：图片宽度1200像素"
echo "  - 如果在最左侧：输入 100"
echo "  - 如果在中间：输入 600"
echo "  - 如果在最右侧：输入 1100"
echo ""
read -p "X位置（像素）: " toolbar_x

echo ""
echo "从顶部算起，大约在多少像素？"
echo "  提示：图片高度140像素，工具栏图标通常在中间"
echo "  - 通常输入：70"
echo ""
read -p "Y位置（像素）: " toolbar_y

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "计算主屏幕坐标..."
echo ""

# 工具栏图片的起始位置（物理坐标）
toolbar_start_x=1800
toolbar_start_y=40

# 计算主屏幕物理坐标
screen_x=$((toolbar_start_x + toolbar_x))
screen_y=$((toolbar_start_y + toolbar_y))

# 转换为逻辑坐标
logical_x=$((screen_x / 2))
logical_y=$((screen_y / 2))

echo "📍 计算结果："
echo ""
echo "  工具栏图片中的位置: ($toolbar_x, $toolbar_y)"
echo "  主屏幕物理坐标: ($screen_x, $screen_y)"
echo "  主屏幕逻辑坐标: ($logical_x, $logical_y)"
echo ""

# 截取图标
echo "✂️  截取图标..."
crop_x=$((screen_x - 32))
crop_y=$((screen_y - 32))

sips --cropToHeightWidth 64 64 --cropOffset $crop_y $crop_x \
     test-results/analyze-screen.png \
     --out test-results/tronlink-icon-final.png > /dev/null 2>&1

if [ -f "test-results/tronlink-icon-final.png" ]; then
    echo "✅ 图标已截取: test-results/tronlink-icon-final.png"
    echo ""

    # 打开查看
    open test-results/tronlink-icon-final.png
    echo "📸 已打开图标，请确认是否正确"
    echo ""

    read -p "这是TronLink图标吗？(y/n): " confirm

    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        echo ""
        echo "✅ 确认成功！"
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "📍 TronLink图标最终位置："
        echo ""
        echo "  逻辑坐标: ($logical_x, $logical_y)"
        echo "  物理坐标: ($screen_x, $screen_y)"
        echo "  图标大小: 32x32 像素（逻辑）/ 64x64 像素（物理）"
        echo ""
        echo "🖱️  点击命令:"
        echo "  cliclick c:$logical_x,$logical_y"
        echo ""

        # 保存位置信息
        cat > test-results/tronlink-final-position.txt << EOF
TronLink图标最终位置
====================

逻辑坐标（用于点击）:
  X: $logical_x 像素
  Y: $logical_y 像素

物理坐标:
  X: $screen_x 像素
  Y: $screen_y 像素

图标大小:
  逻辑: 32x32 像素
  物理: 64x64 像素

点击命令:
  cliclick c:$logical_x,$logical_y

图标文件:
  test-results/tronlink-icon-final.png
EOF

        echo "📄 位置信息已保存: test-results/tronlink-final-position.txt"
        echo ""
        echo "✅ 完成！"

    else
        echo ""
        echo "⚠️  位置不正确，请重新运行脚本"
    fi
else
    echo "❌ 截取失败"
fi

echo ""
