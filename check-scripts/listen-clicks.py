#!/usr/bin/env python3
"""监听鼠标点击事件，记录2次点击位置"""
from pynput import mouse
import json, time

clicks = []
LOG = 'test-results/mouse-click-log.txt'

labels = ['TronLink钱包图标', '收藏品位置']

print("=== 鼠标点击监听 ===")
print("请依次点击:")
print("  1. TronLink钱包图标")
print("  2. 收藏品位置")
print("")
print("开始监听，等待你的点击...")
print("")

def on_click(x, y, button, pressed):
    if pressed and button == mouse.Button.left:
        n = len(clicks) + 1
        clicks.append({'x': int(x), 'y': int(y), 'label': labels[len(clicks)]})
        print(f"✅ 第{n}次点击: ({int(x)}, {int(y)}) - {labels[len(clicks)-1]}")

        if len(clicks) >= 2:
            # 保存日志
            with open(LOG, 'w') as f:
                for i, c in enumerate(clicks):
                    f.write(f"CLICK_{i+1}={c['x']},{c['y']}  # {c['label']}\n")
            print("")
            print(f"📄 已保存到: {LOG}")
            return False  # 停止监听

with mouse.Listener(on_click=on_click) as listener:
    listener.join()
