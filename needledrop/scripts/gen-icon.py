"""Regenerates build/icon.png and build/icon.ico (needs Pillow: pip install pillow)."""
from PIL import Image, ImageDraw

S = 2048
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

tile = Image.new('RGBA', (S, S))
td = ImageDraw.Draw(tile)
top, bot = (42, 34, 56), (21, 17, 29)
for y in range(S):
    t = y / (S - 1)
    td.line([(0, y), (S, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=255)
img.paste(tile, (0, 0), mask)

cx, cy, R = S // 2, S // 2, int(S * 0.36)
d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(11, 9, 16, 255))
for r in range(int(R * 0.32), R - 20, 22):
    shade = 26 if (r // 22) % 2 == 0 else 33
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(shade, 22, shade + 8, 255), width=4)
L = int(R * 0.34)
d.ellipse([cx - L, cy - L, cx + L, cy + L], fill=(255, 178, 36, 255))
h = int(L * 0.16)
d.ellipse([cx - h, cy - h, cx + h, cy + h], fill=(21, 17, 29, 255))

out = img.resize((1024, 1024), Image.LANCZOS)
out.save('build/icon.png')
out.save('build/icon.ico', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
print('icon written')
