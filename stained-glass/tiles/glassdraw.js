// Glass Workshop: stained glass drawn in code the way a glazier draws a cartoon.
// 1. Outline: each body part / branch / leaf is a group of smooth distance-field shapes (blended within the group,
//    layered between groups, like cut paper).  2. Lead: around the silhouette, between groups, and inside each group
//    along its own flow (cuts across a limb, splits along it), wobbled so no two cuts are the same.
// 3. Glass: the spaces between leads become pieces; colour, hammered texture, depth and motion maps go to GlassEngine.
(function () {
  var S = 768, N = S * S;
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function smin(a, b, k) { var h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * .25; }
  function hash2(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
  function vnoise(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
  function worley(x, y) { var xi = Math.floor(x), yi = Math.floor(y), f1 = 9, f2 = 9;
    for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) { var cx = xi + i, cy = yi + j, px = cx + hash2(cx, cy), py = cy + hash2(cy + 7.1, cx - 3.3),
      d = (px - x) * (px - x) + (py - y) * (py - y); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    return Math.sqrt(f2) - Math.sqrt(f1); }

  // ---------- primitives (picture units 0..1). Each returns distance plus local coords: t along, s across (-1..1) ----------
  function cap(a, b, ra, rb) { var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, L = Math.sqrt(L2);
    return { box: [Math.min(a[0] - ra, b[0] - rb), Math.min(a[1] - ra, b[1] - rb), Math.max(a[0] + ra, b[0] + rb), Math.max(a[1] + ra, b[1] + rb)], len: L,
      f: function (x, y) { var px = x - a[0], py = y - a[1], h = Math.max(0, Math.min(1, (px * dx + py * dy) / L2)), r = lerp(ra, rb, h),
        qx = px - dx * h, qy = py - dy * h, side = (px * dy - py * dx) / L; return [Math.hypot(qx, qy) - r, h * L, side / r]; } }; }
  function ell(cx, cy, rx, ry, rot) { var c = Math.cos(rot || 0), s = Math.sin(rot || 0), m = Math.max(rx, ry);
    return { box: [cx - m, cy - m, cx + m, cy + m], len: 2 * rx,
      f: function (x, y) { var px = x - cx, py = y - cy, u = px * c + py * s, v = -px * s + py * c, k = Math.hypot(u / rx, v / ry);
        return [(k - 1) * Math.min(rx, ry), u + rx, v / ry]; } }; }
  function leafP(base, ang, len, wid) { var c = Math.cos(ang), s = Math.sin(ang);
    return { box: [Math.min(base[0], base[0] + c * len) - wid, Math.min(base[1], base[1] + s * len) - wid, Math.max(base[0], base[0] + c * len) + wid, Math.max(base[1], base[1] + s * len) + wid], len: len,
      f: function (x, y) { var px = x - base[0], py = y - base[1], u = px * c + py * s, v = -px * s + py * c, t = u / len;
        var hw = t < 0 || t > 1 ? -1 : wid * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t))), .8) * (1 - .3 * t);
        var d = t < 0 ? Math.hypot(u, v) : t > 1 ? Math.hypot(u - len, v) : Math.abs(v) - hw; return [Math.max(d, -Math.min(u, len - u) * .5), u, hw > 0 ? v / hw : 0]; } }; }

  // ---------- the cartoon ----------
  function Cartoon(seed) { this.R = rng(seed); this.groups = []; }
  // o: mat, k (blend), cut (spacing across, picture units), slant, splits (offsets along), tw, hw, wob
  Cartoon.prototype.group = function (prims, o) { o.prims = prims; this.groups.push(o); return o; };
  Cartoon.prototype.build = function () {
    var R = this.R, G = this.groups, owner = new Int32Array(N), lead = new Uint8Array(N);
    var tt = new Float32Array(N), sa = new Float32Array(N), dd = new Float32Array(N);
    var gd = new Float32Array(N), gt = new Float32Array(N), gs = new Float32Array(N);
    G.forEach(function (g, gi) {
      var bx0 = 1, by0 = 1, bx1 = 0, by1 = 0, k = g.k || .02, off = 0;
      g.prims.forEach(function (p) { p.off = off; off += p.len; bx0 = Math.min(bx0, p.box[0]); by0 = Math.min(by0, p.box[1]); bx1 = Math.max(bx1, p.box[2]); by1 = Math.max(by1, p.box[3]); });
      var X0 = Math.max(0, Math.floor((bx0 - k) * S)), Y0 = Math.max(0, Math.floor((by0 - k) * S)), X1 = Math.min(S - 1, Math.ceil((bx1 + k) * S)), Y1 = Math.min(S - 1, Math.ceil((by1 + k) * S));
      for (var y = Y0; y <= Y1; y++) for (var x = X0; x <= X1; x++) {
        var u = (x + .5) / S, v = (y + .5) / S, d = 1e9, best = 1e9, bt = 0, bs = 0;
        for (var j = 0; j < g.prims.length; j++) { var r = g.prims[j].f(u, v); d = j ? smin(d, r[0], k) : r[0]; if (r[0] < best) { best = r[0]; bt = r[1] + g.prims[j].off; bs = r[2]; } }
        if (d < 0) { var i = y * S + x; owner[i] = gi + 1; tt[i] = bt; sa[i] = bs; dd[i] = d; }
      }
    });
    // leads inside each group, following its flow
    var lw = 1.6 / S;
    for (var i2 = 0; i2 < N; i2++) { var o = owner[i2]; if (!o) continue; var g2 = G[o - 1], x2 = i2 % S, y2 = (i2 - x2) / S;
      var w1 = (vnoise(x2 * .018 + o * 3, y2 * .018) - .5), w2 = (vnoise(x2 * .05 + o, y2 * .05 + 9) - .5);
      if (g2.cut) { var c = (tt[i2] + sa[i2] * (g2.slant || 0) * .008 + w1 * g2.cut * .5) / g2.cut, f = c - Math.floor(c);
        if (Math.min(f, 1 - f) * g2.cut < lw * 1.1) lead[i2] = 1; }
      if (g2.splits) for (var q = 0; q < g2.splits.length; q++) { var sp = g2.splits[q] + w2 * .35 + Math.sin(tt[i2] * 40 + q * 2 + o) * .08;
        if (Math.abs(sa[i2] - sp) < .07) lead[i2] = 1; }
    }
    // leads around every group and the silhouette
    for (var y3 = 1; y3 < S - 1; y3++) for (var x3 = 1; x3 < S - 1; x3++) { var j3 = y3 * S + x3, v3 = owner[j3];
      if (owner[j3 - 1] !== v3 || owner[j3 + 1] !== v3 || owner[j3 - S] !== v3 || owner[j3 + S] !== v3) lead[j3] = 1; }
    var L2 = lead.slice();
    for (var y4 = 1; y4 < S - 1; y4++) for (var x4 = 1; x4 < S - 1; x4++) { var j4 = y4 * S + x4; if (lead[j4] && (owner[j4] || owner[j4 - 1] || owner[j4 + 1])) { L2[j4 + 1] = 1; L2[j4 + S] = 1; } }
    for (var z = 0; z < N; z++) if (!owner[z]) L2[z] = (L2[z] && (owner[z - 1] || owner[z + 1] || owner[z - S] || owner[z + S])) ? 1 : 0;
    // pieces: the spaces between leads
    var piece = new Int32Array(N), stack = new Int32Array(N), pieces = [], id = 0;
    for (var p0 = 0; p0 < N; p0++) { if (!owner[p0] || L2[p0] || piece[p0]) continue;
      id++; var sp2 = 0, n = 0, sx = 0, sy = 0; stack[sp2++] = p0; piece[p0] = id;
      while (sp2) { var c2 = stack[--sp2], cx = c2 % S, cy = (c2 - cx) / S; n++; sx += cx; sy += cy;
        var nb = [c2 - 1, c2 + 1, c2 - S, c2 + S];
        for (var m = 0; m < 4; m++) { var nn = nb[m]; if (nn < 0 || nn >= N) continue; if (owner[nn] && !L2[nn] && !piece[nn] && owner[nn] === owner[p0]) { piece[nn] = id; stack[sp2++] = nn; } } }
      pieces.push({ id: id, n: n, x: sx / n / S, y: sy / n / S, g: G[owner[p0] - 1] }); }
    // crumbs too small to be glass become lead
    var tiny = new Uint8Array(id + 1); pieces.forEach(function (p) { if (p.n < 18) tiny[p.id] = 1; });
    for (var z2 = 0; z2 < N; z2++) if (piece[z2] && tiny[piece[z2]]) { L2[z2] = 1; piece[z2] = 0; }
    pieces = pieces.filter(function (p) { return !tiny[p.id]; });
    pieces.forEach(function (p) { var mat = p.g.mat; p.col = (p.g.col || hex(mat.cols[Math.floor(R() * mat.cols.length)])).map(function (v) { return v * (1 + (R() - .5) * (mat.vary || .2)); }); });
    return { owner: owner, lead: L2, piece: piece, pieces: pieces, groups: G };
  };

  // ---------- maps for the engine (same look as the hero: glow to the middle, hammered veins, bronze-edged lead) ----------
  function canvas(n) { var c = document.createElement("canvas"); c.width = c.height = n || S; return c; }
  function chamfer(d) {
    for (var y = 1; y < S; y++) for (var x = 1; x < S - 1; x++) { var i = y * S + x; d[i] = Math.min(d[i], d[i - 1] + 1, d[i - S] + 1, d[i - S - 1] + 1.414, d[i - S + 1] + 1.414); }
    for (var y2 = S - 2; y2 >= 0; y2--) for (var x2 = S - 2; x2 > 0; x2--) { var j = y2 * S + x2; d[j] = Math.min(d[j], d[j + 1] + 1, d[j + S] + 1, d[j + S + 1] + 1.414, d[j + S - 1] + 1.414); } }
  function blur(a, M, r) { var b = new Float32Array(a.length);
    for (var y = 0; y < M; y++) for (var x = 0; x < M; x++) { var s = 0, n = 0; for (var k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < M) { s += a[y * M + xx]; n++; } } b[y * M + x] = s / n; }
    for (var y2 = 0; y2 < M; y2++) for (var x2 = 0; x2 < M; x2++) { var s2 = 0, n2 = 0; for (var k2 = -r; k2 <= r; k2++) { var yy = y2 + k2; if (yy >= 0 && yy < M) { s2 += b[yy * M + x2]; n2++; } } a[y2 * M + x2] = s2 / n2; } }
  function maps(B) {
    var piece = B.piece, lead = B.lead, owner = B.owner, P = {}, cC = canvas(), cI = canvas(), cNm = canvas();
    B.pieces.forEach(function (p) { P[p.id] = p; });
    var dist = new Float32Array(N); for (var a = 0; a < N; a++) dist[a] = piece[a] ? 1e6 : 0; chamfer(dist);
    var col = cC.getContext("2d").createImageData(S, S), ids = cI.getContext("2d").createImageData(S, S), nrm = cNm.getContext("2d").createImageData(S, S), h = new Float32Array(N);
    for (var i = 0; i < N; i++) { var o = i * 4, x = i % S, y = (i - x) / S; col.data[o + 3] = ids.data[o + 3] = nrm.data[o + 3] = 255;
      if (lead[i] && owner[i] !== undefined && (owner[i] || lead[i])) {
        if (!lead[i]) continue;
        var edge = piece[i - 1] || piece[i + 1] || piece[i - S] || piece[i + S], nz = vnoise(x * .15, y * .15);
        if (edge) { col.data[o] = 112 + 50 * nz; col.data[o + 1] = 82 + 36 * nz; col.data[o + 2] = 40 + 16 * nz; } else { var lv = 12 + nz * 9; col.data[o] = lv; col.data[o + 1] = lv * .75; col.data[o + 2] = lv * .55; }
        continue; }
      var pid = piece[i]; if (!pid) continue; var pc = P[pid], d = dist[i];
      var glow = .56 + .56 * ss(0, 10, d), mot = .86 + .26 * vnoise(x * .07 + pid * 3.1, y * .07);
      var w1 = worley(x / 12 + pid * 1.7, y / 12 - pid * .9), w2 = worley(x / 5 + pid * 4.1, y / 5);
      var crink = ss(0, .32, w1) * .75 + ss(0, .3, w2) * .25, ridge = 1 - ss(0, .07, w1);
      var k = glow * mot * (.74 + .36 * crink) + .16 * ridge * glow;
      col.data[o] = Math.min(255, pc.col[0] * k); col.data[o + 1] = Math.min(255, pc.col[1] * k); col.data[o + 2] = Math.min(255, pc.col[2] * k);
      ids.data[o] = pid & 255; ids.data[o + 1] = pid >> 8;
      var t = Math.min(1, d / 6); h[i] = t * t * (3 - 2 * t) * (.72 + .28 * crink); }
    for (var y5 = 1; y5 < S - 1; y5++) for (var x5 = 1; x5 < S - 1; x5++) { var j = y5 * S + x5, o2 = j * 4, gx = (h[j + 1] - h[j - 1]) * .5, gy = (h[j + S] - h[j - S]) * .5, nx = -gx * 3, ny = -gy * 3, m = Math.hypot(nx, ny, 1);
      nrm.data[o2] = (nx / m * .5 + .5) * 255; nrm.data[o2 + 1] = (ny / m * .5 + .5) * 255; nrm.data[o2 + 2] = h[j] * 255; }
    cC.getContext("2d").putImageData(col, 0, 0); cI.getContext("2d").putImageData(ids, 0, 0); cNm.getContext("2d").putImageData(nrm, 0, 0);
    var M = 128, f = S / M, tw = new Float32Array(M * M), hw = new Float32Array(M * M);
    for (var i3 = 0; i3 < N; i3++) { var g = owner[i3]; if (!g) continue; var gr = B.groups[g - 1], x3 = i3 % S, y3 = (i3 - x3) / S, k3 = Math.floor(y3 / f) * M + Math.floor(x3 / f);
      tw[k3] = Math.max(tw[k3], gr.tw || 0); hw[k3] = Math.max(hw[k3], gr.hw || 0); }
    [tw, hw].forEach(function (a2) { for (var pass = 0; pass < 3; pass++) blur(a2, M, 3); });
    var cM = canvas(M), mi = cM.getContext("2d").createImageData(M, M);
    for (var q = 0; q < M * M; q++) { mi.data[q * 4] = Math.min(255, tw[q] * 255 * 1.6); mi.data[q * 4 + 1] = Math.min(255, hw[q] * 255 * 1.4); mi.data[q * 4 + 3] = 255; }
    cM.getContext("2d").putImageData(mi, 0, 0);
    return { tex: cC, ids: cI, nrm: cNm, mot: cM, pieces: B.pieces.map(function (p) { var r = { id: p.id, x: p.x, y: p.y }; if (p.g.mat.g) r.g = p.g.mat.g; return r; }) };
  }
  // stage pictures: the outline (flat colour per group) and the lead drawing
  function stages(B) { var a = canvas(), b = canvas(), A = a.getContext("2d").createImageData(S, S), Bd = b.getContext("2d").createImageData(S, S), cols = {};
    B.groups.forEach(function (g, i) { cols[i + 1] = hex(g.mat.cols[0]); });
    for (var i = 0; i < N; i++) { var o = i * 4; A.data[o + 3] = Bd.data[o + 3] = 255; var g = B.owner[i];
      if (g) { var c = cols[g]; A.data[o] = c[0]; A.data[o + 1] = c[1]; A.data[o + 2] = c[2]; }
      var lv = B.lead[i] ? 30 : g ? 236 : 0; Bd.data[o] = Bd.data[o + 1] = lv; Bd.data[o + 2] = B.lead[i] ? 30 : g ? 228 : 0; }
    a.getContext("2d").putImageData(A, 0, 0); b.getContext("2d").putImageData(Bd, 0, 0); return { outline: a, lead: b }; }

  // ---------- materials ----------
  var MAT = {
    bark: { cols: ["#8a5524", "#a8692a", "#6b3f1c", "#c07f35", "#94602b", "#b37a3a"] },
    barkBlue: { cols: ["#2d5ea0", "#24508a"] },
    leaf: { cols: ["#e8962a", "#f2b84a", "#d9721c", "#eea23a", "#f5c35b", "#e08a22"], vary: .12 },
    leafT: { cols: ["#2aa58f", "#1f7f7a", "#35b39a"], vary: .1 },
    hood: { cols: ["#2b5fb0", "#1d4690", "#3c78c8", "#16346e", "#4f88d0", "#244f9c"] },
    pants: { cols: ["#c98a3a", "#a86a2a", "#dca154", "#b97a33", "#8f5a24", "#e0ab5e"] },
    skin: { cols: ["#e9b77a", "#dba46a", "#f0c48c", "#e3ad72"], vary: .08 },
    hair: { cols: ["#6b3f1c", "#8a5524", "#4a2a12", "#7a4a20", "#5a3416"] },
    shoe: { cols: ["#6a4422", "#7a5230", "#4a2e16", "#8a5f36"] },
    stone: { cols: ["#2a5ea8", "#1d4790", "#24a48f", "#3b7fc4", "#16346e", "#2f6fb8"] },
    screen: { cols: ["#fff4d0"], vary: .02, g: .55 }
  };

  // ---------- the scene: a person under a tree, reading a glowing phone ----------
  function underTree(seed) {
    var C = new Cartoon(seed), R = C.R, J = function (v, a) { return v + (R() - .5) * a; };
    // ground stones
    for (var x = .03; x < .82; x += .05 + R() * .025) C.group([ell(x, J(.905, .015), .028 + R() * .016, .016 + R() * .007, J(0, .4))], { mat: MAT.stone, k: .01, cut: .03, slant: 2 });
    // trunk: one smooth limb from the ground arching to the right
    var tp = [[J(.13, .02), .95], [J(.10, .015), .74], [J(.10, .015), .52], [J(.14, .015), .33], [J(.24, .02), .17], [J(.40, .02), J(.09, .015)], [J(.58, .02), J(.085, .015)], [J(.74, .02), J(.13, .02)], [J(.88, .02), J(.22, .03)]];
    var tr = [.072, .062, .052, .046, .04, .032, .025, .018, .011], trunk = [];
    for (var i = 0; i < tp.length - 1; i++) trunk.push(cap(tp[i], tp[i + 1], tr[i], tr[i + 1]));
    C.group(trunk.slice(0, 4), { mat: MAT.bark, k: .03, cut: .07, slant: 5, splits: [-.15] });
    C.group(trunk.slice(4), { mat: MAT.bark, k: .03, cut: .06, slant: 4, splits: [.05], tw: .35 });
    // branches hanging from the limb, each with leaves along it
    function branch(p, ang, len, w, depth, tw0) {
      var pts = [p], a = ang, n = 4;
      for (var k = 1; k <= n; k++) { a += (R() - .5) * .3 + .1; var q = pts[k - 1]; pts.push([q[0] + Math.cos(a) * len / n, q[1] + Math.sin(a) * len / n]); }
      var prims = []; for (var k2 = 0; k2 < n; k2++) prims.push(cap(pts[k2], pts[k2 + 1], lerp(w, w * .4, k2 / n), lerp(w, w * .4, (k2 + 1) / n)));
      C.group(prims, { mat: MAT.bark, k: .01, cut: .05, slant: 3, tw: Math.min(1, tw0 + .2) });
      for (var m = 1; m <= n; m++) { var b = pts[m];
        for (var sd = -1; sd <= 1; sd += 2) { if (R() < .45) continue; var la = a + sd * (.8 + R() * .5) + .35, ln = .055 + R() * .03;
          C.group([leafP(b, la, ln, .02 + R() * .006)], { mat: R() < .14 ? MAT.leafT : MAT.leaf, k: .005, splits: [0], cut: R() < .5 ? ln * .55 : 0, tw: Math.min(1, tw0 + .45) }); } }
      if (depth > 0) for (var c2 = 0; c2 < 2; c2++) branch(pts[1 + Math.floor(R() * 3)], a + (R() - .35) * 1.1, len * .6, w * .6, depth - 1, Math.min(1, tw0 + .2));
      var tip = pts[n]; C.group([leafP(tip, a + .3, .065, .022)], { mat: MAT.leaf, k: .005, splits: [0], tw: 1 });
    }
    for (var bI = 0; bI < 3; bI++) { var at = tp[5 + bI]; branch([at[0], at[1] + .01], .55 + R() * .6, .2 + R() * .08, .016, 1, .3 + bI * .12); }
    // the person: seated against the trunk, knees up, head bowed over the phone
    var hip = [.335, .805], chest = [.295, .62], sh = [.315, .565], neck = [.355, .52], head = [.392, .458];
    var knee = [.55, .625], ank = [.615, .842], knee2 = [.515, .655], ank2 = [.57, .852];
    C.group([cap(hip, knee2, .046, .037), cap(knee2, ank2, .035, .027)], { mat: MAT.pants, k: .02, cut: .06, slant: 4, splits: [.1] });
    C.group([ell(ank2[0] + .032, ank2[1] + .014, .048, .022, .06)], { mat: MAT.shoe, k: .01, cut: .035, slant: 3 });
    C.group([cap([.30, .535], [.33, .49], .05, .042)], { mat: MAT.hood, k: .02, cut: .05, slant: 3, hw: .5 });            // hood behind the head
    C.group([cap(hip, chest, .078, .074), cap(chest, sh, .074, .06)], { mat: MAT.hood, k: .05, cut: .075, slant: 6, splits: [-.35, .4] });
    C.group([cap(hip, knee, .054, .044), cap(knee, ank, .042, .031)], { mat: MAT.pants, k: .025, cut: .065, slant: 5, splits: [.05] });
    C.group([ell(ank[0] + .036, ank[1] + .016, .054, .025, .06), cap([ank[0], ank[1] + .002], [ank[0] + .005, ank[1] - .03], .026, .024)], { mat: MAT.shoe, k: .015, cut: .04, slant: 3 });
    C.group([cap([sh[0] + .01, sh[1] - .005], neck, .026, .02)], { mat: MAT.skin, k: .01, hw: .6 });
    C.group([ell(head[0], head[1], .046, .055, .55), ell(head[0] + .028, head[1] + .03, .022, .02, .5)], { mat: MAT.skin, k: .02, cut: .045, slant: 2, hw: 1 });   // head + jaw
    var hairP = [ell(head[0] - .016, head[1] - .026, .048, .036, .5)];
    for (var hk = 0; hk < 6; hk++) { var ha = -3.0 + hk * .4, hb = [head[0] - .016 + Math.cos(ha) * .04, head[1] - .026 + Math.sin(ha) * .03];
      hairP.push(leafP(hb, ha + .25, .03 + R() * .015, .012)); }
    C.group(hairP, { mat: MAT.hair, k: .012, cut: .028, slant: 6, hw: 1 });
    C.group([ell(head[0] - .016, head[1] + .012, .01, .014, .2)], { mat: MAT.skin, k: .005, hw: 1 });                     // ear
    var elbow = [.405, .705], wrist = [.478, .592];
    C.group([cap([sh[0] + .015, sh[1] + .01], elbow, .036, .031), cap(elbow, wrist, .031, .025)], { mat: MAT.hood, k: .025, cut: .055, slant: 4, splits: [0] });
    var ph = [.5, .55], pa = -.62;
    C.group([ell(wrist[0] + .018, wrist[1] - .006, .025, .017, -.7)], { mat: MAT.skin, k: .01, cut: .02 });               // hand
    C.group([cap([ph[0] - Math.cos(pa) * .012, ph[1] - Math.sin(pa) * .012], [ph[0] + Math.cos(pa) * .012, ph[1] + Math.sin(pa) * .012], .019, .019)], { mat: MAT.screen, k: .005 });
    C.group([ell(wrist[0] + .032, wrist[1] + .006, .014, .009, -.4)], { mat: MAT.skin, k: .005 });                        // thumb
    var B = C.build(), m = maps(B), st = stages(B);
    m.phone = ph; m.canopy = tp[4]; m.head = neck; m.stages = st;
    m.wander = function (s) { var a = s / 24 * Math.PI * 2; return [.48 + .28 * Math.sin(a), .45 + .24 * Math.sin(a * 2 + 1.1)]; };
    return m;
  }
  window.GlassDraw = { underTree: underTree, maps: maps };
})();
