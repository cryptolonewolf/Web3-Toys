// The leaderboard: top players by rank (certificates), then coins. Shows
// display names and cartoon pictures only, never emails or real names.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var ranks = null;
  var cfg = (window.WEB3TOYS_CONFIG || {}).supabase || {};

  C.loadJson('../data/ranks.json').then(function (r) {
    ranks = r.ranks;
    if (!cfg.url) return show('<p class="text">The leaderboard opens soon.</p>');
    if (window.Web3Sync) load();
    else document.addEventListener('web3sync:ready', load);
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function show(inner) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">Leaderboard</p><h1 class="title-xl">Top players</h1>' +
      '<p class="text">Ranked by certificates earned, then coins. Only display names are shown.</p></section>' + inner;
  }

  function load() {
    window.Web3Sync.leaderboard(50).then(function (rows) {
      var A = window.Web3Auth;
      show((rows.length ? '<ol class="lb-list">' + rows.map(function (r, i) {
        var rank = Web3Progress.rankFor(r.certificates, ranks);
        var lvl = Web3Progress.level(rank, ranks);
        return '<li class="lb-row' + (r.is_me ? ' is-me' : '') + '"><span class="lb-pos">' + (i + 1) + '</span>' +
          '<img class="acct-avatar' + (r.badge_frame ? ' ' + esc(r.badge_frame) : '') + '" src="' + Web3Avatar.dataUri(r.avatar_seed || r.display_name) + '" alt="" width="40" height="40" />' +
          '<span class="lb-who"><b>' + esc(r.display_name) + (r.is_me ? ' (you)' : '') + '</b><span class="small-print">' + lvl + '. ' + esc(rank.name) + ' · ' + r.certificates + ' cert' + (r.certificates === 1 ? '' : 's') + '</span></span>' +
          '<span class="lb-coins">' + window.WEB3TOYS.icon('coin') + Number(r.coins).toLocaleString('en-US') + '</span></li>';
      }).join('') + '</ol>' : '<p class="card text">No players yet. Finish a toy and log in to be first!</p>') +
        (A && !A.user() ? '<p class="text">Want to be on it? <button type="button" class="btn btn--small" data-login>Log in</button></p>' : '') +
        '<p class="small-print">Coins are site points only. They have no cash value and can never be withdrawn, sold or swapped.</p>');
      var b = app.querySelector('[data-login]');
      if (b) b.addEventListener('click', function () { A.open(); });
    }, function () { show('<p class="card text">The leaderboard could not load. Try again in a minute.</p>'); });
  }
})();
