// /test-your-product/: Test Your Product, for web3 projects. Built with the
// For Projects kit (js/biz-kit.js). Words: data/business/test_page.json.
// Prices, deposits, the guarantee and the founding offer: test_tiers.json.
// Until business.live is on in config.js, visitors see a short note.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var K = window.Web3BizKit;
  var app = document.getElementById('app');
  var P, T, ctl;

  if (!site.businessOn()) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">For projects</p><h1 class="title-lg">Test Your Product</h1>' +
      '<p class="text text--ink">Coming soon: real web3 players test your product before launch.</p><a class="btn btn--ink" href="../book-a-call/">Book a call to hear more</a></section>';
    return;
  }

  function tier(id) { return T.tiers.filter(function (t) { return t.id === id; })[0] || T.tiers[0]; }
  function deposit(t) { return Number(t.depositUsd) > 0 ? Number(t.depositUsd) : Math.round(t.price * (Number(T.deposit) || 0.5) * 100) / 100; }
  function foundingOn() { var f = T.foundingOffer; return !!(f && f.on === true && Number(f.left) > 0); }
  function foundingDeposit(t) { return Math.round(deposit(t) * (1 - Number(T.foundingOffer.discount)) * 100) / 100; }

  Promise.all([C.loadJson('../data/business/test_page.json'), C.loadJson('../data/business/test_tiers.json')]).then(function (r) {
    P = r[0]; T = r[1];
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function preview() {
    var R = Web3TestReport.build(P.sample.test, P.sample.runs);
    var secs = function (n) { return n >= 60 ? Math.floor(n / 60) + 'm ' + Math.round(n % 60) + 's' : Math.round(n) + 's'; };
    var quotes = [];
    R.tasks.forEach(function (t) { t.comments.forEach(function (c) { if (c.outcome !== 'done') quotes.push({ text: c.text, task: t.title, outcome: c.outcome }); }); });
    return K.section(esc(P.previewTitle) + ' <span class="bk-tag">' + esc(P.sampleLabel) + '</span>',
      '<ul class="bk-bars">' + R.tasks.map(function (t) {
        return '<li><span class="bk-task">' + esc(t.title) + '</span><span class="bk-bar" role="img" aria-label="' + t.rate + ' percent finished"><i style="width:' + t.rate + '%"></i></span><b>' + t.rate + '%</b><span class="small-print">' + (t.time ? secs(t.time) : '-') + '</span></li>';
      }).join('') + '</ul>' +
      '<ul class="bk-quotes">' + quotes.slice(0, 3).map(function (q) { return '<li>“' + esc(q.text) + '”<span class="small-print">' + esc(q.task) + ' · ' + (q.outcome === 'stuck' ? 'got stuck' : 'gave up') + '</span></li>'; }).join('') + '</ul>' +
      '<button type="button" class="text-button" data-full-sample>' + esc(P.sampleLink) + ' →</button>', 'bk-preview');
  }

  function render() {
    var found = foundingOn();
    app.innerHTML =
      K.banner(T.foundingOffer) +
      K.pair(K.hero(P, '<a class="btn" href="#pricing">See prices</a>'), preview()) +
      K.pricing(P.pricingTitle, T.tiers, {
        label: T.popularLabel, guarantee: T.guarantee,
        note: function (t) { return K.money(deposit(t)) + ' deposit reserves your slot.' + (found ? ' Founding: ' + K.money(foundingDeposit(t)) + '.' : ''); },
      }) +
      K.pair(K.steps(P.stepsTitle, P.steps), K.list('🔒 ' + P.safeTitle, P.confidential.map(function (x) { return ['🤐', x]; }).concat(P.rules.map(function (x) { return ['🛡️', x]; })))) +
      K.compare(P.compareTitle, P.compare) +
      K.pair(K.video(P.video), K.who(P.who)) +
      K.cases(P.caseTitle, P.caseStudies) +
      K.pair(K.faq(P.faqTitle, P.faq), K.section(esc(P.formTitle), '<div data-form></div><div data-mine></div>', 'bk-request', 'request')) +
      '<p class="bk-foot">🧪 <b>' + esc(P.testerTitle) + '.</b> ' + esc(P.testerLine) + ' <a href="../testers/">Become a tester →</a></p>';

    ctl = K.form(app.querySelector('[data-form]'), {
      kind: 'test', key: 'test', choiceLabel: P.form.tier, copy: P.form, thanks: Object.assign({ payNote: T.depositLine }, P.thanks), loginNote: P.loginNote,
      choices: T.tiers.map(function (t) { return { id: t.id, name: t.name, price: t.price, popular: t.popular }; }),
      founding: found,
      fields: [
        { k: 'project', label: P.form.project, req: true, max: 120 },
        { k: 'link', label: P.form.link, type: 'url', req: true, max: 300, placeholder: 'https://' },
        { k: 'launch', label: P.form.launch, type: 'date' },
        { k: 'note', label: P.form.note, type: 'area', max: 1000 },
      ],
      submit: function (d) {
        var t = tier(d.tier);
        return window.Web3Auth.client.rpc('submit_biz_request', {
          p_kind: 'test', p_tier: t.id, p_project: d.project.trim(), p_website: d.link.trim(), p_x: '', p_email: d.email.trim(),
          p_product: '', p_launch: d.launch || null, p_idea: (d.note || '').trim(),
          p_details: { testLink: d.link.trim(), contact: d.name.trim(), founding: !!(d.founding && foundingOn()), agreed: true },
        }).then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      payLabel: function (d) { var t = tier(d.tier); return P.thanks.deposit + ' · ' + K.money(d.founding && foundingOn() ? foundingDeposit(t) : deposit(t)); },
      pay: function (d, id, msg) { pay(tier(d.tier), id, !!(d.founding && foundingOn()), msg); },
      after: mine,
    });
    if (new URLSearchParams(location.search).get('resume')) { ctl.resume(); K.scrollTo(document.getElementById('request')); }
    bind();
    mine();
    K.sticky(app, P.stickyCta);
  }

  function pay(t, id, founding, msg) {
    if (!window.Web3Pay) { msg.textContent = 'Payments open soon.'; return; }
    window.Web3Pay.buy('deposit-test-' + t.id + (founding ? '-founding' : ''), id, function () { setTimeout(mine, 1500); setTimeout(mine, 5000); })
      .catch(function (err) { if (err.message !== 'login') msg.textContent = err.message; });
  }

  var STATUS = { submitted: 'Waiting for your deposit or call', paid: 'Deposit paid: slot reserved', in_review: 'We are checking your project', approved: 'Approved: setting up your test', building: 'Setting up your test', live: 'Your test is running', declined: 'Declined: deposit refunded', refunded: 'Deposit refunded' };
  function mine() {
    var el = app.querySelector('[data-mine]');
    var A = window.Web3Auth;
    if (!el || !A || !A.user()) return;
    A.client.from('biz_requests').select('id,project,tier,status,created_at,details').eq('kind', 'test').order('created_at', { ascending: false }).then(function (r) {
      if (r.error || !r.data || !r.data.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<h3 class="title-sm bk-mine-h">Your requests</h3><ul class="bk-mine">' + r.data.map(function (q) {
        var t = tier(q.tier);
        var founding = !!(q.details && q.details.founding);
        return '<li><div><b>' + esc(q.project) + '</b><span class="small-print">' + esc(t.name) + ' · ' + esc(STATUS[q.status] || q.status) + '</span></div>' +
          (q.status === 'submitted' ? '<button type="button" class="btn btn--small btn--ink" data-pay-req="' + esc(q.id) + '" data-tier="' + esc(t.id) + '"' + (founding ? ' data-founding' : '') + '>Deposit · ' + K.money(founding && foundingOn() ? foundingDeposit(t) : deposit(t)) + '</button>' : '') + '</li>';
      }).join('') + '</ul><p class="small-print" data-req-msg></p>';
      el.querySelectorAll('[data-pay-req]').forEach(function (b) {
        b.addEventListener('click', function () { pay(tier(b.getAttribute('data-tier')), b.getAttribute('data-pay-req'), b.hasAttribute('data-founding') && foundingOn(), el.querySelector('[data-req-msg]')); });
      });
    });
  }

  function bind() {
    app.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () { ctl.pick(b.getAttribute('data-tier')); K.scrollTo(document.getElementById('request')); });
    });
    var ap = app.querySelector('[data-apply-founding]');
    if (ap) ap.addEventListener('click', function () { ctl.founding(); K.scrollTo(document.getElementById('request')); });
    app.querySelector('[data-full-sample]').addEventListener('click', function () { K.modal(Web3TestReport.html(P.sample.test, P.sample.runs, { sample: true }), 'Sample report'); });
  }
})();
