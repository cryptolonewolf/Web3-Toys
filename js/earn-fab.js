// The floating coin button: "🪙 Earn 275" in the corner. Tapping it opens
// the Earn coins tasks (js/earn-tasks.js) as a panel from the bottom on
// phones and from the right on computers. It hides once every task is done,
// for a day after its × is tapped, on My Progress and admin (they have the
// list or do not need it), and while a game or quiz is being played: it
// shows on a toy's start screen, goes away once play starts, and comes back
// on the finish screen (the one with the "Take it further" offers).

(function () {
  var site = window.WEB3TOYS;
  var T = window.Web3EarnTasks;
  var HIDE_KEY = 'web3toys.earnFab.v1';
  var path = location.pathname.replace(site.root.replace(/^https?:\/\/[^/]+/, ''), '/');
  if (!T || /^\/(progress|admin)\//.test(path)) return;

  var quests = null;
  var fab, panel, playing = false, open = false, note = '';
  var app = document.getElementById('app');
  // Toy pages: anything that is not the home page or a hub page.
  var isToy = !/^\/($|builder\/$|academy\/$|books\/|about\/|leaderboard\/|real-toys\/|work-with-us\/|book-a-call\/|soon\/|contact\/|privacy\/|terms\/|refunds\/|verify\/)/.test(path);

  function hiddenToday() {
    try { return Date.now() - Number(localStorage.getItem(HIDE_KEY) || 0) < 864e5; } catch (e) { return false; }
  }

  function draw() {
    if (!quests) return;
    var s = T.state();
    var left = T.left(quests, s);
    var worth = left.reduce(function (n, q) { return n + q.coins; }, 0);
    var show = left.length && !hiddenToday() && !playing;
    if (!fab) {
      fab = document.createElement('div');
      fab.className = 'earn-fab';
      fab.innerHTML = '<button type="button" class="earn-fab-btn" aria-controls="earn-panel" data-fab-open></button>' +
        '<button type="button" class="earn-fab-x" aria-label="Hide for today" data-fab-hide>×</button>';
      document.body.appendChild(fab);
      fab.querySelector('[data-fab-open]').addEventListener('click', function () { open ? close() : openPanel(); });
      fab.querySelector('[data-fab-hide]').addEventListener('click', function () {
        try { localStorage.setItem(HIDE_KEY, String(Date.now())); } catch (e) { /* private mode */ }
        close();
        fab.hidden = true;
      });
    }
    fab.hidden = !show && !open;
    var btn = fab.querySelector('[data-fab-open]');
    btn.textContent = '🪙 Earn ' + worth;
    btn.setAttribute('aria-expanded', String(open));
    if (open) drawPanel(s, left, worth);
  }

  function drawPanel(s, left, worth) {
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'earn-panel';
      panel.id = 'earn-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-labelledby', 'earn-title');
      document.body.appendChild(panel);
    }
    panel.hidden = false;
    panel.innerHTML = '<div class="earn-panel-head"><h2 class="title-sm" id="earn-title">Earn coins <span class="small-print">' +
      (left.length ? left.length + ' left, worth ' + worth + ' coins' : 'All done!') + '</span></h2>' +
      '<button type="button" class="earn-panel-close" aria-label="Close" data-close>×</button></div>' +
      '<p class="small-print" data-note aria-live="polite">' + (note ? note : 'Coins unlock reports, books and extras. No cash value.') + '</p>' +
      '<ul class="qs-list">' + T.list(quests).map(function (q) { return T.row(q, s, null, quests.invite && quests.invite.post); }).join('') + '</ul>' +
      '<a class="earn-panel-more" href="' + site.root + 'progress/#coins">Invite friends and spend coins →</a>';
    panel.querySelector('[data-close]').addEventListener('click', close);
    T.bind(panel, function (m) { note = m; draw(); }, true);
  }

  function openPanel() {
    open = true;
    note = '';
    draw();
    var first = panel && panel.querySelector('button, a');
    if (first) first.focus();
  }

  function close() {
    open = false;
    if (panel) panel.hidden = true;
    draw();
    var b = fab && fab.querySelector('[data-fab-open]');
    if (b && !fab.hidden) b.focus();
  }

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) close(); });
  document.addEventListener('click', function (e) {
    if (open && e.target.isConnected && panel && !panel.contains(e.target) && !fab.contains(e.target) && !e.target.closest('.acct-modal, .pay-modal, [role="dialog"]')) close();
  });

  // On toy pages: playing starts at the first tap inside the toy, and ends
  // when the finish screen (its offers box) appears.
  if (isToy && app) {
    app.addEventListener('click', function (e) {
      if (playing || (fab && fab.contains(e.target))) return;
      if (app.querySelector('[data-offers]')) return;
      if (e.target.closest('button, a, input, label')) { playing = true; close(); draw(); }
    }, true);
    new MutationObserver(function () {
      if (playing && app.querySelector('[data-offers]')) { playing = false; draw(); }
    }).observe(app, { childList: true, subtree: true });
  }

  ['web3toys:synced', 'web3toys:changed'].forEach(function (ev) { document.addEventListener(ev, draw); });
  if (window.Web3Auth) window.Web3Auth.onChange(function () { draw(); });
  T.load().then(function (q) { quests = q; draw(); }).catch(function () {});
})();
