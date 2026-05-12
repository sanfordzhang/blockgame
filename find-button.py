from PIL import Image
img = Image.open('/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/screen-after-body-click.png')
arr = __import__('numpy').array(img)
h, w = arr.shape[:2]
print(f'Image: {w}x{h}')

# Find the blue/purple "0G / EVM" button
# It's next to the green "Connect TRON" button at the bottom of the hero section
blue_pixels = []
for y in range(int(h*0.65), int(h*0.75)):
    for x in range(int(w*0.25), int(w*0.45)):
        r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
        # Blue-ish button: B > R+30, B > 100, G > 70
        if b > r + 30 and b > 100 and g > 60:
            blue_pixels.append((x,y))

if blue_pixels:
    xs = [p[0] for p in blue_pixels]
    ys = [p[1] for p in blue_pixels]
    cx = sum(xs)//len(xs)
    cy = sum(ys)//len(ys)
    print(f'0G/EVM button: center=({cx},{cy})')
    print(f'X range: {min(xs)}-{max(xs)}, Y: {min(ys)}-{max(ys)}')
    print(f'Color: RGB{arr[cy,cx][:3]}')
else:
    print('No blue button found, sampling area:')
    for yp in [68, 69, 70]:
        y = int(h * yp / 100)
        for xp in range(28, 38):
            x = int(w * xp / 100)
            r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
            print(f'  ({x},{y}) [{xp}%,{yp}%]: RGB({r},{g},{b})')
