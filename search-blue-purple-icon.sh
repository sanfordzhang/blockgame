#!/bin/bash

# 基于真实的TronLink图标样式搜索
# 特征：蓝紫色背景 + 白色纸飞机/箭头

echo "=== 搜索TronLink图标（蓝紫色+白色纸飞机） ==="
echo ""
echo "TronLink图标真实特征："
echo "  - 背景：蓝紫色（类似 #5B6FED）"
echo "  - 图案：白色的纸飞机/箭头（向右上方）"
echo "  - 形状：圆角方形"
echo ""

# 重新扫描，这次寻找蓝紫色图标
echo "🔍 在所有候选图标中查找蓝紫色..."
echo ""

# 列出所有候选
candidates=(1 3 4 6 7 8 9 10 11 13 14 15 16 18 19)

echo "检查所有候选图标："
for num in "${candidates[@]}"; do
    file="test-results/icon-grid-$num.png"
    if [ -f "$file" ]; then
        size=$(stat -f%z "$file")

        # 读取坐标
        case $num in
            1) coords="(1450, 35)" ;;
            3) coords="(1400, 35)" ;;
            4) coords="(1375, 35)" ;;
            6) coords="(1325, 35)" ;;
            7) coords="(1300, 35)" ;;
            8) coords="(1275, 35)" ;;
            9) coords="(1250, 35)" ;;
            10) coords="(1225, 35)" ;;
            11) coords="(1200, 35)" ;;
            13) coords="(1150, 35)" ;;
            14) coords="(1125, 35)" ;;
            15) coords="(1100, 35)" ;;
            16) coords="(1075, 35)" ;;
            18) coords="(1025, 35)" ;;
            19) coords="(1000, 35)" ;;
        esac

        echo "  图标$num: $coords - ${size}字节"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 建议：逐个查看所有图标"
echo ""

# 创建一个查看脚本
cat > view-all-icons.sh << 'VIEWSCRIPT'
#!/bin/bash
echo "逐个显示所有候选图标..."
for num in 1 3 4 6 7 8 9 10 11 13 14 15 16 18 19; do
    if [ -f "test-results/icon-grid-$num.png" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "图标 $num"
        case $num in
            1) echo "坐标: (1450, 35)" ;;
            3) echo "坐标: (1400, 35)" ;;
            4) echo "坐标: (1375, 35)" ;;
            6) echo "坐标: (1325, 35)" ;;
            7) echo "坐标: (1300, 35)" ;;
            8) echo "坐标: (1275, 35)" ;;
            9) echo "坐标: (1250, 35)" ;;
            10) echo "坐标: (1225, 35)" ;;
            11) echo "坐标: (1200, 35)" ;;
            13) echo "坐标: (1150, 35)" ;;
            14) echo "坐标: (1125, 35)" ;;
            15) echo "坐标: (1100, 35)" ;;
            16) echo "坐标: (1075, 35)" ;;
            18) echo "坐标: (1025, 35)" ;;
            19) echo "坐标: (1000, 35)" ;;
        esac
        open "test-results/icon-grid-$num.png"
        read -p "这是TronLink吗？(y/n/q退出): " answer
        if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
            echo ""
            echo "✅ 找到TronLink图标！编号: $num"
            ./confirm-tronlink-icon.sh $num
            exit 0
        elif [ "$answer" = "q" ] || [ "$answer" = "Q" ]; then
            exit 0
        fi
    fi
done
echo ""
echo "未找到匹配的图标"
VIEWSCRIPT

chmod +x view-all-icons.sh

echo "运行以下命令逐个查看图标："
echo "  ./view-all-icons.sh"
echo ""
echo "或者直接告诉我编号（1-19）"
echo ""
