"""Glass bank: cut our own stained-glass art into its real pieces, then rebuild new geometric designs out of them.

Bank: every piece between the leads of hero_2048.jpg and landers/assets/art/*.webp (true colour, gradient, crinkle,
veins and darkening into the lead), with its Lab colour, size, elongation and main axis.
Render: each piece of a new design (piece map + target colour exported from the tiles) gets the real piece closest
in colour and shape, turned to the target's main axis and stretched into its extent; lead is redrawn as a dark core
with a warm rim. Writes tex / ids / nrm / pieces for the glass engine.
"""
import glob, json, os, sys, zlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.color import rgb2lab

# Sources: real stained-glass images to cut into a bank of pieces. GLASS_ART = comma-separated paths or globs.
ART = os.environ.get("GLASS_ART", "art/*.jpg,art/*.webp,art/*.png")
BANK = os.environ.get("GLASS_MAPS", "maps")
S = 768


def segment(rgb, white_bg):
    a = rgb.astype(np.float32)
    lum = ndi.gaussian_filter(.2126 * a[..., 0] + .7152 * a[..., 1] + .0722 * a[..., 2], .8)
    local = ndi.uniform_filter(lum, 9)
    lead = (lum < 14) | ((lum < local * .62) & (lum < 110))
    if white_bg:
        mx, mn = a.max(2), a.min(2)
        lead |= (lum > 168) & ((mx - mn) < 46)          # white paper and the silver lead of the page art are not glass
    lead = ndi.binary_closing(lead, iterations=1)
    lab, n = ndi.label(~lead)
    return lab, n


def add_pieces(bank, rgb, lab, n, src):
    objs = ndi.find_objects(lab)
    for i, sl in enumerate(objs, start=1):
        if sl is None:
            continue
        m = lab[sl] == i
        area = int(m.sum())
        if area < 260 or area > 60000:
            continue
        if sl[0].start == 0 or sl[1].start == 0 or sl[0].stop == lab.shape[0] or sl[1].stop == lab.shape[1]:
            continue
        crop = rgb[sl].astype(np.float32)
        ys, xs = np.nonzero(m)
        cy, cx = ys.mean(), xs.mean()
        cov = np.cov(np.vstack([xs - cx, ys - cy]))
        w, v = np.linalg.eigh(cov)
        e1 = v[:, 1]
        elong = float(np.sqrt(max(w[1], 1e-6) / max(w[0], 1e-6)))
        mean = crop[m].mean(0)
        if mean.max() < 40:                                  # nearly black: background, not glass
            continue
        lab0 = rgb2lab((mean / 255)[None, None, :])[0, 0]
        if lab0[0] > 78 and np.hypot(lab0[1], lab0[2]) < 30:   # white or pale grey: the phone screen, paper, silver
            continue
        # only clean glass: the middle half of the piece must have no blown-out white and no stray lead
        inner = ndi.binary_erosion(m, iterations=max(2, int(np.sqrt(area) * .18)))
        if inner.sum() > 30:
            L = crop[inner].mean(1)
            if (L > 238).mean() > .02 or (L < crop[m].mean() * .32).mean() > .03:
                continue
            soft = ndi.gaussian_filter(crop.mean(2), 7)[inner]
            if soft.std() / max(soft.mean(), 1) > .22:
                continue
        u = (xs - cx) * e1[0] + (ys - cy) * e1[1]
        vv = -(xs - cx) * e1[1] + (ys - cy) * e1[0]
        # nearest in-piece pixel for every pixel of the crop, so sampling never leaves the glass
        _, (iy, ix) = ndi.distance_transform_edt(~m, return_indices=True)
        bank.append(dict(src=src, crop=crop, mask=m, iy=iy, ix=ix, cx=cx, cy=cy, e1=e1, elong=elong, area=area,
                         hu=max(np.abs(u).max(), 1), hv=max(np.abs(vv).max(), 1),
                         lab=rgb2lab((mean / 255)[None, None, :])[0, 0]))


