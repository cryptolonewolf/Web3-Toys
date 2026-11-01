// Ride the Chart: the game logic, kept apart from the screen so it can be
// tested. A ride follows $100 through a token's monthly prices. When the
// price falls far enough from its last peak, the ride pauses and asks: hold or
// sell? After selling, the player gets one chance to jump back in.
//
// prices: [['2018-01', 13850.5], ...] (month, closing price in US dollars)

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RideEngine = factory();
})(this, function () {
  var DEFAULTS = { tiers: [30, 60, 80], rejoinRise: 50, stake: 100 };

  function create(prices, startIndex, settings) {
    var cfg = {};
    Object.keys(DEFAULTS).forEach(function (k) { cfg[k] = settings && settings[k] != null ? settings[k] : DEFAULTS[k]; });
    var series = prices.slice(startIndex);
    var p0 = series[0][1];
    return {
      cfg: cfg,
      series: series,
      i: 0,
      invested: true,
      units: cfg.stake / p0,
      cash: 0,
      holdUnits: cfg.stake / p0,
      peak: p0,
      tiersPassed: 0, // drop tiers already passed since the last peak
      lowSinceSell: null,
      rejoinUsed: false,
      soldAt: null, // month index where the player sold, while out
      decisions: [], // { month, pct, choice: 'hold' | 'sell' | 'rejoin' | 'stay-out' }
    };
  }

  function price(s, i) {
    return s.series[i == null ? s.i : i][1];
  }

  function month(s, i) {
    return s.series[i == null ? s.i : i][0];
  }

  function value(s) {
    return s.invested ? s.units * price(s) : s.cash;
  }

  function holdValue(s, i) {
    return s.holdUnits * price(s, i);
  }

  function done(s) {
    return s.i >= s.series.length - 1;
  }

  // Moves one month on. Returns a pause to show, or null.
  function step(s) {
    if (done(s)) return null;
    s.i++;
    var p = price(s);
    if (p > s.peak) {
      s.peak = p;
      s.tiersPassed = 0;
    }
    var drop = (1 - p / s.peak) * 100;
    var tiers = s.cfg.tiers;
    var crossed = false;
    while (s.tiersPassed < tiers.length && drop >= tiers[s.tiersPassed]) {
      s.tiersPassed++;
      crossed = true;
    }
    if (s.invested) {
      if (crossed) return { type: 'drop', pct: Math.round(drop), value: value(s), month: month(s) };
      return null;
    }
    s.lowSinceSell = Math.min(s.lowSinceSell, p);
    var rise = (p / s.lowSinceSell - 1) * 100;
    if (!s.rejoinUsed && rise >= s.cfg.rejoinRise) {
      s.rejoinUsed = true;
      return { type: 'rejoin', pct: Math.round(rise), value: s.cash, month: month(s) };
    }
    return null;
  }

  // The player's answer to a pause.
  function decide(s, pause, choice) {
    s.decisions.push({ month: month(s), pct: pause.pct, choice: choice });
    if (choice === 'sell' && s.invested) {
      s.cash = value(s);
      s.invested = false;
      s.lowSinceSell = price(s);
      s.soldAt = s.i;
    }
    if (choice === 'rejoin' && !s.invested) {
      s.units = s.cash / price(s);
      s.invested = true;
      s.soldAt = null;
    }
  }

  // Price and hold-value facts for the whole ride.
  function stats(s) {
    var peak = price(s, 0);
    var biggest = 0;
    var worst = holdValue(s, 0);
    var worstMonth = month(s, 0);
    var halvings = 0;
    var inHalving = false;
    for (var i = 0; i < s.series.length; i++) {
      var p = price(s, i);
      if (p > peak) {
        peak = p;
        inHalving = false;
      }
      var drop = (1 - p / peak) * 100;
      if (drop > biggest) biggest = drop;
      if (drop >= 50 && !inHalving) {
        halvings++;
        inHalving = true;
      }
      if (holdValue(s, i) < worst) {
        worst = holdValue(s, i);
        worstMonth = month(s, i);
      }
    }
    return { biggestDrop: Math.round(biggest), worstValue: worst, worstMonth: worstMonth, bigDrops: halvings };
  }

  function summary(s, ranks) {
    var finalValue = value(s);
    var hold = holdValue(s);
    var drops = s.decisions.filter(function (d) { return d.choice === 'hold' || d.choice === 'sell'; });
    var held = drops.filter(function (d) { return d.choice === 'hold'; }).length;
    var out = stats(s);
    out.finalValue = finalValue;
    out.holdValue = hold;
    out.drops = drops.length;
    out.held = held;
    out.months = s.series.length - 1;
    out.start = month(s, 0);
    out.end = month(s);
    // Score: how much of the "just hold" result the player kept, out of 100.
    out.score = hold > 0 ? Math.max(0, Math.min(100, Math.round((finalValue / hold) * 100))) : 100;
    out.beatHold = finalValue > hold * 1.005;
    out.rank = ranks ? rankFor(out, ranks) : null;
    return out;
  }

  // ranks: { noDrops: {name, line}, list: [{ name, min, line }] } where min is
  // the share of drops held, 0 to 1.
  function rankFor(sum, ranks) {
    if (!sum.drops) return ranks.noDrops;
    var share = sum.held / sum.drops;
    var pick = ranks.list[0];
    ranks.list.forEach(function (r) { if (share >= r.min) pick = r; });
    return pick;
  }

  // Start months a player may pick: every month that leaves at least
  // minMonths of ride.
  function lastStart(prices, minMonths) {
    return Math.max(0, prices.length - 1 - (minMonths || 12));
  }

  return {
    create: create,
    step: step,
    decide: decide,
    value: value,
    holdValue: holdValue,
    price: price,
    month: month,
    done: done,
    stats: stats,
    summary: summary,
    rankFor: rankFor,
    lastStart: lastStart,
  };
});
