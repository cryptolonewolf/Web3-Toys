// Tokenomics Generator: the vesting maths and the warning rules, kept apart
// from the screen so they can be tested.
//
// A group: { id, pct, tge, cliff, vest }. pct is its share of the supply.
// tge percent of it unlocks at launch (month 0). The rest waits cliff
// months, then unlocks in equal parts over the next vest months. With no
// vesting months, the rest unlocks all at once when the cliff ends.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TokenomicsEngine = factory();
})(this, function () {
  // Percent of total supply unlocking each month, for one group.
  function groupUnlocks(g, months) {
    var out = [];
    for (var m = 0; m <= months; m++) out.push(0);
    var pct = Math.max(0, g.pct || 0);
    var tge = pct * Math.min(100, Math.max(0, g.tge || 0)) / 100;
    var rest = pct - tge;
    var cliff = Math.max(0, Math.round(g.cliff || 0));
    var vest = Math.max(0, Math.round(g.vest || 0));
    out[0] += tge;
    if (rest > 0) {
      if (!vest) {
        if (cliff <= months) out[cliff] += rest;
      } else {
        for (var k = 1; k <= vest; k++) {
          var at = cliff + k;
          if (at <= months) out[at] += rest / vest;
        }
      }
    }
    return out;
  }

  // Unlocks for every group, plus the circulating supply (percent) by month.
  function schedule(groups, months) {
    var byGroup = {};
    var total = [];
    var circulating = [];
    for (var m = 0; m <= months; m++) total.push(0);
    groups.forEach(function (g) {
      var u = groupUnlocks(g, months);
      byGroup[g.id] = u;
      u.forEach(function (v, i) { total[i] += v; });
    });
    total.reduce(function (sum, v, i) {
      circulating[i] = sum + v;
      return circulating[i];
    }, 0);
    return { byGroup: byGroup, total: total, circulating: circulating };
  }

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  // The warnings for a design. Returns [{ id, level, text }].
  function warnings(groups, sched, cfg) {
    var L = cfg.limits;
    var W = cfg.warnings;
    var get = function (id) { return groups.filter(function (g) { return g.id === id; })[0] || { pct: 0 }; };
    var out = [];
    var add = function (id, level, vars) { out.push({ id: id, level: level, text: fill(W[id], vars || {}) }); };
    var total = groups.reduce(function (s, g) { return s + (g.pct || 0); }, 0);
    if (Math.abs(total - 100) > 0.05) add('notHundred', 'bad', { total: round1(total) });

    var team = get('team');
    if (team.pct > 0 && !team.vest && !team.cliff) add('teamNoVesting', 'bad', { pct: round1(team.pct) });
    if (team.pct > L.teamMax) add('teamHigh', 'warn', { pct: round1(team.pct), limit: L.teamMax });

    var insiders = get('team').pct + get('investors').pct + get('advisors').pct;
    if (insiders > L.insidersMax) add('insiders', 'bad', { pct: round1(insiders), limit: L.insidersMax });

    var firstYear = sched.total.slice(1, 13).reduce(function (s, v) { return s + v; }, 0);
    if (firstYear > L.firstYearMax) add('firstYear', 'warn', { pct: round1(firstYear) });

    var worst = 0;
    var worstMonth = 0;
    sched.total.forEach(function (v, i) {
      if (i > 0 && v > worst) {
        worst = v;
        worstMonth = i;
      }
    });
    if (worst > L.monthMax) add('bigMonth', 'warn', { month: worstMonth, pct: round1(worst) });

    var liq = get('liquidity').pct;
    if (liq < L.liquidityMin) add('lowLiquidity', 'warn', { pct: round1(liq) });

    var community = get('community').pct + get('airdrop').pct;
    if (community < L.communityMin) add('lowCommunity', 'warn', { pct: round1(community), limit: L.communityMin });

    var atTge = sched.total[0];
    if (atTge > L.tgeMax) add('tgeHigh', 'warn', { pct: round1(atTge), limit: L.tgeMax });
    if (atTge < 1) add('noTge', 'warn');

    if (!out.length) add('allGood', 'good');
    return out;
  }

  // Scale the groups so they add up to 100, rounding to half a percent and
  // putting any rounding leftover on the biggest group.
  function balance(groups) {
    var total = groups.reduce(function (s, g) { return s + (g.pct || 0); }, 0);
    if (!total) return groups;
    var scaled = groups.map(function (g) { return Math.round(((g.pct || 0) / total) * 200) / 2; });
    var diff = 100 - scaled.reduce(function (s, v) { return s + v; }, 0);
    var big = scaled.indexOf(Math.max.apply(null, scaled));
    scaled[big] = Math.round((scaled[big] + diff) * 2) / 2;
    return groups.map(function (g, i) {
      var c = {};
      Object.keys(g).forEach(function (k) { c[k] = g[k]; });
      c.pct = scaled[i];
      return c;
    });
  }

  return { groupUnlocks: groupUnlocks, schedule: schedule, warnings: warnings, balance: balance };
});
