// Builds the home page from data/home.json and data/ranks.json: a one line
// tagline, then every toy as its own little logo card (js/home-cards.js),
// grouped by small labels.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var progress = Web3Progress.load(window.localStorage);
  // The release schedule (js/releases.js) decides which scheduled toys are
  // live; if it cannot load, home.json's own status is used.
  var R = window.Web3Releases;
  var rel = R ? R.load().catch(function () { return null; }) : Promise.resolve(null);
  var homeData, rankList, timer;
  Promise.all([C.loadJson('data/home.json'), C.loadJson('data/ranks.json'), rel])
    .then(function (r) { homeData = r[0]; rankList = r[1].ranks; R = r[2]; render(homeData, rankList); tick(); })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  // Countdowns on locked cards; when one reaches zero the page redraws and
  // the toy moves up to its section.
  function tick() {
    if (!R || timer) return;
    timer = setInterval(function () {
      var redraw = false;
      app.querySelectorAll('[data-cd]').forEach(function (el) {
        var at = new Date(Number(el.getAttribute('data-cd')));
        var left = R.countdown(at);
        if (at.getTime() <= R.now().getTime()) redraw = true;
        el.textContent = left;
      });
      if (redraw) R.load().then(function () { render(homeData, rankList); });
    }, 1000);
  }

  function rinfo(c) {
    return R && R.toy(c.id) ? R.info(c.id) : null;
  }

  // A real picture in images/covers/crypto_in_5.png (for the card
  // "crypto-in-5") goes on top of the drawn card as soon as it exists.
  function coverPath(id) {
    return 'images/covers/' + id.replace(/-/g, '_') + '.png';
  }

  function tile(c, live) {
    var ri = rinfo(c);
    if (!live && ri) return locked(c, ri);
    var cert = live && progress.certificates[c.id];
    var said = c.title + (c.topic ? ', ' + c.topic : '') + '. ' + (c.blurb || '') + (live ? '' : ' Coming soon.') + (cert ? ' Completed.' : '');
    var inner = (Web3Cards.card(c.id, c.title, esc) || '<span class="xtitle">' + esc(c.title) + '</span>') +
      '<img class="tile-img" src="' + coverPath(c.id) + '" alt="" loading="lazy" onload="this.parentNode.classList.add(\'has-cover\')" onerror="this.remove()" />' +
      (cert ? '<span class="tile-sticker tile-done" aria-hidden="true">✓</span>' : '') +
      (live && ri && ri.isNew ? '<span class="tile-sticker tile-new" aria-hidden="true">New</span>' : '') +
      (live ? '' : '<span class="tile-sticker tile-soon" aria-hidden="true">Soon</span>');
    var cls = 'xcard xcard--' + esc(c.id);
    return '<li>' + (live
      ? '<a class="' + cls + '" href="' + esc(c.path) + '" aria-label="' + esc(said) + '">' + inner + '</a>'
      : '<div class="' + cls + ' is-soon" role="img" aria-label="' + esc(said) + '">' + inner + '</div>') + '</li>';
  }

  // A scheduled toy that is not out yet: its cover with a lock, the day it
  // unlocks, a countdown in the last 7 days, and Notify me. The card opens
  // the teaser page (soon/).
  function locked(c, ri) {
    var future = ri.at && ri.at.getTime() > R.now().getTime();
    var when = future ? 'Unlocks ' + R.dayLabel(ri.at) : 'Coming soon';
    var said = c.title + '. ' + (ri.toy.hook || c.blurb || '') + ' ' + when + '.';
    var href = 'soon/?toy=' + encodeURIComponent(c.id);
    var inner = (Web3Cards.card(c.id, c.title, esc) || '<span class="xtitle">' + esc(c.title) + '</span>') +
      '<img class="tile-img" src="' + coverPath(c.id) + '" alt="" loading="lazy" onload="this.parentNode.classList.add(\'has-cover\')" onerror="this.remove()" />' +
      '<span class="tile-sticker tile-lock" aria-hidden="true">🔒</span>';
    var cd = future ? '<span data-cd="' + ri.at.getTime() + '">' + R.countdown(ri.at) + '</span>' : '';
    return '<li class="tile-locked"><a class="xcard xcard--' + esc(c.id) + ' is-soon is-locked" href="' + href + '" aria-label="' + esc(said) + '">' + inner + '</a>' +
      '<p class="tile-when"><b>' + esc(when) + '</b>' + cd + '</p>' +
      '<a class="tile-notify" href="' + href + '#notify">' + (R.asked(c.id) ? '✓ We will tell you' : '🔔 Notify me') + '</a></li>';
  }

  function render(home, ranks) {
    var n = Web3Progress.count(progress);
    var rank = Web3Progress.rankFor(n, ranks);

    app.innerHTML =
      '<div class="home-top"><h1 class="tagline">' + esc(home.tagline) + '</h1>' +
      '<a class="rank-link" href="progress/" aria-label="Your rank: ' + esc(rank.name) + '. Open My Progress">' +
      '<span class="rank-badge rank-badge--name">' + esc(rank.name) + '</span></a>' +
      '</div>' +
      notice(home) +
      sections(home);
    var x = app.querySelector('[data-notice-x]');
    if (x) x.addEventListener('click', function () {
      try { localStorage.setItem(NOTICE_KEY, x.getAttribute('data-notice-x')); } catch (e) { /* private mode */ }
      x.parentNode.remove();
    });
  }

  // "New on web3.toys": one line at the top about the newest toy or the
  // next drop, from the release schedule. Its × hides that one message.
  var NOTICE_KEY = 'web3toys.notice.v1';
  function notice(home) {
    if (!R) return '';
    var cards = {};
    home.shelves.forEach(function (s) { s.cards.forEach(function (c) { cards[c.id] = c; }); });
    var now = R.now().getTime();
    var list = R.list();
    var launch = list.filter(function (t) { return t.playableNow; })[0];
    var launchAt = launch ? Date.parse(launch.date) : 0;
    var fresh = list.filter(function (t) { var i = R.info(t.id); return i && i.isNew && cards[t.id] && cards[t.id].path; })[0];
    var next = list.filter(function (t) { var i = R.info(t.id); return i && i.status === 'locked' && i.at && i.at.getTime() > now && t.ready !== undefined; })
      .sort(function (a, b) { return R.info(a.id).at - R.info(b.id).at; })[0];
    var msg = null;
    if (fresh) msg = { id: 'new:' + fresh.id, icon: '🆕', text: 'New on web3.toys: ' + cards[fresh.id].title + '. Early Bird spots are open.', href: cards[fresh.id].path, cta: 'Play now' };
    else if (launchAt && now < launchAt) msg = { id: 'prelaunch', icon: '🐣', text: 'Early Bird opens ' + R.dayLabel(new Date(launchAt)) + ' at 10:00 India time: the first 1,000 on each toy get 2x coins.', href: 'progress/', cta: 'Log in early' };
    else if (launchAt && now - launchAt < 7 * 864e5) msg = { id: 'launch', icon: '🎉', text: 'web3.toys just launched. Every toy has 1,000 Early Bird spots with 2x coins.', href: '#shelf-beginners', cta: 'Start here' };
    else if (next && R.info(next.id).at.getTime() - now < 7 * 864e5) msg = { id: 'next:' + next.id, icon: '⏳', text: 'Next drop: ' + ((cards[next.id] || {}).title || next.id) + ', ' + R.dayLabel(R.info(next.id).at) + '.', href: 'soon/?toy=' + next.id + '#notify', cta: 'Notify me' };
    if (!msg) return '';
    try { if (localStorage.getItem(NOTICE_KEY) === msg.id) return ''; } catch (e) { /* private mode */ }
    return '<p class="home-notice" role="status"><span aria-hidden="true">' + msg.icon + '</span><span>' + esc(msg.text) + ' <a href="' + esc(msg.href) + '">' + esc(msg.cta) + ' →</a></span>' +
      '<button type="button" class="home-notice-x" aria-label="Hide this message" data-notice-x="' + esc(msg.id) + '">×</button></p>';
  }

  // Live toys show in their own section. Every coming soon toy goes into one
  // Coming soon section at the bottom, and moves up by itself once it is live.
  // Sections marked "column" sit side by side on wider screens, one column
  // each, with their cards stacked (up to 3 columns). Phones stack them.
  function sections(home) {
    var soon = [];
    var html = '';
    var row = [];
    var flush = function () {
      if (row.length) html += '<div class="shelf-row" style="--cols:' + Math.min(row.length, 3) + '">' + row.join('') + '</div>';
      row = [];
    };
    home.shelves.forEach(function (shelf) {
      var live = shelf.cards.filter(function (c) { return isLive(c, shelf); });
      // A toy released in the last 7 days goes to the top of its section.
      live = live.filter(function (c) { var i = rinfo(c); return i && i.isNew; })
        .concat(live.filter(function (c) { var i = rinfo(c); return !(i && i.isNew); }));
      shelf.cards.forEach(function (c) { if (!isLive(c, shelf)) soon.push(c); });
      if (!live.length) return;
      if (shelf.column) {
        row.push(section(shelf, live, true, ''));
        return;
      }
      flush();
      html += section(shelf, live, true, '');
    });
    flush();
    // Scheduled toys first, soonest first, then the rest.
    var when = function (c) { var i = rinfo(c); return i && i.at && i.at.getTime() > R.now().getTime() ? i.at.getTime() : Infinity; };
    soon.sort(function (a, b) { return when(a) - when(b); });
    if (soon.length && home.soonSection) html += section(home.soonSection, soon, false, ' shelf--soon');
    return html;
  }

  // A card can set its own status; otherwise its section's status counts.
  function isLive(c, shelf) {
    var i = rinfo(c);
    if (i) return i.status === 'live' && Boolean(c.path);
    return (c.status || shelf.status) === 'live';
  }

  // n cards: the section spans that many grid columns (up to 2 or 3), so
  // small sections can share a row and every card stays the same size.
  function section(shelf, cards, live, extra) {
    var n = cards.length;
    return '<section class="shelf shelf--' + esc(shelf.color || 'yellow') + extra + '" style="--s2:' + Math.min(n, 2) + ';--s3:' + Math.min(n, 3) + '" aria-labelledby="shelf-' + esc(shelf.id) + '">' +
      '<div class="shelf-head"><h2 id="shelf-' + esc(shelf.id) + '" class="shelf-title">' +
      (shelf.icon ? '<span class="shelf-icon" aria-hidden="true">' + esc(shelf.icon) + '</span>' : '') + esc(shelf.title) + '</h2>' +
      (shelf.blurb ? '<p class="shelf-blurb">' + esc(shelf.blurb) + '</p>' : '') + '</div>' +
      '<ul class="tile-grid">' + cards.map(function (c) { return tile(c, live); }).join('') + '</ul></section>';
  }
})();
