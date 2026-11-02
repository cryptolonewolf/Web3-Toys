// Official Links Checker: compares a pasted link's address with a list of
// official domains. Three results only: match, similar (a look-alike) or
// unknown. It never says a link is safe.
// Works in the browser (window.LinksEngine) and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LinksEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function hostOf(input) {
    var raw = String(input || '').trim();
    if (!raw) return null;
    var withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : 'https://' + raw;
    try {
      var u = new URL(withScheme);
      if (!u.hostname || u.hostname.indexOf('.') < 0) return null;
      return u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
    } catch (e) {
      return null;
    }
  }

  function dist(a, b) {
    var m = [];
    for (var i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (var j = 1; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return m[a.length][b.length];
  }

  function unglyph(s) {
    return s.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/0/g, 'o').replace(/[1|]/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/4/g, 'a');
  }

  function label(domain) {
    var parts = domain.split('.');
    return parts.length > 1 ? parts[parts.length - 2] : parts[0];
  }

  function fill(t, v) {
    return t.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
  }

  function check(input, cfg) {
    var host = hostOf(input);
    if (!host) return { kind: 'invalid' };
    var all = [];
    cfg.entries.forEach(function (e) { e.domains.forEach(function (d) { all.push({ name: e.name, domain: d, label: label(d) }); }); });

    for (var i = 0; i < all.length; i++) {
      var d = all[i].domain;
      if (host === d || host.slice(-(d.length + 1)) === '.' + d) return { kind: 'match', host: host, name: all[i].name, domain: d, reasons: [] };
    }

    var R = cfg.reasons;
    var hostLabel = label(host);
    var tokens = host.split(/[.-]/);
    var raw = String(input).toLowerCase();
    var best = null;
    var add = function (entry, key) {
      if (!best) best = { entry: entry, keys: [] };
      if (best.entry === entry && best.keys.indexOf(key) < 0) best.keys.push(key);
    };
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.charAt(0) === '[') best = { entry: null, keys: ['ip'] };
    all.forEach(function (o) {
      var L = o.label;
      if (raw.indexOf(o.domain) >= 0 && raw.indexOf('@') >= 0) add(o, 'at');
      if (hostLabel === L) add(o, 'tld');
      else if (tokens.indexOf(L) >= 0 || (L.length >= 5 && host.indexOf(L) >= 0)) add(o, 'contains');
      else if (L.length >= 5 && dist(hostLabel, L) <= (L.length >= 8 ? 2 : 1)) add(o, 'typo');
      else if (L.length >= 4 && unglyph(hostLabel) === unglyph(L)) add(o, 'glyph');
    });
    if (host.indexOf('xn--') >= 0) {
      if (!best) best = { entry: null, keys: [] };
      best.keys.push('punycode');
    }
    if (best && (best.entry || best.keys.length)) {
      var v = best.entry ? { name: best.entry.name, domain: best.entry.domain, label: best.entry.label, host: host } : { host: host };
      return {
        kind: 'similar',
        host: host,
        name: best.entry ? best.entry.name : '',
        domain: best.entry ? best.entry.domain : '',
        reasons: best.keys.map(function (k) { return fill(R[k], v); }),
      };
    }
    return { kind: 'unknown', host: host, reasons: [] };
  }

  return { hostOf: hostOf, check: check, dist: dist, fill: fill };
});
