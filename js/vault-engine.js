// The Vault Dive: scoring and the guess slider, kept apart from the screen so
// they can be tested.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VaultEngine = factory();
})(this, function () {
  // The slider runs 0 to 1000 on a log scale from $1 million to $3 billion,
  // so small and huge amounts are both easy to pick.
  var MIN = 1e6;
  var MAX = 3e9;
  var STEPS = 1000;

  function sliderToAmount(pos) {
    var v = MIN * Math.pow(MAX / MIN, pos / STEPS);
    // Round to 2 significant figures so the label reads cleanly.
    var mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return Math.round(v / mag) * mag;
  }

  function amountToSlider(amount) {
    return Math.round((Math.log(amount / MIN) / Math.log(MAX / MIN)) * STEPS);
  }

  // 100 points within closeRatio of the real amount (1.1 = within 10%),
  // falling to 0 at farRatio times off, either way.
  function points(guess, actual, closeRatio, farRatio) {
    var r = Math.max(guess / actual, actual / guess);
    if (r <= closeRatio) return 100;
    if (r >= farRatio) return 0;
    return Math.round(100 * (1 - Math.log(r / closeRatio) / Math.log(farRatio / closeRatio)));
  }

  function rankFor(score, max, ranks) {
    var share = max ? score / max : 0;
    var pick = ranks[0];
    ranks.forEach(function (r) { if (share >= r.min) pick = r; });
    return pick;
  }

  function money(v) {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
    if (v >= 1e6) return '$' + Math.round(v / 1e6) + 'M';
    return '$' + Math.round(v).toLocaleString('en-US');
  }

  return { sliderToAmount: sliderToAmount, amountToSlider: amountToSlider, points: points, rankFor: rankFor, money: money, STEPS: STEPS };
});
