#!/bin/bash

# 重新分析并找到真正的TronLink图标
# TronLink图标特征：蓝色/紫色，圆形或方形，带有特殊标志

echo "=== 重新分析TronLink图标位置 ==="
echo ""
echo "TronLink图标特征："
echo "  - 颜色：蓝色/紫色系"
echo "  - 形状：通常是圆形或圆角方形"
echo "  - 设计：带有TronLink特征标志"
echo ""

# 截取整个浏览器工具栏右侧区域
echo "📸 截取浏览器工具栏右侧完整区域..."

# 从主屏截图中截取右上角大范围区域
# 物理坐标：X=1800-3000, Y=40-180
sips --cropToHeightWidth 140 1200 --cropOffset 40 1800 \
     test-results/analyze-screen.png \
     --out test-results/toolbar-full-right.png > /dev/null 2>&1

echo "✅ 工具栏右侧区域已保存: test-results/toolbar-full-right.png"
echo "   尺寸: 1200x140 像素"
echo "   覆盖范围: 浏览器右侧所有扩展图标"
echo ""

# 打开图片让用户查看
echo "📸 打开工具栏图片进行人工识别..."
open test-results/toolbar-full-right.png

echo ""
echo "请查看 toolbar-full-right.png 图片"
echo ""
echo "在图片中找到TronLink图标后，我们将："
echo "1. 确定图标在工具栏图片中的位置"
echo "2. 计算图标在主屏幕中的绝对坐标"
echo "3. 截取正确的图标"
echo ""

# 同时截取多个可能的位置进行对比
echo "📸 截取多个可能位置的图标进行对比..."
echo ""

# 定义多个可能的位置（物理坐标）
# 从右到左扫描工具栏
positions=(
    "2900:100:pos1"  # 最右侧
    "2840:100:pos2"
    "2780:100:pos3"
    "2720:100:pos4"
    "2660:100:pos5"
    "2600:100:pos6"
    "2540:100:pos7"
    "2480:100:pos8"
    "2420:100:pos9"
    "2360:100:pos10"
    "2300:100:pos11"
    "2240:100:pos12"
    "2180:100:pos13"
    "2120:100:pos14"
    "2060:100:pos15"
)

counter=1
for pos in "${positions[@]}"; do
    IFS=':' read -r x y name <<< "$pos"

    # 截取64x64的图标
    crop_x=$((x - 32))
    crop_y=$((y - 32))

    sips --cropToHeightWidth 64 64 --cropOffset $crop_y $crop_x \
         test-results/analyze-screen.png \
         --out "test-results/icon-candidate-$counter.png" > /dev/null 2>&1

    # 计算逻辑坐标
    logical_x=$((x / 2))
    logical_y=$((y / 2))

    echo "  候选$counter: 物理($x,$y) 逻辑($logical_x,$logical_y) -> icon-candidate-$counter.png"

    counter=$((counter + 1))
done

echo ""
echo "✅ 已生成 15 个候选图标截图"
echo ""
echo "📂 打开候选图标文件夹..."
open test-results/

echo ""
echo "💡 下一步："
echo "1. 查看 icon-candidate-1.png 到 icon-candidate-15.png"
echo "2. 找到蓝色/紫色的TronLink图标"
echo "3. 记录对应的编号"
echo ""
