// The Earn coins tasks (data/quests.json), shared by My Progress (Coins tab,
// js/profile.js) and the floating coin button (js/earn-fab.js).
//
//   Web3EarnTasks.load()          -> Promise of data/quests.json
//   Web3EarnTasks.state()         who is playing, coins claimed, streak, certificates
//   Web3EarnTasks.list(quests)    the tasks to show (social ones only once linked)
//   Web3EarnTasks.left(quests, s) tasks not done yet
//   Web3EarnTasks.row(q, s, invite)   one task row (HTML)
//   Web3EarnTasks.bind(box, done)  wires the buttons inside box; done(message)
//                                  runs after a claim or a change, to redraw
//   Web3EarnTasks.xIntent(invite), inviteUrl(invite)

(function () {
  var C = window.Web3Common;
  var esc = C ? C.esc : function (s) { return String(s); };
  var site = window.WEB3TOYS;
  var opened = {};
  var data = null;

  function load() {
    if (!data) data = fetch(site.root + 'data/quests.json').then(function (r) { return r.json(); });
    data.catch(function () { data = null; });
    return data;
  }

  function streak(claimed) {
    var days = {};
    Object.keys(claimed).forEach(function (id) { if (id.indexOf('daily:') === 0) days[id.slice(6)] = true; });
    var d = new Date();
    var key = function (x) { return x.toISOString().slice(0, 10); };
    if (!days[key(d)]) d.setUTCDate(d.getUTCDate() - 1);
    var n = 0;
    while (days[key(d)]) { n++; d.setUTCDate(d.getUTCDate() - 1); }
    return n;
  }

  function state() {
    var A = window.Web3Auth;
    var w = site.coins.wallet();
    var progress = window.Web3Progress ? Web3Progress.load(localStorage) : { certificates: {} };
    return {
      user: A && A.user(),
      w: w,
      certCount: Object.keys(progress.certificates || {}).length,
      streak: streak(w.claimed || {}),
    };
  }

  function socialLink(q) {
    return ((window.WEB3TOYS_CONFIG || {}).social || {})[q.link] || '';
  }

  function list(quests) {
    return quests.quests.filter(function (q) { return q.type !== 'honor' || socialLink(q); });
  }

  function isDone(q, s) {
    return !!(s.w.claimed || {})['quest:' + q.id];
  }

  function left(quests, s) {
    return list(quests).filter(function (q) { return !isDone(q, s); });
  }

  function ready(q, s) {
    if (q.need === 'login') return !!s.user;
    if (q.need === 'finish') return Object.keys(s.w.claimed || {}).some(function (k) { return k.indexOf('finish:') === 0; });
    if (q.need === 'certificate') return s.certCount > 0;
    if (q.need === 'streak') return s.streak >= q.days;
    if (q.type === 'honor') return !!opened[q.id];
    return true;
  }

  function inviteUrl(invite) {
    return invite && invite.code ? 'https://web3.toys/?ref=' + invite.code : 'https://web3.toys/';
  }

  function xIntent(invite, post) {
    return 'https://x.com/intent/post?text=' + encodeURIComponent((post || 'Learning web3 by playing little toys on web3.toys') + ' ' + inviteUrl(invite));
  }

  function row(q, s, invite, post) {
    var done = isDone(q, s);
    var action;
    var proofForm = q.type === 'post' && s.user && !done;
    if (done) action = '<span class="chip is-mint">Done ✓</span>';
    else if (!s.user) action = q.id === 'account' ? '<button type="button" class="btn btn--small btn--yellow" data-login>Log in</button>' : '<span class="small-print">Log in first</span>';
    else if (q.type === 'post') action = '<a class="btn btn--small" href="' + esc(xIntent(invite, post)) + '" target="_blank" rel="noopener" data-post-open>Write post</a>';
    else if (q.type === 'honor' && !ready(q, s)) action = '<a class="btn btn--small" href="' + esc(socialLink(q)) + '" target="_blank" rel="noopener" data-open="' + q.id + '">Open</a>';
    else if (ready(q, s)) action = '<button type="button" class="btn btn--small btn--yellow" data-claim="' + q.id + '">Claim +' + q.coins + '</button>';
    else action = q.go ? '<a class="btn btn--small" href="' + site.root + esc(q.go) + '">Go</a>' : '<span class="small-print">' + (q.need === 'streak' ? s.streak + '/' + q.days + ' days' : 'Not yet') + '</span>';
    return '<li class="qs-row' + (done ? ' is-done' : '') + '"><span class="qs-coins">+' + q.coins + '</span><div><b>' + esc(q.title) + '</b>' + (q.line && !done ? '<span class="small-print">' + esc(q.line) + '</span>' : '') +
      (proofForm ? '<form class="lk-row qs-proof" data-proof><input class="field" type="url" inputmode="url" placeholder="https://x.com/you/status/…" aria-label="Link to your post" /><button type="submit" class="btn btn--small btn--yellow">Claim +' + q.coins + '</button></form>' : '') +
      '</div>' + action + '</li>';
  }

  // withLogin: also wire the Log in button (pages that do not do it themselves).
  function bind(box, done, withLogin) {
    box.querySelectorAll('[data-claim]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        window.Web3Sync.claimQuest(b.getAttribute('data-claim')).then(function (n) {
          if (n) { site.fx.coins(b, 5); site.sound.play('cash'); }
          done(n ? '+' + n + ' coins!' : '');
        }, function (err) { b.disabled = false; done(err.message); });
      });
    });
    box.querySelectorAll('[data-open]').forEach(function (a) {
      a.addEventListener('click', function () { opened[a.getAttribute('data-open')] = true; setTimeout(function () { done(''); }, 400); });
    });
    if (withLogin) box.querySelectorAll('[data-login]').forEach(function (b) {
      b.addEventListener('click', function () { if (window.Web3Auth) window.Web3Auth.open(); });
    });
    var proof = box.querySelector('[data-proof]');
    if (proof) proof.addEventListener('submit', function (e) {
      e.preventDefault();
      var url = proof.querySelector('input').value.trim();
      window.Web3Sync.claimQuest('post-x', url).then(function (n) { done(n ? '+' + n + ' coins! Thanks for sharing.' : ''); }, function (err) { done(err.message); });
    });
  }

  window.Web3EarnTasks = { load: load, state: state, list: list, left: left, isDone: isDone, ready: ready, row: row, bind: bind, xIntent: xIntent, inviteUrl: inviteUrl, streak: streak };
})();
