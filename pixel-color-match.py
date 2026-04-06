#!/usr/bin/env python3
"""
真正的像素级颜色对比 - 使用PIL进行图像匹配
"""
import sys
from PIL import Image
import os

def compare_images_pixel_by_pixel(template_path, screenshot_path, search_area):
    """
    像素级颜色对比
    """
    print("=== 像素级颜色对比 ===")
    print()

    # 加载模板图标
    template = Image.open(template_path).convert('RGB')
    template_width, template_height = template.size
    print(f"模板图标: {template_width}x{template_height}")

    # 加载主屏截图
    screenshot = Image.open(screenshot_path).convert('RGB')
    screen_width, screen_height = screenshot.size
    print(f"主屏截图: {screen_width}x{screen_height}")
    print()

    # 获取模板像素数据
    template_pixels = list(template.getdata())
    total_pixels = len(template_pixels)

    print(f"🔍 开始搜索...")
    print(f"   搜索范围: X={search_area['x_start']}-{search_area['x_end']}, Y={search_area['y_start']}-{search_area['y_end']}")
    print(f"   步长: {search_area['step']}像素")
    print()

    best_match = None
    best_similarity = 0
    matches = []

    checked = 0

    # 在搜索区域内逐像素扫描
    for y in range(search_area['y_start'], search_area['y_end'], search_area['step']):
        for x in range(search_area['x_start'], search_area['x_end'], search_area['step']):

            # 边界检查
            if x + template_width > screen_width or y + template_height > screen_height:
                continue

            # 截取相同大小的区域
            region = screenshot.crop((x, y, x + template_width, y + template_height))
            region_pixels = list(region.getdata())

            # 计算像素匹配度
            matching_pixels = 0
            for i in range(total_pixels):
                t_r, t_g, t_b = template_pixels[i]
                r_r, r_g, r_b = region_pixels[i]

                # 允许每个颜色通道有±5的误差
                if abs(t_r - r_r) <= 5 and abs(t_g - r_g) <= 5 and abs(t_b - r_b) <= 5:
                    matching_pixels += 1

            similarity = (matching_pixels / total_pixels) * 100

            # 如果相似度超过95%，认为是匹配
            if similarity >= 95:
                logical_x = x // 2
                logical_y = y // 2
                matches.append({
                    'x': logical_x,
                    'y': logical_y,
                    'px': x,
                    'py': y,
                    'similarity': similarity
                })

                print(f"  🎯 找到匹配: 逻辑({logical_x}, {logical_y}) 物理({x}, {y}) - 相似度: {similarity:.2f}%")

                if similarity > best_similarity:
                    best_similarity = similarity
                    best_match = matches[-1]

            checked += 1
            if checked % 10000 == 0:
                print(f"  已检查 {checked} 个位置...")

    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()

    if best_match:
        print(f"✅ 找到 {len(matches)} 个匹配")
        print()
        print("🎯 最佳匹配:")
        print(f"   逻辑坐标: ({best_match['x']}, {best_match['y']})")
        print(f"   物理坐标: ({best_match['px']}, {best_match['py']})")
        print(f"   相似度: {best_match['similarity']:.2f}%")
        print()

        # 保存匹配的图标
        matched_region = screenshot.crop((
            best_match['px'],
            best_match['py'],
            best_match['px'] + template_width,
            best_match['py'] + template_height
        ))
        matched_region.save('test-results/TRONLINK_PIXEL_MATCH.png')
        print("📸 匹配图标已保存: test-results/TRONLINK_PIXEL_MATCH.png")
        print()
        print("🖱️  点击命令:")
        print(f"   cliclick c:{best_match['x']},{best_match['y']}")

        # 保存结果
        with open('test-results/pixel-match-result.txt', 'w') as f:
            f.write(f"TronLink图标位置（像素级颜色对比）\n")
            f.write(f"=====================================\n\n")
            f.write(f"逻辑坐标: ({best_match['x']}, {best_match['y']})\n")
            f.write(f"物理坐标: ({best_match['px']}, {best_match['py']})\n")
            f.write(f"相似度: {best_match['similarity']:.2f}%\n")
            f.write(f"点击命令: cliclick c:{best_match['x']},{best_match['y']}\n")

        return best_match
    else:
        print("⚠️  未找到匹配（相似度>95%）")
        print()
        print("建议:")
        print("  1. 扩大搜索范围")
        print("  2. 降低相似度阈值")
        print("  3. 检查模板图标是否正确")
        return None

if __name__ == '__main__':
    # 搜索区域：浏览器右上角
    search_area = {
        'x_start': 1600,  # 物理坐标
        'x_end': 3000,
        'y_start': 20,
        'y_end': 200,
        'step': 2  # 2像素步长
    }

    result = compare_images_pixel_by_pixel(
        'TronLink_Icon.png',
        'test-results/analyze-screen.png',
        search_area
    )

    if result:
        print()
        print("✅ 匹配成功！")
        sys.exit(0)
    else:
        print()
        print("❌ 匹配失败")
        sys.exit(1)
