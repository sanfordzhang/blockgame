#!/usr/bin/env python3
"""监听鼠标点击事件，记录 TronLink 签名相关点击位置"""
from pynput import mouse
import time

clicks = []

labels = ['TronLink签名按钮(Sign)']

print("=== TronLink 签名按钮位置记录 ===")
print("")
print("请把鼠标移到 TronLink 签名弹窗的【签名】按钮上，然后点击")
print("⏳ 等待你的点击...")
print("")

def on_click(x, y, button, pressed):
    if pressed and button == mouse.Button.left:
        clicks.append({'x': int(x), 'y': int(y)})
        print(f"✅ 签名按钮位置: ({int(x)}, {int(y)})")
        print("")
        print(f"SIGN_POSITION={int(x)},{int(y)}")
        return False  # 停止监听

with mouse.Listener(on_click=on_click) as listener:
    listener.join()
