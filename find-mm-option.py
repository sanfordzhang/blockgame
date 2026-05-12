from PIL import Image
img = Image.open('/Users/yingfengzhang/1JackSource/blockchain/game-core/test-results/screen-after-mm-select.png')
arr = __import__('numpy').array(img)
h, w = arr.shape[:2]
print(f'Image: {w}x{h}')

# The MetaMask row has: fox icon (orange) + "MetaMask" text + ">" arrow
# Let me find the full clickable row by looking for white/light gray background
# in the popup area around y=25-28%
print('Sampling MetaMask row (looking for text area):')
for yp in [25, 26, 27]:
    y = int(h * yp / 100)
    for xp in range(78, 88):
        x = int(w * xp / 100)
        if x < w and y < h:
            r,g,b = int(arr[y,x][0]), int(arr[y,x][1]), int(arr[y,x][2])
            marker = ' <-- TEXT?' if r < 60 and g < 60 and b < 60 else ''
            if r > 200 and g > 200 and b > 200:
                print(f'  ({x},{y}) [{xp}%,{yp}%]: RGB({r},{g,b}) WHITE{marker}')
            elif xp == 83 or xp == 84:
                print(f'  ({x},{y}) [{xp}%,{yp}%]: RGB({r},{g},{b}){marker}')

# Also check the exact center of the MetaMask row
# Row should span most of popup width
print('\nLooking for row boundaries:')
y_test = int(h * 0.26)
row_start, row_end = None, None
for x in range(int(w*0.76), int(w*0.97)):
    r,g,b = int(arr[y_test,x][0]), int(arr[y_test,x][1]), int(arr[y_test,x][2])
    # White/light background of the row
    if r > 240 and g > 240 and b > 240:
        if row_start is None:
            row_start = x
        row_end = x
if row_start:
    row_cx = (row_start + row_end) // 2
    print(f'MetaMask row at Y={y_test}: X={row_start}-{row_end}, center=({row_cx}, {y_test})')
