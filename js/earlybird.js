// Early Bird 2x (supabase/012_early_bird.sql). For each toy, the first 1,000
// logged-in players who earn its certificate get a numbered spot and 2x
// coins on that toy. Loaded on every page by js/site.js. It shows:
//   - a line under each toy card ("🐣 642 Early Bird spots left"),
//   - a pill at the top of each toy page (start screen),
//   - a line above the finish screen offers,
//   - a note when you win a spot ("You are Early Bird #87").
//   Web3EarlyBird.info(toy) { state: soon | open | full | mine, left, spots, spot, startsAt }
//   Web3EarlyBird.text(toy), .spot(toy), .refresh(), .all()

(function () {
  var site = window.WEB3TOYS || {};
  var cfg = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var counts = {}, mine = {}, ready = false, known = null;
  // Toy pages whose folder is not the toy's id.
  var PAGE_TOY = { simulator: 'token-simulator' };

  if (!cfg.url || !cfg.anonKey) return;

  function token() {
    var A = window.Web3Auth;
    return A && A.token ? A.token() : '';
  }

  function rpc(fn, auth) {
    var t = token();
    if (auth && !t) return Promise.resolve([]);
    return fetch(cfg.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + (auth ? t : cfg.anonKey), 'Content-Type': 'application/json' },
      body: '{}',
    }).then(function (r) { if (!r.ok) throw new Error('busy'); return r.json(); });
  }

  function refresh() {
    return Promise.all([
      rpc('early_bird_counts').then(function (rows) { counts = {}; (rows || []).forEach(function (r) { counts[r.toy] = r; }); }).catch(function () {}),
      rpc('my_early_birds', true).then(function (rows) { var m = {}; (rows || []).forEach(function (r) { m[r.toy] = r.spot; }); return m; }).catch(function () { return mine; }),
    ]).then(function (r) {
      var next = r[1];
      // A new spot since last time: celebrate it.
      if (known) Object.keys(next).forEach(function (t) { if (!known[t]) celebrate(t, next[t]); });
      mine = next;
      known = token() ? Object.assign({}, mine) : null;
      ready = true;
      decorate();
      document.dispatchEvent(new CustomEvent('web3earlybird:change'));
    });
  }

  function info(toy) {
    var c = counts[toy];
    if (!c) return null;
    var start = new Date(c.starts_at);
    var left = Math.max(0, c.spots - Number(c.used || 0));
    var state = mine[toy] ? 'mine' : Date.now() < start.getTime() ? 'soon' : left > 0 ? 'open' : 'full';
    return { state: state, left: left, spots: c.spots, spot: mine[toy] || null, startsAt: start };
  }

  function day(d) {
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
  }

  function n(x) { return Number(x).toLocaleString('en-US'); }

  function text(toy, short) {
    var i = info(toy);
    if (!i) return '';
    if (i.state === 'mine') return short ? '🐣 You are Early Bird #' + i.spot : '🐣 You are Early Bird #' + i.spot + ': 2x coins on everything you earn here.';
    if (i.state === 'soon') return short ? '🐣 Early Bird opens ' + day(i.startsAt) : '🐣 Early Bird opens ' + day(i.startsAt) + ': the first ' + n(i.spots) + ' to earn the certificate get 2x coins.';
    if (i.state === 'full') return '🐣 Early Bird is full';
    return short ? '🐣 ' + n(i.left) + ' Early Bird spots left' : '🐣 Early Bird: ' + n(i.left) + ' of ' + n(i.spots) + ' spots left. Earn the certificate (logged in) to get 2x coins here.';
  }

  function pageToy() {
    var t = document.body.getAttribute('data-toy') || '';
    if (!t) {
      var folder = location.pathname.replace(/index\.html$/, '').replace(/\/$/, '').split('/').pop();
      t = PAGE_TOY[folder] || folder;
    }
    return counts[t] ? t : '';
  }

  function decorate() {
    if (!ready) return;
    // Toy cards (home page and anywhere else they show).
    document.querySelectorAll('a.xcard').forEach(function (a) {
      var m = /xcard--([a-z0-9-]+)/.exec(a.className);
      if (!m || a.classList.contains('is-locked') || !counts[m[1]]) return;
      var li = a.parentNode;
      var line = li.querySelector(':scope > .tile-eb');
      if (!line) { line = document.createElement('p'); line.className = 'tile-eb'; li.appendChild(line); }
      line.textContent = text(m[1], true);
      line.classList.toggle('is-mine', info(m[1]).state === 'mine');
    });
    var toy = pageToy();
    if (!toy) return;
    // The toy page: a pill near the title.
    var head = document.querySelector('.site-header, .page > header');
    if (head) {
      var pill = document.querySelector('.eb-pill');
      if (!pill) { pill = document.createElement('p'); pill.className = 'eb-pill'; head.appendChild(pill); }
      pill.textContent = text(toy, true);
      pill.classList.toggle('is-mine', info(toy).state === 'mine');
    }
    // Finish screens: a line above the offers.
    document.querySelectorAll('[data-offers]').forEach(function (box) {
      var prev = box.previousElementSibling;
      var line = prev && prev.classList.contains('eb-line') ? prev : null;
      if (!line) { line = document.createElement('p'); line.className = 'eb-line'; box.parentNode.insertBefore(line, box); }
      line.textContent = text(toy);
      line.classList.toggle('is-mine', info(toy).state === 'mine');
    });
  }

  function celebrate(toy, spot) {
    var box = document.createElement('div');
    box.className = 'eb-toast';
    box.setAttribute('role', 'status');
    box.innerHTML = '<b>🐣 Early Bird #' + spot + '!</b><span>You got a spot. 2x coins on everything you earn on this toy, and the badge is on your certificate.</span>';
    document.body.appendChild(box);
    if (site.fx && site.fx.confetti) site.fx.confetti();
    setTimeout(function () { box.classList.add('is-out'); }, 6000);
    setTimeout(function () { box.remove(); }, 6600);
    document.dispatchEvent(new CustomEvent('web3earlybird:won', { detail: { toy: toy, spot: spot } }));
  }

  // Redraw lines when the page changes (toys draw their screens later).
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    setTimeout(function () { queued = false; decorate(); }, 150);
  }).observe(document.body, { childList: true, subtree: true });

  // Logged in or out: reload this player's spots. After a certificate is
  // saved to the account, check for a new spot.
  var hook = function () {
    if (window.Web3Auth) window.Web3Auth.onChange(function () { known = null; refresh().then(function () { known = token() ? Object.assign({}, mine) : null; }); });
  };
  if (window.Web3Auth) hook(); else document.addEventListener('web3auth:ready', hook, { once: true });
  document.addEventListener('web3toys:synced', function () { refresh(); });

  window.Web3EarlyBird = {
    refresh: refresh,
    info: info,
    text: text,
    spot: function (toy) { return mine[toy] || null; },
    all: function () { return Object.assign({}, mine); },
  };
  refresh();
})();
