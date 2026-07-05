/* idea-charts.js: shared SVG chart + format helpers for the IDEA 618 redesign.
   Rendering is still pure: every chart function takes React and returns React
   elements, so it works inside a Design Component logic class. No data is
   invented here; callers pass real values drawn from window.IDEA / MOE / DET /
   LEAALL / USMAP.

   Interactivity layer (added in the design overhaul): a single shared DOM
   tooltip + a shared district (LEA) popup live outside React and are driven by
   plain event handlers attached to the SVG. Charts therefore become hoverable
   and popup-ready without any caller having to hold hover state. */
(function () {
  var PAL = {
    cream: '#f4f4ef', card: '#fbfbf9', ink: '#1a1c1a', muted: '#5c5f5a',
    faint: '#8c8e87', line: '#e3e2db', navy: '#10324a', greenD: '#103d2c',
    green: '#2f8f57', greenL: '#86c195', sage: '#c7d6c4', blue: '#2a5fb0',
    purple: '#7a4fa3', accent: '#cf6b35', gold: '#c99a2e', teal: '#2c7d73'
  };
  var SVGNS = 'http://www.w3.org/2000/svg';

  function h(React) { var a = [].slice.call(arguments, 1); return React.createElement.apply(React, a); }

  /* ---- number formatting ---- */
  function num(n) { return n == null ? '–' : Math.round(n).toLocaleString('en-US'); }
  function compact(n) {
    if (n == null) return '–';
    if (Math.abs(n) >= 1e6) return +(n / 1e6).toFixed(Math.abs(n) >= 1e8 ? 0 : 1) + 'M';
    if (Math.abs(n) >= 1e3) return +(n / 1e3).toFixed(Math.abs(n) >= 1e4 ? 0 : 1) + 'K';
    return num(n);
  }
  function pct(n, d) { return n == null ? '–' : n.toFixed(d == null ? 1 : d) + '%'; }
  function money(v) {
    if (v == null) return '–';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + num(v);
  }

  /* ---- color interpolation ---- */
  function hx(c) { c = c.replace('#', ''); return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16)]; }
  function toHex(a) { return '#' + a.map(function (v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? '0' + s : s; }).join(''); }
  function lerp(a, b, t) { var x = hx(a), y = hx(b); return toHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function ramp(t, lo, hi) { return lerp(lo || '#e8efe6', hi || '#0f3a29', Math.max(0, Math.min(1, t))); }
  function darken(c, t) { try { return lerp(c, '#000000', t == null ? 0.16 : t); } catch (e) { return c; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function listJoin(a) { a = a || []; return a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]; }

  /* ================= SHARED UI: tooltip + popup (DOM, outside React) ================= */
  var TIP = null, STYLED = false, MODAL = null, GID = 0;

  function ensureStyle() {
    if (STYLED || typeof document === 'undefined' || !document.head) return;
    STYLED = true;
    var s = document.createElement('style');
    s.textContent = [
      ".ichart-tip{position:fixed;z-index:9000;pointer-events:none;background:#1a1c1a;color:#fff;font-family:'Public Sans',system-ui,sans-serif;font-size:12px;line-height:1.35;padding:9px 12px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.22);max-width:280px;opacity:0;display:none;transition:opacity .11s ease}",
      ".ichart-tip .ichart-hd{font-weight:700;font-size:12px;margin-bottom:2px;letter-spacing:.01em}",
      ".ichart-tip .ichart-big{font-family:'Archivo','Public Sans',sans-serif;font-weight:700;font-size:14.5px;letter-spacing:-.01em;font-variant-numeric:tabular-nums;margin-top:1px}",
      ".ichart-tip .ichart-note{color:#b7bab3;font-size:11px;margin-top:2px;line-height:1.35}",
      ".ichart-tip .ichart-tr{display:flex;align-items:center;gap:8px;margin-top:4px;font-variant-numeric:tabular-nums}",
      ".ichart-tip .ichart-sw{width:9px;height:9px;border-radius:2px;flex:none}",
      ".ichart-tip .ichart-lb{color:#dadcd5;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".ichart-tip .ichart-vl{font-weight:700;margin-left:14px;white-space:nowrap}",
      ".ichart-ov{position:fixed;inset:0;z-index:8000;background:rgba(18,20,18,.46);display:flex;align-items:center;justify-content:center;padding:22px;font-family:'Public Sans',system-ui,sans-serif;animation:ichartFade .16s ease}",
      ".ichart-ov.closing{animation:ichartFadeOut .15s ease forwards}",
      ".ichart-modal{position:relative;width:min(520px,100%);max-height:88vh;overflow:auto;background:#fbfbf9;border-radius:12px;box-shadow:0 18px 48px rgba(16,42,32,.22);padding:24px 26px 22px;color:#1a1c1a;animation:ichartPop .22s cubic-bezier(.2,.7,.3,1)}",
      ".ichart-ov.closing .ichart-modal{animation:none;opacity:0;transform:translateY(8px)}",
      ".ichart-modal .ichart-kick{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#2f8f57;margin-bottom:9px}",
      ".ichart-modal .ichart-title{font-family:'Archivo','Public Sans',sans-serif;font-weight:700;font-size:23px;line-height:1.12;letter-spacing:-.02em;margin:0 0 4px;padding-right:34px}",
      ".ichart-modal .ichart-sub{font-size:12px;color:#8c8e87;margin-bottom:18px;font-variant-numeric:tabular-nums}",
      ".ichart-modal .ichart-x{position:absolute;top:16px;right:18px;width:30px;height:30px;border:none;border-radius:8px;background:#efeee7;color:#5c5f5a;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}",
      ".ichart-modal .ichart-x:hover{background:#e4e3da;color:#1a1c1a}",
      ".ichart-modal .ichart-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}",
      ".ichart-modal .ichart-kpi{background:#fff;border:1px solid #eeece4;border-radius:11px;padding:12px 13px}",
      ".ichart-modal .ichart-kpi .k{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#8c8e87}",
      ".ichart-modal .ichart-kpi .v{font-family:'Archivo','Public Sans',sans-serif;font-weight:700;font-size:21px;letter-spacing:-.02em;color:#103d2c;margin-top:6px;font-variant-numeric:tabular-nums}",
      ".ichart-modal .ichart-kpi .n{font-size:11px;color:#8c8e87;margin-top:2px}",
      ".ichart-modal .ichart-secttl{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8c8e87;margin:0 0 10px}",
      ".ichart-modal .ichart-m{margin-bottom:12px}",
      ".ichart-modal .ichart-ml{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:#3a3c37;margin-bottom:5px}",
      ".ichart-modal .ichart-ml b{color:#1a1c1a;font-variant-numeric:tabular-nums}",
      ".ichart-modal .ichart-track{height:8px;background:#edece5;border-radius:2px;overflow:hidden}",
      ".ichart-modal .ichart-track span{display:block;height:100%;border-radius:2px;transition:width .5s cubic-bezier(.22,.61,.36,1)}",
      ".ichart-modal .ichart-foot{font-size:11px;color:#9a9b93;line-height:1.5;margin-top:16px;padding-top:14px;border-top:1px solid #eeece4}",
      ".ichart-modal .ichart-note2{font-size:13.5px;color:#3a3c37;line-height:1.55;margin:0 0 16px}",
      ".ichart-modal .ichart-chips{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 6px}",
      ".ichart-modal .ichart-chips span{font-size:12px;font-weight:600;color:#1a1c1a;background:#fff;border:1px solid #e3e2db;border-radius:6px;padding:4px 10px}",
      ".ichart-modal .ichart-chips span.dim{color:#9a9b93;background:transparent;border-style:dashed}",
      ".ichart-modal .ichart-chart{margin:8px 0 2px}",
      ".ichart-exmenu{position:fixed;z-index:9500;background:#fff;border:1px solid #e6e4dc;border-radius:8px;box-shadow:0 8px 24px rgba(16,42,32,.16);padding:5px;display:flex;flex-direction:column;min-width:150px;font-family:'Public Sans',system-ui,sans-serif;animation:ichartFade .12s ease}",
      ".ichart-exmenu button{font:inherit;font-size:13px;font-weight:600;color:#1a1c1a;background:none;border:none;text-align:left;padding:9px 12px;border-radius:6px;cursor:pointer;display:flex;align-items:center;gap:9px}",
      ".ichart-exmenu button:hover{background:#efeee7;color:#103d2c}",
      ".ichart-exmenu svg{color:#8c8e87;flex:none}",
      "@keyframes ichartFade{from{opacity:0}to{opacity:1}}",
      "@keyframes ichartFadeOut{from{opacity:1}to{opacity:0}}",
      "@keyframes ichartPop{from{opacity:0;transform:translateY(15px) scale(.985)}to{opacity:1;transform:none}}",
      "@keyframes icaGrowX{from{transform:scaleX(0)}to{transform:scaleX(1)}}",
      "@keyframes icaGrowY{from{transform:scaleY(0)}to{transform:scaleY(1)}}",
      "@keyframes icaWipe{from{clip-path:inset(-10px 100% -10px 0)}to{clip-path:inset(-10px -10px -10px 0)}}",
      "@keyframes icaFade{from{opacity:0}to{opacity:1}}",
      ".ichart-supp{display:inline-flex;align-items:center;gap:6px;font-family:'Public Sans',system-ui,sans-serif;font-size:11.5px;font-weight:600;color:#6a6c65;background:#fff;border:1px solid #e3e2db;border-radius:8px;padding:5px 10px;cursor:pointer;line-height:1;-webkit-tap-highlight-color:transparent}",
      ".ichart-supp:hover{border-color:#c9c8bd;color:#1a1c1a;background:#f8f7f2}",
      ".ichart-supp svg{width:13px;height:13px;flex:none;color:#8c8e87}",
      ".ichart-modal .ichart-supp-codes{display:flex;flex-direction:column;gap:9px;font-size:12.5px;color:#3a3c37;line-height:1.5;margin-bottom:2px}",
      ".ichart-modal .ichart-supp-codes>div{display:grid;grid-template-columns:36px 1fr;gap:11px;align-items:start}",
      ".ichart-modal .ichart-supp-codes>div>span{font-family:'Archivo','Public Sans',sans-serif;font-weight:700;font-size:12px;text-align:center;padding:3px 0;border-radius:6px}",
      ".ichart-modal .ichart-supp-codes .c8{background:#eef4ee;color:#2f6b45}",
      ".ichart-modal .ichart-supp-codes .c9{background:#f7efe6;color:#a8501f}",
      ".ichart-modal .ichart-supp-codes .cdash,.ichart-modal .ichart-supp-codes .cna{background:#f1f0e9;color:#6a6c65}",
      ".ichart-modal .ichart-supp-ctx p{font-size:12.5px;color:#3a3c37;line-height:1.55;margin:0 0 8px;background:#f6f5ef;border:1px solid #e8e6dc;border-radius:8px;padding:9px 11px}",
      ".ichart-modal .ichart-supp-cols{display:flex;flex-direction:column;gap:9px;font-size:12px;color:#5c5f5a;line-height:1.45}",
      ".ichart-modal .ichart-supp-cols>div>b{color:#1a1c1a}",
      ".ichart-modal .ichart-supp-cols>div>span{color:#9a9b93;font-size:11px;margin-left:6px}",
      ".ichart-modal .ichart-supp-cols>div>div{margin-top:2px}",
      "@media (prefers-reduced-motion:reduce){.ichart-ov,.ichart-modal,.ichart-track span,[data-ica]{animation:none!important;transition:none!important;clip-path:none!important}}"
    ].join('');
    document.head.appendChild(s);
  }

  function tipEl() {
    if (TIP) return TIP;
    if (typeof document === 'undefined' || !document.body) return null;
    ensureStyle();
    TIP = document.createElement('div');
    TIP.className = 'ichart-tip';
    TIP.setAttribute('role', 'tooltip');
    document.body.appendChild(TIP);
    return TIP;
  }
  function showTip(x, y, html) {
    var t = tipEl(); if (!t) return;
    t.innerHTML = html;
    t.style.display = 'block';
    t.style.opacity = '1';
    var r = t.getBoundingClientRect(), pad = 15, vw = window.innerWidth, vh = window.innerHeight;
    var left = x + pad, top = y + pad;
    if (left + r.width + 8 > vw) left = x - r.width - pad;
    if (left < 6) left = 6;
    if (top + r.height + 8 > vh) top = y - r.height - pad;
    if (top < 6) top = 6;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }
  function hideTip() { if (TIP) { TIP.style.opacity = '0'; TIP.style.display = 'none'; } }
  function tipRow(color, label, val) {
    return '<div class="ichart-tr"><span class="ichart-sw" style="background:' + color + '"></span><span class="ichart-lb">' + esc(label) + '</span><span class="ichart-vl">' + esc(val) + '</span></div>';
  }

  function svgEl(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  // publication-style "nice" axis ticks: land on 1/2/2.5/5 steps instead of raw data quarters
  function niceTicks(mn, mx, count) {
    if (mn === mx) mx = mn + 1;
    var span = mx - mn, step0 = span / Math.max(1, count);
    var mag = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)), norm = step0 / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var lo = Math.floor(mn / step) * step, hi = Math.ceil(mx / step) * step;
    var tk = []; for (var v = lo; v <= hi + step * 1e-6; v += step) tk.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { lo: lo, hi: hi, ticks: tk };
  }
  var TICK_FONT = "Archivo,'Public Sans',sans-serif";
  var RM_A = !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Entrance-animation style helper. Keyframes-only (no inline start state), so a serialized
  // SVG clone (PNG export) renders at its final static state — the keyframes are not copied
  // into the clone, which leaves the inline `animation` property inert there.
  function ist(name, dur, delay, extra) {
    var o = {}; if (extra) { for (var k in extra) o[k] = extra[k]; }
    if (!RM_A) { ensureStyle(); o.animation = name + ' ' + (dur || 600) + 'ms cubic-bezier(.22,.61,.36,1) ' + (delay || 0) + 'ms both'; }
    return o;
  }
  function fxg(node) { var svg = node && node.ownerSVGElement; return svg ? svg.querySelector('[data-fx]') : null; }
  function barNode(node, i) { var svg = node && node.ownerSVGElement; return svg ? svg.querySelector('[data-bar="' + i + '"]') : null; }

  /* ---- district (LEA) popup ---- */
  function barHTML(label, valText, w, color) {
    return '<div class="ichart-m"><div class="ichart-ml"><span>' + esc(label) + '</span><b>' + esc(valText) + '</b></div>' +
      '<div class="ichart-track"><span style="width:' + Math.max(1.5, Math.min(100, w)) + '%;background:' + color + '"></span></div></div>';
  }
  // publication-style static SVG bars for popup content (string output, matches hbars styling)
  function svgBarsHTML(rows, o) {
    o = o || {};
    var w = o.w || 470, lw = o.labelW || 168, rowH = o.rowH || 21, gap = o.gap || 7;
    var bx = lw + 10, valW = o.valW || 86, bw = w - bx - valW;
    var mx = o.max != null ? o.max : (Math.max.apply(null, rows.map(function (r) { return r.value || 0; })) || 1);
    var ht = rows.length * (rowH + gap) + 6;
    var s = '<svg viewBox="0 0 ' + w + ' ' + ht + '" width="100%" style="display:block;overflow:visible" role="img"' + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : '') + '>';
    s += '<line x1="' + bx + '" x2="' + bx + '" y1="2" y2="' + (ht - 4) + '" stroke="#b9bbb2" stroke-width="1"/>';
    rows.forEach(function (r, i) {
      var y = i * (rowH + gap) + 3, bwv = Math.max(0, Math.min(1, (r.value || 0) / mx) * bw);
      if (o.track) s += '<rect x="' + bx + '" y="' + (y + 2) + '" width="' + bw + '" height="' + (rowH - 4) + '" rx="2" fill="#f1f0e9"/>';
      s += '<text x="' + lw + '" y="' + (y + rowH / 2 + 3.5) + '" text-anchor="end" font-size="10.5" fill="' + (r.strong ? '#1a1c1a' : '#5c5f5a') + '" font-weight="' + (r.strong ? 700 : 500) + '" font-family="&quot;Public Sans&quot;,sans-serif">' + esc(r.label) + '</text>';
      s += '<rect x="' + bx + '" y="' + (y + 2) + '" width="' + Math.max(r.value ? 2 : 0, bwv).toFixed(1) + '" height="' + (rowH - 4) + '" rx="2" fill="' + (r.color || PAL.green) + '"/>';
      s += '<text x="' + (bx + bwv + 6).toFixed(1) + '" y="' + (y + rowH / 2 + 3.5) + '" font-size="10.5" font-weight="700" fill="#1a1c1a" font-family="Archivo,&quot;Public Sans&quot;,sans-serif" style="font-variant-numeric:tabular-nums">' + esc(r.text != null ? r.text : num(r.value)) + '</text>';
      if (r.mark != null) {
        var mxp = bx + Math.min(1, r.mark / mx) * bw;
        s += '<line x1="' + mxp.toFixed(1) + '" x2="' + mxp.toFixed(1) + '" y1="' + (y - 1) + '" y2="' + (y + rowH + 1) + '" stroke="' + PAL.navy + '" stroke-width="1.4" stroke-dasharray="3 2.4"/>';
      }
    });
    s += '</svg>';
    return s;
  }
  function escapeCloseKey(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    if (!MODAL) return;
    var m = MODAL; MODAL = null;
    document.removeEventListener('keydown', escapeCloseKey);
    m.classList.add('closing');
    setTimeout(function () { if (m && m.parentNode) m.parentNode.removeChild(m); }, 170);
  }
  // Generic modal: pass inner HTML (no close button needed; one is added). Returns the
  // .ichart-modal element so callers can render a chart into it after opening.
  function openModal(html, ariaLabel) {
    if (typeof document === 'undefined' || !document.body) return null;
    ensureStyle();
    if (MODAL) closeModal();
    var ov = document.createElement('div');
    ov.className = 'ichart-ov';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    if (ariaLabel) ov.setAttribute('aria-label', ariaLabel);
    ov.innerHTML = '<div class="ichart-modal" tabindex="-1"><button class="ichart-x" data-close aria-label="Close">×</button>' + html + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov || (e.target.closest && e.target.closest('[data-close]'))) closeModal(); });
    document.body.appendChild(ov);
    MODAL = ov;
    document.addEventListener('keydown', escapeCloseKey);
    var mc = ov.querySelector('.ichart-modal'); if (mc) mc.focus();
    return mc;
  }

  /* ---- export: CSV, PNG, and a small PNG/CSV chooser popover ---- */
  function exportCSV(name, rows, opts) {
    if (!rows || !rows.length || typeof document === 'undefined') return;
    opts = opts || {};
    // prepend a professional title row and a source row so the exported CSV is self-documenting
    var out = [];
    if (opts.title) out.push([opts.title]);
    if (opts.source) out.push(['Source: ' + opts.source]);
    if (out.length) out.push([]);
    out = out.concat(rows);
    var csv = out.map(function (r) { return r.map(function (c) { c = c == null ? '' : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = name.replace(/\.csv$/, '') + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }
  function exportPNG(svg, name, opts) {
    opts = opts || {}; if (!svg || typeof document === 'undefined') return;
    var vb = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
    var W = vb[2] || svg.clientWidth || 720, H = vb[3] || svg.clientHeight || 360, sc = 2, top = opts.title ? 44 : 12, bot = 30;
    var clone = svg.cloneNode(true); clone.setAttribute('width', W); clone.setAttribute('height', H);
    // the rasterized SVG has no parent element, so 'inherit' fonts fall back to serif; pin a clean sans stack
    clone.style.fontFamily = "Archivo,'Public Sans','Helvetica Neue',Arial,sans-serif";
    var xml = new XMLSerializer().serializeToString(clone);
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = W * sc; cv.height = (H + top + bot) * sc;
      var ctx = cv.getContext('2d'); ctx.scale(sc, sc);
      ctx.fillStyle = '#fbfbf9'; ctx.fillRect(0, 0, W, H + top + bot);
      if (opts.title) { ctx.fillStyle = '#1a1c1a'; ctx.font = "700 16px Archivo, 'Public Sans', system-ui, sans-serif"; ctx.fillText(opts.title.length > 88 ? opts.title.slice(0, 86) + '…' : opts.title, 14, 28); }
      ctx.drawImage(img, 0, top, W, H);
      // a source line is always drawn; exported figures must carry their attribution
      ctx.fillStyle = '#9a9b93'; ctx.font = "11px Archivo, 'Public Sans', system-ui, sans-serif";
      var s = 'Source: ' + (opts.source || 'U.S. Department of Education, OSEP, IDEA Section 618 data collections.');
      ctx.fillText(s.length > 130 ? s.slice(0, 128) + '…' : s, 14, H + top + 19);
      cv.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name.replace(/\.png$/, '') + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500); });
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  }
  // opts: {name, title, source, svg: node|fn->node, csv: rows|fn->rows}
  function exportMenu(anchorEl, opts) {
    if (typeof document === 'undefined') return;
    ensureStyle();
    var existing = document.querySelector('.ichart-exmenu'); if (existing) existing.remove();
    var m = document.createElement('div'); m.className = 'ichart-exmenu';
    m.innerHTML = (opts.noPng ? '' : '<button data-x="png"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>PNG image</button>')
      + '<button data-x="csv"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v5h5M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-5-5z"/><path d="M8 13h8M8 17h5"/></svg>CSV data</button>';
    document.body.appendChild(m);
    var r = anchorEl.getBoundingClientRect();
    var left = Math.min(r.left, window.innerWidth - m.offsetWidth - 8); if (left < 6) left = 6;
    var top = r.bottom + 6; if (top + m.offsetHeight + 6 > window.innerHeight) top = r.top - m.offsetHeight - 6;
    m.style.top = top + 'px'; m.style.left = left + 'px';
    function close() { if (m.parentNode) m.remove(); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', onKey, true); }
    function outside(e) { if (!m.contains(e.target) && e.target !== anchorEl) close(); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    setTimeout(function () { document.addEventListener('click', outside, true); document.addEventListener('keydown', onKey, true); }, 0);
    m.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; var x = b.getAttribute('data-x'); close();
      if (x === 'png') { var svg = typeof opts.svg === 'function' ? opts.svg() : opts.svg; exportPNG(svg, opts.name, { title: opts.title, source: opts.source }); }
      else { var rows = typeof opts.csv === 'function' ? opts.csv() : opts.csv; exportCSV(opts.name, rows, { title: opts.title, source: opts.source }); }
    });
  }
  // row = {name, nces, total, schoolAge, autism}; abbr = state postal code
  function leaModal(row, abbr) {
    if (!row || typeof document === 'undefined' || !document.body) return;
    ensureStyle();
    if (MODAL) closeModal();
    var prof = (window.IDERIVE && window.IDERIVE.profile) ? window.IDERIVE.profile(abbr) : null;
    var stateName = prof ? prof.name : (abbr || '');
    var stateServed = prof ? prof.served2024 : null;
    var drows = prof ? prof.districts.rows.slice() : [];
    drows.sort(function (a, b) { return (b.total || 0) - (a.total || 0); });
    var rank = 0; for (var i = 0; i < drows.length; i++) { if (drows[i].nces === row.nces) { rank = i + 1; break; } }
    var shareState = (stateServed && row.total) ? row.total / stateServed * 100 : null;
    var autPct = (row.total && row.autism != null) ? row.autism / row.total * 100 : null;
    var saPct = (row.total && row.schoolAge != null) ? row.schoolAge / row.total * 100 : null;

    var ex = null, stEx = prof ? prof.exiting : null;
    var nkey = String(row.nces).replace(/^0+/, '');
    var E = window.LEAEXIT && window.LEAEXIT.byNces;
    if (E) { var e = E[nkey]; if (e && e[2] != null) ex = { grad: e[0], drop: e[1], base: e[2] }; }

    // per-district suppression, straight from the source files (code 8 = small cell size, 9 = data-quality concern)
    var SUP = window.ISUPP, suppLines = [];
    var codeWord = function (c) { return c === 9 ? 'a data-quality concern' : 'small cell size'; };
    var listJoin = function (a) { return a.length <= 1 ? (a[0] || '') : a.length === 2 ? a[0] + ' and ' + a[1] : a.slice(0, -1).join(', ') + ', and ' + a[a.length - 1]; };
    if (SUP) {
      var cf = SUP.childcount && SUP.childcount.lea && SUP.childcount.lea[nkey];
      if (cf) {
        var cp = [];
        if (cf.t) cp.push('the total served (' + codeWord(cf.t) + ')');
        if (cf.s) cp.push('the school-age count (' + codeWord(cf.s) + ')');
        if (cf.a) cp.push('the autism count (' + codeWord(cf.a) + ')');
        if (cp.length) suppLines.push('In the 2024–25 child count, ' + listJoin(cp) + ' ' + (cp.length > 1 ? 'were' : 'was') + ' suppressed for this district.');
      }
      var ef = SUP.exiting && SUP.exiting.lea && SUP.exiting.lea[nkey];
      if (ef) {
        var ep = [];
        if (ef.g) ep.push('the graduate count (' + codeWord(ef.g) + ')');
        if (ef.d) ep.push('the dropout count (' + codeWord(ef.d) + ')');
        if (ep.length) suppLines.push('In 2023–24 exiting, ' + listJoin(ep) + ' ' + (ep.length > 1 ? 'were' : 'was') + ' suppressed.');
      }
    }

    // all-disabilities breakdown for this district (from the source category file). 40% rule:
    // if 40% or more of the categories are suppressed, the breakdown is unreliable, so show N/A.
    var catHtml = '', heavySupp = false;
    var CAT = window.ILEACAT;
    if (CAT && CAT.byNces && CAT.byNces[nkey]) {
      var carr = CAT.byNces[nkey], cnames = CAT.cats;
      var csupp = 0; for (var ci = 0; ci < carr.length; ci++) { if (carr[ci] == null) csupp++; }
      var known = []; carr.forEach(function (v, i) { if (v != null && v > 0) known.push({ k: cnames[i], v: v }); });
      catHtml += '<div class="ichart-secttl" style="margin-top:18px">Students served by disability category, 2024–25</div>';
      // 40% rule (LEA level): if 40%+ of a district's categories are suppressed, its total is too incomplete to trust,
      // so its category breakdown AND any derived rate (graduation, dropout) are shown as N/A.
      if (csupp / cnames.length >= 0.40) {
        heavySupp = true;
        catHtml += '<div style="font-size:12.5px;color:#6a6c65;background:#f6f5ef;border:1px solid #e8e6dc;border-radius:8px;padding:9px 11px;line-height:1.5"><b>N/A.</b> ' + csupp + ' of ' + cnames.length + ' categories were suppressed for this district (small counts), so a reliable breakdown is not shown.</div>';
      } else if (known.length) {
        known.sort(function (a, b) { return b.v - a.v; });
        var catRows = known.slice(0, 8).map(function (d, i) {
          return { label: d.k, value: d.v, text: num(d.v) + (row.total ? ' · ' + (d.v / row.total * 100).toFixed(0) + '%' : ''), color: i === 0 ? PAL.greenD : lerp(PAL.green, '#ffffff', Math.min(0.5, (i - 1) * 0.085)), strong: i === 0 };
        });
        catHtml += svgBarsHTML(catRows, { aria: 'Students served by disability category in this district, 2024–25' });
        if (csupp) catHtml += '<div style="font-size:11px;color:#9a9b93;margin-top:2px">' + csupp + ' of ' + cnames.length + ' categories suppressed for a small count and not shown.</div>';
      } else {
        catHtml += '<div style="font-size:12px;color:#9a9b93">No category counts were published for this district.</div>';
      }
    }

    var html = '';
    html += '<div class="ichart-kick">School district · ' + esc(stateName) + '</div>';
    html += '<h2 class="ichart-title">' + esc(row.name) + '</h2>';
    var id7 = String(row.nces).replace(/\D/g, ''); while (id7.length < 7) id7 = '0' + id7;
    html += '<div class="ichart-sub">NCES LEA ID <a href="https://nces.ed.gov/ccd/districtsearch/district_detail.asp?ID2=' + id7 + '" target="_blank" rel="noopener" title="Open this district in the NCES district locator" style="color:#2f8f57;text-decoration:none;border-bottom:1px solid #b7d3bf;font-weight:600">' + esc(id7) + ' ↗</a>' + (rank ? '  ·  ranked ' + rank + ' of ' + drows.length + ' reporting districts by students served' : '') + '</div>';
    html += '<div style="font-size:11px;color:#9a9b93;margin:-9px 0 15px;line-height:1.5">The ID is a link: it opens this district’s record in the NCES Common Core of Data (CCD) District Locator, where you can look up enrollment, staffing, locale, and contact detail.</div>';

    var fund = (window.MOE && window.MOE.byNces && window.MOE.byNces[nkey] != null) ? window.MOE.byNces[nkey] : null;
    var fundPer = (fund != null && row.total) ? fund / row.total : null;
    // In states that route IDEA funds through an intermediate or regional agency (Michigan ISDs,
    // Iowa AEAs), the allocation sits on the agency while the children are counted under member
    // districts, so a per-student figure for the agency row is not meaningful.
    var fundAgency = (fundPer != null && fundPer > 12000);
    html += '<div class="ichart-kpis" style="grid-template-columns:' + (fund != null ? 'repeat(3,1fr)' : '1fr 1fr') + '">';
    html += '<div class="ichart-kpi"><div class="k">Students served</div><div class="v">' + num(row.total) + '</div><div class="n">ages 3–21, 2024–25</div></div>';
    html += '<div class="ichart-kpi"><div class="k">School-age</div><div class="v">' + (row.schoolAge == null ? '–' : num(row.schoolAge)) + '</div><div class="n">' + (saPct == null ? 'not reported' : saPct.toFixed(0) + '% of served') + '</div></div>';
    if (fund != null) html += '<div class="ichart-kpi"><div class="k">Federal IDEA funds</div><div class="v">' + money(fund) + '</div><div class="n">' + (fundAgency ? 'Part B 611+619 · 2021–22 · allocated for member districts' : (fundPer != null ? '$' + Math.round(fundPer).toLocaleString('en-US') + '/student · 2021–22' : 'Part B 611+619 · 2021–22')) + '</div></div>';
    html += '</div>';
    html += catHtml;

    if (shareState != null) {
      html += '<div class="ichart-secttl">Share of ' + esc(stateName) + '’s students served</div>';
      html += svgBarsHTML([{ label: 'Of ' + stateName + ' total', value: shareState, text: shareState.toFixed(1) + '%', color: PAL.greenD, strong: true }], { max: 100, track: true, aria: row.name + ' as a share of ' + stateName + ' students served' });
    }

    if (ex) {
      html += '<div class="ichart-secttl" style="margin-top:18px">How students exited school, 2023–24</div>';
      if (heavySupp) {
        html += '<div style="font-size:12.5px;color:#6a6c65;background:#f6f5ef;border:1px solid #e8e6dc;border-radius:8px;padding:9px 11px;line-height:1.5"><b>N/A.</b> 40% or more of this district’s disability categories were suppressed for small counts, so its totals are too incomplete to report a reliable graduation or dropout rate.</div>';
      } else {
        html += svgBarsHTML([
          { label: 'Graduated with a diploma', value: ex.grad || 0, text: ex.grad == null ? 'suppressed' : ex.grad.toFixed(1) + '%', color: PAL.green, strong: true, mark: (stEx && stEx.gradPct != null) ? stEx.gradPct : null },
          { label: 'Dropped out', value: ex.drop || 0, text: ex.drop == null ? 'suppressed' : ex.drop.toFixed(1) + '%', color: PAL.accent, mark: (stEx && stEx.dropPct != null) ? stEx.dropPct : null }
        ], { max: 100, track: true, aria: 'How students exited this district, 2023-24' });
        if (stEx && (stEx.gradPct != null || stEx.dropPct != null)) html += '<div style="font-size:10.5px;color:#9a9b93;margin:2px 0 0">Dashed mark: the statewide rate.</div>';
        if (stEx) {
          var sg = stEx.gradPct != null ? stEx.gradPct.toFixed(0) + '% graduated' : 'graduation N/A';
          var sd = stEx.dropPct != null ? stEx.dropPct.toFixed(0) + '% dropped out' : 'dropout N/A';
          var naTail = (stEx.gradNA || stEx.dropNA) ? ' N/A means the state did not report a usable count in the SEA Exiting Collection.' : '';
          html += '<div style="font-size:11.5px;color:#6a6c65;margin:-2px 0 2px">Statewide (SEA total): ' + sg + ', ' + sd + '.' + naTail + '</div>';
        }
      }
    }

    if (suppLines.length) html += '<div style="font-size:11.5px;color:#6a6c65;background:#f6f5ef;border:1px solid #e8e6dc;border-radius:8px;padding:8px 10px;margin-top:14px;line-height:1.5">' + suppLines.join(' ') + '</div>';

    html += '<div style="margin-top:14px"><button type="button" class="ichart-supp" data-supp aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>Suppression notes</button></div>';

    html += '<div class="ichart-foot"><b style="color:#6a6c65">Source</b> U.S. Department of Education, OSEP: IDEA Part B Child Count &amp; Educational Environments (2024–25)' + (ex ? '; IDEA Part B Exiting, LEA collection (2023–24)' : '') + (fund != null ? '; MOE/CEIS funding, district (2021–22)' : '') + '. A dash means a count was not separately reported; a suppressed count was withheld to protect a small number of students (small cell size, code -8) or flagged for a data-quality concern (code -9). District figures may not sum to the state total.</div>';

    var _mc = openModal(html, row.name + ' district detail');
    if (_mc) { var _sb = _mc.querySelector('[data-supp]'); if (_sb) _sb.addEventListener('click', function () { suppressionModal({ scope: 'district', nces: row.nces, name: row.name }); }); }
    return _mc;
  }

  // ---- reusable "how suppression works" popup (district / state / national scope) ----
  function suppContext(opts, S) {
    opts = opts || {};
    if (opts.scope === 'district' && opts.nces != null) {
      var nk = String(opts.nces).replace(/^0+/, '');
      var cf = S.childcount && S.childcount.lea && S.childcount.lea[nk];
      var ef = S.exiting && S.exiting.lea && S.exiting.lea[nk];
      var w = function (c) { return c === 9 ? 'a data-quality concern (code -9)' : 'small cell size (code -8)'; };
      var lines = [];
      if (cf) { var p = []; if (cf.t) p.push('the total served (' + w(cf.t) + ')'); if (cf.s) p.push('the school-age count (' + w(cf.s) + ')'); if (cf.a) p.push('the autism count (' + w(cf.a) + ')'); if (p.length) lines.push('In the IDEA Part B Child Count &amp; Educational Environments Collection (LEA file), 2024–25, ' + listJoin(p) + ' ' + (p.length > 1 ? 'were' : 'was') + ' suppressed for this district.'); }
      if (ef) { var q = []; if (ef.g) q.push('the graduate count (' + w(ef.g) + ')'); if (ef.d) q.push('the dropout count (' + w(ef.d) + ')'); if (q.length) lines.push('In the IDEA Part B Exiting Collection (LEA file), 2023–24, ' + listJoin(q) + ' ' + (q.length > 1 ? 'were' : 'was') + ' suppressed.'); }
      if (!lines.length) lines.push('No counts were suppressed for this district in the child-count or exiting files.');
      return '<div class="ichart-secttl" style="margin-top:18px">' + esc(opts.name || 'This district') + '</div><div class="ichart-supp-ctx">' + lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>';
    }
    if (opts.scope === 'state' && opts.abbr) {
      var cc = S.childcount && S.childcount.states && S.childcount.states[opts.abbr];
      var ex = S.exiting && S.exiting.states && S.exiting.states[opts.abbr];
      var out = [];
      if (cc) { var tot = (cc.t[0] || 0) + (cc.t[1] || 0), sa = (cc.sa[0] || 0) + (cc.sa[1] || 0), au = (cc.au[0] || 0) + (cc.au[1] || 0);
        out.push('In the IDEA Part B Child Count &amp; Educational Environments Collection (LEA file), 2024–25: of ' + cc.n + ' reporting districts, ' + (tot || 'none') + ' had the total served withheld' + (tot ? ' (' + cc.t[0] + ' for small cell size, ' + cc.t[1] + ' for data quality)' : '') + ', ' + (sa || 'none') + ' the school-age count, and ' + (au || 'none') + ' the autism count. This state’s own total comes from the state-level (SEA) file, which is not subject to district cell suppression.'); }
      if (ex) { if (ex.gNA || ex.dNA) out.push('Districts serving 40% or more of the state’s exiters suppressed a count, so ' + (ex.gNA ? 'the graduation rate' : '') + (ex.gNA && ex.dNA ? ' and ' : '') + (ex.dNA ? 'the dropout rate' : '') + ' ' + ((ex.gNA && ex.dNA) ? 'are' : 'is') + ' shown as N/A.');
        else out.push('Graduation and dropout rates are aggregated only from districts that reported them; a district with a suppressed count is left out of the rate.'); }
      if (!out.length) return '';
      return '<div class="ichart-secttl" style="margin-top:18px">' + esc(opts.name || opts.abbr) + '</div><div class="ichart-supp-ctx">' + out.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>';
    }
    var st = S.childcount && S.childcount.states;
    if (st) { var d8 = 0, d9 = 0, ns = 0; for (var k in st) { d8 += st[k].t[0] || 0; d9 += st[k].t[1] || 0; ns++; }
      return '<div class="ichart-secttl" style="margin-top:18px">Nationally · IDEA Part B Child Count &amp; Educational Environments, LEA file · 2024–25</div><div class="ichart-supp-ctx"><p>In the IDEA Part B Child Count &amp; Educational Environments Collection, district (LEA) file, 2024–25: across the ' + ns + ' jurisdictions with district-level data (the 50 states and the District of Columbia), about ' + d8 + ' districts had the total served count withheld for small cell size (code -8) and about ' + d9 + ' for a data-quality concern (code -9). A suppressed district is never counted as zero. The state and national totals shown elsewhere are taken from the state-level (SEA) files, which include the additional reporting entities and carry many cells that are suppressed in the district files.</p></div>';
    }
    return '';
  }
  // opts: {scope:'national'|'state'|'district', abbr, nces, name}. Stacks above any open modal.
  function suppressionModal(opts) {
    if (typeof document === 'undefined' || !document.body) return null;
    ensureStyle();
    var S = window.ISUPP || {};
    var html = '';
    html += '<div class="ichart-kick">Data note</div>';
    html += '<h2 class="ichart-title">How suppression works here</h2>';
    html += '<div class="ichart-sub">Why some figures read as a dash, “suppressed,” or “N/A”</div>';
    html += '<div class="ichart-secttl" style="margin-top:4px">What the markers mean</div>';
    html += '<div class="ichart-supp-codes">';
    html += '<div><span class="c8">-8</span><div><b>Small cell size.</b> The count was withheld to protect a small number of students. It does not mean zero.</div></div>';
    html += '<div><span class="c9">-9</span><div><b>Data-quality concern.</b> The state flagged the figure as not reliable enough to publish.</div></div>';
    html += '<div><span class="c9">*</span><div><b>Data-quality concern</b> in the state-level files (the same idea as -9).</div></div>';
    html += '<div><span class="cdash">–</span><div><b>Not reported.</b> This cell was not separately reported.</div></div>';
    html += '<div><span class="cna">N/A</span><div><b>Cannot be calculated.</b> Too much of the underlying data was suppressed. For exiting rates, that means districts serving 40% or more of a state’s exiters had the count suppressed.</div></div>';
    html += '</div>';
    var ctx = suppContext(opts, S); if (ctx) html += ctx;
    var col = S.collections;
    if (col) {
      html += '<div class="ichart-secttl" style="margin-top:18px">Coding by collection</div>';
      html += '<div class="ichart-supp-cols">';
      [['childCountLEA', 'Child count, district'], ['exitingLEA', 'Exiting, district'], ['childCountEnv', 'Child count &amp; environments, state'], ['exitingState', 'Exiting, state'], ['discipline', 'Discipline'], ['assessment', 'Assessment'], ['personnel', 'Personnel'], ['partCChildCount', 'Part C child count'], ['partCExiting', 'Part C exiting'], ['maintenance', 'Funding (MOE / CEIS)']].forEach(function (o) {
        var c = col[o[0]]; if (!c) return;
        html += '<div><b>' + o[1] + '</b><span>' + esc((c.codes && c.codes.length ? c.codes.join(', ') : 'no privacy suppression') + ' · ' + c.year) + '</span><div>' + esc(c.note) + '</div></div>';
      });
      html += '</div>';
    }
    html += '<div class="ichart-foot"><b style="color:#6a6c65">Source</b> ' + esc((S.childcount && S.childcount.source) || 'U.S. Department of Education, OSEP: IDEA Section 618 data collections.') + ' Suppression codes are read directly from the public source files.</div>';
    // independent overlay so it stacks ABOVE an open district/state modal rather than replacing it
    var ov = document.createElement('div'); ov.className = 'ichart-ov'; ov.style.zIndex = 9000;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'How suppression works');
    ov.innerHTML = '<div class="ichart-modal" tabindex="-1"><button class="ichart-x" data-close aria-label="Close">×</button>' + html + '</div>';
    function close() { ov.classList.add('closing'); document.removeEventListener('keydown', onKey, true); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 170); }
    function onKey(e) { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } }
    ov.addEventListener('click', function (e) { if (e.target === ov || (e.target.closest && e.target.closest('[data-close]'))) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov);
    var mc = ov.querySelector('.ichart-modal'); if (mc) mc.focus();
    return mc;
  }
  // small "Suppression notes" trigger as a React element (for in-page chart cards)
  function suppButton(React, opts) {
    ensureStyle();
    return React.createElement('button', { type: 'button', className: 'ichart-supp', onClick: function () { suppressionModal(opts || {}); } },
      React.createElement('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('circle', { cx: 12, cy: 12, r: 9 }), React.createElement('path', { d: 'M12 8h.01M11 12h1v4h1' })),
      'Suppression notes');
  }
  // reusable "What does this mean?" popup for a chart/analysis. opts: {title, html, source}
  function explainModal(opts) {
    opts = opts || {};
    if (typeof document === 'undefined' || !document.body) return null;
    ensureStyle();
    var html = '<div class="ichart-kick">What this shows</div><h2 class="ichart-title">' + esc(opts.title || 'About this figure') + '</h2><div class="ichart-supp-ctx" style="margin-top:6px"><div>' + (opts.html || '') + '</div></div>';
    if (opts.source) html += '<div class="ichart-foot"><b style="color:#6a6c65">Source</b> ' + esc(opts.source) + '</div>';
    var ov = document.createElement('div'); ov.className = 'ichart-ov'; ov.style.zIndex = 9000;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'What this figure shows');
    ov.innerHTML = '<div class="ichart-modal" tabindex="-1"><button class="ichart-x" data-close aria-label="Close">×</button>' + html + '</div>';
    function close() { ov.classList.add('closing'); document.removeEventListener('keydown', onKey, true); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 170); }
    function onKey(e) { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } }
    ov.addEventListener('click', function (e) { if (e.target === ov || (e.target.closest && e.target.closest('[data-close]'))) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov);
    var mc = ov.querySelector('.ichart-modal'); if (mc) mc.focus();
    return mc;
  }
  // small "What does this mean?" trigger as a React element (for in-page chart cards)
  function explainButton(React, opts) {
    ensureStyle();
    return React.createElement('button', { type: 'button', className: 'ichart-supp', onClick: function () { explainModal(opts || {}); } },
      React.createElement('svg', { viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('circle', { cx: 12, cy: 12, r: 9 }), React.createElement('path', { d: 'M9.4 9a2.6 2.6 0 1 1 3.2 2.5c-.8.3-1.1.9-1.1 1.6v.4M12 17h.01' })),
      'What does this mean?');
  }

  /* ================= LINE / MULTILINE ================= */
  /* opts: {w,h, xLabels:[...], series:[{name,color,values:[...],dash,width}], yFmt, yMin, yMax, pad, dots, marks:[{x,label}]} */
  function line(React, o) {
    var w = o.w || 640, ht = o.h || 256, p = o.pad || { l: 46, r: 16, t: 14, b: 30 };
    var xs = o.xLabels, n = xs.length;
    var all = []; o.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    var yfmt = o.yFmt || compact;
    var ticks = o.yTicks || 4, mn, mx, tk;
    if (o.yMin != null && o.yMax != null) {
      mn = o.yMin; mx = o.yMax; if (mn === mx) mx = mn + 1;
      tk = []; for (var t = 0; t <= ticks; t++) tk.push(mn + (mx - mn) * t / ticks);
    } else {
      var ns = niceTicks(o.yMin != null ? o.yMin : Math.min.apply(null, all), o.yMax != null ? o.yMax : Math.max.apply(null, all), ticks);
      mn = o.yMin != null ? o.yMin : ns.lo; mx = o.yMax != null ? o.yMax : ns.hi;
      if (mn === mx) mx = mn + 1;
      tk = ns.ticks.filter(function (v) { return v >= mn - 1e-9 && v <= mx + 1e-9; });
    }
    var iw = w - p.l - p.r, ih = ht - p.t - p.b;
    var X = function (i) { return p.l + (n <= 1 ? 0 : i / (n - 1) * iw); };
    var Y = function (v) { return p.t + ih - (v - mn) / (mx - mn) * ih; };
    var kids = [];
    // area gradient (first series)
    var gid = 'ig' + (++GID);
    if (o.area && o.series[0]) {
      kids.push(h(React, 'defs', { key: 'def' }, h(React, 'linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 },
        h(React, 'stop', { offset: '0%', stopColor: o.series[0].color, stopOpacity: 0.22 }),
        h(React, 'stop', { offset: '100%', stopColor: o.series[0].color, stopOpacity: 0.02 }))));
    }
    // gridlines + y labels (zero baseline drawn darker, publication style)
    tk.forEach(function (v, i) {
      var zero = Math.abs(v) < 1e-9;
      kids.push(h(React, 'line', { key: 'g' + i, x1: p.l, x2: w - p.r, y1: Y(v), y2: Y(v), stroke: zero ? '#b9bbb2' : PAL.line, strokeWidth: 1 }));
      kids.push(h(React, 'text', { key: 'yl' + i, x: p.l - 8, y: Y(v) + 3.5, textAnchor: 'end', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, yfmt(v)));
    });
    // x labels (thin them if crowded; never let the forced last label collide with a regular one)
    var step = Math.ceil(n / (o.xEvery || 8));
    xs.forEach(function (lb, i) {
      var isLast = i === n - 1;
      if (!isLast && (i % step !== 0 || n - 1 - i < step)) return;
      kids.push(h(React, 'text', { key: 'xl' + i, x: X(i), y: ht - 8, textAnchor: isLast ? 'end' : 'middle', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT }, lb));
    });
    // reference marks (vertical)
    (o.marks || []).forEach(function (m, i) {
      kids.push(h(React, 'line', { key: 'm' + i, x1: X(m.x), x2: X(m.x), y1: p.t, y2: p.t + ih, stroke: PAL.faint, strokeWidth: 1, strokeDasharray: '3 3' }));
    });
    // series areas + lines
    o.series.forEach(function (s, si) {
      var pts = [], seg = [];
      s.values.forEach(function (v, i) { if (v == null) { if (seg.length) { pts.push(seg); seg = []; } } else seg.push([X(i), Y(v)]); });
      if (seg.length) pts.push(seg);
      pts.forEach(function (g, gi) {
        var d = g.map(function (pt, i) { return (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ');
        if (o.area && si === 0) {
          var ad = 'M' + g[0][0].toFixed(1) + ' ' + (p.t + ih) + ' ' + g.map(function (pt) { return 'L' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' ') + ' L' + g[g.length - 1][0].toFixed(1) + ' ' + (p.t + ih) + ' Z';
          kids.push(h(React, 'path', { key: 'a' + si + gi, d: ad, fill: 'url(#' + gid + ')', 'data-ica': '1', style: ist('icaFade', 900, 260) }));
        }
        kids.push(h(React, 'path', { key: 'p' + si + gi, d: d, fill: 'none', 'data-line': si, 'data-ica': '1', stroke: s.color, strokeOpacity: s.hide ? 0 : 1, strokeWidth: s.width || 2.4, strokeDasharray: s.dash || 'none', strokeLinejoin: 'round', strokeLinecap: 'round', style: ist('icaWipe', 900, 80 + si * 110, { transition: 'stroke-opacity .25s' }) }));
      });
      if (o.dots) g_dots(React, kids, s, si, X, Y);
    });
    // ---- interaction ----
    kids.push(h(React, 'g', { key: 'fx', 'data-fx': '1' }));
    if (n >= 1) {
      var bands = [];
      var mkBand = function (i) {
        var left = i === 0 ? p.l : (X(i - 1) + X(i)) / 2;
        var right = i === n - 1 ? (w - p.r) : (X(i) + X(i + 1)) / 2;
        var move = function (e) {
          var g = fxg(e.currentTarget);
          if (g) {
            while (g.firstChild) g.removeChild(g.firstChild);
            g.appendChild(svgEl('line', { x1: X(i), y1: p.t, x2: X(i), y2: p.t + ih, stroke: '#8c8e87', 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
            o.series.forEach(function (s) { if (s.values[i] != null) g.appendChild(svgEl('circle', { cx: X(i), cy: Y(s.values[i]), r: 4, fill: s.color, stroke: '#fff', 'stroke-width': 1.5 })); });
          }
          var rows = o.series.filter(function (s) { return s.values[i] != null; })
            .map(function (s) { return tipRow(s.color, s.name || 'Value', o.yFmt ? o.yFmt(s.values[i]) : num(s.values[i])); }).join('');
          showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(xs[i]) + '</div>' + rows);
        };
        return h(React, 'rect', { key: 'hb' + i, x: left, y: p.t, width: Math.max(0, right - left), height: ih, fill: 'transparent', style: { pointerEvents: 'all', cursor: o.onClickBand ? 'pointer' : 'crosshair' }, onMouseEnter: move, onMouseMove: move, onClick: o.onClickBand ? function () { o.onClickBand(i); } : undefined });
      };
      for (var bi = 0; bi < n; bi++) bands.push(mkBand(bi));
      kids.push(h(React, 'g', { key: 'bands', onMouseLeave: function (e) { var g = fxg(e.currentTarget); if (g) while (g.firstChild) g.removeChild(g.firstChild); hideTip(); } }, bands));
    }
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }
  function g_dots(React, kids, s, si, X, Y) {
    s.values.forEach(function (v, i) { if (v == null) return; kids.push(h(React, 'circle', { key: 'd' + si + '_' + i, 'data-ica': '1', cx: X(i), cy: Y(v), r: 2.8, fill: s.color, stroke: '#fff', strokeWidth: 1, style: ist('icaFade', 350, Math.min(500 + i * 22, 950)) })); });
  }

  /* ================= HORIZONTAL BARS ================= */
  /* opts: {w, rowH, rows:[{label,value,color,note,strong}], max, valFmt, labelW, mark:{value,label}} */
  function hbars(React, o) {
    var rows = o.rows, lw = o.labelW || 150, rowH = o.rowH || 26, gap = 8;
    var w = o.w || 620, bx = lw + 10, bw = w - bx - 64;
    var mx = o.max != null ? o.max : Math.max.apply(null, rows.map(function (r) { return r.value || 0; }));
    if (!mx) mx = 1;
    var ht = rows.length * (rowH + gap) + 8;
    var kids = [];
    // single baseline instead of full-length background tracks (tracks read as progress widgets)
    kids.push(h(React, 'line', { key: 'base', x1: bx, x2: bx, y1: 2, y2: ht - 6, stroke: '#b9bbb2', strokeWidth: 1 }));
    rows.forEach(function (r, i) {
      var y = i * (rowH + gap) + 4, bwv = (r.value || 0) / mx * bw;
      var inside = bwv > bw - 64;
      kids.push(h(React, 'text', { key: 'l' + i, x: lw, y: y + rowH / 2 + 3.5, textAnchor: 'end', fontSize: 11.5, fill: r.strong ? PAL.ink : PAL.muted, fontWeight: r.strong ? 700 : 500 }, r.label));
      kids.push(h(React, 'rect', { key: 'b' + i, 'data-bar': i, 'data-ica': '1', x: bx, y: y + 2, width: Math.max(0, bwv), height: rowH - 4, rx: 2, fill: r.color || PAL.green, style: ist('icaGrowX', 550, Math.min(i * 35, 600), { transition: 'fill .12s, width .45s cubic-bezier(.22,.61,.36,1)', transformBox: 'fill-box', transformOrigin: 'left center' }) }));
      kids.push(h(React, 'text', { key: 'v' + i, 'data-ica': '1', x: inside ? bx + bwv - 6 : bx + bwv + 6, y: y + rowH / 2 + 3.5, textAnchor: inside ? 'end' : 'start', fontSize: 11, fill: inside ? '#fff' : PAL.ink, fontWeight: 600, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums', style: ist('icaFade', 350, Math.min(i * 35, 600) + 280) }, o.valFmt ? o.valFmt(r.value) : num(r.value)));
    });
    if (o.mark != null) {
      var mxp = bx + o.mark.value / mx * bw;
      kids.push(h(React, 'line', { key: 'mk', x1: mxp, x2: mxp, y1: 0, y2: ht - 6, stroke: PAL.accent, strokeWidth: 1.5, strokeDasharray: '4 3' }));
      if (o.mark.label) kids.push(h(React, 'text', { key: 'mkl', x: mxp, y: 10, textAnchor: 'middle', fontSize: 9.5, fill: PAL.accent, fontWeight: 700 }, o.mark.label));
    }
    // ---- interaction: full-width hover row ----
    rows.forEach(function (r, i) {
      var y = i * (rowH + gap);
      var enter = function (e) {
        var b = barNode(e.currentTarget, i); if (b) b.style.fill = darken(r.color || PAL.green, 0.16);
        var note = r.note ? '<div class="ichart-note">' + esc(r.note) + '</div>' : '';
        showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(r.label) + '</div><div class="ichart-big">' + esc(o.valFmt ? o.valFmt(r.value) : num(r.value)) + '</div>' + note);
      };
      kids.push(h(React, 'rect', { key: 'hit' + i, x: 0, y: y, width: w, height: rowH + gap, fill: 'transparent', style: { pointerEvents: 'all', cursor: o.onClick ? 'pointer' : 'default' }, onMouseEnter: enter, onMouseMove: enter, onMouseLeave: function (e) { var b = barNode(e.currentTarget, i); if (b) b.style.fill = r.color || PAL.green; hideTip(); }, onClick: o.onClick ? function () { o.onClick(r, i); } : undefined }));
    });
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ================= STACKED COLUMNS (over years) ================= */
  /* opts: {w,h, xLabels, series:[{name,color,values}], yFmt, pct(bool)} */
  function stack(React, o) {
    var w = o.w || 640, ht = o.h || 256, p = { l: 44, r: 12, t: 12, b: 28 };
    var xs = o.xLabels, n = xs.length, iw = w - p.l - p.r, ih = ht - p.t - p.b;
    var totals = xs.map(function (_, i) { return o.series.reduce(function (s, se) { return s + (se.values[i] || 0); }, 0); });
    var mx = o.pct ? 100 : Math.max.apply(null, totals);
    var bw = iw / n * 0.66, off = iw / n;
    var Y = function (v) { return p.t + ih - v / mx * ih; };
    var kids = [];
    for (var t = 0; t <= 4; t++) { var v = mx * t / 4; kids.push(h(React, 'line', { key: 'g' + t, x1: p.l, x2: w - p.r, y1: Y(v), y2: Y(v), stroke: v === 0 ? '#b9bbb2' : PAL.line })); kids.push(h(React, 'text', { key: 'yl' + t, x: p.l - 7, y: Y(v) + 3.5, textAnchor: 'end', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, o.yFmt ? o.yFmt(v) : num(v))); }
    var step = Math.ceil(n / 10);
    xs.forEach(function (lb, i) {
      var isLast = i === n - 1;
      if (!isLast && (i % step !== 0 || n - 1 - i < step)) return;
      kids.push(h(React, 'text', { key: 'xl' + i, x: p.l + off * i + off / 2, y: ht - 8, textAnchor: 'middle', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT }, lb));
    });
    xs.forEach(function (_, i) {
      var acc = 0, x = p.l + off * i + (off - bw) / 2, tot = o.pct ? (totals[i] || 1) : 1;
      o.series.forEach(function (se, si) {
        var raw = se.values[i] || 0, val = o.pct ? raw / tot * 100 : raw;
        var y0 = Y(acc), y1 = Y(acc + val);
        kids.push(h(React, 'rect', { key: 'r' + i + '_' + si, x: x, y: y1, width: bw, height: Math.max(0, y0 - y1), fill: se.color }));
        acc += val;
      });
    });
    // ---- interaction ----
    xs.forEach(function (_, i) {
      var enter = function (e) {
        var html = '<div class="ichart-hd">' + esc(xs[i]) + '</div>';
        o.series.forEach(function (se) { var raw = se.values[i] || 0; var extra = o.pct && totals[i] ? '  ' + (raw / totals[i] * 100).toFixed(0) + '%' : ''; html += tipRow(se.color, se.name || '', num(raw) + extra); });
        showTip(e.clientX, e.clientY, html);
      };
      kids.push(h(React, 'rect', { key: 'hit' + i, x: p.l + off * i, y: p.t, width: off, height: ih, fill: 'transparent', style: { pointerEvents: 'all', cursor: 'crosshair' }, onMouseEnter: enter, onMouseMove: enter, onMouseLeave: hideTip }));
    });
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ================= VERTICAL COLUMNS ================= */
  /* opts: {w,h, labels, values, color, colors, yFmt, xEvery, highlight, valueLabels} */
  function columns(React, o) {
    var w = o.w || 640, ht = o.h || 272, p = { l: 46, r: 12, t: 16, b: 34 };
    var labels = o.labels, vals = o.values, n = vals.length;
    var mx = o.yMax != null ? o.yMax : Math.max.apply(null, vals.filter(function (v) { return v != null; }));
    if (!mx) mx = 1;
    var iw = w - p.l - p.r, ih = ht - p.t - p.b, off = iw / n, bw = off * 0.66;
    var Y = function (v) { return p.t + ih - v / mx * ih; };
    var kids = [];
    for (var t = 0; t <= 4; t++) { var gv = mx * t / 4; kids.push(h(React, 'line', { key: 'g' + t, x1: p.l, x2: w - p.r, y1: Y(gv), y2: Y(gv), stroke: gv === 0 ? '#b9bbb2' : PAL.line })); kids.push(h(React, 'text', { key: 'yl' + t, x: p.l - 7, y: Y(gv) + 3.5, textAnchor: 'end', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, o.yFmt ? o.yFmt(gv) : num(gv))); }
    var step = o.xEvery || Math.ceil(n / 12);
    vals.forEach(function (v, i) {
      if (v == null) return;
      var x = p.l + off * i + (off - bw) / 2, y = Y(v);
      var fill = o.colors ? o.colors[i] : (o.highlight === i ? PAL.navy : (o.color || PAL.green));
      kids.push(h(React, 'rect', { key: 'b' + i, 'data-bar': i, 'data-ica': '1', x: x, y: y, width: bw, height: Math.max(0, p.t + ih - y), rx: 2, fill: fill, style: ist('icaGrowY', 550, Math.min(i * 25, 600), { transition: 'fill .12s, height .45s cubic-bezier(.22,.61,.36,1), y .45s cubic-bezier(.22,.61,.36,1)', transformBox: 'fill-box', transformOrigin: 'center bottom' }) }));
      if (o.valueLabels) kids.push(h(React, 'text', { key: 'v' + i, 'data-ica': '1', x: x + bw / 2, y: y - 4, textAnchor: 'middle', fontSize: 10.5, fill: PAL.muted, fontWeight: 600, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums', style: ist('icaFade', 350, Math.min(i * 25, 600) + 280) }, o.yFmt ? o.yFmt(v) : num(v)));
      if ((i % step === 0 && n - 1 - i >= step) || i === n - 1) kids.push(h(React, 'text', { key: 'x' + i, x: x + bw / 2, y: ht - 8, textAnchor: 'middle', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT }, labels[i]));
    });
    // ---- interaction ----
    vals.forEach(function (v, i) {
      if (v == null) return;
      var baseFill = o.colors ? o.colors[i] : (o.highlight === i ? PAL.navy : (o.color || PAL.green));
      var enter = function (e) {
        var b = barNode(e.currentTarget, i); if (b) b.style.fill = darken(baseFill, 0.16);
        showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(labels[i]) + '</div><div class="ichart-big">' + esc(o.yFmt ? o.yFmt(v) : num(v)) + '</div>');
      };
      kids.push(h(React, 'rect', { key: 'hit' + i, x: p.l + off * i, y: p.t, width: off, height: ih, fill: 'transparent', style: { pointerEvents: 'all', cursor: o.onClick ? 'pointer' : 'default' }, onMouseEnter: enter, onMouseMove: enter, onMouseLeave: function (e) { var b = barNode(e.currentTarget, i); if (b) b.style.fill = baseFill; hideTip(); }, onClick: o.onClick ? function () { o.onClick(labels[i], i, v); } : undefined }));
    });
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ================= STACKED AREA (over years) ================= */
  /* opts: {w,h, xLabels, series:[{name,color,values}], yFmt, pct} */
  function stackArea(React, o) {
    var w = o.w || 640, ht = o.h || 272, p = { l: 44, r: 12, t: 12, b: 28 };
    var xs = o.xLabels, n = xs.length, iw = w - p.l - p.r, ih = ht - p.t - p.b;
    var totals = xs.map(function (_, i) { return o.series.reduce(function (s, se) { return s + (se.values[i] || 0); }, 0); });
    var mx = o.pct ? 100 : Math.max.apply(null, totals);
    var X = function (i) { return p.l + (n <= 1 ? 0 : i / (n - 1) * iw); };
    var Y = function (v) { return p.t + ih - v / mx * ih; };
    var kids = [];
    for (var t = 0; t <= 4; t++) { var gv = mx * t / 4; kids.push(h(React, 'line', { key: 'g' + t, x1: p.l, x2: w - p.r, y1: Y(gv), y2: Y(gv), stroke: gv === 0 ? '#b9bbb2' : PAL.line })); kids.push(h(React, 'text', { key: 'yl' + t, x: p.l - 7, y: Y(gv) + 3.5, textAnchor: 'end', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, o.yFmt ? o.yFmt(gv) : num(gv))); }
    var acc = xs.map(function () { return 0; });
    o.series.forEach(function (se, si) {
      var lower = acc.slice();
      var upper = xs.map(function (_, i) { var raw = se.values[i] || 0; var v = o.pct ? raw / (totals[i] || 1) * 100 : raw; return lower[i] + v; });
      var d = 'M' + X(0) + ' ' + Y(lower[0]);
      for (var i = 0; i < n; i++) d += ' L' + X(i) + ' ' + Y(upper[i]);
      for (var j = n - 1; j >= 0; j--) d += ' L' + X(j) + ' ' + Y(lower[j]);
      d += ' Z';
      kids.push(h(React, 'path', { key: 'a' + si, d: d, fill: se.color, fillOpacity: 1, stroke: '#fbfbf9', strokeWidth: 1, 'data-ica': '1', style: ist('icaFade', 650, si * 110) }));
      acc = upper;
    });
    var step = Math.ceil(n / 8);
    xs.forEach(function (lb, i) { var isLast = i === n - 1; if (!isLast && (i % step !== 0 || n - 1 - i < step)) return; kids.push(h(React, 'text', { key: 'xl' + i, x: X(i), y: ht - 8, textAnchor: isLast ? 'end' : 'middle', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT }, lb)); });
    // ---- interaction ----
    kids.push(h(React, 'g', { key: 'fx', 'data-fx': '1' }));
    var mkBand = function (i) {
      var left = i === 0 ? p.l : (X(i - 1) + X(i)) / 2;
      var right = i === n - 1 ? (w - p.r) : (X(i) + X(i + 1)) / 2;
      var move = function (e) {
        var g = fxg(e.currentTarget);
        if (g) { while (g.firstChild) g.removeChild(g.firstChild); g.appendChild(svgEl('line', { x1: X(i), y1: p.t, x2: X(i), y2: p.t + ih, stroke: '#ffffff', 'stroke-width': 1, 'stroke-opacity': 0.7 })); }
        var html = '<div class="ichart-hd">' + esc(xs[i]) + '</div>';
        o.series.forEach(function (se) { var raw = se.values[i] || 0; var extra = o.pct && totals[i] ? '  ' + (raw / totals[i] * 100).toFixed(0) + '%' : ''; html += tipRow(se.color, se.name || '', num(raw) + extra); });
        showTip(e.clientX, e.clientY, html);
      };
      return h(React, 'rect', { key: 'hb' + i, x: left, y: p.t, width: Math.max(0, right - left), height: ih, fill: 'transparent', style: { pointerEvents: 'all', cursor: o.onClickBand ? 'pointer' : 'crosshair' }, onMouseEnter: move, onMouseMove: move, onClick: o.onClickBand ? function () { o.onClickBand(i); } : undefined });
    };
    var bands = []; for (var bi = 0; bi < n; bi++) bands.push(mkBand(bi));
    kids.push(h(React, 'g', { key: 'bands', onMouseLeave: function (e) { var g = fxg(e.currentTarget); if (g) while (g.firstChild) g.removeChild(g.firstChild); hideTip(); } }, bands));
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ================= DONUT ================= */
  /* opts: {size, thickness, segments:[{label,value,color}], center:{big,small}, valFmt}
     Tolerates being called as donut(React, o) OR donut(o) (React taken from window). */
  function donut(React, o) {
    if (o === undefined && React && React.segments) { o = React; React = window.React; }
    var sz = o.size || 180, r = sz / 2, th = o.thickness || 34, ir = r - th;
    var total = o.segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var vfmt = o.valFmt || num;
    var ang = -Math.PI / 2, kids = [];
    o.segments.forEach(function (s, i) {
      var a0 = ang, a1 = ang + s.value / total * Math.PI * 2; ang = a1;
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      var p0 = [r + r * Math.cos(a0), r + r * Math.sin(a0)], p1 = [r + r * Math.cos(a1), r + r * Math.sin(a1)];
      var q0 = [r + ir * Math.cos(a1), r + ir * Math.sin(a1)], q1 = [r + ir * Math.cos(a0), r + ir * Math.sin(a0)];
      var d = 'M' + p0[0] + ' ' + p0[1] + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p1[0] + ' ' + p1[1] + ' L' + q0[0] + ' ' + q0[1] + ' A' + ir + ' ' + ir + ' 0 ' + large + ' 0 ' + q1[0] + ' ' + q1[1] + ' Z';
      var share = (s.value / total * 100);
      var tip = function (e) { showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(s.label) + '</div><div class="ichart-big">' + esc(vfmt(s.value)) + '  ·  ' + share.toFixed(1) + '%</div>'); };
      kids.push(h(React, 'path', {
        key: 'seg' + i, d: d, fill: s.color, stroke: '#fbfbf9', strokeWidth: 1.5, 'data-ica': '1',
        style: ist('icaFade', 450, i * 70, { cursor: 'default', transition: 'fill .14s ease' }),
        onMouseEnter: function (e) { e.currentTarget.style.fill = darken(s.color, 0.12); tip(e); },
        onMouseMove: tip,
        onMouseLeave: function (e) { e.currentTarget.style.fill = s.color; hideTip(); }
      }));
    });
    if (o.center) {
      // auto-fit the big center label to the hole so long values (e.g. "$500.0M") never overflow
      var bigStr = String(o.center.big == null ? '' : o.center.big);
      var innerW = 2 * ir * 0.78;
      var bigFs = Math.max(sz * 0.1, Math.min(sz * 0.2, innerW / Math.max(1, bigStr.length * 0.62)));
      var hasSmall = !!o.center.small;
      kids.push(h(React, 'text', { key: 'cb', x: r, y: r + bigFs * 0.34 - (hasSmall ? sz * 0.05 : 0), textAnchor: 'middle', fontSize: bigFs, fontWeight: 700, fill: PAL.ink, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', style: { pointerEvents: 'none' } }, o.center.big));
      if (hasSmall) kids.push(h(React, 'text', { key: 'cs', x: r, y: r + bigFs * 0.34 - sz * 0.05 + sz * 0.115, textAnchor: 'middle', fontSize: sz * 0.062, fill: PAL.muted, fontFamily: 'inherit', style: { pointerEvents: 'none' } }, o.center.small));
    }
    return h(React, 'svg', { viewBox: '0 0 ' + sz + ' ' + sz, width: '100%', style: { display: 'block', width: '100%', maxWidth: sz + 'px', margin: '0 auto', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ================= US CHOROPLETH ================= */
  /* opts: {values:{ABBR:v}, selected, onHover, onClick, colorLo, colorHi, missing, format, max, min}
     If no onHover is supplied, a built-in shared tooltip is used automatically. */
  function map(React, o) {
    var M = window.USMAP; if (!M) return null;
    var vals = o.values || {}, arr = Object.keys(vals).map(function (k) { return vals[k]; }).filter(function (v) { return v != null; });
    var mn = o.min != null ? o.min : Math.min.apply(null, arr), mx = o.max != null ? o.max : Math.max.apply(null, arr);
    if (mn === mx) mx = mn + 1;
    var kids = [];
    Object.keys(M.paths).forEach(function (ab) {
      var v = vals[ab], has = v != null;
      var t = has ? (v - mn) / (mx - mn) : 0;
      var fill = has ? (o.colorFn ? o.colorFn(v) : ramp(t, o.colorLo, o.colorHi)) : (o.missing || '#eceae2');
      var sel = o.selected === ab;
      var builtinTip = function (e) {
        showTip(e.clientX, e.clientY, '<div class="ichart-hd">' + esc(M.names[ab]) + '</div>' + (has ? '<div class="ichart-big">' + esc(o.format ? o.format(v) : num(v)) + '</div>' : '<div class="ichart-note">No data</div>'));
      };
      kids.push(h(React, 'path', {
        key: ab, d: M.paths[ab], fill: fill,
        stroke: sel ? PAL.navy : '#fff', strokeWidth: sel ? 1.6 : 0.7,
        style: { cursor: o.onClick ? 'pointer' : 'default', transition: 'fill .2s, stroke .12s' },
        tabIndex: o.onClick ? 0 : undefined, role: o.onClick ? 'button' : undefined,
        'aria-label': M.names[ab] + (has ? ', ' + (o.format ? o.format(v) : num(v)) : ', no data'),
        onMouseEnter: function (e) {
          if (!sel) { e.currentTarget.style.stroke = PAL.greenD; e.currentTarget.style.strokeWidth = '1.2'; }
          if (o.onHover) o.onHover(ab, e); else builtinTip(e);
        },
        onMouseMove: function (e) { if (o.onHover) o.onHover(ab, e); else builtinTip(e); },
        onMouseLeave: function (e) { if (!sel) { e.currentTarget.style.stroke = '#fff'; e.currentTarget.style.strokeWidth = '0.7'; } if (o.onHover) o.onHover(null); else hideTip(); },
        onClick: o.onClick ? function () { o.onClick(ab); } : undefined,
        onKeyDown: o.onClick ? function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.onClick(ab); } } : undefined
      }));
    });
    return h(React, 'svg', { viewBox: M.viewBox, width: '100%', style: { display: 'block' }, role: 'img', 'aria-label': o.ariaLabel || 'US map' }, kids);
  }

  /* ================= SCATTER ================= */
  /* opts: {points:[{x,y,label,color,r,tip}], w,h,pad, xFmt,yFmt, xLabel,yLabel, logX,logY,
     xMin,xMax,yMin,yMax, r, dotOpacity, refY, refYLabel, onClick} */
  function scatter(React, o) {
    var w = o.w || 720, ht = o.h || 360, p = o.pad || { l: 58, r: 16, t: 14, b: 46 };
    var pts = o.points || [], logX = !!o.logX, logY = !!o.logY;
    var lg = function (v) { return Math.log(Math.max(v, 1e-6)) / Math.LN10; };
    var tx = function (v) { return logX ? lg(v) : v; }, ty = function (v) { return logY ? lg(v) : v; };
    var xsv = pts.map(function (d) { return tx(d.x); }), ysv = pts.map(function (d) { return ty(d.y); });
    var xmn = o.xMin != null ? tx(o.xMin) : Math.min.apply(null, xsv), xmx = o.xMax != null ? tx(o.xMax) : Math.max.apply(null, xsv);
    var ymn = o.yMin != null ? ty(o.yMin) : Math.min.apply(null, ysv), ymx = o.yMax != null ? ty(o.yMax) : Math.max.apply(null, ysv);
    if (xmn === xmx) xmx = xmn + 1; if (ymn === ymx) ymx = ymn + 1;
    var iw = w - p.l - p.r, ih = ht - p.t - p.b;
    var X = function (v) { return p.l + (tx(v) - xmn) / (xmx - xmn) * iw; };
    var Y = function (v) { return p.t + ih - (ty(v) - ymn) / (ymx - ymn) * ih; };
    var kids = [], t;
    for (t = 0; t <= 4; t++) {
      var gy = p.t + ih * t / 4; kids.push(h(React, 'line', { key: 'gy' + t, x1: p.l, x2: w - p.r, y1: gy, y2: gy, stroke: PAL.line }));
      var yv = logY ? Math.pow(10, ymx - (ymx - ymn) * t / 4) : (ymx - (ymx - ymn) * t / 4);
      kids.push(h(React, 'text', { key: 'ylt' + t, x: p.l - 8, y: gy + 3.5, textAnchor: 'end', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, o.yFmt ? o.yFmt(yv) : num(yv)));
      var xv = logX ? Math.pow(10, xmn + (xmx - xmn) * t / 4) : (xmn + (xmx - xmn) * t / 4);
      kids.push(h(React, 'text', { key: 'xlt' + t, x: p.l + iw * t / 4, y: ht - 24, textAnchor: 'middle', fontSize: 10.5, fill: PAL.faint, fontFamily: TICK_FONT, fontVariantNumeric: 'tabular-nums' }, o.xFmt ? o.xFmt(xv) : num(xv)));
    }
    if (o.refY != null) {
      kids.push(h(React, 'line', { key: 'refy', x1: p.l, x2: w - p.r, y1: Y(o.refY), y2: Y(o.refY), stroke: PAL.accent, strokeWidth: 1.4, strokeDasharray: '4 3' }));
      if (o.refYLabel) kids.push(h(React, 'text', { key: 'refyl', x: w - p.r, y: Y(o.refY) - 5, textAnchor: 'end', fontSize: 10, fontWeight: 700, fill: PAL.accent }, o.refYLabel));
    }
    pts.forEach(function (d, i) {
      var mk = function (e) { showTip(e.clientX, e.clientY, d.tip || ('<div class="ichart-hd">' + esc(d.label || '') + '</div>')); };
      kids.push(h(React, 'circle', { key: 'pt' + i, cx: X(d.x), cy: Y(d.y), r: d.r || o.r || 4, fill: d.color || PAL.green, fillOpacity: o.dotOpacity != null ? o.dotOpacity : 0.7, stroke: '#fff', strokeWidth: 0.8, style: { cursor: o.onClick ? 'pointer' : 'default' }, onMouseEnter: mk, onMouseMove: mk, onMouseLeave: hideTip, onClick: o.onClick ? function () { o.onClick(d); } : undefined }));
    });
    // optional fitted (regression) line: caller passes two endpoints in data coords, matching the axis transform
    if (o.fitLine && o.fitLine.length === 2) {
      var f0 = o.fitLine[0], f1 = o.fitLine[1];
      kids.push(h(React, 'line', { key: 'fit', x1: X(f0.x), y1: Y(f0.y), x2: X(f1.x), y2: Y(f1.y), stroke: o.fitColor || PAL.ink, strokeWidth: 2, strokeDasharray: o.fitDash || null, strokeOpacity: 0.9, style: { pointerEvents: 'none' } }));
    }
    if (o.xLabel) kids.push(h(React, 'text', { key: 'xt', x: p.l + iw / 2, y: ht - 4, textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: PAL.muted }, o.xLabel));
    if (o.yLabel) kids.push(h(React, 'text', { key: 'yt', x: 14, y: p.t + ih / 2, textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: PAL.muted, transform: 'rotate(-90 14 ' + (p.t + ih / 2) + ')' }, o.yLabel));
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: '100%', style: { display: 'block', width: '100%', maxWidth: w + 'px', margin: '0 auto', fontFamily: 'inherit', overflow: 'visible' }, role: 'img', 'aria-label': o.ariaLabel }, kids);
  }

  /* ================= SPARKLINE ================= */
  function spark(React, vals, color, w, ht) {
    vals = vals.filter(function (v) { return v != null; });
    w = w || 120; ht = ht || 30; color = color || PAL.green;
    if (vals.length < 2) return null;
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rng = (mx - mn) || 1, pad = 2;
    var pts = vals.map(function (v, i) { return [pad + i / (vals.length - 1) * (w - 2 * pad), ht - pad - (v - mn) / rng * (ht - 2 * pad)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var last = pts[pts.length - 1];
    return h(React, 'svg', { viewBox: '0 0 ' + w + ' ' + ht, width: w, height: ht, style: { display: 'block' }, 'aria-hidden': 'true' },
      h(React, 'path', { d: d, fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' }),
      h(React, 'circle', { cx: last[0], cy: last[1], r: 2.2, fill: darken(color, 0.16) }));
  }

  window.IChart = {
    PAL: PAL, num: num, compact: compact, pct: pct, money: money, ramp: ramp, lerp: lerp,
    line: line, hbars: hbars, stack: stack, columns: columns, stackArea: stackArea, donut: donut, map: map, scatter: scatter, spark: spark,
    // interactivity helpers (usable by custom in-page charts too)
    showTip: showTip, hideTip: hideTip, tipRow: tipRow, leaModal: leaModal, openModal: openModal, closeModal: closeModal,
    suppressionModal: suppressionModal, suppButton: suppButton, explainModal: explainModal, explainButton: explainButton,
    exportCSV: exportCSV, exportPNG: exportPNG, exportMenu: exportMenu
  };
})();
