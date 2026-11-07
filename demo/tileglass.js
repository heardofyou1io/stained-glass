// Tile glass: shows windows built from the glass bank and lights them piece by piece.
// One shared WebGL context renders every visible window in turn and copies the result into that window's own 2D canvas,
// so a page of many windows never runs out of contexts (Safari allows few). Off screen, a window's textures are freed
// and its still image shows. Optional second texture (every pane "named") is mixed in pane by pane through onT;
// optional levelFn(p, t) adds light per piece over time for the animation tests.
(function () {
  var VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif",
    "uniform sampler2D uTex,uTex2,uIds,uLvl;uniform float uN,uHas2;uniform vec2 uLight;varying vec2 v;",
    "void main(){",
    " vec3 c=texture2D(uTex,v).rgb; vec3 q=texture2D(uIds,v).rgb;",
    " float id=floor(q.r*255.+.5)+floor(q.g*255.+.5)*256.;",
    " vec4 lq=id>.5?texture2D(uLvl,vec2((id+.5)/uN,.5)):vec4(0.);",
    " if(uHas2>.5) c=mix(c,texture2D(uTex2,v).rgb,lq.a);",
    " float d=length(uLight-v);",
    " vec3 col=id>.5? c*(.48+.9*lq.r) : c;",
    " col+=vec3(1.,.82,.52)*exp(-d*d/.03)*.05*step(.5,id);",
    " col*=1.-.28*smoothstep(.45,.8,distance(v,vec2(.5)));",
    " gl_FragColor=vec4(col,1.);",
    "}"].join("\n");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, G = null, active = [], running = false;

  function shared() { if (G) return G;
    var c = document.createElement("canvas"); c.width = c.height = 720;
    var gl = c.getContext("webgl", { antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: false }); if (!gl) throw new Error("no webgl");
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var l = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ["uTex", "uTex2", "uIds", "uLvl", "uN", "uHas2", "uLight"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uIds, 1); gl.uniform1i(U.uLvl, 2); gl.uniform1i(U.uTex2, 3); gl.viewport(0, 0, 720, 720);
    G = { gl: gl, canvas: c, U: U }; return G; }
  function texFrom(gl, img, nearest) { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); var f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; }

  function Tile(host, m) {
    this.host = host; this.m = m; this.t = m.t0 || 0; this.target = null;
    var P = m.pieces, N = 1; P.forEach(function (p) { N = Math.max(N, p.id + 1); }); this.N = N;
    this.lv = new Float32Array(N); this.on = new Float32Array(N); this.onT = m.onT || new Float32Array(N); this.buf = new Uint8Array(N * 2); this.ph = new Float32Array(N);
    var self = this; P.forEach(function (p) { self.ph[p.id] = (p.id * 2.399) % 6.283; self.on[p.id] = self.onT[p.id] || 0; });
    this.light = (m.light ? m.light(0) : [.5, .45]).slice();
    this.wander = m.light || function (s) { var a = s / 26 * Math.PI * 2 + (m.phase || 0); return [.5 + .22 * Math.sin(a), .5 + .18 * Math.sin(a * 2 + 1.1)]; };
    var still = new Image(); still.alt = ""; still.className = "still"; still.src = m.texSrc; host.appendChild(still);
    var cv = document.createElement("canvas"); cv.setAttribute("aria-hidden", "true"); cv.style.opacity = "0"; host.appendChild(cv); this.cv = cv; this.ctx = cv.getContext("2d");
    cv.addEventListener("pointermove", function (e) { if (m.light) return; var r = cv.getBoundingClientRect(); self.target = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; });
    cv.addEventListener("pointerleave", function () { self.target = null; });
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) self.show(); else self.hide(); }, { rootMargin: "100px" }).observe(host);
  }
  Tile.prototype.load = function () { var m = this.m; if (this.imgs) return Promise.resolve(this.imgs); var self = this;
    return Promise.all([m.texSrc, m.idsSrc, m.tex2Src].map(function (s) { return s ? new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = s; }) : null; }))
      .then(function (r) { self.imgs = r; return r; }); };
  Tile.prototype.show = function () { if (this.live) return; this.live = true; var self = this;
    this.load().then(function (r) { if (!self.live || self.tx) return; var g; try { g = shared(); } catch (e) { return; } var gl = g.gl;
      self.tx = [texFrom(gl, r[0], false), texFrom(gl, r[1], true), gl.createTexture(), r[2] ? texFrom(gl, r[2], false) : null];
      gl.bindTexture(gl.TEXTURE_2D, self.tx[2]); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, self.N, 1, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, self.buf);
      ["TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER"].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, gl[k], gl.NEAREST); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      active.push(self);
      if (reduce) { if (self.m.restT != null) self.t = self.m.restT; for (var i = 0; i < 40; i++) self.step(.1, true); self.draw(); } else { self.step(0); self.step(1); self.draw(); loop(); }
      self.cv.style.opacity = "1"; }); };
  Tile.prototype.hide = function () { this.live = false; if (!this.tx) return; var gl = G.gl; this.tx.forEach(function (t) { if (t) gl.deleteTexture(t); }); this.tx = null;
    var i = active.indexOf(this); if (i >= 0) active.splice(i, 1); this.cv.style.opacity = "0"; };
  Tile.prototype.step = function (dt, still) { var m = this.m, P = m.pieces, t = (this.t += dt), L = this.light, tg = this.target || this.wander(t), k = 1 - Math.exp(-dt / 1.2);
    if (m.onTick) m.onTick(t, this.onT);
    L[0] += (tg[0] - L[0]) * k; L[1] += (tg[1] - L[1]) * k;
    var kv = dt ? 1 - Math.exp(-dt / (m.tau || .9)) : 1, ko = dt ? 1 - Math.exp(-dt / .45) : 1, sp = m.spread || .22, base = m.base == null ? .22 : m.base, pool = m.pool == null ? .78 : m.pool;
    for (var i = 0; i < P.length; i++) { var p = P[i], dx = p.x - L[0], dy = p.y - L[1];
      var goal = base + pool * Math.exp(-(dx * dx + dy * dy) / (2 * sp * sp)) + .04 * Math.sin(t * .4 + this.ph[p.id]) + (p.g || 0);
      if (p.f) goal += p.f * (.5 * Math.sin(t * 1.3 + this.ph[p.id]) + .3 * Math.sin(t * 2.3 + this.ph[p.id] * 1.7) + .2 * Math.sin(t * 3.7));
      if (m.levelFn) goal += m.levelFn(p, t);
      this.lv[p.id] += (goal - this.lv[p.id]) * kv; this.on[p.id] += ((this.onT[p.id] || 0) - this.on[p.id]) * ko;
      this.buf[p.id * 2] = Math.round(Math.max(0, Math.min(1, this.lv[p.id])) * 255); this.buf[p.id * 2 + 1] = Math.round(Math.max(0, Math.min(1, this.on[p.id])) * 255); } };
  Tile.prototype.draw = function () { if (!this.tx) return; var g = G, gl = g.gl, U = g.U;
    var r = this.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tx[0]); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tx[1]);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tx[2]); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.N, 1, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, this.buf);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tx[3] || this.tx[0]);
    gl.uniform1f(U.uN, this.N); gl.uniform1f(U.uHas2, this.tx[3] ? 1 : 0); gl.uniform2f(U.uLight, this.light[0], this.light[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); this.ctx.drawImage(g.canvas, 0, 0, w, h); };
  Tile.prototype.redraw = function () { if (reduce && this.tx) { for (var i = 0; i < 30; i++) this.step(.1, true); this.draw(); } };
  function loop() { if (running || reduce) return; running = true; var last = performance.now();
    (function tick(now) { var dt = Math.min(.05, (now - last) / 1000); last = now;
      for (var i = 0; i < active.length; i++) { active[i].step(dt); active[i].draw(); }
      if (active.length) requestAnimationFrame(tick); else running = false; })(last); }
  window.TileGlass = { mount: function (host, m) { return new Tile(host, m); } };
})();
