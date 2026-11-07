"""Cut a stained-glass picture into its pieces of glass.

Lead lines are darker than the glass around them, so every bright region between leads is one piece.
Writes, next to --out:  <name>_tex.jpg (the colour), <name>_ids.png (piece number in R + G*256, 0 = lead or
background) and <name>_pieces.json (centre, area and mean colour of every piece) for engine/glassengine.js.

  python segment.py art/hero.jpg --out maps --name hero [--size 1024] [--contrast 0.62]
"""
import argparse, json, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ap = argparse.ArgumentParser()
ap.add_argument("image"); ap.add_argument("--out", default="maps"); ap.add_argument("--name", default=None)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--contrast", type=float, default=.62, help="a pixel is lead when darker than this share of its neighbourhood")
ap.add_argument("--min-area", type=int, default=30)
a = ap.parse_args()
name = a.name or os.path.splitext(os.path.basename(a.image))[0]
os.makedirs(a.out, exist_ok=True)

img = Image.open(a.image).convert("RGB").resize((a.size, a.size), Image.LANCZOS)
rgb = np.asarray(img).astype(np.float32)
lum = ndi.gaussian_filter(.2126 * rgb[..., 0] + .7152 * rgb[..., 1] + .0722 * rgb[..., 2], .8)
local = ndi.uniform_filter(lum, 9)
lead = (lum < 14) | ((lum < local * a.contrast) & (lum < 110))      # local contrast, so dark blue glass stays glass
lead = ndi.binary_closing(lead, iterations=1)
lab, n = ndi.label(~lead)
sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
keep = np.zeros(n + 1, bool); keep[1:] = sizes >= a.min_area
remap = np.zeros(n + 1, np.int32); remap[keep] = np.arange(1, keep.sum() + 1)
ids = remap[lab]
edge = np.unique(np.concatenate([ids[:3].ravel(), ids[-3:].ravel(), ids[:, :3].ravel(), ids[:, -3:].ravel()]))
ids[np.isin(ids, edge[edge > 0])] = 0                                # pieces touching the border are scan edges

pieces = []
for i, sl in enumerate(ndi.find_objects(ids), start=1):
    if sl is None:
        continue
    m = ids[sl] == i; ys, xs = np.nonzero(m)
    pieces.append({"id": i, "x": round(float(xs.mean() + sl[1].start) / a.size, 4), "y": round(float(ys.mean() + sl[0].start) / a.size, 4),
                   "a": int(m.sum()), "c": [int(v) for v in rgb[sl][m].mean(0)]})
enc = np.zeros((a.size, a.size, 3), np.uint8); enc[..., 0] = ids % 256; enc[..., 1] = ids // 256
Image.fromarray(enc).save(f"{a.out}/{name}_ids.png", optimize=True)
img.save(f"{a.out}/{name}_tex.jpg", quality=86)
json.dump(pieces, open(f"{a.out}/{name}_pieces.json", "w"), separators=(",", ":"))
print(f"{name}: {len(pieces)} pieces, {float((ids > 0).mean()):.0%} of the picture is glass")
