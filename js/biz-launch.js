// /launch-your-toy/: Launch Your Own Toy, for web3 projects. Built with the
// For Projects kit (js/biz-kit.js). Words: data/business/launch_page.json.
// Prices, the guarantee and add-ons: data/business/toy_tiers.json.
// Until business.live is on in config.js, visitors see a short note.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var K = window.Web3BizKit;
  var app = document.getElementById('app');
  var P, T, ctl;

  if (!site.businessOn()) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">For projects</p><h1 class="title-lg">Launch Your Own Toy</h1>' +
      '<p class="text text--ink">Coming soon: a playable toy about your product, built by web3.toys.</p><a class="btn btn--ink" href="../book-a-call/">Book a call to hear more</a></section>';
    return;
  }

  function tier(id) { return T.tiers.filter(function (t) { return t.id === id; })[0] || T.tiers[0]; }
  function deposit(t) { return Number(t.depositUsd) > 0 ? Number(t.depositUsd) : Math.round(t.price * (Number(T.deposit) || 0.5) * 100) / 100; }

  Promise.all([C.loadJson('../data/business/launch_page.json'), C.loadJson('../data/business/toy_tiers.json')]).then(function (r) {
    P = r[0]; T = r[1];
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function examples() {
    return K.section(esc(P.examplesTitle) + ' <span class="bk-tag">Example concepts</span>', '<p class="small-print">' + esc(P.examplesLine) + '</p><ul class="bk-examples">' + P.examples.map(function (x) {
      return '<li class="bk-example is-' + esc(x.color) + '"><div class="bk-example-head"><span aria-hidden="true">' + x.icon + '</span><div><b>' + esc(x.name) + '</b><span class="small-print">' + esc(x.for) + '</span></div></div>' +
        '<div class="demo" data-demo="' + esc(x.id) + '"><button type="button" class="btn btn--small btn--ink" data-play="' + esc(x.id) + '">▶ Play the demo</button></div></li>';
    }).join('') + '</ul>', 'bk-examples-sec');
  }

  function render() {
    var addons = (T.addons || []).map(function (a) { return esc(a.name) + ' ' + (a.price ? K.money(a.price) : '(' + esc(a.note || 'quoted') + ')'); }).join(' · ');
    app.innerHTML =
      K.pair(K.hero(P, '<a class="btn" href="#pricing">See prices</a>'), K.list(P.getTitle, P.get)) +
      examples() +
      K.pricing(P.pricingTitle, T.tiers, {
        label: T.popularLabel, guarantee: T.guarantee,
        note: function (t) { return K.money(deposit(t)) + ' deposit reserves your slot.'; },
        extra: addons ? '<p class="small-print"><b>Add-ons:</b> ' + addons + '</p>' : '',
      }) +
      K.pair(K.steps(P.stepsTitle, P.steps), K.video(P.video)) +
      K.compare(P.compareTitle, P.compare) +
      K.who(P.who) +
      K.cases(P.caseTitle, P.caseStudies) +
      K.pair(K.faq(P.faqTitle, P.faq), K.section(esc(P.formTitle), '<div data-form></div><div data-mine></div>', 'bk-request', 'request')) +
      '<p class="tool-disclaimer">web3.toys does not endorse any token. No token rewards, ever. Not financial advice.</p>';

    ctl = K.form(app.querySelector('[data-form]'), {
      kind: 'toy', key: 'toy', choiceLabel: P.form.tier, copy: P.form, thanks: Object.assign({ payNote: T.depositLine }, P.thanks), loginNote: P.loginNote,
      choices: T.tiers.map(function (t) { return { id: t.id, name: t.name, price: t.price, popular: t.popular }; }),
      fields: [
        { k: 'project', label: P.form.project, req: true, max: 120 },
        { k: 'website', label: P.form.website, type: 'url', req: true, max: 300, placeholder: 'https://' },
        { k: 'x', label: P.form.x, max: 60, placeholder: '@yourproject' },
        { k: 'launch', label: P.form.launch, type: 'date' },
        { k: 'idea', label: P.form.idea, type: 'area', max: 2000 },
      ],
      submit: function (d) {
        return window.Web3Auth.client.rpc('submit_biz_request', {
          p_kind: 'toy', p_tier: tier(d.tier).id, p_project: d.project.trim(), p_website: d.website.trim(), p_x: (d.x || '').trim(), p_email: d.email.trim(),
          p_product: '', p_launch: d.launch || null, p_idea: (d.idea || '').trim(), p_details: { contact: d.name.trim(), agreed: true },
        }).then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      payLabel: function (d) { return P.thanks.deposit + ' · ' + K.money(deposit(tier(d.tier))); },
      pay: function (d, id, msg) { pay(tier(d.tier), id, msg); },
      after: mine,
    });
    if (new URLSearchParams(location.search).get('resume')) { ctl.resume(); K.scrollTo(document.getElementById('request')); }
    app.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () { ctl.pick(b.getAttribute('data-tier')); K.scrollTo(document.getElementById('request')); });
    });
    app.querySelectorAll('[data-play]').forEach(function (b) {
      b.addEventListener('click', function () { C.track('biz_demo', { demo: b.getAttribute('data-play') }); Web3BizDemos.play(b.getAttribute('data-play'), b.parentNode); });
    });
    mine();
    K.sticky(app, P.stickyCta);
  }

  function pay(t, id, msg) {
    if (!window.Web3Pay) { msg.textContent = 'Payments open soon.'; return; }
    window.Web3Pay.buy('deposit-toy-' + t.id, id, function () { setTimeout(mine, 1500); setTimeout(mine, 5000); })
      .catch(function (err) { if (err.message !== 'login') msg.textContent = err.message; });
  }

  var STATUS = { submitted: 'Waiting for your deposit or call', paid: 'Deposit paid: slot reserved', in_review: 'We are checking your project', approved: 'Approved: we start soon', building: 'We are building it', live: 'Your toy is live', declined: 'Declined: deposit refunded', refunded: 'Deposit refunded' };
  function mine() {
    var el = app.querySelector('[data-mine]');
    var A = window.Web3Auth;
    if (!el || !A || !A.user()) return;
    A.client.from('biz_requests').select('id,project,tier,status,created_at').eq('kind', 'toy').order('created_at', { ascending: false }).then(function (r) {
      if (r.error || !r.data || !r.data.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<h3 class="title-sm bk-mine-h">Your requests</h3><ul class="bk-mine">' + r.data.map(function (q) {
        var t = tier(q.tier);
        return '<li><div><b>' + esc(q.project) + '</b><span class="small-print">' + esc(t.name) + ' · ' + esc(STATUS[q.status] || q.status) + '</span></div>' +
          (q.status === 'submitted' ? '<button type="button" class="btn btn--small btn--ink" data-pay-req="' + esc(q.id) + '" data-tier="' + esc(t.id) + '">Deposit · ' + K.money(deposit(t)) + '</button>' : '') + '</li>';
      }).join('') + '</ul><p class="small-print" data-req-msg></p>';
      el.querySelectorAll('[data-pay-req]').forEach(function (b) {
        b.addEventListener('click', function () { pay(tier(b.getAttribute('data-tier')), b.getAttribute('data-pay-req'), el.querySelector('[data-req-msg]')); });
      });
    });
  }
})();
