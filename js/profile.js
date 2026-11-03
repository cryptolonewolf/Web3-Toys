// My Progress, the compact profile: one screen on phones.
// Top row: picture, name, rank and coins. Then stats, the next rank, a
// "Continue playing" row and small tabs: Certificates, Extras, Purchases and
// Settings. Works for visitors (this browser) and logged-in players (their
// account, through js/sync.js). Words for extras: data/cosmetics.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var ME_KEY = 'web3toys.me.v1';
  var TABS = [['certs', 'Certificates'], ['extras', 'Extras'], ['purchases', 'Purchases'], ['settings', 'Settings']];
  var home = null;
  var ranks = null;
  var cosmetics = null;
  var tab = tabFromHash();
  var say = '';

  Promise.all([C.loadJson('../data/home.json'), C.loadJson('../data/ranks.json'), C.loadJson('../data/cosmetics.json')]).then(function (r) {
    home = r[0];
    ranks = r[1].ranks;
    cosmetics = r[2];
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  // Re-draw when the account loads, logs out or finishes syncing.
  document.addEventListener('web3auth:ready', function () { window.Web3Auth.onChange(function () { if (home) render(); }); });
  document.addEventListener('web3toys:synced', function () { if (home) render(); });
  document.addEventListener('web3toys:purchased', function () { orders = null; if (home) render(); });
  document.addEventListener('web3pay:ready', function () { if (home && tab === 'purchases') render(); });
  document.addEventListener('web3auth:ready', function () { window.Web3Auth.onChange(function () { orders = null; }); });
  window.addEventListener('hashchange', function () { tab = tabFromHash(); if (home) render(); });

  function tabFromHash() {
    var h = location.hash.replace('#', '');
    if (h === 'coins') return 'extras';
    return TABS.some(function (t) { return t[0] === h; }) ? h : 'certs';
  }

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }

  // Visitors get their own cartoon picture too, kept in this browser.
  function visitorSeed() {
    var me = read(ME_KEY, null);
    if (!me || !me.seed) {
      me = { seed: Web3Avatar.newSeed() };
      try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch (e) { /* private mode */ }
    }
    return me.seed;
  }

  function toyCards() {
    var out = [];
    home.shelves.forEach(function (s) {
      s.cards.forEach(function (c) { if (c.status === 'live' && c.kind !== 'tool' && c.kind !== 'academy') out.push(c); });
    });
    return out;
  }

  function streak(claimed) {
    var days = {};
    Object.keys(claimed).forEach(function (id) { if (id.indexOf('daily:') === 0) days[id.slice(6)] = true; });
    var d = new Date();
    var key = function (x) { return x.toISOString().slice(0, 10); };
    if (!days[key(d)]) d.setUTCDate(d.getUTCDate() - 1);
    var n = 0;
    while (days[key(d)]) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  }

  function state() {
    var A = window.Web3Auth;
    var user = A && A.user();
    var profile = A && A.profile();
    var progress = Web3Progress.load(localStorage);
    var w = site.coins.wallet();
    var certs = Object.keys(progress.certificates).map(function (k) { return progress.certificates[k]; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var toys = toyCards();
    var done = toys.filter(function (c) { return progress.certificates[c.id] || w.claimed['finish:' + c.id]; });
    var n = Web3Progress.count(progress);
    return {
      A: A, user: user, profile: profile, w: w,
      certs: certs.filter(function (c) { return String(c.toy).indexOf('academy:') !== 0; }),
      pros: certs.filter(function (c) { return String(c.toy).indexOf('academy:') === 0; }),
      toys: toys, done: done,
      next: toys.filter(function (c) { return done.indexOf(c) < 0; }),
      n: n, rank: Web3Progress.rankFor(n, ranks), nextRank: Web3Progress.nextRank(n, ranks),
      streak: streak(w.claimed || {}),
      cx: read('web3toys.cosmetics.v1', { owned: [] }),
    };
  }

  function render() {
    var s = state();
    var name = s.user ? (s.profile && s.profile.display_name) || 'Player' : 'Visitor';
    var avatar = s.user && s.A.avatarHtml ? s.A.avatarHtml(64, 'pf-avatar')
      : '<img class="acct-avatar pf-avatar" src="' + Web3Avatar.dataUri(visitorSeed()) + '" alt="" width="64" height="64" />';
    var lvl = Web3Progress.level(s.rank, ranks);
    var pct = s.nextRank ? Math.round((s.n / s.nextRank.min) * 100) : 100;

    app.innerHTML =
      '<section class="card pf-head">' + avatar +
      '<div class="pf-who"><h1 class="pf-name">' + esc(name) + '</h1>' + C.rankBadge(s.rank, lvl) + '</div>' +
      '<a class="pf-coins" href="#extras" aria-label="' + s.w.balance + ' coins">' + site.icon('coin') + '<b data-coin-count>' + s.w.balance.toLocaleString('en-US') + '</b></a>' +
      '<div class="pf-next"><div class="meter" role="img" aria-label="' + pct + ' percent to the next rank"><span style="width:' + pct + '%"></span></div>' +
      '<p class="small-print">' + (s.nextRank ? (s.nextRank.min - s.n) + ' more certificate' + (s.nextRank.min - s.n === 1 ? '' : 's') + ' to ' + esc(s.nextRank.name) : 'Top rank reached') +
      (s.user ? '' : ' · <button type="button" class="text-button" data-login>Log in to save</button>') + '</p></div></section>' +

      '<ul class="pf-stats">' +
      stat(s.done.length + '/' + s.toys.length, 'Toys done') + stat(s.certs.length, 'Certificates') + stat(s.pros.length, 'Pro tags') + stat(s.streak + (s.streak === 1 ? ' day' : ' days'), 'Streak') +
      '</ul>' +

      (s.next.length ? '<section class="pf-row-wrap"><h2 class="pf-h">Continue playing</h2><ul class="pf-row pf-row--toys">' + s.next.slice(0, 8).map(function (c) {
        return '<li><a class="xcard xcard--' + esc(c.id) + ' pf-toy" href="../' + esc(c.path) + '" aria-label="' + esc(c.title) + '">' + (Web3Cards.card(c.id, c.title, esc) || '<span class="xtitle">' + esc(c.title) + '</span>') + '</a></li>';
      }).join('') + '</ul></section>' : '') +

      '<div class="pf-tabs" role="tablist" aria-label="My Progress">' + TABS.map(function (t) {
        var on = t[0] === tab;
        return '<button type="button" role="tab" id="tab-' + t[0] + '" class="pf-tab' + (on ? ' is-on' : '') + '" aria-selected="' + on + '" aria-controls="panel-' + t[0] + '" tabindex="' + (on ? 0 : -1) + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<section class="pf-panel" role="tabpanel" id="panel-' + tab + '" aria-labelledby="tab-' + tab + '">' + ({ certs: certsPanel, extras: extrasPanel, purchases: purchasesPanel, settings: settingsPanel })[tab](s) + '</section>' +
      '<p class="small-print pf-say" data-say aria-live="polite">' + esc(say) + '</p>';

    applyTheme(s.user ? s.cx.theme : null);
    bind(s);
  }

  function stat(value, label) {
    return '<li><b>' + esc(String(value)) + '</b><span>' + esc(label) + '</span></li>';
  }

  // ---------- Certificates ----------

  function certCard(c, pro) {
    var path = pro ? 'academy/course/?id=' + encodeURIComponent(c.toy.slice(8)) : (toyPath(c.toy) || '');
    return '<li class="pf-cert' + (pro ? ' pf-cert--pro' : '') + '"><span class="pf-cert-score">' + c.score + '%</span>' +
      '<b>' + esc(c.title || c.toy) + '</b><span class="small-print">' + esc(c.date) + '</span>' +
      '<span class="pf-cert-links"><a href="../' + esc(path) + '#certificate">View</a> · <a href="../verify/?code=' + encodeURIComponent(c.code) + '&name=' + encodeURIComponent(c.name) + '">Verify</a></span></li>';
  }

  function toyPath(id) {
    var p = null;
    home.shelves.forEach(function (s) { s.cards.forEach(function (c) { if (c.id === id) p = c.path; }); });
    return p;
  }

  function certsPanel(s) {
    return '<h3 class="pf-h">Toy certificates</h3>' +
      (s.certs.length ? '<ul class="pf-row">' + s.certs.map(function (c) { return certCard(c, false); }).join('') + '</ul>'
        : '<p class="text pf-empty">None yet. Pass the quiz at the end of a toy to earn one.</p>') +
      '<h3 class="pf-h">Pro tags</h3>' +
      (s.pros.length ? '<ul class="pf-row">' + s.pros.map(function (c) { return certCard(c, true); }).join('') + '</ul>'
        : '<p class="text pf-empty">Earn Pro tags in the <a href="../academy/">Project Academy</a>. They count toward your rank.</p>') +
      '<details class="pf-more"><summary class="small-print">All ranks</summary><ol class="rank-ladder">' + ranks.map(function (r, i) {
        return '<li class="' + (r === s.rank ? 'is-current' : s.n >= r.min ? 'is-done' : '') + '">' + C.rankBadge(r, i + 1) + '<span class="small-print">' + r.min + (r.min === 1 ? ' certificate' : ' certificates') + '</span></li>';
      }).join('') + '</ol></details>';
  }

  // ---------- Extras (coins) ----------

  function swatch(it) {
    var bg = it.color2 ? 'linear-gradient(135deg, ' + it.color + ', ' + it.color2 + ', ' + it.color + ')' : it.color;
    return '<span class="cx-swatch cx-swatch--' + it.slot + '" style="--sw:' + esc(bg) + '" aria-hidden="true"></span>';
  }

  function extrasPanel(s) {
    var wearing = { cert: s.cx.cert, frame: s.cx.frame, theme: s.cx.theme };
    return '<p class="cx-nocash">' + esc(cosmetics.noCash) + '</p>' +
      (s.user ? '' : '<p class="text pf-empty">Log in to unlock extras with your coins. <button type="button" class="btn btn--small" data-login>Log in</button></p>') +
      cosmetics.slots.map(function (slot) {
        return '<h3 class="pf-h">' + esc(slot.title) + ' <span class="small-print">' + esc(slot.line) + '</span></h3><ul class="pf-row pf-row--cx">' +
          cosmetics.items.filter(function (it) { return it.slot === slot.id; }).map(function (it) {
            var owned = s.cx.owned.indexOf(it.id) >= 0;
            var worn = wearing[slot.id] === it.id;
            var action = !s.user ? '<span class="small-print">' + site.icon('coin') + it.coins + '</span>'
              : worn ? '<button type="button" class="btn btn--small" data-wear="' + slot.id + '" data-item="">Wearing ✓</button>'
              : owned ? '<button type="button" class="btn btn--small btn--yellow" data-wear="' + slot.id + '" data-item="' + it.id + '">Wear</button>'
              : '<button type="button" class="btn btn--small" data-buy="' + it.id + '"' + (s.w.balance < it.coins ? ' disabled' : '') + '>' + site.icon('coin') + it.coins + '</button>';
            return '<li class="cx-item' + (worn ? ' is-on' : '') + '">' + swatch(it) + '<b>' + esc(it.title) + '</b>' + action + '</li>';
          }).join('') + '</ul>';
      }).join('') +
      '<details class="pf-more"><summary class="small-print">How to earn coins</summary><ul class="lesson-points">' + cosmetics.how.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul></details>' +
      (s.w.history.length ? '<details class="pf-more coins-history"><summary class="small-print">Coin history</summary><ul>' + s.w.history.map(function (h) {
        return '<li><span>' + esc(h.label) + '</span><b class="' + (h.coins < 0 ? 'is-spent' : '') + '">' + (h.coins > 0 ? '+' : '') + h.coins + '</b></li>';
      }).join('') + '</ul></details>' : '') +
      '<p class="small-print">' + (s.user ? 'Saved to your account, on every device.' : 'Saved in this browser only.') + ' <a href="../leaderboard/">See the leaderboard</a></p>';
  }

  // ---------- Purchases ----------
  // Paid orders come from the account (js/pay.js); drawn once they load.

  var orders = null;
  var catalog = null;

  function loadPurchases() {
    var P = window.Web3Pay;
    if (!P) return;
    Promise.all([P.purchases(), P.products()]).then(function (r) {
      orders = r[0];
      catalog = r[1];
      if (tab === 'purchases') render();
    }, function () { orders = []; if (tab === 'purchases') render(); });
  }

  function money(o) {
    var n = o.amount / 100;
    return o.currency === 'INR' ? '₹' + n.toLocaleString('en-IN') : '$' + n.toFixed(2);
  }

  // Back from the crypto checkout: check the order, then every 20 seconds
  // for a few minutes while the blockchain confirms it.
  var cryptoNote = '';
  var cryptoTries = 0;

  function watchCrypto() {
    var id = new URLSearchParams(location.search).get('order');
    try { id = id || localStorage.getItem('web3toys.cryptoOrder.v1'); } catch (e) { /* private mode */ }
    var P = window.Web3Pay;
    if (!id || !P || !P.crypto || !/^[0-9a-f-]{36}$/i.test(id) || !window.Web3Auth.user()) return;
    P.checkCrypto(id).then(function (r) {
      if (r.status === 'paid') { cryptoNote = 'Crypto payment confirmed. Thank you!'; site.fx.confetti(); }
      else if (r.status === 'failed') { cryptoNote = 'That crypto payment did not complete. You were not charged unless funds were sent; if they were, contact us.'; try { localStorage.removeItem('web3toys.cryptoOrder.v1'); } catch (e) { /* ok */ } }
      else {
        cryptoNote = r.waiting ? 'Payment seen. Waiting for blockchain confirmations… this page updates by itself.' : 'Waiting for your crypto payment… this page updates by itself.';
        if (++cryptoTries < 30) setTimeout(watchCrypto, 20000);
      }
      if (home && tab === 'purchases') render();
    }, function () { /* try again on the next visit */ });
  }
  document.addEventListener('web3pay:ready', function () { window.Web3Auth.onChange(function (u) { if (u) watchCrypto(); }); });

  function purchasesPanel(s) {
    if (!s.user) {
      return '<div class="pf-empty-box"><p class="text">Log in to buy and keep your reports, HD certificates and books, with a download button here.</p>' +
        (s.A ? '<button type="button" class="btn btn--small" data-login>Log in</button>' : '') + '</div>';
    }
    var note = cryptoNote ? '<p class="tk-warn' + (/confirmed/.test(cryptoNote) ? ' is-good' : '') + '">' + esc(cryptoNote) + '</p>' : '';
    if (!orders) { loadPurchases(); return note + '<p class="small-print">Loading your purchases…</p>'; }
    if (!orders.length) {
      return note + '<div class="pf-empty-box"><p class="text">No purchases yet. Reports, HD certificates and books you buy will show here, with a download button.</p>' +
        '<a class="btn btn--small" href="../books/">See the books</a></div>';
    }
    var byId = {};
    (catalog || []).forEach(function (p) { byId[p.id] = p; });
    return note + '<ul class="pf-buys">' + orders.map(function (o) {
      var p = byId[o.product_id] || {};
      var action = o.status === 'refunded' ? '<span class="chip is-white">Refunded</span>'
        : p.file ? '<button type="button" class="btn btn--small btn--yellow" data-dl="' + esc(o.id) + '">Download</button>'
        : p.type === 'call' && window.Web3Pay.callUrl() ? '<a class="btn btn--small btn--yellow" href="' + esc(window.Web3Pay.callUrl(o.id)) + '" target="_blank" rel="noopener">Pick your time</a>'
        : '<span class="chip is-mint">Unlocked</span>';
      return '<li><div><b>' + esc(o.title) + '</b><span class="small-print">' + esc(String(o.paid_at || '').slice(0, 10)) + ' · ' + money(o) + '</span></div>' + action + '</li>';
    }).join('') + '</ul><p class="small-print">Download links work for 5 minutes; tap Download again any time for a fresh one. <a href="../refunds/">Refunds and delivery</a></p>';
  }

  // ---------- Settings ----------

  function settingsPanel(s) {
    var A = s.A;
    return (s.user
      ? '<form class="stack stack--tight" data-name><label class="label" for="pf-name">Display name (shown on the leaderboard)</label>' +
        '<div class="lk-row"><input id="pf-name" class="field" maxlength="40" value="' + esc((s.profile && s.profile.display_name) || '') + '" /><button type="submit" class="btn btn--small">Save</button></div></form>' +
        '<div class="btn-row"><button type="button" class="btn btn--small" data-shuffle="avatar">🎲 New picture</button><button type="button" class="btn btn--small" data-shuffle="name">🎲 New name</button></div>' +
        '<p class="small-print">Logged in with ' + esc(provider(s.profile)) + '.</p>' +
        '<div class="btn-row"><button type="button" class="btn btn--small" data-logout>Log out</button>' +
        '<button type="button" class="btn btn--small acct-danger" data-delete>Delete my account and data</button></div>'
      : '<p class="text">Playing without an account. Your progress is saved in this browser only.</p>' +
        (A ? '<div class="btn-row"><button type="button" class="btn btn--ink" data-login>Log in or sign up</button></div>' : '')) +
      '<div class="pf-setting"><span class="text">Sound effects</span>' + site.sound.button() + '</div>' +
      (!s.user && (s.certs.length || s.pros.length) ? '<button type="button" class="text-button" data-clear>Clear my progress in this browser</button>' : '') +
      '<p class="small-print"><a href="../privacy/">Privacy</a> · <a href="../terms/">Terms</a></p>';
  }

  function provider(p) {
    var v = (p && p.provider) || 'email';
    return { x: 'X', twitter: 'X', google: 'Google', email: 'email' }[v] || v;
  }

  // ---------- Buttons ----------

  function bind(s) {
    var A = s.A;
    var msg = function (t) { say = t; var el = app.querySelector('[data-say]'); if (el) el.textContent = t; };
    app.querySelectorAll('[data-tab]').forEach(function (b, i, all) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        var next = all[(i + d + all.length) % all.length];
        setTab(next.getAttribute('data-tab'));
        app.querySelector('[data-tab="' + next.getAttribute('data-tab') + '"]').focus();
      });
    });
    app.querySelectorAll('[data-login]').forEach(function (b) { b.addEventListener('click', function () { A && A.open(); }); });
    var coins = app.querySelector('.pf-coins');
    coins.addEventListener('click', function (e) { e.preventDefault(); setTab('extras'); });

    app.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = cosmetics.items.filter(function (x) { return x.id === b.getAttribute('data-buy'); })[0];
        if (!window.confirm('Unlock ' + it.title + ' for ' + it.coins + ' coins?')) return;
        b.disabled = true;
        window.Web3Sync.buy(it.id).then(function () { say = 'Unlocked ' + it.title + '. Tap Wear to use it.'; site.sound.play('ding'); render(); },
          function (err) { say = 'Could not unlock it: ' + err.message; render(); });
      });
    });
    app.querySelectorAll('[data-wear]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        window.Web3Sync.equip(b.getAttribute('data-wear'), b.getAttribute('data-item') || null).then(function () { say = ''; render(); },
          function (err) { say = 'Could not change it: ' + err.message; render(); });
      });
    });

    var form = app.querySelector('[data-name]');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      A.setName(app.querySelector('#pf-name').value).then(function () { say = 'Saved.'; render(); }, function (err) { msg('Could not save: ' + err.message); });
    });
    app.querySelectorAll('[data-shuffle]').forEach(function (b) {
      b.addEventListener('click', function () {
        A.shuffle(b.getAttribute('data-shuffle')).then(function () { say = ''; site.sound.play('pop'); render(); }, function (err) { msg('Could not change it: ' + err.message); });
      });
    });
    var out = app.querySelector('[data-logout]');
    if (out) out.addEventListener('click', function () { A.signOut(); });
    var del = app.querySelector('[data-delete]');
    if (del) del.addEventListener('click', function () {
      var typed = window.prompt('This deletes your account, progress, coins and certificates for good, and clears web3.toys data in this browser. Purchase records we must keep by law stay. Type DELETE to confirm.');
      if (typed !== 'DELETE') return msg('Nothing was deleted.');
      msg('Deleting…');
      A.deleteAccount().then(function () { location.reload(); }, function (err) { msg('Could not delete: ' + err.message + '. Email us from the Contact page and we will do it.'); });
    });
    app.querySelectorAll('[data-dl]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        window.Web3Pay.download(b.getAttribute('data-dl')).then(function () { b.disabled = false; },
          function (err) { b.disabled = false; msg(err.message); });
      });
    });
    var clear = app.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', function () {
      if (!window.confirm('Remove all certificates from this browser? Codes already shared still verify.')) return;
      Web3Progress.save(localStorage, { name: '', certificates: {} });
      render();
    });
  }

  function setTab(id) {
    tab = id;
    say = '';
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    render();
  }

  function applyTheme(theme) {
    if (theme) document.body.setAttribute('data-theme', theme);
    else document.body.removeAttribute('data-theme');
  }
})();
