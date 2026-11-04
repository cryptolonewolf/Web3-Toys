// The Work with us page: pick a package (custom toy or Academy course),
// send the request form (saved in Supabase by submit_request), then pay for
// it with Web3Pay. Paid requests move to Paid by themselves (a database
// trigger in supabase/009_work_with_us.sql); the admin dashboard moves them
// on from there. Words: data/work.json. Prices: data/products.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var DRAFT = 'web3toys.workDraft.v1';
  var ORDER = ['submitted', 'paid', 'in_review', 'approved', 'live'];
  var W, products = {}, cur = 'USD';

  function readDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT)) || {}; } catch (e) { return {}; }
  }
  function saveDraft(d) {
    try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) { /* private mode */ }
  }

  var draft = readDraft();
  var params = new URLSearchParams(location.search);
  var pick = params.get('pkg') || (params.get('kind') === 'toy' ? 'project-toy' : params.get('kind') === 'course' ? 'course-6' : draft.pkg || '');

  function pkg(id) { return W.packages.filter(function (p) { return p.id === id; })[0]; }
  function priceOf(productId) {
    var p = products[productId];
    if (!p) return '';
    return window.Web3Pay ? window.Web3Pay.price(p, cur) : '$' + p.usd;
  }

  function field(f) {
    var id = 'wk-' + f.key;
    var v = (draft.answers || {})[f.key] || '';
    var attrs = ' id="' + id + '" name="' + f.key + '" data-f="' + f.key + '"' + (f.required ? ' required' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '');
    var input = f.type === 'area'
      ? '<textarea class="field field--area" rows="3" maxlength="1200"' + attrs + '>' + esc(v) + '</textarea>'
      : '<input class="field" maxlength="' + (f.type === 'url' ? 300 : 120) + '" type="' + (f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text') + '"' +
        (f.type === 'url' ? ' inputmode="url"' : '') + attrs + ' value="' + esc(v) + '" />';
    return '<div class="stack stack--tight"><label class="label" for="' + id + '">' + esc(f.label) + (f.required ? '' : ' <span class="small-print">(optional)</span>') + '</label>' + input + '</div>';
  }

  function render() {
    var chosen = pkg(pick);
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><p class="label">' + esc(W.label) + '</p><h1 class="tool-title">' + esc(W.title) + '</h1>' +
      '<p class="text text--ink">' + esc(W.intro) + '</p></section>' +
      '<section class="stack stack--tight" data-mine hidden></section>' +
      '<h2 class="section-title">' + esc(W.packagesTitle) + '</h2>' +
      '<ul class="wk-packs" role="list">' + W.packages.map(function (p) {
        var on = p.id === pick;
        return '<li><button type="button" class="card wk-pack' + (on ? ' is-on' : '') + '" data-pkg="' + p.id + '" aria-pressed="' + on + '">' +
          '<span class="wk-name">' + esc(p.name) + '</span><span class="wk-price">' + esc(priceOf(p.product)) + '</span>' +
          '<span class="wk-points">' + p.points.map(function (t) { return '<span>' + site.icon('check') + esc(t) + '</span>'; }).join('') + '</span></button></li>';
      }).join('') + '</ul>' +
      '<section class="card card--yellow stack stack--tight"><p class="text text--ink"><b>' + esc(W.guarantee) + '</b></p>' +
      '<p class="small-print"><a href="../academy/list-your-project/">' + esc(W.checklistLink) + '</a> · <a href="../refunds/">Refunds</a></p></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">' + esc(W.stepsTitle) + '</h2><ol class="lesson-points">' +
      W.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></section>' +
      (chosen ? form(chosen) : '<p class="text" data-hint>Pick a package above to see the form.</p>');

    app.querySelectorAll('[data-pkg]').forEach(function (b) {
      b.addEventListener('click', function () {
        keep();
        pick = b.getAttribute('data-pkg');
        draft.pkg = pick;
        saveDraft(draft);
        render();
        var f = app.querySelector('#wk-form');
        if (f) f.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      });
    });
    var f = app.querySelector('#wk-form');
    if (f) {
      f.addEventListener('input', keep);
      f.addEventListener('submit', send);
    }
    mine();
  }

  function form(p) {
    var u = window.Web3Auth && window.Web3Auth.user();
    if (u && u.email && !(draft.answers || {}).email) { draft.answers = draft.answers || {}; draft.answers.email = u.email; }
    return '<form class="card stack" id="wk-form" novalidate><h2 class="title-md">' + esc(W.formTitle) + '</h2>' +
      '<p class="small-print">Package: <b>' + esc(p.name) + '</b> · ' + esc(priceOf(p.product)) + '</p>' +
      W.common.concat(W.fields[p.kind]).map(field).join('') +
      '<label class="mk-check"><input type="checkbox" data-agree' + (draft.agree ? ' checked' : '') + ' /> <span>' + esc(W.agree) + '</span></label>' +
      '<button type="submit" class="btn btn--ink btn--block" data-send>' + esc(W.submit) + ' · ' + esc(priceOf(p.product)) + '</button>' +
      '<p class="small-print" data-msg aria-live="polite"></p></form>';
  }

  // Keep the answers on this device, so a login (which can leave the page)
  // never loses them.
  function keep() {
    var f = app.querySelector('#wk-form');
    if (!f) return;
    draft.answers = draft.answers || {};
    f.querySelectorAll('[data-f]').forEach(function (el) { draft.answers[el.getAttribute('data-f')] = el.value; });
    draft.agree = f.querySelector('[data-agree]').checked;
    draft.pkg = pick;
    saveDraft(draft);
  }

  function say(text) {
    var m = app.querySelector('#wk-form [data-msg]');
    if (m) m.textContent = text;
  }

  function send(e) {
    e.preventDefault();
    keep();
    var p = pkg(pick);
    var f = app.querySelector('#wk-form');
    var bad = Array.prototype.filter.call(f.querySelectorAll('[data-f]'), function (el) { return !el.checkValidity() || (el.required && !el.value.trim()); })[0];
    if (bad) { say('Please fill in: ' + f.querySelector('label[for="' + bad.id + '"]').textContent.replace(' (optional)', '') + '.'); bad.focus(); return; }
    if (!draft.agree) { say('Please tick the box to say you understand how listing works.'); return; }
    if (!window.Web3Pay || !window.Web3Auth) { say(W.noPay); return; }
    if (!window.Web3Auth.user()) { say(W.loginNote); window.Web3Auth.open(W.loginNote); return; }

    var a = draft.answers;
    var details = { package: p.name, agreed: true };
    W.common.concat(W.fields[p.kind]).forEach(function (q) {
      if (['project', 'email', 'website', 'x'].indexOf(q.key) < 0 && a[q.key]) details[q.key] = String(a[q.key]).slice(0, 1200);
    });
    var btn = f.querySelector('[data-send]');
    btn.disabled = true;
    say('Sending your request…');
    window.Web3Auth.client.rpc('submit_request', {
      p_kind: p.kind, p_tier: p.product, p_project: a.project.trim(), p_email: a.email.trim(),
      p_website: (a.website || '').trim(), p_x: (a.x || '').trim(), p_details: details,
    }).then(function (r) {
      if (r.error) throw r.error;
      var id = r.data;
      C.track('project_request', { kind: p.kind, tier: p.product });
      draft = { pkg: pick };
      saveDraft(draft);
      render();
      return payFor(p.product, id);
    }).catch(function (err) {
      btn.disabled = false;
      say(err.message === 'login' ? W.loginNote : 'Could not send: ' + err.message);
    }).then(function () { mine(); });
  }

  function payFor(product, id) {
    return window.Web3Pay.buy(product, id, function () {
      setTimeout(mine, 1500);
      setTimeout(mine, 5000);
    }).catch(function (err) { if (err.message !== 'login') throw err; });
  }

  // The visitor's own requests, with where each one is.
  function mine() {
    var box = app.querySelector('[data-mine]');
    var A = window.Web3Auth;
    if (!box || !A || !A.user()) { if (box) box.hidden = true; return; }
    A.client.from('project_requests').select('id,project,kind,tier,status,created_at').order('created_at', { ascending: false }).then(function (r) {
      if (r.error || !r.data.length) { box.hidden = true; return; }
      box.hidden = false;
      box.innerHTML = '<h2 class="section-title">' + esc(W.mineTitle) + '</h2>' + r.data.map(function (q) {
        var s = W.statuses[q.status] || { name: q.status, line: '' };
        var p = pkg(q.tier) || { name: q.tier || '' };
        var at = ORDER.indexOf(q.status);
        return '<article class="card stack stack--tight wk-req"><div class="cap-row"><h3 class="title-sm">' + esc(q.project) + '</h3>' +
          '<span class="chip ' + (q.status === 'declined' ? 'is-white' : q.status === 'submitted' ? 'is-white' : 'is-mint') + '">' + esc(s.name) + '</span></div>' +
          '<p class="small-print">' + esc(p.name) + ' · sent ' + esc(String(q.created_at).slice(0, 10)) + '</p>' +
          (q.status === 'declined' ? '' : '<ol class="wk-steps">' + ORDER.map(function (k, i) {
            return '<li class="' + (i <= at ? 'is-done' : '') + '">' + esc(W.statuses[k].name) + '</li>';
          }).join('') + '</ol>') +
          '<p class="text">' + esc(s.line) + '</p>' +
          (q.status === 'submitted' && products[q.tier] ? '<button type="button" class="btn btn--ink" data-pay="' + esc(q.id) + '" data-product="' + esc(q.tier) + '">' + esc(W.payNow) + ' · ' + esc(priceOf(q.tier)) + '</button>' : '') +
          '</article>';
      }).join('') + '<p class="small-print">Questions about a request? Email <a href="mailto:hi@web3.toys">hi@web3.toys</a>.</p>';
      box.querySelectorAll('[data-pay]').forEach(function (b) {
        b.addEventListener('click', function () {
          payFor(b.getAttribute('data-product'), b.getAttribute('data-pay')).catch(function (err) { b.insertAdjacentHTML('afterend', '<p class="small-print">' + esc(err.message) + '</p>'); });
        });
      });
    });
  }

  function withPay(fn) {
    if (window.Web3Pay) fn();
    else document.addEventListener('web3pay:ready', fn, { once: true });
  }

  C.loadJson('../data/work.json').then(function (data) {
    W = data;
    return fetch(site.root + 'data/products.json').then(function (r) { return r.json(); });
  }).then(function (d) {
    d.products.forEach(function (p) { products[p.id] = p; });
    if (pick && !pkg(pick)) pick = '';
    render();
    withPay(function () {
      cur = window.Web3Pay.currency();
      render();
      if (window.Web3Auth) window.Web3Auth.onChange(function () { mine(); });
    });
  }).catch(function (err) { app.innerHTML = C.loadError(err); });
})();
