from PIL import Image
import numpy as np

img = Image.open('test-results/screen-mm-closed.png')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'Image: {w}x{h}, Logical: {w//2}x{h//2}')

# 1. Find 0G/EVM blue button center
blue_pixels = []
for y in range(int(h*0.65), int(h*0.76)):
    for x in range(int(w*0.25), int(w*0.46)):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        if b > r + 30 and b > 100 and g > 60:
            blue_pixels.append((x,y,r,g,b))

if blue_pixels:
    xs = [p[0] for p in blue_pixels]
    ys = [p[1] for p in blue_pixels]
    cx, cy = sum(xs)//len(xs), sum(ys)//len(ys)
    print(f'[0G Button] pixel:({cx},{cy}) logical:({cx//2},{cy//2}) RGB:({arr[cy,cx][0]},{arr[cy,cx][1]},{arr[cy,cx][2]})')

# 2. Find MetaMask close X button (light colored X on dark background)
# The popup is on the right side. Look for the X icon area.
# MetaMask popup header is dark (#2b2b2b or similar), X is light gray/white
# Search top-right corner of screen for a small light region surrounded by dark
print('\n--- Searching for MetaMask X button ---')
# Look at very top-right of the dark popup area
for y in range(int(h*0.16), int(h*0.20), 2):
    row_lights = []
    for x in range(int(w*0.95), w):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        # Light pixel (the X) against dark background
        if r > 150 and g > 140 and b > 130:
            row_lights.append((x,y,r,g,b))
    if len(row_lights) >= 3:
        cx_x = sum(p[0] for p in row_lights)//len(row_lights)
        cy_y = sum(p[1] for p in row_lights)//len(row_lights)
        print(f'[MM-X] pixel:({cx_x},{cy_y}) logical:({cx_x//2},{cy_y//2}) count={len(row_lights)}')
        break

# Also check slightly lower - maybe the X is at different position  
alt_candidates = []
for y in range(int(h*0.17), int(h*0.22)):
    for x in range(int(w*0.96), min(int(w*0.995)+1, w)):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        brightness = (r+g+b)/3
        if brightness > 120 and brightness < 250:
            alt_candidates.append((x,y,r,g,b,brightness))

if alt_candidates:
    # Group nearby pixels to find the X center
    xs = [p[0] for p in alt_candidates]
    ys = [p[1] for p in alt_candidates]
    print(f'[MM-X-Alt] ~center pixel:({sum(xs)//len(xs)},{sum(ys)//len(ys)}) logical:({sum(xs)//len(xs)//2},{sum(ys)//len(ys)//2})')
    print(f'  Range: x[{min(xs)}-{max(xs)}] y[{min(ys)}-{max(ys)}]')
