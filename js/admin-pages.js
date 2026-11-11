// Admin, Pages tab: first-publish approvals (and pages hidden by a flagged
// word), page requests, reports, every page (suspend, transfer, remove the
// owner, delete) and making a page for a project from public information.
// Database: supabase/019_pages.sql. Every action is in the audit log.
//   Web3AdminPages.tab(panel, ctx, sub)   sub: approvals | requests | reports | all | new

(function () {
  var SUBS = [['approvals', 'To approve'], ['requests', 'Page requests'], ['reports', 'Reports'], ['all', 'All pages'], ['pro', '⭐ Pro'], ['consents', 'Consent'], ['new', '➕ New project page']];
  var prefill = null;

  function tab(panel, ctx, sub) {
    var esc = ctx.esc, db = ctx.db;
    var R = window.WEB3TOYS.root || '/';
    sub = SUBS.some(function (s) { return s[0] === sub; }) ? sub : 'approvals';
    var nav = '<div class="btn-row ops-subs">' + SUBS.map(function (s) { return '<button type="button" class="btn btn--small' + (s[0] === sub ? ' btn--ink' : '') + '" data-sub="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>';
    var bindNav = function () { panel.querySelectorAll('[data-sub]').forEach(function (b) { b.addEventListener('click', function () { ctx.go('pages:' + b.getAttribute('data-sub')); }); }); };
    var done = function () { ['pagesAll', 'pageRows', 'pageReqs', 'pageReports', 'ops', 'audit'].forEach(function (k) { delete ctx.cache[k]; }); ctx.render(); };
    var act = function (id, action, note, target, msg) {
      return db().rpc('admin_page_action', { p_id: id, p_action: action, p_note: note || null, p_target: target || null }).then(ctx.must).then(done, function (err) { if (msg) msg.textContent = err.message; else window.alert(err.message); });
    };
    var view = function (h) { return R + '@' + encodeURIComponent(h); };

    return Promise.all([
      ctx.load('pageRows', function () { return db().from('pages').select('*').order('created_at', { ascending: false }).limit(5000).then(ctx.must); }),
      ctx.load('pagesAll', function () { return db().rpc('admin_pages').then(ctx.must); }),
      ctx.load('pagesJson', function () { return window.Web3Common.loadJson(R + 'data/business/pages.json'); }),
    ]).then(function (r) {
      var rows = r[0], meta = {}, P = r[2];
      r[1].forEach(function (x) { meta[x.id] = x; });
      var T = function (t) { return (P.types[t] || {}).icon + ' ' + (P.types[t] || {}).label; };

      if (sub === 'approvals') {
        var list = rows.filter(function (p) { return p.status === 'pending'; });
        panel.innerHTML = nav + '<p class="small-print">New pages wait here before they first go live, and live pages come back here (hidden) when an edit mentions a flagged word. Projects: run the vetting checklist first.</p>' +
          (list.length ? list.map(function (p) {
            return '<article class="card stack stack--tight" data-pg="' + esc(p.id) + '"><div class="cap-row"><b>' + esc(p.name) + ' · @' + esc(p.handle) + '</b><span class="chip is-yellow">' + esc(T(p.type)) + '</span></div>' +
              '<p class="small-print">' + (p.published_at ? 'Live before; hidden after an edit' : 'New page') + ' · owner ' + esc((meta[p.id] || {}).owner_name || '(none)') + ' · updated ' + esc(ctx.date(p.updated_at)) + '</p>' +
              (p.flags && p.flags.length ? '<p class="tk-warn is-bad">Flagged words: ' + esc(p.flags.join(', ')) + '</p>' : '') +
              (p.bio ? '<p class="text">' + esc(p.bio) + '</p>' : '') +
              '<p class="small-print">' + [p.website].concat(Object.keys(p.socials || {}).map(function (k) { return p.socials[k]; })).filter(Boolean).map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener nofollow">' + esc(u) + '</a>'; }).join(' · ') + '</p>' +
              '<input class="field" data-note maxlength="300" placeholder="Note to the owner (needed when sending back)" />' +
              '<div class="btn-row"><a class="btn btn--small" href="' + view(p.handle) + '" target="_blank" rel="noopener">Preview</a><button type="button" class="btn btn--small btn--yellow" data-a="approve">Approve and publish</button><button type="button" class="btn btn--small" data-a="reject">Send back</button><button type="button" class="btn btn--small acct-danger" data-a="suspend">Suspend</button></div><p class="small-print" data-msg></p></article>';
          }).join('') : '<p class="text">Nothing to approve.</p>');
        bindNav();
        panel.querySelectorAll('[data-pg]').forEach(function (c) {
          var msg = c.querySelector('[data-msg]');
          c.querySelectorAll('[data-a]').forEach(function (b) {
            b.addEventListener('click', function () {
              var note = c.querySelector('[data-note]').value.trim();
              if (b.getAttribute('data-a') === 'reject' && !note) { msg.textContent = 'Add a note so the owner knows what to change.'; return; }
              act(c.getAttribute('data-pg'), b.getAttribute('data-a'), note, null, msg);
            });
          });
        });
        return;
      }

      if (sub === 'requests') {
        return ctx.load('pageReqs', function () { return db().from('page_requests').select('*').order('created_at').then(ctx.must); }).then(function (reqs) {
          var open = reqs.filter(function (q) { return q.status === 'open'; });
          panel.innerHTML = nav + '<p class="small-print">Requests for a project page. Vet the project; if it passes, make its page (it is published as "Not claimed yet" and the team claims it with the project\'s X account).</p>' +
            (open.length ? open.map(function (q) {
              var exists = rows.some(function (p) { return p.handle.toLowerCase() === q.handle.toLowerCase(); });
              return '<article class="card stack stack--tight" data-rq="' + esc(q.id) + '"><div class="cap-row"><b>' + esc(q.name) + ' · @' + esc(q.handle) + '</b><span class="small-print">' + esc(ctx.date(q.created_at)) + '</span></div>' +
                '<p class="small-print">' + (q.website ? '<a href="' + esc(q.website) + '" target="_blank" rel="noopener nofollow">' + esc(q.website) + '</a> · ' : '') + '<a href="https://x.com/' + esc(q.handle) + '" target="_blank" rel="noopener">x.com/' + esc(q.handle) + '</a>' + (q.email ? ' · ' + esc(q.email) : '') + '</p>' +
                (q.note ? '<p class="text">' + esc(q.note) + '</p>' : '') + (exists ? '<p class="tk-warn">A page for @' + esc(q.handle) + ' already exists.</p>' : '') +
                '<div class="btn-row">' + (exists ? '' : '<button type="button" class="btn btn--small btn--yellow" data-make>Make the page</button>') + '<button type="button" class="btn btn--small" data-st="done">Mark done</button><button type="button" class="btn btn--small acct-danger" data-st="declined">Decline</button></div><p class="small-print" data-msg></p></article>';
            }).join('') : '<p class="text">No page requests waiting.</p>');
          bindNav();
          panel.querySelectorAll('[data-rq]').forEach(function (c) {
            var q = open.filter(function (x) { return x.id === c.getAttribute('data-rq'); })[0];
            var mk = c.querySelector('[data-make]');
            if (mk) mk.addEventListener('click', function () { prefill = { request: q.id, handle: q.handle, name: q.name, website: q.website || '' }; ctx.go('pages:new'); });
            c.querySelectorAll('[data-st]').forEach(function (b) { b.addEventListener('click', function () { db().rpc('admin_page_request', { p_id: q.id, p_status: b.getAttribute('data-st'), p_note: null }).then(ctx.must).then(done, function (err) { c.querySelector('[data-msg]').textContent = err.message; }); }); });
          });
        });
      }

      if (sub === 'reports') {
        return ctx.load('pageReports', function () { return db().from('page_reports').select('*').order('created_at', { ascending: false }).limit(1000).then(ctx.must); }).then(function (reps) {
          var byId = {};
          rows.forEach(function (p) { byId[p.id] = p; });
          var open = reps.filter(function (x) { return x.status === 'open'; });
          panel.innerHTML = nav + (open.length ? open.map(function (x) {
            var p = byId[x.page_id] || {};
            return '<article class="card stack stack--tight" data-rep="' + esc(x.id) + '" data-page="' + esc(x.page_id) + '"><div class="cap-row"><b>' + esc(x.reason) + '</b><span class="small-print">' + esc(ctx.date(x.created_at)) + '</span></div>' +
              '<p class="small-print"><a href="' + view(p.handle || '') + '" target="_blank" rel="noopener">@' + esc(p.handle || '?') + '</a> · ' + esc(p.name || '') + ' · ' + esc(p.status || '') + '</p>' + (x.details ? '<p class="text">' + esc(x.details) + '</p>' : '') +
              '<input class="field" data-note maxlength="300" placeholder="Note (what you did)" />' +
              '<div class="btn-row"><button type="button" class="btn btn--small" data-close>No action needed</button><button type="button" class="btn btn--small acct-danger" data-suspend>Suspend the page</button></div><p class="small-print" data-msg></p></article>';
          }).join('') : '<p class="text">No reports waiting.</p>');
          bindNav();
          panel.querySelectorAll('[data-rep]').forEach(function (c) {
            var msg = c.querySelector('[data-msg]');
            var close = function () { return db().rpc('admin_page_report', { p_id: c.getAttribute('data-rep'), p_note: c.querySelector('[data-note]').value.trim() || null }).then(ctx.must); };
            c.querySelector('[data-close]').addEventListener('click', function () { close().then(done, function (err) { msg.textContent = err.message; }); });
            c.querySelector('[data-suspend]').addEventListener('click', function () {
              db().rpc('admin_page_action', { p_id: c.getAttribute('data-page'), p_action: 'suspend', p_note: c.querySelector('[data-note]').value.trim() || 'Reported', p_target: null }).then(ctx.must).then(close).then(done, function (err) { msg.textContent = err.message; });
            });
          });
        });
      }

      if (sub === 'new' || sub === 'edit') return editor(panel, ctx, nav, bindNav, P, done, null);

      if (sub === 'pro') {
        return Promise.all([db().rpc('admin_pro_status').then(ctx.must), db().from('page_pro_log').select('*').order('created_at', { ascending: false }).limit(500).then(ctx.must)]).then(function (x) {
          var now = Date.now();
          var waiting = x[1].filter(function (l) { return !l.page_id && !l.applied_at && !/refunded/.test(l.reason); });
          var projects = rows.filter(function (p) { return p.type === 'project'; });
          var opts = '<option value="">Pick a page…</option>' + rows.map(function (p) { return '<option value="' + esc(p.id) + '">@' + esc(p.handle) + ' · ' + esc(p.name) + '</option>'; }).join('');
          panel.innerHTML = nav + '<p class="small-print">Pro turns on by itself from purchases (' + Object.keys(P.pro.months).map(function (k) { return esc(k) + ' ' + P.pro.months[k] + ' months'; }).join(', ') + '), added on top. Grant or extend it by hand for partners; minus months shorten it.</p>' +
            (waiting.length ? '<section class="card stack stack--tight"><h3 class="title-sm">Purchases waiting for a page</h3><p class="small-print">No project page had the X handle from the request. They are added automatically when a page with that handle is made, or give them to a page now.</p>' + waiting.map(function (l) {
              return '<div class="cap-row" data-wait="' + l.id + '"><span>' + esc(l.reason) + ' · ' + l.months + ' months · @' + esc(l.handle || '?') + ' · ' + esc(ctx.date(l.created_at)) + '</span><select class="field" data-to>' + opts + '</select><button type="button" class="btn btn--small" data-give>Give</button></div>';
            }).join('') + '</section>' : '') +
            '<section class="card stack stack--tight"><h3 class="title-sm">Grant or extend Pro</h3><div class="ad-row"><select class="field" data-g-page>' + opts + '</select><input class="field" type="number" min="-60" max="60" value="3" data-g-months aria-label="Months" />' +
            '<input class="field" maxlength="120" placeholder="Why (for the log)" data-g-note /></div><button type="button" class="btn btn--small btn--ink" data-grant>Save</button><p class="small-print" data-gmsg></p></section>' +
            '<div class="adm-scroll"><table class="tk-table adm-table"><thead><tr><th>Page</th><th>Owner</th><th>Pro until</th><th>Days left</th><th>Last change</th></tr></thead><tbody>' + x[0].map(function (r2) {
              var left = Math.ceil((Date.parse(r2.pro_until) - now) / 864e5);
              return '<tr><td><a href="' + view(r2.handle) + '" target="_blank" rel="noopener">@' + esc(r2.handle) + '</a></td><td>' + esc(r2.owner_name || '-') + '</td><td>' + esc(ctx.date(r2.pro_until)) + '</td><td>' + (left > 0 ? '<span class="tk-warn' + (left <= 14 ? '' : ' is-good') + '">' + left + '</span>' : 'ended') + '</td><td>' + esc(r2.last_reason || '') + '</td></tr>';
            }).join('') + '</tbody></table></div>' + (x[0].length ? '' : '<p class="text">No Pro pages yet.</p>') +
            '<p class="small-print">' + projects.length + ' project pages. Yearly plan: ' + (P.pro.yearly.on ? 'on ($' + esc(P.pro.yearly.usd) + ')' : 'off (switch it on in data/business/pages.json, pro.yearly.on)') + '.</p>';
          bindNav();
          panel.querySelector('[data-grant]').addEventListener('click', function () {
            var page = panel.querySelector('[data-g-page]').value, msg = panel.querySelector('[data-gmsg]');
            if (!page) { msg.textContent = 'Pick a page.'; return; }
            db().rpc('admin_grant_pro', { p_page: page, p_months: Number(panel.querySelector('[data-g-months]').value), p_note: panel.querySelector('[data-g-note]').value.trim() || 'Granted by admin', p_log: null }).then(ctx.must).then(done, function (err) { msg.textContent = err.message; });
          });
          panel.querySelectorAll('[data-wait]').forEach(function (w) {
            w.querySelector('[data-give]').addEventListener('click', function () {
              var page = w.querySelector('[data-to]').value;
              if (!page) return;
              db().rpc('admin_grant_pro', { p_page: page, p_months: 0, p_note: null, p_log: Number(w.getAttribute('data-wait')) }).then(ctx.must).then(done, function (err) { window.alert(err.message); });
            });
          });
        });
      }

      if (sub === 'consents') {
        return db().rpc('admin_consent_stats').then(ctx.must).then(function (st) {
          var sum = function (k) { return st.reduce(function (a, r2) { return a + Number(r2[k]); }, 0); };
          panel.innerHTML = nav + ctx.tiles([['Players asked', sum('asked')], ['Said yes', sum('yes')], ['Shared email', sum('email')], ['Said no', sum('said_no')], ['Stopped later', sum('withdrawn')]]) +
            '<p class="small-print">Counts only: who said yes is visible to each page\'s owner (Pro export) and in the database, not here.</p>' +
            ctx.grid('consent-stats', ['Page', 'Asked', 'Yes', 'Email', 'No', 'Stopped'], st.map(function (r2) { return ['@' + r2.handle, r2.asked, r2.yes, r2.email, r2.said_no, r2.withdrawn]; }));
          ctx.bindCsv(panel);
          bindNav();
        });
      }

      // All pages
      var search = '';
      var draw = function () {
        var shown = r[1].filter(function (p) { return !search || (p.handle + ' ' + p.name).toLowerCase().indexOf(search) >= 0; });
        var list = panel.querySelector('[data-list]');
        list.innerHTML = shown.length ? shown.map(function (p) {
          return '<li class="card stack stack--tight" data-row="' + esc(p.id) + '"><div class="cap-row"><b>' + esc(p.name) + ' · <a href="' + view(p.handle) + '" target="_blank" rel="noopener">@' + esc(p.handle) + '</a></b><span class="chip ' + (p.status === 'published' ? 'is-mint' : 'is-white') + '">' + esc(p.status) + '</span></div>' +
            '<p class="small-print">' + esc(T(p.type)) + ' · ' + (p.claimed ? 'owner ' + esc(p.owner_name || '(no name)') : 'not claimed') + ' · made ' + esc(ctx.date(p.created_at)) + (Number(p.open_reports) ? ' · <b>' + p.open_reports + ' open reports</b>' : '') + '</p>' +
            '<div class="btn-row"><button type="button" class="btn btn--small" data-edit>Edit</button>' +
            (p.status === 'suspended' ? '<button type="button" class="btn btn--small" data-a="unsuspend">Unsuspend</button>' : '<button type="button" class="btn btn--small" data-a="suspend">Suspend</button>') +
            '<button type="button" class="btn btn--small" data-transfer>Transfer</button>' + (p.claimed ? '<button type="button" class="btn btn--small" data-a="unclaim">Remove owner</button>' : '') +
            '<button type="button" class="btn btn--small acct-danger" data-delete>Delete</button></div></li>';
        }).join('') : '<li class="small-print">No pages match.</li>';
        list.querySelectorAll('[data-row]').forEach(function (li) {
          var id = li.getAttribute('data-row');
          var p = r[1].filter(function (x) { return x.id === id; })[0];
          li.querySelector('[data-edit]').addEventListener('click', function () { prefill = { id: id }; ctx.go('pages:edit'); });
          li.querySelectorAll('[data-a]').forEach(function (b) {
            b.addEventListener('click', function () {
              var a = b.getAttribute('data-a');
              var note = a === 'suspend' ? window.prompt('Why are you suspending @' + p.handle + '? (Shown to the owner.)') : null;
              if (a === 'suspend' && note == null) return;
              if (a === 'unclaim' && !window.confirm('Remove the owner of @' + p.handle + '? The page goes back to "Not claimed yet".')) return;
              act(id, a, note);
            });
          });
          li.querySelector('[data-transfer]').addEventListener('click', function () {
            var to = window.prompt('Transfer @' + p.handle + ' to which X account? (They must have logged in to web3.toys with X once.)', '@');
            if (to && to.replace('@', '').trim()) act(id, 'transfer', 'Transferred by admin', to.trim());
          });
          li.querySelector('[data-delete]').addEventListener('click', function () {
            var typed = window.prompt('Delete @' + p.handle + ' for good? Type the handle to confirm.');
            if (typed && typed.replace('@', '').toLowerCase() === p.handle.toLowerCase()) act(id, 'delete');
          });
        });
      };
      panel.innerHTML = nav + ctx.tiles([['Pages', r[1].length], ['Live', r[1].filter(function (p) { return p.status === 'published'; }).length],
        ['Claimed', r[1].filter(function (p) { return p.claimed; }).length], ['Suspended', r[1].filter(function (p) { return p.status === 'suspended'; }).length]]) +
        '<input class="field" type="search" placeholder="Search by handle or name" data-search /><ul class="tst-list" data-list></ul>';
      bindNav();
      panel.querySelector('[data-search]').addEventListener('input', function (e) { search = e.target.value.trim().toLowerCase().replace(/^@/, ''); draw(); });
      draw();
    });
  }

  // Make a project page from public information, or edit any page.
  function editor(panel, ctx, nav, bindNav, P, done) { // eslint-disable-line no-unused-vars
    var esc = ctx.esc, db = ctx.db;
    var R = window.WEB3TOYS.root || '/';
    var pre = prefill || {};
    var existing = null;
    return Promise.all([
      pre.id ? db().from('pages').select('*').eq('id', pre.id).maybeSingle().then(ctx.must) : Promise.resolve(null),
      ctx.load('homeJson', function () { return window.Web3Common.loadJson(R + 'data/home.json'); }),
    ]).then(function (r) {
      existing = r[0];
      var p = existing || { handle: pre.handle || '', name: pre.name || '', website: pre.website || '', socials: pre.handle ? { x: 'https://x.com/' + pre.handle } : {}, featured_toys: [], featured_courses: [], color: '#FFD93D', type: 'project' };
      var toys = [];
      r[1].shelves.forEach(function (s) { s.cards.forEach(function (c) { if (c.path) toys.push(c); }); });
      panel.innerHTML = nav + '<form class="card stack adm-page-form" novalidate><h3 class="title-sm">' + (existing ? 'Edit @' + esc(p.handle) : 'New project page (from public information)') + '</h3>' +
        (existing ? '' : '<p class="small-print">Only for projects you have vetted. It goes live as "Not claimed yet"; the team claims it by logging in with the project\'s X account. Never make pages about people.</p>' +
          '<label class="label" for="ap-handle">Project X handle</label><input class="field" id="ap-handle" maxlength="16" value="' + esc(p.handle) + '" placeholder="@project" />') +
        '<label class="label" for="ap-name">Name</label><input class="field" id="ap-name" maxlength="80" value="' + esc(p.name) + '" />' +
        '<label class="label" for="ap-bio">Short description (up to 280)</label><textarea class="field field--area" id="ap-bio" rows="3" maxlength="280">' + esc(p.bio || '') + '</textarea>' +
        '<label class="label" for="ap-web">Website</label><input class="field" id="ap-web" type="url" maxlength="300" value="' + esc(p.website || '') + '" placeholder="https://" />' +
        '<label class="label" for="ap-x">X link</label><input class="field" id="ap-x" type="url" maxlength="300" value="' + esc((p.socials || {}).x || '') + '" />' +
        '<label class="label" for="ap-logo">Logo (PNG, JPG or WebP, up to 2 MB)</label><input type="file" id="ap-logo" accept="image/png,image/jpeg,image/webp" />' +
        '<fieldset><legend class="label">Their toys and courses on web3.toys</legend><div class="pg-picks">' + toys.map(function (t) {
          return '<label class="mk-check"><input type="checkbox" data-toy="' + esc(t.id) + '"' + (p.featured_toys.indexOf(t.id) >= 0 ? ' checked' : '') + ' /> <span>' + esc(t.title) + '</span></label>';
        }).join('') + '</div><input class="field" data-courses placeholder="Quest ids, comma separated" value="' + esc((p.featured_courses || []).join(', ')) + '" /></fieldset>' +
        '<label class="label" for="ap-color">Brand colour</label><input type="color" id="ap-color" value="' + esc(p.color) + '" />' +
        '<button type="submit" class="btn btn--ink">' + (existing ? 'Save' : 'Make the page') + '</button><p class="small-print" data-msg></p></form>';
      bindNav();
      var f = panel.querySelector('form');
      var msg = f.querySelector('[data-msg]');
      var logo = existing ? existing.avatar_path || '' : '';
      f.querySelector('#ap-logo').addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 2097152) { msg.textContent = 'Use a PNG, JPG or WebP under 2 MB.'; return; }
        var path = window.Web3Auth.user().id + '/logo-' + Math.random().toString(36).slice(2, 10) + '.' + { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
        msg.textContent = 'Uploading…';
        db().storage.from('page-images').upload(path, file, { contentType: file.type }).then(function (r2) { if (r2.error) throw r2.error; logo = path; msg.textContent = 'Logo added.'; }).catch(function (err) { msg.textContent = err.message; });
      });
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = function (id) { var el = f.querySelector(id); return el ? el.value.trim() : ''; };
        var socials = Object.assign({}, existing ? existing.socials : {}, { x: v('#ap-x') });
        msg.textContent = 'Saving…';
        db().rpc('admin_save_page', {
          p_id: existing ? existing.id : null, p_handle: existing ? existing.handle : v('#ap-handle'), p_type: existing ? existing.type : 'project', p_name: v('#ap-name'), p_bio: v('#ap-bio'),
          p_avatar: logo, p_banner: existing ? existing.banner_path || '' : '', p_website: v('#ap-web'), p_socials: socials,
          p_toys: Array.prototype.map.call(f.querySelectorAll('[data-toy]:checked'), function (c) { return c.getAttribute('data-toy'); }),
          p_courses: v('[data-courses]').split(',').map(function (x) { return x.trim(); }).filter(Boolean),
          p_color: f.querySelector('#ap-color').value, p_request: pre.request || null,
        }).then(ctx.must).then(function () { prefill = null; delete ctx.cache.pageReqs; done(); ctx.go('pages:all'); }, function (err) { msg.textContent = err.message; });
      });
    });
  }

  window.Web3AdminPages = { tab: tab };
})();
