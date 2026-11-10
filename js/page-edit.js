// /my-page/: make, claim and edit your web3.toys/@handle page, or request a
// page for a project. Needs Log in with X (the page is tied to that account).
// Words: data/business/pages.json. Database: supabase/019_pages.sql.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var AUTH = (window.WEB3TOYS_CONFIG || {}).auth || {};
  var R = site.root || '/';
  var P, A, toys = [], courses = [], me = null, pages = [], current = null;
  var MAX_IMG = 2 * 1024 * 1024;

  function img(path) { return SB.url.replace(/\/$/, '') + '/storage/v1/object/public/page-images/' + path; }
  function must(r) { if (r.error) throw r.error; return r.data; }
  function shell(body) { app.innerHTML = '<section class="biz-hero stack stack--tight"><p class="label">Free for everyone</p><h1 class="biz-title">Your web3.toys page</h1>' +
    '<p class="text text--ink">One link for your project or your content: web3.toys/@yourname, with a Verified via X badge and the toys you love.</p></section>' + body; }

  if (!site.businessOn()) { shell('<p class="card text">Pages open in December.</p>'); return; }

  Promise.all([C.loadJson(R + 'data/business/pages.json'), C.loadJson(R + 'data/home.json'), C.loadJson(R + 'data/academy/index.json').catch(function () { return { courses: [] }; })]).then(function (r) {
    P = r[0];
    r[1].shelves.forEach(function (s) { s.cards.forEach(function (c) { if (c.path && c.status !== 'soon') toys.push(c); }); });
    return Promise.all(r[2].courses.map(function (id) { return C.loadJson(R + 'data/academy/' + id + '.json').then(function (c) { courses.push({ id: id, name: c.name }); }, function () {}); }));
  }).then(function () {
    var go = function () { A = window.Web3Auth; A.onChange(function () { refresh(); }); };
    if (window.Web3Auth) go(); else document.addEventListener('web3auth:ready', go, { once: true });
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function loginX() { A.client.auth.signInWithOAuth({ provider: AUTH.xProvider || 'x', options: { redirectTo: location.href.split('#')[0] } }); }

  function refresh() {
    if (!A.user()) {
      shell('<section class="card stack stack--tight"><h2 class="title-md">Log in with X to start</h2><p class="text">Your page lives at your X handle, so we check your X account. Nothing is posted to X.</p>' +
        '<button type="button" class="btn btn--ink" data-x>Continue with X</button></section>' + rules() + requestBox());
      app.querySelector('[data-x]').addEventListener('click', loginX);
      bindRequest();
      return;
    }
    Promise.all([A.client.rpc('my_x').then(must), A.client.rpc('my_pages').then(must)]).then(function (r) {
      me = (r[0] || [])[0] || null;
      pages = r[1] || [];
      if (pages.length) { current = pages.filter(function (p) { return current && p.id === current.id; })[0] || pages[0]; return editor(); }
      if (!me) {
        shell('<section class="card stack stack--tight"><h2 class="title-md">Pages need Log in with X</h2><p class="text">You are logged in another way. Log out, then continue with X, so your page is tied to your X account.</p>' +
          '<button type="button" class="btn btn--ink" data-switch>Log out and continue with X</button></section>' + rules() + requestBox());
        app.querySelector('[data-switch]').addEventListener('click', function () { Promise.resolve(A.signOut()).then(loginX, loginX); });
        bindRequest();
        return;
      }
      // A page for my handle may already exist (made by web3.toys, not claimed yet).
      return A.client.rpc('page_public', { p_handle: me.handle }).then(must).then(function (existing) {
        if (existing && !existing.claimed) {
          shell('<section class="card card--yellow stack stack--tight"><h2 class="title-md">There is a page for @' + esc(me.handle) + '</h2><p class="text">web3.toys made it from public information. Claim it to edit it.</p>' +
            '<a class="btn btn--ink" href="' + R + '@' + esc(me.handle) + '">Open it and claim it</a></section>');
          return;
        }
        createForm();
      });
    }).catch(function (err) { shell(C.loadError(err)); });
  }

  function rules() { return '<section class="card stack stack--tight"><h2 class="title-sm">House rules</h2><ul class="biz-feats">' + P.copy.rules.map(function (r) { return '<li>' + site.icon('check') + '<span>' + esc(r) + '</span></li>'; }).join('') + '</ul></section>'; }

  function requestBox() {
    return '<section class="card stack stack--tight" id="request"><h2 class="title-md">' + esc(P.copy.requestTitle) + '</h2><p class="small-print">' + esc(P.copy.requestLine) + '</p>' +
      '<form class="stack stack--tight" data-request novalidate><label class="label" for="rq-handle">Project X handle</label><input class="field" id="rq-handle" maxlength="16" placeholder="@project" />' +
      '<label class="label" for="rq-name">Project name</label><input class="field" id="rq-name" maxlength="80" />' +
      '<label class="label" for="rq-web">Website</label><input class="field" id="rq-web" type="url" maxlength="300" placeholder="https://" />' +
      '<label class="label" for="rq-email">Your email</label><input class="field" id="rq-email" type="email" maxlength="200" />' +
      '<label class="label" for="rq-note">Your role in the project (optional)</label><textarea class="field field--area" id="rq-note" rows="2" maxlength="1000"></textarea>' +
      '<button type="submit" class="btn">Send request</button><p class="small-print" data-msg aria-live="polite"></p></form></section>';
  }
  function bindRequest() {
    var f = app.querySelector('[data-request]');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('[data-msg]');
      if (!A.user()) { msg.textContent = 'Log in first (any way), then send the request.'; A.open('Log in to send a page request.'); return; }
      var v = function (id) { return f.querySelector(id).value.trim(); };
      if (!v('#rq-handle') || !v('#rq-name')) { msg.textContent = 'Add the X handle and the name.'; return; }
      A.client.rpc('request_page', { p_handle: v('#rq-handle'), p_name: v('#rq-name'), p_website: v('#rq-web'), p_email: v('#rq-email'), p_note: v('#rq-note') }).then(must)
        .then(function () { f.innerHTML = '<p class="tk-warn is-good">✅ Request sent. We vet the project and get back to you at the email you gave.</p>'; }, function (err) { msg.textContent = err.message; });
    });
  }

  function createForm() {
    shell('<form class="card stack create-page" novalidate><h2 class="title-md">Make your page: web3.toys/@' + esc(me.handle) + '</h2>' +
      '<fieldset class="pg-types"><legend class="label">What kind of page?</legend>' + Object.keys(P.types).map(function (k, i) {
        var t = P.types[k];
        return '<label class="card pg-type"><input type="radio" name="pg-type" value="' + k + '"' + (i === 1 ? ' checked' : '') + ' /> <span><b>' + t.icon + ' ' + esc(t.label) + '</b><span class="small-print">' + esc(t.line) + '</span></span></label>';
      }).join('') + '</fieldset>' +
      '<label class="label" for="cp-name">Name on the page</label><input class="field" id="cp-name" maxlength="80" />' +
      '<button type="submit" class="btn btn--ink">Make my page</button><p class="small-print" data-msg aria-live="polite"></p></form>' + rules() + requestBox());
    var f = app.querySelector('.create-page');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('[data-msg]');
      var name = f.querySelector('#cp-name').value.trim();
      if (!name) { msg.textContent = 'Add a name.'; return; }
      A.client.rpc('create_my_page', { p_type: f.querySelector('[name="pg-type"]:checked').value, p_name: name }).then(must).then(refresh, function (err) { msg.textContent = err.message; });
    });
    bindRequest();
  }

  function editor() {
    var p = current;
    var status = { draft: ['is-white', 'Draft', P.copy.draftNote], pending: ['is-yellow', 'Waiting for review', P.copy.reviewNote], published: ['is-mint', 'Live', ''], rejected: ['is-white', 'Sent back', P.copy.rejectedNote], suspended: ['is-white', 'Paused', P.copy.suspendedNote] }[p.status];
    var socials = p.socials || {};
    var claimedNote = /claimed=1/.test(location.search) ? '<p class="tk-warn is-good">🎉 ' + esc(P.copy.claimed) + '</p>' : '';
    shell(claimedNote + (pages.length > 1 ? '<div class="btn-row">' + pages.map(function (x) { return '<button type="button" class="btn btn--small' + (x.id === p.id ? ' btn--ink' : '') + '" data-pick="' + esc(x.id) + '">@' + esc(x.handle) + '</button>'; }).join('') + '</div>' : '') +
      '<section class="card stack stack--tight"><div class="cap-row"><b>web3.toys/@' + esc(p.handle) + '</b><span class="chip ' + status[0] + '">' + status[1] + '</span></div>' +
      (status[2] ? '<p class="small-print">' + esc(status[2]) + '</p>' : '') + (p.admin_note && p.status === 'rejected' ? '<p class="text">Note from web3.toys: ' + esc(p.admin_note) + '</p>' : '') +
      ((p.flags || []).length ? '<p class="small-print">Hidden until we take a quick look, because the page mentions: ' + esc(p.flags.join(', ')) + '. Pages may not promote tokens.</p>' : '') +
      '<div class="btn-row"><a class="btn btn--small" href="' + R + '@' + esc(p.handle) + '">View page</a>' + (p.status === 'draft' || p.status === 'rejected' ? '<button type="button" class="btn btn--small btn--ink" data-submit>Send for review</button>' : '') + '</div><p class="small-print" data-smsg></p></section>' +
      '<form class="card stack pg-edit" novalidate style="--pg-color:' + esc(p.color) + '">' +
      '<label class="label" for="pe-name">Name</label><input class="field" id="pe-name" maxlength="' + P.nameMax + '" value="' + esc(p.name) + '" />' +
      '<label class="label" for="pe-bio">Bio <span class="small-print" data-count></span></label><textarea class="field field--area" id="pe-bio" rows="3" maxlength="' + P.bioMax + '">' + esc(p.bio || '') + '</textarea>' +
      '<div class="pg-pics"><div class="stack stack--tight"><span class="label">Avatar (square)</span>' + (p.avatar_path ? '<img class="pg-avatar" src="' + esc(img(p.avatar_path)) + '" alt="" width="72" height="72" data-prev="avatar" />' : '<span class="pg-avatar pg-avatar--letter" data-prev="avatar">' + esc(p.name.charAt(0).toUpperCase()) + '</span>') +
      '<input type="file" accept="image/png,image/jpeg,image/webp" data-up="avatar" aria-label="Upload avatar" /></div>' +
      '<div class="stack stack--tight"><span class="label">Banner (wide, 3:1)</span><div class="pg-banner pg-banner--small" data-prev="banner"' + (p.banner_path ? ' style="background-image:url(\'' + esc(img(p.banner_path)) + '\')"' : '') + '></div>' +
      '<input type="file" accept="image/png,image/jpeg,image/webp" data-up="banner" aria-label="Upload banner" /></div></div>' +
      '<label class="label" for="pe-web">Website</label><input class="field" id="pe-web" type="url" maxlength="300" placeholder="https://" value="' + esc(p.website || '') + '" />' +
      '<fieldset class="stack stack--tight"><legend class="label">Socials</legend>' + P.socials.map(function (s) {
        return '<input class="field" data-social="' + s.id + '" type="url" maxlength="300" placeholder="' + esc(s.label) + ': ' + esc(s.prefix) + '…" value="' + esc(socials[s.id] || '') + '" aria-label="' + esc(s.label) + '" />';
      }).join('') + '</fieldset>' +
      '<fieldset><legend class="label">Toys to feature (up to ' + P.maxFeatured + ')</legend><div class="pg-picks">' + toys.map(function (t) {
        return '<label class="mk-check"><input type="checkbox" data-toy="' + esc(t.id) + '"' + (p.featured_toys.indexOf(t.id) >= 0 ? ' checked' : '') + ' /> <span>' + esc(t.title) + '</span></label>';
      }).join('') + '</div></fieldset>' +
      (courses.length ? '<fieldset><legend class="label">Academy courses to feature</legend><div class="pg-picks">' + courses.map(function (c) {
        return '<label class="mk-check"><input type="checkbox" data-course="' + esc(c.id) + '"' + (p.featured_courses.indexOf(c.id) >= 0 ? ' checked' : '') + ' /> <span>' + esc(c.name) + '</span></label>';
      }).join('') + '</div></fieldset>' : '') +
      '<fieldset><legend class="label">Brand colour</legend><div class="pg-swatches">' + P.colors.map(function (c) {
        return '<button type="button" class="pg-swatch' + (c.toLowerCase() === p.color.toLowerCase() ? ' is-on' : '') + '" style="background:' + c + '" data-color="' + c + '" aria-label="' + c + '"></button>';
      }).join('') + '<input type="color" value="' + esc(p.color) + '" data-color-input aria-label="Custom colour" /></div></fieldset>' +
      '<button type="submit" class="btn btn--ink btn--block">Save</button><p class="small-print" data-msg aria-live="polite"></p></form>' + rules());
    var f = app.querySelector('.pg-edit');
    var msg = f.querySelector('[data-msg]');
    var pics = { avatar: p.avatar_path || '', banner: p.banner_path || '' };
    var color = p.color;
    var bio = f.querySelector('#pe-bio');
    var count = function () { f.querySelector('[data-count]').textContent = '(' + bio.value.length + ' / ' + P.bioMax + ')'; };
    bio.addEventListener('input', count); count();
    app.querySelectorAll('[data-pick]').forEach(function (b) { b.addEventListener('click', function () { current = pages.filter(function (x) { return x.id === b.getAttribute('data-pick'); })[0]; editor(); }); });
    var sub = app.querySelector('[data-submit]');
    if (sub) sub.addEventListener('click', function () {
      A.client.rpc('submit_my_page', { p_id: p.id }).then(must).then(refresh, function (err) { app.querySelector('[data-smsg]').textContent = err.message; });
    });
    var setColor = function (c) { color = c; f.style.setProperty('--pg-color', c); f.querySelectorAll('[data-color]').forEach(function (s) { s.classList.toggle('is-on', s.getAttribute('data-color').toLowerCase() === c.toLowerCase()); }); };
    f.querySelectorAll('[data-color]').forEach(function (s) { s.addEventListener('click', function () { setColor(s.getAttribute('data-color')); }); });
    f.querySelector('[data-color-input]').addEventListener('input', function (e) { setColor(e.target.value); });
    f.querySelectorAll('[data-toy], [data-course]').forEach(function (c) {
      c.addEventListener('change', function () {
        var kind = c.hasAttribute('data-toy') ? '[data-toy]' : '[data-course]';
        if (f.querySelectorAll(kind + ':checked').length > P.maxFeatured) { c.checked = false; msg.textContent = 'Up to ' + P.maxFeatured + '.'; }
      });
    });
    f.querySelectorAll('[data-up]').forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files[0], kind = input.getAttribute('data-up');
        if (!file) return;
        if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { msg.textContent = 'Use a PNG, JPG or WebP picture.'; return; }
        if (file.size > MAX_IMG) { msg.textContent = 'That picture is over 2 MB. Make it smaller first.'; return; }
        var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.type];
        var path = A.user().id + '/' + kind + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
        msg.textContent = 'Uploading…';
        A.client.storage.from('page-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' }).then(function (r) {
          if (r.error) throw r.error;
          pics[kind] = path;
          var prev = f.querySelector('[data-prev="' + kind + '"]');
          if (kind === 'banner') prev.style.backgroundImage = 'url(\'' + img(path) + '\')';
          else prev.outerHTML = '<img class="pg-avatar" src="' + esc(img(path)) + '" alt="" width="72" height="72" data-prev="avatar" />';
          msg.textContent = 'Picture added. Press Save to keep it.';
        }).catch(function (err) { msg.textContent = 'Could not upload: ' + err.message; });
      });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var socialsOut = {};
      var bad = null;
      f.querySelectorAll('[data-social]').forEach(function (i) { var v = i.value.trim(); if (v) { if (!/^https:\/\/\S{3,}$/.test(v)) bad = i; socialsOut[i.getAttribute('data-social')] = v; } });
      var web = f.querySelector('#pe-web').value.trim();
      if (bad || (web && !/^https:\/\/\S{3,}$/.test(web))) { msg.textContent = 'Links must start with https://'; (bad || f.querySelector('#pe-web')).focus(); return; }
      if (!f.querySelector('#pe-name').value.trim()) { msg.textContent = 'Add a name.'; return; }
      msg.textContent = 'Saving…';
      A.client.rpc('update_my_page', {
        p_id: p.id, p_name: f.querySelector('#pe-name').value.trim(), p_bio: bio.value.trim(), p_avatar: pics.avatar, p_banner: pics.banner, p_website: web, p_socials: socialsOut,
        p_toys: Array.prototype.map.call(f.querySelectorAll('[data-toy]:checked'), function (c) { return c.getAttribute('data-toy'); }),
        p_courses: Array.prototype.map.call(f.querySelectorAll('[data-course]:checked'), function (c) { return c.getAttribute('data-course'); }),
        p_color: color,
      }).then(must).then(function (r) {
        var note = r === 'flagged' ? 'Saved. Your page mentions something we check (no token promotion), so it is hidden until our team takes a quick look.' : 'Saved.';
        return A.client.rpc('my_pages').then(must).then(function (list) { pages = list; current = list.filter(function (x) { return x.id === p.id; })[0] || list[0]; if (r === 'flagged') editor(); var m2 = app.querySelector('.pg-edit [data-msg]'); if (m2) m2.textContent = note; });
      }).catch(function (err) { msg.textContent = err.message; });
    });
  }
})();
