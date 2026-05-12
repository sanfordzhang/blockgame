#!/bin/bash

# 精确定位并截取TronLink图标

echo "=== 精确定位TronLink图标 ==="
echo ""

# 基于用户提供的截图分析
# 红色箭头指向的位置大约在 X=1290, Y=60 (逻辑坐标)
# 转换为物理坐标: X=2580, Y=120

# Chrome扩展图标标准尺寸
ICON_SIZE_LOGICAL=32
ICON_SIZE_PHYSICAL=64

# TronLink图标位置（逻辑坐标）
TRONLINK_X_LOGICAL=1290
TRONLINK_Y_LOGICAL=60

# 转换为物理坐标（Retina 2x）
TRONLINK_X_PHYSICAL=$((TRONLINK_X_LOGICAL * 2))
TRONLINK_Y_PHYSICAL=$((TRONLINK_Y_LOGICAL * 2))

echo "📍 TronLink图标位置分析:"
echo ""
echo "逻辑坐标（用于cliclick）:"
echo "  X: $TRONLINK_X_LOGICAL 像素"
echo "  Y: $TRONLINK_Y_LOGICAL 像素"
echo "  中心点: ($TRONLINK_X_LOGICAL, $TRONLINK_Y_LOGICAL)"
echo ""
echo "物理坐标（用于图像裁剪）:"
echo "  X: $TRONLINK_X_PHYSICAL 像素"
echo "  Y: $TRONLINK_Y_PHYSICAL 像素"
echo ""
echo "图标大小:"
echo "  逻辑: ${ICON_SIZE_LOGICAL}x${ICON_SIZE_LOGICAL} 像素"
echo "  物理: ${ICON_SIZE_PHYSICAL}x${ICON_SIZE_PHYSICAL} 像素"
echo ""

# 计算裁剪区域（以图标中心为基准，向四周扩展）
CROP_X=$((TRONLINK_X_PHYSICAL - ICON_SIZE_PHYSICAL / 2))
CROP_Y=$((TRONLINK_Y_PHYSICAL - ICON_SIZE_PHYSICAL / 2))

echo "✂️  截取TronLink图标..."
echo "  裁剪起点: ($CROP_X, $CROP_Y)"
echo "  裁剪尺寸: ${ICON_SIZE_PHYSICAL}x${ICON_SIZE_PHYSICAL}"
echo ""

# 从完整截图中裁剪图标
sips --cropToHeightWidth $ICON_SIZE_PHYSICAL $ICON_SIZE_PHYSICAL \
     --cropOffset $CROP_Y $CROP_X \
     test-results/analyze-screen.png \
     --out test-results/tronlink-icon.png > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ TronLink图标已保存: test-results/tronlink-icon.png"

    # 获取实际尺寸
    ACTUAL_SIZE=$(sips -g pixelWidth -g pixelHeight test-results/tronlink-icon.png | grep pixel)
    echo ""
    echo "📏 实际截取尺寸:"
    echo "$ACTUAL_SIZE"
    echo ""

    # 打开图标查看
    echo "📸 打开图标查看..."
    open test-results/tronlink-icon.png
    echo ""
else
    echo "❌ 截取失败"
    exit 1
fi

# 同时截取周围区域以便对比
CONTEXT_SIZE=128
CONTEXT_X=$((TRONLINK_X_PHYSICAL - CONTEXT_SIZE / 2))
CONTEXT_Y=$((TRONLINK_Y_PHYSICAL - CONTEXT_SIZE / 2))

echo "📸 截取周围区域以便对比..."
sips --cropToHeightWidth $CONTEXT_SIZE $CONTEXT_SIZE \
     --cropOffset $CONTEXT_Y $CONTEXT_X \
     test-results/analyze-screen.png \
     --out test-results/tronlink-context.png > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ 周围区域已保存: test-results/tronlink-context.png"
    echo ""
fi

# 生成测试命令
echo "🖱️  测试点击命令:"
echo "  cliclick c:$TRONLINK_X_LOGICAL,$TRONLINK_Y_LOGICAL"
echo ""

# 生成位置信息文件
cat > test-results/tronlink-position.txt << EOF
TronLink图标位置信息
====================

逻辑坐标（用于cliclick点击）:
  X: $TRONLINK_X_LOGICAL 像素
  Y: $TRONLINK_Y_LOGICAL 像素
  中心点: ($TRONLINK_X_LOGICAL, $TRONLINK_Y_LOGICAL)

物理坐标（屏幕实际像素）:
  X: $TRONLINK_X_PHYSICAL 像素
  Y: $TRONLINK_Y_PHYSICAL 像素

图标大小:
  逻辑: ${ICON_SIZE_LOGICAL}x${ICON_SIZE_LOGICAL} 像素
  物理: ${ICON_SIZE_PHYSICAL}x${ICON_SIZE_PHYSICAL} 像素

点击区域:
  左上角: ($((TRONLINK_X_LOGICAL - ICON_SIZE_LOGICAL/2)), $((TRONLINK_Y_LOGICAL - ICON_SIZE_LOGICAL/2)))
  右下角: ($((TRONLINK_X_LOGICAL + ICON_SIZE_LOGICAL/2)), $((TRONLINK_Y_LOGICAL + ICON_SIZE_LOGICAL/2)))

测试命令:
  cliclick c:$TRONLINK_X_LOGICAL,$TRONLINK_Y_LOGICAL

生成文件:
  - tronlink-icon.png (图标截图)
  - tronlink-context.png (周围区域)
  - tronlink-position.txt (位置信息)
EOF

echo "📄 位置信息已保存: test-results/tronlink-position.txt"
echo ""
echo "✅ 完成！"
echo ""
echo "请查看截取的图标确认位置是否正确。"
echo "如果图标不正确，请调整脚本中的坐标值。"
