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
  // Pop-ups for everything that is not needed at first sight.
  var SHEETS = { shop: '🛍️ Spend coins', extras: '🎨 Extras', purchases: '🧾 Purchases', settings: '⚙️ Settings', tasks: '🎯 All coin tasks', certs: '🏅 All certificates' };
  var BUTTONS = ['shop', 'extras', 'purchases', 'settings'];
  var home = null;
  var ranks = null;
  var cosmetics = null;
  var tab = sheetFromHash();
  var say = '';

  var quests = null;
  var productList = [];

  Promise.all([C.loadJson('../data/home.json'), C.loadJson('../data/ranks.json'), C.loadJson('../data/cosmetics.json'), C.loadJson('../data/quests.json'), C.loadJson('../data/products.json')]).then(function (r) {
    quests = r[3];
    productList = r[4].products;
    home = r[0];
    ranks = r[1].ranks;
    cosmetics = r[2];
    render();
    jump();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  // Re-draw when the account loads, logs out or finishes syncing.
  document.addEventListener('web3auth:ready', function () { window.Web3Auth.onChange(function () { if (home) render(); }); });
  document.addEventListener('web3toys:synced', function () { if (home) render(); });
  document.addEventListener('web3earlybird:change', function () { if (home) render(); });
  document.addEventListener('web3toys:purchased', function () { orders = null; if (home) render(); });
  document.addEventListener('web3pay:ready', function () { if (home && tab === 'purchases') render(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tab && home) closeSheet(); });
  document.addEventListener('web3auth:ready', function () { window.Web3Auth.onChange(function () { orders = null; }); });
  window.addEventListener('hashchange', function () { tab = sheetFromHash(); if (home) { render(); jump(); } });

  // Links ending in #shop, #extras, #purchases or #settings open that pop-up
  // (#coins and #earn just show the page: Earn coins is at the top).
  function sheetFromHash() {
    var h = location.hash.replace('#', '');
    return BUTTONS.indexOf(h) >= 0 ? h : null;
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
      streak: Web3EarnTasks.streak(w.claimed || {}),
      cx: read('web3toys.cosmetics.v1', { owned: [] }),
      certCount: certs.length,
    };
  }

  function render() {
    var s = state();
    var name = s.user ? (s.profile && s.profile.display_name) || 'Player' : 'Visitor';
    var avatar = s.user && s.A.avatarHtml ? s.A.avatarHtml(64, 'pf-avatar')
      : '<img class="acct-avatar pf-avatar" src="' + Web3Avatar.dataUri(visitorSeed()) + '" alt="" width="64" height="64" />';
    var lvl = Web3Progress.level(s.rank, ranks);
    var pct = s.nextRank ? Math.round((s.n / s.nextRank.min) * 100) : 100;

    // First screen: a slim profile strip, then the three things to act on
    // (Earn coins, Invite friends, Certificates). Below: Keep playing, then
    // tabs for Spend coins, Purchases and Settings.
    app.innerHTML =
      '<section class="card pf-head" aria-label="Your profile">' + avatar +
      '<div class="pf-who"><h1 class="pf-name">' + esc(name) + '</h1>' + C.rankBadge(s.rank, lvl) + '</div>' +
      '<a class="pf-coins" href="#shop" aria-label="' + s.w.balance + ' coins">' + site.icon('coin') + '<b data-coin-count>' + s.w.balance.toLocaleString('en-US') + '</b></a>' +
      '<div class="pf-next"><div class="meter" role="img" aria-label="' + pct + ' percent to the next rank"><span style="width:' + pct + '%"></span></div>' +
      '<p class="small-print">' + (s.nextRank ? (s.nextRank.min - s.n) + ' more certificate' + (s.nextRank.min - s.n === 1 ? '' : 's') + ' to ' + esc(s.nextRank.name) : 'Top rank reached') +
      (s.user ? '' : ' · <button type="button" class="text-button" data-login>Log in to save</button>') + '</p></div>' +
      '<ul class="pf-stats">' + stat(s.done.length + '/' + s.toys.length, 'Toys done') + stat(s.certs.length + s.pros.length, 'Certificates') + stat(s.streak + (s.streak === 1 ? ' day' : ' days'), 'Streak') + '</ul></section>' +
      (tab ? '' : '<p class="pf-say" data-say aria-live="polite">' + esc(say) + '</p>') +
      '<div class="pf-dash">' + earnCard(s) + inviteCard(s) + certsCard(s) + '</div>' +
      (s.next.length ? '<section class="pf-section pf-section--play" aria-labelledby="h-play"><h2 class="pf-card-title" id="h-play">🎮 Keep playing</h2><ul class="pf-row pf-row--toys">' + s.next.slice(0, 8).map(function (c) {
        return '<li><a class="xcard xcard--' + esc(c.id) + ' pf-toy" href="../' + esc(c.path) + '" aria-label="' + esc(c.title) + '">' + (Web3Cards.card(c.id, c.title, esc) || '<span class="xtitle">' + esc(c.title) + '</span>') + '</a></li>';
      }).join('') + '</ul></section>' : '') +
      '<nav class="pf-actions" aria-label="More">' + BUTTONS.map(function (id) {
        return '<button type="button" class="pf-action" data-sheet="' + id + '" aria-haspopup="dialog">' + esc(SHEETS[id]) + '</button>';
      }).join('') + '</nav>' +
      (tab ? sheetHtml(tab, s) : '');
    document.body.classList.toggle('has-sheet', Boolean(tab));

    applyTheme(s.user ? s.cx.theme : null);
    bind(s);
  }

  function card(id, title, extra, body) {
    return '<section class="card pf-card pf-card--' + id + '" id="' + id + '" aria-labelledby="h-' + id + '">' +
      '<div class="pf-card-head"><h2 class="pf-card-title" id="h-' + id + '">' + title + '</h2>' + (extra || '') + '</div>' + body + '</section>';
  }

  // Old links: #certs scrolls to the certificates, #coins and #earn to Earn
  // coins, #shop, #purchases and #settings to the tabs.
  function jump() {
    var h = location.hash.replace('#', '');
    var to = { certs: 'certs', certificates: 'certs', coins: 'earn', earn: 'earn' }[h];
    var el = to && document.getElementById(to);
    if (el && to !== 'earn') el.scrollIntoView({ block: 'start' });
  }

  function sheetHtml(id, s) {
    var body = ({ shop: shopPanel, extras: extrasPanel, purchases: purchasesPanel, settings: settingsPanel, tasks: tasksPanel, certs: allCertsPanel })[id](s);
    return '<div class="modal pf-modal" data-sheet-backdrop><div class="card stack stack--tight pf-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
      '<div class="pf-card-head"><h2 class="pf-card-title" id="sheet-title">' + esc(SHEETS[id]) + '</h2>' +
      '<button type="button" class="earn-panel-close" aria-label="Close" data-sheet-close>×</button></div>' +
      '<p class="pf-say" data-say aria-live="polite">' + esc(say) + '</p>' +
      '<div class="pf-panel">' + body + '</div></div></div>';
  }

  function tasksPanel(s) {
    var left = T.left(quests, s);
    return '<ul class="qs-list" data-tasks>' + T.list(quests).map(function (q) { return T.row(q, s, invite, quests.invite.post); }).join('') + '</ul>' +
      '<p class="small-print">' + (left.length ? left.length + ' left, worth ' + left.reduce(function (n, q) { return n + q.coins; }, 0) + ' coins. ' : 'All done! ') + esc(quests.noCash) + '</p>';
  }

  function allCertsPanel(s) {
    var all = s.certs.map(function (c) { return certCard(c, false); }).concat(s.pros.map(function (c) { return certCard(c, true); }));
    return (all.length ? '<ul class="pf-certs">' + all.join('') + '</ul>' : '<p class="text">None yet.</p>') + ranksHtml(s);
  }

  function ranksHtml(s) {
    return '<h3 class="pf-h">Ranks</h3><p class="small-print">Every certificate and Pro tag (from the <a href="../academy/">Project Academy</a>) counts toward your rank.</p><ol class="rank-ladder">' + ranks.map(function (r, i) {
      return '<li class="' + (r === s.rank ? 'is-current' : s.n >= r.min ? 'is-done' : '') + '">' + C.rankBadge(r, i + 1) + '<span class="small-print">' + r.min + (r.min === 1 ? ' certificate' : ' certificates') + '</span></li>';
    }).join('') + '</ol>';
  }

  function stat(value, label) {
    return '<li><b>' + esc(String(value)) + '</b><span>' + esc(label) + '</span></li>';
  }

  // ---------- Certificates ----------

  function certCard(c, pro) {
    var path = pro ? 'academy/course/?id=' + encodeURIComponent(c.toy.slice(8)) : (toyPath(c.toy) || '');
    var eb = !pro && window.Web3EarlyBird ? window.Web3EarlyBird.spot(c.toy) : null;
    return '<li class="pf-cert' + (pro ? ' pf-cert--pro' : '') + '"><span class="pf-cert-score">' + c.score + '%</span>' +
      '<span class="pf-cert-main"><b>' + esc(c.title || c.toy) + '</b>' +
      '<span class="small-print">' + (pro ? 'Pro tag · ' : '') + esc(c.date) + (eb ? ' · <span class="pf-eb">🐣 Early Bird #' + eb + '</span>' : '') + '</span></span>' +
      '<span class="pf-cert-links"><a href="../' + esc(path) + '#certificate">View</a><a href="../verify/?code=' + encodeURIComponent(c.code) + '&name=' + encodeURIComponent(c.name) + '">Verify</a></span></li>';
  }

  function toyPath(id) {
    var p = null;
    home.shelves.forEach(function (s) { s.cards.forEach(function (c) { if (c.id === id) p = c.path; }); });
    return p;
  }

  function certsCard(s) {
    var all = s.certs.map(function (c) { return certCard(c, false); }).concat(s.pros.map(function (c) { return certCard(c, true); }));
    var n = all.length;
    var shown = all.slice(0, 3);
    return card('certs', '🏅 Certificates', n ? '<span class="pf-count">' + n + '</span>' : '',
      (n ? '<ul class="pf-certs">' + shown.join('') + '</ul>' : '<p class="text pf-empty">None yet. Pass the quiz at the end of any toy to earn one.</p><a class="btn btn--small btn--ink" href="../">Play a toy</a>') +
      '<p class="small-print pf-card-foot">' + (n > 3 ? '<button type="button" class="text-button pf-toggle" data-sheet="certs">See all ' + n + '</button> · ' : '') +
      '<button type="button" class="text-button pf-toggle" data-sheet="certs">Ranks and Pro tags</button></p>');
  }

  // ---------- Extras (coins) ----------

  function swatch(it) {
    var bg = it.color2 ? 'linear-gradient(135deg, ' + it.color + ', ' + it.color2 + ', ' + it.color + ')' : it.color;
    return '<span class="cx-swatch cx-swatch--' + it.slot + '" style="--sw:' + esc(bg) + '" aria-hidden="true"></span>';
  }

  // ---------- Coins: earn, invite, spend ----------

  var invite = null;
  var T = window.Web3EarnTasks;

  function inviteUrl() { return T.inviteUrl(invite); }
  function xIntent() { return T.xIntent(invite, quests.invite.post); }

  function earnCard(s) {
    var left = T.left(quests, s);
    var worth = left.reduce(function (n, q) { return n + q.coins; }, 0);
    var done = T.list(quests).length - left.length;
    // Tasks you can claim now come first.
    var claimNow = function (q) { return s.user && q.type !== 'post' && T.ready(q, s) ? 1 : 0; };
    var order = left.slice().sort(function (a, b) { return claimNow(b) - claimNow(a); });
    var shown = order.slice(0, 3);
    return card('earn', '🎯 Earn coins', left.length ? '<span class="pf-count">+' + worth + '</span>' : '',
      (left.length ? '<ul class="qs-list" data-tasks>' + shown.map(function (q) { return T.row(q, s, invite, quests.invite.post, true); }).join('') + '</ul>'
        : '<p class="text">All tasks done. Invite friends for more coins.</p>') +
      '<p class="small-print pf-card-foot">' + (left.length > 3 ? '<button type="button" class="text-button pf-toggle" data-sheet="tasks">+' + (left.length - 3) + ' more tasks</button> · ' : '') +
      (done ? '✓ ' + done + ' done · ' : '') + 'Coins have no cash value.</p>');
  }

  function inviteCard(s) {
    if (s.user && !invite && window.Web3Sync) {
      window.Web3Sync.referrals().then(function (r) { invite = r; render(); }).catch(function () {});
    }
    return card('invite', '👥 Invite friends', '<span class="pf-count">+200</span>',
      '<p class="small-print">' + esc(quests.invite.line) + '</p>' +
      (s.user
        ? '<div class="lk-row"><input class="field" readonly value="' + esc(inviteUrl()) + '" aria-label="Your invite link" data-invite-link /><button type="button" class="btn btn--small" data-copy-invite>Copy</button></div>' +
          '<div class="pf-invite-foot"><a class="btn btn--small btn--ink" href="' + esc(xIntent()) + '" target="_blank" rel="noopener">Share on X</a>' +
          '<span class="small-print">' + (invite ? invite.paid + ' joined · ' + invite.pending + ' playing' : 'Loading…') + '</span></div>'
        : '<button type="button" class="btn btn--small btn--yellow" data-login>Log in to get your link</button>'));
  }

  function shopPanel(s) {
    var spend = productList.filter(function (p) { return p.coins && !p.perItem; });
    return '<p class="cx-nocash">' + esc(quests.noCash) + '</p>' +
      '<h3 class="pf-h">' + esc(quests.spendTitle) + '</h3><p class="small-print">' + esc(quests.spendLine) + '</p>' +
      '<ul class="pf-row pf-row--cx">' + spend.map(function (p) {
        return '<li class="cx-item qs-item"><b>' + esc(p.title) + '</b><button type="button" class="btn btn--small" data-unlock="' + esc(p.id) + '">' + site.icon('coin') + p.coins.toLocaleString('en-US') + '</button></li>';
      }).join('') + '</ul><p class="small-print">Reports and HD certificates are unlocked from the end of each toy. Picture frames, certificate styles and page colours are in Extras.</p>' +
      '<details class="pf-more"><summary class="small-print">Other ways to earn coins</summary><ul class="lesson-points">' + cosmetics.how.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul></details>' +
      (s.w.history.length ? '<details class="pf-more coins-history"><summary class="small-print">Coin history</summary><ul>' + s.w.history.map(function (h) {
        return '<li><span>' + esc(h.label) + '</span><b class="' + (h.coins < 0 ? 'is-spent' : '') + '">' + (h.coins > 0 ? '+' : '') + h.coins + '</b></li>';
      }).join('') + '</ul></details>' : '') +
      '<p class="small-print">' + (s.user ? 'Saved to your account, on every device.' : 'Saved in this browser only.') + ' <a href="../leaderboard/">See the leaderboard</a></p>';
  }

  function bindCoins(s) {
    var msg = function (t) { say = t; var el = app.querySelector('[data-say]'); if (el) el.textContent = t; };
    var tasks = app.querySelector('[data-tasks]');
    if (tasks) T.bind(tasks, function (m) { say = m; render(); });
    var copy = app.querySelector('[data-copy-invite]');
    if (copy) copy.addEventListener('click', function () {
      var input = app.querySelector('[data-invite-link]');
      (navigator.clipboard ? navigator.clipboard.writeText(input.value) : Promise.reject()).then(function () { copy.textContent = 'Copied'; }, function () { input.select(); });
    });
    app.querySelectorAll('[data-unlock]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!window.Web3Pay) return msg('Unlocking opens soon.');
        window.Web3Pay.buy(b.getAttribute('data-unlock')).catch(function (err) { if (err.message !== 'login') msg(err.message); });
      });
    });
  }

  function extrasPanel(s) {
    var wearing = { cert: s.cx.cert, frame: s.cx.frame, theme: s.cx.theme };
    return (s.user ? '' : '<p class="text pf-empty">Log in to unlock extras with your coins.</p>') +
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
      '<p class="small-print">Coins: ' + s.w.balance.toLocaleString('en-US') + '. Earn more with the tasks on this page.</p>';
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
    if (o.currency === 'COINS') return o.amount.toLocaleString('en-US') + ' coins';
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
        : p.type === 'project' ? '<a class="btn btn--small btn--yellow" href="../work-with-us/">Follow it</a>'
        : p.type === 'call' && window.Web3Pay.callUrl() ? '<a class="btn btn--small btn--yellow" href="' + esc(window.Web3Pay.callUrl(o.id)) + '" target="_blank" rel="noopener">Pick your time</a>'
        : '<span class="chip is-mint">Unlocked</span>';
      return '<li><div><b>' + esc(String(o.title).replace(/ \([0-9a-f-]{36}\)$/i, '')) + '</b><span class="small-print">' + esc(String(o.paid_at || '').slice(0, 10)) + ' · ' + money(o) + '</span></div>' + action + '</li>';
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
    app.querySelectorAll('[data-login]').forEach(function (b) { b.addEventListener('click', function () { A && A.open(); }); });
    var coins = app.querySelector('.pf-coins');
    coins.addEventListener('click', function (e) { e.preventDefault(); setTab('shop'); });
    app.querySelectorAll('[data-sheet]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.getAttribute('data-sheet')); }); });
    var x = app.querySelector('[data-sheet-close]');
    if (x) x.addEventListener('click', closeSheet);
    var bg = app.querySelector('[data-sheet-backdrop]');
    if (bg) bg.addEventListener('click', function (e) { if (e.target === bg) closeSheet(); });
    bindCoins(s);

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
    if (history.replaceState) history.replaceState(null, '', BUTTONS.indexOf(id) >= 0 ? '#' + id : location.pathname);
    render();
    var x = app.querySelector('[data-sheet-close]');
    if (x) x.focus();
  }

  function closeSheet() {
    var from = tab;
    tab = null;
    say = '';
    if (history.replaceState) history.replaceState(null, '', location.pathname);
    render();
    var b = app.querySelector('[data-sheet="' + from + '"]');
    if (b) b.focus();
  }

  function applyTheme(theme) {
    if (theme) document.body.setAttribute('data-theme', theme);
    else document.body.removeAttribute('data-theme');
  }
})();
