#!/bin/bash

echo "=== 使用ImageMagick进行像素级对比 ==="
echo ""

# 检查ImageMagick
if ! command -v magick &> /dev/null && ! command -v compare &> /dev/null; then
    echo "❌ 未安装ImageMagick"
    echo "安装: brew install imagemagick"
    exit 1
fi

# 设置命令
if command -v magick &> /dev/null; then
    COMPARE="magick compare"
else
    COMPARE="compare"
fi

echo "模板图标: TronLink_Icon.png (32x32)"
echo "主屏截图: test-results/analyze-screen.png"
echo ""

# 搜索范围（物理坐标）
x_start=1600
x_end=3000
y_start=20
y_end=200
step=5

template_width=32
template_height=32

echo "🔍 搜索范围: X=$x_start-$x_end, Y=$y_start-$y_end"
echo "   步长: ${step}像素"
echo ""

best_match=""
best_diff=999999
match_count=0

for y in $(seq $y_start $step $y_end); do
    for x in $(seq $x_start $step $x_end); do
        
        # 截取区域
        crop_x=$((x - template_width / 2))
        crop_y=$((y - template_height / 2))
        
        if [ $crop_x -lt 0 ] || [ $crop_y -lt 0 ]; then
            continue
        fi
        
        # 从主屏截图中截取32x32区域
        region_file="test-results/region-$match_count.png"
        
        sips --cropToHeightWidth $template_height $template_width \
             --cropOffset $crop_y $crop_x \
             test-results/analyze-screen.png \
             --out "$region_file" > /dev/null 2>&1
        
        if [ -f "$region_file" ]; then
            # 使用ImageMagick compare比较
            diff_file="test-results/diff-$match_count.png"
            
            # 计算差异（使用MAE - Mean Absolute Error）
            diff_value=$($COMPARE -metric MAE "$region_file" "TronLink_Icon.png" "$diff_file" 2>&1 | awk '{print $1}' | sed 's/[^0-9.]//g')
            
            # 如果diff_value为空或无效，跳过
            if [ -z "$diff_value" ] || [ "$diff_value" = "" ]; then
                rm -f "$region_file" "$diff_file"
                continue
            fi
            
            # 转换为整数（去掉小数点）
            diff_int=$(echo "$diff_value" | awk '{printf "%.0f", $1}')
            
            # 如果差异很小（<1000），认为是匹配
            if [ "$diff_int" -lt 1000 ]; then
                logical_x=$((x / 2))
                logical_y=$((y / 2))
                
                echo "  🎯 找到匹配: ($logical_x, $logical_y) - 差异值: $diff_int"
                
                cp "$region_file" "test-results/match-$match_count.png"
                echo "$match_count,$logical_x,$logical_y,$x,$y,$diff_int" >> test-results/imagemagick-matches.csv
                
                if [ "$diff_int" -lt "$best_diff" ]; then
                    best_diff=$diff_int
                    best_match="$match_count,$logical_x,$logical_y,$x,$y"
                fi
            fi
            
            rm -f "$region_file" "$diff_file"
        fi
        
        match_count=$((match_count + 1))
        
        if [ $((match_count % 1000)) -eq 0 ]; then
            echo "  已检查 $match_count 个位置..."
        fi
    done
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "test-results/imagemagick-matches.csv" ]; then
    found_count=$(wc -l < test-results/imagemagick-matches.csv)
    echo "✅ 找到 $found_count 个匹配"
    echo ""
    
    # 显示最佳匹配
    IFS=',' read num lx ly px py diff <<< "$best_match"
    
    echo "🎯 最佳匹配:"
    echo "   逻辑坐标: ($lx, $ly)"
    echo "   物理坐标: ($px, $py)"
    echo "   差异值: $diff"
    echo ""
    
    cp "test-results/match-$num.png" "test-results/TRONLINK_IMAGEMAGICK_MATCH.png"
    open "test-results/TRONLINK_IMAGEMAGICK_MATCH.png"
    
    echo "📸 匹配图标: test-results/TRONLINK_IMAGEMAGICK_MATCH.png"
    echo ""
    echo "🖱️  点击命令:"
    echo "   cliclick c:$lx,$ly"
    
else
    echo "⚠️  未找到匹配"
fi

echo ""
