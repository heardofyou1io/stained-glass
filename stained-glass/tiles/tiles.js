// Geometric stained glass tiles, drawn by construction (no organic shapes). Each returns {svg, center, ramp, unit, spread}.
(function () {
  function f(v) { return (+v).toFixed(1); }
  function poly(P) { return "M" + P.map(function (p) { return f(p[0]) + " " + f(p[1]); }).join(" L") + " Z"; }
  function line(P) { return "M" + P.map(function (p) { return f(p[0]) + " " + f(p[1]); }).join(" L"); }
  function circ(cx, cy, r) { return "M" + f(cx - r) + " " + f(cy) + " A" + f(r) + " " + f(r) + " 0 1 0 " + f(cx + r) + " " + f(cy) + " A" + f(r) + " " + f(r) + " 0 1 0 " + f(cx - r) + " " + f(cy) + " Z"; }
  function pol(cx, cy, r, a) { return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
  function sector(cx, cy, r0, r1, a0, a1) { var P = [], n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / .05));
    for (var i = 0; i <= n; i++) P.push(pol(cx, cy, r1, a0 + (a1 - a0) * i / n));
    if (r0 > 0) for (var j = n; j >= 0; j--) P.push(pol(cx, cy, r0, a0 + (a1 - a0) * j / n)); else P.push([cx, cy]);
    return poly(P); }
  function rrect(x0, y0, x1, y1, r) { return "M" + (x0 + r) + " " + y0 + " H" + (x1 - r) + " A" + r + " " + r + " 0 0 1 " + x1 + " " + (y0 + r) + " V" + (y1 - r) + " A" + r + " " + r + " 0 0 1 " + (x1 - r) + " " + y1 + " H" + (x0 + r) + " A" + r + " " + r + " 0 0 1 " + x0 + " " + (y1 - r) + " V" + (y0 + r) + " A" + r + " " + r + " 0 0 1 " + (x0 + r) + " " + y0 + " Z"; }
  var ARCH = "M140 930 L140 470 A360 360 0 0 1 860 470 L860 930 Z";
  function sh(mat, d, extra) { return '<path data-mat="' + mat + '" ' + (extra || "") + ' d="' + d + '"/>'; }
  function ld(d, w) { return '<path data-lead="' + (w || 3.6) + '" d="' + d + '"/>'; }
  function under(d) { return '<path data-under="3.2" d="' + d + '"/>'; }
  function radial(cx, cy, n, rings, off) { var s = []; for (var i = 0; i < n; i++) { var a = (i + (off || 0)) / n * Math.PI * 2; s.push(under(line([pol(cx, cy, rings[0], a), pol(cx, cy, 1400, a)]))); }
    rings.forEach(function (r) { s.push(under(circ(cx, cy, r))); }); return s.join(""); }
  function wrap(s) { return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">' + s + "</svg>"; }
  var WARM = [[255, 226, 150], [252, 204, 108], [244, 174, 64], [226, 132, 40], [40, 82, 158], [28, 60, 130], [18, 40, 98]];
  var NIGHT = [[64, 100, 182], [40, 76, 154], [30, 62, 138], [22, 48, 116], [16, 36, 94], [12, 28, 76]];

  var T = {};
  T.sun = function () { var c = [500, 520], s = [sh("sky", ARCH, "data-bg=\"1\""), radial(c[0], c[1], 20, [140, 250, 370, 500, 640], .5)];
    for (var i = 0; i < 16; i++) { var a = i / 16 * Math.PI * 2 - Math.PI / 2, w = Math.PI / 16 * .82, L = i % 2 ? 268 : 335, tip = pol(c[0], c[1], L, a);
      s.push(sh(i % 2 ? "ray2" : "ray1", poly([pol(c[0], c[1], 186, a - w), tip, pol(c[0], c[1], 186, a)])));
      s.push(sh(i % 2 ? "ray1" : "ray2", poly([pol(c[0], c[1], 186, a), tip, pol(c[0], c[1], 186, a + w)]))); }
    for (var k = 0; k < 16; k++) { var b = k / 16 * Math.PI * 2; s.push(sh(k % 2 ? "gold" : "amber", sector(c[0], c[1], 132, 178, b, b + Math.PI / 8))); }
    s.push(sh("core", circ(c[0], c[1], 132))); for (var m = 0; m < 6; m++) s.push(ld(line([c, pol(c[0], c[1], 132, m / 6 * Math.PI * 2 + .3)]), 3));
    s.push(ld(circ(c[0], c[1], 70), 3));
    return { svg: wrap(s.join("")), center: [.5, .52], ramp: WARM, unit: 120 }; };

  T.moon = function () { var c = [520, 470], s = [sh("night", ARCH, "data-bg=\"1\""), radial(470, 500, 16, [150, 290, 440, 600], .25)];
    // crescent: outer circle minus an offset circle, built from the two arcs between their crossings
    var R = 215, r2 = 190, o = [c[0] + 95, c[1] - 55], dx = o[0] - c[0], dy = o[1] - c[1], d = Math.hypot(dx, dy), a = (R * R - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
    var mx = c[0] + a * dx / d, my = c[1] + a * dy / d, p1 = [mx + h * dy / d, my - h * dx / d], p2 = [mx - h * dy / d, my + h * dx / d];
    s.push(sh("moon", "M" + f(p1[0]) + " " + f(p1[1]) + " A" + R + " " + R + " 0 1 0 " + f(p2[0]) + " " + f(p2[1]) + " A" + r2 + " " + r2 + " 0 1 1 " + f(p1[0]) + " " + f(p1[1]) + " Z"));
    for (var i = 1; i < 5; i++) { var aa = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - i / 5 * (Math.PI * 1.32); s.push(ld(line([pol(c[0], c[1], R + 6, aa), pol(c[0], c[1], R - 120, aa)]), 3.2)); }
    [[255, 300, 70], [745, 290, 52], [700, 770, 62], [290, 770, 44], [810, 560, 40]].forEach(function (st) {
      var P = []; for (var k = 0; k < 8; k++) P.push(pol(st[0], st[1], k % 2 ? st[2] * .28 : st[2], k / 8 * Math.PI * 2 - Math.PI / 2));
      s.push(sh("star", poly(P))); s.push(ld(line([[st[0], st[1] - st[2]], [st[0], st[1] + st[2]]]), 2.4)); });
    [[420, 180, 13], [610, 830, 11], [180, 520, 12], [880, 420, 10]].forEach(function (d) { s.push(sh("star", circ(d[0], d[1], d[2]))); });
    return { svg: wrap(s.join("")), center: [.47, .5], ramp: NIGHT, unit: 130, spread: .24 }; };

  T.phone = function () { var s = [sh("sky", ARCH, "data-bg=\"1\""), radial(500, 520, 18, [150, 300, 440, 600], .5)];
    s.push(sh("case", rrect(352, 236, 648, 820, 52))); s.push(ld(line([[352, 360], [648, 360]]), 0.01));
    s.push(sh("screen", rrect(376, 290, 624, 762, 22)));
    s.push(ld(line([[376, 526], [624, 526]]), 3)); s.push(ld(line([[500, 290], [500, 526]]), 3)); s.push(ld(line([[500, 526], [500, 762]]), 3));
    s.push(sh("amber", "M420 380 H580 A30 30 0 0 1 610 410 V470 A30 30 0 0 1 580 500 H470 L440 530 L446 500 H420 A30 30 0 0 1 390 470 V410 A30 30 0 0 1 420 380 Z"));
    [455, 500, 545].forEach(function (x) { s.push(sh("dot", circ(x, 440, 14))); });
    s.push(sh("case2", rrect(462, 258, 538, 272, 7))); s.push(sh("case2", rrect(450, 786, 550, 800, 7)));
    return { svg: wrap(s.join("")), center: [.5, .52], ramp: WARM, unit: 105 }; };

  T.lantern = function () { var s = [sh("night", ARCH, "data-bg=\"1\""), radial(500, 560, 14, [190, 380, 600], .5)];
    s.push(sh("brass", circ(500, 205, 36))); s.push(sh("hole", circ(500, 205, 20)));
    s.push(sh("brass", poly([[392, 336], [608, 336], [556, 262], [444, 262]]))); s.push(sh("brass2", "M440 262 A60 22 0 0 1 560 262 Z"));
    s.push(ld(line([[500, 262], [500, 336]]), 3)); s.push(ld(line([[470, 262], [430, 336]]), 3)); s.push(ld(line([[530, 262], [570, 336]]), 3));
    s.push(sh("frame", poly([[384, 336], [616, 336], [616, 712], [384, 712]])));
    [[400, 450], [466, 534], [550, 600]].forEach(function (p, i) { var x0 = p[0], x1 = p[1], r = (x1 - x0) / 2, top = 372;
      s.push(sh(i === 1 ? "pane" : "pane2", "M" + x0 + " 692 V" + (top + r) + " A" + r + " " + r + " 0 0 1 " + x1 + " " + (top + r) + " V692 Z"));
      s.push(ld(line([[x0, 560], [x1, 560]]), 2.6)); });
    s.push(sh("flame", "M500 470 C522 505 532 530 522 556 C514 574 486 574 478 556 C468 530 478 505 500 470 Z"));
    s.push(sh("brass", poly([[368, 712], [632, 712], [612, 752], [388, 752]])));
    return { svg: wrap(s.join("")), center: [.5, .53], ramp: [[250, 196, 96], [222, 140, 54], [34, 64, 138], [24, 48, 112], [14, 32, 84]], unit: 150, spread: .22, subArea: 7000 }; };

  T.keyhole = function () { var c = [500, 500], s = [];
    s.push(sh("night", circ(c[0], c[1], 400), "data-bg=\"1\""));
    for (var i = 0; i < 18; i++) { var a = i / 18 * Math.PI * 2; s.push(sh(i % 2 ? "teal" : "blue", sector(c[0], c[1], 330, 400, a, a + Math.PI * 2 / 18))); }
    for (var j = 0; j < 14; j++) { var b = j / 14 * Math.PI * 2 + .1; s.push(sh(j % 2 ? "amber" : "gold", sector(c[0], c[1], 296, 330, b, b + Math.PI * 2 / 14))); }
    s.push(sh("sky", circ(c[0], c[1], 296))); s.push(radial(c[0], c[1], 12, [150], 0).replace(/data-under/g, "data-lead"));
    s.push(sh("key", "M462 520 A78 78 0 1 1 538 520 L572 700 L428 700 Z")); s.push(ld(line([[500, 380], [500, 700]]), 3)); s.push(ld(line([[436, 560], [564, 560]]), 0.01));
    return { svg: wrap(s.join("")), center: [.5, .5], ramp: [[255, 236, 170], [250, 196, 96], [232, 140, 44], [204, 104, 32]], unit: 110 }; };

  T.bubble = function () { var s = [sh("night", ARCH, "data-bg=\"1\""), radial(500, 470, 18, [150, 300, 440, 600], .5)];
    s.push(sh("amber", "M350 290 H650 A130 130 0 0 1 780 420 V520 A130 130 0 0 1 650 650 H430 L320 790 L350 650 A130 130 0 0 1 220 520 V420 A130 130 0 0 1 350 290 Z"));
    [330, 410, 590, 670].forEach(function (x) { s.push(ld(line([[x, 280], [x, 660]]), 3.2)); });
    [410, 500, 590].forEach(function (x) { s.push(sh("dot", circ(x, 470, 34))); });
    return { svg: wrap(s.join("")), center: [.5, .47], ramp: NIGHT, unit: 130 }; };

  T.rose = function () { var c = [500, 500], s = [], cols = [["gold", "amber"], ["blue", "teal"], ["amber", "red"], ["teal", "blue"], ["gold", "blue"]];
    s.push(sh("night", circ(c[0], c[1], 420), "data-bg=\"1\""));
    var rings = [[0, 80, 1], [80, 170, 8], [170, 260, 12], [260, 345, 12], [345, 420, 24]];
    rings.forEach(function (rg, k) { for (var i = 0; i < rg[2]; i++) { var a = i / rg[2] * Math.PI * 2 + (k % 2 ? Math.PI / rg[2] : 0), pal = cols[k % cols.length];
      if (k === 0) { s.push(sh("core", circ(c[0], c[1], 70))); break; }
      if (k === 3) { // pointed petals: a lancet in each sector
        var a0 = a, a1 = a + Math.PI * 2 / rg[2], am = (a0 + a1) / 2; s.push(sh(i % 2 ? "teal" : "blue", sector(c[0], c[1], rg[0], rg[1], a0, a1)));
        s.push(sh(i % 2 ? "gold" : "amber", poly([pol(c[0], c[1], rg[0] + 8, a0 + .05), pol(c[0], c[1], rg[1] - 10, am), pol(c[0], c[1], rg[0] + 8, a1 - .05)]))); continue; }
      s.push(sh(pal[i % 2], sector(c[0], c[1], rg[0], rg[1], a, a + Math.PI * 2 / rg[2]))); } });
    return { svg: wrap(s.join("")), center: [.5, .5], spread: .26 }; };

  T.fan = function () { var s = [], c = [500, 880]; s.push(sh("night", "M150 930 V150 H850 V930 Z", "data-bg=\"1\""));
    for (var x = 150; x < 850; x += 70) s.push(under(line([[x, 150], [x, 930]])));
    var bands = [[0, 95, "gold"], [95, 195, "amber"], [195, 285, "teal"], [285, 345, "blue"]];
    bands.forEach(function (bd, k) { var n = k === 0 ? 1 : 6 + k * 3; for (var i = 0; i < n; i++) { var a0 = Math.PI + i / n * Math.PI, a1 = Math.PI + (i + 1) / n * Math.PI;
      s.push(sh(k === 0 ? "core" : (i % 2 ? bd[2] : (k === 1 ? "gold" : k === 2 ? "blue" : "teal")), sector(c[0], c[1], bd[0], bd[1], a0, a1))); } });
    for (var j = 0; j < 9; j++) { var y = 200 + j * 70; s.push(sh(j % 2 ? "gold" : "amber", poly([[176, y], [214, y - 26], [252, y], [214, y + 26]]))); s.push(sh(j % 2 ? "amber" : "gold", poly([[748, y], [786, y - 26], [824, y], [786, y + 26]]))); }
    return { svg: wrap(s.join("")), center: [.5, .88], ramp: [[48, 60, 110], [36, 52, 104], [26, 42, 92], [20, 34, 80]], unit: 200, spread: .3 }; };

  T.quarry = function () { var s = [], c = [500, 500]; s.push(sh("clear", ARCH, "data-bg=\"1\""));
    var st = 128; for (var k = -14; k <= 14; k++) { s.push(under(line([[500 + k * st - 1000, -500], [500 + k * st + 1000, 1500]]))); s.push(under(line([[500 + k * st + 1000, -500], [500 + k * st - 1000, 1500]]))); }
    for (var i = -4; i <= 4; i++) for (var j = -5; j <= 5; j++) { var x = 500 + i * st, y = 500 + j * st + ((i + j) % 2 ? 0 : 0); if (((i + j) % 2 + 2) % 2) continue;
      if (Math.abs(i) + Math.abs(j) === 3) s.push(sh((i + j + 10) % 4 ? "teal" : "blue", poly([[x, y - st / 2 + 4], [x + st / 2 - 4, y], [x, y + st / 2 - 4], [x - st / 2 + 4, y]]))); }
    s.push(sh("blue", circ(500, 500, 118))); s.push(sh("gold", circ(500, 500, 92)));
    for (var m = 0; m < 8; m++) { var a = m / 8 * Math.PI * 2; s.push(ld(line([pol(500, 500, 92, a), pol(500, 500, 118, a)]), 3)); }
    s.push(sh("key", "M480 510 A26 26 0 1 1 520 510 L532 560 L468 560 Z"));
    return { svg: wrap(s.join("")), center: [.5, .5], ramp: [[255, 244, 214], [246, 226, 184], [232, 206, 156], [216, 186, 132]], unit: 220, spread: .26 }; };


  T.lighthouse = function () { var s = [sh("night", ARCH, "data-bg=\"1\""), radial(500, 360, 14, [170, 340, 520], .5)];
    s.push(sh("beam", poly([[492, 352], [140, 250], [140, 450]]))); s.push(sh("beam", poly([[508, 352], [860, 250], [860, 450]])));
    s.push(ld(line([[492, 352], [140, 350]]), 2.4)); s.push(ld(line([[508, 352], [860, 350]]), 2.4));
    var bands = [430, 500, 570, 640, 710, 780, 860];
    for (var i = 0; i < bands.length - 1; i++) { var y0 = bands[i], y1 = bands[i + 1], w0 = 32 + (y0 - 430) * .14, w1 = 32 + (y1 - 430) * .14;
      s.push(sh(i % 2 ? "cream" : "red", poly([[500 - w0, y0], [500 + w0, y0], [500 + w1, y1], [500 - w1, y1]]))); }
    s.push(sh("brass", poly([[446, 400], [554, 400], [554, 430], [446, 430]])));
    s.push(sh("core", poly([[466, 318], [534, 318], [534, 400], [466, 400]]))); s.push(ld(line([[500, 318], [500, 400]]), 2.6));
    s.push(sh("red", poly([[456, 318], [544, 318], [500, 268]]))); s.push(sh("brass", circ(500, 258, 12)));
    s.push(sh("sea", "M140 930 L140 840 C220 820 300 860 380 840 C460 820 540 860 620 840 C700 820 780 860 860 840 L860 930 Z"));
    s.push(ld("M140 885 C220 865 300 905 380 885 C460 865 540 905 620 885 C700 865 780 905 860 885", 3));
    return { svg: wrap(s.join("")), center: [.5, .36], ramp: NIGHT, unit: 150, spread: .24 }; };

  T.waves = function () { var c = [500, 780], s = [sh("night", ARCH, "data-bg=\"1\""), radial(c[0], c[1], 12, [200, 420, 640], 0)];
    var a0 = -Math.PI * .86, a1 = -Math.PI * .14, bands = [[60, 110], [170, 225], [285, 345], [405, 470], [525, 595]];
    bands.forEach(function (b, k) { var n = 3 + k; for (var i = 0; i < n; i++) { var x0 = a0 + (a1 - a0) * i / n, x1 = a0 + (a1 - a0) * (i + 1) / n;
      s.push(sh(k % 2 ? "amber" : "gold", sector(c[0], c[1], b[0], b[1], x0, x1))); } });
    s.push(sh("core", circ(c[0], c[1], 44)));
    return { svg: wrap(s.join("")), center: [.5, .78], ramp: NIGHT, unit: 160, spread: .28 }; };

  T.magnifier = function () { var c = [440, 440], s = [sh("night", ARCH, "data-bg=\"1\""), radial(c[0], c[1], 14, [240, 420, 600], .5)];
    var a = Math.PI / 4, hx = Math.cos(a), hy = Math.sin(a), p0 = [c[0] + hx * 235, c[1] + hy * 235], p1 = [c[0] + hx * 470, c[1] + hy * 470], nx = -hy * 34, ny = hx * 34;
    s.push(sh("wood", poly([[p0[0] + nx, p0[1] + ny], [p1[0] + nx, p1[1] + ny], [p1[0] - nx, p1[1] - ny], [p0[0] - nx, p0[1] - ny]])));
    s.push(ld(line([[c[0] + hx * 330 + nx, c[1] + hy * 330 + ny], [c[0] + hx * 330 - nx, c[1] + hy * 330 - ny]]), 3));
    for (var i = 0; i < 12; i++) { var b = i / 12 * Math.PI * 2; s.push(sh(i % 2 ? "brass" : "brass2", sector(c[0], c[1], 192, 232, b, b + Math.PI / 6))); }
    s.push(sh("lens", circ(c[0], c[1], 192)));
    s.push(ld("M" + (c[0] - 150) + " " + (c[1] - 30) + " A160 160 0 0 1 " + (c[0] - 40) + " " + (c[1] - 150), 2.6));
    var P = []; for (var k = 0; k < 8; k++) P.push(pol(c[0] + 20, c[1] + 20, k % 2 ? 26 : 92, k / 8 * Math.PI * 2 - Math.PI / 2));
    s.push(sh("key", poly(P))); s.push(ld(line([[c[0] + 20, c[1] - 72], [c[0] + 20, c[1] + 112]]), 2.4));
    return { svg: wrap(s.join("")), center: [.44, .44], ramp: NIGHT, unit: 150, spread: .24, subMats: ["night", "lens"] }; };

  T.envelope = function () { var s = [sh("night", ARCH, "data-bg=\"1\""), radial(500, 520, 14, [220, 420, 620], .5)];
    var L = 230, R = 770, T0 = 360, B = 710, M = [500, 560];
    s.push(sh("cream", poly([[L, T0], [L, B], [M[0] - 40, M[1]]]))); s.push(sh("cream", poly([[R, T0], [R, B], [M[0] + 40, M[1]]])));
    s.push(sh("cream2", poly([[L, B], [R, B], [M[0] + 30, M[1] - 10], [M[0] - 30, M[1] - 10]])));
    s.push(sh("gold", poly([[L, T0], [R, T0], [M[0], M[1] + 10]])));
    s.push(sh("seal", circ(M[0], M[1] + 6, 66))); s.push(ld(circ(M[0], M[1] + 6, 44), 2.6));
    s.push(sh("key", "M488 562 A16 16 0 1 1 512 562 L518 592 L482 592 Z"));
    return { svg: wrap(s.join("")), center: [.5, .52], ramp: NIGHT, unit: 150, spread: .24 }; };

  T.bell = function () { var s = [sh("night", ARCH, "data-bg=\"1\""), radial(500, 480, 14, [240, 420, 620], .5)];
    [[1, 0], [-1, 0]].forEach(function (d) { for (var k = 0; k < 3; k++) { var r0 = 300 + k * 52, a = d[0] > 0 ? -.55 : Math.PI - .55; s.push(sh(k % 2 ? "amber" : "gold", sector(500, 480, r0, r0 + 22, a, a + 1.1))); } });
    s.push(sh("brass", circ(500, 238, 30))); s.push(sh("hole", circ(500, 238, 15)));
    s.push(sh("gold", "M500 262 C590 262 632 330 642 450 C652 560 690 616 742 650 L258 650 C310 616 348 560 358 450 C368 330 410 262 500 262 Z"));
    [[430, 280, 400, 650], [570, 280, 600, 650]].forEach(function (q) { s.push(ld(line([[q[0], q[1]], [q[2], q[3]]]), 2.8)); });
    s.push(ld("M360 470 C450 455 550 455 640 470", 2.8));
    s.push(sh("brass", poly([[238, 650], [762, 650], [770, 694], [230, 694]])));
    s.push(sh("brass2", circ(500, 730, 34)));
    return { svg: wrap(s.join("")), center: [.5, .48], ramp: NIGHT, unit: 150, spread: .26 }; };

  T.compass = function () { var c = [500, 500], s = [sh("night", circ(c[0], c[1], 410), "data-bg=\"1\"")];
    for (var i = 0; i < 32; i++) { var a = i / 32 * Math.PI * 2; s.push(sh(i % 2 ? "teal" : "blue", sector(c[0], c[1], 360, 410, a, a + Math.PI / 16))); }
    s.push(ld(circ(c[0], c[1], 300), 2.6));
    function point(a, L, w, cA, cB) { var tip = pol(c[0], c[1], L, a); s.push(sh(cA, poly([c, pol(c[0], c[1], w, a - Math.PI / 2), tip]))); s.push(sh(cB, poly([c, tip, pol(c[0], c[1], w, a + Math.PI / 2)]))); }
    for (var k = 0; k < 8; k++) { var a2 = k / 8 * Math.PI * 2 + Math.PI / 8; point(a2, 150, 26, "amber", "gold"); }
    for (var j = 0; j < 4; j++) { var a3 = j / 4 * Math.PI * 2 + Math.PI / 4; point(a3, 230, 40, "teal", "blue"); }
    for (var m = 0; m < 4; m++) { var a4 = m / 4 * Math.PI * 2 - Math.PI / 2; point(a4, 340, 52, m === 0 ? "red" : "gold", m === 0 ? "red2" : "amber"); }
    s.push(sh("core", circ(c[0], c[1], 30)));
    return { svg: wrap(s.join("")), center: [.5, .5], ramp: NIGHT, unit: 140, spread: .26 }; };

  T.planet = function () { var c = [500, 500], s = [sh("night", ARCH, "data-bg=\"1\""), radial(c[0], c[1], 14, [240, 420, 620], .5)];
    var rot = -.38, cr = Math.cos(rot), sr = Math.sin(rot);
    function ring(t0, t1) { var P = [], n = 40; for (var i = 0; i <= n; i++) { var t = t0 + (t1 - t0) * i / n; P.push([c[0] + (Math.cos(t) * 345) * cr - (Math.sin(t) * 92) * sr, c[1] + (Math.cos(t) * 345) * sr + (Math.sin(t) * 92) * cr]); }
      for (var j = n; j >= 0; j--) { var u = t0 + (t1 - t0) * j / n; P.push([c[0] + (Math.cos(u) * 255) * cr - (Math.sin(u) * 62) * sr, c[1] + (Math.cos(u) * 255) * sr + (Math.sin(u) * 62) * cr]); } return poly(P); }
    s.push(sh("teal", ring(Math.PI, Math.PI * 1.5))); s.push(sh("teal2", ring(Math.PI * 1.5, Math.PI * 2)));
    s.push(sh("amber", circ(c[0], c[1], 175)));
    [-110, -50, 10, 70, 125].forEach(function (dy, k) { s.push(ld("M" + (c[0] - 175) + " " + (c[1] + dy) + " C" + (c[0] - 60) + " " + (c[1] + dy + 20) + " " + (c[0] + 60) + " " + (c[1] + dy - 20) + " " + (c[0] + 175) + " " + (c[1] + dy), 2.6)); });
    s.push(sh("teal", ring(0, Math.PI * .5))); s.push(sh("teal2", ring(Math.PI * .5, Math.PI)));
    [[230, 230, 9], [780, 260, 11], [760, 760, 9], [250, 760, 10]].forEach(function (d) { s.push(sh("star", circ(d[0], d[1], d[2]))); });
    return { svg: wrap(s.join("")), center: [.5, .5], ramp: NIGHT, unit: 150, spread: .26 }; };

  T.door = function () { var s = [sh("night", ARCH, "data-bg=\"1\"")];
    for (var y = 470; y < 930; y += 66) for (var x = 140 + ((y / 66) % 2 ? 0 : 50); x < 860; x += 100) s.push(under(poly([[x, y], [x + 100, y], [x + 100, y + 66], [x, y + 66]])));
    s.push(under("M140 470 A360 360 0 0 1 860 470"));
    s.push(sh("beam", poly([[400, 840], [600, 840], [800, 930], [200, 930]])));
    s.push(sh("core", "M400 840 L400 480 A100 100 0 0 1 600 480 L600 840 Z"));
    [[440, 600], [500, 600], [560, 600]].forEach(function (p) { s.push(ld(line([[p[0], 390], [p[0], 840]]), 2.2)); });
    s.push(ld(line([[400, 640], [600, 640]]), 2.2));
    s.push(sh("wood", poly([[400, 470], [318, 430], [318, 900], [400, 840]]))); s.push(ld(line([[318, 660], [400, 650]]), 2.6));
    s.push(sh("brass", "M300 840 L300 470 A200 200 0 0 1 700 470 L700 840 L676 840 L676 474 A176 176 0 0 0 324 474 L324 840 Z"));
    return { svg: wrap(s.join("")), center: [.5, .62], ramp: [[70, 96, 160], [40, 70, 140], [26, 52, 116], [18, 40, 96]], unit: 180, spread: .24, sub: false }; };

  T.gem = function () { var s = [sh("night", ARCH, "data-bg=\"1\""), radial(500, 500, 14, [240, 420, 620], .5)];
    var top = 330, gird = 450, bot = 790, L = 250, R = 750, tl = 390, tr = 610;
    var cols = ["teal", "teal2", "blue", "lens"];
    s.push(sh("lens", poly([[tl, top], [tr, top], [560, 400], [440, 400]])));
    s.push(sh("teal", poly([[L, gird], [tl, top], [440, 400]]))); s.push(sh("teal2", poly([[L, gird], [440, 400], [380, gird]])));
    s.push(sh("blue", poly([[440, 400], [560, 400], [500, gird]]))); s.push(sh("teal", poly([[440, 400], [500, gird], [380, gird]]))); s.push(sh("teal2", poly([[560, 400], [620, gird], [500, gird]])));
    s.push(sh("teal", poly([[R, gird], [tr, top], [560, 400]]))); s.push(sh("blue", poly([[R, gird], [560, 400], [620, gird]])));
    var g = [L, 380, 500, 620, R]; for (var i = 0; i < 4; i++) s.push(sh(cols[(i + 1) % 4], poly([[g[i], gird], [g[i + 1], gird], [500, bot]])));
    return { svg: wrap(s.join("")), center: [.5, .55], ramp: NIGHT, unit: 150, spread: .26 }; };

  T.hourglass = function () { var s = [sh("night", ARCH, "data-bg=\"1\""), radial(500, 540, 14, [240, 420, 620], .5)];
    s.push(sh("brass", poly([[330, 250], [670, 250], [670, 292], [330, 292]]))); s.push(sh("brass", poly([[330, 788], [670, 788], [670, 830], [330, 830]])));
    s.push(sh("wood", poly([[344, 292], [368, 292], [368, 788], [344, 788]]))); s.push(sh("wood", poly([[632, 292], [656, 292], [656, 788], [632, 788]])));
    s.push(sh("lens", "M392 292 L608 292 C608 400 540 500 510 540 L490 540 C460 500 392 400 392 292 Z"));
    s.push(sh("lens", "M490 540 L510 540 C540 580 608 680 608 788 L392 788 C392 680 460 580 490 540 Z"));
    s.push(sh("sand", "M440 420 L560 420 C540 470 520 510 506 532 L494 532 C480 510 460 470 440 420 Z"));
    s.push(sh("sand", "M500 660 L590 788 L410 788 Z")); s.push(sh("sand", poly([[496, 540], [504, 540], [504, 662], [496, 662]])));
    return { svg: wrap(s.join("")), center: [.5, .54], ramp: NIGHT, unit: 150, spread: .24 }; };

  T.deco = function () { var c = [500, 900], s = [sh("night", "M150 930 V110 H850 V930 Z", "data-bg=\"1\"")];
    var n = 13, a0 = Math.PI, a1 = Math.PI * 2;
    for (var i = 0; i < n; i++) { var x0 = a0 + (a1 - a0) * i / n, x1 = a0 + (a1 - a0) * (i + 1) / n, xm = (x0 + x1) / 2, w = (x1 - x0) * .32;
      var L = i % 2 ? 560 : 760; s.push(sh(i % 2 ? "amber" : "gold", poly([pol(c[0], c[1], 150, xm - w), pol(c[0], c[1], L, xm), pol(c[0], c[1], 150, xm + w)])));
      s.push(ld(line([pol(c[0], c[1], 150, xm), pol(c[0], c[1], L - 8, xm)]), 2.4)); }
    for (var k = 0; k < 3; k++) s.push(sh(k % 2 ? "amber" : "gold", sector(c[0], c[1], 90 + k * 20, 108 + k * 20, a0, a1)));
    s.push(sh("core", sector(c[0], c[1], 0, 90, a0, a1)));
    for (var j = 0; j < 7; j++) { var y = 160 + j * 66; s.push(sh("teal", poly([[150, y], [182, y + 33], [150, y + 66]]))); s.push(sh("teal", poly([[850, y], [818, y + 33], [850, y + 66]]))); }
    return { svg: wrap(s.join("")), center: [.5, .9], ramp: [[40, 70, 140], [30, 58, 126], [22, 46, 108], [16, 36, 92]], unit: 220, spread: .3, sub: false }; };

  // DATA GLASS: the same lattice is rendered twice, once all named (gold) and once all not named (blue);
  // the page mixes them pane by pane from real numbers.
  function lattice(on) { var s = [sh("night", ARCH, "data-bg=\"1\"")], x0 = 196, x1 = 804, y0 = 330, rows = 5, cols = 15, rh = 104, gap = 10, cw = (x1 - x0) / cols;
    for (var r = 0; r < rows; r++) for (var c2 = 0; c2 < cols; c2++) { var X0 = x0 + c2 * cw + 3, X1 = x0 + (c2 + 1) * cw - 3, Y0 = y0 + r * rh + gap / 2, Y1 = y0 + (r + 1) * rh - gap / 2;
      s.push(sh(on ? (c2 % 3 === 1 ? "gold" : "amber") : (c2 % 3 === 1 ? "blue" : "night2"), rrect(f(X0), f(Y0), f(X1), f(Y1), 6))); }
    s.push(sh("brass", rrect(186, 300, 814, 318, 6))); s.push(sh("brass", rrect(186, 852, 814, 870, 6)));
    return { svg: wrap(s.join("")), center: [.5, .58], ramp: NIGHT, unit: 160, spread: .3, subMats: ["night"] }; }
  T.lattice_on = function () { return lattice(true); }; T.lattice_off = function () { return lattice(false); };
  function lancets(on) { var s = [sh("night", "M120 930 V120 H880 V930 Z", "data-bg=\"1\"")], n = 5, w = 118, gapx = 30, X = 500 - (n * w + (n - 1) * gapx) / 2, top = 190, bot = 880, rows = 15;
    for (var k = 0; k < n; k++) { var x0 = X + k * (w + gapx), x1 = x0 + w, r = w / 2, rh = (bot - top - r) / rows;
      for (var j = 0; j < rows; j++) { var y1 = bot - j * rh, y0 = y1 - rh;
        if (j === rows - 1) s.push(sh(on ? "gold" : "blue", "M" + f(x0) + " " + f(y1) + " V" + f(top + r) + " A" + f(r) + " " + f(r) + " 0 0 1 " + f(x1) + " " + f(top + r) + " V" + f(y1) + " Z"));
        else s.push(sh(on ? (j % 2 ? "gold" : "amber") : (j % 2 ? "blue" : "night2"), poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]))); } }
    return { svg: wrap(s.join("")), center: [.5, .55], ramp: NIGHT, unit: 160, spread: .3, subMats: ["night"] }; }
  T.lancets_on = function () { return lancets(true); }; T.lancets_off = function () { return lancets(false); };

  // a window for every client: the domain is the seed for petals, rings, colours and points
  T.client = function (domain) { var h = 2166136261; for (var i = 0; i < domain.length; i++) { h ^= domain.charCodeAt(i); h = Math.imul(h, 16777619); }
    var R = function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
    var c = [500, 500], s = [sh("night", circ(c[0], c[1], 420), "data-bg=\"1\"")], petals = [6, 8, 10, 12][Math.floor(R() * 4)];
    var pal = [["gold", "amber"], ["teal", "blue"], ["amber", "red"], ["blue", "teal2"], ["gold", "teal"]]; for (var q = pal.length - 1; q > 0; q--) { var z = Math.floor(R() * (q + 1)), tmp = pal[q]; pal[q] = pal[z]; pal[z] = tmp; }
    var r1 = 70 + R() * 20, r2 = 170 + R() * 30, r3 = 280 + R() * 25;
    s.push(sh("core", circ(c[0], c[1], r1)));
    for (var a = 0; a < petals; a++) { var a0 = a / petals * Math.PI * 2, a1 = (a + 1) / petals * Math.PI * 2, am = (a0 + a1) / 2;
      s.push(sh(pal[0][a % 2], sector(c[0], c[1], r1, r2, a0, a1)));
      s.push(sh(pal[1][0], sector(c[0], c[1], r2, r3, a0, a1))); s.push(sh(pal[2][a % 2], poly([pol(c[0], c[1], r2 + 6, a0 + .04), pol(c[0], c[1], r3 - 8, am), pol(c[0], c[1], r2 + 6, a1 - .04)]))); }
    var outer = petals * 2; for (var b = 0; b < outer; b++) { var b0 = b / outer * Math.PI * 2; s.push(sh(pal[3][b % 2], sector(c[0], c[1], r3, 362, b0, b0 + Math.PI * 2 / outer))); }
    for (var d = 0; d < outer * 2; d++) { var d0 = d / (outer * 2) * Math.PI * 2; s.push(sh(pal[4][d % 2], sector(c[0], c[1], 362, 420, d0, d0 + Math.PI / outer))); }
    return { svg: wrap(s.join("")), center: [.5, .5], spread: .26 }; };
  T.fan.sub = false; T.quarry.sub = false;
  window.GlassTiles = T;
  window.TILE_MAT = {
    sky: { cols: ["#e8a23a"], radial: true, vary: .1 }, night: { cols: ["#1d3a7a"], radial: true, vary: .12 }, clear: { cols: ["#eedcb0"], radial: true, vary: .08 },
    ray1: { cols: ["#ffc94a"], vary: .06 }, ray2: { cols: ["#f19a2a"], vary: .06 }, gold: { cols: ["#f7c24a", "#f3b23c"], vary: .08 }, amber: { cols: ["#ec8f26", "#e47f1e"], vary: .08 },
    red: { cols: ["#c8452a", "#b83c24"], vary: .08 }, core: { cols: ["#fff0b8"], vary: .03, g: .35 }, moon: { cols: ["#f8e6a8", "#f3d98e"], vary: .06, g: .25 },
    star: { cols: ["#fff2c0"], vary: .04, g: .3, f: .3 }, case: { cols: ["#22407e", "#1b3670"], vary: .08 }, case2: { cols: ["#0f1f44"], vary: .02 },
    screen: { cols: ["#fff1c6", "#ffe9b0"], vary: .04, g: .45 }, dot: { cols: ["#1d3f86"], vary: .03, f: .25 }, brass: { cols: ["#b8833a", "#a8742e"], vary: .08 },
    brass2: { cols: ["#c99448"], vary: .05 }, hole: { cols: ["#0c1430"], vary: 0 }, frame: { cols: ["#3a2a1c"], vary: .05 },
    pane: { cols: ["#ffd06a", "#ffc452"], vary: .06, g: .45, f: .25 }, pane2: { cols: ["#f4ac44", "#eea03c"], vary: .06, g: .3, f: .2 },
    flame: { cols: ["#fff4c8"], vary: .02, g: .55, f: .35 }, teal: { cols: ["#1f9c8a", "#22a894"], vary: .1 }, blue: { cols: ["#23509e", "#1d4690"], vary: .1 },
    key: { cols: ["#ffd25c"], vary: .04, g: .35 }, cream: { cols: ["#f2dfb2", "#ead2a0"], vary: .06 }, cream2: { cols: ["#e2c48a"], vary: .06 },
    beam: { cols: ["#ffe7a8"], vary: .04, g: .2 }, sea: { cols: ["#1f4f9a", "#22a090"], vary: .1 }, wood: { cols: ["#6b3f1c", "#7a4a22"], vary: .08 },
    seal: { cols: ["#b8321e"], vary: .05 }, lens: { cols: ["#bfdbe6", "#a9cfde"], vary: .06, g: .1 }, sand: { cols: ["#eba23c"], vary: .06, g: .1 },
    teal2: { cols: ["#178a7a"], vary: .08 }, night2: { cols: ["#173468", "#1a3c78"], vary: .1 }, red2: { cols: ["#9c2c1a"], vary: .05 }, default: { cols: ["#888888"] }
  };
  Object.keys(window.TILE_MAT).forEach(function (k) { window.TILE_MAT[k].name = k; });
})();
