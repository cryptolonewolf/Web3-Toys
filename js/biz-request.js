// The For Projects request form, shared by /launch-your-toy/ and
// /test-your-product/. Saves the request in Supabase (submit_biz_request,
// supabase/014_business.sql), then offers the 50% deposit with Razorpay
// (product deposit-KIND-TIER, see js/pay.js) or a call instead. Answers are
// kept on this device until sent, so logging in never loses them. Lists the
// visitor's own requests with their status and a Pay deposit button.
//   Web3BizRequest.mount(box, { kind, tiers, copy, tier })
//   Web3BizRequest.pick(tierId)  selects a package (from the pricing cards)

(function () {
  var esc = window.Web3Common.esc;
  var site = window.WEB3TOYS;
  var STATUS = {
    submitted: ['Submitted', 'Waiting for your deposit or our call.'],
    paid: ['Deposit paid', 'Your slot is reserved. We review your project next.'],
    in_review: ['In review', 'We are checking your project against our vetting checklist.'],
    approved: ['Approved', 'You passed. We will contact you to start.'],
    building: ['Building', 'We are building it. You will get a preview to review.'],
    live: ['Live', 'It is live on web3.toys.'],
    declined: ['Declined', 'We could not take this project on. Your deposit is refunded in full.'],
    refunded: ['Refunded', 'Your deposit has been refunded.'],
  };
  var opts, box, draft, KEY;

  function money(n) { var f = Number(n) % 1 ? 2 : 0; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }); }
  function tier(id) { return opts.tiers.tiers.filter(function (t) { return t.id === id; })[0]; }
  function deposit(t) { return Math.round(t.price * (Number(opts.tiers.deposit) || 0.5) * 100) / 100; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch (e) { /* private mode */ } }

  function field(k, label, type, req, extra) {
    var v = draft[k] || '';
    var id = 'bz-' + k;
    var input = type === 'area'
      ? '<textarea class="field field--area" rows="3" id="' + id + '" data-f="' + k + '" maxlength="' + (k === 'idea' ? 2000 : 1200) + '"' + (req ? ' required' : '') + '>' + esc(v) + '</textarea>'
      : '<input class="field" id="' + id + '" data-f="' + k + '" type="' + type + '"' + (req ? ' required' : '') + (extra || '') + ' value="' + esc(v) + '" />';
    return '<div class="stack stack--tight"><label class="label" for="' + id + '">' + esc(label) + (req ? '' : ' <span class="small-print">(optional)</span>') + '</label>' + input + '</div>';
  }

  function render() {
    var c = opts.copy.form;
    var t = tier(draft.tier) || opts.tiers.tiers[0];
    box.innerHTML = '<form class="card stack biz-form" novalidate>' +
      field('project', c.project, 'text', true, ' maxlength="120"') +
      field('website', c.website, 'url', true, ' inputmode="url" maxlength="300" placeholder="https://"') +
      field('x', c.x, 'text', false, ' maxlength="60" placeholder="@yourproject"') +
      field('email', c.email, 'email', true, ' maxlength="200" autocomplete="email"') +
      field('product', c.product, 'area', true) +
      (opts.kind === 'toy' ? field('launch', c.launch, 'date', false) : field('launch', c.launch, 'date', false)) +
      '<div class="stack stack--tight"><label class="label" for="bz-tier">' + esc(c.tier) + '</label><select class="field" id="bz-tier" data-f="tier">' +
      opts.tiers.tiers.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === t.id ? ' selected' : '') + '>' + esc(x.name) + ' · ' + money(x.price) + '</option>'; }).join('') + '</select></div>' +
      (opts.extraFields ? opts.extraFields(draft, field) : '') +
      field('idea', c.idea, 'area', false) +
      '<label class="mk-check"><input type="checkbox" data-agree' + (draft.agree ? ' checked' : '') + ' /> <span>' + esc(c.agree) + '</span></label>' +
      '<button type="submit" class="btn btn--ink btn--block">' + esc(c.submit) + '</button>' +
      '<p class="small-print" data-msg aria-live="polite"></p></form><div data-mine></div>';
    var f = box.querySelector('form');
    f.addEventListener('input', keep);
    f.addEventListener('change', keep);
    f.addEventListener('submit', send);
    mine();
  }

  function keep() {
    box.querySelectorAll('[data-f]').forEach(function (el) { draft[el.getAttribute('data-f')] = el.value; });
    draft.agree = box.querySelector('[data-agree]').checked;
    save();
  }

  function say(t) { var m = box.querySelector('[data-msg]'); if (m) m.textContent = t; }

  function send(e) {
    e.preventDefault();
    keep();
    var f = box.querySelector('form');
    var bad = Array.prototype.filter.call(f.querySelectorAll('[data-f]'), function (el) { return !el.checkValidity() || (el.required && !el.value.trim()); })[0];
    if (bad) { say('Please fill in: ' + f.querySelector('label[for="' + bad.id + '"]').textContent.replace(' (optional)', '') + '.'); bad.focus(); return; }
    if (!draft.agree) { say('Please tick the box to agree to how vetting works.'); return; }
    var A = window.Web3Auth;
    if (!A) { say('Requests open soon. Email hi@web3.toys in the meantime.'); return; }
    if (!A.user()) { say(opts.copy.loginNote); A.open(opts.copy.loginNote); return; }
    var btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    say('Sending…');
    var extra = {};
    Object.keys(draft).forEach(function (k) { if (['project', 'website', 'x', 'email', 'product', 'launch', 'tier', 'idea', 'agree'].indexOf(k) < 0) extra[k] = String(draft[k]).slice(0, 1200); });
    extra.agreed = true;
    A.client.rpc('submit_biz_request', {
      p_kind: opts.kind, p_tier: draft.tier || opts.tiers.tiers[0].id, p_project: draft.project.trim(), p_website: (draft.website || '').trim(),
      p_x: (draft.x || '').trim(), p_email: draft.email.trim(), p_product: (draft.product || '').trim(), p_launch: draft.launch || null,
      p_idea: (draft.idea || '').trim(), p_details: extra,
    }).then(function (r) {
      if (r.error) throw r.error;
      var t = tier(draft.tier) || opts.tiers.tiers[0];
      if (site.log) site.log('request', 'biz-' + opts.kind + ':' + t.id);
      draft = { tier: t.id, email: draft.email };
      save();
      after(r.data, t);
    }).catch(function (err) { btn.disabled = false; say('Could not send: ' + err.message); });
  }

  function after(id, t) {
    box.innerHTML = '<section class="card card--yellow stack stack--tight biz-after"><h3 class="title-md">✅ ' + esc(opts.copy.afterTitle) + '</h3>' +
      '<p class="text">' + esc(opts.copy.afterLine) + '</p>' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-deposit>Pay deposit · ' + money(deposit(t)) + '</button>' +
      '<a class="btn" href="' + site.root + 'book-a-call/">Book a call instead</a></div>' +
      '<p class="small-print">' + esc(opts.tiers.depositLine) + ' The rest is due before launch.</p><p class="small-print" data-msg aria-live="polite"></p></section><div data-mine></div>';
    box.querySelector('[data-deposit]').addEventListener('click', function () { pay(t, id, box.querySelector('[data-msg]')); });
    mine();
    box.scrollIntoView({ block: 'start' });
  }

  function pay(t, id, msg) {
    if (!window.Web3Pay) { msg.textContent = 'Payments open soon.'; return; }
    window.Web3Pay.buy('deposit-' + opts.kind + '-' + t.id, id, function () { setTimeout(mine, 1500); setTimeout(mine, 5000); })
      .catch(function (err) { if (err.message !== 'login') msg.textContent = err.message; });
  }

  function mine() {
    var el = box.querySelector('[data-mine]');
    var A = window.Web3Auth;
    if (!el || !A || !A.user()) return;
    A.client.from('biz_requests').select('id,project,tier,status,created_at').eq('kind', opts.kind).order('created_at', { ascending: false }).then(function (r) {
      if (r.error || !r.data || !r.data.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<h3 class="title-sm biz-mine-title">Your requests</h3>' + r.data.map(function (q) {
        var s = STATUS[q.status] || [q.status, ''];
        var t = tier(q.tier);
        return '<article class="card stack stack--tight biz-req"><div class="cap-row"><b>' + esc(q.project) + '</b><span class="chip ' + (q.status === 'declined' || q.status === 'refunded' ? 'is-white' : 'is-mint') + '">' + esc(s[0]) + '</span></div>' +
          '<p class="small-print">' + esc(t ? t.name : q.tier) + ' · sent ' + esc(String(q.created_at).slice(0, 10)) + '</p><p class="small-print">' + esc(s[1]) + '</p>' +
          (q.status === 'submitted' && t ? '<button type="button" class="btn btn--small btn--ink" data-pay-req="' + esc(q.id) + '" data-tier="' + esc(t.id) + '">Pay deposit · ' + money(deposit(t)) + '</button><p class="small-print" data-req-msg></p>' : '') +
          '</article>';
      }).join('');
      el.querySelectorAll('[data-pay-req]').forEach(function (b) {
        b.addEventListener('click', function () { pay(tier(b.getAttribute('data-tier')), b.getAttribute('data-pay-req'), b.parentNode.querySelector('[data-req-msg]')); });
      });
    });
  }

  window.Web3BizRequest = {
    mount: function (el, o) {
      box = el;
      opts = o;
      KEY = 'web3toys.bizDraft.' + o.kind + '.v1';
      try { draft = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { draft = {}; }
      if (o.tier) draft.tier = o.tier;
      var A = window.Web3Auth;
      if (A && A.user() && A.user().email && !draft.email) draft.email = A.user().email;
      render();
      var hook = function () { if (window.Web3Auth) window.Web3Auth.onChange(function () { mine(); }); };
      if (window.Web3Auth) hook(); else document.addEventListener('web3auth:ready', hook, { once: true });
    },
    pick: function (id) {
      draft.tier = id;
      save();
      var sel = box && box.querySelector('[data-f="tier"]');
      if (sel) sel.value = id;
    },
  };
})();
