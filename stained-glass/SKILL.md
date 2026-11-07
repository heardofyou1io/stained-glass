---
name: stained-glass
description: Light stained-glass art live in the browser, piece by piece, and build new stained-glass designs from real glass. Use when asked to animate, light, bring to life or make interactive a stained-glass image; to make stained-glass medallions, icons, windows or loops for a website, report or social post; or to turn a still stained-glass picture into a moving hero without a video model.
---

# Stained glass, lit live

Real stained-glass art is cut into its pieces along the lead lines, then a small WebGL engine lights every piece on its own: a slow moving light, rounded edges that catch it, glass texture, ripples, warm and cool shifts, gentle sway. New designs are drawn as geometry and every pane is filled with a real piece of glass from a bank cut out of existing art.

## What works and what does not (learned the hard way)

- **Light real art; do not draw people or plants in code.** Every attempt to draw a person, a tree or leaves from code (2D shapes, SDF 3D figures, hand-written SVG) read as fake next to painted art. Code is excellent at light, depth and motion on top of real art.
- **Geometric designs work** when every pane is filled from the glass bank: sun, moon and stars, compass rose, rose window, lighthouse, lantern, keyhole, magnifying glass, envelope, hourglass. Organic shapes do not.
- **Procedural glass texture looks fake** (cracked leather, muddy shadows). Real glass pixels from the bank carry the right texture, colour and darkening into the lead.
- **Motion must be slow and eased.** Light glides about a second behind the pointer; loops of 16 to 30 seconds; no jitter, no line boil, nothing re-rolled per frame.

## Pipeline

```bash
# 1. cut a picture into pieces (local contrast finds the lead, so dark blue glass stays glass)
python scripts/segment.py art/window.jpg --out maps --name window      # window_tex.jpg, window_ids.png, window_pieces.json
# 2. depth: flat in the middle of each piece, rounding into its lead
python scripts/depth.py maps/window_ids.png                             # window_nrm.jpg
```

```html
<canvas id="glass" style="width:100%;aspect-ratio:1"></canvas>
<script src="engine/glassengine.js"></script>
<script>
fetch("maps/window_pieces.json").then(r => r.json()).then(pieces =>
  GlassEngine.create(document.getElementById("glass")).set({
    tex: "maps/window_tex.jpg", ids: "maps/window_ids.png", nrm: "maps/window_nrm.jpg", pieces,
    ambient: .3,        // resting brightness of unlit glass (.10 dramatic, .34 for a site hero)
    vignette: .15,      // darkening at the corners
    phone: [.49, .57],  // optional: a breathing glow at a point (x, y from 0 to 1)
    canopy: [.3, .13], head: [.4, .46]   // optional pivots for sway and a slight head turn
  }));
</script>
```

Without a `mot` motion map the engine uses the built-in hero motion. Pass your own `mot` (a canvas: red = sway weight, green = head weight) for other art, or `sway: 0` for none.

## Glass bank: new designs from real glass

1. Put real stained-glass images in `art/` (or set `GLASS_ART` to comma-separated paths or globs).
2. Designs live in `tiles/tiles.js` as SVG: shapes carry `data-mat`, lead lines `data-lead`. Export each design's piece map and target colours: `GLASS_MAPS=maps python scripts/export_tiles.py sun moon compass` (needs Playwright with Chromium).
3. Fill every pane from the bank: `GLASS_MAPS=maps python scripts/bank.py`. Each pane gets the real piece closest in colour and shape, turned to its main axis and stretched as little as possible; big background panes are cut smaller first; lead is redrawn as a dark core with a warm rim.
4. Show them with `engine/tileglass.js`. One shared WebGL context renders every visible tile and copies it into each tile's own canvas, so a page of many windows never runs out of contexts. Animate with `levelFn(piece, t)`; see `demo/index.html` for the lighthouse beam, sunrise, lantern flame, rose window echo and keyhole loops.

## Shipping rules

- **Safari:** never put blur (CSS `filter`, `backdrop-filter`, SVG filters) over anything that moves; it drops to about 6 frames a second. The engine uses no blur.
- **Contexts:** Safari allows few WebGL contexts. One engine per big piece of art, one shared context for many tiles (tileglass.js).
- **Precision:** the engine asks for `highp`; with `mediump` some Chrome GPUs draw noise as stripes.
- **Fallback:** keep a still image under every canvas and fade the canvas in only after it has drawn. Honour `prefers-reduced-motion` (still frame).
- **Caching:** if your host serves assets as immutable, version every URL (`?v=<hash>`), or returning visitors keep the old files.
- **Check** in WebKit and Chromium (Playwright) at desktop and phone width before shipping.
