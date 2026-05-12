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
