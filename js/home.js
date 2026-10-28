// Builds the home page from data/home.json and data/ranks.json: a one line
// tagline, then every toy as a same-size cover card, grouped by small labels.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var progress = Web3Progress.load(window.localStorage);
  var COLORS = { yellow: '#FFD93D', blue: '#4D9DE0', coral: '#FF6B6B', mint: '#6BCB77', violet: '#A98BFF', orange: '#FF9F43', pink: '#FF8FC8', teal: '#3CC6C0' };

  Promise.all([C.loadJson('data/home.json'), C.loadJson('data/ranks.json')])
    .then(function (r) { render(r[0], r[1].ranks); })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  // images/covers/crypto_in_5.png for the card "crypto-in-5". If the picture
  // is not there yet, the drawn placeholder underneath stays visible.
  function coverPath(id) {
    return 'images/covers/' + id.replace(/-/g, '_') + '.png';
  }

  function tile(c, live, k) {
    var cert = live && progress.certificates[c.id];
    var said = c.title + (c.topic ? ', ' + c.topic : '') + '. ' + (c.blurb || '') + (live ? '' : ' Coming soon.') + (cert ? ' Completed.' : '');
    var inner =
      Web3Covers.svg(c.object, COLORS[c.color] || COLORS.yellow) +
      '<img class="tile-img" src="' + coverPath(c.id) + '" alt="" loading="lazy" onload="this.parentNode.classList.add(\'has-cover\')" onerror="this.remove()" />' +
      (cert ? '<span class="tile-sticker tile-done" aria-hidden="true">✓</span>' : '') +
      (live ? '' : '<span class="tile-sticker tile-soon" aria-hidden="true">Soon</span>') +
      '<span class="tile-name' + (c.font ? ' toy-font' : '') + '" aria-hidden="true">' + esc(c.title) + '</span>';
    var look = ' style="--tilt:' + (k % 2 ? '2deg' : '-2deg') + '"' + (c.font ? ' data-font="' + esc(c.font) + '"' : '');
    return '<li>' + (live
      ? '<a class="toy-tile"' + look + ' href="' + esc(c.path) + '" aria-label="' + esc(said) + '">' + inner + '</a>'
      : '<div class="toy-tile is-soon"' + look + ' role="img" aria-label="' + esc(said) + '">' + inner + '</div>') + '</li>';
  }

  function render(home, ranks) {
    var n = Web3Progress.count(progress);
    var rank = Web3Progress.rankFor(n, ranks);
    var k = 0;

    app.innerHTML =
      '<div class="home-top"><h1 class="tagline">' + esc(home.tagline) + '</h1>' +
      '<a class="rank-link" href="progress/">' + C.rankBadge(rank, Web3Progress.level(rank, ranks)) + '</a></div>' +
      home.shelves.map(function (shelf) {
        // A card can override its shelf's status, so a shelf can mix live and coming soon cards.
        var isLive = function (c) { return (c.status || shelf.status) === 'live'; };
        return '<section class="shelf" aria-labelledby="shelf-' + esc(shelf.id) + '">' +
          '<h2 id="shelf-' + esc(shelf.id) + '" class="shelf-label">' + esc(shelf.title) + '</h2>' +
          '<ul class="tile-grid">' + shelf.cards.map(function (c) { return tile(c, isLive(c), k++); }).join('') + '</ul></section>';
      }).join('');
  }
})();
