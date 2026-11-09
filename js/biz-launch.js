// /launch-your-toy/: Launch Your Own Toy, for web3 projects.
// Words: data/business/launch_page.json. Prices: data/business/toy_tiers.json.
// Until business.live is on in config.js (planned for December), visitors
// see a short "coming in December" note; preview with ?preview-business=1.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');

  function money(n) { var f = Number(n) % 1 ? 2 : 0; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }); }

  if (!site.businessOn()) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">For projects</p><h1 class="title-lg">Launch Your Own Toy</h1>' +
      '<p class="text text--ink">Coming in December: a playable toy about your product, built by web3.toys.</p>' +
      '<a class="btn btn--ink" href="../book-a-call/">Book a call to hear more</a></section>';
    return;
  }

  Promise.all([C.loadJson('../data/business/launch_page.json'), C.loadJson('../data/business/toy_tiers.json')]).then(function (r) {
    render(r[0], r[1]);
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function render(P, T) {
    var share = Math.round((Number(T.deposit) || 0.5) * 100);
    app.innerHTML =
      '<section class="biz-hero stack"><p class="label">' + esc(P.label) + '</p><h1 class="biz-title">' + esc(P.title) + '</h1>' +
      '<ul class="biz-why">' + P.why.map(function (w) {
        return '<li class="card"><span class="biz-why-icon" aria-hidden="true">' + w.icon + '</span><b>' + esc(w.title) + '</b><span class="small-print">' + esc(w.text) + '</span></li>';
      }).join('') + '</ul>' +
      '<div class="btn-row"><a class="btn btn--ink" href="#request">Request your toy</a><a class="btn" href="#pricing">See prices</a></div></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.examplesTitle) + '</h2><p class="small-print">' + esc(P.examplesLine) + '</p>' +
      '<ul class="biz-examples">' + P.examples.map(function (x) {
        return '<li class="card biz-example biz-example--' + esc(x.color) + '"><span class="chip biz-tag">Example concept</span>' +
          '<div class="biz-example-head"><span class="biz-example-icon" aria-hidden="true">' + x.icon + '</span><div><h3 class="title-sm">' + esc(x.name) + '</h3><p class="small-print">' + esc(x.for) + '</p></div></div>' +
          '<p class="text">' + esc(x.pitch) + '</p><div class="demo" data-demo="' + esc(x.id) + '"><button type="button" class="btn btn--small btn--ink" data-play="' + esc(x.id) + '">▶ Play the 30 second demo</button></div></li>';
      }).join('') + '</ul></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.benefitsTitle) + '</h2><ul class="perk-grid">' + P.benefits.map(function (b) {
        return '<li><div class="card perk"><span class="icon-badge" aria-hidden="true">' + b.icon + '</span><div class="stack stack--tight"><h3 class="title-sm">' + esc(b.title) + '</h3><p class="text">' + esc(b.text) + '</p></div></div></li>';
      }).join('') + '</ul></section>' +

      '<section class="stack stack--tight" id="pricing"><h2 class="section-title">' + esc(P.pricingTitle) + '</h2><ul class="biz-tiers">' + T.tiers.map(function (t) {
        return '<li class="card biz-tier' + (t.popular ? ' is-popular' : '') + '">' + (t.popular ? '<span class="chip is-yellow biz-popular">Most popular</span>' : '') +
          '<h3 class="title-md">' + esc(t.name) + '</h3><p class="biz-price">' + money(t.price) + '</p><p class="small-print">' + esc(t.time) + '</p>' +
          '<ul class="biz-feats">' + t.features.map(function (f) { return '<li>' + site.icon('check') + '<span>' + esc(f) + '</span></li>'; }).join('') + '</ul>' +
          '<button type="button" class="btn btn--block' + (t.popular ? ' btn--ink' : '') + '" data-tier="' + esc(t.id) + '">Choose ' + esc(t.name) + '</button>' +
          '<p class="small-print">' + share + '% deposit (' + money(Math.round(t.price * share) / 100) + ') reserves your slot.</p></li>';
      }).join('') + '</ul>' +
      '<p class="small-print biz-addons"><b>Add-ons:</b> ' + T.addons.map(function (a) { return esc(a.name) + ' ' + (a.price ? money(a.price) : '(' + esc(a.note || 'quoted on request') + ')'); }).join(' · ') + '</p></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.stepsTitle) + '</h2><ol class="biz-steps">' + P.steps.map(function (s, i) {
        return '<li class="card"><span class="biz-step-n">' + (i + 1) + '</span><b>' + esc(s.title) + '</b><span class="small-print">' + esc(s.text) + '</span></li>';
      }).join('') + '</ol></section>' +

      '<section class="stack stack--tight"><h2 class="section-title">' + esc(P.faqTitle) + '</h2><div class="biz-faq">' + P.faq.map(function (f) {
        return '<details class="card"><summary><b>' + esc(f.q) + '</b></summary><p class="text">' + esc(f.a) + '</p></details>';
      }).join('') + '</div></section>' +

      '<section class="stack stack--tight" id="request"><h2 class="section-title">' + esc(P.formTitle) + '</h2><div data-form></div></section>' +
      '<p class="tool-disclaimer">web3.toys does not endorse any token. No token rewards, ever. Not financial advice.</p>';

    app.querySelectorAll('[data-play]').forEach(function (b) {
      b.addEventListener('click', function () {
        var demo = b.parentNode;
        C.track('biz_demo', { demo: b.getAttribute('data-play') });
        Web3BizDemos.play(b.getAttribute('data-play'), demo);
      });
    });
    Web3BizRequest.mount(app.querySelector('[data-form]'), { kind: 'toy', tiers: T, copy: P, tier: new URLSearchParams(location.search).get('tier') });
    app.querySelectorAll('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () {
        Web3BizRequest.pick(b.getAttribute('data-tier'));
        document.getElementById('request').scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }
})();
