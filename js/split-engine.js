// Rug or Real: picking the cards for a game and scoring, kept apart from the
// screen so they can be tested.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SplitEngine = factory();
})(this, function () {
  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  // n cards with at least a third of each verdict, in a random order.
  function pick(tokens, n, rand) {
    rand = rand || Math.random;
    var rugs = shuffle(tokens.filter(function (t) { return t.verdict === 'rug'; }), rand);
    var real = shuffle(tokens.filter(function (t) { return t.verdict === 'real'; }), rand);
    var min = Math.ceil(n / 3);
    var nRug = min + Math.floor(rand() * (n - 2 * min + 1));
    return shuffle(rugs.slice(0, nRug).concat(real.slice(0, n - nRug)), rand);
  }

  // Points for one card: nothing if wrong or too slow, otherwise the base
  // points plus a speed bonus for the share of time left.
  function points(answer, verdict, msLeft, msTotal, base, bonus) {
    if (answer !== verdict) return 0;
    return base + Math.round(bonus * Math.max(0, Math.min(1, msLeft / msTotal)));
  }

  function rankFor(score, max, ranks) {
    var share = max ? score / max : 0;
    var r = ranks[0];
    ranks.forEach(function (x) { if (share >= x.min) r = x; });
    return r;
  }

  return { pick: pick, points: points, rankFor: rankFor, shuffle: shuffle };
});
