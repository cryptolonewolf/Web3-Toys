// Launch Readiness Checklist: answers (yes, partly, no) in; a score out of
// 100, a score per area and the gaps (biggest first) out.
// Works in the browser (window.LaunchEngine) and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LaunchEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function score(answers, cfg) {
    var share = {};
    cfg.answers.forEach(function (a) { share[a.id] = a.share; });
    var total = 0;
    var got = 0;
    var cats = {};
    cfg.categories.forEach(function (c) { cats[c.id] = { id: c.id, label: c.label, emoji: c.emoji, total: 0, got: 0 }; });
    var gaps = [];
    var answered = 0;
    cfg.checks.forEach(function (c) {
      var a = answers[c.id];
      if (a) answered++;
      var s = share[a] || 0;
      total += c.weight;
      got += c.weight * s;
      cats[c.category].total += c.weight;
      cats[c.category].got += c.weight * s;
      if (s < 1) gaps.push({ id: c.id, text: c.text, why: c.why, category: c.category, weight: c.weight, lost: c.weight * (1 - s), answer: a || '' });
    });
    gaps.sort(function (x, y) { return y.lost - x.lost || y.weight - x.weight; });
    var pct = total ? Math.round((got / total) * 100) : 0;
    return {
      score: pct,
      answered: answered,
      count: cfg.checks.length,
      grade: cfg.grades.filter(function (g) { return pct >= g.min; })[0],
      categories: cfg.categories.map(function (c) { var x = cats[c.id]; x.pct = x.total ? Math.round((x.got / x.total) * 100) : 0; return x; }),
      gaps: gaps,
    };
  }

  return { score: score };
});
