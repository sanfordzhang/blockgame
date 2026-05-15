from PIL import Image
import numpy as np

img = Image.open('screenshots/current-now.png')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'Screen: {w}x{h}')

# Broader approach: find ALL purple/indigo pixels in the button area
# Use a wider color range and also check for the white text area
print('=== Full scan with broader purple range ===')
button_pixels = []
for y in range(int(h*0.68), int(h*0.84)):
    for x in range(int(w*0.20), int(w*0.55)):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        # Much broader: any blue-ish/purple-ish color
        # Also include slightly lighter shades (gradient/border)
        if (b > 180 and b > r and b > g and 
            r < 160 and g < 200 and
            not (r > 220 and g > 220 and b > 220)):  # exclude white bg
            button_pixels.append((x,y))

if button_pixels:
    xs = [p[0] for p in button_pixels]
    ys = [p[1] for p in button_pixels]
    
    print(f'Found {len(button_pixels)} blueish-purple pixels')
    print(f'X: [{min(xs)} - {max(xs)}]  width={max(xs)-min(xs)}')
    print(f'Y: [{min(ys)} - {max(ys)}]  height={max(ys)-min(ys)}')
    
    cx_p = (min(xs) + max(xs)) // 2
    cy_p = (min(ys) + max(ys)) // 2
    print(f'Center physical: ({cx_p}, {cy_p})')
    print(f'Center logical:  ({cx_p//2}, {cy_p//2})')
    
    # Crop with padding
    pad = 5
    crop = img.crop((min(xs)-pad, min(ys)-pad, max(xs)+pad, max(ys)+pad))
    crop.save('screenshots/cropped-0g-btn-broad.png')
    print('Saved broad crop')

else:
    print('No match. Dumping raw colors at expected position...')
    # Dump raw pixel grid around where button should be
    for yp in [70, 71, 72, 73, 74, 75]:
        y = int(h * yp / 100)
        line = f'y={yp}%({y:>4}): '
        for xp in range(25, 56):
            x = int(w * xp / 100)
            r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
            is_purple = 'P' if (b>180 and b>r and b<g+50) else ''
            line += f'{is_p}'
        print(line)
