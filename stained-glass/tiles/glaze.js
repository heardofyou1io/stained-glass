// Luminous glazing: every piece is a pane of saturated glass with a glowing core, a soft painted gradient toward the
// light and one highlight crescent; the lead is thin, dark and crisp. No noise texture. A small WebGL pass brightens
// each pane by its own level as a slow light moves, and sways the canopy and the head (motion weights from the drawing).
(function () {
  var S = 768, N = S * S;
  function hash(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function vn(x, y) { var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    function h(a, b) { return hash(a * 57.1 + b * 311.7); }
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; }
  function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function chamfer(d) {
    for (var y = 1; y < S; y++) for (var x = 1; x < S - 1; x++) { var i = y * S + x; d[i] = Math.min(d[i], d[i - 1] + 1, d[i - S] + 1, d[i - S - 1] + 1.414, d[i - S + 1] + 1.414); }
    for (var y2 = S - 2; y2 >= 0; y2--) for (var x2 = S - 2; x2 > 0; x2--) { var j = y2 * S + x2; d[j] = Math.min(d[j], d[j + 1] + 1, d[j + S] + 1, d[j + S + 1] + 1.414, d[j + S - 1] + 1.414); } }
  function blur(a, M, r) { var b = new Float32Array(a.length);
    for (var y = 0; y < M; y++) for (var x = 0; x < M; x++) { var s = 0, n = 0; for (var k = -r; k <= r; k++) { var xx = x + k; if (xx >= 0 && xx < M) { s += a[y * M + xx]; n++; } } b[y * M + x] = s / n; }
    for (var y2 = 0; y2 < M; y2++) for (var x2 = 0; x2 < M; x2++) { var s2 = 0, n2 = 0; for (var k2 = -r; k2 <= r; k2++) { var yy = y2 + k2; if (yy >= 0 && yy < M) { s2 += b[yy * M + x2]; n2++; } } a[y2 * M + x2] = s2 / n2; } }
  function cv(n) { var c = document.createElement("canvas"); c.width = c.height = n || S; return c; }

  // B = raw piece map from SvgGlass.build(..., {raw:true})
  function bake(B, o) {
    o = o || {};
    var piece = B.piece, lead = B.lead, owner = B.owner, P = {}, sat = o.sat || 1.25;
    B.pieces.forEach(function (p) { P[p.id] = p; p.max = 1; p.cx = p.x * S; p.cy = p.y * S; });
    var dist = new Float32Array(N); for (var a = 0; a < N; a++) dist[a] = piece[a] ? 1e6 : 0; chamfer(dist);
    for (var i0 = 0; i0 < N; i0++) { var q = piece[i0]; if (q && P[q] && dist[i0] > P[q].max) P[q].max = dist[i0]; }
    if (o.paint) B.pieces.forEach(function (p) { var n = 5 + Math.floor(hash(p.id * 3.3) * 6), dir = hash(p.id * 1.7) * Math.PI, st = [];
      for (var k = 0; k < n; k++) { var a = dir + (hash(p.id * 9.1 + k) - .5) * .7, len = p.max * (1.2 + hash(p.id + k * 4.1) * 2.2), ox = (hash(p.id * 5.3 + k) - .5) * p.max * 2.2, oy = (hash(p.id * 2.9 + k * 1.3) - .5) * p.max * 2.2;
        st.push({ ax: p.cx + ox - Math.cos(a) * len / 2, ay: p.cy + oy - Math.sin(a) * len / 2, bx: p.cx + ox + Math.cos(a) * len / 2, by: p.cy + oy + Math.sin(a) * len / 2,
          w: p.max * (.25 + hash(p.id * 7.7 + k) * .45), v: (hash(p.id * 11.3 + k) - .45) * .55, warm: hash(p.id * 13.1 + k) - .5 }); }
      p.st = st; });
    if (o.center) { var ramp = o.ramp || [[255, 238, 176], [252, 210, 118], [242, 168, 58], [222, 124, 36], [190, 92, 30], [36, 74, 150], [26, 54, 122], [16, 36, 90]], unit = o.unit || 88, hold = o.ramp ? -1 : 4;
      B.pieces.forEach(function (p) { if (!p.g.mat.radial) return; var d = Math.hypot(p.cx - o.center[0] * S, p.cy - o.center[1] * S) / S * 1000 / unit, i = Math.min(ramp.length - 1.001, d), k0 = Math.floor(i), fr = i - k0;
        if (k0 === hold) fr = 0; var c0 = ramp[k0], c1 = ramp[Math.min(ramp.length - 1, k0 + 1)], j = 1 + (hash(p.id * 4.7) - .5) * .18;
        p.col = [0, 1, 2].map(function (q) { return (c0[q] + (c1[q] - c0[q]) * fr) * j; }); if (!o.ramp && hash(p.id * 8.3) < .12 && d > 5) p.col = [30, 120, 110]; }); }
    var cC = cv(), cI = cv(), col = cC.getContext("2d").createImageData(S, S), ids = cI.getContext("2d").createImageData(S, S);
    if (o.atlas) B.pieces.forEach(function (p) { p.sw = Math.floor(hash(p.id * 3.17) * o.atlas.n); p.rot = hash(p.id * 5.9) * 6.283; p.ox = hash(p.id * 1.3) * 200; p.oy = hash(p.id * 2.7) * 200; });
    var isSil = B.groups.map(function (g) { return !!g.mat.sil; });
    function silAt(j) { return owner[j] && isSil[owner[j] - 1]; }
    for (var i = 0; i < N; i++) { var o4 = i * 4, x = i % S, y = (i - x) / S; col.data[o4 + 3] = ids.data[o4 + 3] = 255;
      var p = piece[i];
      if (silAt(i)) { var cx2 = o.center ? o.center[0] * S : S / 2, cy2 = o.center ? o.center[1] * S : S / 2, vx = cx2 - x, vy = cy2 - y, vl = Math.hypot(vx, vy) || 1;
        var out2 = 0; for (var st2 = 2; st2 <= 9; st2++) { var j2 = Math.round(y + vy / vl * st2) * S + Math.round(x + vx / vl * st2); if (!silAt(j2)) { out2 = Math.pow(1 - (st2 - 2) / 8, 1.5); break; } }
        var near = Math.exp(-vl / (S * .28)), rim = out2 * (.15 + .85 * near), b0 = 12 + 8 * near;
        col.data[o4] = b0 + 235 * rim; col.data[o4 + 1] = b0 * .8 + 160 * rim; col.data[o4 + 2] = b0 * .6 + 70 * rim; continue; }
      if (lead[i] || (!p && owner[i])) { var edge = piece[i - 1] || piece[i + 1] || piece[i - S] || piece[i + S];
        var lv2 = vn(x / 6, y / 6); if (edge) { col.data[o4] = (o.atlas ? 112 : 46) + 40 * lv2; col.data[o4 + 1] = (o.atlas ? 80 : 30) + 26 * lv2; col.data[o4 + 2] = (o.atlas ? 34 : 14) + 10 * lv2; } else { col.data[o4] = 9; col.data[o4 + 1] = 7; col.data[o4 + 2] = 5; }
        continue; }
      if (!p || !P[p]) continue;
      if (P[p].g.mat.sil) { var cx2 = o.center ? o.center[0] * S : S / 2, cy2 = o.center ? o.center[1] * S : S / 2, vx = cx2 - x, vy = cy2 - y, vl = Math.hypot(vx, vy) || 1;
        var sx2 = Math.round(x + vx / vl * 4), sy2 = Math.round(y + vy / vl * 4), j2 = sy2 * S + sx2, out2 = !(piece[j2] && P[piece[j2]] && P[piece[j2]].g.mat.sil);
        var near = Math.exp(-vl / (S * .35)), rim = out2 ? (.35 + .65 * near) : 0, b0 = 14 + 10 * near;
        col.data[o4] = b0 + 225 * rim; col.data[o4 + 1] = b0 * .8 + 150 * rim; col.data[o4 + 2] = b0 * .6 + 60 * rim;
        ids.data[o4] = p & 255; ids.data[o4 + 1] = p >> 8; continue; }
      var pc = P[p], t = dist[i] / pc.max, core = ss(0, .55, t);
      var rx = x - pc.cx, ry = y - pc.cy, rl = Math.hypot(rx, ry) || 1;
      var grad = 1 + .14 * ((-.6 * rx - .8 * ry) / Math.max(rl, pc.max * 1.4)) * Math.min(1, rl / pc.max);
      var paint = 1 + .16 * (vn(x / 30 + p * 3.7, y / 30 - p) - .5) + .08 * (vn(x / 9 + p, y / 9 + p * 2.3) - .5);
      var k = o.deep ? (.34 + .9 * Math.pow(core, .7)) * (.68 + .62 * hash(p * 2.71)) * grad * paint : (.66 + .42 * core) * grad * paint;
      if (o.atlas) { var A = o.atlas, sw = pc.sw, ca = Math.cos(pc.rot), sa = Math.sin(pc.rot), u = (rx * ca - ry * sa) * A.sc + pc.ox, v2 = (rx * sa + ry * ca) * A.sc + pc.oy, z2 = A.sz * 2;
        u = ((u % z2) + z2) % z2; v2 = ((v2 % z2) + z2) % z2; if (u >= A.sz) u = z2 - 1 - u; if (v2 >= A.sz) v2 = z2 - 1 - v2;
        var ax = (sw % A.cols) * A.sz + Math.floor(u), ay = Math.floor(sw / A.cols) * A.sz + Math.floor(v2), dt = A.px[ay * A.w + ax] / 255 + .5;
        k *= 1 + (dt - 1) * A.amt; }
      var warm = 0;
      if (o.paint) { for (var si = 0; si < pc.st.length; si++) { var S2 = pc.st[si], ex = S2.bx - S2.ax, ey = S2.by - S2.ay, L2 = ex * ex + ey * ey, hh = Math.max(0, Math.min(1, ((x - S2.ax) * ex + (y - S2.ay) * ey) / L2)),
          dd = Math.hypot(x - S2.ax - ex * hh, y - S2.ay - ey * hh), w = 1 - ss(S2.w * .35, S2.w, dd); k *= 1 + S2.v * w * .6; warm += S2.warm * w * .12; } }
      var g = .299 * pc.col[0] + .587 * pc.col[1] + .114 * pc.col[2];
      var r = (g + (pc.col[0] - g) * sat) * k, gg = (g + (pc.col[1] - g) * sat) * k, b = (g + (pc.col[2] - g) * sat) * k;
      if (warm) { r *= 1 + warm; b *= 1 - warm; }
      // one highlight crescent in the upper left of larger panes
      if (pc.max > 7 && t > .22 && hash(p * 7.31) < .45) { var rn = rl / (pc.max * 1.55), al = (-.62 * rx - .78 * ry) / rl;
        var arc = (1 - ss(.03, .065, Math.abs(rn - .5))) * ss(.5, .88, al) * .42; r += (255 - r) * arc; gg += (255 - gg) * arc; b += (250 - b) * arc; }
      col.data[o4] = Math.min(255, r); col.data[o4 + 1] = Math.min(255, gg); col.data[o4 + 2] = Math.min(255, b);
      ids.data[o4] = p & 255; ids.data[o4 + 1] = p >> 8; }
    if (o.halo) { var Q = 4, M2 = S / Q, hb = [new Float32Array(M2 * M2), new Float32Array(M2 * M2), new Float32Array(M2 * M2)];
      for (var yy = 0; yy < S; yy += Q) for (var xx = 0; xx < S; xx += Q) { var oo = (yy * S + xx) * 4, ll = (col.data[oo] + col.data[oo + 1] + col.data[oo + 2]) / 3, w4 = Math.max(0, ll - 120) / 135, qi = (yy / Q) * M2 + xx / Q;
        hb[0][qi] = col.data[oo] * w4; hb[1][qi] = col.data[oo + 1] * w4; hb[2][qi] = col.data[oo + 2] * w4; }
      hb.forEach(function (a4) { for (var pass = 0; pass < 3; pass++) blur(a4, M2, 4); });
      for (var i5 = 0; i5 < N; i5++) { var x5 = i5 % S, y5 = (i5 - x5) / S, q5 = Math.min(M2 - 1, Math.floor(y5 / Q)) * M2 + Math.min(M2 - 1, Math.floor(x5 / Q)), o5 = i5 * 4;
        col.data[o5] = Math.min(255, col.data[o5] + hb[0][q5] * o.halo); col.data[o5 + 1] = Math.min(255, col.data[o5 + 1] + hb[1][q5] * o.halo * .85); col.data[o5 + 2] = Math.min(255, col.data[o5 + 2] + hb[2][q5] * o.halo * .6); } }
    cC.getContext("2d").putImageData(col, 0, 0); cI.getContext("2d").putImageData(ids, 0, 0);
    var M = 128, f = S / M, tw = new Float32Array(M * M), hw = new Float32Array(M * M);
    for (var i3 = 0; i3 < N; i3++) { var gi = owner[i3]; if (!gi) continue; var gr = B.groups[gi - 1], x3 = i3 % S, y3 = (i3 - x3) / S, k3 = Math.floor(y3 / f) * M + Math.floor(x3 / f);
      tw[k3] = Math.max(tw[k3], gr.tw || 0); hw[k3] = Math.max(hw[k3], gr.hw || 0); }
    [tw, hw].forEach(function (a2) { for (var pass = 0; pass < 3; pass++) blur(a2, M, 3); });
    var cM = cv(M), mi = cM.getContext("2d").createImageData(M, M);
    for (var q2 = 0; q2 < M * M; q2++) { mi.data[q2 * 4] = Math.min(255, tw[q2] * 255 * 1.6); mi.data[q2 * 4 + 1] = Math.min(255, hw[q2] * 255 * 1.4); mi.data[q2 * 4 + 3] = 255; }
    cM.getContext("2d").putImageData(mi, 0, 0);
    return { tex: cC, ids: cI, mot: cM, pieces: B.pieces.map(function (p) { var r2 = { id: p.id, x: p.x, y: p.y }; if (p.g.mat.g) r2.g = p.g.mat.g; if (p.g.mat.f) r2.f = p.g.mat.f; return r2; }) };
  }

  var FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif",
    "uniform sampler2D uTex,uIds,uLvl,uMot;uniform float uN,uT,uPhoneAmt;uniform vec2 uLight,uPhone,uCanopy,uHeadP;varying vec2 v;",
    "vec2 rot(vec2 q,vec2 c,float a){float s=sin(a),k=cos(a);q-=c;return c+vec2(k*q.x-s*q.y,s*q.x+k*q.y);}",
    "void main(){",
    " vec2 mo=texture2D(uMot,v).rg; vec2 uv=v;",
    " float sw=.65*sin(uT*.45)+.35*sin(uT*.23+1.3);",
    " uv=rot(uv,uCanopy,-mo.r*.035*sw); uv.y-=mo.r*mo.r*.006*sin(uT*.55+.9);",
    " uv=rot(uv,uHeadP,-mo.g*(.03*sin(uT*.33)+.01*sin(uT*.71+2.)));",
    " vec3 c=texture2D(uTex,uv).rgb; vec3 q=texture2D(uIds,uv).rgb;",
    " float id=floor(q.r*255.+.5)+floor(q.g*255.+.5)*256.;",
    " float d=length(uLight-uv);",
    " float lvl=id>.5?texture2D(uLvl,vec2((id+.5)/uN,.5)).r:0.;",
    " vec3 col=id>.5? c*(.5+.85*lvl) : c;",
    " col+=vec3(1.,.82,.52)*exp(-d*d/.03)*.06*step(.5,id);",
    " float pd=distance(uv,uPhone); col+=vec3(1.,.93,.72)*exp(-pd*pd/.002)*.22*uPhoneAmt;",
    " col*=1.-.3*smoothstep(.45,.8,distance(v,vec2(.5)));",
    " gl_FragColor=vec4(col,1.);",
    "}"].join("\n");
  var VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";

  function Viewer(canvas) {
    var gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false }); if (!gl) throw new Error("no webgl");
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var l = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ["uTex", "uIds", "uLvl", "uMot", "uN", "uT", "uPhoneAmt", "uLight", "uPhone", "uCanopy", "uHeadP"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    var T = [0, 1, 2, 3].map(function () { return gl.createTexture(); });
    gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uIds, 1); gl.uniform1i(U.uLvl, 2); gl.uniform1i(U.uMot, 3);
    function up(unit, img, nearest) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, T[unit]);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); var f = nearest ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
    var spread = .19, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, light = [.5, .45], target = null, t = 0, pieces = [], lv, lvB, ph, Nn = 1, running = false, visible = true, wander;
    canvas.addEventListener("pointermove", function (e) { var r = canvas.getBoundingClientRect(); target = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; });
    canvas.addEventListener("pointerleave", function () { target = null; });
    function size() { var r = canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d)); gl.viewport(0, 0, canvas.width, canvas.height); }
    size(); new ResizeObserver(function () { size(); frame(0); }).observe(canvas);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(canvas);
    function frame(dt) { if (!pieces.length) return; t += dt; var tg = target || wander(t), k = 1 - Math.exp(-dt / 1.2);
      light[0] += (tg[0] - light[0]) * k; light[1] += (tg[1] - light[1]) * k; var kv = dt ? 1 - Math.exp(-dt / .9) : 1;
      for (var i = 0; i < pieces.length; i++) { var p = pieces[i], dx = p.x - light[0], dy = p.y - light[1];
        var goal = .22 + .78 * Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread)) + .05 * Math.sin(t * .4 + ph[p.id]) + (p.g || 0);
        if (p.f) goal += p.f * (.5 * Math.sin(t * 1.9 + ph[p.id]) + .3 * Math.sin(t * 3.7 + ph[p.id] * 1.7) + .2 * Math.sin(t * 6.1));
        lv[p.id] += (goal - lv[p.id]) * kv; lvB[p.id] = Math.round(Math.max(0, Math.min(1, lv[p.id])) * 255); }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T[2]); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Nn, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, lvB);
      gl.uniform2f(U.uLight, light[0], light[1]); gl.uniform1f(U.uT, reduce ? 0 : t); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
    function start() { if (running || reduce || !pieces.length) return; running = true; var last = performance.now();
      (function tick(now) { var dt = Math.min(.05, (now - last) / 1000); last = now; frame(dt); if (visible) requestAnimationFrame(tick); else running = false; })(last); }
    this.set = function (m) { up(0, m.tex, false); up(1, m.ids, true); up(3, m.mot, false);
      pieces = m.pieces; Nn = 1; pieces.forEach(function (p) { Nn = Math.max(Nn, p.id + 1); }); lv = new Float32Array(Nn); lvB = new Uint8Array(Nn); ph = new Float32Array(Nn);
      pieces.forEach(function (p) { ph[p.id] = (p.id * 2.399) % 6.283; });
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T[2]); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, Nn, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, lvB);
      ["TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER"].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, gl[k], gl.NEAREST); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1f(U.uN, Nn); var phn = m.phone; gl.uniform2f(U.uPhone, phn ? phn[0] : -1, phn ? phn[1] : -1); gl.uniform1f(U.uPhoneAmt, phn ? 1 : 0);
      gl.uniform2f(U.uCanopy, m.canopy[0], m.canopy[1]); gl.uniform2f(U.uHeadP, m.head[0], m.head[1]);
      spread = m.spread || .19;
      wander = m.wander || function (s) { var a = s / 30 * Math.PI * 2; return [.5 + .26 * Math.sin(a), .45 + .2 * Math.sin(a * 2 + 1.1)]; };
      frame(0); frame(1); start(); };
  }
  window.Glaze = { bake: bake, Viewer: Viewer };
})();
