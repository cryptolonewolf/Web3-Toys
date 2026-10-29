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
      sections(home.shelves);
  }

  // Sections marked "column" sit side by side on computers; the rest are full width.
  function sections(shelves) {
    var html = '';
    var row = '';
    shelves.forEach(function (shelf) {
      if (shelf.column) {
        row += section(shelf, true);
        return;
      }
      if (row) html += '<div class="shelf-row">' + row + '</div>';
      row = '';
      html += section(shelf, false);
    });
    if (row) html += '<div class="shelf-row">' + row + '</div>';
    return html;
  }

  function section(shelf, column) {
    // A card can override its shelf's status, so a shelf can mix live and coming soon cards.
    var isLive = function (c) { return (c.status || shelf.status) === 'live'; };
    return '<section class="shelf shelf--' + esc(shelf.color || 'yellow') + (column ? ' shelf--column' : '') + '" aria-labelledby="shelf-' + esc(shelf.id) + '">' +
      '<div class="shelf-head"><h2 id="shelf-' + esc(shelf.id) + '" class="shelf-title">' +
      (shelf.icon ? '<span class="shelf-icon" aria-hidden="true">' + esc(shelf.icon) + '</span>' : '') + esc(shelf.title) + '</h2>' +
      (shelf.blurb ? '<p class="shelf-blurb">' + esc(shelf.blurb) + '</p>' : '') + '</div>' +
      '<ul class="tile-grid">' + shelf.cards.map(function (c) { return tile(c, isLive(c)); }).join('') + '</ul></section>';
  }
})();
