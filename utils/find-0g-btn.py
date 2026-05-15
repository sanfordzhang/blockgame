from PIL import Image
import numpy as np

img = Image.open('/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/resume-current.png')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'Image size: {w}x{h}')

# The "0G / EVM" button is a purple/blue button next to "Connect TRON"
# It's in the lower-left area of the page content
# Look for blue/purple color (#6366f1 or similar indigo)
print('\nSearching for 0G/EVM button (blue-purple color)...')
for y in range(int(h*0.72), int(h*0.78)):
    pixels_found = []
    for x in range(int(w*0.27), int(w*0.43)):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        # Indigo/blue button color
        if r > 80 and r < 130 and g > 80 and g < 150 and b > 200 and b < 255:
            pixels_found.append((x,y,r,g,b))
    if len(pixels_found) > 10:
        xs = [p[0] for p in pixels_found]
        ys = [p[1] for p in pixels_found]
        cx = sum(xs)//len(xs)
        cy = sum(ys)//len(ys)
        print(f'  Y={y}: {len(pixels_found)} blue pixels, center=({cx},{cy}), X:[{min(xs)}-{max(xs)}]')

# Also sample the known approximate area
print('\nSampling around 0G/EVM button area:')
for yp in range(73, 78):
    y = int(h * yp / 100)
    for xp in range(33, 40):
        x = int(w * xp / 100)
        if x < w and y < h:
            r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
            marker = ' <-- BUTTON?' if (r > 80 and r < 140 and g > 80 and g < 160 and b > 200) else ''
            print(f'  ({x},{y}) [{xp}%,{yp}%]: RGB({r},{g},{b}){marker}')
