// /pages/: the directory of profile pages. Filters (projects, creators,
// personalities), search and "Verified only". Pro pages come first and are
// marked Featured; pages nobody has claimed yet come last.
// Database: directory_pages (supabase/021_pages_pro.sql).

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var R = site.root || '/';
  var P, state = { type: '', q: '', verified: false }, timer;

  if (!site.businessOn()) { app.innerHTML = '<section class="card stack stack--tight"><h1 class="title-md">Pages are coming soon</h1><p class="text">The directory opens in December.</p></section>'; return; }

  C.loadJson(R + 'data/business/pages.json').then(function (j) { P = j; shell(); load(); }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function img(path) { return SB.url.replace(/\/$/, '') + '/storage/v1/object/public/page-images/' + path; }

  function shell() {
    app.innerHTML = '<section class="biz-hero stack stack--tight"><p class="label">Directory</p><h1 class="biz-title">Web3 pages</h1>' +
      '<p class="text text--ink">Projects, creators and web3 personalities on web3.toys: their toys, their courses, their links. Every project is vetted.</p></section>' +
      '<div class="dir-tools"><div class="btn-row dir-filters" role="group" aria-label="Show">' + [['', 'All']].concat(Object.keys(P.types).map(function (k) { return [k, P.types[k].icon + ' ' + (P.types[k].plural || P.types[k].label)]; })).map(function (f) {
        return '<button type="button" class="btn btn--small' + (f[0] === state.type ? ' btn--ink' : '') + '" data-type="' + f[0] + '" aria-pressed="' + (f[0] === state.type) + '">' + esc(f[1]) + '</button>';
      }).join('') + '</div>' +
      '<input class="field" type="search" placeholder="Search by name or @handle" aria-label="Search pages" data-q value="' + esc(state.q) + '" />' +
      '<label class="mk-check"><input type="checkbox" data-verified' + (state.verified ? ' checked' : '') + ' /> <span>✓ Verified only</span></label></div>' +
      '<ul class="dir-grid" data-list aria-live="polite"><li class="small-print">Loading…</li></ul>' +
      '<section class="card card--yellow stack stack--tight"><h2 class="title-md">Get your free page</h2><p class="text">One link for your project or your content, with a Verified via X badge.</p><a class="btn btn--ink" href="' + R + 'my-page/">Make your page</a></section>';
    app.querySelectorAll('[data-type]').forEach(function (b) { b.addEventListener('click', function () { state.type = b.getAttribute('data-type'); shell(); load(); }); });
    app.querySelector('[data-q]').addEventListener('input', function (e) { state.q = e.target.value.trim(); clearTimeout(timer); timer = setTimeout(load, 250); });
    app.querySelector('[data-verified]').addEventListener('change', function (e) { state.verified = e.target.checked; load(); });
  }

  var asked = 0;
  function load() {
    var mine = ++asked;
    fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/directory_pages', {
      method: 'POST', headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_type: state.type || null, p_q: state.q || null, p_verified: state.verified }),
    }).then(function (r) { return r.ok ? r.json() : []; }).then(function (rows) {
      if (mine !== asked) return;
      var list = app.querySelector('[data-list]');
      list.innerHTML = rows.length ? rows.map(function (p) {
        var T = P.types[p.type] || P.types.project;
        return '<li><a class="card dir-card' + (p.pro ? ' is-featured' : '') + (p.claimed ? '' : ' is-unclaimed') + '" href="' + R + '@' + esc(p.handle) + '" style="--pg-color:' + esc(p.color) + '">' +
          (p.pro ? '<span class="chip is-yellow dir-feat">⭐ Featured</span>' : '') +
          '<span class="dir-head">' + (p.avatar_path ? '<img class="pg-avatar" src="' + esc(img(p.avatar_path)) + '" alt="" width="52" height="52" loading="lazy" />' : '<span class="pg-avatar pg-avatar--letter" aria-hidden="true">' + esc(p.name.charAt(0).toUpperCase()) + '</span>') +
          '<span class="dir-names"><b>' + esc(p.name) + '</b><span class="small-print">@' + esc(p.handle) + '</span></span></span>' +
          '<span class="chips"><span class="chip is-white">' + T.icon + ' ' + esc(T.label) + '</span>' + (p.verified ? '<span class="chip is-mint">✓ Verified</span>' : !p.claimed ? '<span class="chip is-white pg-unclaimed">' + esc(P.copy.notClaimed) + '</span>' : '') + '</span>' +
          (p.bio ? '<span class="small-print dir-bio">' + esc(p.bio) + '</span>' : '') + '</a></li>';
      }).join('') : '<li class="text">No pages match yet.</li>';
    }).catch(function () { app.querySelector('[data-list]').innerHTML = '<li class="text">Could not load the directory. Try again.</li>'; });
  }
})();
