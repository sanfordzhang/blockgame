#!/bin/bash

echo "=== 基于颜色特征搜索蓝紫色图标 ==="
echo ""

# TronLink图标特征：蓝紫色背景
# 从你的模板图标中提取主要颜色
echo "📊 分析模板图标的颜色特征..."

# 使用sips获取图标信息
sips -g all TronLink_Icon.png | grep -E "pixelWidth|pixelHeight|hasAlpha"

echo ""
echo "🔍 在主屏截图中搜索32x32的蓝紫色图标..."
echo "   搜索范围: 浏览器右上角"
echo ""

# 搜索所有32x32的区域，保存文件大小在1500-2500字节的（可能包含图标内容）
counter=0
found_icons=()

for y in $(seq 20 5 150); do
    for x in $(seq 1600 10 3000); do
        
        # 转换为物理坐标
        px=$((x))
        py=$((y))
        
        crop_x=$((px - 16))
        crop_y=$((py - 16))
        
        if [ $crop_x -lt 0 ] || [ $crop_y -lt 0 ]; then
            continue
        fi
        
        output="test-results/scan32-$counter.png"
        
        sips --cropToHeightWidth 32 32 --cropOffset $crop_y $crop_x \
             test-results/analyze-screen.png \
             --out "$output" > /dev/null 2>&1
        
        if [ -f "$output" ]; then
            size=$(stat -f%z "$output")
            
            # 文件大小在1500-2500字节，可能是图标
            if [ $size -gt 1500 ] && [ $size -lt 2500 ]; then
                logical_x=$((px / 2))
                logical_y=$((py / 2))
                found_icons+=("$counter:$logical_x:$logical_y:$size")
                echo "  候选 $counter: ($logical_x, $logical_y) - ${size}字节"
            else
                rm -f "$output"
            fi
        fi
        
        counter=$((counter + 1))
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 找到 ${#found_icons[@]} 个候选图标"
echo ""

if [ ${#found_icons[@]} -gt 0 ]; then
    echo "📂 打开文件夹查看所有 scan32-*.png"
    open test-results/
    
    echo ""
    echo "💡 请在文件夹中找到蓝紫色+白色纸飞机的TronLink图标"
    echo "   然后告诉我文件名中的编号"
    echo ""
    echo "候选列表:"
    for icon in "${found_icons[@]}"; do
        IFS=':' read num lx ly size <<< "$icon"
        echo "  scan32-$num.png: ($lx, $ly)"
    done
fi

echo ""
