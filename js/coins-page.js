// The coins part of My Progress: balance, how coins were earned, the rewards
// and the redeem form. Rewards and words come from data/rewards.json; where
// requests go is set in config.js (redeem).

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var CONFIG = window.WEB3TOYS_CONFIG || {};
  var box = document.getElementById('coins');
  if (!box) return;

  C.loadJson('../data/rewards.json').then(render).catch(function (err) { box.innerHTML = C.loadError(err); });

  function render(R) {
    var w = site.coins.wallet();
    var redeem = CONFIG.redeem || {};
    var want = new URLSearchParams(location.search).get('redeem');
    box.innerHTML =
      '<section class="card stack stack--tight coins-card">' +
      '<div class="coins-head">' + site.icon('coin', 'icon--lg') + '<div><h2 class="title-md">' + esc(R.title) + '</h2>' +
      '<p class="coins-balance"><span data-coin-count>' + w.balance.toLocaleString('en-US') + '</span> coins</p></div></div>' +
      '<p class="text">' + esc(R.line) + '</p>' +
      '<ul class="lesson-points">' + R.how.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' +
      (w.history.length
        ? '<details class="coins-history"><summary class="title-sm">History</summary><ul>' + w.history.map(function (h) {
            return '<li><span>' + esc(h.label) + '</span><b class="' + (h.coins < 0 ? 'is-spent' : '') + '">' + (h.coins > 0 ? '+' : '') + h.coins + '</b></li>';
          }).join('') + '</ul></details>'
        : '') +
      '<p class="small-print">' + esc(R.note) + '</p></section>' +

      '<h2 class="section-title">Rewards</h2>' +
      '<ul class="reward-list">' + R.rewards.map(function (r) {
        var ok = w.balance >= r.coins;
        return '<li class="card reward' + (ok ? ' is-ready' : '') + '"><div><h3 class="title-sm">' + esc(r.title) + '</h3><p class="small-print">' + esc(r.what) + '</p></div>' +
          '<p class="reward-price">' + site.icon('coin') + r.coins.toLocaleString('en-US') + '</p>' +
          '<div class="meter" role="img" aria-label="' + Math.min(100, Math.round((w.balance / r.coins) * 100)) + ' percent of the coins needed"><span style="width:' + Math.min(100, (w.balance / r.coins) * 100) + '%"></span></div></li>';
      }).join('') + '</ul>' +

      '<form class="card stack stack--tight" data-redeem' + (redeem.endpoint ? ' action="' + esc(redeem.endpoint) + '" method="post" target="_blank"' : '') + '>' +
      '<h2 class="title-md">' + esc(R.form.heading) + '</h2><p class="text">' + esc(R.form.line) + '</p>' +
      (redeem.shopTool ? '<p class="small-print">Coupons work on ' + esc(redeem.shopTool) + '.</p>' : '') +
      '<fieldset class="stack stack--tight coins-choices"><legend class="label">Reward</legend>' + R.rewards.map(function (r, i) {
        var ok = w.balance >= r.coins;
        var checked = ok && (want ? want === r.id : i === firstAffordable(R, w));
        return '<label class="check-row' + (ok ? '' : ' is-locked') + '"><input type="radio" name="reward" value="' + esc(r.id) + '"' + (ok ? '' : ' disabled') + (checked ? ' checked' : '') + ' required />' +
          esc(r.title) + ' (' + r.coins.toLocaleString('en-US') + ')</label>';
      }).join('') + '</fieldset>' +
      '<label class="label" for="redeem-email">Your email</label>' +
      '<input id="redeem-email" class="field" type="email" name="email" autocomplete="email" placeholder="you@example.com" required />' +
      '<label class="label" for="redeem-x">' + esc(R.form.xLabel) + '</label>' +
      '<input id="redeem-x" class="field" type="url" name="x_post" placeholder="https://x.com/..." />' +
      '<input type="hidden" name="coins" value="' + w.balance + '" /><input type="hidden" name="history" value="' + esc(summary(w).replace(/\n/g, ' | ')) + '" />' +
      '<button class="btn btn--yellow btn--block" type="submit"' + (firstAffordable(R, w) < 0 ? ' disabled' : '') + '>' + esc(R.form.button) + '</button>' +
      (firstAffordable(R, w) < 0 ? '<p class="small-print">Earn ' + R.rewards[0].coins.toLocaleString('en-US') + ' coins to unlock your first reward.</p>' : '') +
      '<p class="small-print" data-msg aria-live="polite"></p></form>';

    var form = box.querySelector('[data-redeem]');
    form.addEventListener('submit', function (e) {
      var choice = form.querySelector('input[name="reward"]:checked');
      var msg = form.querySelector('[data-msg]');
      if (!choice) return e.preventDefault();
      var reward = R.rewards.filter(function (r) { return r.id === choice.value; })[0];
      if (!redeem.endpoint && !redeem.email) {
        e.preventDefault();
        msg.textContent = R.form.soon;
        return;
      }
      if (!redeem.endpoint) {
        e.preventDefault();
        var body = 'Reward: ' + reward.title + '\nEmail: ' + form.email.value + '\nCoins: ' + w.balance + '\nX post: ' + (form.x_post.value || '-') + '\n\nHistory:\n' + summary(w);
        window.location.href = 'mailto:' + encodeURIComponent(redeem.email) + '?subject=' + encodeURIComponent('web3.toys reward: ' + reward.title) + '&body=' + encodeURIComponent(body);
      }
      site.coins.spend(reward.coins, 'Redeemed: ' + reward.title);
      C.track('coins_redeemed', { reward: reward.id });
      msg.textContent = R.form.thanks;
      setTimeout(function () { render(R); }, 1500);
    });
    if (want && location.hash === '#coins') box.scrollIntoView();
  }

  function firstAffordable(R, w) {
    for (var i = 0; i < R.rewards.length; i++) if (w.balance >= R.rewards[i].coins) return i;
    return -1;
  }

  // A short, readable summary of how the coins were earned, for the request.
  function summary(w) {
    return w.history.slice(0, 20).map(function (h) { return h.at + ' ' + (h.coins > 0 ? '+' : '') + h.coins + ' ' + h.label; }).join('\n');
  }
})();
