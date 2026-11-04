// The teaser page for a toy that is not out yet: soon/?toy=web3-roles.
// Shows its cover, hook line, unlock day and a countdown (server time, see
// js/releases.js), and Notify me. Once the toy is live it sends visitors on
// to the toy itself.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var R = window.Web3Releases;
  var id = (new URLSearchParams(location.search).get('toy') || '').toLowerCase();
  var card = null, timer;

  function findCard(home) {
    var hit = null;
    home.shelves.forEach(function (s) { s.cards.forEach(function (c) { if (c.id === id) hit = c; }); });
    return hit;
  }

  Promise.all([C.loadJson('../data/home.json'), R.load()]).then(function (r) {
    card = findCard(r[0]);
    var info = R.toy(id) && R.info(id);
    if (!card || !info) {
      app.innerHTML = '<section class="card stack stack--tight"><h1 class="title-md">We could not find that toy.</h1><a class="btn btn--ink" href="../">See all toys</a></section>';
      return;
    }
    if (info.status === 'live' && card.path) { location.replace('../' + card.path); return; }
    render(info);
    if (location.hash === '#notify') {
      var n = document.getElementById('notify');
      if (n) n.scrollIntoView({ block: 'center' });
    }
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function render(info) {
    var delayed = !info.at || info.at.getTime() <= R.now().getTime();
    document.title = card.title + ': coming soon · web3.toys';
    app.innerHTML =
      '<section class="soon-hero"><p class="label">Coming soon</p>' +
      '<div class="xcard xcard--' + esc(card.id) + ' is-soon is-locked" role="img" aria-label="' + esc(card.title) + '">' +
      (Web3Cards.card(card.id, card.title, esc) || '<span class="xtitle">' + esc(card.title) + '</span>') +
      '<img class="tile-img" src="../images/covers/' + esc(card.id.replace(/-/g, '_')) + '.png" alt="" onload="this.parentNode.classList.add(\'has-cover\')" onerror="this.remove()" />' +
      '<span class="tile-sticker tile-lock" aria-hidden="true">🔒</span></div>' +
      '<h1 class="tool-title">' + esc(card.title) + '</h1>' +
      '<p class="text text--ink">' + esc(info.toy.hook || card.blurb || '') + '</p></section>' +
      '<section class="card card--yellow stack stack--tight">' +
      (delayed
        ? '<h2 class="title-md">Coming soon</h2><p class="text">We are putting the finishing touches on it. Tap Notify me and we will email you the day it is out.</p>'
        : '<h2 class="title-md">Unlocks ' + esc(R.dayLabel(info.at)) + ' at 10:00 India time</h2><div class="soon-count" data-count aria-live="off"></div>') +
      '<p class="small-print">Early Bird: the first 1,000 players to earn its certificate get 2x coins.</p></section>' +
      '<section class="card stack stack--tight" id="notify">' + notifyBox() + '</section>' +
      '<p class="text"><a href="../">Play a live toy while you wait →</a></p>';
    bindNotify();
    if (!delayed) count(info.at);
  }

  function count(at) {
    var box = app.querySelector('[data-count]');
    var paint = function () {
      var ms = Math.max(0, at.getTime() - R.now().getTime());
      if (ms === 0) { clearInterval(timer); location.reload(); return; }
      var parts = [[Math.floor(ms / 864e5), 'days'], [Math.floor(ms % 864e5 / 36e5), 'hours'], [Math.floor(ms % 36e5 / 6e4), 'mins'], [Math.floor(ms % 6e4 / 1e3), 'secs']];
      box.innerHTML = parts.map(function (p) { return '<span>' + p[0] + '<small>' + p[1] + '</small></span>'; }).join('');
      box.setAttribute('aria-label', parts.map(function (p) { return p[0] + ' ' + p[1]; }).join(', ') + ' to go');
    };
    paint();
    timer = setInterval(paint, 1000);
  }

  function notifyBox() {
    if (R.asked(id)) return '<h2 class="title-md">🔔 You are on the list</h2><p class="text">We will email you the day before and on launch morning.</p>';
    var A = window.Web3Auth;
    var u = A && A.user();
    return '<h2 class="title-md">🔔 Notify me</h2><p class="text">Get an email the day before and on launch morning, so you can grab an Early Bird spot.</p>' +
      '<form class="stack stack--tight" data-rel-notify novalidate>' +
      (u && u.email
        ? '<p class="small-print">We will email <b>' + esc(u.email) + '</b>.</p>'
        : '<label class="label" for="soon-email">Your email</label><input class="field" id="soon-email" type="email" autocomplete="email" maxlength="200" required />') +
      '<label class="mk-check"><input type="checkbox" data-consent /> <span>Email me about this toy\'s launch. I can unsubscribe any time. <a href="../privacy/">Privacy</a></span></label>' +
      '<button type="submit" class="btn btn--ink btn--block">Notify me</button><p class="small-print" data-msg aria-live="polite"></p></form>';
  }

  function bindNotify() {
    var f = app.querySelector('[data-rel-notify]');
    if (!f) return;
    // Logging in on another tab: show the account's email instead.
    if (window.Web3Auth) window.Web3Auth.onChange(function () { if (!R.asked(id)) { app.querySelector('#notify').innerHTML = notifyBox(); bindNotify(); } });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('[data-msg]');
      var input = f.querySelector('#soon-email');
      var email = input ? input.value.trim() : '';
      if (input && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = 'Add an email we can write to.'; input.focus(); return; }
      if (!f.querySelector('[data-consent]').checked) { msg.textContent = 'Please tick the box so we can email you.'; return; }
      var btn = f.querySelector('button');
      btn.disabled = true;
      msg.textContent = 'Saving…';
      R.notify(id, email).then(function () {
        C.track('notify_me', { toy: id });
        app.querySelector('#notify').innerHTML = notifyBox();
      }, function (err) {
        btn.disabled = false;
        msg.textContent = /no supabase/.test(err.message) ? 'Reminders open soon.' : err.message;
      });
    });
  }
})();