def build_bank():
    bank = []
    files = sorted({f for g in ART.split(",") for f in glob.glob(os.path.expanduser(g.strip()))})
    if not files:
        sys.exit(f"no art found for GLASS_ART={ART!r}")
    for f in files:
        im = Image.open(f).convert("RGB")
        if max(im.size) > 1024:
            im = im.resize((1024, round(1024 * im.size[1] / im.size[0])), Image.LANCZOS)
        a = np.asarray(im)
        white = float(a.mean()) > 120                    # art on a white page vs art on black
        lab, n = segment(a, white); add_pieces(bank, a, lab, n, os.path.basename(f))
    return bank


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)


def render(name, bank, rng):
    ids_im = np.asarray(Image.open(f"{BANK}/{name}_ids.png").convert("RGB")).astype(np.int32)
    meta = json.load(open(f"{BANK}/{name}_meta.json"))
    pid = ids_im[..., 0] + ids_im[..., 1] * 256
    pic = ids_im[..., 2] > 128
    out = np.zeros((S, S, 3), np.float32)
    # big panes are cut into smaller pieces, as in the real windows: nearest of a few seeds, a lead line between them
    nxt = pid.max() + 1; extra = []
    by = {p["id"]: p for p in meta["pieces"]}
    for p in list(meta["pieces"]):
        m = pid == p["id"]; area = int(m.sum())
        if area < meta.get("subArea", 3200) or p.get("g") or not meta.get("sub", True) or p.get("m") not in (meta.get("subMats") or ("sky", "night", "clear")):
            continue
        ys, xs = np.nonzero(m); k = int(round(area / 1900)); pick = rng.choice(len(ys), k, replace=False)
        sy, sx = ys[pick].astype(float), xs[pick].astype(float)
        lab_ = np.argmin((ys[:, None] - sy[None]) ** 2 + (xs[:, None] - sx[None]) ** 2, axis=1)
        tmp = np.zeros_like(pid); tmp[ys, xs] = lab_ + 1
        edge = (tmp > 0) & ((np.roll(tmp, 1, 0) != tmp) | (np.roll(tmp, 1, 1) != tmp)) & (np.roll(tmp, 1, 0) > 0) & (np.roll(tmp, 1, 1) > 0)
        edge = ndi.binary_dilation(edge) & m
        for j in range(1, k):
            sel = (tmp == j + 1) & ~edge; pid[sel] = nxt
            extra.append({"id": int(nxt), "col": [int(c * (1 + (rng.random() - .5) * .12)) for c in p["col"]], "g": p["g"], "f": p["f"]}); nxt += 1
        pid[edge] = 0
    meta["pieces"] = meta["pieces"] + extra
    ids_im = ids_im.copy(); ids_im[..., 0] = pid % 256; ids_im[..., 1] = pid // 256
    dist = ndi.distance_transform_edt(pid > 0)
    blab = np.array([b["lab"] for b in bank]); belong = np.array([b["elong"] for b in bank]); barea = np.array([b["area"] for b in bank])
    used = np.zeros(len(bank))
    pieces = []
    objs = ndi.find_objects(pid)
    for p in meta["pieces"]:
        i = p["id"]
        if i > len(objs) or objs[i - 1] is None:
            continue
        sl = objs[i - 1]; m = pid[sl] == i
        ys, xs = np.nonzero(m); area = len(ys)
        if area == 0:
            continue
        cy, cx = ys.mean(), xs.mean()
        if area > 2:
            w, v = np.linalg.eigh(np.cov(np.vstack([xs - cx, ys - cy]))); e1 = v[:, 1]; el = float(np.sqrt(max(w[1], 1e-6) / max(w[0], 1e-6)))
        else:
            e1 = np.array([1., 0.]); el = 1.
        u = (xs - cx) * e1[0] + (ys - cy) * e1[1]; vv = -(xs - cx) * e1[1] + (ys - cy) * e1[0]
        hu, hv = max(np.abs(u).max(), 1), max(np.abs(vv).max(), 1)
        tl = rgb2lab((np.array(p["col"]) / 255)[None, None, :])[0, 0]
        bhu = np.array([b["hu"] for b in bank]); bhv = np.array([b["hv"] for b in bank])
        mag = np.maximum(hu / (bhu * .48), hv / (bhv * .48))
        cost = np.linalg.norm(blab - tl, axis=1) + 2 * np.abs(np.log(belong / el)) + 3 * np.maximum(0, np.log(mag)) + 3 * used + rng.random(len(bank)) * 2
        b = bank[int(np.argmin(cost))]; used[int(np.argmin(cost))] += 1
        flip = 1 if rng.random() < .5 else -1
        nu, nv = u / hu, vv / hv * flip
        su, sv = nu * b["hu"] * .6, nv * b["hv"] * .6                     # the middle of one real piece, stretched as little as possible
        sx = b["cx"] + su * b["e1"][0] - sv * b["e1"][1]
        sy = b["cy"] + su * b["e1"][1] + sv * b["e1"][0]
        H, W = b["mask"].shape
        sx = np.clip(sx, 0, W - 1.001); sy = np.clip(sy, 0, H - 1.001)
        col = np.stack([ndi.map_coordinates(b["crop"][..., ch], [sy, sx], order=1, mode="nearest") for ch in range(3)], 1)   # smooth, not blocky
        # pull the real glass toward the design's colour, keeping its texture
        mean = col.mean(0); gain = np.clip(np.array(p["col"]) / np.maximum(mean, 1), .4, 2.5)
        col = col * (1 + (gain - 1) * .55)
        d = dist[sl][m]
        col *= (.5 + .5 * ss(0, 10, d))[:, None]                          # our own darkening into the new lead
        out[sl][m] = col
        pieces.append({"id": i, "a": area, "x": round(float(cx + sl[1].start) / S, 4), "y": round(float(cy + sl[0].start) / S, 4),
                       **({"g": p["g"]} if p["g"] else {}), **({"f": p["f"]} if p["f"] else {})})
    # lead: dark core, warm rim where it meets the glass
    lead = pic & (pid == 0)
    near = ndi.distance_transform_edt(pid == 0)
    core = lead | ((pid > 0) & (dist <= 1.6))                           # a thicker dark came, like the real windows
    edge = (pid > 0) & (dist > 1.6) & (dist <= 2.6)                       # a thin warm line where the glass meets it
    nz = ndi.gaussian_filter(rng.random((S, S)), 2) * 2
    out[core] = (np.array([14, 10, 6]) * (.8 + .4 * nz[core][:, None])).astype(np.float32)
    out[edge] = out[edge] * .55 + (np.array([120, 86, 40]) * (.7 + .5 * nz[edge][:, None])) * .45
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f"{BANK}/{name}_tex.png")
    ids2 = ids_im.copy(); ids2[..., 2] = 0
    Image.fromarray(ids2.astype(np.uint8)).save(f"{BANK}/{name}_ids2.png")
    h = ss(0, 6, dist); h = ndi.gaussian_filter(h, 1.1); gy, gx = np.gradient(h)
    n = np.dstack([-gx * 3, -gy * 3, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray(np.dstack([(n[..., 0] * .5 + .5) * 255, (n[..., 1] * .5 + .5) * 255, h * 255]).astype(np.uint8)).save(f"{BANK}/{name}_nrm.jpg", quality=90)
    json.dump({"pieces": pieces, "center": meta["center"], "spread": meta["spread"]}, open(f"{BANK}/{name}_pieces.json", "w"))
    return len(pieces)


if __name__ == "__main__":
    rng = np.random.default_rng(7)
    bank = build_bank()
    print("bank pieces:", len(bank), {s: sum(1 for b in bank if b["src"] == s) for s in sorted(set(b["src"] for b in bank))})
    names = sys.argv[1:] or sorted(os.path.basename(f)[:-10] for f in glob.glob(f"{BANK}/*_meta.json"))
    for nm in names:
        print(nm, render(nm, bank, np.random.default_rng(zlib.crc32(nm.replace("_on", "").replace("_off", "").encode()))))
