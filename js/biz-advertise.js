// /advertise/: Sponsor a Toy. Audience, slots and prices (ad_slots.json),
// a calendar of free toy-and-month slots, the rules, and booking: pick a
// slot, upload a logo (PNG or SVG), write one line (80 characters) and a
// link, then pay with Razorpay. Bookings wait for approval in admin; a
// rejected booking is refunded in full. Words: advertise_page.json.
// Hidden until business.live in config.js (preview: ?preview-business=1).

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var P, ADS, toys = [], taken = {}, months = [], state = {}, logoFile = null;
  var STATUS = {
    pending_payment: 'Not paid yet (slot held for 30 minutes)',
    pending: 'Paid, waiting for review',
    approved: 'Approved',
    rejected: 'Rejected (refund on its way)',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
  };

  if (!site.businessOn()) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">For projects</p><h1 class="title-lg">Sponsor a Toy</h1>' +
      '<p class="text text--ink">Coming in December: a small, clearly labelled sponsor card on toys people play.</p>' +
      '<a class="btn btn--ink" href="../book-a-call/">Book a call to hear more</a></section>';
    return;
  }

  function money(n) { return '$' + Number(n).toLocaleString('en-US'); }
  function key(kind, toy, month) { return kind + '|' + (toy || '') + '|' + month; }
  function monthLabel(m) { return new Date(m + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }); }

  function rpc(fn) {
    return fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }

  function priceFor(s) {
    if (s.kind === 'site') return ADS.siteWide;
    if (s.kind === 'newsletter') return ADS.newsletter;
    var base = ADS.toyMonth[s.toy] || ADS.newToy;
    return base + (s.round && ADS.roundToys.indexOf(s.toy) >= 0 ? ADS.sponsoredRound : 0);
  }

  function productFor(s) {
    if (s.kind === 'site') return 'ad-site';
    if (s.kind === 'newsletter') return 'ad-newsletter';
    return 'ad-toy-' + s.toy + (s.round && ADS.roundToys.indexOf(s.toy) >= 0 ? '-round' : '');
  }

  Promise.all([
    C.loadJson('../data/business/advertise_page.json'),
    C.loadJson('../data/business/ad_slots.json'),
    C.loadJson('../data/home.json'),
    SB.url ? rpc('sponsor_calendar') : Promise.resolve([]),
  ]).then(function (r) {
    P = r[0];
    ADS = r[1];
    var titles = {};
    r[2].shelves.forEach(function (s) { s.cards.forEach(function (c) { titles[c.id] = c.title; }); });
    toys = Object.keys(ADS.toyMonth).map(function (id) { return { id: id, title: titles[id] || id }; });
    r[3].forEach(function (t) { taken[key(t.kind, t.toy_id, t.month)] = true; });
    var d = new Date();
    for (var i = 0; i < (ADS.monthsAhead || 6); i++) {
      var m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1));
      months.push(m.toISOString().slice(0, 10));
    }
    var q = new URLSearchParams(location.search);
    state = { kind: 'toy', toy: ADS.toyMonth[q.get('toy')] ? q.get('toy') : toys[0].id, month: months[1] || months[0], round: false };
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function render() {
    var minToy = Math.min.apply(null, Object.keys(ADS.toyMonth).map(function (k) { return ADS.toyMonth[k]; }));
    var slotPrice = { toy: money(minToy) + ' to ' + money(Math.max.apply(null, Object.keys(ADS.toyMonth).map(function (k) { return ADS.toyMonth[k]; }))), round: money(ADS.sponsoredRound), site: money(ADS.siteWide), newsletter: money(ADS.newsletter) };
    app.innerHTML =
      '<section class="biz-hero stack"><p class="label">' + esc(P.label) + '</p><h1 class="biz-title">' + esc(P.title) + '</h1><p class="text text--ink">' + esc(P.intro) + '</p>' +
      '<div class="btn-row"><a class="btn btn--ink" href="#book">Book a slot</a><a class="btn" href="#calendar">See free slots</a></div></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.audienceTitle) + '</h2><ul class="ad-audience">' + P.audience.map(function (a) {
        return '<li class="card"><span aria-hidden="true">' + a.icon + '</span><b>' + esc(a.big) + '</b><span class="small-print">' + esc(a.label) + '</span></li>';
      }).join('') + '</ul></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.slotsTitle) + '</h2><ul class="biz-tiers ad-slots">' + P.slots.map(function (s) {
        return '<li class="card biz-tier"><h3 class="title-sm">' + s.icon + ' ' + esc(s.name) + '</h3><p class="biz-price ad-price">' + slotPrice[s.id] + '</p><p class="small-print">' + esc(s.priceNote) + '</p><p class="text">' + esc(s.text) + '</p></li>';
      }).join('') + '</ul>' +
      '<details class="card ad-prices"><summary><b>Price for each toy</b></summary><ul>' + toys.map(function (t) { return '<li><span>' + esc(t.title) + '</span><b>' + money(ADS.toyMonth[t.id]) + '</b></li>'; }).join('') + '</ul></details></section>' +

      '<section class="stack stack--tight" id="calendar"><h2 class="section-title">' + esc(P.calendarTitle) + '</h2><p class="small-print">' + esc(P.calendarLine) + '</p>' + calendar() + '</section>' +

      '<section class="card stack stack--tight ad-rules"><h2 class="title-md">' + esc(P.rulesTitle) + '</h2><ul class="lesson-points">' + ADS.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' +
      '<p class="small-print"><b>' + esc(P.categoriesLine) + '</b> ' + ADS.allowedCategories.map(esc).join(', ') + '.</p></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.howTitle) + '</h2><ol class="biz-steps">' + P.how.map(function (h, i) {
        return '<li class="card"><span class="biz-step-n">' + (i + 1) + '</span><span class="small-print">' + esc(h) + '</span></li>';
      }).join('') + '</ol></section>' +

      '<section class="stack stack--tight" id="book"><h2 class="section-title">' + esc(P.formTitle) + '</h2>' + form() + '<div data-mine></div></section>' +
      '<p class="tool-disclaimer">Every sponsored item is labelled "Sponsored". web3.toys does not endorse sponsors or any token.</p>';
    bind();
    mine();
  }

  function calendar() {
    var rows = toys.map(function (t) { return { kind: 'toy', toy: t.id, name: t.title }; }).concat([{ kind: 'site', toy: null, name: 'Site-wide' }, { kind: 'newsletter', toy: null, name: 'Newsletter' }]);
    return '<div class="ad-cal-wrap"><table class="ad-cal"><thead><tr><th scope="col">Slot</th>' + months.map(function (m) { return '<th scope="col">' + esc(monthLabel(m)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><th scope="row">' + esc(r.name) + '</th>' + months.map(function (m) {
          var busy = taken[key(r.kind, r.toy, m)];
          return '<td>' + (busy ? '<span class="ad-cell is-taken">Taken</span>' : '<button type="button" class="ad-cell" data-pick-kind="' + r.kind + '" data-pick-toy="' + esc(r.toy || '') + '" data-pick-month="' + m + '">Free</button>') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function form() {
    var s = state;
    var free = function (m) { return !taken[key(s.kind, s.kind === 'toy' ? s.toy : null, m)]; };
    var canRound = s.kind === 'toy' && ADS.roundToys.indexOf(s.toy) >= 0;
    return '<form class="card stack biz-form ad-form" novalidate>' +
      '<div class="ad-row"><div class="stack stack--tight"><label class="label" for="ad-kind">Slot</label><select class="field" id="ad-kind" data-s="kind">' +
      [['toy', 'One toy, one month'], ['site', 'Site-wide, one month'], ['newsletter', 'Newsletter issue']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === s.kind ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      (s.kind === 'toy' ? '<div class="stack stack--tight"><label class="label" for="ad-toy">Toy</label><select class="field" id="ad-toy" data-s="toy">' + toys.map(function (t) {
        return '<option value="' + esc(t.id) + '"' + (t.id === s.toy ? ' selected' : '') + '>' + esc(t.title) + ' · ' + money(ADS.toyMonth[t.id]) + '</option>';
      }).join('') + '</select></div>' : '') +
      '<div class="stack stack--tight"><label class="label" for="ad-month">' + (s.kind === 'newsletter' ? 'Issue (first of the month)' : 'Month') + '</label><select class="field" id="ad-month" data-s="month">' + months.map(function (m) {
        return '<option value="' + m + '"' + (m === s.month ? ' selected' : '') + (free(m) ? '' : ' disabled') + '>' + esc(monthLabel(m)) + (free(m) ? '' : ' (taken)') + '</option>';
      }).join('') + '</select></div></div>' +
      (canRound ? '<label class="mk-check"><input type="checkbox" data-s="round"' + (s.round ? ' checked' : '') + ' /> <span>Add a sponsored round (+' + money(ADS.sponsoredRound) + '). We write it with you; it must be educational.</span></label>' : '') +
      '<div class="ad-row"><div class="stack stack--tight"><label class="label" for="ad-name">Project name</label><input class="field" id="ad-name" data-f="sponsor" maxlength="60" required value="' + esc(s.sponsor || '') + '" /></div>' +
      '<div class="stack stack--tight"><label class="label" for="ad-cat">Category</label><select class="field" id="ad-cat" data-f="category">' + ADS.allowedCategories.map(function (c) { return '<option' + (c === s.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="stack stack--tight"><label class="label" for="ad-line">Your line <span class="small-print" data-count>' + (s.line || '').length + '/' + ADS.lineMax + '</span></label><input class="field" id="ad-line" data-f="line" maxlength="' + ADS.lineMax + '" required value="' + esc(s.line || '') + '" placeholder="For example: Back up your wallet in two minutes" /></div>' +
      '<div class="ad-row"><div class="stack stack--tight"><label class="label" for="ad-link">Link</label><input class="field" id="ad-link" data-f="link" type="url" inputmode="url" maxlength="300" required placeholder="https://" value="' + esc(s.link || '') + '" /></div>' +
      '<div class="stack stack--tight"><label class="label" for="ad-email">Contact email</label><input class="field" id="ad-email" data-f="email" type="email" maxlength="200" required value="' + esc(s.email || '') + '" /></div></div>' +
      '<div class="stack stack--tight"><label class="label" for="ad-logo">Logo (PNG or SVG, up to ' + ADS.logoMaxKb + ' KB, square works best)</label><input class="field" id="ad-logo" type="file" accept="image/png,image/svg+xml" data-logo /></div>' +
      '<div class="ad-preview" data-preview>' + preview() + '</div>' +
      '<label class="mk-check"><input type="checkbox" data-agree' + (s.agree ? ' checked' : '') + ' /> <span>' + esc(P.agree) + '</span></label>' +
      '<button type="submit" class="btn btn--ink btn--block">Book and pay ' + money(priceFor(s)) + '</button>' +
      '<p class="small-print" data-msg aria-live="polite"></p></form>';
  }

  function preview() {
    var src = logoFile ? URL.createObjectURL(logoFile) : '';
    return '<p class="small-print">Preview</p><div class="sponsor-card"><span class="sponsor-label">Sponsored</span>' +
      (src ? '<img class="sponsor-logo" src="' + src + '" alt="" />' : '<span class="sponsor-logo sponsor-logo--house" aria-hidden="true">🖼️</span>') +
      '<span class="sponsor-text"><b>' + esc(state.sponsor || 'Your project') + '</b><span>' + esc(state.line || 'Your line, up to 80 characters') + '</span></span><span class="sponsor-go" aria-hidden="true">→</span></div>';
  }

  function keep() {
    app.querySelectorAll('[data-f]').forEach(function (el) { state[el.getAttribute('data-f')] = el.value; });
    var a = app.querySelector('[data-agree]');
    if (a) state.agree = a.checked;
  }

  function bindForm(f) {
    f.querySelectorAll('[data-s]').forEach(function (el) {
      el.addEventListener('change', function () {
        keep();
        var k = el.getAttribute('data-s');
        state[k] = el.type === 'checkbox' ? el.checked : el.value;
        if (k === 'kind' || k === 'toy') state.round = false;
        redrawForm();
      });
    });
    f.addEventListener('input', function (e) {
      keep();
      if (e.target.id === 'ad-line') f.querySelector('[data-count]').textContent = e.target.value.length + '/' + ADS.lineMax;
      f.querySelector('[data-preview]').innerHTML = preview();
    });
    f.querySelector('[data-logo]').addEventListener('change', function (e) {
      var file = e.target.files[0];
      var msg = f.querySelector('[data-msg]');
      msg.textContent = '';
      logoFile = null;
      if (file && !/^image\/(png|svg\+xml)$/.test(file.type)) msg.textContent = 'Please use a PNG or SVG logo.';
      else if (file && file.size > ADS.logoMaxKb * 1024) msg.textContent = 'The logo is too big. Keep it under ' + ADS.logoMaxKb + ' KB.';
      else logoFile = file || null;
      if (!logoFile) e.target.value = '';
      f.querySelector('[data-preview]').innerHTML = preview();
    });
    f.addEventListener('submit', submit);
  }

  function bind() {
    bindForm(app.querySelector('.ad-form'));
    app.querySelectorAll('[data-pick-month]').forEach(function (b) {
      b.addEventListener('click', function () {
        keep();
        state.kind = b.getAttribute('data-pick-kind');
        if (b.getAttribute('data-pick-toy')) state.toy = b.getAttribute('data-pick-toy');
        state.month = b.getAttribute('data-pick-month');
        state.round = false;
        redrawForm();
        document.getElementById('book').scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  // A new logo file input loses its file, so the chosen logo is kept in
  // logoFile and shown in the preview.
  function redrawForm() {
    app.querySelector('.ad-form').outerHTML = form();
    bindForm(app.querySelector('.ad-form'));
  }

  function submit(e) {
    e.preventDefault();
    keep();
    var f = app.querySelector('.ad-form');
    var msg = f.querySelector('[data-msg]');
    var bad = Array.prototype.filter.call(f.querySelectorAll('[data-f]'), function (el) { return !el.checkValidity() || (el.required && !el.value.trim()); })[0];
    if (bad) { msg.textContent = 'Please fill in: ' + f.querySelector('label[for="' + bad.id + '"]').textContent.replace(/\d+\/\d+/, '').trim() + '.'; bad.focus(); return; }
    if (!/^https:\/\//.test(state.link)) { msg.textContent = 'The link must start with https://'; return; }
    if (!logoFile) { msg.textContent = 'Please add your logo (PNG or SVG).'; return; }
    if (!state.agree) { msg.textContent = 'Please tick the box to agree to the rules.'; return; }
    var A = window.Web3Auth;
    if (!A || !window.Web3Pay) { msg.textContent = 'Booking opens soon.'; return; }
    if (!A.user()) { msg.textContent = P.loginNote; A.open(P.loginNote); return; }
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    msg.textContent = 'Uploading your logo…';
    var ext = logoFile.type === 'image/svg+xml' ? 'svg' : 'png';
    var path = A.user().id + '/logo-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36) + '.' + ext;
    var check = ext === 'svg' ? logoFile.text().then(function (t) { if (/<script|on\w+\s*=|javascript:/i.test(t)) throw new Error('This SVG contains code. Please export a plain SVG or use a PNG.'); }) : Promise.resolve();
    check.then(function () {
      return A.client.storage.from('sponsor-logos').upload(path, logoFile, { contentType: logoFile.type, upsert: false });
    }).then(function (r) {
      if (r && r.error) throw r.error;
      msg.textContent = 'Booking your slot…';
      return A.client.rpc('create_sponsor_booking', {
        p_kind: state.kind, p_toy: state.kind === 'toy' ? state.toy : null, p_month: state.month, p_round: Boolean(state.round),
        p_sponsor: state.sponsor.trim(), p_category: state.category || ADS.allowedCategories[0], p_line: state.line.trim(), p_link: state.link.trim(), p_logo: path, p_email: state.email.trim(),
      });
    }).then(function (r) {
      if (r.error) throw r.error;
      taken[key(state.kind, state.kind === 'toy' ? state.toy : null, state.month)] = true;
      msg.textContent = 'Slot held for 30 minutes. Opening payment…';
      btn.disabled = false;
      mine();
      return window.Web3Pay.buy(productFor(state), r.data, function () { setTimeout(mine, 1500); setTimeout(mine, 5000); });
    }).catch(function (err) {
      btn.disabled = false;
      if (err.message !== 'login') msg.textContent = 'Could not book: ' + err.message;
    });
  }

  function mine() {
    var el = app.querySelector('[data-mine]');
    var A = window.Web3Auth;
    if (!el || !A || !A.user()) return;
    A.client.from('sponsor_bookings').select('*').order('created_at', { ascending: false }).then(function (r) {
      if (r.error || !r.data || !r.data.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<h3 class="title-sm biz-mine-title">Your bookings</h3>' + r.data.map(function (b) {
        var name = b.kind === 'toy' ? ((toys.filter(function (t) { return t.id === b.toy_id; })[0] || {}).title || b.toy_id) : b.kind === 'site' ? 'Site-wide' : 'Newsletter';
        var stats = location.origin + location.pathname.replace(/advertise\/.*$/, 'advertise/stats/') + '?b=' + b.id + '&k=' + b.stats_token;
        var s = { kind: b.kind, toy: b.toy_id, round: b.with_round };
        return '<article class="card stack stack--tight biz-req"><div class="cap-row"><b>' + esc(b.sponsor) + ' · ' + esc(name) + '</b><span class="chip ' + (b.status === 'approved' ? 'is-mint' : 'is-white') + '">' + esc(STATUS[b.status] || b.status) + '</span></div>' +
          '<p class="small-print">' + esc(monthLabel(b.month)) + (b.with_round ? ' · with a sponsored round' : '') + ' · "' + esc(b.line) + '"</p>' +
          (b.status === 'pending_payment' && Date.now() - Date.parse(b.created_at) < 30 * 60000 ? '<button type="button" class="btn btn--small btn--ink" data-pay-booking="' + b.id + '" data-product="' + esc(productFor(s)) + '">Pay ' + money(priceFor(s)) + '</button>' : '') +
          (b.status === 'approved' || b.status === 'pending' ? '<p class="small-print">Private stats link (keep it to yourself): <a href="' + esc(stats) + '">open your stats</a></p>' : '') +
          '</article>';
      }).join('');
      el.querySelectorAll('[data-pay-booking]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          window.Web3Pay.buy(btn.getAttribute('data-product'), btn.getAttribute('data-pay-booking'), function () { setTimeout(mine, 1500); }).catch(function () {});
        });
      });
    });
  }

  var hook = function () { if (window.Web3Auth) window.Web3Auth.onChange(function () { if (P) mine(); }); };
  if (window.Web3Auth) hook(); else document.addEventListener('web3auth:ready', hook, { once: true });
})();
