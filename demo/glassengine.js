// Glass engine: lights any stained glass picture piece by piece, with depth.
// Input maps (images or canvases): colour, piece ids (R + G*256), depth/normal (R,G tilt, B height) and a motion map
// (R = how much a pixel sways with the canopy, G = how much it turns with the head). Pieces carry their centre and,
// optionally, a steady glow (g) and a flame flicker (f).
(function () {
  var VS = "attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif",
    "uniform sampler2D uTex,uIds,uLvl,uNrm,uMot;uniform float uN,uT,uBreath,uPhoneAmt,uSway,uAmb,uVig;uniform vec2 uLight,uPhone,uCanopy,uHeadP;varying vec2 v;",
    "float hash(vec2 p){p=fract(p*vec2(.1031,.1030));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}",
    "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    " return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}",
    "vec2 rot(vec2 q,vec2 c,float a){float s=sin(a),k=cos(a);q-=c;return c+vec2(k*q.x-s*q.y,s*q.x+k*q.y);}",
    "void main(){",
    " vec2 uv=v;vec2 mo=texture2D(uMot,v).rg;float wb=mo.r*uSway,wh=mo.g;",
    " float sw=.65*sin(uT*.50)+.35*sin(uT*.27+1.3);",
    " float fl=.0035*sin(uT*1.15+v.x*11.+v.y*7.)*wb;",
    " uv=rot(uv,uCanopy,-wb*(.050*sw));",
    " uv-=vec2(wb*wb*.008*sin(uT*.43+.4)+fl,wb*wb*.010*sin(uT*.61+.9)+fl*1.4);",
    " uv=rot(uv,uHeadP,-wh*(.045*sin(uT*.37)+.015*sin(uT*.83+2.)));",
    " vec3 c=texture2D(uTex,uv).rgb;",
    " vec3 q=texture2D(uIds,uv).rgb;",
    " float id=floor(q.r*255.+.5)+floor(q.g*255.+.5)*256.;",
    " vec3 nm=texture2D(uNrm,uv).rgb;",
    " vec3 N=normalize(vec3((nm.xy*2.-1.)*3.2,1.));",
    " float hgt=nm.z;",
    " vec2 dl=uLight-uv;float d=length(dl);",
    " vec3 L=normalize(vec3(dl,.32));",
    " float dif=max(dot(N,L),0.);",
    " float spec=pow(max(dot(reflect(-L,N),vec3(0.,0.,1.)),0.),28.);",
    " float soft=exp(-d*d/.05);",
    " float field=uAmb+.80*exp(-d*d/.052);",
    " float lvl=id>.5?mix(field,texture2D(uLvl,vec2((id+.5)/uN,.5)).r,.6):field;",
    " float lum=dot(c,vec3(.2126,.7152,.0722));",
    " float glass=smoothstep(.035,.15,lum);",
    " float r=hash(vec2(id,id*.37));",
    " float tex=.86+.20*noise(uv*48.+r*40.)+.06*noise(uv*96.+r*9.);",
    " float vein=(noise(vec2((uv.x*1.3+uv.y)*9.,(uv.x-uv.y)*2.)+r*13.)-.5)*.22;",
    " float rip=sin(d*30.-uT*1.1)*exp(-d*3.2)*.14+(noise(uv*8.+vec2(uT*.05,-uT*.04))-.5)*.20;",
    " float shade=.30+1.0*dif;",
    " vec3 lit=c*(.22+1.45*lvl)*shade*(tex+vein+rip*(.4+lvl));",
    " lit*=mix(vec3(.72,.84,1.30),vec3(1.22,1.02,.78),clamp(lvl*1.25,0.,1.));",
    " lit+=vec3(1.,.95,.82)*spec*(.25+1.1*lvl)*smoothstep(.1,.9,1.-hgt+.3);",
    " lit+=vec3(1.,.82,.5)*soft*.10;",
    " vec3 lead=c*(.75+.25*lvl);",
    " vec3 col=mix(lead,lit,glass);",
    " float pd=distance(uv,uPhone);",
    " col+=vec3(1.,.93,.72)*exp(-pd*pd/.0018)*(.16+.20*uBreath)*uPhoneAmt;",
    " col*=1.-uVig*smoothstep(.42,.78,distance(v,vec2(.5)));",
    " gl_FragColor=vec4(col,1.);",
    "}"].join("\n");

  function load(src) { if (typeof src !== "string") return Promise.resolve(src);
    return new Promise(function (ok, no) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = no; i.src = src; }); }
  function setTex(gl, unit, t, img, nearest) {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    var f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function sh(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }

  // The hero art's motion map, from where its canopy and head sit in the picture.
  function heroMotion() {
    var n = 256, c = document.createElement("canvas"); c.width = c.height = n;
    var x2 = c.getContext("2d"), im = x2.createImageData(n, n);
    function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var u = x / n, w = y / n;
      var wb = Math.max(ss(.42, .84, u) * (1 - ss(.43, .53, w)), ss(.28, .62, u) * (1 - ss(.10, .24, w)) * .55);
      var wh = 1 - ss(.055, .105, Math.hypot(u - .372, w - .372));
      var i = (y * n + x) * 4; im.data[i] = wb * 255; im.data[i + 1] = wh * 255; im.data[i + 2] = 0; im.data[i + 3] = 255;
    }
    x2.putImageData(im, 0, 0); return c;
  }

  function Engine(canvas) {
    var gl = canvas.getContext("webgl", { antialias: true, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) throw new Error("no webgl");
    this.gl = gl; this.canvas = canvas;
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = this.U = {}; ["uTex", "uIds", "uLvl", "uNrm", "uMot", "uN", "uT", "uBreath", "uPhoneAmt", "uSway", "uAmb", "uVig", "uLight", "uPhone", "uCanopy", "uHeadP"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    this.T = [0, 1, 2, 3, 4].map(function () { return gl.createTexture(); });
    gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uIds, 1); gl.uniform1i(U.uLvl, 2); gl.uniform1i(U.uNrm, 3); gl.uniform1i(U.uMot, 4);
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.light = [.45, .5]; this.target = null; this.t = 0; this.running = false; this.visible = true; this.pieces = [];
    var self = this;
    function at(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; }
    canvas.addEventListener("pointermove", function (e) { self.target = at(e); });
    canvas.addEventListener("pointerleave", function () { self.target = null; });
    new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; if (self.visible) self.start(); }).observe(canvas);
    new ResizeObserver(function () { self.size(); self.frame(0); }).observe(canvas);
    this.size();
  }
  Engine.prototype.size = function () { var r = this.canvas.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * d)); this.canvas.height = Math.max(1, Math.round(r.height * d)); this.gl.viewport(0, 0, this.canvas.width, this.canvas.height); };
  Engine.prototype.set = function (cfg) {
    var self = this, gl = this.gl;
    return Promise.all([load(cfg.tex), load(cfg.ids), load(cfg.nrm), load(cfg.mot || heroMotion())]).then(function (m) {
      setTex(gl, 0, self.T[0], m[0], false); setTex(gl, 1, self.T[1], m[1], true); setTex(gl, 3, self.T[3], m[2], false); setTex(gl, 4, self.T[4], m[3], false);
      var N = 1; cfg.pieces.forEach(function (p) { N = Math.max(N, p.id + 1); });
      self.N = N; self.pieces = cfg.pieces; self.lv = new Float32Array(N); self.lvB = new Uint8Array(N); self.ph = new Float32Array(N);
      cfg.pieces.forEach(function (p) { self.ph[p.id] = (p.id * 2.399) % 6.283; });
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, self.T[2]); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, N, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, self.lvB);
      ["TEXTURE_MIN_FILTER", "TEXTURE_MAG_FILTER"].forEach(function (k) { gl.texParameteri(gl.TEXTURE_2D, gl[k], gl.NEAREST); });
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var ph = cfg.phone; gl.uniform2f(self.U.uPhone, ph ? ph[0] : -1, ph ? ph[1] : -1); gl.uniform1f(self.U.uPhoneAmt, ph ? 1 : 0);
      var cp = cfg.canopy || [.30, .13], hp = cfg.head || [.395, .455];
      gl.uniform2f(self.U.uCanopy, cp[0], cp[1]); gl.uniform2f(self.U.uHeadP, hp[0], hp[1]);
      gl.uniform1f(self.U.uSway, cfg.sway == null ? 1 : cfg.sway);
      self.amb = cfg.ambient == null ? .10 : cfg.ambient; gl.uniform1f(self.U.uAmb, self.amb + .02); gl.uniform1f(self.U.uVig, cfg.vignette == null ? .38 : cfg.vignette);
      self.wander = cfg.wander || function (s) { var a = s / 24 * Math.PI * 2; return [.50 + .27 * Math.sin(a), .44 + .22 * Math.sin(a * 2 + 1.1)]; };
      self.frame(0); self.frame(1); self.start();
      return true;
    });
  };
  Engine.prototype.frame = function (dt) {
    if (!this.pieces.length) return;
    var gl = this.gl, t = (this.t += dt), L = this.light;
    var tg = this.target || this.wander(t), k = 1 - Math.exp(-dt / 1.1);
    L[0] += (tg[0] - L[0]) * k; L[1] += (tg[1] - L[1]) * k;
    var kv = dt ? 1 - Math.exp(-dt / .8) : 1, P = this.pieces, lv = this.lv, lvB = this.lvB, ph = this.ph;
    for (var i = 0; i < P.length; i++) {
      var p = P[i], dx = p.x - L[0], dy = p.y - L[1], dd = dx * dx + dy * dy;
      var goal = this.amb + (.95 - this.amb) * Math.exp(-dd / (2 * .16 * .16)) + .08 * Math.sin(t * .5 + ph[p.id]);
      if (p.g) goal += p.g;
      if (p.f) goal += p.f * (.55 * Math.sin(t * 2.3 + ph[p.id]) + .3 * Math.sin(t * 5.1 + ph[p.id] * 1.7) + .15 * Math.sin(t * 9.7));
      lv[p.id] += (goal - lv[p.id]) * kv;
      lvB[p.id] = Math.round(Math.max(0, Math.min(1, lv[p.id])) * 255);
    }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.T[2]);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.N, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, lvB);
    gl.uniform2f(this.U.uLight, L[0], L[1]);
    gl.uniform1f(this.U.uT, this.reduce ? 0 : t);
    gl.uniform1f(this.U.uBreath, .5 + .5 * Math.sin(t / 8 * Math.PI * 2));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  Engine.prototype.start = function () {
    if (this.running || this.reduce || !this.pieces.length) return;
    var self = this, last = performance.now(); this.running = true;
    function tick(now) { var dt = Math.min(.05, (now - last) / 1000); last = now; self.frame(dt);
      if (self.visible) requestAnimationFrame(tick); else self.running = false; }
    requestAnimationFrame(tick);
  };

  window.GlassEngine = { create: function (canvas) { return new Engine(canvas); } };
  // the hero keeps its old entry point
  window.GlassHero = { mount: function (canvas, cfg) { try { return GlassEngine.create(canvas).set(cfg); } catch (e) { return false; } } };
})();
