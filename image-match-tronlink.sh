#!/bin/bash

echo "=== 使用模板匹配查找TronLink图标 ==="
echo ""

# 你提供的TronLink图标应该已经保存
# 让我先检查是否有参考图标

echo "📸 准备模板图标..."
echo ""
echo "请将TronLink图标保存为: test-results/tronlink-template.png"
echo "图标尺寸应该是: 32x32 或 64x64 像素"
echo ""

read -p "已保存模板图标？(y/n): " ready

if [ "$ready" != "y" ]; then
    echo "请先保存模板图标"
    exit 1
fi

# 获取模板尺寸
if [ -f "test-results/tronlink-template.png" ]; then
    template_info=$(sips -g pixelWidth -g pixelHeight test-results/tronlink-template.png)
    echo "✅ 模板图标信息:"
    echo "$template_info"
    echo ""
    
    # 提取尺寸
    template_width=$(echo "$template_info" | grep pixelWidth | awk '{print $2}')
    template_height=$(echo "$template_info" | grep pixelHeight | awk '{print $2}')
    
    echo "模板尺寸: ${template_width}x${template_height}"
    echo ""
    
    # 开始匹配
    echo "🔍 在主屏截图中搜索匹配..."
    echo "   搜索范围: 浏览器右上角区域"
    echo ""
    
    match_count=0
    
    # 搜索范围（物理坐标）
    for y in $(seq 40 10 150); do
        for x in $(seq 1800 20 3000); do
            
            # 截取相同尺寸的区域
            crop_x=$((x - template_width / 2))
            crop_y=$((y - template_height / 2))
            
            if [ $crop_x -lt 0 ] || [ $crop_y -lt 0 ]; then
                continue
            fi
            
            output_file="test-results/match-test-$match_count.png"
            
            sips --cropToHeightWidth $template_height $template_width \
                 --cropOffset $crop_y $crop_x \
                 test-results/analyze-screen.png \
                 --out "$output_file" > /dev/null 2>&1
            
            if [ -f "$output_file" ]; then
                # 比较文件大小（粗略匹配）
                template_size=$(stat -f%z "test-results/tronlink-template.png")
                test_size=$(stat -f%z "$output_file")
                
                # 如果大小相近（±20%）
                diff=$((template_size - test_size))
                diff_abs=${diff#-}
                threshold=$((template_size / 5))
                
                if [ $diff_abs -lt $threshold ]; then
                    logical_x=$((x / 2))
                    logical_y=$((y / 2))
                    echo "  可能匹配: ($logical_x, $logical_y) - 大小差异: ${diff_abs}字节"
                    
                    # 保存候选
                    cp "$output_file" "test-results/candidate-match-$match_count.png"
                    echo "$match_count,$logical_x,$logical_y,$x,$y,$test_size" >> test-results/match-results.csv
                fi
                
                rm -f "$output_file"
            fi
            
            match_count=$((match_count + 1))
            
            # 每1000次显示进度
            if [ $((match_count % 1000)) -eq 0 ]; then
                echo "  已检查 $match_count 个位置..."
            fi
        done
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [ -f "test-results/match-results.csv" ]; then
        candidate_count=$(wc -l < test-results/match-results.csv)
        echo "✅ 找到 $candidate_count 个可能的匹配"
        echo ""
        echo "候选位置:"
        cat test-results/match-results.csv
        echo ""
        echo "📂 查看 candidate-match-*.png 文件"
        open test-results/
    else
        echo "⚠️  未找到匹配"
    fi
    
else
    echo "❌ 找不到模板图标文件"
fi

echo ""
