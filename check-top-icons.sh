#!/bin/bash
# 检查文件最大的前10个图标

echo "=== 检查最可能的TronLink图标候选 ==="
echo ""
echo "按文件大小排序（最大的最可能包含复杂图案）："
echo ""

# 获取最大的10个
sort -t',' -k6 -nr test-results/full-scan-list.csv | grep -v "^编号" | /usr/bin/head -10 | while IFS=',' read num lx ly px py size; do
    echo "图标$num: 坐标($lx, $ly) - ${size}字节"
    
    if [ -f "test-results/full-scan-$num.png" ]; then
        open "test-results/full-scan-$num.png"
        sleep 0.5
    fi
done

echo ""
echo "已打开前10个最大的图标"
echo "请查找蓝紫色+白色纸飞机的TronLink图标"
echo ""
