// Launch Budget Planner: runway, typical ranges and warnings, kept apart from
// the screen so they can be tested.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BudgetEngine = factory();
})(this, function () {
  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  // Months the team and the runway reserve last at the monthly team cost.
  function runway(raise, split, burn) {
    if (!(burn > 0)) return null;
    return (raise * ((split.team || 0) + (split.runway || 0)) / 100) / burn;
  }

  function status(pct, line) {
    if (pct < line.min) return 'below';
    if (pct > line.max) return 'above';
    return 'ok';
  }

  function warnings(raise, split, burn, cfg) {
    var W = cfg.warnings;
    var out = [];
    var add = function (id, level, vars) { out.push({ id: id, level: level, text: fill(W[id], vars || {}) }); };
    var total = cfg.lines.reduce(function (s, l) { return s + (split[l.id] || 0); }, 0);
    if (Math.abs(total - 100) > 0.05) add('notHundred', 'bad', { total: Math.round(total * 10) / 10 });
    if (!split.audit) add('noAudit', 'bad');
    if (!split.legal) add('noLegal', 'bad');
    var hype = (split.marketing || 0) + (split.kols || 0);
    if (hype > (split.team || 0)) add('hype', 'warn', { pct: Math.round(hype * 10) / 10 });
    var months = runway(raise, split, burn);
    if (months == null) add('noBurn', 'warn');
    else if (months < cfg.runway.short) add('shortRunway', 'bad', { months: Math.round(months * 10) / 10, limit: cfg.runway.short });
    cfg.lines.forEach(function (l) {
      var pct = split[l.id] || 0;
      var st = status(pct, l);
      if (st !== 'ok' && pct > 0) add('outside', 'warn', { line: l.label, state: st === 'below' ? 'below typical' : 'above typical', pct: pct, min: l.min, max: l.max });
    });
    if (!out.length) add('allGood', 'good');
    return out;
  }

  return { runway: runway, status: status, warnings: warnings };
});
