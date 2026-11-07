"""Depth for every piece of glass: flat in the middle, rounding down into its lead, like glass seated in a came.

  python depth.py maps/hero_ids.png            -> maps/hero_nrm.jpg  (R,G = surface tilt, B = height)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src = sys.argv[1]
ids = np.asarray(Image.open(src).convert("RGB")).astype(np.int32)
out = ids[..., 0] + ids[..., 1] * 256
h = np.clip(ndi.distance_transform_edt(out > 0) / 7.0, 0, 1)
h = ndi.gaussian_filter(h * h * (3 - 2 * h), 1.2)
gy, gx = np.gradient(h)
n = np.dstack([-gx * 3, -gy * 3, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
enc = np.dstack([(n[..., 0] * .5 + .5) * 255, (n[..., 1] * .5 + .5) * 255, h * 255]).astype(np.uint8)
dst = src.replace("_ids.png", "_nrm.jpg")
Image.fromarray(enc).resize((768, 768), Image.LANCZOS).save(dst, quality=90)
print("wrote", dst)
