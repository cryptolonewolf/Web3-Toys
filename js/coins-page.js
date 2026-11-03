// The coins part of My Progress: balance, how to earn, history, and the
// cosmetic extras coins can unlock (certificate styles, badge frames and
// profile themes). Coins are site points only, with no cash value.
// Words and extras: data/cosmetics.json. Buying and wearing: js/sync.js.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var box = document.getElementById('coins');
  if (!box) return;
  var data = null;
  var msg = '';

  C.loadJson('../data/cosmetics.json').then(function (d) { data = d; render(); }).catch(function (err) { box.innerHTML = C.loadError(err); });
  document.addEventListener('web3toys:synced', function () { if (data) render(); });
  document.addEventListener('web3auth:ready', function () {
    window.Web3Auth.onChange(function () { if (data) render(); });
  });

  function cosmetics() {
    try { return JSON.parse(localStorage.getItem('web3toys.cosmetics.v1')) || { owned: [] }; } catch (e) { return { owned: [] }; }
  }

  function swatch(it) {
    var bg = it.color2 ? 'linear-gradient(135deg, ' + it.color + ', ' + it.color2 + ', ' + it.color + ')' : it.color;
    return '<span class="cx-swatch cx-swatch--' + it.slot + '" style="--sw:' + esc(bg) + '" aria-hidden="true"></span>';
  }

  function render() {
    var w = site.coins.wallet();
    var A = window.Web3Auth;
    var user = A && A.user();
    var cx = cosmetics();
    var wearing = { cert: cx.cert, frame: cx.frame, theme: cx.theme };
    box.innerHTML =
      '<section class="card stack stack--tight coins-card">' +
      '<div class="coins-head">' + site.icon('coin', 'icon--lg') + '<div><h2 class="title-md">Your coins</h2>' +
      '<p class="coins-balance"><span data-coin-count>' + w.balance.toLocaleString('en-US') + '</span> coins</p></div></div>' +
      '<p class="cx-nocash">' + esc(data.noCash) + '</p>' +
      '<ul class="lesson-points">' + data.how.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' +
      (w.history.length
        ? '<details class="coins-history"><summary class="title-sm">History</summary><ul>' + w.history.map(function (h) {
            return '<li><span>' + esc(h.label) + '</span><b class="' + (h.coins < 0 ? 'is-spent' : '') + '">' + (h.coins > 0 ? '+' : '') + h.coins + '</b></li>';
          }).join('') + '</ul></details>'
        : '') +
      '<p class="small-print">' + (user ? 'Saved to your account, on every device.' : 'Saved in this browser only. Log in to keep them on every device.') +
      ' <a href="../leaderboard/">See the leaderboard</a></p></section>' +
      '<h2 class="section-title">Extras</h2>' +
      (user ? '' : '<p class="text">Log in to unlock extras with your coins.' + (A ? ' <button type="button" class="btn btn--small" data-login>Log in</button>' : '') + '</p>') +
      data.slots.map(function (slot) {
        return '<section class="card stack stack--tight"><h3 class="title-sm">' + esc(slot.title) + '</h3><p class="small-print">' + esc(slot.line) + '</p><ul class="cx-grid">' +
          data.items.filter(function (it) { return it.slot === slot.id; }).map(function (it) {
            var owned = cx.owned.indexOf(it.id) >= 0;
            var worn = wearing[slot.id] === it.id;
            var action = !user ? '<span class="small-print">' + site.icon('coin') + it.coins + '</span>'
              : worn ? '<button type="button" class="btn btn--small" data-wear="' + slot.id + '" data-item="">Wearing ✓</button>'
              : owned ? '<button type="button" class="btn btn--small btn--yellow" data-wear="' + slot.id + '" data-item="' + it.id + '">Wear</button>'
              : '<button type="button" class="btn btn--small" data-buy="' + it.id + '"' + (w.balance < it.coins ? ' disabled' : '') + '>' + site.icon('coin') + it.coins + '</button>';
            return '<li class="cx-item' + (worn ? ' is-on' : '') + '">' + swatch(it) + '<b>' + esc(it.title) + '</b>' + action + '</li>';
          }).join('') + '</ul></section>';
      }).join('') +
      '<p class="small-print" data-cx-msg aria-live="polite">' + esc(msg) + '</p>';

    var login = box.querySelector('[data-login]');
    if (login) login.addEventListener('click', function () { A.open(); });
    box.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var it = data.items.filter(function (x) { return x.id === b.getAttribute('data-buy'); })[0];
        if (!window.confirm('Unlock ' + it.title + ' for ' + it.coins + ' coins?')) return;
        b.disabled = true;
        window.Web3Sync.buy(it.id).then(function () {
          msg = 'Unlocked ' + it.title + '. Tap Wear to use it.';
          site.sound.play('ding');
          render();
        }, function (err) { msg = 'Could not unlock it: ' + err.message; render(); });
      });
    });
    box.querySelectorAll('[data-wear]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        window.Web3Sync.equip(b.getAttribute('data-wear'), b.getAttribute('data-item') || null).then(function () {
          msg = '';
          render();
        }, function (err) { msg = 'Could not change it: ' + err.message; render(); });
      });
    });
    applyTheme(cx.theme);
  }

  function applyTheme(theme) {
    if (theme) document.body.setAttribute('data-theme', theme);
    else document.body.removeAttribute('data-theme');
  }
})();
