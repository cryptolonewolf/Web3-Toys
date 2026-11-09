// /test-your-product/: Test Your Product, for web3 projects.
// Words: data/business/test_page.json. Prices: data/business/test_tiers.json.
// Until business.live is on in config.js, visitors see a short "coming soon"
// note; preview with ?preview-business=1.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');

  function money(n) { var f = Number(n) % 1 ? 2 : 0; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }); }

  if (!site.businessOn()) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">For projects</p><h1 class="title-lg">Test Your Product</h1>' +
      '<p class="text text--ink">Coming in December: real web3 players test your product before launch.</p>' +
      '<a class="btn btn--ink" href="../book-a-call/">Book a call to hear more</a></section>';
    return;
  }

  Promise.all([C.loadJson('../data/business/test_page.json'), C.loadJson('../data/business/test_tiers.json')]).then(function (r) {
    render(r[0], r[1]);
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function extraFields(P) {
    return function (draft, field) {
      return field('testLink', P.testLink, 'url', true, ' inputmode="url" maxlength="300" placeholder="https://"') +
        field('tasks', P.testTasks, 'area', true) +
        field('network', 'Network (for example Sepolia, Base Sepolia, Solana devnet)', 'text', false, ' maxlength="80"');
    };
  }

  function render(P, T) {
    var share = Math.round((Number(T.deposit) || 0.5) * 100);
    app.innerHTML =
      '<section class="biz-hero stack"><p class="label">' + esc(P.label) + '</p><h1 class="biz-title">' + esc(P.title) + '</h1>' +
      '<p class="text text--ink">' + esc(P.intro) + '</p>' +
      '<div class="btn-row"><a class="btn btn--ink" href="#request">Request a test</a><a class="btn" href="#sample">See a sample report</a></div></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.benefitsTitle) + '</h2><ul class="perk-grid">' + P.benefits.map(function (b) {
        return '<li><div class="card perk"><span class="icon-badge" aria-hidden="true">' + b.icon + '</span><div class="stack stack--tight"><h3 class="title-sm">' + esc(b.title) + '</h3><p class="text">' + esc(b.text) + '</p></div></div></li>';
      }).join('') + '</ul></section>' +

      '<section class="stack stack--tight" id="sample"><h2 class="section-title">' + esc(P.sampleTitle) + '</h2><p class="small-print">' + esc(P.sampleLine) + '</p>' +
      '<details class="card trep-wrap"><summary><b>📄 Open the sample report</b></summary>' + Web3TestReport.html(P.sample.test, P.sample.runs, { sample: true }) + '</details></section>' +

      '<section class="stack stack--tight" id="pricing"><h2 class="section-title">' + esc(P.pricingTitle) + '</h2><ul class="biz-tiers">' + T.tiers.map(function (t) {
        return '<li class="card biz-tier' + (t.popular ? ' is-popular' : '') + '">' + (t.popular ? '<span class="chip is-yellow biz-popular">Most popular</span>' : '') +
          '<h3 class="title-md">' + esc(t.name) + '</h3><p class="biz-price">' + money(t.price) + '</p><p class="small-print">' + esc(t.time) + '</p>' +
          '<ul class="biz-feats">' + t.features.map(function (f) { return '<li>' + site.icon('check') + '<span>' + esc(f) + '</span></li>'; }).join('') + '</ul>' +
          '<button type="button" class="btn btn--block' + (t.popular ? ' btn--ink' : '') + '" data-tier="' + esc(t.id) + '">Choose ' + esc(t.name) + '</button>' +
          '<p class="small-print">' + share + '% deposit (' + money(Math.round(t.price * share) / 100) + ') reserves your slot.</p></li>';
      }).join('') + '</ul></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.stepsTitle) + '</h2><ol class="biz-steps">' + P.steps.map(function (s, i) {
        return '<li class="card"><span class="biz-step-n">' + (i + 1) + '</span><b>' + esc(s.title) + '</b><span class="small-print">' + esc(s.text) + '</span></li>';
      }).join('') + '</ol></section>' +

      '<section class="card biz-safe stack stack--tight"><h2 class="title-md">🛡️ ' + esc(P.rulesTitle) + '</h2><ul class="biz-feats">' + P.rules.map(function (r) {
        return '<li>' + site.icon('check') + '<span>' + esc(r) + '</span></li>';
      }).join('') + '</ul></section>' +

      '<section class="stack stack--tight" id="request"><h2 class="section-title">Request a test</h2><div data-form></div></section>' +

      '<section class="card card--yellow stack stack--tight"><h2 class="title-md">🧪 ' + esc(P.testerTitle) + '</h2><p class="text">' + esc(P.testerLine) + '</p>' +
      '<a class="btn btn--ink" href="../testers/">Become a tester</a></section>' +
      '<p class="tool-disclaimer">web3.toys does not endorse any token. No token rewards, ever. Not financial advice.</p>';

    Web3BizRequest.mount(app.querySelector('[data-form]'), { kind: 'test', tiers: T, copy: P, tier: new URLSearchParams(location.search).get('tier'), extraFields: extraFields(P) });
    app.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () {
        Web3BizRequest.pick(b.getAttribute('data-tier'));
        document.getElementById('request').scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }
})();
