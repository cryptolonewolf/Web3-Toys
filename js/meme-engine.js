// Meme Coin Launch Kit: names, tickers and launch words from a theme.
// Seeded, so the same theme and round give the same ideas.
// Works in the browser (window.MemeEngine) and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MemeEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function rng(seed) {
    var a = seed || 1;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function cap(w) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }

  // The useful words of a theme: letters only, no filler words.
  function words(theme, stop) {
    var seen = {};
    return String(theme || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (w) {
      if (w.length < 3 || stop.indexOf(w) >= 0 || seen[w]) return false;
      seen[w] = true;
      return true;
    }).slice(0, 6).map(cap);
  }

  // A ticker from a name: the theme word whole, other words as initials,
  // 3 to 5 letters. "King Frog" gives $KFROG.
  function ticker(name, word) {
    var parts = name.toUpperCase().replace(/[^A-Z ]/g, '').split(' ').filter(Boolean);
    var w = String(word || '').toUpperCase();
    var t = parts.length === 1 ? parts[0] : parts.map(function (p) { return p === w ? p : p.charAt(0); }).join('');
    t = t.slice(0, 5);
    while (t.length < 3) t += 'X';
    return '$' + t;
  }

  function names(theme, cfg, round) {
    var ws = words(theme, cfg.stopWords);
    if (!ws.length) ws = ['Meme'];
    var rand = rng(hash(theme.toLowerCase() + '#' + (round || 0)));
    var out = [];
    var seenName = {};
    var seenTicker = {};
    var tries = 0;
    while (out.length < 10 && tries < 400) {
      tries++;
      var pattern = cfg.namePatterns[Math.floor(rand() * cfg.namePatterns.length)];
      var w = ws[Math.floor(rand() * ws.length)];
      var others = ws.filter(function (x) { return x !== w; });
      if (pattern.indexOf('{W2}') >= 0 && !others.length) continue;
      var w2 = others[Math.floor(rand() * others.length)] || '';
      // Frog + ana = Frogana, Meme + ana = Memana (no double vowel).
      var name = pattern.replace(/\{W\}([a-z])/, function (m, c) { return (/[aeiou]$/i.test(w) && /[aeiou]/.test(c) ? w.slice(0, -1) : w) + c; })
        .replace('{W}', w).replace('{W2}', w2).trim();
      var t = ticker(name, w);
      if (seenName[name] || seenTicker[t]) continue;
      seenName[name] = seenTicker[t] = true;
      out.push({ name: name, ticker: t });
    }
    return out;
  }

  function fillOne(tpl, v) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
  }

  // Launch words for a chosen name.
  function copy(theme, pick, cfg, round) {
    var rand = rng(hash(pick.name + '|' + theme + '#' + (round || 0)));
    var ws = words(theme, cfg.stopWords);
    var v = { name: pick.name, ticker: pick.ticker, theme: String(theme).trim() || 'memes', word: (ws[0] || 'meme').toLowerCase() };
    var one = function (list) { return fillOne(list[Math.floor(rand() * list.length)], v); };
    return {
      description: one(cfg.descriptions),
      story: one(cfg.stories),
      bio: one(cfg.bios).slice(0, 160),
      posts: cfg.posts.map(function (p) { return fillOne(p, v); }),
    };
  }

  function banned(text, cfg) {
    var t = String(text).toLowerCase();
    return cfg.bannedWords.filter(function (w) { return t.indexOf(w) >= 0; });
  }

  return { words: words, ticker: ticker, names: names, copy: copy, banned: banned, hash: hash };
});
