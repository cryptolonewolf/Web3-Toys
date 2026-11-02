// Market Cap and FDV Calculator: the maths, kept apart from the screen so it
// can be tested.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.McapEngine = factory();
})(this, function () {
  function calc(price, circulating, total) {
    var mcap = price * circulating;
    var fdv = price * total;
    return {
      mcap: mcap,
      fdv: fdv,
      gap: fdv - mcap,
      circulatingPct: total > 0 ? (circulating / total) * 100 : 0,
      ratio: mcap > 0 ? fdv / mcap : 0,
      valid: price >= 0 && circulating >= 0 && total > 0 && circulating <= total,
    };
  }

  // The first band whose maxCirculating is at or above the circulating share.
  function band(pct, bands) {
    for (var i = 0; i < bands.length; i++) if (pct <= bands[i].maxCirculating) return bands[i];
    return bands[bands.length - 1];
  }

  // $1.2B, $350M, $12.5K, $0.42
  function money(v) {
    var a = Math.abs(v);
    var s = a >= 1e12 ? (a / 1e12).toFixed(2) + 'T' : a >= 1e9 ? (a / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : a.toFixed(2);
    return (v < 0 ? '-$' : '$') + s.replace(/\.0+([A-Z])$/, '$1').replace(/(\.\d*[1-9])0+([A-Z])$/, '$1$2');
  }

  return { calc: calc, band: band, money: money };
});
