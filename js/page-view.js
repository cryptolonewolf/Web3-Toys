// web3.toys/@handle: a profile page for a project, creator or web3
// personality (vercel.json sends /@handle here). Words: data/business/pages.json.
// Database: page_public, claim_page, report_page (supabase/019_pages.sql).
// Claiming: Log in with X; the database checks the X account matches.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var AUTH = (window.WEB3TOYS_CONFIG || {}).auth || {};
  var CLAIM_KEY = 'web3toys.claim.v1';
  var R = site.root || '/';
  var m = location.pathname.match(/^\/@([A-Za-z0-9_]{1,15})\/?$/) || [null, new URLSearchParams(location.search).get('h')];
  var handle = m[1] || '';
  var P, page, home, courses = {};

  function say(html) { app.innerHTML = '<section class="card stack stack--tight">' + html + '</section>'; }
  function img(path) { return SB.url.replace(/\/$/, '') + '/storage/v1/object/public/page-images/' + path; }
  function fill(t) { return String(t || '').replace(/\{handle\}/g, page ? page.handle : handle); }

  if (!site.businessOn()) return say('<h1 class="title-md">Pages are coming soon</h1><p class="text">Profile pages for projects and creators open in December.</p><a class="btn btn--ink" href="' + R + '">Play the toys</a>');
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) || !SB.url) return say('<h1 class="title-md">Page not found</h1><p class="text">Check the address: it looks like web3.toys/@name.</p><a class="btn btn--ink" href="' + R + '">Back to web3.toys</a>');

  Promise.all([C.loadJson(R + 'data/business/pages.json'), C.loadJson(R + 'data/home.json'), C.loadJson(R + 'data/academy/index.json').catch(function () { return { courses: [] }; })]).then(function (r) {
    P = r[0]; home = r[1];
    return Promise.all(r[2].courses.map(function (id) { return C.loadJson(R + 'data/academy/' + id + '.json').then(function (c) { courses[id] = c; }, function () {}); }));
  }).then(function () {
    var go = function () { window.Web3Auth.onChange(function () { load(); }); };
    if (window.Web3Auth) go(); else { document.addEventListener('web3auth:ready', go, { once: true }); setTimeout(function () { if (!window.Web3Auth) load(); }, 2500); }
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function client() { return window.Web3Auth && window.Web3Auth.client; }
  function rpc(fn, args) {
    if (client()) return client().rpc(fn, args).then(function (r) { if (r.error) throw r.error; return r.data; });
    return fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.message || 'Could not load'); return j; }); });
  }

  // Runs again when the login changes (an answer that arrives late is ignored).
  var asked = 0;
  function load() {
    var mine = ++asked;
    rpc('page_public', { p_handle: handle }).then(function (p) {
      if (mine !== asked) return;
      if (Array.isArray(p)) p = p[0] || null;
      page = p;
      if (!p) return say('<h1 class="title-md">No page at @' + esc(handle) + ' right now</h1><p class="text">Want your own free page? Make one with Log in with X: it lives at your own X handle.</p><div class="btn-row"><a class="btn btn--ink" href="' + R + 'my-page/">Make your page</a><a class="btn" href="' + R + '">Play the toys</a></div>');
      render();
      var pending = null;
      try { pending = sessionStorage.getItem(CLAIM_KEY); } catch (e) { /* private mode */ }
      if (pending && pending.toLowerCase() === p.handle.toLowerCase() && !p.claimed && window.Web3Auth && window.Web3Auth.user()) {
        try { sessionStorage.removeItem(CLAIM_KEY); } catch (e) { /* ok */ }
        claim();
      }
    }).catch(function (err) { if (mine === asked) app.innerHTML = C.loadError(err); });
  }

  function toyCards(ids) {
    var byId = {};
    home.shelves.forEach(function (s) { s.cards.forEach(function (c) { byId[c.id] = c; }); });
    return ids.map(function (id) { return byId[id]; }).filter(function (c) { return c && c.path; }).map(function (c) {
      return '<li><a class="card pg-toy is-' + esc(c.color || 'yellow') + '" href="' + R + esc(c.path) + '?via=' + esc(page.handle) + '"><b>' + esc(c.title) + '</b><span class="small-print">' + esc(c.topic || c.blurb || '') + '</span><span class="pg-play">▶ Play</span></a></li>';
    }).join('');
  }
  function courseCards(ids) {
    return ids.map(function (id) { return courses[id] ? [id, courses[id]] : null; }).filter(Boolean).map(function (x) {
      return '<li><a class="card pg-toy" href="' + R + 'academy/course/?c=' + esc(x[0]) + '&via=' + esc(page.handle) + '"><b>🎓 ' + esc(x[1].name) + '</b><span class="small-print">' + esc(x[1].tagline || '') + '</span><span class="pg-play">Start the course</span></a></li>';
    }).join('');
  }

  function render() {
    var p = page;
    var T = P.types[p.type] || P.types.project;
    var socials = P.socials.filter(function (s) { return (p.socials || {})[s.id]; }).map(function (s) { return '<a class="btn btn--small" href="' + esc(p.socials[s.id]) + '" target="_blank" rel="noopener nofollow ugc">' + esc(s.label) + '</a>'; });
    if (p.website) socials.unshift('<a class="btn btn--small" href="' + esc(p.website) + '" target="_blank" rel="noopener nofollow ugc">🌐 Website</a>');
    var owner = '';
    if (p.is_owner || (p.admin_note !== null && p.admin_note !== undefined && !p.is_owner && p.status !== 'published')) {
      var note = { draft: P.copy.draftNote, pending: P.copy.reviewNote, rejected: P.copy.rejectedNote, suspended: P.copy.suspendedNote }[p.status];
      owner = '<section class="card pg-owner stack stack--tight"><div class="cap-row"><b>' + (p.is_owner ? 'This is your page' : 'Admin view') + '</b><span class="chip is-yellow">' + esc(p.status) + '</span></div>' +
        (note ? '<p class="small-print">' + esc(note) + '</p>' : '') + (p.admin_note && p.status !== 'published' ? '<p class="text">Note from web3.toys: ' + esc(p.admin_note) + '</p>' : '') +
        ((p.flags || []).length ? '<p class="small-print">Waiting for a quick review because of: ' + esc(p.flags.join(', ')) + '.</p>' : '') +
        (p.is_owner ? '<a class="btn btn--small btn--ink" href="' + R + 'my-page/">Edit your page</a>' : '') + '</section>';
    }
    document.title = p.name + ' (@' + p.handle + ') · web3.toys';
    app.innerHTML = owner +
      '<section class="pg-hero" style="--pg-color:' + esc(p.color) + '">' +
      '<div class="pg-banner"' + (p.banner_path ? ' style="background-image:url(\'' + esc(img(p.banner_path)) + '\')"' : '') + '></div>' +
      '<div class="pg-head">' + (p.avatar_path ? '<img class="pg-avatar" src="' + esc(img(p.avatar_path)) + '" alt="" width="96" height="96" />' : '<span class="pg-avatar pg-avatar--letter" aria-hidden="true">' + esc(p.name.charAt(0).toUpperCase()) + '</span>') +
      '<div class="pg-names"><h1 class="title-lg">' + esc(p.name) + '</h1><p class="small-print"><a href="https://x.com/' + esc(p.handle) + '" target="_blank" rel="noopener">@' + esc(p.handle) + '</a></p></div></div>' +
      '<div class="chips pg-chips"><span class="chip is-white">' + T.icon + ' ' + esc(T.label) + '</span>' +
      (p.verified ? '<span class="chip is-mint pg-verified">✓ ' + esc(P.copy.verified) + '</span>' : !p.claimed ? '<span class="chip is-white pg-unclaimed">' + esc(P.copy.notClaimed) + '</span>' : '') + '</div>' +
      (p.bio ? '<p class="text text--ink pg-bio">' + esc(p.bio) + '</p>' : '') +
      (socials.length ? '<div class="btn-row pg-links">' + socials.join('') + '</div>' : '') +
      (p.type === 'project' && firstPlay(p) ? '<a class="btn btn--ink btn--block pg-cta" href="' + esc(firstPlay(p)) + '">▶ Play</a>' : '') + '</section>' +
      (!p.claimed ? '<section class="card card--yellow stack stack--tight pg-claim"><b>' + esc(P.copy.notClaimedLine) + '</b><p class="small-print">' + esc(fill(P.copy.claimHow)) + '</p>' +
        '<button type="button" class="btn btn--ink" data-claim>' + esc(P.copy.claim) + '</button><p class="small-print" data-claim-msg aria-live="polite"></p></section>' : '') +
      ((p.featured_toys || []).length ? '<section class="stack stack--tight"><h2 class="section-title">' + (p.type === 'project' ? 'Our toys' : 'Toys I recommend') + '</h2><ul class="pg-toys">' + toyCards(p.featured_toys) + '</ul></section>' : '') +
      ((p.featured_courses || []).length ? '<section class="stack stack--tight"><h2 class="section-title">Quests</h2><ul class="pg-toys">' + courseCards(p.featured_courses) + '</ul></section>' : '') +
      '<div data-more></div>' +
      '<p class="small-print pg-foot">Pages are made by their owners' + (!p.claimed ? ' (this one by web3.toys, from public information)' : '') + '. web3.toys does not endorse any token. Not financial advice. ' +
      '<button type="button" class="text-button" data-report>' + esc(P.copy.report) + '</button></p>';
    var c = app.querySelector('[data-claim]');
    if (c) c.addEventListener('click', claim);
    app.querySelector('[data-report]').addEventListener('click', report);
    showClaim();
    more(app.querySelector('[data-more]'));
    document.dispatchEvent(new CustomEvent('web3page:render', { detail: { page: p, box: app.querySelector('[data-more]') } }));
  }

  // The first featured toy (or course) to play.
  function firstPlay(p) {
    var byId = {};
    home.shelves.forEach(function (s) { s.cards.forEach(function (c) { byId[c.id] = c; }); });
    var t = (p.featured_toys || []).map(function (id) { return byId[id]; }).filter(function (c) { return c && c.path; })[0];
    if (t) return R + t.path + '?via=' + p.handle;
    var c = (p.featured_courses || []).filter(function (id) { return courses[id]; })[0];
    return c ? R + 'academy/course/?c=' + c + '&via=' + p.handle : '';
  }

  // ---------- Part B: what each page shows ----------
  var ranks = null;
  function face(f) {
    var src = f && f.avatar_seed && window.Web3Avatar ? window.Web3Avatar.dataUri(f.avatar_seed) : '';
    return src ? '<img class="acct-avatar pg-face' + (f.badge_frame ? ' ' + esc(f.badge_frame) : '') + '" src="' + src + '" alt="" width="32" height="32" />' : '<span class="pg-face pg-face--anon" aria-hidden="true">🙂</span>';
  }
  function names(list) {
    return '<ul class="pg-fans">' + list.map(function (f) { return '<li>' + face(f) + '<span>' + esc(f.display_name) + '</span></li>'; }).join('') + '</ul>';
  }
  function rankFor(n) {
    var r = (ranks || []).filter(function (x) { return n >= x.min; }).pop();
    return r ? r.name : '';
  }
  function more(box) {
    if (!box) return;
    var p = page;
    var need = [rpc('page_showcase', { p_handle: p.handle }), ranks ? Promise.resolve(null) : C.loadJson(R + 'data/ranks.json').then(function (j) { ranks = j.ranks; }, function () { ranks = []; }),
      p.is_owner || p.flags ? rpc('page_stats', { p_id: p.id }).catch(function () { return null; }) : Promise.resolve(null),
      rpc('page_pro_info', { p_id: p.id }).catch(function () { return null; })];
    Promise.all(need).then(function (r) {
      var S = r[0] || {};
      var stats = r[2];
      var pro = r[3] || {};
      var html = '';
      // Pro: a badge on the page; the owner sees the end date.
      if (pro.pro) {
        var chips = app.querySelector('.pg-chips');
        if (chips && !chips.querySelector('.pg-pro')) chips.insertAdjacentHTML('beforeend', '<span class="chip is-yellow pg-pro">⭐ Pro</span>');
      }
      var ob = app.querySelector('.pg-owner');
      if (ob && p.is_owner && !ob.querySelector('[data-pro-line]')) {
        ob.insertAdjacentHTML('beforeend', '<p class="small-print" data-pro-line>' + (pro.pro && pro.pro_until ? '⭐ Pro until ' + esc(new Date(pro.pro_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })) + '.' : 'Free plan. Pro comes with a toy, course or test on web3.toys.') + ' <a href="' + R + 'my-page/#pro">Pro tools</a></p>');
      }
      // Free pages carry this month's site-wide sponsor (Pro pages don't).
      if (!pro.pro) sponsorCard(box);
      if (p.type === 'project') {
        html += '<section class="card stack stack--tight"><h2 class="title-md">🎓 ' + esc(p.name) + ' Pro players</h2>' +
          '<p class="text"><b>' + Number(S.pro_count || 0).toLocaleString('en-US') + '</b> ' + (Number(S.pro_count) === 1 ? 'player has' : 'players have') + ' earned the Pro badge' + ((p.featured_courses || []).length ? ' in the Quest.' : '.') + '</p>' +
          ((S.pro_fans || []).length ? names(S.pro_fans) : '') +
          '<p class="small-print">Only players who chose to share with ' + esc(p.name) + ' are shown by name.</p></section>';
        if ((S.leaderboard || []).length) {
          html += '<section class="card stack stack--tight"><h2 class="title-md">🏆 Leaderboard</h2><ol class="pg-board">' + S.leaderboard.map(function (x, i) {
            return '<li><span class="pg-rank">' + (i + 1) + '</span>' + face(x.display_name ? x : null) + '<span class="pg-name">' + (x.display_name ? esc(x.display_name) : '<i>A player</i>') + '</span><span class="small-print">' + x.certificates + ' ' + (x.certificates === 1 ? 'certificate' : 'certificates') + ' · ' + x.score + '%</span></li>';
          }).join('') + '</ol><p class="small-print">From certificates in ' + esc(p.name) + '\'s toys and courses. Names show only for players who chose to share with this page.</p></section>';
        }
      }
      if (p.type === 'creator' && p.claimed) {
        html += '<section class="card card--yellow stack stack--tight"><h2 class="title-md">🎮 Play with ' + esc(p.name) + '</h2>' +
          (S.ref_code ? '<a class="btn btn--ink" href="' + R + '?ref=' + esc(S.ref_code) + '&via=' + esc(p.handle) + '">Join web3.toys with my link</a>' : '') +
          '<p class="text"><b>' + Number(S.joined || 0).toLocaleString('en-US') + '</b> ' + (Number(S.joined) === 1 ? 'player has' : 'players have') + ' joined with ' + esc(p.name) + '\'s link.</p>' +
          ((S.joined_fans || []).length ? names(S.joined_fans) : '') + '<p class="small-print">Only players who chose to share with ' + esc(p.name) + ' are shown by name.</p></section>';
      }
      if ((p.type === 'creator' || p.type === 'personality') && S.certificates) {
        var n = S.certificates.length;
        html += '<section class="card stack stack--tight"><h2 class="title-md">🏅 Badges</h2>' +
          '<div class="chips"><span class="chip is-yellow">' + esc(rankFor(n) || 'Player') + '</span><span class="chip is-white">' + n + ' ' + (n === 1 ? 'certificate' : 'certificates') + '</span></div>' +
          (n ? '<ul class="pg-badges">' + S.certificates.map(function (c) { return '<li class="chip ' + (c.pro ? 'is-mint' : 'is-white') + '">' + (c.pro ? '🎓 ' : '✅ ') + esc(c.title) + (c.pro ? ' · Pro' : '') + '</li>'; }).join('') + '</ul>'
            : '<p class="small-print">No certificates yet.</p>') + '</section>';
      }
      if (stats) {
        var row = function (label, v) { return '<li class="card"><span class="small-print">' + label + '</span><b>' + Number(v[0]).toLocaleString('en-US') + '</b><span class="small-print">' + Number(v[1]).toLocaleString('en-US') + ' all time</span></li>'; };
        html += '<section class="stack stack--tight pg-stats"><h2 class="title-sm">📊 Your page, last 30 days <span class="small-print">(only you see this)</span></h2><ul class="ops-nums">' +
          row('👀 Views', stats.views) + row('🎮 Plays from your page', stats.plays) + row(p.type === 'creator' ? '🙋 Joined with your link' : '🎓 Players', stats.players) + '</ul></section>';
      }
      box.insertAdjacentHTML('afterbegin', html);
    }).catch(function () { box.innerHTML = ''; });
  }

  function sponsorCard(box) {
    rpc('active_sponsors', {}).then(function (rows) {
      var s = (rows || []).filter(function (x) { return x.kind === 'site'; })[0];
      if (!s || box.querySelector('.sponsor-card')) return;
      var logo = SB.url.replace(/\/$/, '') + '/storage/v1/object/public/sponsor-logos/' + s.logo_path.split('/').map(encodeURIComponent).join('/');
      box.insertAdjacentHTML('beforeend', '<div class="sponsor-result"><a class="sponsor-card" href="' + esc(s.link) + '" target="_blank" rel="sponsored noopener" data-sp>' +
        '<span class="sponsor-label">Sponsored</span><img class="sponsor-logo" src="' + esc(logo) + '" alt="" width="44" height="44" loading="lazy" />' +
        '<span class="sponsor-text"><b>' + esc(s.sponsor) + '</b><span>' + esc(s.line) + '</span></span><span class="sponsor-go" aria-hidden="true">→</span></a></div>');
      var a = box.querySelector('[data-sp]');
      rpc('sponsor_hit', { p_booking: s.id, p_what: 'view', p_slot: 'result' }).catch(function () {});
      a.addEventListener('click', function () { rpc('sponsor_hit', { p_booking: s.id, p_what: 'click', p_slot: 'result' }).catch(function () {}); });
    }).catch(function () {});
  }

  function loginWithX() {
    try { sessionStorage.setItem(CLAIM_KEY, page.handle); } catch (e) { /* private mode */ }
    client().auth.signInWithOAuth({ provider: AUTH.xProvider || 'x', options: { redirectTo: location.href.split('#')[0] } });
  }

  function claim() {
    var msg = app.querySelector('[data-claim-msg]');
    var A = window.Web3Auth;
    if (!A) { if (msg) msg.textContent = 'Log in is not available right now.'; return; }
    if (!A.user()) return loginWithX();
    if (msg) msg.textContent = 'Checking your X account…';
    rpc('claim_page', { p_handle: page.handle }).then(function (r) {
      r = String(r || '');
      if (r === 'claimed') { location.href = R + 'my-page/?claimed=1'; return; }
      if (r === 'login') return loginWithX();
      claimState = r;
      showClaim();
    }).catch(function (err) { if (msg) msg.textContent = err.message; });
  }

  // The answer stays on screen when the page redraws (for example after login).
  var claimState = '';
  function showClaim() {
    var A = window.Web3Auth;
    var r = claimState;
    var box = app.querySelector('.pg-claim');
    if (!box || !r) return;
    (function () {
      if (r.indexOf('mismatch:') === 0) {
        box.innerHTML = '<b>That X account is not @' + esc(page.handle) + '</b><p class="text">' + esc(P.copy.mismatch.replace(/\{you\}/g, r.slice(9)).replace(/\{handle\}/g, page.handle)) + '</p>' +
          '<div class="btn-row"><button type="button" class="btn btn--ink" data-switch>Log out and use @' + esc(page.handle) + '</button><a class="btn" href="' + R + 'my-page/#request">Request a page</a></div>';
      } else if (r === 'no_x') {
        box.innerHTML = '<b>Log in with X to claim</b><p class="text">' + esc(fill(P.copy.noX)) + '</p><button type="button" class="btn btn--ink" data-switch>Log out and continue with X</button>';
      } else if (r === 'taken') {
        box.innerHTML = '<p class="text">' + esc(P.copy.taken) + '</p>';
      } else { box.innerHTML = '<p class="text">This page cannot be claimed right now.</p>'; }
      var sw = box.querySelector('[data-switch]');
      if (sw) sw.addEventListener('click', function () { claimState = ''; Promise.resolve(A.signOut()).then(loginWithX, loginWithX); });
    })();
  }

  function report() {
    var box = document.createElement('div');
    box.className = 'pay-modal';
    box.innerHTML = '<div class="pay-box card stack stack--tight" role="dialog" aria-modal="true" aria-label="' + esc(P.copy.report) + '"><h2 class="title-md">' + esc(P.copy.report) + '</h2>' +
      '<label class="label" for="pg-reason">What is wrong?</label><select class="field" id="pg-reason">' + P.copy.reportReasons.map(function (r) { return '<option>' + esc(r) + '</option>'; }).join('') + '</select>' +
      '<label class="label" for="pg-details">Details (optional)</label><textarea class="field field--area" id="pg-details" rows="3" maxlength="1000"></textarea>' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-send>Send report</button><button type="button" class="btn" data-close>Cancel</button></div><p class="small-print" data-msg aria-live="polite"></p></div>';
    document.body.appendChild(box);
    var close = function () { box.remove(); };
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.querySelector('[data-close]').addEventListener('click', close);
    box.querySelector('[data-send]').addEventListener('click', function (e) {
      e.target.disabled = true;
      rpc('report_page', { p_handle: page.handle, p_reason: box.querySelector('#pg-reason').value, p_details: box.querySelector('#pg-details').value })
        .then(function () { box.querySelector('.pay-box').innerHTML = '<p class="text">✅ ' + esc(P.copy.reportThanks) + '</p><button type="button" class="btn" data-close>Close</button>'; box.querySelector('[data-close]').addEventListener('click', close); })
        .catch(function (err) { e.target.disabled = false; box.querySelector('[data-msg]').textContent = err.message; });
    });
    box.querySelector('#pg-reason').focus();
  }
})();
