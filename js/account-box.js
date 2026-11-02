// The account box at the top of My Progress: a Log in button for visitors,
// or the avatar, name, Log out and "Delete my account and data" when logged
// in. Hidden when accounts are switched off in config.js.

(function () {
  var box = document.getElementById('account-box');
  if (!box) return;
  var esc = window.Web3Common.esc;

  function start() {
    var A = window.Web3Auth;
    if (!A) return;
    A.onChange(function (user, profile) { paint(A, user, profile); });
  }

  function paint(A, user, profile) {
    if (!user) {
      box.innerHTML = '<section class="card acct-box stack stack--tight"><h2 class="title-md">Save your progress</h2>' +
        '<p class="text">Log in to keep your coins, certificates and rank on any device. Your progress in this browser comes with you.</p>' +
        '<div class="btn-row"><button type="button" class="btn btn--ink" data-login>Log in or sign up</button></div></section>';
      box.querySelector('[data-login]').addEventListener('click', function () { A.open(); });
      return;
    }
    var name = (profile && profile.display_name) || 'Player';
    var pic = profile && profile.avatar_url;
    box.innerHTML = '<section class="card acct-box stack stack--tight"><div class="acct-row">' +
      (pic ? '<img class="acct-avatar acct-avatar--big" src="' + esc(pic) + '" alt="" width="56" height="56" referrerpolicy="no-referrer" />'
        : '<span class="acct-avatar acct-avatar--big acct-avatar--letter" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + '</span>') +
      '<div class="stack stack--tight acct-who"><p class="title-sm">' + esc(name) + '</p><p class="small-print">Logged in with ' + esc(provider(profile)) + '</p></div></div>' +
      '<details class="acct-settings"><summary class="small-print">Account settings</summary><div class="stack stack--tight">' +
      '<form class="stack stack--tight" data-name><label class="label" for="acct-name">Display name (shown on the leaderboard)</label>' +
      '<div class="lk-row"><input id="acct-name" class="field" maxlength="40" value="' + esc(name) + '" /><button type="submit" class="btn btn--small">Save</button></div></form>' +
      '<div class="btn-row"><button type="button" class="btn btn--small" data-logout>Log out</button>' +
      '<button type="button" class="btn btn--small acct-danger" data-delete>Delete my account and data</button></div>' +
      '<p class="small-print" data-acct-say aria-live="polite"></p></div></details></section>';
    var say = box.querySelector('[data-acct-say]');
    box.querySelector('[data-name]').addEventListener('submit', function (e) {
      e.preventDefault();
      A.setName(box.querySelector('#acct-name').value).then(function () { say.textContent = 'Saved.'; }, function (err) { say.textContent = 'Could not save: ' + err.message; });
    });
    box.querySelector('[data-logout]').addEventListener('click', function () { A.signOut(); });
    box.querySelector('[data-delete]').addEventListener('click', function () {
      var typed = window.prompt('This deletes your account, progress, coins and certificates for good, and clears web3.toys data in this browser. Purchase records we must keep by law stay. Type DELETE to confirm.');
      if (typed !== 'DELETE') { say.textContent = 'Nothing was deleted.'; return; }
      say.textContent = 'Deleting…';
      A.deleteAccount().then(function () { location.reload(); }, function (err) { say.textContent = 'Could not delete: ' + err.message + '. Email us from the Contact page and we will do it.'; });
    });
  }

  function provider(p) {
    var v = (p && p.provider) || 'email';
    return { x: 'X', twitter: 'X', google: 'Google', email: 'email' }[v] || v;
  }

  if (window.Web3Auth) start();
  else document.addEventListener('web3auth:ready', start);
})();
