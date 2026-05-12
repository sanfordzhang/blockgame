#!/bin/bash

echo "=== 扩大搜索范围重新扫描 ==="
echo ""
echo "TronLink图标：蓝紫色背景 + 白色纸飞机"
echo ""

# 清理旧文件
rm -f test-results/icon-scan-*.png 2>/dev/null

counter=1
found_list=()

# 扩大Y坐标范围：60-130（物理）
for y in 60 70 80 90 100 110 120 130; do
    echo "扫描 Y=$y..."
    
    # X坐标从右到左，范围更广
    for x in 2950 2900 2850 2800 2750 2700 2650 2600 2550 2500 2450 2400 2350 2300 2250 2200 2150 2100 2050 2000 1950 1900 1850; do
        
        crop_x=$((x - 32))
        crop_y=$((y - 32))
        
        sips --cropToHeightWidth 64 64 --cropOffset $crop_y $crop_x \
             test-results/analyze-screen.png \
             --out "test-results/icon-scan-$counter.png" > /dev/null 2>&1
        
        if [ -f "test-results/icon-scan-$counter.png" ]; then
            size=$(stat -f%z "test-results/icon-scan-$counter.png")
            
            if [ $size -gt 2000 ]; then
                logical_x=$((x / 2))
                logical_y=$((y / 2))
                found_list+=("$counter:$logical_x:$logical_y:$size")
            else
                rm -f "test-results/icon-scan-$counter.png"
            fi
        fi
        
        counter=$((counter + 1))
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 找到 ${#found_list[@]} 个图标"
echo ""

if [ ${#found_list[@]} -gt 0 ]; then
    echo "图标列表："
    for item in "${found_list[@]}"; do
        IFS=':' read -r num x y size <<< "$item"
        echo "  图标$num: ($x, $y) - ${size}字节"
    done
    
    echo ""
    echo "📂 打开文件夹查看所有 icon-scan-*.png"
    open test-results/
    
    echo ""
    echo "请查找蓝紫色背景+白色纸飞机的图标"
    echo "找到后告诉我编号"
fi

echo ""
