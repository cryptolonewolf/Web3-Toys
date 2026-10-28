// The "Check a message" engine for Spot the Scam.
// Runs entirely in the browser. It only reads the text it is given: it never
// opens, visits or fetches anything, and it never stores anything.
// The rules live in data/scam_rules.json; reported scams in data/scam-known.js
// and data/scam-feed.js.

(function (root) {
  // ---------- Secrets: stop before checking ----------

  // Short everyday words that real seed phrases never contain. A run of 12 or
  // more plain lowercase words with none of these is treated as a seed phrase.
  var COMMON_WORDS = (
    'the and you your for are but not with this that have from they will what when can all our ' +
    'was were has had been its just into about there their them then than some more very also ' +
    'here how who why get got out now any may please hello thanks thank would could should did ' +
    'does yes yeah hey him her his she one two who which where while because still only even ' +
    'over back after before again want need know like make made take see let new old good'
  ).split(' ');

  var NUMBERING = /^\(?\d{1,2}[.):]?$/;
  var PLAIN_WORD = /^[a-z]{3,8}$/;

  function looksLikeSeedPhrase(text) {
    var run = 0;
    var tokens = text.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t || NUMBERING.test(t)) continue;
      if (PLAIN_WORD.test(t) && COMMON_WORDS.indexOf(t) === -1) {
        if (++run >= 12) return true;
      } else {
        run = 0;
      }
    }
    return false;
  }

  // 64 hex characters (a raw private key), or a long unbroken base58 string
  // (an exported key). Wallet addresses are shorter, so they do not trigger this.
  var HEX_KEY = /(^|[^0-9a-f])(0x)?[0-9a-f]{64}(?![0-9a-f])/i;
  var BASE58_KEY = /[1-9A-HJ-NP-Za-km-z]{50,}/;

  // Returns 'seed', 'key' or null.
  function detectSecret(text) {
    if (looksLikeSeedPhrase(text)) return 'seed';
    if (HEX_KEY.test(text) || BASE58_KEY.test(text)) return 'key';
    return null;
  }

  // ---------- Helpers ----------

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // A phrase as a whole-word, any-capitals, find-all pattern. The first group
  // holds the character before the phrase, so the match itself starts after it.
  function phraseRegExp(phrase) {
    var start = /^[a-z0-9]/i.test(phrase) ? '(^|[^a-z0-9])' : '()';
    var end = /[a-z0-9]$/i.test(phrase) ? '(?![a-z0-9])' : '';
    return new RegExp(start + '(' + escapeRegExp(phrase).replace(/\s+/g, '\\s+') + ')' + end, 'gi');
  }

  function findAll(re, text) {
    var out = [];
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
    return out;
  }

  function findPhrase(phrase, text) {
    var re = phraseRegExp(phrase);
    var out = [];
    var m;
    while ((m = re.exec(text))) {
      var start = m.index + m[1].length;
      out.push({ start: start, end: start + m[2].length, text: m[2] });
      re.lastIndex = start + Math.max(1, m[2].length);
    }
    return out;
  }

  // True when "never", "no" and similar come just before `index`, in the same
  // part of the sentence. "We will never ask for your password" is not a request.
  function isNegated(text, index, negations) {
    var clause = text.slice(Math.max(0, index - 60), index).split(/[.,;:!?\n]/).pop().toLowerCase();
    var words = clause.split(/\s+/).filter(Boolean).slice(-6).join(' ');
    return negations.some(function (n) { return (' ' + words + ' ').indexOf(' ' + n + ' ') !== -1; });
  }

  function textMatches(rule, text, negations) {
    var spans = [];
    (rule.phrases || []).forEach(function (p) { spans = spans.concat(findPhrase(p, text)); });
    (rule.patterns || []).forEach(function (p) { spans = spans.concat(findAll(new RegExp(p, 'gi'), text)); });
    if (rule.skipIfNegated) spans = spans.filter(function (s) { return !isNegated(text, s.start, negations); });
    // skipIfAfter: ignore a match when one of these words comes just before it,
    // like "fee of 2 BTC", which is money asked for, not money offered.
    if (rule.skipIfAfter) {
      spans = spans.filter(function (s) {
        var before = text.slice(Math.max(0, s.start - 20), s.start).toLowerCase();
        return !rule.skipIfAfter.some(function (w) { return before.indexOf(w) !== -1; });
      });
    }
    return spans;
  }

  // ---------- Links (read, never opened) ----------

  var ENDINGS = (
    'com org net io co app dev xyz top click site online live icu buzz cyou rest monster shop zip lol vip ' +
    'me gg ai finance exchange art info biz us uk link fi network money cc ly gl gd at tv to ee so pro tech ' +
    'space fun store club ws eu ca de fr es nl ch au in jp ru cn it ph is la sh im ink one xyz wallet crypto ' +
    'cloud digital world today global support claims'
  ).split(' ');

  // Every web address in the text, with where it sits. A name only counts as a
  // web address with http(s):// in front, or with a known ending like .com.
  function findHosts(text) {
    var hosts = [];
    var re = /(https?:\/\/)?((?:[a-z0-9¡-￿](?:[a-z0-9¡-￿-]{0,61}[a-z0-9¡-￿])?\.)+([a-z¡-￿]{2,24}))(?![a-z0-9¡-￿-])/gi;
    var m;
    while ((m = re.exec(text))) {
      var ending = m[3].toLowerCase();
      if (!m[1] && ENDINGS.indexOf(ending) === -1) continue;
      var hostStart = m.index + (m[1] ? m[1].length : 0);
      hosts.push({ host: m[2].toLowerCase().replace(/^www\./, ''), start: hostStart, end: hostStart + m[2].length });
    }
    return hosts;
  }

  function hasIpLink(text) {
    return /(?:^|[^\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/.test(text);
  }

  function isOfficial(host, brand) {
    return brand.official.some(function (o) { return host === o || host.slice(-(o.length + 1)) === '.' + o; });
  }

  function belongsTo(host, list) {
    return list.some(function (h) { return host === h || host.slice(-(h.length + 1)) === '.' + h; });
  }

  // ---------- Lookalikes ----------

  var DIGIT_LOOKS = { 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b' };

  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var prev = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var cur = [i];
      for (var k = 1; k <= b.length; k++) {
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  // Is `word` a near miss of a brand name? (binnance, c0inbase, metamsk, rn for m)
  function nearBrand(word, alias) {
    if (word === alias || word === alias + 's') return false;
    var undigit = word.replace(/[0134578]/g, function (d) { return DIGIT_LOOKS[d]; });
    var unpaired = undigit.replace(/rn/g, 'm').replace(/vv/g, 'w');
    if (/[0-9]/.test(word) && (undigit === alias || undigit.indexOf(alias) !== -1)) return true;
    if (unpaired === alias && word !== alias) return true;
    return alias.length >= 6 && /^[a-z]+$/.test(word) && editDistance(word, alias) === 1;
  }

  // Latin letters mixed with lookalike letters from other alphabets (like a Cyrillic а).
  var MIXED_SCRIPT = /^(?=.*[a-z])(?=.*[Ͱ-ϿЀ-ӿ]).+$/i;

  // ---------- Built-in rule types ----------

  var TYPES = {
    linkHosts: function (rule, ctx) {
      return ctx.hosts.filter(function (h) { return belongsTo(h.host, rule.hosts); });
    },

    brandLink: function (rule, ctx, data) {
      var spans = [];
      ctx.hosts.forEach(function (h) {
        var compact = h.host.replace(/[.-]/g, '');
        data.brands.forEach(function (b) {
          if (!isOfficial(h.host, b) && b.aliases.some(function (a) { return compact.indexOf(a) !== -1; })) spans.push(h);
        });
      });
      // "Binance Support" (or claim, verify...) in the text with a link that is not Binance's own.
      data.brands.forEach(function (b) {
        var official = ctx.hosts.some(function (h) { return isOfficial(h.host, b); });
        if (official || !ctx.signals.link) return;
        var re = new RegExp('\\b' + escapeRegExp(b.name).replace(/\s+/g, '\\s*') + '\\s+(' + rule.brandWords.join('|') + ')\\b', 'gi');
        spans = spans.concat(findAll(re, ctx.text));
      });
      return spans;
    },

    lookalike: function (rule, ctx, data) {
      var spans = [];
      var aliases = [];
      data.brands.forEach(function (b) { aliases = aliases.concat(b.aliases); });
      var official = ctx.hosts.filter(function (h) { return data.brands.some(function (b) { return isOfficial(h.host, b); }); });
      findAll(/[A-Za-z0-9Ͱ-ϿЀ-ӿ]{4,}/g, ctx.text).forEach(function (w) {
        if (official.some(function (h) { return w.start >= h.start && w.end <= h.end; })) return;
        var word = w.text.toLowerCase();
        if (MIXED_SCRIPT.test(word) || aliases.some(function (a) { return nearBrand(word, a); })) spans.push(w);
      });
      return spans;
    },

    reported: function (rule, ctx) {
      var found = knownMatches(ctx.text, ctx.known);
      var lower = ctx.text.toLowerCase();
      var spans = [];
      found.forEach(function (label) {
        var value = label.replace(/ \(.*\)$/, '').replace(/^"|"$/g, '').toLowerCase();
        var at = lower.indexOf(value);
        spans.push(at === -1 ? { start: 0, end: 0, text: label } : { start: at, end: at + value.length, text: label });
      });
      return spans;
    },

    emoji: function (rule, ctx) {
      var all = findAll(/\p{Extended_Pictographic}/gu, ctx.text);
      var hype = all.filter(function (e) { return rule.hypeEmojis.indexOf(e.text) !== -1; });
      return hype.length >= rule.minHype || all.length >= rule.minAny ? all : [];
    },

    caps: function (rule, ctx) {
      var words = findAll(new RegExp('\\b[A-Z]{' + rule.minLength + ',}\\b', 'g'), ctx.text)
        .filter(function (w) { return rule.ignore.indexOf(w.text) === -1; });
      return words.length >= rule.minWords ? words : [];
    },
  };

  // ---------- The check ----------

  // Returns { blocked: 'seed' | 'key' } or
  // { score, level, flags: [{ rule, category, points, spans }], spans, signals }
  // `known`: optional reported-scam lists (data/scam-known.js, data/scam-feed.js).
  function check(text, data, known) {
    text = String(text || '');
    var secret = detectSecret(text);
    if (secret) return { blocked: secret };

    var hosts = findHosts(text);
    var negations = data.negations || [];
    var signals = { link: hosts.length > 0 || hasIpLink(text), ip: hasIpLink(text) };
    Object.keys(data.signals || {}).forEach(function (name) {
      signals[name] = textMatches(Object.assign({ skipIfNegated: true }, data.signals[name]), text, negations).length > 0;
    });

    var ctx = { text: text, hosts: hosts, signals: signals, known: known };
    var flags = [];
    data.rules.forEach(function (rule) {
      if (rule.onlyWith && !rule.onlyWith.some(function (s) { return signals[s]; })) return;
      var spans = rule.type ? TYPES[rule.type](rule, ctx, data) : textMatches(rule, text, negations);
      if (!spans.length) return;
      flags.push({ rule: rule, category: (data.categories || {})[rule.category] || rule.category, points: rule.points, spans: spans });
    });

    flags.sort(function (a, b) { return b.points - a.points; });
    var max = data.maxScore || 100;
    var total = flags.reduce(function (sum, f) { return sum + f.points; }, 0);
    var critical = flags.some(function (f) { return f.rule.critical; });
    var score = critical ? max : Math.min(max, total);
    var level = data.levels.filter(function (l) { return score >= l.min; })[0];

    var spans = [];
    flags.forEach(function (f) {
      f.spans.forEach(function (s) { if (s.end > s.start) spans.push({ start: s.start, end: s.end, rule: f.rule.id }); });
    });

    return { score: score, level: level, flags: flags, count: flags.length, spans: spans, signals: signals };
  }

  // The message as safe HTML, with every matched piece wrapped in <mark>.
  function highlight(text, spans) {
    var esc = function (s) {
      return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
    };
    var marks = new Array(text.length + 1).join('0').split('').map(function () { return false; });
    spans.forEach(function (s) { for (var i = s.start; i < s.end && i < text.length; i++) marks[i] = true; });
    var out = '';
    var i = 0;
    while (i < text.length) {
      var j = i;
      while (j < text.length && marks[j] === marks[i]) j++;
      var piece = esc(text.slice(i, j));
      out += marks[i] ? '<mark>' + piece + '</mark>' : piece;
      i = j;
    }
    return out;
  }

  // ---------- Reported scam lists ----------

  // "fake.xyz   # fake airdrop" becomes { value: 'fake.xyz', note: 'fake airdrop' }.
  function parseList(raw) {
    return String(raw || '').split('\n').map(function (line) {
      var hash = line.indexOf('#');
      var value = (hash === -1 ? line : line.slice(0, hash)).trim();
      var note = hash === -1 ? '' : line.slice(hash + 1).trim();
      return value ? { value: value, note: note } : null;
    }).filter(Boolean);
  }

  function cleanDomain(value) {
    return value.toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[\/?#\s]/)[0];
  }

  function withNote(value, note) {
    return note ? value + ' (' + note + ')' : value;
  }

  // Phone numbers are compared by their last 9 digits.
  function phoneKey(value) {
    var digits = String(value).replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : digits;
  }

  function normalizeWords(text) {
    return ' ' + String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  }

  var indexCache = [];

  function buildIndex(known) {
    for (var i = 0; i < indexCache.length; i++) if (indexCache[i].known === known) return indexCache[i].index;
    var index = { domains: {}, pages: [], evm: {}, addresses: {}, emails: {}, handles: {}, phones: {}, phrases: [] };
    var note = function (e) { return e.note || known.defaultNote || ''; };
    parseList(known.domains).forEach(function (e) {
      var d = cleanDomain(e.value);
      var page = e.value.toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
      // In lists marked matchPaths (the public feed), an entry with a path is
      // one page on a shared platform: match only that page.
      if (known.matchPaths && page.indexOf('/') !== -1) index.pages.push({ page: page, label: withNote(page, note(e)) });
      else if (d) index.domains[d] = withNote(d, note(e));
    });
    parseList(known.addresses).forEach(function (e) {
      if (/^0x[0-9a-f]{40}$/i.test(e.value)) index.evm[e.value.toLowerCase()] = withNote(e.value, note(e));
      else index.addresses[e.value] = withNote(e.value, note(e));
    });
    parseList(known.emails).forEach(function (e) { index.emails[e.value.toLowerCase()] = withNote(e.value, note(e)); });
    parseList(known.handles).forEach(function (e) {
      var h = e.value.replace(/^(https?:\/\/)?(t\.me\/|telegram\.me\/|@)/i, '').toLowerCase();
      if (h) index.handles[h] = withNote('@' + h, note(e));
    });
    parseList(known.phones).forEach(function (e) {
      var k = phoneKey(e.value);
      if (k.length >= 7) index.phones[k] = withNote(e.value, note(e));
    });
    parseList(known.phrases).forEach(function (e) {
      var p = normalizeWords(e.value);
      if (p.trim()) index.phrases.push({ words: p, label: withNote('"' + e.value + '"', note(e)) });
    });
    indexCache.push({ known: known, index: index });
    if (indexCache.length > 4) indexCache.shift();
    return index;
  }

  function eachMatch(re, text, fn) {
    var m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) fn(m);
  }

  // Everything from the reported-scam lists that appears in the text.
  function knownMatches(text, lists) {
    var found = [];
    [].concat(lists || []).forEach(function (known) {
      if (!known) return;
      var index = buildIndex(known);
      var add = function (label) { if (label && found.indexOf(label) === -1) found.push(label); };
      var lower = text.toLowerCase();
      eachMatch(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi, text, function (m) {
        var parts = m[0].toLowerCase().split('.');
        for (var i = 0; i < parts.length - 1; i++) add(index.domains[parts.slice(i).join('.')]);
      });
      eachMatch(/[A-Za-z0-9]{20,}/g, text, function (m) { add(index.evm[m[0].toLowerCase()]); add(index.addresses[m[0]]); });
      eachMatch(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi, text, function (m) { add(index.emails[m[0].toLowerCase()]); });
      eachMatch(/(?:^|[^A-Za-z0-9._%+-])(?:@|t\.me\/|telegram\.me\/)([A-Za-z0-9_]{3,32})/gi, text, function (m) { add(index.handles[m[1].toLowerCase()]); });
      eachMatch(/\+?\d[\d\s().-]{5,18}\d/g, text, function (m) { add(index.phones[phoneKey(m[0])]); });
      index.pages.forEach(function (p) {
        var at = lower.indexOf(p.page);
        while (at !== -1) {
          var before = at === 0 ? '' : lower.charAt(at - 1);
          var after = lower.charAt(at + p.page.length);
          if (!/[a-z0-9.-]/.test(before) && !/[a-z0-9_-]/.test(after)) return add(p.label);
          at = lower.indexOf(p.page, at + 1);
        }
      });
      if (index.phrases.length) {
        var words = normalizeWords(text);
        index.phrases.forEach(function (p) { if (words.indexOf(p.words) !== -1) add(p.label); });
      }
    });
    return found;
  }

  var api = {
    check: check,
    highlight: highlight,
    detectSecret: detectSecret,
    findHosts: findHosts,
    parseList: parseList,
    knownMatches: knownMatches,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScamChecker = api;
})(this);
