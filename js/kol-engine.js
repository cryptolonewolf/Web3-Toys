// KOL Vetting Scorecard: public numbers in, a score out of 100 with reasons
// and red flags, plus the cost per view and per click of a paid post.
// Works in the browser (window.KolEngine) and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KolEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function metrics(v) {
    var f = Math.max(0, Number(v.followers) || 0);
    var likes = Math.max(0, Number(v.likes) || 0);
    var replies = Math.max(0, Number(v.replies) || 0);
    var promoted = Math.max(0, Number(v.promoted) || 0);
    var died = Math.min(promoted, Math.max(0, Number(v.died) || 0));
    return {
      engagement: f ? ((likes + replies) / f) * 100 : 0,
      replyRatio: likes ? (replies / likes) * 100 : (replies ? 100 : 0),
      growth: Number(v.growth) || 0,
      paidShare: Math.min(100, Math.max(0, Number(v.paidShare) || 0)),
      disclosure: v.disclosure,
      deadShare: promoted ? (died / promoted) * 100 : null,
    };
  }

  function band(bands, value) {
    for (var i = 0; i < bands.length; i++) if (value <= bands[i].max) return bands[i];
    return bands[bands.length - 1];
  }

  function score(v, cfg) {
    var m = metrics(v);
    var items = cfg.checks.map(function (c) {
      var value = m[c.id];
      var hit;
      if (c.options) hit = c.options.filter(function (o) { return o.id === value; })[0] || c.options[c.options.length - 1];
      else if (value == null && c.noData) hit = c.noData;
      else hit = band(c.bands, value);
      var max = c.options ? Math.max.apply(null, c.options.map(function (o) { return o.points; })) : Math.max.apply(null, c.bands.map(function (b) { return b.points; }));
      return { id: c.id, label: c.label, value: value, unit: c.unit, points: hit.points, max: max, reason: hit.reason, flag: !!hit.flag };
    });
    var total = items.reduce(function (s, x) { return s + x.points; }, 0);
    var grade = cfg.grades.filter(function (g) { return total >= g.min; })[0];
    return { total: total, items: items, flags: items.filter(function (x) { return x.flag; }), grade: grade, metrics: m };
  }

  function roi(v) {
    var cost = Math.max(0, Number(v.cost) || 0);
    var views = Math.round((Number(v.followers) || 0) * (Number(v.viewPct) || 0) / 100);
    var clicks = Math.round(views * (Number(v.clickPct) || 0) / 100);
    return {
      views: views,
      clicks: clicks,
      cpm: views ? (cost / views) * 1000 : null,
      cpc: clicks ? cost / clicks : null,
    };
  }

  return { metrics: metrics, score: score, roi: roi };
});
