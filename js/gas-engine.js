// Gas and Unit Converter: exact unit conversion with BigInt (no rounding
// errors), plus simple fee estimates. Works in the browser
// (window.GasEngine) and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GasEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // "1.5" with 9 decimals -> 1500000000n. Returns null if not a number.
  function toBase(text, decimals) {
    var s = String(text == null ? '' : text).replace(/[,\s_]/g, '');
    if (s === '' || s === '.') return null;
    var m = /^(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m) {
      var e = /^(\d*\.?\d+)e([+-]?\d+)$/i.exec(s);
      if (!e) return null;
      return toBase(expand(e[1], Number(e[2])), decimals);
    }
    var whole = m[1] || '0';
    var frac = (m[2] || '').slice(0, decimals);
    while (frac.length < decimals) frac += '0';
    return BigInt(whole + frac);
  }

  function expand(num, exp) {
    var parts = num.split('.');
    var digits = parts[0] + (parts[1] || '');
    var point = parts[0].length + exp;
    if (point <= 0) return '0.' + '0'.repeat(-point) + digits;
    if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
    return digits.slice(0, point) + '.' + digits.slice(point);
  }

  // 1500000000n with 9 decimals -> "1.5".
  function fromBase(big, decimals) {
    if (big == null) return '';
    var s = big.toString();
    if (!decimals) return s;
    while (s.length <= decimals) s = '0' + s;
    var whole = s.slice(0, s.length - decimals);
    var frac = s.slice(s.length - decimals).replace(/0+$/, '');
    return frac ? whole + '.' + frac : whole;
  }

  // Thousands separators for the whole part only.
  function group(text) {
    var p = String(text).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }

  // gas units x gas price (gwei) -> fee in wei.
  function evmFee(gasUnits, gasPriceGwei) {
    var g = BigInt(Math.max(0, Math.round(Number(gasUnits) || 0)));
    var p = toBase(String(Math.max(0, Number(gasPriceGwei) || 0)), 9) || 0n;
    return g * p;
  }

  // signatures x base fee + priority fee -> fee in lamports.
  function solFee(signatures, baseFee, priorityLamports) {
    return BigInt(Math.max(0, Math.round(Number(signatures) || 0))) * BigInt(baseFee) + BigInt(Math.max(0, Math.round(Number(priorityLamports) || 0)));
  }

  return { toBase: toBase, fromBase: fromBase, group: group, evmFee: evmFee, solFee: solFee };
});
