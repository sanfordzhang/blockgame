#!/bin/bash

# 分析TronLink图标位置（基于截图）

echo "=== TronLink图标位置分析 ==="
echo ""

# 获取截图信息
echo "📐 屏幕截图信息:"
sips -g pixelWidth -g pixelHeight test-results/analyze-screen.png | grep -E "pixelWidth|pixelHeight"
echo ""

# 屏幕分辨率分析
echo "📊 分辨率分析:"
echo "   物理分辨率: 3024 x 1964 (Retina)"
echo "   逻辑分辨率: 1512 x 982 (除以2)"
echo "   DPI: 144 (Retina 2x)"
echo ""

# 浏览器布局分析
echo "🌐 Chrome浏览器标准布局:"
echo "   工具栏高度: 约60像素（逻辑）"
echo "   扩展图标区域: 地址栏右侧"
echo "   图标大小: 约32x32像素（逻辑）"
echo "   图标间距: 约5-10像素"
echo ""

# 基于用户提供的截图分析
echo "🎯 基于用户截图的分析:"
echo "   用户截图显示浏览器宽度约: 1430像素（逻辑）"
echo "   红色箭头指向位置: 右上角扩展图标区域"
echo "   TronLink图标位置估算:"
echo ""

# 计算可能的位置
echo "📍 推荐的点击坐标（逻辑像素）:"
echo ""
echo "   位置1（最可能）: (1290, 60)"
echo "   - 说明: 基于截图红色箭头位置"
echo "   - 距离右边缘: 约140像素"
echo ""
echo "   位置2: (1245, 60)"
echo "   - 说明: 左侧相邻图标"
echo "   - 距离右边缘: 约185像素"
echo ""
echo "   位置3: (1335, 60)"
echo "   - 说明: 右侧相邻图标"
echo "   - 距离右边缘: 约95像素"
echo ""
echo "   位置4: (1200, 60)"
echo "   - 说明: 更左侧图标"
echo "   - 距离右边缘: 约230像素"
echo ""

# 图标大小
echo "📏 TronLink图标大小:"
echo "   宽度: 约32像素（逻辑）"
echo "   高度: 约32像素（逻辑）"
echo "   点击区域: 中心点 ± 16像素"
echo ""

# 裁剪工具栏区域
echo "✂️  裁剪工具栏区域进行分析..."
# 裁剪右上角区域（逻辑坐标转物理坐标需要乘以2）
# 区域: X=2200-2900, Y=80-140 (物理像素)
sips --cropToHeightWidth 60 700 --cropOffset 80 2200 test-results/analyze-screen.png --out test-results/toolbar-crop.png > /dev/null 2>&1
echo "✅ 工具栏区域已保存: test-results/toolbar-crop.png"
echo ""

# 打开裁剪的图片
echo "📸 打开工具栏区域图片..."
open test-results/toolbar-crop.png
echo ""

echo "💡 使用建议:"
echo ""
echo "1. 查看 toolbar-crop.png 确认TronLink图标位置"
echo "2. 使用推荐坐标测试点击:"
echo "   cliclick c:1290,60"
echo ""
echo "3. 如果不准确，手动调整坐标:"
echo "   - 向左: 减小X值（如1260, 1230）"
echo "   - 向右: 增大X值（如1320, 1350）"
echo "   - 向上: 减小Y值（如50, 55）"
echo "   - 向下: 增大Y值（如65, 70）"
echo ""

echo "✅ 分析完成"
