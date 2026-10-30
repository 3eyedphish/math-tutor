# Draws the app icon (rounded star badge with "+ ×") at the sizes iOS and Android want.
from PIL import Image, ImageDraw, ImageFont
import sys, math
out = sys.argv[1]
font_path = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
try: ImageFont.truetype(font_path, 10)
except Exception: font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def draw(size, maskable=False):
    S = size * 4
    img = Image.new("RGB", (S, S), "#7c3aed")
    d = ImageDraw.Draw(img)
    for y in range(S):  # vertical gradient purple → pink
        t = y / S
        c = (int(124 + (236 - 124) * t), int(58 + (72 - 58) * t), int(237 + (153 - 237) * t))
        d.line([(0, y), (S, y)], fill=c)
    cx, cy, R = S / 2, S / 2, S * (0.34 if maskable else 0.40)
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        r = R if i % 2 == 0 else R * 0.5
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill="#ffd54f")
    f = ImageFont.truetype(font_path, int(S * (0.15 if maskable else 0.18)))
    text = "+×"
    bb = d.textbbox((0, 0), text, font=f)
    d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1] + S * 0.02), text, font=f, fill="#5b21b6")
    return img.resize((size, size), Image.LANCZOS)
for s in (180, 192, 512):
    draw(s).save(f"{out}/icon-{s}.png")
draw(512, maskable=True).save(f"{out}/icon-maskable-512.png")
