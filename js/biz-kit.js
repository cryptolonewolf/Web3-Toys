// The For Projects page kit, shared by Test Your Product, Launch Your Own Toy,
// List your Quest and Advertise, so they look and work the same.
//   - Each section is one bordered card with a title; things inside are flat.
//   - On wider screens, sections sit side by side in pairs (Kit.pair).
//   - Short words: page copy lives in data/business/*.json and
//     data/academy/listing.json.
//   - The request form has two steps. Step 1 (name, email, choice) is saved
//     as a lead at once (save_biz_lead, supabase/022_test_funnel.sql); step 2
//     sends the request and shows the thank-you view (book the setup call,
//     pay, copy link). Funnel counts without names: biz_tier, biz_start,
//     biz_step1, biz_submit (item: the product kind).
//   - A sticky button on phones jumps to the form and hides once it shows.
// Used as window.Web3BizKit.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var CFG = window.WEB3TOYS_CONFIG || {};
  var SB = CFG.supabase || {};

  function money(n) { var f = Number(n) % 1 ? 2 : 0; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }); }
  function log(name, kind) { if (site.log) site.log(name, kind); }
  function calUrl() { return (CFG.call || {}).calUrl || (site.root + 'book-a-call/'); }
  function scrollTo(el) { if (el) el.scrollIntoView({ behavior: site.fx && site.fx.calm() ? 'auto' : 'smooth', block: 'start' }); }

  // The database, as the logged-in player when there is one, else as a visitor.
  function rpc(fn, args) {
    var A = window.Web3Auth;
    if (A && A.client) return A.client.rpc(fn, args).then(function (r) { if (r.error) throw r.error; return r.data; });
    return fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
      .then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { if (!r.ok) throw new Error((j && j.message) || 'Could not send. Try again.'); return j; }); });
  }

  // ---------- Building blocks ----------
  function section(title, body, cls, id) {
    return '<section class="card bk-sec' + (cls ? ' ' + cls : '') + '"' + (id ? ' id="' + id + '"' : '') + '>' + (title ? '<h2 class="bk-h">' + title + '</h2>' : '') + body + '</section>';
  }
  // Two sections side by side on wide screens (one alone takes the full width).
  function pair(a, b) { return a && b ? '<div class="bk-pair">' + a + b + '</div>' : (a || b || ''); }

  function hero(P, extra) {
    return '<section class="bk-hero stack stack--tight"><p class="label">' + esc(P.label) + '</p><h1 class="biz-title">' + esc(P.title) + '</h1>' +
      (P.subtitle ? '<p class="bk-sub">' + esc(P.subtitle) + '</p>' : '') + (P.intro ? '<p class="text">' + esc(P.intro) + '</p>' : '') +
      '<div class="btn-row"><a class="btn btn--ink" href="#request" data-cta>' + esc(P.ctaPrimary || 'Get started') + '</a>' + (extra || '') + '</div></section>';
  }

  function banner(offer) {
    if (!offer || offer.on !== true || !(Number(offer.left) > 0)) return '';
    return '<aside class="bk-banner" role="note"><span>🎉 <b>Founding offer:</b> ' + esc(offer.line) + ' <b>' + offer.left + ' of ' + offer.total + ' slots left.</b></span><button type="button" class="btn btn--small btn--ink" data-apply-founding>Apply</button></aside>';
  }

  // tiers: [{ id, name, price, time, features, popular }]; o: { label, deposit(t), note(t), guarantee, choose }
  function pricing(title, tiers, o) {
    return section(esc(title), '<ul class="biz-tiers bk-tiers">' + tiers.map(function (t) {
      return '<li class="bk-tier' + (t.popular ? ' is-popular' : '') + '">' + (t.popular ? '<span class="chip is-yellow biz-popular">' + esc(o.label || 'Recommended') + '</span>' : '') +
        '<h3 class="title-md">' + esc(t.name) + '</h3><p class="biz-price">' + money(t.price) + '</p>' + (t.time ? '<p class="small-print">' + esc(t.time) + '</p>' : '') +
        '<ul class="biz-feats">' + (t.features || []).map(function (x) { return '<li>' + site.icon('check') + '<span>' + esc(x) + '</span></li>'; }).join('') + '</ul>' +
        '<button type="button" class="btn btn--block' + (t.popular ? ' btn--ink' : '') + '" data-tier="' + esc(t.id) + '">' + esc(o.choose || 'Choose') + ' ' + esc(t.name) + '</button>' +
        (o.note ? '<p class="small-print">' + o.note(t) + '</p>' : '') + '</li>';
    }).join('') + '</ul>' + (o.extra || '') + (o.guarantee ? '<p class="bk-guarantee">✅ ' + esc(o.guarantee) + '</p>' : ''), 'bk-pricing', 'pricing');
  }

  function steps(title, list) {
    return section(esc(title), '<ol class="bk-steps">' + list.map(function (s, i) {
      return '<li><span class="biz-step-n">' + (i + 1) + '</span><div><b>' + esc(s.title) + '</b><span class="small-print">' + esc(s.text) + '</span></div></li>';
    }).join('') + '</ol>');
  }

  // items: [[icon, text]]
  function list(title, items, cls) {
    return section(esc(title), '<ul class="bk-list">' + items.map(function (x) { return '<li><span aria-hidden="true">' + x[0] + '</span><span>' + esc(x[1]) + '</span></li>'; }).join('') + '</ul>', cls);
  }

  function compare(title, c) {
    if (!c) return '';
    return section(esc(title), '<div class="bk-compare-wrap"><table class="bk-compare"><thead><tr><th></th>' +
      c.columns.map(function (h, i) { return '<th' + (i === 0 ? ' class="is-us"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      c.rows.map(function (r) { return '<tr><th scope="row">' + esc(r.label) + '</th>' + r.cells.map(function (x, i) { return '<td' + (i === 0 ? ' class="is-us"' : '') + '>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div>', 'bk-compare-sec');
  }

  function video(v) {
    v = v || {};
    return section('▶ ' + esc(v.title || 'See it in 60 seconds'), v.src
      ? '<video class="bk-video" controls preload="metadata" playsinline' + (v.poster ? ' poster="' + esc(site.root + v.poster) + '"' : '') + ' src="' + esc(site.root + v.src) + '"></video>'
      : '<div class="bk-video-ph"><span aria-hidden="true">🎬</span><p class="small-print">' + esc(v.placeholder || 'A 60 second walkthrough is coming soon.') + '</p></div>', 'bk-video-sec');
  }

  function who(w) {
    var s = CFG.social || {};
    var links = [];
    if (s.x) links.push('<a class="btn btn--small btn--ink" href="' + esc(s.x) + '" target="_blank" rel="noopener">' + esc(w.talk) + ' on X</a>');
    if (s.telegram) links.push('<a class="btn btn--small" href="' + esc(s.telegram) + '" target="_blank" rel="noopener">Telegram</a>');
    if (!links.length) links.push('<a class="btn btn--small btn--ink" href="' + esc(calUrl()) + '" target="_blank" rel="noopener">' + esc(w.talk) + '</a>');
    return section(esc(w.title), '<div class="bk-who">' + site.mascotImg('grin', 'bk-face', 64, '') + '<div class="stack stack--tight"><b>' + esc(w.name) + '</b><p class="small-print">' + esc(w.line) + '</p><div class="btn-row">' + links.join('') + '</div></div></div>', 'bk-who-sec');
  }

  function faq(title, items) {
    return section(esc(title), '<div class="bk-faq">' + items.map(function (f) {
      return '<details><summary>' + esc(f.q) + '</summary><p class="small-print">' + esc(f.a) + '</p></details>';
    }).join('') + '</div>', 'bk-faq-sec');
  }

  // Hidden until a real case study is added (no made-up logos, quotes or numbers).
  function cases(title, items) {
    if (!(items || []).length) return '';
    return section(esc(title), '<ul class="bk-cases">' + items.map(function (c) {
      return '<li><b>' + esc(c.project) + '</b>' + (c.result ? '<span class="small-print">' + esc(c.result) + '</span>' : '') + (c.quote ? '<blockquote>“' + esc(c.quote) + '”' + (c.who ? ' <span class="small-print">' + esc(c.who) + '</span>' : '') + '</blockquote>' : '') +
        (c.link ? '<a class="text-button" href="' + esc(c.link) + '" target="_blank" rel="noopener">Read the case study →</a>' : '') + '</li>';
    }).join('') + '</ul>');
  }

  function modal(html, label) {
    var box = document.createElement('div');
    box.className = 'modal pay-modal bk-modal';
    box.innerHTML = '<div class="pay-box card stack stack--tight" role="dialog" aria-modal="true" aria-label="' + esc(label || '') + '"><button type="button" class="btn btn--small bk-close" data-close>Close</button>' + html + '</div>';
    document.body.appendChild(box);
    var close = function () { box.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    box.querySelector('[data-close]').addEventListener('click', close);
    box.querySelector('[data-close]').focus();
    return box;
  }

  // ---------- The two-step request form ----------
  // o: { kind, key (draft name), choices: [{ id, name, price }], choiceLabel, fields: [{ k, label, type, req, max, placeholder }],
  //      copy: { step1, step2, name, email, next, back, submit, callLink, reply, founding? }, thanks: { title, next[], book, pay, share, copied, payNote },
  //      founding (bool, show the tick), loginNote, submit(draft) -> Promise(id), pay(draft, id, msg), payLabel(draft) -> text, after() }
  function form(box, o) {
    var KEY = 'web3toys.bizDraft.' + o.key + '.v2';
    var draft;
    try { draft = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { draft = {}; }
    var q = new URLSearchParams(location.search);
    if (q.get('tier') && o.choices.some(function (c) { return c.id === q.get('tier'); })) draft.tier = q.get('tier');
    if (!draft.tier) draft.tier = (o.choices.filter(function (c) { return c.popular; })[0] || o.choices[0]).id;
    var save = function () { try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch (e) { /* private mode */ } };
    var F = o.copy;
    var input = function (f) {
      var id = 'bk-' + o.key + '-' + f.k;
      var label = esc(f.label) + (f.req ? '' : ' <span class="small-print">(optional)</span>');
      var field = f.type === 'area'
        ? '<textarea class="field field--area" id="' + id + '" data-k="' + f.k + '" rows="3" maxlength="' + (f.max || 1000) + '">' + esc(draft[f.k] || '') + '</textarea>'
        : '<input class="field" id="' + id + '" data-k="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(draft[f.k] || '') + '"' + (f.max ? ' maxlength="' + f.max + '"' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + (f.type === 'url' ? ' inputmode="url"' : '') + ' />';
      return '<div class="stack stack--tight"><label class="label" for="' + id + '">' + label + '</label>' + field + '</div>';
    };
    box.innerHTML = '<form class="stack bk-form" novalidate>' +
      '<div class="bk-progress" aria-hidden="true"><span data-bar></span></div><p class="small-print bk-steplabel" data-steplabel></p>' +
      '<div class="stack" data-step="1">' + input({ k: 'name', label: F.name, req: true, max: 100 }) + input({ k: 'email', label: F.email, type: 'email', req: true, max: 200 }) +
      '<div class="stack stack--tight"><label class="label" for="bk-' + o.key + '-tier">' + esc(o.choiceLabel) + '</label><select class="field" id="bk-' + o.key + '-tier" data-k="tier">' + o.choices.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === draft.tier ? ' selected' : '') + '>' + esc(c.name) + (c.price ? ' · ' + money(c.price) : '') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-next>' + esc(F.next) + ' →</button></div></div>' +
      '<div class="stack" data-step="2" hidden>' + o.fields.map(input).join('') +
      (o.founding ? '<label class="mk-check"><input type="checkbox" data-founding' + (draft.founding ? ' checked' : '') + ' /> <span>' + esc(F.founding) + '</span></label>' : '') +
      '<div class="bk-submit"><div class="btn-row"><button type="button" class="btn" data-back>← ' + esc(F.back) + '</button><button type="submit" class="btn btn--ink">' + esc(F.submit) + '</button></div>' +
      '<p class="small-print">' + esc(F.reply) + '</p><a class="text-button" href="' + esc(calUrl()) + '" target="_blank" rel="noopener">' + esc(F.callLink) + ' →</a></div></div>' +
      '<p class="small-print bk-msg" data-msg aria-live="polite"></p></form>';
    var f = box.querySelector('form');
    var say = function (t) { f.querySelector('[data-msg]').textContent = t; };
    var started = false;
    var keep = function () {
      f.querySelectorAll('[data-k]').forEach(function (el) { draft[el.getAttribute('data-k')] = el.value; });
      var fc = f.querySelector('[data-founding]');
      if (fc) draft.founding = fc.checked;
      save();
    };
    var setStep = function (n) {
      f.querySelector('[data-step="1"]').hidden = n !== 1;
      f.querySelector('[data-step="2"]').hidden = n !== 2;
      f.querySelector('[data-bar]').style.width = n === 1 ? '50%' : '100%';
      f.querySelector('[data-steplabel]').textContent = 'Step ' + n + ' of 2 · ' + (n === 1 ? F.step1 : F.step2);
      draft.step = n; save(); say('');
    };
    f.addEventListener('input', keep);
    f.addEventListener('change', keep);
    f.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      try { if (sessionStorage.getItem('web3toys.bizStart.' + o.key)) return; sessionStorage.setItem('web3toys.bizStart.' + o.key, '1'); } catch (e) { /* ok */ }
      log('biz_start', o.kind);
    });
    f.querySelector('[data-next]').addEventListener('click', function () {
      keep();
      var name = (draft.name || '').trim(), email = (draft.email || '').trim();
      if (!name) return say('Add your name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('Add an email we can reply to.');
      var btn = this;
      btn.disabled = true;
      rpc('save_biz_lead', { p_kind: o.kind, p_name: name, p_email: email, p_tier: draft.tier })
        .then(function () { log('biz_step1', o.kind); }, function () { /* the lead is extra; the request still works */ })
        .then(function () { btn.disabled = false; setStep(2); var first = f.querySelector('[data-step="2"] [data-k]'); if (first) first.focus(); });
    });
    f.querySelector('[data-back]').addEventListener('click', function () { setStep(1); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      keep();
      for (var i = 0; i < o.fields.length; i++) {
        var fl = o.fields[i], v = String(draft[fl.k] || '').trim();
        if (fl.req && !v) return say('Add: ' + fl.label + '.');
        if (v && fl.type === 'url' && !/^https:\/\/\S{3,}$/.test(v)) return say(fl.label + ' should start with https://');
      }
      var A = window.Web3Auth;
      if (!A) return say('Requests open soon. Email hi@web3.toys in the meantime.');
      if (!A.user()) { say(o.loginNote); A.open(o.loginNote); return; }
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true;
      say('Sending…');
      o.submit(draft).then(function (id) {
        log('biz_submit', o.kind);
        var sent = draft;
        draft = { name: draft.name, email: draft.email, tier: draft.tier };
        save();
        thanks(box, o, sent, id);
      }).catch(function (err) { btn.disabled = false; say('Could not send: ' + err.message); });
    });
    setStep(draft.step === 2 && draft.name && draft.email ? 2 : 1);
    return {
      pick: function (id) { draft.tier = id; save(); var sel = f.querySelector('[data-k="tier"]'); if (sel) sel.value = id; log('biz_tier', o.kind); },
      founding: function () { draft.founding = true; save(); var c = f.querySelector('[data-founding]'); if (c) c.checked = true; },
      resume: function () { if (draft.step === 2) setStep(2); },
    };
  }

  function thanks(box, o, sent, id) {
    var th = o.thanks;
    box.innerHTML = '<div class="stack bk-thanks" tabindex="-1"><h3 class="title-md">✅ ' + esc(th.title) + '</h3>' +
      '<p class="label">What happens next</p><ol class="bk-next">' + th.next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
      '<div class="btn-row"><a class="btn btn--ink" href="' + esc(calUrl()) + '" target="_blank" rel="noopener">📅 ' + esc(th.book) + '</a>' +
      (o.pay ? '<button type="button" class="btn" data-pay>' + esc(o.payLabel(sent)) + '</button>' : '') + '</div>' +
      (th.payNote ? '<p class="small-print">' + esc(th.payNote) + '</p>' : '') +
      '<button type="button" class="text-button" data-copy-link>🔗 ' + esc(th.share) + '</button><p class="small-print" data-msg aria-live="polite"></p></div>';
    var sec = box.querySelector('.bk-thanks');
    sec.scrollIntoView({ block: 'start' });
    sec.focus({ preventScroll: true });
    var payBtn = box.querySelector('[data-pay]');
    if (payBtn) payBtn.addEventListener('click', function () { o.pay(sent, id, box.querySelector('[data-msg]')); });
    box.querySelector('[data-copy-link]').addEventListener('click', function (e) {
      var url = location.origin + location.pathname;
      var done = function () { e.target.textContent = '✅ ' + th.copied; };
      if (navigator.share) navigator.share({ title: document.title, url: url }).then(done, function () {});
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () {});
    });
    if (o.after) o.after();
  }

  // ---------- Sticky "Request" button on phones ----------
  function sticky(app, label) {
    var a = document.createElement('a');
    a.className = 'btn btn--ink bk-sticky';
    a.href = '#request';
    a.textContent = label;
    a.hidden = true;
    app.appendChild(a);
    var form = document.getElementById('request');
    var cta = app.querySelector('[data-cta]');
    if (!form || !('IntersectionObserver' in window)) return;
    var seen = { form: false, cta: true };
    var update = function () { a.hidden = seen.form || seen.cta; };
    new IntersectionObserver(function (es) { es.forEach(function (e) { seen.form = e.isIntersecting; }); update(); }).observe(form);
    if (cta) new IntersectionObserver(function (es) { es.forEach(function (e) { seen.cta = e.isIntersecting; }); update(); }).observe(cta);
  }

  window.Web3BizKit = { money: money, log: log, rpc: rpc, calUrl: calUrl, scrollTo: scrollTo, section: section, pair: pair, hero: hero, banner: banner, pricing: pricing,
    steps: steps, list: list, compare: compare, video: video, who: who, faq: faq, cases: cases, modal: modal, form: form, sticky: sticky };
})();
