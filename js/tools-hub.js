// The Tools page: every builder tool from data/tools/tools.json, as cards.
// Live tools link to their page; scheduled ones are locked until their day.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');

  // Each tool is a card like on the home page. Scheduled tools (data/
  // releases.json, id tool-ID) show their cover with a lock, the unlock day
  // and a countdown in the last 7 days; a tool released in the last 7 days
  // gets a New sticker and goes first.
  var R = window.Web3Releases;
  var rel = R ? R.load().catch(function () { return null; }) : Promise.resolve(null);
  var data, timer;
  Promise.all([C.loadJson('../data/tools/tools.json'), rel]).then(function (r) {
    data = r[0]; R = r[1];
    render();
    if (R && !timer) {
      timer = setInterval(function () {
        var redraw = false;
        app.querySelectorAll('[data-cd]').forEach(function (el) {
          var at = new Date(Number(el.getAttribute('data-cd')));
          if (at.getTime() <= R.now().getTime()) redraw = true;
          el.textContent = R.countdown(at);
        });
        if (redraw) R.reload().then(render);
      }, 1000);
    }
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function info(t) { var id = 'tool-' + t.id; return R && R.toy(id) ? R.info(id) : null; }
  function cover(id, title) {
    return (window.Web3Cards && Web3Cards.card(id, title, esc) || '<span class="xtitle">' + esc(title) + '</span>') +
      '<img class="tile-img" src="../images/covers/' + esc(id.replace(/-/g, '_')) + '.png" alt="" loading="lazy" onload="this.parentNode.classList.add(\'has-cover\')" onerror="this.remove()" />';
  }

  function tile(t) {
    var id = 'tool-' + t.id;
    var i = info(t);
    var live = i ? i.status === 'live' : t.status === 'live';
    if (live) {
      return '<li><a class="xcard xcard--' + esc(id) + '" href="' + esc(t.path) + '" aria-label="' + esc(t.title + '. ' + t.blurb) + '">' + cover(id, t.title) +
        (i && i.isNew ? '<span class="tile-sticker tile-new" aria-hidden="true">New</span>' : '') + '</a></li>';
    }
    if (!i) {
      return '<li><div class="xcard xcard--' + esc(id) + ' is-soon" role="img" aria-label="' + esc(t.title + '. Coming soon.') + '">' + cover(id, t.title) +
        '<span class="tile-sticker tile-soon" aria-hidden="true">Soon</span></div></li>';
    }
    var future = i.at && i.at.getTime() > R.now().getTime();
    var when = future ? 'Unlocks ' + R.dayLabel(i.at) : 'Coming soon';
    var href = '../soon/?toy=' + encodeURIComponent(id);
    return '<li class="tile-locked"><a class="xcard xcard--' + esc(id) + ' is-soon is-locked" href="' + href + '" aria-label="' + esc(t.title + '. ' + t.blurb + ' ' + when + '.') + '">' + cover(id, t.title) +
      '<span class="tile-sticker tile-lock" aria-hidden="true">🔒</span></a>' +
      '<p class="tile-when"><b>' + esc(when) + '</b>' + (future ? '<span data-cd="' + i.at.getTime() + '">' + R.countdown(i.at) + '</span>' : '') + '</p>' +
      '<a class="tile-notify" href="' + href + '#notify">' + (R.asked(id) ? '✓ We will tell you' : '🔔 Notify me') + '</a></li>';
  }

  function render() {
    var live = [], soon = [];
    data.tools.forEach(function (t) { var i = info(t); ((i ? i.status === 'live' : t.status === 'live') ? live : soon).push(t); });
    var isNew = function (t) { var i = info(t); return Boolean(i && i.isNew); };
    live = live.filter(isNew).concat(live.filter(function (t) { return !isNew(t); }));
    var at = function (t) { var i = info(t); return i && i.at && i.at.getTime() > R.now().getTime() ? i.at.getTime() : Infinity; };
    soon.sort(function (a, b) { return at(a) - at(b); });
    var grid = function (title, list) {
      return list.length ? '<section class="shelf shelf--blue" style="--s2:' + Math.min(list.length, 2) + ';--s3:' + Math.min(list.length, 3) + '"><div class="shelf-head"><h2 class="shelf-title">' + esc(title) + '</h2></div>' +
        '<ul class="tile-grid">' + list.map(tile).join('') + '</ul></section>' : '';
    };
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">' + esc(data.title) + '</h1>' +
      '<p class="text text--ink">' + esc(data.line) + '</p>' + window.ToolKitNotes() + '</section>' +
      grid('Open now', live) + grid('Coming soon', soon);
  }

  // The privacy and disclaimer lines, without loading the whole tool kit.
  window.ToolKitNotes = function () {
    return '<p class="tool-privacy">' + site.icon('lock') + 'Your data stays in your browser.</p>' +
      '<p class="tool-disclaimer">Educational tool, not financial, legal or tax advice.</p>';
  };
})();
