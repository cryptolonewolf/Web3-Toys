// Builds the home page from data/home.json and data/ranks.json: a one line
// tagline, then every toy as its own little logo card (js/home-cards.js),
// grouped by small labels.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var progress = Web3Progress.load(window.localStorage);
  Promise.all([C.loadJson('data/home.json'), C.loadJson('data/ranks.json')])
    .then(function (r) { render(r[0], r[1].ranks); })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  // A real picture in images/covers/crypto_in_5.png (for the card
  // "crypto-in-5") goes on top of the drawn card as soon as it exists.
  function coverPath(id) {
    return 'images/covers/' + id.replace(/-/g, '_') + '.png';
  }

  function tile(c, live) {
    var cert = live && progress.certificates[c.id];
    var said = c.title + (c.topic ? ', ' + c.topic : '') + '. ' + (c.blurb || '') + (live ? '' : ' Coming soon.') + (cert ? ' Completed.' : '');
    var inner = (Web3Cards.card(c.id, c.title, esc) || '<span class="xtitle">' + esc(c.title) + '</span>') +
      '<img class="tile-img" src="' + coverPath(c.id) + '" alt="" loading="lazy" onload="this.parentNode.classList.add(\'has-cover\')" onerror="this.remove()" />' +
      (cert ? '<span class="tile-sticker tile-done" aria-hidden="true">✓</span>' : '') +
      (live ? '' : '<span class="tile-sticker tile-soon" aria-hidden="true">Soon</span>');
    var cls = 'xcard xcard--' + esc(c.id);
    return '<li>' + (live
      ? '<a class="' + cls + '" href="' + esc(c.path) + '" aria-label="' + esc(said) + '">' + inner + '</a>'
      : '<div class="' + cls + ' is-soon" role="img" aria-label="' + esc(said) + '">' + inner + '</div>') + '</li>';
  }

  function render(home, ranks) {
    var n = Web3Progress.count(progress);
    var rank = Web3Progress.rankFor(n, ranks);

    app.innerHTML =
      '<div class="home-top"><h1 class="tagline">' + esc(home.tagline) + '</h1>' +
      '<a class="rank-link" href="progress/" aria-label="Your rank: ' + esc(rank.name) + '. Open My Progress">' +
      '<span class="rank-badge rank-badge--name">' + esc(rank.name) + '</span></a></div>' +
      sections(home);
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
    if (soon.length && home.soonSection) html += section(home.soonSection, soon, false, ' shelf--soon');
    return html;
  }

  // A card can set its own status; otherwise its section's status counts.
  function isLive(c, shelf) {
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
