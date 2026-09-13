from pathlib import Path
from PIL import Image, ImageDraw

src_path = Path(r"C:\Users\Ян\.cursor\projects\c-Users-Desktop-snezha-fin-tracker\assets\icon-crown-clean.png")
out = Path(r"C:\Users\Ян\Desktop\ЯН\snezha-fin-tracker\icons")
out.mkdir(parents=True, exist_ok=True)

img = Image.open(src_path).convert("RGBA")
# Center-crop to square if needed
w, h = img.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
sq = img.crop((left, top, left + side, top + side))

cream = (246, 241, 230, 255)

def rounded(im, radius_ratio=0.22):
    im = im.convert("RGBA")
    r = int(im.size[0] * radius_ratio)
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=r, fill=255)
    out_im = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out_im.paste(im, mask=mask)
    return out_im

def fit(size, pad=0.0):
    canvas = Image.new("RGBA", (size, size), cream)
    inner = int(size * (1 - pad * 2))
    resized = sq.resize((inner, inner), Image.Resampling.LANCZOS)
    xy = (size - inner) // 2
    canvas.paste(resized, (xy, xy), resized)
    return canvas

sizes = {
    "icon-1024.png": (1024, 0.0),
    "icon-512.png": (512, 0.0),
    "icon-192.png": (192, 0.0),
    "apple-touch-icon.png": (180, 0.0),
    "icon-512-maskable.png": (512, 0.12),
}

for name, (size, pad) in sizes.items():
    im = fit(size, pad)
    im.save(out / name, "PNG")
    print("wrote", name, im.size)

# favicon-like small
fit(64, 0).save(out / "favicon.png", "PNG")
print("done")
