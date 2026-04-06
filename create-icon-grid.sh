#!/bin/bash

echo "=== 创建图标网格视图 ==="
echo ""

# 检查是否安装了ImageMagick
if ! command -v magick &> /dev/null && ! command -v montage &> /dev/null; then
    echo "⚠️  未安装ImageMagick"
    echo "安装命令: brew install imagemagick"
    echo ""
    echo "使用备用方案：创建HTML查看器"
    
    # 创建HTML查看器
    cat > test-results/icon-viewer.html << 'HTML'
<!DOCTYPE html>
<html>
<head>
    <title>TronLink图标查找器</title>
    <style>
        body { font-family: Arial; padding: 20px; background: #f0f0f0; }
        h1 { color: #333; }
        .grid { display: grid; grid-template-columns: repeat(10, 80px); gap: 10px; }
        .icon-box { 
            background: white; 
            padding: 5px; 
            border: 2px solid #ddd; 
            border-radius: 5px;
            text-align: center;
            cursor: pointer;
        }
        .icon-box:hover { border-color: #5B6FED; background: #f8f8ff; }
        .icon-box img { width: 64px; height: 64px; }
        .icon-label { font-size: 11px; color: #666; margin-top: 3px; }
        .selected { border-color: #5B6FED; background: #e8f0ff; }
        #info { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            background: white; 
            padding: 15px; 
            border: 2px solid #5B6FED;
            border-radius: 8px;
            min-width: 250px;
        }
    </style>
</head>
<body>
    <h1>🔍 TronLink图标查找器</h1>
    <p>点击蓝紫色背景+白色纸飞机的图标</p>
    
    <div id="info">
        <h3>选中的图标</h3>
        <div id="selected-info">未选择</div>
    </div>
    
    <div class="grid" id="icon-grid"></div>
    
    <script>
        const icons = [
HTML

    # 添加所有图标数据
    grep -v "^编号" test-results/full-scan-list.csv | while IFS=',' read num lx ly px py size; do
        if [ -f "test-results/full-scan-$num.png" ]; then
            echo "            {num: $num, x: $lx, y: $ly, file: 'full-scan-$num.png'}," >> test-results/icon-viewer.html
        fi
    done
    
    cat >> test-results/icon-viewer.html << 'HTML'
        ];
        
        const grid = document.getElementById('icon-grid');
        const info = document.getElementById('selected-info');
        
        icons.forEach(icon => {
            const box = document.createElement('div');
            box.className = 'icon-box';
            box.innerHTML = `
                <img src="${icon.file}" alt="Icon ${icon.num}">
                <div class="icon-label">#${icon.num}<br>(${icon.x},${icon.y})</div>
            `;
            
            box.onclick = () => {
                document.querySelectorAll('.icon-box').forEach(b => b.classList.remove('selected'));
                box.classList.add('selected');
                
                info.innerHTML = `
                    <strong>图标 ${icon.num}</strong><br>
                    逻辑坐标: (${icon.x}, ${icon.y})<br>
                    <br>
                    <button onclick="confirmIcon(${icon.num}, ${icon.x}, ${icon.y})">
                        确认这是TronLink
                    </button>
                `;
            };
            
            grid.appendChild(box);
        });
        
        function confirmIcon(num, x, y) {
            alert(`已选择图标 ${num}\n坐标: (${x}, ${y})\n\n请在终端运行:\n./confirm-tronlink-icon.sh ${num}`);
            
            // 复制命令到剪贴板
            const cmd = `./confirm-tronlink-icon.sh ${num}`;
            navigator.clipboard.writeText(cmd).then(() => {
                console.log('命令已复制到剪贴板');
            });
        }
    </script>
</body>
</html>
HTML

    echo "✅ HTML查看器已创建: test-results/icon-viewer.html"
    echo ""
    echo "📂 打开HTML查看器..."
    open test-results/icon-viewer.html
    
else
    echo "✅ 使用ImageMagick创建网格图..."
    
    # 使用montage创建网格
    if command -v montage &> /dev/null; then
        CMD="montage"
    else
        CMD="magick montage"
    fi
    
    $CMD test-results/full-scan-*.png \
        -tile 10x \
        -geometry 64x64+5+5 \
        -background white \
        -label '%f' \
        test-results/icon-grid-view.png 2>/dev/null
    
    if [ -f "test-results/icon-grid-view.png" ]; then
        echo "✅ 网格图已创建: test-results/icon-grid-view.png"
        open test-results/icon-grid-view.png
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "找到TronLink图标后，记录编号并运行:"
echo "  ./confirm-tronlink-icon.sh <编号>"
echo ""
