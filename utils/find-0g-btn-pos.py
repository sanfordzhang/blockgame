from PIL import Image
import numpy as np

img = Image.open('screenshots/current-screen.png')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'屏幕尺寸: {w}x{h}')

# 从截图目测：0G/EVM 按钮在页面内容区左下方
# 大约在 Y=1300-1450, X=850-1250 (Retina屏幕坐标)
print('\n=== 精确扫描 0G/EVM 按钮区域 ===')

button_pixels = []
# 缩小扫描范围到按钮大概位置
for y in range(int(h*0.66), int(h*0.78)):
    for x in range(int(w*0.27), int(w*0.45)):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        # 靛蓝/紫蓝色按钮
        if 75 <= r <= 145 and 85 <= g <= 175 and 205 <= b <= 255:
            brightness = (r+g+b)/3
            if brightness < 230:
                button_pixels.append((x,y,r,g,b))

if button_pixels:
    xs = [p[0] for p in button_pixels]
    ys = [p[1] for p in button_pixels]
    print(f'找到 {len(button_pixels)} 个匹配像素')
    print(f'\n=== 0G / EVM 按钮 (精确) ===')
    print(f'X 范围: {min(xs)} - {max(xs)}px (宽度: {max(xs)-min(xs)}px)')
    print(f'Y 范围: {min(ys)} - {max(ys)}px (高度: {max(ys)-min(ys)}px)')
    cx = sum(xs) // len(xs)
    cy = sum(ys) // len(ys)
    print(f'中心点: ({cx}, {cy})')
    print(f'相对位置: X={min(xs)/w*100:.1f}%-{max(xs)/w*100:.1f}%')
    print(f'          Y={min(ys)/h*100:.1f}%-{max(ys)/h*100:.1f}%')
    print(f'中心相对: ({cx/w*100:.1f}%, {cy/h*100:.1f}%)')

    # 也分析 Connect TRON 按钮作为参考
    print('\n=== 对比: Connect TRON 按钮区域 (绿色) ===')
    tron_pixels = []
    for y in range(min(ys)-20, max(ys)+20):
        for x in range(min(xs)-300, min(xs)):
            r,g,b = arr[y, x][:3]
            sat = max(r,g,b) - min(r,g,b)
            brightness = (r+g+b)/3
            # 绿色按钮
            if g > r + 30 and g > b and 40 < g < 180 and sat > 30:
                tron_pixels.append((x,y))
    
    if tron_pixels:
        txs = [p[0] for p in tron_pixels]
        tys = [p[1] for p in tron_pixels]
        print(f'TRON按钮 X: {min(txs)}-{max(txs)}, Y: {min(tys)}-{max(tys)}')
        print(f'TRON中心: ({sum(txs)//len(txs)}, {sum(tys)//len(tys)})')
else:
    # 打印原始像素看看颜色
    print('\n=== 原始采样 (按钮预估区域) ===')
    test_points = [
        (int(w*0.33), int(h*0.71)),   # 预估按钮中心
        (int(w*0.33), int(h*0.70)),
        (int(w*0.33), int(h*0.72)),
        (int(w*0.30), int(h*0.71)),
        (int(w*0.36), int(h*0.71)),
        (int(w*0.18), int(h*0.71)),   # TRON 按钮区域
    ]
    for x, y in test_points:
        r,g,b = arr[y, x][:3]
        sat = max(r,g,b) - min(r,g,b)
        print(f'  ({x:>5},{y:>5}): RGB({r:>3},{g:>3},{b:>3}) sat={sat}')
