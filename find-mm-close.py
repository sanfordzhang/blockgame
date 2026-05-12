from PIL import Image
import numpy as np

img = Image.open('/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/resume-after-0g-click.png')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'Image: {w}x{h}')

# Find the X (close) button of MetaMask panel - top-right corner of the dark panel
# The MetaMask panel is on the right side, X should be near top-right
print('\nSearching for MetaMask close button (X)...')
# Look for white/light X in the top-right area of the MetaMask panel
for y in range(int(h*0.13), int(h*0.17)):
    for x in range(int(w*0.96), int(w*0.99)):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        # White or light gray (X button)
        if r > 200 and g > 200 and b > 200:
            print(f'  Found light pixel at ({x},{y}): RGB({r},{g},{b})')

# Also check the exact area where X should be  
print('\nSampling MetaMask close area:')
for yp in range(14, 16):
    y = int(h * yp / 100)
    for xp in range(97, 99):
        x = int(w * xp / 100)
        if x < w and y < h:
            r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
            print(f'  ({x},{y}) [{xp}%,{yp}%]: RGB({r},{g},{b})')
