// Fish the Dead Projects: which catch bites, the reeling bar and scoring,
// kept apart from the screen so they can be tested.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FishEngine = factory();
})(this, function () {
  // Common catches bite most often. A stronger cast (power 0 to 1) makes
  // rare and legendary ones more likely. Catches already landed this game
  // are left out while others remain.
  var BASE = { 1: 6, 2: 3, 3: 1 };

  function weight(rarity, power) {
    return BASE[rarity] * (1 + power * 2 * (rarity - 1));
  }

  function pickCatch(entries, power, taken, rand) {
    rand = rand || Math.random;
    var left = entries.filter(function (e) { return !taken || !taken[e.id]; });
    if (!left.length) left = entries;
    // An entry can bite less often with its own weight (for example 0.15).
    var w = function (e) { return weight(e.rarity, power) * (e.weight || 1); };
    var total = left.reduce(function (s, e) { return s + w(e); }, 0);
    var r = rand() * total;
    for (var i = 0; i < left.length; i++) {
      r -= w(left[i]);
      if (r < 0) return left[i];
    }
    return left[left.length - 1];
  }

  // The green zone on the reeling bar, as a share of the bar (0 to 1).
  // Rarer catches have a narrower zone.
  function zone(rarity, rand) {
    rand = rand || Math.random;
    var width = [0, 0.3, 0.24, 0.18][rarity] || 0.24;
    var start = 0.08 + rand() * (0.84 - width);
    return { start: start, end: start + width };
  }

  function inZone(pos, z) {
    return pos >= z.start && pos <= z.end;
  }

  // Where the marker is at time t (ms): it slides back and forth.
  function marker(t, periodMs) {
    var phase = (t % periodMs) / periodMs;
    return phase < 0.5 ? phase * 2 : 2 - phase * 2;
  }

  function points(rarity, streak, table, streakBonus) {
    return (table[rarity] || 0) + Math.max(0, streak - 1) * streakBonus;
  }

  function rankFor(score, ranks) {
    var r = ranks[0];
    ranks.forEach(function (x) { if (score >= x.min) r = x; });
    return r;
  }

  return { pickCatch: pickCatch, weight: weight, zone: zone, inZone: inZone, marker: marker, points: points, rankFor: rankFor };
});
