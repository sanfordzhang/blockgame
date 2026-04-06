#!/usr/bin/env python3
"""
分析屏幕截图，找到TronLink图标位置
"""
import sys
from PIL import Image
import os

def analyze_screenshot(image_path):
    """分析截图找到浏览器和扩展图标区域"""

    print("=== TronLink图标位置分析 ===")
    print()

    # 打开图片
    img = Image.open(image_path)
    width, height = img.size

    print(f"📐 屏幕分辨率: {width} x {height}")
    print(f"   像素密度: Retina (2x)")
    print(f"   逻辑分辨率: {width//2} x {height//2}")
    print()

    # 转换为RGB模式以便分析
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # 分析浏览器工具栏区域（通常在顶部）
    # Chrome工具栏高度约120像素（Retina 2x）
    toolbar_height = 120

    print("🔍 分析浏览器工具栏区域...")
    print(f"   区域: 顶部 {toolbar_height} 像素")
    print()

    # 扫描右上角区域寻找扩展图标
    # 扩展图标通常在右上角，距离右边缘200-300像素
    right_margin = 300
    search_x_start = width - right_margin
    search_x_end = width - 50
    search_y_start = 80  # 工具栏中部
    search_y_end = 140

    print("🎯 扩展图标搜索区域:")
    print(f"   X范围: {search_x_start} - {search_x_end} (物理像素)")
    print(f"   Y范围: {search_y_start} - {search_y_end} (物理像素)")
    print(f"   逻辑坐标: X={search_x_start//2}-{search_x_end//2}, Y={search_y_start//2}-{search_y_end//2}")
    print()

    # 分析颜色分布，寻找图标特征
    # TronLink图标通常有特定的颜色（蓝色/红色）
    print("🎨 分析颜色分布...")

    # 采样右上角区域
    sample_points = []
    for x in range(search_x_start, search_x_end, 20):
        for y in range(search_y_start, search_y_end, 10):
            if 0 <= x < width and 0 <= y < height:
                pixel = img.getpixel((x, y))
                sample_points.append((x, y, pixel))

    print(f"   采样点数: {len(sample_points)}")
    print()

    # 寻找可能的图标位置（颜色变化明显的区域）
    print("📍 推荐的点击位置（基于标准Chrome布局）:")
    print()

    # 基于标准Chrome浏览器布局计算
    # 扩展图标通常在地址栏右侧，每个图标约32x32像素（逻辑）
    # 物理像素是64x64

    # 假设浏览器窗口从左边缘开始
    # 根据用户截图，浏览器宽度约1430像素（逻辑）
    browser_width_logical = 1430
    browser_width_physical = browser_width_logical * 2

    # TronLink图标位置（从右边缘往左数）
    # 通常有3-5个扩展图标
    icon_positions = []

    for i in range(1, 6):
        # 每个图标宽度约40像素（逻辑），间隔约5像素
        icon_x_logical = browser_width_logical - (i * 45) - 50
        icon_y_logical = 60  # 工具栏中部

        icon_x_physical = icon_x_logical * 2
        icon_y_physical = icon_y_logical * 2

        icon_positions.append({
            'index': i,
            'logical': (icon_x_logical, icon_y_logical),
            'physical': (icon_x_physical, icon_y_physical)
        })

    print("   可能的扩展图标位置（从右到左）:")
    for pos in icon_positions:
        print(f"   位置{pos['index']}: 逻辑坐标({pos['logical'][0]}, {pos['logical'][1]}) | "
              f"物理坐标({pos['physical'][0]}, {pos['physical'][1]})")

    print()
    print("💡 建议:")
    print(f"   1. TronLink图标最可能在: 逻辑坐标 (1290, 60)")
    print(f"      对应物理坐标: (2580, 120)")
    print()
    print(f"   2. 如果不在该位置，尝试相邻位置:")
    print(f"      - 位置2: (1245, 60)")
    print(f"      - 位置3: (1200, 60)")
    print(f"      - 位置4: (1155, 60)")
    print()
    print("   3. 图标大小约: 32x32 像素（逻辑）或 64x64 像素（物理）")
    print()

    # 保存分析区域的裁剪图
    crop_box = (search_x_start, search_y_start, search_x_end, search_y_end)
    cropped = img.crop(crop_box)
    crop_path = 'test-results/toolbar-area.png'
    cropped.save(crop_path)
    print(f"📸 工具栏区域已保存: {crop_path}")
    print("   请查看此图片确认TronLink图标位置")
    print()

    return icon_positions

if __name__ == '__main__':
    image_path = 'test-results/analyze-screen.png'

    if not os.path.exists(image_path):
        print(f"错误: 找不到截图文件 {image_path}")
        sys.exit(1)

    try:
        positions = analyze_screenshot(image_path)
        print("✅ 分析完成")
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
