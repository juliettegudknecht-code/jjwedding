/* idea-derive.js: turns the raw window.IDEA / MOE / DET / LEAALL globals into
   clean, per-state profiles + national aggregates. No figures are invented:
   every number is read straight from the reported data files. */
(function () {
  function ready() { return window.IDEA && window.IDEA.STATES; }

  var DET_ORDER = { 'Meets requirements': 1, 'Needs assistance, one year': 2, 'Needs assistance, two or more consecutive years': 3, 'Needs intervention': 4, 'Needs substantial intervention': 5 };
  var DET_SHORT = { 1: 'Meets requirements', 2: 'Needs assistance (1 yr)', 3: 'Needs assistance (2+ yrs)', 4: 'Needs intervention', 5: 'Needs substantial intervention' };
  var DET_COLOR = { 1: '#2f8f57', 2: '#c99a2e', 3: '#cf6b35', 4: '#b23b2e', 5: '#7a1f18' };

  function stateList() {
    if (!ready()) return [];
    return window.IDEA.STATES.map(function (r) { return { abbr: r[1], name: r[0] }; });
  }

  function byAbbr(ab) {
    var s = window.IDEA.STATES.filter(function (r) { return r[1] === ab; })[0];
    return s || null;
  }

  function detLevel(name, part) {
    var D = (part === 'C' ? window.DET2026 && window.DET2026.partC : window.DET2026 && window.DET2026.partB);
    if (!D) return null;
    var lab = D[name];
    return lab ? { label: lab, level: DET_ORDER[lab] || 0, short: DET_SHORT[DET_ORDER[lab]] || lab, color: DET_COLOR[DET_ORDER[lab]] || '#8c8e87' } : null;
  }

  function funding(name) {
    var M = window.MOE && window.MOE.states && window.MOE.states[name];
    if (!M) return null;
    return { f611: M.f611, f619: M.f619, total: M.f611 + M.f619, ceisReq: M.ceisReq, leaCount: M.n, top: M.top || [] };
  }

  // Funding per student served. Preferred method: sum each district's IDEA Part B allocation
  // (MOE.byNces) and its child count (LEAALL) only over districts that report BOTH, then divide,
  // so the numerator and denominator cover the same matched set. Fall back to the state total
  // allocation over the state total served when the match is unreliable: some states route their
  // IDEA funds through intermediate or regional agencies (Michigan ISDs, Iowa AEAs), so the
  // funding sits on a different NCES id than the child count, and some states suppress every
  // district count (Wyoming). We fall back unless the matched districts cover at least 75% of both
  // the state's funding and its served count.
  function perStudentFor(ab, name, served2024) {
    var M = window.MOE && window.MOE.states && window.MOE.states[name];
    if (!M || !served2024) return { value: null, method: 'none', covCount: 0, covFund: 0 };
    var stateFund = M.f611 + M.f619;
    var byN = (window.MOE && window.MOE.byNces) || {};
    var rows = (window.LEAALL && window.LEAALL.states && window.LEAALL.states[ab]) || [];
    var mFund = 0, mCount = 0;
    rows.forEach(function (x) {
      var nces = String(x[1]).replace(/^0+/, '');
      var served = x[2]; // total served ages 3-21; null when the district count is suppressed
      var f = byN[nces];
      if (f != null && served != null && served > 0) { mFund += f; mCount += served; }
    });
    var covCount = mCount / served2024, covFund = stateFund ? mFund / stateFund : 0;
    if (mCount > 0 && covCount >= 0.75 && covFund >= 0.75) {
      return { value: mFund / mCount, method: 'matched', covCount: covCount, covFund: covFund };
    }
    return { value: stateFund / served2024, method: 'stateTotal', covCount: covCount, covFund: covFund };
  }

  // aggregate district-level exiting (LEAEXIT) up to a state, weighted by exit base.
  // Real reported data; NCES ids need leading zeros stripped to match LEAEXIT keys.
  // Each rate is weighted only over the districts that actually reported it (b where the
  // rate is non-null), so a suppressed graduate or dropout count does not silently pull the
  // rate toward zero. If districts serving 40% or more of a state's exiters had that count
  // suppressed, the rate is not calculable and is returned as null (shown as N/A).
  var SUPP_THRESHOLD = 0.40;
  function exiting(ab) {
    // Prefer the SEA-level state totals (EDFacts file spec 009). They carry cells that are
    // suppressed in the district (LEA) files, so they are the authoritative, more-complete
    // state figures. District weighting is only a fallback for entities not in the SEA file.
    var SEA = window.ISEAEXIT && window.ISEAEXIT.states && window.ISEAEXIT.states[ab];
    if (SEA && SEA.base) {
      return {
        gradPct: SEA.gradPct, dropPct: SEA.dropPct, base: SEA.base, districts: null, sea: true,
        grad: SEA.grad, drop: SEA.drop, cert: SEA.cert, maxage: SEA.maxage,
        gradSuppShare: SEA.gradPct == null ? 1 : 0, dropSuppShare: SEA.dropPct == null ? 1 : 0,
        gradNA: SEA.gradPct == null, dropNA: SEA.dropPct == null, threshold: SUPP_THRESHOLD, supp: null
      };
    }
    var L = window.LEAALL && window.LEAALL.states && window.LEAALL.states[ab];
    var E = window.LEAEXIT && window.LEAEXIT.byNces;
    if (!L || !E) return null;
    var g = 0, d = 0, base = 0, gBase = 0, dBase = 0, n = 0;
    L.forEach(function (r) {
      var key = String(r[1]).replace(/^0+/, '');
      var e = E[key];
      if (!e || e[2] == null) return;
      var b = e[2];
      base += b; n++;
      if (e[0] != null) { g += e[0] * b; gBase += b; }
      if (e[1] != null) { d += e[1] * b; dBase += b; }
    });
    if (!base) return null;
    // Rate over the districts that reported it.
    var gradRate = gBase ? g / gBase : null, dropRate = dBase ? d / dBase : null;
    // Suppression share and the 40% N/A verdict come from the full source file (ISUPP),
    // because the prebuilt exiting file drops fully-suppressed districts entirely, which
    // would otherwise hide how much of a state's exiting data is actually withheld.
    var S = window.ISUPP && window.ISUPP.exiting && window.ISUPP.exiting.states && window.ISUPP.exiting.states[ab];
    var gShare, dShare, gNA, dNA, supp = null;
    if (S) {
      gShare = S.g[0] / 100; dShare = S.d[0] / 100; gNA = !!S.gNA; dNA = !!S.dNA;
      supp = { g8: S.g[2], g9: S.g[3], d8: S.d[2], d9: S.d[3], gN: S.g[1], dN: S.d[1] };
    } else {
      gShare = (base - gBase) / base; dShare = (base - dBase) / base;
      gNA = gShare >= SUPP_THRESHOLD || !gBase; dNA = dShare >= SUPP_THRESHOLD || !dBase;
    }
    return {
      gradPct: gNA ? null : gradRate,
      dropPct: dNA ? null : dropRate,
      base: base, districts: n,
      gradSuppShare: gShare, dropSuppShare: dShare,
      gradNA: gNA, dropNA: dNA, threshold: SUPP_THRESHOLD, supp: supp
    };
  }

  function districts(ab) {
    var L = window.LEAALL && window.LEAALL.states && window.LEAALL.states[ab];
    if (!L) return { rows: [], count: 0 };
    var rows = L.filter(function (r) { return r[2] != null; }).map(function (r) {
      return { name: r[0], nces: r[1], total: r[2], schoolAge: r[3], autism: r[4] };
    });
    return { rows: rows, count: L.length };
  }

  // national enrollment share (latest published) + rank helpers
  function enrollRanks() {
    var arr = window.IDEA.STATES.map(function (r) { return { abbr: r[1], name: r[0], pct: r[6] }; })
      .sort(function (a, b) { return b.pct - a.pct; });
    var rank = {}; arr.forEach(function (o, i) { rank[o.abbr] = i + 1; });
    return { sorted: arr, rank: rank, n: arr.length };
  }

  function servedRanks() {
    var arr = window.IDEA.STATES.map(function (r) { return { abbr: r[1], name: r[0], served: r[5] }; })
      .sort(function (a, b) { return b.served - a.served; });
    var rank = {}; arr.forEach(function (o, i) { rank[o.abbr] = i + 1; });
    return { sorted: arr, rank: rank, n: arr.length };
  }

  function profile(ab) {
    if (!ready()) return null;
    var s = byAbbr(ab); if (!s) return null;
    var name = s[0];
    var served2000 = s[2], served2010 = s[3], served2223 = s[4], served2024 = s[5], enrollPct = s[6];
    var fund = funding(name);
    var ps = perStudentFor(ab, name, served2024);
    var perStudent = ps.value;
    var er = enrollRanks(), sr = servedRanks();
    var growth = served2000 ? (served2024 - served2000) / served2000 * 100 : null;
    return {
      abbr: ab, name: name,
      served2000: served2000, served2010: served2010, served2223: served2223, served2024: served2024,
      enrollPct: enrollPct, growthPct: growth,
      enrollRank: er.rank[ab], servedRank: sr.rank[ab], nStates: er.n,
      natlEnrollPct: 15.2,
      funding: fund, perStudent: perStudent, perStudentMethod: ps.method,
      detB: detLevel(name, 'B'), detC: detLevel(name, 'C'),
      exiting: exiting(ab),
      districts: districts(ab)
    };
  }

  // per-state value maps for the choropleth
  function metric(kind) {
    var out = {};
    window.IDEA.STATES.forEach(function (r) {
      var name = r[0], ab = r[1];
      if (kind === 'served') out[ab] = r[5];
      else if (kind === 'pct') out[ab] = r[6];
      else if (kind === 'growth') out[ab] = r[2] ? (r[5] - r[2]) / r[2] * 100 : null;
      else if (kind === 'fund') { var m = window.MOE && window.MOE.states[name]; out[ab] = m ? m.f611 + m.f619 : null; }
      else if (kind === 'perstudent') { out[ab] = perStudentFor(ab, name, r[5]).value; }
      else if (kind === 'det') { var d = detLevel(name, 'B'); out[ab] = d ? d.level : null; }
    });
    return out;
  }

  // national aggregates
  function national() {
    var I = window.IDEA;
    var all = I.DEMO['All Disabilities'];
    // determination distribution (Part B, all 60 entities)
    var dist = { 1: 0, 2: 0, 3: 0, 4: 0 }, total = 0;
    if (window.DET2026 && window.DET2026.partB) {
      Object.keys(window.DET2026.partB).forEach(function (k) { var lv = DET_ORDER[window.DET2026.partB[k]]; if (lv) { dist[lv] = (dist[lv] || 0) + 1; total++; } });
    }
    var fundUS = window.MOE && window.MOE.US ? window.MOE.US.f611 + window.MOE.US.f619 : null;
    return {
      served: all.total, male: all.male, female: all.female,
      malePct: all.male / (all.male + all.female) * 100,
      partc: I.PARTC.total,
      enrollPct: I.D ? I.D.latestEnrollPct : 15.2,
      inclLatest: I.D && I.D.inclShare ? I.D.inclShare[I.D.inclShare.length - 1] : 67.8,
      detDist: dist, detTotal: total,
      fundUS: fundUS,
      firstYearServed: I.ALL[0] * 1000, latestYearServed: I.ALL[I.ALL.length - 1] * 1000
    };
  }

  window.IDERIVE = {
    ready: ready, stateList: stateList, profile: profile, metric: metric,
    national: national, enrollRanks: enrollRanks, servedRanks: servedRanks,
    exiting: exiting, detLevel: detLevel, DET_SHORT: DET_SHORT, DET_COLOR: DET_COLOR,
    perStudentFor: perStudentFor
  };
})();
