// Builds the home page from data/home.json and data/ranks.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var progress = Web3Progress.load(window.localStorage);

  Promise.all([C.loadJson('data/home.json'), C.loadJson('data/ranks.json')])
    .then(function (r) { render(r[0], r[1].ranks); })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function card(c, live) {
    var cert = progress.certificates[c.id];
    var chips =
      '<span class="chip is-white">' + esc(c.time) + '</span>' +
      (cert ? '<span class="chip is-mint">✓ Completed</span>' : '') +
      (live ? '' : '<span class="chip is-blue">Coming soon</span>');
    var inner =
      '<span class="chips">' + chips + '</span>' +
      '<h3 class="title-sm">' + esc(c.title) + '</h3>' +
      (c.blurb ? '<p class="text">' + esc(c.blurb) + '</p>' : '') +
      (live ? '<span class="go">' + (cert ? 'Play again →' : 'Play →') + '</span>' : '');
    return '<li>' + (live
      ? '<a class="card toy-card' + (cert ? ' card--good' : ' card--yellow') + '" href="' + esc(c.path) + '">' + inner + '</a>'
      : '<div class="card toy-card toy-card--soon" aria-label="' + esc(c.title) + ', coming soon">' + inner + '</div>') + '</li>';
  }

  function render(home, ranks) {
    var n = Web3Progress.count(progress);
    var rank = Web3Progress.rankFor(n, ranks);
    var next = Web3Progress.nextRank(n, ranks);

    app.innerHTML =
      '<section class="card card--hero hero" aria-labelledby="hero-title">' +
      '<div class="hero-copy"><p class="label">' + esc(home.heroLabel) + '</p>' +
      '<h1 id="hero-title" class="title-xl">' + esc(home.heroTitle) + '</h1></div>' +
      '<p class="hero-text">' + esc(home.heroText) + '</p>' +
      '<img class="mascot mascot--lg" src="assets/aki-grin.svg" alt="" width="116" height="116" />' +
      '</section>' +

      '<a class="card rank-card" href="progress/">' +
      '<span class="label">Your rank</span>' +
      C.rankBadge(rank, Web3Progress.level(rank, ranks)) +
      '<span class="small-print">' + n + (n === 1 ? ' certificate' : ' certificates') +
      (next ? ' · ' + (next.min - n) + ' more to ' + esc(next.name) : '') + '</span>' +
      '<span class="go">My Progress →</span></a>' +

      home.shelves.map(function (shelf) {
        var live = shelf.status === 'live';
        return '<section class="shelf stack stack--tight" aria-labelledby="shelf-' + esc(shelf.id) + '">' +
          '<div class="shelf-head"><h2 id="shelf-' + esc(shelf.id) + '" class="section-title">' + esc(shelf.title) + '</h2>' +
          (live ? '' : '<span class="chip is-blue">Coming soon</span>') + '</div>' +
          (shelf.blurb ? '<p class="text">' + esc(shelf.blurb) + '</p>' : '') +
          '<ul class="toy-grid' + (live ? '' : ' toy-grid--soon') + '">' +
          shelf.cards.map(function (c) { return card(c, live); }).join('') +
          '</ul></section>';
      }).join('');
  }
})();
