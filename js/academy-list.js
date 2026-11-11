// The List your Quest page (academy/list-your-project/), built with the For
// Projects kit (js/biz-kit.js). Words: data/academy/listing.json. Packages:
// data/work.json (points) with prices from data/products.json (course-4,
// course-6, course-8). Requests go to project_requests (submit_request,
// supabase/009_work_with_us.sql) and are paid in full (refunded if declined).

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var K = window.Web3BizKit;
  var app = document.getElementById('app');
  var L, tiers, ctl;

  Promise.all([C.loadJson('../../data/academy/listing.json'), C.loadJson('../../data/work.json'), C.loadJson('../../data/products.json')]).then(function (r) {
    L = r[0];
    var prices = {};
    r[2].products.forEach(function (p) { prices[p.id] = p; });
    tiers = r[1].packages.filter(function (p) { return p.kind === 'course' && prices[p.product]; }).map(function (p, i, all) {
      return { id: p.product, name: p.name.replace(/^Quest:\s*/, ''), price: prices[p.product].usd, features: p.points || [], popular: i === Math.floor(all.length / 2) };
    });
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function tier(id) { return tiers.filter(function (t) { return t.id === id; })[0] || tiers[0]; }

  function render() {
    app.innerHTML =
      K.pair(K.hero(L, '<a class="btn" href="#pricing">See prices</a>'), K.list(L.getTitle, L.get)) +
      K.pricing(L.pricingTitle, tiers, { label: L.popularLabel, guarantee: L.guarantee, note: function () { return 'Paid upfront, refunded in full if we decline.'; } }) +
      K.pair(K.steps(L.stepsTitle, L.steps), K.list(L.checkTitle, L.checklist.map(function (x) { return ['✔️', x]; }))) +
      K.pair(K.list(L.rulesTitle, L.rules.map(function (x) { return ['📌', x]; })),
        K.section(esc(L.templateTitle), '<p class="small-print">' + esc(L.templateLine) + '</p><div class="btn-row"><a class="btn btn--small" href="../../assets/academy/course-template.md" download>Template (text)</a><a class="btn btn--small" href="../../assets/academy/course-template.json" download>Template (JSON)</a></div>')) +
      K.pair(K.who(L.who), K.faq(L.faqTitle, L.faq)) +
      K.cases(L.caseTitle, L.caseStudies) +
      K.section(esc(L.formTitle), '<div data-form></div><div data-mine></div>', 'bk-request', 'request') +
      '<p class="tool-disclaimer">web3.toys does not endorse any token. No token rewards, ever. Not financial advice.</p>';

    ctl = K.form(app.querySelector('[data-form]'), {
      kind: 'course', key: 'course', choiceLabel: L.form.tier, copy: L.form, thanks: L.thanks, loginNote: L.loginNote,
      choices: tiers,
      fields: [
        { k: 'project', label: L.form.project, req: true, max: 120 },
        { k: 'website', label: L.form.website, type: 'url', req: true, max: 300, placeholder: 'https://' },
        { k: 'x', label: L.form.x, max: 60, placeholder: '@yourproject' },
        { k: 'note', label: L.form.note, type: 'area', max: 1000 },
      ],
      submit: function (d) {
        return window.Web3Auth.client.rpc('submit_request', {
          p_kind: 'course', p_tier: tier(d.tier).id, p_project: d.project.trim(), p_email: d.email.trim(), p_website: d.website.trim(), p_x: (d.x || '').trim(),
          p_details: { contact: d.name.trim(), learn: (d.note || '').trim() },
        }).then(function (r) { if (r.error) throw r.error; return r.data; });
      },
      payLabel: function (d) { var t = tier(d.tier); return L.thanks.deposit + ' · ' + K.money(t.price); },
      pay: function (d, id, msg) { pay(tier(d.tier), id, msg); },
      after: mine,
    });
    if (new URLSearchParams(location.search).get('resume')) { ctl.resume(); K.scrollTo(document.getElementById('request')); }
    app.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () { ctl.pick(b.getAttribute('data-tier')); K.scrollTo(document.getElementById('request')); });
    });
    mine();
    K.sticky(app, L.stickyCta);
  }

  function pay(t, id, msg) {
    if (!window.Web3Pay) { msg.textContent = 'Payments open soon.'; return; }
    window.Web3Pay.buy(t.id, id, function () { setTimeout(mine, 1500); setTimeout(mine, 5000); })
      .catch(function (err) { if (err.message !== 'login') msg.textContent = err.message; });
  }

  var STATUS = { submitted: 'Waiting for payment or our call', paid: 'Paid: we are vetting your project', in_review: 'We are checking your project', approved: 'Approved: writing the lessons', live: 'Your Quest is live', declined: 'Declined: refunded in full' };
  function mine() {
    var el = app.querySelector('[data-mine]');
    var A = window.Web3Auth;
    if (!el || !A || !A.user()) return;
    A.client.from('project_requests').select('id,project,tier,status,created_at').eq('kind', 'course').order('created_at', { ascending: false }).then(function (r) {
      if (r.error || !r.data || !r.data.length) { el.innerHTML = ''; return; }
      el.innerHTML = '<h3 class="title-sm bk-mine-h">Your requests</h3><ul class="bk-mine">' + r.data.map(function (q) {
        var t = tier(q.tier);
        return '<li><div><b>' + esc(q.project) + '</b><span class="small-print">' + esc(t.name) + ' · ' + esc(STATUS[q.status] || q.status) + '</span></div>' +
          (q.status === 'submitted' ? '<button type="button" class="btn btn--small btn--ink" data-pay-req="' + esc(q.id) + '" data-tier="' + esc(t.id) + '">Pay · ' + K.money(t.price) + '</button>' : '') + '</li>';
      }).join('') + '</ul><p class="small-print" data-req-msg></p>';
      el.querySelectorAll('[data-pay-req]').forEach(function (b) {
        b.addEventListener('click', function () { pay(tier(b.getAttribute('data-tier')), b.getAttribute('data-pay-req'), el.querySelector('[data-req-msg]')); });
      });
    });
  }
})();
