// SVG cartoon -> stained glass maps for GlassEngine.
// The cartoon is a drawing: shapes carry data-mat (and optional data-cut = extra glass cuts in big areas, data-tw / data-hw =
// sway and head weights); lines with data-lead are lead drawn inside shapes (folds, creases, locks of hair).
// Shapes are rasterised twice with crisp edges: once with a unique colour each (regions), once as ink (lead).
(function () {
  var S = 768, N = S * S;
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function raster(svgText) { return new Promise(function (ok, no) {
    var img = new Image(), url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
    img.onload = function () { var c = document.createElement("canvas"); c.width = c.height = S; var x = c.getContext("2d"); x.drawImage(img, 0, 0, S, S); URL.revokeObjectURL(url); ok(x.getImageData(0, 0, S, S).data); };
    img.onerror = no; img.src = url; }); }

  function build(svgText, MAT, seed, opt) { opt = opt || {}; var OW = opt.outline || 6, LW = opt.leadScale || 1;
    var R = rng(seed || 1), doc = new DOMParser().parseFromString(svgText, "image/svg+xml"), root = doc.documentElement;
    var shapes = [].slice.call(root.querySelectorAll("[data-mat]")), leads = [].slice.call(root.querySelectorAll("[data-lead]"));
    var vb = root.getAttribute("viewBox");
    function wrap(inner) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="' + S + '" height="' + S + '" shape-rendering="crispEdges">' + inner + "</svg>"; }
    var regionSVG = '<rect x="-9999" y="-9999" width="99999" height="99999" fill="#000"/>', inkSVG = '<rect x="-9999" y="-9999" width="99999" height="99999" fill="#fff"/>';
    var under = [].slice.call(root.querySelectorAll("[data-under]"));
    shapes.forEach(function (el, i) {
      var id = i + 1, col = "rgb(" + (id & 255) + "," + ((id >> 8) & 255) + ",7)", d = el.getAttribute("d"), w = el.getAttribute("data-w");
      if (w) { regionSVG += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>';
        inkSVG += '<path d="' + d + '" fill="none" stroke="#000" stroke-width="' + (+w + OW + 1) + '" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#fff" stroke-width="' + (+w - 1) + '" stroke-linecap="round"/>'; }
      else { regionSVG += '<path d="' + d + '" fill="' + col + '"/>';
        inkSVG += '<path d="' + d + '" fill="#fff" stroke="#000" stroke-width="' + OW + '" stroke-linejoin="round"/>'; }
      if (el.hasAttribute("data-bg")) under.forEach(function (u) { inkSVG += '<path d="' + u.getAttribute("d") + '" fill="none" stroke="#000" stroke-width="' + ((u.getAttribute("data-under") || 3.4) * LW) + '" stroke-linecap="round"/>'; });
    });
    leads.forEach(function (el) { inkSVG += '<path d="' + el.getAttribute("d") + '" fill="none" stroke="#000" stroke-width="' + ((el.getAttribute("data-lead") || 4.5) * LW) + '" stroke-linecap="round"/>'; });
    return Promise.all([raster(wrap(regionSVG)), raster(wrap(inkSVG))]).then(function (r) {
      var reg = r[0], ink = r[1], owner = new Int32Array(N), lead = new Uint8Array(N);
      for (var i = 0; i < N; i++) { var o = i * 4; if (reg[o + 2] === 7) owner[i] = reg[o] + (reg[o + 1] << 8); if (ink[o] < 128) lead[i] = 1; }
      // extra cuts in big areas: nearest of a few seeds per shape, the borders become lead
      shapes.forEach(function (el, k) { var cut = +el.getAttribute("data-cut") || 0; if (!cut) return; var id = k + 1, px = [];
        for (var i2 = 0; i2 < N; i2++) if (owner[i2] === id) px.push(i2);
        var n = Math.max(2, Math.round(px.length / (cut * cut))), seeds = [];
        for (var j = 0; j < n; j++) { var q = px[Math.floor(R() * px.length)]; seeds.push([q % S, Math.floor(q / S)]); }
        var cell = new Int32Array(N);
        px.forEach(function (p) { var x = p % S, y = (p - x) / S, b = 0, bd = 1e12; for (var u = 0; u < seeds.length; u++) { var dx = x - seeds[u][0], dy = y - seeds[u][1], dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; b = u; } } cell[p] = b + 1; });
        px.forEach(function (p) { var c = cell[p]; if ((cell[p + 1] && cell[p + 1] !== c) || (cell[p + S] && cell[p + S] !== c)) { lead[p] = 1; lead[p + 1] = 1; } });
      });
      // pieces: connected glass between leads, inside one shape
      var piece = new Int32Array(N), stack = new Int32Array(N), pieces = [], id2 = 0;
      for (var p0 = 0; p0 < N; p0++) { if (!owner[p0] || lead[p0] || piece[p0]) continue;
        id2++; var sp = 0, n2 = 0, sx = 0, sy = 0, ow = owner[p0]; stack[sp++] = p0; piece[p0] = id2;
        while (sp) { var c2 = stack[--sp], cx = c2 % S, cy = (c2 - cx) / S; n2++; sx += cx; sy += cy;
          var nb = [cx > 0 ? c2 - 1 : -1, cx < S - 1 ? c2 + 1 : -1, c2 - S, c2 + S];
          for (var m = 0; m < 4; m++) { var nn = nb[m]; if (nn < 0 || nn >= N) continue; if (owner[nn] === ow && !lead[nn] && !piece[nn]) { piece[nn] = id2; stack[sp++] = nn; } } }
        pieces.push({ id: id2, n: n2, x: sx / n2 / S, y: sy / n2 / S, own: ow }); }
      var tiny = new Uint8Array(id2 + 1); pieces.forEach(function (p) { if (p.n < 24) tiny[p.id] = 1; });
      for (var z = 0; z < N; z++) if (piece[z] && tiny[piece[z]]) { lead[z] = 1; piece[z] = 0; }
      // lead only where there is glass nearby (drop ink outside the picture)
      for (var z2 = 0; z2 < N; z2++) if (lead[z2] && !owner[z2]) { var near = owner[z2 - 1] || owner[z2 + 1] || owner[z2 - S] || owner[z2 + S] || owner[z2 - 2] || owner[z2 + 2] || owner[z2 - 2 * S] || owner[z2 + 2 * S]; if (!near) lead[z2] = 0; }
      var groups = shapes.map(function (el) { var m = MAT[el.getAttribute("data-mat")] || MAT.default; return { mat: m, tw: +el.getAttribute("data-tw") || 0, hw: +el.getAttribute("data-hw") || 0, one: el.hasAttribute("data-one") }; });
      var oneCol = {};
      pieces = pieces.filter(function (p) { return !tiny[p.id]; }).map(function (p) { var g = groups[p.own - 1], mat = g.mat;
        var base = g.one ? (oneCol[p.own] = oneCol[p.own] || hex(mat.cols[Math.floor(R() * mat.cols.length)])) : hex(mat.cols[Math.floor(R() * mat.cols.length)]);
        return { id: p.id, n: p.n, x: p.x, y: p.y, g: g, col: base.map(function (v) { return v * (1 + (R() - .5) * (mat.vary || .2)); }) }; });
      // lead between two shapes that touch with no ink drawn: keep pieces of different shapes apart
      var B = { owner: owner, lead: lead, piece: piece, pieces: pieces, groups: groups };
      return opt.raw ? B : GlassDraw.maps(B);
    });
  }
  window.SvgGlass = { build: build };
})();
