// /test-your-product/: Test Your Product, for web3 projects.
// Words: data/business/test_page.json. Prices, deposits, the guarantee and
// the founding offer: data/business/test_tiers.json.
// The request form has two steps: step 1 (name, email, tier) is saved as a
// lead straight away (save_biz_lead, supabase/022_test_funnel.sql); step 2
// sends the request (submit_biz_request) and shows the thank-you view.
// Funnel counts (no names): biz_tier, biz_start, biz_step1, biz_submit.
// Until business.live is on in config.js, visitors see a short note.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var CFG = window.WEB3TOYS_CONFIG || {};
  var SB = CFG.supabase || {};
  var KEY = 'web3toys.bizDraft.test.v2';
  var P, T, draft, started = false;

  function money(n) { var f = Number(n) % 1 ? 2 : 0; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }); }
  function tier(id) { return T.tiers.filter(function (t) { return t.id === id; })[0] || T.tiers.filter(function (t) { return t.popular; })[0] || T.tiers[0]; }
  function deposit(t) { return Number(t.depositUsd) > 0 ? Number(t.depositUsd) : Math.round(t.price * (Number(T.deposit) || 0.5) * 100) / 100; }
  function foundingOn() { var f = T.foundingOffer; return !!(f && f.on === true && Number(f.left) > 0); }
  function foundingDeposit(t) { return Math.round(deposit(t) * (1 - Number(T.foundingOffer.discount)) * 100) / 100; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch (e) { /* private mode */ } }
  function log(name) { if (site.log) site.log(name, 'test'); }
  function calUrl() { return (CFG.call || {}).calUrl || (site.root + 'book-a-call/'); }

  if (!site.businessOn()) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">For projects</p><h1 class="title-lg">Test Your Product</h1>' +
      '<p class="text text--ink">Coming soon: real web3 players test your product before launch.</p>' +
      '<a class="btn btn--ink" href="../book-a-call/">Book a call to hear more</a></section>';
    return;
  }

  // Calls the database as the logged-in player when there is one, else as a visitor.
  function rpc(fn, args) {
    var A = window.Web3Auth;
    if (A && A.client) return A.client.rpc(fn, args).then(function (r) { if (r.error) throw r.error; return r.data; });
    return fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { if (!r.ok) throw new Error((j && j.message) || 'Could not send. Try again.'); return j; }); });
  }

  Promise.all([C.loadJson('../data/business/test_page.json'), C.loadJson('../data/business/test_tiers.json')]).then(function (r) {
    P = r[0]; T = r[1];
    try { draft = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { draft = {}; }
    var q = new URLSearchParams(location.search);
    if (q.get('tier')) draft.tier = q.get('tier');
    if (!draft.tier) draft.tier = tier().id;
    render();
    if (q.get('resume') && draft.step === 2) { setStep(2); document.getElementById('request').scrollIntoView(); }
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  // ---------- Page ----------
  function render() {
    var f = T.foundingOffer || {};
    app.innerHTML =
      (foundingOn() ? '<aside class="tp-founding" role="note"><span>🎉 <b>Founding offer:</b> ' + esc(f.line) + ' <b>' + f.left + ' of ' + f.total + ' slots left.</b></span><button type="button" class="btn btn--small btn--ink" data-apply-founding>Apply</button></aside>' : '') +
      '<section class="tp-hero stack stack--tight"><p class="label">' + esc(P.label) + '</p><h1 class="biz-title">' + esc(P.title) + '</h1>' +
      '<p class="tp-sub">' + esc(P.subtitle) + '</p><p class="text">' + esc(P.intro) + '</p>' +
      '<div class="btn-row"><a class="btn btn--ink" href="#request" data-cta>Request a test</a><a class="btn" href="#pricing">See prices</a></div></section>' +
      preview() + video() + pricing() + steps() + compare() + safe() + cases() + who() + faq() +
      '<section class="stack stack--tight" id="request"><h2 class="section-title">' + esc(P.formTitle) + '</h2><div data-form></div><div data-mine></div></section>' +
      '<section class="tp-tester stack stack--tight"><h2 class="title-sm">🧪 ' + esc(P.testerTitle) + '</h2><p class="small-print">' + esc(P.testerLine) + '</p><a class="text-button" href="../testers/">Become a tester →</a></section>' +
      '<a class="btn btn--ink tp-sticky" href="#request" data-sticky hidden>' + esc(P.stickyCta) + '</a>';
    bindPage();
    form();
    mine();
  }

  function preview() {
    var R = Web3TestReport.build(P.sample.test, P.sample.runs);
    var secs = function (n) { return n >= 60 ? Math.floor(n / 60) + 'm ' + Math.round(n % 60) + 's' : Math.round(n) + 's'; };
    var quotes = [];
    R.tasks.forEach(function (t) { t.comments.forEach(function (c) { if (c.outcome !== 'done') quotes.push({ text: c.text, task: t.title, outcome: c.outcome }); }); });
    return '<section class="card tp-preview stack stack--tight" aria-label="' + esc(P.previewTitle) + '"><div class="cap-row"><h2 class="title-md">' + esc(P.previewTitle) + '</h2><span class="tp-sample">' + esc(P.sampleLabel) + '</span></div>' +
      '<p class="small-print">' + esc(P.previewLine) + '</p>' +
      '<ul class="tp-bars">' + R.tasks.map(function (t) {
        return '<li><span class="tp-task">' + esc(t.title) + '</span><span class="tp-bar" role="img" aria-label="' + t.rate + ' percent finished"><i style="width:' + t.rate + '%"></i></span><b>' + t.rate + '%</b><span class="small-print">' + (t.time ? secs(t.time) + ' avg' : '-') + '</span></li>';
      }).join('') + '</ul>' +
      '<ul class="tp-quotes">' + quotes.slice(0, 3).map(function (q) { return '<li>“' + esc(q.text) + '”<span class="small-print">' + esc(q.task) + ' · ' + (q.outcome === 'stuck' ? 'got stuck' : 'gave up') + '</span></li>'; }).join('') + '</ul>' +
      '<button type="button" class="text-button" data-full-sample>' + esc(P.sampleLink) + ' →</button></section>';
  }

  function video() {
    var v = P.video || {};
    return '<section class="tp-video stack stack--tight"><h2 class="title-sm">▶ ' + esc(v.title) + '</h2>' + (v.src
      ? '<video controls preload="metadata" playsinline' + (v.poster ? ' poster="' + esc(site.root + v.poster) + '"' : '') + ' src="' + esc(site.root + v.src) + '"></video>'
      : '<div class="tp-video-ph"><span aria-hidden="true">🎬</span><p class="small-print">' + esc(v.placeholder) + '</p></div>') + '</section>';
  }

  function pricing() {
    var found = foundingOn();
    return '<section class="stack stack--tight" id="pricing"><h2 class="section-title">' + esc(P.pricingTitle) + '</h2><ul class="biz-tiers tp-tiers">' + T.tiers.map(function (t) {
      return '<li class="card biz-tier' + (t.popular ? ' is-popular' : '') + '">' + (t.popular ? '<span class="chip is-yellow biz-popular">' + esc(T.popularLabel || 'Recommended') + '</span>' : '') +
        '<h3 class="title-md">' + esc(t.name) + '</h3><p class="biz-price">' + money(t.price) + '</p><p class="small-print">' + esc(t.time) + '</p>' +
        '<ul class="biz-feats">' + t.features.map(function (x) { return '<li>' + site.icon('check') + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn btn--block' + (t.popular ? ' btn--ink' : '') + '" data-tier="' + esc(t.id) + '">Choose ' + esc(t.name) + '</button>' +
        '<p class="small-print">' + money(deposit(t)) + ' deposit reserves your slot.' + (found ? ' Founding offer: ' + money(foundingDeposit(t)) + '.' : '') + '</p></li>';
    }).join('') + '</ul><p class="tp-guarantee">✅ ' + esc(T.guarantee) + '</p></section>';
  }

  function steps() {
    return '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.stepsTitle) + '</h2><ol class="biz-steps">' + P.steps.map(function (s, i) {
      return '<li class="card"><span class="biz-step-n">' + (i + 1) + '</span><b>' + esc(s.title) + '</b><span class="small-print">' + esc(s.text) + '</span></li>';
    }).join('') + '</ol></section>';
  }

  function compare() {
    var c = P.compare;
    return '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.compareTitle) + '</h2><div class="tp-compare-wrap"><table class="tp-compare"><thead><tr><th></th>' +
      c.columns.map(function (h, i) { return '<th' + (i === 0 ? ' class="is-us"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      c.rows.map(function (r) { return '<tr><th scope="row">' + esc(r.label) + '</th>' + r.cells.map(function (x, i) { return '<td' + (i === 0 ? ' class="is-us"' : '') + '>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div></section>';
  }

  function safe() {
    var li = function (x, icon) { return '<li><span aria-hidden="true">' + icon + '</span><span>' + esc(x) + '</span></li>'; };
    return '<section class="card tp-safe stack stack--tight"><h2 class="title-md">🔒 ' + esc(P.safeTitle) + '</h2><ul class="tp-list">' +
      P.confidential.map(function (x) { return li(x, '🤐'); }).join('') + P.rules.map(function (x) { return li(x, '🛡️'); }).join('') + '</ul></section>';
  }

  function cases() {
    if (!(P.caseStudies || []).length) return '';
    return '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.caseTitle) + '</h2><ul class="tp-cases">' + P.caseStudies.map(function (c) {
      return '<li class="card stack stack--tight"><b>' + esc(c.project) + '</b>' + (c.result ? '<p class="text">' + esc(c.result) + '</p>' : '') + (c.quote ? '<blockquote>“' + esc(c.quote) + '”' + (c.who ? '<span class="small-print">' + esc(c.who) + '</span>' : '') + '</blockquote>' : '') +
        (c.link ? '<a class="text-button" href="' + esc(c.link) + '" target="_blank" rel="noopener">Read the case study →</a>' : '') + '</li>';
    }).join('') + '</ul></section>';
  }

  function who() {
    var s = CFG.social || {};
    var links = [];
    if (s.x) links.push('<a class="btn btn--small btn--ink" href="' + esc(s.x) + '" target="_blank" rel="noopener">' + esc(P.who.talk) + ' on X</a>');
    if (s.telegram) links.push('<a class="btn btn--small" href="' + esc(s.telegram) + '" target="_blank" rel="noopener">Telegram</a>');
    if (!links.length) links.push('<a class="btn btn--small btn--ink" href="' + esc(calUrl()) + '" target="_blank" rel="noopener">' + esc(P.who.talk) + '</a>');
    return '<section class="tp-who"><div class="tp-who-face">' + site.mascotImg('grin', 'tp-face', 72, '') + '</div><div class="stack stack--tight"><p class="label">' + esc(P.who.title) + '</p><b>' + esc(P.who.name) + '</b>' +
      '<p class="small-print">' + esc(P.who.line) + '</p><div class="btn-row">' + links.join('') + '</div></div></section>';
  }

  function faq() {
    return '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.faqTitle) + '</h2><div class="biz-faq">' + P.faq.map(function (f) {
      return '<details class="card"><summary><b>' + esc(f.q) + '</b></summary><p class="text">' + esc(f.a) + '</p></details>';
    }).join('') + '</div></section>';
  }

  // ---------- The two-step form ----------
  function form() {
    var box = app.querySelector('[data-form]');
    var F = P.form;
    var input = function (id, label, type, val, extra) {
      return '<div class="stack stack--tight"><label class="label" for="tp-' + id + '">' + esc(label) + '</label><input class="field" id="tp-' + id + '" data-k="' + id + '" type="' + type + '" value="' + esc(val || '') + '"' + (extra || '') + ' /></div>';
    };
    box.innerHTML = '<form class="card stack tp-form" novalidate>' +
      '<div class="tp-progress" aria-hidden="true"><span data-bar></span></div><p class="small-print" data-steplabel></p>' +
      '<div class="stack" data-step="1">' + input('name', F.name, 'text', draft.name, ' maxlength="100" autocomplete="name"') + input('email', F.email, 'email', draft.email, ' maxlength="200" autocomplete="email"') +
      '<div class="stack stack--tight"><label class="label" for="tp-tier">' + esc(F.tier) + '</label><select class="field" id="tp-tier" data-k="tier">' + T.tiers.map(function (t) {
        return '<option value="' + esc(t.id) + '"' + (t.id === draft.tier ? ' selected' : '') + '>' + esc(t.name) + ' · ' + money(t.price) + '</option>';
      }).join('') + '</select></div>' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-next>' + esc(F.next) + ' →</button></div></div>' +
      '<div class="stack" data-step="2" hidden>' + input('project', F.project, 'text', draft.project, ' maxlength="120"') + input('link', F.link, 'url', draft.link, ' maxlength="300" inputmode="url" placeholder="https://"') +
      input('launch', F.launch, 'date', draft.launch) +
      '<div class="stack stack--tight"><label class="label" for="tp-note">' + esc(F.note) + '</label><textarea class="field field--area" id="tp-note" data-k="note" rows="3" maxlength="1000">' + esc(draft.note || '') + '</textarea></div>' +
      (foundingOn() ? '<label class="mk-check"><input type="checkbox" data-founding' + (draft.founding ? ' checked' : '') + ' /> <span>' + esc(F.founding) + '</span></label>' : '') +
      '<div class="tp-submit"><div class="btn-row"><button type="button" class="btn" data-back>← ' + esc(F.back) + '</button><button type="submit" class="btn btn--ink">' + esc(F.submit) + '</button></div>' +
      '<p class="small-print">' + esc(F.reply) + '</p><a class="text-button" href="' + esc(calUrl()) + '" target="_blank" rel="noopener">' + esc(F.callLink) + ' →</a></div></div>' +
      '<p class="small-print tp-msg" data-msg aria-live="polite"></p></form>';
    var f = box.querySelector('form');
    var keep = function () {
      f.querySelectorAll('[data-k]').forEach(function (el) { draft[el.getAttribute('data-k')] = el.value; });
      var fc = f.querySelector('[data-founding]');
      if (fc) draft.founding = fc.checked;
      save();
    };
    f.addEventListener('input', keep);
    f.addEventListener('change', keep);
    f.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      // Once per visit, so coming back to finish is not a second start.
      try { if (sessionStorage.getItem('web3toys.bizStart.test')) return; sessionStorage.setItem('web3toys.bizStart.test', '1'); } catch (e) { /* ok */ }
      log('biz_start');
    });
    f.querySelector('[data-next]').addEventListener('click', step1);
    f.querySelector('[data-back]').addEventListener('click', function () { setStep(1); });
    f.addEventListener('submit', function (e) { e.preventDefault(); keep(); submit(); });
    setStep(draft.step === 2 && draft.name && draft.email ? 2 : 1);
  }

  function say(t) { var m = app.querySelector('.tp-form [data-msg]'); if (m) m.textContent = t; }

  function setStep(n) {
    var f = app.querySelector('.tp-form');
    if (!f) return;
    f.querySelector('[data-step="1"]').hidden = n !== 1;
    f.querySelector('[data-step="2"]').hidden = n !== 2;
    f.querySelector('[data-bar]').style.width = n === 1 ? '50%' : '100%';
    f.querySelector('[data-steplabel]').textContent = 'Step ' + n + ' of 2 · ' + (n === 1 ? P.form.step1 : P.form.step2);
    draft.step = n; save();
    say('');
  }

  function step1() {
    var name = (draft.name || '').trim(), email = (draft.email || '').trim();
    if (!name) return say('Add your name.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('Add an email we can reply to.');
    var btn = app.querySelector('[data-next]');
    btn.disabled = true;
    rpc('save_biz_lead', { p_kind: 'test', p_name: name, p_email: email, p_tier: draft.tier })
      .then(function (id) { draft.leadId = id; log('biz_step1'); }, function () { /* the request still works; the lead is extra */ })
      .then(function () { btn.disabled = false; setStep(2); var el = app.querySelector('#tp-project'); if (el) el.focus(); });
  }

  function submit() {
    if (!(draft.project || '').trim()) return say('Add your project name.');
    if (!/^https:\/\/\S{3,}$/.test((draft.link || '').trim())) return say('Add your website or testnet link (starting with https://).');
    var A = window.Web3Auth;
    if (!A) return say('Requests open soon. Email hi@web3.toys in the meantime.');
    if (!A.user()) { say(P.loginNote); A.open(P.loginNote); return; }
    var btn = app.querySelector('.tp-form button[type=submit]');
    btn.disabled = true;
    say('Sending…');
    var t = tier(draft.tier);
    A.client.rpc('submit_biz_request', {
      p_kind: 'test', p_tier: t.id, p_project: draft.project.trim(), p_website: draft.link.trim(), p_x: '', p_email: draft.email.trim(),
      p_product: '', p_launch: draft.launch || null, p_idea: (draft.note || '').trim(),
      p_details: { testLink: draft.link.trim(), contact: draft.name.trim(), founding: !!(draft.founding && foundingOn()), agreed: true },
    }).then(function (r) {
      if (r.error) throw r.error;
      log('biz_submit');
      var founding = !!(draft.founding && foundingOn());
      draft = { name: draft.name, email: draft.email, tier: t.id };
      save();
      thanks(r.data, t, founding);
    }).catch(function (err) { btn.disabled = false; say('Could not send: ' + err.message); });
  }

  // ---------- Thank you ----------
  function thanks(id, t, founding) {
    var box = app.querySelector('[data-form]');
    var th = P.thanks;
    var amount = founding ? foundingDeposit(t) : deposit(t);
    box.innerHTML = '<section class="card card--yellow stack tp-thanks" tabindex="-1"><h3 class="title-md">✅ ' + esc(th.title) + '</h3>' +
      '<p class="label">What happens next</p><ol class="tp-next">' + th.next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
      '<div class="btn-row"><a class="btn btn--ink" href="' + esc(calUrl()) + '" target="_blank" rel="noopener">📅 ' + esc(th.book) + '</a>' +
      '<button type="button" class="btn" data-deposit>' + esc(th.deposit) + ' · ' + money(amount) + '</button></div>' +
      '<p class="small-print">' + esc(T.depositLine) + (founding ? ' Founding offer: ' + Math.round(Number(T.foundingOffer.discount) * 100) + '% off, in exchange for a short case study after your test.' : '') + '</p>' +
      '<button type="button" class="text-button" data-copy-link>🔗 ' + esc(th.share) + '</button><p class="small-print" data-msg aria-live="polite"></p></section>';
    var sec = box.querySelector('.tp-thanks');
    sec.scrollIntoView({ block: 'start' });
    sec.focus({ preventScroll: true });
    box.querySelector('[data-deposit]').addEventListener('click', function () { pay(t, id, founding, box.querySelector('[data-msg]')); });
    box.querySelector('[data-copy-link]').addEventListener('click', function (e) {
      var url = location.origin + location.pathname;
      var done = function () { e.target.textContent = '✅ ' + th.copied; };
      if (navigator.share) navigator.share({ title: 'Test Your Product on web3.toys', url: url }).then(done, function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {});
    });
    mine();
  }

  function pay(t, id, founding, msg) {
    if (!window.Web3Pay) { msg.textContent = 'Payments open soon.'; return; }
    var product = 'deposit-test-' + t.id + (founding && foundingOn() ? '-founding' : '');
    window.Web3Pay.buy(product, id, function () { setTimeout(mine, 1500); setTimeout(mine, 5000); })
      .catch(function (err) { if (err.message !== 'login') msg.textContent = err.message; });
  }

  // ---------- Your requests (logged in) ----------
  var STATUS = { submitted: 'Waiting for your deposit or call', paid: 'Deposit paid: slot reserved', in_review: 'We are checking your project', approved: 'Approved: setting up your test', building: 'Setting up your test', live: 'Your test is running', declined: 'Declined: deposit refunded', refunded: 'Deposit refunded' };
  function mine() {
    var el = app.querySelector('[data-mine]');
    var A = window.Web3Auth;
    if (!el || !A || !A.user()) return;
    A.client.from('biz_requests').select('id,project,tier,status,created_at,details').eq('kind', 'test').order('created_at', { ascending: false }).then(function (r) {
      if (r.error || !r.data || !r.data.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<h3 class="title-sm">Your requests</h3><ul class="tp-mine">' + r.data.map(function (q) {
        var t = tier(q.tier);
        var founding = !!(q.details && q.details.founding);
        return '<li><div><b>' + esc(q.project) + '</b><span class="small-print">' + esc(t.name) + ' · ' + esc(STATUS[q.status] || q.status) + '</span></div>' +
          (q.status === 'submitted' ? '<button type="button" class="btn btn--small btn--ink" data-pay-req="' + esc(q.id) + '" data-tier="' + esc(t.id) + '"' + (founding ? ' data-founding' : '') + '>Deposit · ' + money(founding && foundingOn() ? foundingDeposit(t) : deposit(t)) + '</button>' : '') + '</li>';
      }).join('') + '</ul><p class="small-print" data-req-msg></p>';
      el.querySelectorAll('[data-pay-req]').forEach(function (b) {
        b.addEventListener('click', function () { pay(tier(b.getAttribute('data-tier')), b.getAttribute('data-pay-req'), b.hasAttribute('data-founding'), el.querySelector('[data-req-msg]')); });
      });
    });
  }

  // ---------- Page buttons, the full sample, the sticky phone button ----------
  function bindPage() {
    app.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () {
        draft.tier = b.getAttribute('data-tier'); save(); log('biz_tier');
        var sel = app.querySelector('#tp-tier'); if (sel) sel.value = draft.tier;
        document.getElementById('request').scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'start' });
      });
    });
    var ap = app.querySelector('[data-apply-founding]');
    if (ap) ap.addEventListener('click', function () {
      draft.founding = true; save();
      var c = app.querySelector('[data-founding]'); if (c) c.checked = true;
      document.getElementById('request').scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'start' });
    });
    app.querySelector('[data-full-sample]').addEventListener('click', function () {
      var box = document.createElement('div');
      box.className = 'pay-modal tp-modal';
      box.innerHTML = '<div class="pay-box card stack stack--tight" role="dialog" aria-modal="true" aria-label="Sample report"><button type="button" class="btn btn--small tp-close" data-close>Close</button>' + Web3TestReport.html(P.sample.test, P.sample.runs, { sample: true }) + '</div>';
      document.body.appendChild(box);
      var close = function () { box.remove(); };
      box.addEventListener('click', function (e) { if (e.target === box) close(); });
      box.querySelector('[data-close]').addEventListener('click', close);
      box.querySelector('[data-close]').focus();
    });
    var sticky = app.querySelector('[data-sticky]');
    var form = document.getElementById('request');
    var hero = app.querySelector('[data-cta]');
    if (!('IntersectionObserver' in window)) return;
    var seen = { form: false, hero: true };
    var update = function () { sticky.hidden = seen.form || seen.hero; };
    new IntersectionObserver(function (es) { es.forEach(function (e) { seen[e.target === form ? 'form' : 'hero'] = e.isIntersecting; }); update(); }).observe(form);
    new IntersectionObserver(function (es) { es.forEach(function (e) { seen.hero = e.isIntersecting; }); update(); }).observe(hero);
  }
})();
