/* idea-charts2.js: enhanced chart primitives for the IDEA 618 design overhaul.
   Layers new chart types on top of the shared IChart library:
     heroLine       annotated hero time-series with entrance draw + delta end-label + reference band
     slope          slope / bump chart (two or more time columns, ranked lines)
     heatmap        category x year intensity grid, hover per cell, highlight a row
     beeswarm       one-dimensional distribution of states, colored, with a reference line
     smallMultiples grid of mini trend charts, each hoverable / clickable
   Pure rendering: every function takes React and returns React elements, so it runs
   inside a Design Component logic class. Reuses IChart's shared DOM tooltip so hover
   behavior is identical across the app. No data is invented; callers pass real values. */
(function () {
  var IC = window.IChart; if (!IC) return;
  var PAL = IC.PAL;
  var num = IC.num, compact = IC.compact;
  var showTip = IC.showTip, hideTip = IC.hideTip, tipRow = IC.tipRow, ramp = IC.ramp, lerp = IC.lerp;
  var TICK_FONT = "Archivo,'Public Sans',sans-serif";
  var GID = 0;
  var RM = !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function h(React) { var a = [].slice.call(arguments, 1); return React.createElement.apply(React, a); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function darken(c, t) { try { return lerp(c, '#000000', t == null ? 0.16 : t); } catch (e) { return c; } }

  // publication "nice" ticks (1/2/2.5/5 steps)
  function niceTicks(mn, mx, count) {
    if (mn === mx) mx = mn + 1;
    var span = mx - mn, step0 = span / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)), norm = step0 / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var lo = Math.floor(mn / step) * step, hi = Math.ceil(mx / step) * step, tk = [];
    for (var v = lo; v <= hi + step * 1e-6; v += step) tk.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { lo: lo, hi: hi, ticks: tk };
  }

  var STYLED = false;
  function ensureAnim() {
    if (STYLED || typeof document === 'undefined' || !document.head) return; STYLED = true;
    var s = document.createElement('style');
    s.textContent = [
      "@keyframes ic2draw{to{stroke-dashoffset:0}}",
      "@keyframes ic2fade{from{opacity:0}to{opacity:1}}",
      "@keyframes ic2rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}",
      "@keyframes ic2pop{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:scale(1)}}",
      "@keyframes ic2wipe{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}",
      "@media (prefers-reduced-motion:reduce){[data-ic2a]{animation:none!important;stroke-dashoffset:0!important;clip-path:none!important;opacity:1!important;transform:none!important}}"
    ].join('');
    document.head.appendChild(s);
  }
  // animation prop helper: returns a style fragment; skipped under reduced motion
  function anim(name, dur, delay, extra) {
    if (RM) return extra || {};
    var o = { animation: name + ' ' + (dur || 700) + 'ms cubic-bezier(.22,.61,.36,1) ' + (delay || 0) + 'ms both' };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  /* ============ HERO LINE ============
     o: {w,h, xLabels, values, color, yFmt, area, refLine:{value,label,color},
         annotations:[{i,label,sub,dy}], endDelta:{d,p,label}, yMin, ariaLabel} */
  function heroLine(React, o) {
    ensureAnim();
    var w = o.w || 720, ht = o.h || 300, p = o.pad || { l: 52, r: 132, t: 26, b: 34 };
    var xs = o.xLabels, vals = o.values, n = xs.length, color = o.color || PAL.green;
    var real = vals.filter(function (v) { return v != null; });
    var dataMin = Math.min.apply(null, real), dataMax = Math.max.apply(null, real);
    var ns = niceTicks(o.yMin != null ? o.yMin : dataMin, dataMax, o.yTicks || 4);
    var mn = o.yMin != null ? o.yMin : ns.lo, mx = ns.hi; if (mn === mx) mx = mn + 1;
    var tk = ns.ticks.filter(function (v) { return v >= mn - 1e-9 && v <= mx + 1e-9; });
    var iw = w - p.l - p.r, ih = ht - p.t - p.b;
    var X = function (i) { return p.l + (n <= 1 ? 0 : i / (n - 1) * iw); };
    var Y = function (v) { return p.t + ih - (v - mn) / (mx - mn) * ih; };
    var yfmt = o.yFmt || compact;
    var kids = [], gid = 'ic2h' + (++GID);

    kids.push(h(React, 'defs', { key: 'def' }, h(React, 'linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
      h(React, 'stop', { offset: '0%', stopColor: color, stopOpacity: 0.20 }),
      h(React, 'stop', { offset: '100%', stopColor: color, stopOpacity: 0.015 }))));

    // gridlines + y labels
    tk.forEach(function (v, i) {
      kids.push(h(React, 'line', { key: 'g' + i, x1: p.l, x2: w - p.r, y1: Y(v), y2: Y(v), stroke: PAL.line, strokeWidth: 1 }));
      kids.push(h(React, 'text', { key: 'yl' + i, x: p.l - 9, y: Y(v) + 3.5, textAnchor: 'end', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, yfmt(v)));
    });
    // x labels (first, last, and a few between)
    var step = Math.ceil(n / (o.xEvery || 6));
    xs.forEach(function (lb, i) {
      var isEnd = i === 0 || i === n - 1;
      if (!isEnd && (i % step !== 0 || i < step || n - 1 - i < step)) return;
      kids.push(h(React, 'text', { key: 'xl' + i, x: X(i), y: ht - 9, textAnchor: i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT }, lb));
    });
    // reference line
    if (o.refLine != null) {
      var ry = Y(o.refLine.value), rc = o.refLine.color || PAL.accent;
      kids.push(h(React, 'line', { key: 'ref', x1: p.l, x2: w - p.r, y1: ry, y2: ry, stroke: rc, strokeWidth: 1.3, strokeDasharray: '4 3', style: anim('ic2fade', 500, 700) }));
      if (o.refLine.label) kids.push(h(React, 'text', { key: 'refl', x: p.l + 4, y: ry - 5, fontSize: 10, fontWeight: 700, fill: rc, style: anim('ic2fade', 500, 800) }, o.refLine.label));
    }

    // build path over real points
    var pts = [];
    vals.forEach(function (v, i) { if (v != null) pts.push([X(i), Y(v)]); });
    var dPath = pts.map(function (pt, i) { return (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ');
    // area
    if (o.area !== false) {
      var ad = 'M' + pts[0][0].toFixed(1) + ' ' + (p.t + ih) + ' ' + pts.map(function (pt) { return 'L' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ') + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (p.t + ih) + ' Z';
      kids.push(h(React, 'path', { key: 'area', d: ad, fill: 'url(#' + gid + ')', style: anim('ic2fade', 900, 250), 'data-ic2a': '1' }));
    }
    // line with draw-on animation (dash offset ~ perimeter estimate)
    var approxLen = 0; for (var q = 1; q < pts.length; q++) { var ddx = pts[q][0] - pts[q - 1][0], ddy = pts[q][1] - pts[q - 1][1]; approxLen += Math.sqrt(ddx * ddx + ddy * ddy); }
    kids.push(h(React, 'path', { key: 'line', d: dPath, fill: 'none', stroke: color, strokeWidth: o.width || 2.8, strokeLinejoin: 'round', strokeLinecap: 'round', 'data-ic2a': '1', style: anim('ic2wipe', 1100, 100) }));

    // annotation callouts
    (o.annotations || []).forEach(function (a, ai) {
      if (a.i == null || vals[a.i] == null) return;
      var ax = X(a.i), ay = Y(vals[a.i]), dy = a.dy != null ? a.dy : -22;
      var side = ax > p.l + iw * 0.62 ? 'end' : 'start';
      kids.push(h(React, 'circle', { key: 'ac' + ai, cx: ax, cy: ay, r: 3.4, fill: color, stroke: '#fbfbf9', strokeWidth: 1.4, style: anim('ic2pop', 400, 900 + ai * 90), 'data-ic2a': '1' }));
      kids.push(h(React, 'line', { key: 'al' + ai, x1: ax, x2: ax, y1: ay - 5, y2: ay + dy + 12, stroke: PAL.faint, strokeWidth: 1, strokeDasharray: '2 2', style: anim('ic2fade', 400, 950 + ai * 90) }));
      kids.push(h(React, 'text', { key: 'at' + ai, x: clamp(ax, p.l + 2, w - p.r - 2), y: ay + dy, textAnchor: side === 'end' ? 'end' : 'start', fontSize: 10.5, fontWeight: 700, fill: PAL.ink, fontFamily: TICK_FONT, style: anim('ic2rise', 450, 980 + ai * 90) }, a.label));
      if (a.sub) kids.push(h(React, 'text', { key: 'as' + ai, x: clamp(ax, p.l + 2, w - p.r - 2), y: ay + dy + 13, textAnchor: side === 'end' ? 'end' : 'start', fontSize: 9.5, fill: PAL.muted, style: anim('ic2rise', 450, 1010 + ai * 90) }, a.sub));
    });

    // end label: latest value + delta
    var lastI = -1; for (var li = n - 1; li >= 0; li--) if (vals[li] != null) { lastI = li; break; }
    if (lastI >= 0) {
      var ex = X(lastI), ey = Y(vals[lastI]);
      kids.push(h(React, 'circle', { key: 'end', cx: ex, cy: ey, r: 4.5, fill: color, stroke: '#fbfbf9', strokeWidth: 2, style: anim('ic2pop', 400, 1150), 'data-ic2a': '1' }));
      var elx = ex + 10;
      kids.push(h(React, 'text', { key: 'endv', x: elx, y: ey - 3, fontSize: 15, fontWeight: 800, fill: PAL.ink, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums', style: anim('ic2rise', 500, 1180) }, yfmt(vals[lastI])));
      if (o.endDelta) {
        var up = o.endDelta.d >= 0, dc = up ? PAL.green : '#b23b2e';
        kids.push(h(React, 'text', { key: 'endd', x: elx, y: ey + 13, fontSize: 11, fontWeight: 700, fill: dc, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums', style: anim('ic2rise', 500, 1220) }, (up ? '\u25b2 ' : '\u25bc ') + o.endDelta.label));
      }
    }

    // hover bands (shared tooltip)
    kids.push(h(React, 'g', { key: 'fx', 'data-fx': '1' }));
    var mkBand = function (i) {
      var left = i === 0 ? p.l : (X(i - 1) + X(i)) / 2;
      var right = i === n - 1 ? (w - p.r) : (X(i) + X(i + 1)) / 2;
      var move = function (e) {
        var svg = e.currentTarget.ownerSVGElement, g = svg && svg.querySelector('[data-fx]');
        if (g) {
          while (g.firstChild) g.removeChild(g.firstChild);
          if (vals[i] != null) {
            var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            ln.setAttribute('x1', X(i)); ln.setAttribute('y1', p.t); ln.setAttribute('x2', X(i)); ln.setAttribute('y2', p.t + ih); ln.setAttribute('stroke', '#8c8e87'); ln.setAttribute('stroke-width', 1); ln.setAttribute('stroke-dasharray', '3 3'); g.appendChild(ln);
            var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(vals[i])); c.setAttribute('r', 4); c.setAttribute('fill', color); c.setAttribute('stroke', '#fff'); c.setAttribute('stroke-width', 1.5); g.appendChild(c);
          }
        }
        var extra = '';
        if (i > 0 && vals[i] != null && vals[i - 1] != null) { var dd = vals[i] - vals[i - 1], pp = dd / vals[i - 1] * 100; extra = '<div class="ichart-note">' + (dd >= 0 ? '\u25b2 +' : '\u25bc \u2212') + compact(Math.abs(dd)) + ' vs ' + esc(xs[i - 1]) + ' (' + (pp >= 0 ? '+' : '') + pp.toFixed(1) + '%)</div>'; }
        showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(xs[i]) + '</div><div class="ichart-big">' + esc(vals[i] == null ? 'n/a' : yfmt(vals[i])) + '</div>' + extra);
      };
      return h(React, 'rect', { key: 'hb' + i, x: left, y: p.t, width: Math.max(0, right - left), height: ih, fill: 'transparent', style: { pointerEvents: 'all', cursor: o.onYearClick ? 'pointer' : 'crosshair' }, onMouseEnter: move, onMouseMove: move, onClick: o.onYearClick ? function () { o.onYearClick(i); } : undefined });
    };
    var bands = []; for (var bi = 0; bi < n; bi++) bands.push(mkBand(bi));
    kids.push(h(React, 'g', { key: 'bands', onMouseLeave: function (e) { var svg = e.currentTarget.ownerSVGElement, g = svg && svg.querySelector('[data-fx]'); if (g) while (g.firstChild) g.removeChild(g.firstChild); hideTip(); } }, bands));

    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ============ SLOPE / BUMP ============
     o: {w,h, cols:[labels], rows:[{label,color,values:[...],strong}], yFmt, valueSide, ariaLabel, onClick} */
  function slope(React, o) {
    ensureAnim();
    var w = o.w || 520, ht = o.h || 340, p = { l: o.padL != null ? o.padL : 128, r: o.padR != null ? o.padR : 128, t: 30, b: 26 };
    var cols = o.cols, nc = cols.length, rows = o.rows;
    var all = []; rows.forEach(function (r) { r.values.forEach(function (v) { if (v != null) all.push(v); }); });
    var mn = o.yMin != null ? o.yMin : Math.min.apply(null, all), mx = o.yMax != null ? o.yMax : Math.max.apply(null, all);
    if (mn === mx) mx = mn + 1;
    var iw = w - p.l - p.r, ih = ht - p.t - p.b;
    var CX = function (c) { return p.l + (nc <= 1 ? 0 : c / (nc - 1) * iw); };
    var Y = function (v) { return p.t + ih - (v - mn) / (mx - mn) * ih; };
    var yfmt = o.yFmt || function (v) { return num(v); };
    var kids = [];
    // column headers + vertical rails
    cols.forEach(function (cl, c) {
      kids.push(h(React, 'line', { key: 'rail' + c, x1: CX(c), x2: CX(c), y1: p.t, y2: p.t + ih, stroke: PAL.line, strokeWidth: 1 }));
      kids.push(h(React, 'text', { key: 'ch' + c, x: CX(c), y: p.t - 12, textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: PAL.muted, fontFamily: TICK_FONT }, cl));
    });
    var leftLabs = [], rightLabs = [];
    rows.forEach(function (r, ri) {
      var col = r.color || PAL.green;
      var segs = [];
      for (var c = 0; c < nc - 1; c++) { if (r.values[c] == null || r.values[c + 1] == null) continue; segs.push([CX(c), Y(r.values[c]), CX(c + 1), Y(r.values[c + 1])]); }
      var dstr = segs.map(function (s) { return 'M' + s[0] + ' ' + s[1] + ' L' + s[2] + ' ' + s[3]; }).join(' ');
      var hovered = function (e) {
        e.currentTarget.style.strokeWidth = (r.strong ? 4 : 3.4);
        var rowsHtml = cols.map(function (cl, c) { return tipRow(col, cl, r.values[c] == null ? 'n/a' : yfmt(r.values[c])); }).join('');
        var d0 = r.values[0], d1 = r.values[nc - 1], deltaHtml = '';
        if (d0 != null && d1 != null) { var dp = d0 ? (d1 - d0) / d0 * 100 : null; deltaHtml = '<div class="ichart-note">' + (d1 - d0 >= 0 ? '\u25b2 ' : '\u25bc ') + (dp == null ? '' : (dp >= 0 ? '+' : '') + dp.toFixed(0) + '%') + ' over the period</div>'; }
        showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(r.label) + '</div>' + rowsHtml + deltaHtml);
      };
      kids.push(h(React, 'path', { key: 'sp' + ri, d: dstr, fill: 'none', stroke: col, strokeWidth: r.strong ? 3.2 : 2, strokeOpacity: r.dim ? 0.4 : 0.92, strokeLinecap: 'round', strokeLinejoin: 'round', 'data-ic2a': '1', style: anim('ic2fade', 700, 120 + ri * 45, { cursor: o.onClick ? 'pointer' : 'default', transition: 'stroke-width .12s' }), onMouseEnter: hovered, onMouseMove: hovered, onMouseLeave: function (e) { e.currentTarget.style.strokeWidth = r.strong ? 3.2 : 2; hideTip(); }, onClick: o.onClick ? function () { o.onClick(r, ri); } : undefined }));
      [0, nc - 1].forEach(function (c) { if (r.values[c] == null) return; kids.push(h(React, 'circle', { key: 'd' + ri + '_' + c, cx: CX(c), cy: Y(r.values[c]), r: r.strong ? 4 : 3, fill: col, fillOpacity: r.dim ? 0.5 : 1, 'data-ic2a': '1', style: anim('ic2pop', 350, 400 + ri * 45) })); });
      var lv = r.values[0], rv = r.values[nc - 1];
      if (lv != null) leftLabs.push({ yTrue: Y(lv), y: Y(lv), text: r.label + (o.showEndVals ? '  ' + yfmt(lv) : ''), color: r.dim ? PAL.faint : PAL.ink, w: r.strong ? 700 : 500 });
      if (rv != null) rightLabs.push({ yTrue: Y(rv), y: Y(rv), text: (o.showEndVals ? yfmt(rv) + '  ' : '') + r.label, color: r.dim ? PAL.faint : col, w: r.strong ? 700 : 500 });
    });
    // vertical de-collision: push overlapping end labels apart, keep a leader to the true point
    var declutter = function (arr) {
      arr.sort(function (a, b) { return a.yTrue - b.yTrue; });
      var minGap = 13, bot = p.t + ih + 2;
      for (var i = 1; i < arr.length; i++) { if (arr[i].y < arr[i - 1].y + minGap) arr[i].y = arr[i - 1].y + minGap; }
      for (var j = arr.length - 1; j >= 0; j--) { if (arr[j].y > bot) arr[j].y = bot - (arr.length - 1 - j) * minGap; }
    };
    declutter(leftLabs); declutter(rightLabs);
    leftLabs.forEach(function (l, i) {
      if (Math.abs(l.y - l.yTrue) > 5) kids.push(h(React, 'line', { key: 'lll' + i, x1: p.l - 6, y1: l.yTrue, x2: p.l - 10, y2: l.y, stroke: PAL.line, strokeWidth: 1 }));
      kids.push(h(React, 'text', { key: 'll' + i, x: p.l - 12, y: l.y + 3.5, textAnchor: 'end', fontSize: 11, fontWeight: l.w, fill: l.color, style: anim('ic2fade', 600, 500 + i * 40) }, l.text));
    });
    rightLabs.forEach(function (l, i) {
      if (Math.abs(l.y - l.yTrue) > 5) kids.push(h(React, 'line', { key: 'rll' + i, x1: w - p.r + 6, y1: l.yTrue, x2: w - p.r + 10, y2: l.y, stroke: PAL.line, strokeWidth: 1 }));
      kids.push(h(React, 'text', { key: 'rl' + i, x: w - p.r + 12, y: l.y + 3.5, textAnchor: 'start', fontSize: 11, fontWeight: l.w, fill: l.color, style: anim('ic2fade', 600, 500 + i * 40) }, l.text));
    });
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ============ HEATMAP ============
     o: {w, rowLabels, colLabels, matrix:[[...]], rowH, labelW, colEvery, valFmt, lo, hi,
         highlightRow, unit, ariaLabel, onClickRow} */
  function heatmap(React, o) {
    ensureAnim();
    var rl = o.rowLabels, cl = o.colLabels, M = o.matrix;
    var lw = o.labelW || 150, rowH = o.rowH || 22, gap = 2, top = 20, botLab = 20;
    var nc = cl.length, nr = rl.length;
    var cw = o.cellW || 26;
    var w = o.w || (lw + nc * (cw + gap) + 8);
    var gridW = w - lw - 8;
    var cellW = (gridW - (nc - 1) * gap) / nc;
    var ht = top + nr * (rowH + gap) + botLab;
    var flat = []; M.forEach(function (r) { r.forEach(function (v) { if (v != null) flat.push(v); }); });
    var lo = o.lo != null ? o.lo : Math.min.apply(null, flat), hi = o.hi != null ? o.hi : Math.max.apply(null, flat);
    if (lo === hi) hi = lo + 1;
    var vfmt = o.valFmt || function (v) { return v; };
    var kids = [];
    // column labels (thinned)
    var cstep = o.colEvery || Math.ceil(nc / 8);
    cl.forEach(function (c, ci) {
      var isEnd = ci === 0 || ci === nc - 1;
      if (!isEnd && ci % cstep !== 0) return;
      kids.push(h(React, 'text', { key: 'cl' + ci, x: lw + ci * (cellW + gap) + cellW / 2, y: 13, textAnchor: 'middle', fontSize: 9.5, fill: PAL.faint, fontFamily: TICK_FONT }, c));
    });
    rl.forEach(function (rlab, ri) {
      var y = top + ri * (rowH + gap);
      var strong = o.highlightRow === rlab;
      var clickable = !!o.onClickRow;
      kids.push(h(React, 'text', { key: 'rl' + ri, x: lw - 8, y: y + rowH / 2 + 3.5, textAnchor: 'end', fontSize: 10.5, fontWeight: strong ? 800 : 500, fill: strong ? PAL.accent : PAL.muted, style: clickable ? { cursor: 'pointer' } : null, onClick: clickable ? function () { o.onClickRow(rlab, ri); } : undefined }, rlab));
      cl.forEach(function (c, ci) {
        var v = M[ri][ci], x = lw + ci * (cellW + gap);
        var t = v == null ? 0 : (v - lo) / (hi - lo);
        var fill = v == null ? '#eceae2' : ramp(clamp(t, 0, 1), o.colorLo || '#eef3ea', o.colorHi || '#0f3a29');
        var enter = function (e) {
          e.currentTarget.style.stroke = PAL.ink; e.currentTarget.style.strokeWidth = '1.4';
          showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(rlab) + '</div><div class="ichart-note">' + esc(c) + '</div><div class="ichart-big">' + esc(v == null ? 'n/a' : vfmt(v)) + (o.unit ? ' ' + esc(o.unit) : '') + '</div>');
        };
        kids.push(h(React, 'rect', { key: 'c' + ri + '_' + ci, x: x, y: y, width: cellW, height: rowH, rx: 2, fill: fill, stroke: strong ? PAL.accent : 'transparent', strokeWidth: strong ? 1.2 : 0, 'data-ic2a': '1', style: anim('ic2fade', 400, 60 + (ri * 3 + ci) * 6, { cursor: 'pointer', transition: 'stroke .1s' }), onMouseEnter: enter, onMouseMove: enter, onMouseLeave: function (e) { e.currentTarget.style.stroke = strong ? PAL.accent : 'transparent'; e.currentTarget.style.strokeWidth = strong ? '1.2' : '0'; hideTip(); }, onClick: clickable ? function () { o.onClickRow(rlab, ri); } : undefined }));
      });
    });
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ============ BEESWARM ============
     o: {w,h, points:[{v,label,color,tip}], xMin,xMax, xFmt, refLine:{value,label}, r, ariaLabel, onClick, xLabel} */
  function beeswarm(React, o) {
    ensureAnim();
    var w = o.w || 700, ht = o.h || 220, p = { l: 16, r: 16, t: 18, b: 40 };
    var pts = o.points.slice(), r = o.r || 5;
    var vals = pts.map(function (d) { return d.v; }).filter(function (v) { return v != null; });
    var mn = o.xMin != null ? o.xMin : Math.min.apply(null, vals), mx = o.xMax != null ? o.xMax : Math.max.apply(null, vals);
    if (mn === mx) mx = mn + 1;
    var iw = w - p.l - p.r, ih = ht - p.t - p.b, midY = p.t + ih / 2;
    var X = function (v) { return p.l + (v - mn) / (mx - mn) * iw; };
    var kids = [], t;
    // axis
    kids.push(h(React, 'line', { key: 'ax', x1: p.l, x2: w - p.r, y1: p.t + ih + 6, y2: p.t + ih + 6, stroke: PAL.line, strokeWidth: 1 }));
    var ticks = niceTicks(mn, mx, 5).ticks.filter(function (v) { return v >= mn - 1e-9 && v <= mx + 1e-9; });
    ticks.forEach(function (tv, i) {
      kids.push(h(React, 'line', { key: 'tk' + i, x1: X(tv), x2: X(tv), y1: p.t, y2: p.t + ih + 6, stroke: PAL.line, strokeWidth: 1, strokeDasharray: '2 3' }));
      kids.push(h(React, 'text', { key: 'tl' + i, x: X(tv), y: p.t + ih + 20, textAnchor: 'middle', fontSize: 10, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, o.xFmt ? o.xFmt(tv) : num(tv)));
    });
    if (o.xLabel) kids.push(h(React, 'text', { key: 'xlab', x: p.l + iw / 2, y: ht - 3, textAnchor: 'middle', fontSize: 10.5, fontWeight: 700, fill: PAL.muted }, o.xLabel));
    // packing: sort by x, place at nearest free vertical offset
    pts.sort(function (a, b) { return (a.v || 0) - (b.v || 0); });
    var placed = [];
    pts.forEach(function (d) {
      if (d.v == null) { d._x = null; return; }
      var x = X(d.v), off = 0, dir = 1, tries = 0, y = midY;
      while (tries < 200) {
        var ok = true;
        for (var i = 0; i < placed.length; i++) { var dx = placed[i]._x - x, dy = placed[i]._y - y; if (dx * dx + dy * dy < (2 * r + 0.6) * (2 * r + 0.6)) { ok = false; break; } }
        if (ok) break;
        off += 1; y = midY + (dir * off * (r * 0.9)); dir *= -1; tries++;
        if (Math.abs(y - midY) > ih / 2 - r) { y = midY + (Math.random() - 0.5) * (ih - 2 * r); }
      }
      d._x = x; d._y = clamp(y, p.t + r, p.t + ih - r); placed.push(d);
    });
    // reference line
    if (o.refLine != null) {
      var rx = X(o.refLine.value);
      kids.push(h(React, 'line', { key: 'ref', x1: rx, x2: rx, y1: p.t - 4, y2: p.t + ih + 6, stroke: PAL.accent, strokeWidth: 1.5, strokeDasharray: '4 3' }));
      if (o.refLine.label) kids.push(h(React, 'text', { key: 'refl', x: rx, y: p.t - 7, textAnchor: 'middle', fontSize: 10, fontWeight: 700, fill: PAL.accent }, o.refLine.label));
    }
    placed.forEach(function (d, i) {
      if (d._x == null) return;
      var mk = function (e) { e.currentTarget.setAttribute('r', r + 2); showTip(e.clientX, e.clientY, d.tip || ('<div class="ichart-hd">' + esc(d.label || '') + '</div><div class="ichart-big">' + esc(o.xFmt ? o.xFmt(d.v) : num(d.v)) + '</div>')); };
      kids.push(h(React, 'circle', { key: 'p' + i, cx: d._x, cy: d._y, r: r, fill: d.color || PAL.green, fillOpacity: 0.82, stroke: '#fbfbf9', strokeWidth: 0.9, 'data-ic2a': '1', style: anim('ic2pop', 380, 80 + i * 12, { cursor: o.onClick ? 'pointer' : 'default' }), onMouseEnter: mk, onMouseMove: mk, onMouseLeave: function (e) { e.currentTarget.setAttribute('r', r); hideTip(); }, onClick: o.onClick ? function () { o.onClick(d); } : undefined }));
    });
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ============ SMALL MULTIPLES ============
     o: {cells:[{label, values:[...], color, latest, deltaLabel, deltaUp, onClick}], cols, cellH, yShared, ariaLabel} */
  function smallMultiples(React, o) {
    ensureAnim();
    var cells = o.cells, cols = o.cols || 4, cellH = o.cellH || 96;
    var globalMax = 0; if (o.yShared) cells.forEach(function (c) { c.values.forEach(function (v) { if (v != null && v > globalMax) globalMax = v; }); });
    var kids = cells.map(function (c, ci) {
      var vw = 150, vh = 46, pad = 3;
      var real = c.values.filter(function (v) { return v != null; });
      var mn = Math.min.apply(null, real), mx = o.yShared ? globalMax : Math.max.apply(null, real); if (mn === mx) mx = mn + 1;
      var n = c.values.length;
      var X = function (i) { return pad + i / (n - 1) * (vw - 2 * pad); };
      var Y = function (v) { return vh - pad - (v - (o.yShared ? 0 : mn)) / (mx - (o.yShared ? 0 : mn)) * (vh - 2 * pad); };
      var pts = []; c.values.forEach(function (v, i) { if (v != null) pts.push([X(i), Y(v)]); });
      var dLine = pts.map(function (pt, i) { return (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ');
      var dArea = pts.length ? ('M' + pts[0][0].toFixed(1) + ' ' + (vh - pad) + ' ' + pts.map(function (pt) { return 'L' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ') + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (vh - pad) + ' Z') : '';
      var col = c.color || PAL.green;
      var svg = h(React, 'svg', { viewBox: '0 0 ' + vw + ' ' + vh, width: '100%', style: { display: 'block', width: '100%', overflow: 'visible' }, 'aria-hidden': 'true' },
        h(React, 'path', { key: 'a', d: dArea, fill: col, fillOpacity: 0.12 }),
        h(React, 'path', { key: 'l', d: dLine, fill: 'none', stroke: col, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' }),
        pts.length ? h(React, 'circle', { key: 'e', cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 2.6, fill: darken(col, 0.15) }) : null);
      var enter = function (e) {
        var first = null; for (var i = 0; i < c.values.length; i++) { if (c.values[i] != null) { first = c.values[i]; break; } }
        var chg = (first != null && real.length) ? ((real[real.length - 1] - first) / first * 100) : null;
        showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(c.label) + '</div><div class="ichart-big">' + esc(c.latest) + '</div>' + (chg != null ? '<div class="ichart-note">' + (chg >= 0 ? '\u25b2 +' : '\u25bc \u2212') + Math.abs(chg).toFixed(0) + '% since ' + esc(o.sinceLabel || 'start') + '</div>' : ''));
      };
      return h(React, 'div', { key: ci, className: o.onClick || c.onClick ? 'st-lift' : undefined, role: (o.onClick || c.onClick) ? 'button' : undefined, tabIndex: (o.onClick || c.onClick) ? 0 : undefined,
        onMouseEnter: enter, onMouseMove: enter, onMouseLeave: hideTip,
        onClick: (c.onClick || o.onClick) ? function () { (c.onClick || o.onClick)(c, ci); } : undefined,
        style: anim('ic2rise', 420, ci * 45, { background: '#fbfbf8', border: '1px solid #eeece4', borderRadius: 10, padding: '10px 11px 8px', cursor: (o.onClick || c.onClick) ? 'pointer' : 'default' }) },
        h(React, 'div', { style: { fontSize: 11, fontWeight: 600, color: '#3a3c37', lineHeight: 1.25, minHeight: 28, marginBottom: 2 } }, c.label),
        h(React, 'div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 4 } },
          h(React, 'div', { style: { fontFamily: TICK_FONT, fontWeight: 800, fontSize: 17, letterSpacing: '-.02em', color: PAL.greenD, fontVariantNumeric: 'tabular-nums' } }, c.latest),
          c.deltaLabel ? h(React, 'div', { style: { fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c.deltaUp ? PAL.green : '#b23b2e' } }, (c.deltaUp ? '\u25b2 ' : '\u25bc ') + c.deltaLabel) : null),
        svg);
    });
    return h(React, 'div', { style: { display: 'grid', gridTemplateColumns: 'repeat(' + cols + ', 1fr)', gap: 10 }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  window.IChart2 = {
    heroLine: heroLine, slope: slope, heatmap: heatmap, beeswarm: beeswarm, smallMultiples: smallMultiples,
    niceTicks: niceTicks, anim: anim, ensureAnim: ensureAnim
  };
})();
