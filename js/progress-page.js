// The My Progress page: rank, next rank, the rank ladder and certificates.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');

  Promise.all([C.loadJson('../data/home.json'), C.loadJson('../data/ranks.json')])
    .then(function (r) { render(r[0], r[1].ranks); })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function render(home, ranks) {
    var progress = Web3Progress.load(window.localStorage);
    var n = Web3Progress.count(progress);
    var rank = Web3Progress.rankFor(n, ranks);
    var next = Web3Progress.nextRank(n, ranks);
    var titles = {};
    var paths = {};
    home.shelves.forEach(function (s) {
      s.cards.forEach(function (c) { titles[c.id] = c.title; paths[c.id] = c.path; });
    });
    var certs = Object.keys(progress.certificates).map(function (k) { return progress.certificates[k]; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var pct = next ? Math.round((n / next.min) * 100) : 100;

    app.innerHTML =
      '<section class="card card--hero hero" aria-labelledby="rank-title">' +
      '<div class="hero-copy"><p class="label">' + (progress.name ? esc(progress.name) + ', your rank' : 'Your rank') + '</p>' +
      '<h1 id="rank-title" class="sr-only">Your rank: ' + esc(rank.name) + '</h1></div>' +
      C.rankBadge(rank, Web3Progress.level(rank, ranks), true) +
      '<p class="hero-text">' + esc(rank.line) + '</p>' +
      '<img class="mascot mascot--lg" src="' + window.WEB3TOYS.mascotSrc('celebrating') + '" alt="" width="116" height="116" />' +
      '</section>' +

      '<section class="card stack stack--tight"><h2 class="title-sm">' +
      (next ? (next.min - n) + ' more ' + (next.min - n === 1 ? 'certificate' : 'certificates') + ' to ' + esc(next.name) : 'Top rank reached') + '</h2>' +
      '<div class="meter" role="img" aria-label="' + pct + ' percent of the way"><span style="width:' + pct + '%"></span></div>' +
      '<p class="small-print">Earn a certificate by passing the quiz at the end of a toy.</p></section>' +

      '<section class="card stack stack--tight"><h2 class="title-sm">All ranks</h2><ol class="rank-ladder">' +
      ranks.map(function (r, i) {
        var state = r === rank ? 'is-current' : n >= r.min ? 'is-done' : '';
        return '<li class="' + state + '">' + C.rankBadge(r, i + 1) +
          '<span class="small-print">' + r.min + (r.min === 1 ? ' certificate' : ' certificates') + '</span></li>';
      }).join('') + '</ol></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">Your certificates</h2>' +
      (certs.length
        ? certs.map(function (c) {
            return '<article class="card stack stack--tight">' +
              '<div class="chips"><span class="chip is-mint">✓ Passed</span><span class="chip is-white">' + c.score + '%</span></div>' +
              '<h3 class="title-sm">' + esc(titles[c.toy] || c.title || c.toy) + '</h3>' +
              '<p class="small-print">' + esc(c.name) + ' · ' + esc(c.date) + ' · Code ' + esc(c.code) + '</p>' +
              '<p class="text"><a href="../' + esc(paths[c.toy] || '') + '#certificate">View certificate</a> · ' +
              '<a href="../verify/?code=' + encodeURIComponent(c.code) + '&name=' + encodeURIComponent(c.name) + '">Verify</a></p>' +
              '</article>';
          }).join('')
        : '<section class="card"><p class="text">No certificates yet. <a href="../#shelf-beginners">Start with For Beginners</a>.</p></section>') +
      '</section>' +

      '<p class="small-print center">Your progress is saved in this browser only. Clearing your browser data, or using another device, starts you fresh.</p>' +
      (certs.length ? '<button type="button" class="text-button center" data-clear>Clear my progress</button>' +
        '<div class="card card--warning stack stack--tight" data-confirm hidden><p class="text text--ink">Remove all certificates from this browser? Codes already shared still verify.</p>' +
        '<div class="btn-row"><button type="button" class="btn" data-cancel>Keep them</button><button type="button" class="btn btn--ink" data-yes>Remove</button></div></div>' : '');

    var clear = app.querySelector('[data-clear]');
    if (clear) {
      var box = app.querySelector('[data-confirm]');
      clear.addEventListener('click', function () { box.hidden = false; });
      app.querySelector('[data-cancel]').addEventListener('click', function () { box.hidden = true; });
      app.querySelector('[data-yes]').addEventListener('click', function () {
        Web3Progress.save(window.localStorage, { name: '', certificates: {} });
        render(home, ranks);
      });
    }
  }
})();
