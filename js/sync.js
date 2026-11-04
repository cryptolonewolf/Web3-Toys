// Saved progress for logged-in players. Loaded with js/auth.js.
// Each sync: (1) the first time, move this browser's earlier coins into the
// account (once, capped); (2) send new certificates to the server, which
// checks their secret code before saving; (3) claim coins earned here that
// the account does not have yet (the database applies the rules); (4) copy
// the account's real totals back into this browser, so every toy keeps
// reading the same local data as before.

(function () {
  var A = window.Web3Auth;
  var site = window.WEB3TOYS;
  if (!A || !site) return;
  var db = A.client;
  var ROOT = site.root;
  var COINS_KEY = 'web3toys.coins.v1';
  var COSMETICS_KEY = 'web3toys.cosmetics.v1';
  var running = null;
  var again = false;
  var writing = false;
  var timer = null;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  function token() {
    return db.auth.getSession().then(function (r) { return r.data.session && r.data.session.access_token; });
  }

  function must(r) {
    if (r.error) throw r.error;
    return r.data;
  }

  // (2) Certificates in this browser that the account does not have yet.
  function pushCertificates(serverCerts) {
    var local = Web3Progress.load(localStorage).certificates;
    var have = {};
    serverCerts.forEach(function (c) { have[c.toy] = c.score; });
    var todo = Object.keys(local).filter(function (t) { return local[t].code && !(t in have && have[t] >= local[t].score); });
    return todo.reduce(function (p, t) {
      return p.then(function () {
        return token().then(function (tk) {
          return fetch(ROOT + 'api/save-cert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
            body: JSON.stringify({ code: local[t].code, name: local[t].name }),
          }).catch(function () { /* try again next sync */ });
        });
      });
    }, Promise.resolve()).then(function () { return todo.length; });
  }

  function fetchCertificates() {
    return db.from('certificates').select('toy,title,score,code,name,cert_date').then(must);
  }

  function fetchLedger() {
    return db.from('coin_ledger').select('claim_id,kind,coins,label,created_at').order('created_at', { ascending: false }).limit(500).then(must);
  }

  // (3) Coins earned in this browser that the account has not seen.
  function pushCoins(ledger) {
    var seen = {};
    ledger.forEach(function (l) { seen[l.claim_id] = true; });
    var w = readJson(COINS_KEY, { balance: 0, claimed: {}, history: [] });
    var labels = {};
    (w.history || []).forEach(function (h) { if (h.id) labels[h.id] = h.label; });
    var todo = Object.keys(w.claimed || {}).filter(function (id) { return !seen[id] && id.indexOf('buy:') !== 0; });
    return todo.reduce(function (p, id) {
      var kind = id.split(':')[0];
      var key = id.slice(kind.length + 1);
      return p.then(function () { return db.rpc('claim_coins', { p_kind: kind, p_key: key, p_label: labels[id] || '' }); });
    }, Promise.resolve()).then(function () { return todo.length; });
  }

  // (4) The account's totals become this browser's copy.
  function pull(profile) {
    return Promise.all([fetchCertificates(), fetchLedger(), db.rpc('my_coins').then(must)]).then(function (r) {
      var certs = r[0];
      var ledger = r[1];
      var balance = r[2] || 0;
      writing = true;
      var progress = Web3Progress.load(localStorage);
      certs.forEach(function (c) {
        Web3Progress.addCertificate(progress, { toy: c.toy, title: c.title, score: c.score, code: c.code, name: c.name, date: c.cert_date, pro: c.toy.indexOf('academy:') === 0 || undefined });
      });
      Web3Progress.save(localStorage, progress);
      var w = readJson(COINS_KEY, { balance: 0, claimed: {}, history: [] });
      var claimed = {};
      ledger.forEach(function (l) { claimed[l.claim_id] = Date.parse(l.created_at); });
      // Claims the account refused (daily limits) stay claimed here, so they
      // are not offered again, but they add nothing to the balance.
      Object.keys(w.claimed || {}).forEach(function (id) { if (!claimed[id]) claimed[id] = w.claimed[id]; });
      writeJson(COINS_KEY, {
        balance: balance,
        claimed: claimed,
        history: ledger.slice(0, 50).map(function (l) { return { id: l.claim_id, at: l.created_at.slice(0, 10), label: l.label, coins: l.coins }; }),
        account: true,
      });
      var owned = ledger.filter(function (l) { return l.kind === 'buy'; }).map(function (l) { return l.claim_id.slice(4); });
      writeJson(COSMETICS_KEY, { owned: owned, cert: profile && profile.cert_style || null, frame: profile && profile.badge_frame || null, theme: profile && profile.theme || null });
      writing = false;
      site.coins.refresh();
      document.dispatchEvent(new CustomEvent('web3toys:synced'));
    });
  }

  function syncOnce() {
    var user = A.user();
    var profile = A.profile();
    if (!user || !profile) return Promise.resolve();
    var first = profile.merged_at ? Promise.resolve() : fetchCertificates().then(pushCertificates).then(function () {
      var w = readJson(COINS_KEY, { claimed: {}, history: [] });
      var labels = {};
      (w.history || []).forEach(function (h) { if (h.id) labels[h.id] = h.label; });
      var claims = Object.keys(w.claimed || {}).map(function (id) { return { id: id, label: labels[id] || '' }; });
      return db.rpc('merge_local_coins', { p_claims: claims }).then(must).then(function () { profile.merged_at = new Date().toISOString(); });
    });
    return first
      .then(fetchCertificates).then(pushCertificates)
      .then(fetchLedger).then(pushCoins)
      .then(function () { return referral(profile); })
      .then(function () { return pull(profile); });
  }

  // Invites: link a new player to whoever invited them (once), then check
  // whether they now qualify (a certificate and 3 finished toys).
  function referral(profile) {
    var code = null;
    try { code = localStorage.getItem('web3toys.ref.v1'); } catch (e) { /* private mode */ }
    var link = code && !profile.referred_by
      ? db.rpc('set_referrer', { p_code: code }).then(function (r) {
          if (r.data) profile.referred_by = 'set';
          try { localStorage.removeItem('web3toys.ref.v1'); } catch (e) { /* ok */ }
        })
      : Promise.resolve();
    return link.then(function () {
      if (!profile.referred_by || profile.referral_done) return;
      return db.rpc('check_referral').then(function (r) {
        if (r.data === 'paid' || r.data === 'capped') profile.referral_done = true;
      });
    }).catch(function () { /* try again next sync */ });
  }

  function sync() {
    if (running) { again = true; return running; }
    running = syncOnce().catch(function () { /* offline or not set up yet: try next time */ }).then(function () {
      running = null;
      if (again) { again = false; return sync(); }
    });
    return running;
  }

  // Coins or certificates changed in this browser: sync shortly after.
  document.addEventListener('web3toys:changed', function () {
    if (writing || !A.user()) return;
    clearTimeout(timer);
    timer = setTimeout(sync, 800);
  });

  A.onChange(function (user) { if (user) sync(); });

  // Cosmetic extras, used by My Progress.
  function rpcMsg(r) {
    if (r.error) throw new Error(r.error.message.replace(/^.*?: /, ''));
    return r.data;
  }

  window.Web3Sync = {
    sync: sync,
    buy: function (item) { return db.rpc('buy_cosmetic', { p_item: item }).then(rpcMsg).then(sync); },
    equip: function (slot, item) {
      return db.rpc('equip_cosmetic', { p_slot: slot, p_item: item }).then(rpcMsg).then(function () {
        var p = A.profile();
        if (p) p[{ cert: 'cert_style', frame: 'badge_frame', theme: 'theme' }[slot]] = item;
        return sync();
      });
    },
    claimQuest: function (id, proof) { return db.rpc('claim_quest', { p_id: id, p_proof: proof || null }).then(rpcMsg).then(function (n) { return sync().then(function () { return n; }); }); },
    referrals: function () { return db.rpc('my_referrals').then(rpcMsg).then(function (rows) { return rows[0]; }); },
    redeem: function (product, item) { return db.rpc('redeem_product', { p_product: product, p_item: item || null }).then(rpcMsg).then(function (id) { return sync().then(function () { return id; }); }); },
    leaderboard: function (n) { return db.rpc('leaderboard', { p_limit: n || 50 }).then(rpcMsg); },
  };
  document.dispatchEvent(new CustomEvent('web3sync:ready'));
})();
