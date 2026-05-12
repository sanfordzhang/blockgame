from PIL import Image
import numpy as np

img = Image.open('/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/resume-after-return.png')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'Image: {w}x{h}')

# Sample pixels around the known button area to see actual colors
print('\n--- Sampling button area pixels ---')
test_coords = [
    (1057, 1422),  # previous estimate center
    (1050, 1415), (1064, 1429),  # corners
    (1030, 1422), (1084, 1422),  # left/right edges
    (1057, 1408), (1057, 1436),  # top/bottom
]
for tx, ty in test_coords:
    if ty < h and tx < w:
        r, g, b = arr[ty, tx][:3]
        print(f'  ({tx},{ty}) RGB=({r:>3},{g:>3},{b:>3})')

# Broader scan for any non-background color in the button region
print('\n--- Scanning for button ---')
for ty in range(1400, 1450):
    row_colors = []
    for tx in range(980, 1140):
        r, g, b = arr[ty, tx][:3]
        # Look for saturated colored pixels (not beige/white bg)
        saturation = max(r,g,b) - min(r,g,b)
        brightness = (r+g+b) / 3
        if saturation > 50 and brightness < 220 and brightness > 40:
            row_colors.append((tx, ty, r, g, b))
    if len(row_colors) > 10:
        print(f'  y={ty}: found {len(row_colors)} colored pixels')
        if len(row_colors) < 30:
            for pc in row_colors[:5]:
                print(f'    ({pc[0]},{pc[1]}) RGB=({pc[2]},{pc[3]},{pc[4]})')
