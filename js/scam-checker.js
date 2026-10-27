// The "Check a message" logic for Spot the Scam.
// Runs entirely in the browser. It only reads the text it is given: it never
// opens, visits or fetches anything, and it does not store anything.
// The rules themselves live in data/scam-rules.js.

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

  var SEED_MIN_WORDS = 12;
  var NUMBERING = /^\(?\d{1,2}[.):]?$/; // "1." "2)" "(3)" "4" "5:"
  var PLAIN_WORD = /^[a-z]{3,8}$/;

  function looksLikeSeedPhrase(text) {
    var run = 0;
    var tokens = text.split(/\s+/);
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t || NUMBERING.test(t)) continue;
      if (PLAIN_WORD.test(t) && COMMON_WORDS.indexOf(t) === -1) {
        run++;
        if (run >= SEED_MIN_WORDS) return true;
      } else {
        run = 0;
      }
    }
    return false;
  }

  // 64 hex characters (raw private key), or a long unbroken base58 string
  // (exported keys). Wallet addresses are shorter, so they do not trigger this.
  var HEX_KEY = /(^|[^0-9a-f])(0x)?[0-9a-f]{64}(?![0-9a-f])/i;
  var BASE58_KEY = /[1-9A-HJ-NP-Za-km-z]{50,}/;

  function looksLikePrivateKey(text) {
    return HEX_KEY.test(text) || BASE58_KEY.test(text);
  }

  // Returns 'seed', 'key' or null.
  function detectSecret(text) {
    if (looksLikeSeedPhrase(text)) return 'seed';
    if (looksLikePrivateKey(text)) return 'key';
    return null;
  }

  // ---------- Web addresses (read, never opened) ----------

  var KNOWN_ENDINGS = (
    'com org net io co app dev xyz top click site online live icu buzz cyou rest monster shop zip ' +
    'lol vip me gg ai finance exchange art info biz us uk link fi network money cc ly gl gd at tv ' +
    'to ee so pro tech space fun store club ws eu ca de fr es it nl ch au in jp io wallet crypto'
  ).split(' ');

  var DOMAIN = /(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24}))(?=[\/\s:?#)"'\],.!]|$)/gi;

  function findDomains(text) {
    var found = [];
    var m;
    DOMAIN.lastIndex = 0;
    while ((m = DOMAIN.exec(text))) {
      var host = m[1].toLowerCase().replace(/^www\./, '');
      var ending = m[2].toLowerCase();
      if (KNOWN_ENDINGS.indexOf(ending) === -1) continue;
      if (found.indexOf(host) === -1) found.push(host);
    }
    return found;
  }

  function stripDomains(text) {
    return text.replace(DOMAIN, function (all, host, ending) {
      return KNOWN_ENDINGS.indexOf(ending.toLowerCase()) === -1 ? all : ' ';
    });
  }

  function domainReasons(host, cfg) {
    var reasons = [];
    // The main part of the name: "puddle-wallet-verify" in help.puddle-wallet-verify.xyz.
    var labels = host.split('.');
    var name = labels[labels.length - 2] || '';
    if (cfg.shorteners.some(function (s) { return host === s || host.slice(-(s.length + 1)) === '.' + s; })) {
      reasons.push('a shortened link that hides where it goes');
    }
    if (cfg.riskyEndings.some(function (e) { return host.slice(-e.length) === e; })) {
      reasons.push('an unusual ending (' + host.slice(host.lastIndexOf('.')) + ')');
    }
    var word = cfg.riskyWords.filter(function (w) { return name.indexOf(w) !== -1; })[0];
    if (word) reasons.push('an official-sounding extra word ("' + word + '")');
    if (host.indexOf('xn--') !== -1) reasons.push('disguised characters');
    if (/[a-z][0-9][a-z]/.test(name)) reasons.push('a number where a letter should be');
    if ((name.match(/-/g) || []).length >= 2) reasons.push('several dashes, common in lookalike names');
    return reasons;
  }

  // ---------- Matching helpers ----------

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function keywordRegExp(keyword) {
    var start = /^[a-z0-9]/i.test(keyword) ? '(?:^|[^a-z0-9])' : '';
    var end = /[a-z0-9]$/i.test(keyword) ? '(?=$|[^a-z0-9])' : '';
    return new RegExp(start + escapeRegExp(keyword) + end, 'i');
  }

  function clip(s) {
    s = s.replace(/\s+/g, ' ').trim();
    return s.length > 50 ? s.slice(0, 47) + '...' : s;
  }

  // True when the words just before `index`, in the same part of the sentence,
  // include a negation such as "never" or "no".
  function isNegated(source, index, negations) {
    var before = source.slice(Math.max(0, index - 60), index);
    var clause = before.split(/[.,;:!?\n]/).pop();
    var words = clause.toLowerCase().split(/\s+/).filter(Boolean).slice(-6);
    return words.some(function (w) { return negations.indexOf(w) !== -1; });
  }

  function keywordFound(keyword, source, negations) {
    if (!negations) return keywordRegExp(keyword).test(source);
    var re = new RegExp(keywordRegExp(keyword).source, 'gi');
    var m;
    while ((m = re.exec(source))) {
      if (!isNegated(source, m.index + 1, negations)) return true;
    }
    return false;
  }

  function matchRule(rule, text, textNoLinks, negations) {
    var source = rule.ignoreLinks ? textNoLinks : text;
    var skip = rule.skipIfNegated ? negations : null;
    var matches = [];
    (rule.keywords || []).forEach(function (k) {
      if (keywordFound(k, source, skip)) matches.push(k);
    });
    (rule.patterns || []).forEach(function (p) {
      var m = source.match(new RegExp(p, rule.patternsCaseSensitive ? '' : 'i'));
      if (m && m[0].trim()) matches.push(clip(m[0]));
    });
    if (rule.domains) {
      findDomains(text).forEach(function (host) {
        var reasons = domainReasons(host, rule.domains);
        if (reasons.length) matches.push(host + ': ' + reasons.join(', '));
      });
    }
    // Remove duplicates, keep order.
    return matches.filter(function (m, i) { return matches.indexOf(m) === i; });
  }

  // ---------- Known scam list ----------

  // Turns the one-per-line lists in data/scam-known.js into entries.
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

  // Phone numbers are compared by their last 9 digits, so "+44 7700 900123",
  // "07700900123" and "7700-900-123" all match each other.
  function phoneKey(value) {
    var digits = String(value).replace(/\D/g, '');
    return digits.length >= 9 ? digits.slice(-9) : digits;
  }

  // Lowercase words separated by single spaces, so capitals and punctuation
  // do not stop a phrase from matching.
  function normalizeWords(text) {
    return ' ' + String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  }

  // Builds quick lookup tables from a list once, so long lists stay fast.
  var indexCache = [];

  function buildIndex(known) {
    for (var i = 0; i < indexCache.length; i++) if (indexCache[i].known === known) return indexCache[i].index;
    var index = { domains: {}, pages: [], evm: {}, addresses: {}, emails: {}, handles: {}, phones: {}, phrases: [] };
    var note = function (e) { return e.note || known.defaultNote || ''; };
    parseList(known.domains).forEach(function (e) {
      var d = cleanDomain(e.value);
      var page = e.value.toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
      // In lists marked matchPaths (the public feed), an entry with a path is one
      // page on a shared platform: match only that page. Elsewhere the path is
      // ignored and the whole website is listed.
      if (known.matchPaths && page.indexOf('/') !== -1) index.pages.push({ page: page, label: withNote(page, note(e)) });
      else if (d) index.domains[d] = withNote(d, note(e));
    });
    parseList(known.addresses).forEach(function (e) {
      if (/^0x[0-9a-f]{40}$/i.test(e.value)) index.evm[e.value.toLowerCase()] = withNote(e.value, note(e));
      else index.addresses[e.value] = withNote(e.value, note(e));
    });
    parseList(known.emails).forEach(function (e) {
      index.emails[e.value.toLowerCase()] = withNote(e.value, note(e));
    });
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

  // Lists everything from the known scam lists that appears in the text.
  // `lists` is one list or several (your own list and the public feed).
  function knownMatches(text, lists) {
    var found = [];
    [].concat(lists || []).forEach(function (known) {
      if (known) matchList(text, buildIndex(known), found);
    });
    return found;
  }

  function matchList(text, index, found) {
    var add = function (label) { if (label && found.indexOf(label) === -1) found.push(label); };
    var lower = text.toLowerCase();

    // Web addresses: the name itself or anything under it (app.name, help@name).
    eachMatch(/[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi, text, function (m) {
      var parts = m[0].toLowerCase().split('.');
      for (var i = 0; i < parts.length - 1; i++) add(index.domains[parts.slice(i).join('.')]);
    });
    // Wallet addresses: 0x ones whatever the capitals, others exactly.
    eachMatch(/[A-Za-z0-9]{20,}/g, text, function (m) {
      add(index.evm[m[0].toLowerCase()]);
      add(index.addresses[m[0]]);
    });
    // Email addresses.
    eachMatch(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi, text, function (m) {
      add(index.emails[m[0].toLowerCase()]);
    });
    // Chat usernames, written as @name or t.me/name.
    eachMatch(/(?:^|[^A-Za-z0-9._%+-])(?:@|t\.me\/|telegram\.me\/)([A-Za-z0-9_]{3,32})/gi, text, function (m) {
      add(index.handles[m[1].toLowerCase()]);
    });
    // Phone numbers, however they are written.
    eachMatch(/\+?\d[\d\s().-]{5,18}\d/g, text, function (m) {
      add(index.phones[phoneKey(m[0])]);
    });
    // Single pages on shared platforms, like sites.google.com/view/fake-wallet.
    index.pages.forEach(function (p) {
      var at = lower.indexOf(p.page);
      while (at !== -1) {
        var before = at === 0 ? '' : lower.charAt(at - 1);
        var after = lower.charAt(at + p.page.length);
        if (!/[a-z0-9.-]/.test(before) && !/[a-z0-9_-]/.test(after)) return add(p.label);
        at = lower.indexOf(p.page, at + 1);
      }
    });
    // Scam phrases.
    if (index.phrases.length) {
      var words = normalizeWords(text);
      index.phrases.forEach(function (p) { if (words.indexOf(p.words) !== -1) add(p.label); });
    }
  }

  // ---------- The check ----------

  // Returns either { blocked: 'seed' | 'key' } or
  // { flags: [{ rule, found }], count, weight, level: 'many' | 'some' | 'none', label, note }
  // `known` (optional) is a known scam list, or several: data/scam-known.js
  // and data/scam-feed.js. The flag wording comes from the first one that has it.
  function check(text, data, known) {
    text = String(text || '');
    var secret = detectSecret(text);
    if (secret) return { blocked: secret };

    var textNoLinks = stripDomains(text);
    var hits = {};
    var flags = [];

    // Simple rules first, then rules that depend on others.
    var ordered = data.rules.filter(function (r) { return !r.requires; })
      .concat(data.rules.filter(function (r) { return r.requires; }));

    ordered.forEach(function (rule) {
      if (rule.requires && !rule.requires.every(function (id) { return hits[id]; })) return;
      var found = matchRule(rule, text, textNoLinks, data.negations || []);
      if (found.length < (rule.minMatches || 1)) return;
      hits[rule.id] = true;
      flags.push({ rule: rule, found: found.slice(0, 4) });
    });

    flags.sort(function (a, b) { return b.rule.weight - a.rule.weight; });

    // A match on the known scam list always comes first and always counts as many.
    var knownFound = knownMatches(text, known);
    if (knownFound.length) {
      var f = [].concat(known).filter(function (k) { return k && k.flag; })[0];
      f = (f && f.flag) || {};
      flags.unshift({
        rule: { id: 'known-scam', name: f.name, why: f.why, todo: f.todo, weight: 3 },
        found: knownFound,
      });
    }

    var weight = flags.reduce(function (sum, f) { return sum + f.rule.weight; }, 0);
    var labels = data.labels;
    var level = !flags.length ? 'none'
      : knownFound.length || weight >= labels.manyAt || flags.length >= labels.manyCount ? 'many' : 'some';

    return {
      flags: flags,
      count: flags.length,
      weight: weight,
      level: level,
      label: labels[level],
      note: level === 'none' ? labels.noneNote : '',
    };
  }

  var api = {
    check: check,
    detectSecret: detectSecret,
    findDomains: findDomains,
    parseList: parseList,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ScamChecker = api;
})(this);
