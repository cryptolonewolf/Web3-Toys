// Cap Table and Dilution Simulator: who owns what after each round, kept
// apart from the screen so it can be tested. Simplified on purpose (see the
// _help in data/tools/cap-table.json).

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CapEngine = factory();
})(this, function () {
  function copy(list) {
    return list.map(function (h) { return { name: h.name, pct: h.pct, kind: h.kind }; });
  }

  // Everyone shrinks by the same factor when new shares are sold.
  function dilute(holders, newPct, name) {
    var keep = 1 - newPct / 100;
    var out = holders.map(function (h) { return { name: h.name, pct: h.pct * keep, kind: h.kind }; });
    out.push({ name: name, pct: newPct, kind: 'investor' });
    return out;
  }

  function simulate(founders, rounds) {
    var total = founders.reduce(function (s, f) { return s + (Number(f.pct) || 0); }, 0) || 1;
    var holders = founders.map(function (f) { return { name: f.name || 'Founder', pct: (Number(f.pct) || 0) / total * 100, kind: 'founder' }; });
    var stages = [{ label: 'Start', holders: copy(holders) }];
    var tokens = [];
    rounds.forEach(function (r, i) {
      var name = r.name || 'Round ' + (i + 1);
      if (r.type === 'safe' && r.cap > 0 && r.amount > 0) {
        holders = dilute(holders, Math.min(99, r.amount / r.cap * 100), name);
      } else if (r.type === 'priced' && r.amount > 0 && r.pre > 0) {
        holders = dilute(holders, r.amount / (r.pre + r.amount) * 100, name);
      } else if (r.type === 'saft' && r.amount > 0 && r.fdv > 0) {
        tokens.push({ name: name, pct: Math.min(100, r.amount / r.fdv * 100) });
      } else if (r.type === 'warrant' && r.tokenPct > 0) {
        holders.forEach(function (h) { tokens.push({ name: h.name, pct: r.tokenPct * h.pct / 100 }); });
      }
      stages.push({ label: name, type: r.type, holders: copy(holders) });
    });
    // Token rows for the same holder are added together.
    var merged = [];
    tokens.forEach(function (t) {
      var m = merged.filter(function (x) { return x.name === t.name; })[0];
      if (m) m.pct += t.pct;
      else merged.push({ name: t.name, pct: t.pct });
    });
    return { stages: stages, final: holders, tokens: merged };
  }

  function foundersShare(holders) {
    return holders.filter(function (h) { return h.kind === 'founder'; }).reduce(function (s, h) { return s + h.pct; }, 0);
  }

  return { simulate: simulate, foundersShare: foundersShare };
});
