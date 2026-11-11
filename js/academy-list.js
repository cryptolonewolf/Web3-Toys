// The List your project page for the Quests. Words come from
// data/academy/listing.json; the price and the form link from config.js.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var CONFIG = (window.WEB3TOYS_CONFIG || {}).academy || {};
  var app = document.getElementById('app');

  C.loadJson('../../data/academy/listing.json').then(function (L) {
    var apply = '<a class="btn btn--ink btn--block" href="../../work-with-us/?kind=course" data-apply>' + esc(L.applyButton) + '</a>';
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><p class="label">Quests</p><h1 class="tool-title">' + esc(L.title) + '</h1>' +
      '<p class="text text--ink">' + esc(L.intro) + '</p></section>' +
      '<h2 class="section-title">' + esc(L.benefitsTitle) + '</h2><ul class="perk-grid">' + L.benefits.map(function (b) {
        return '<li><div class="card perk"><span class="icon-badge">' + site.icon(b.icon) + '</span><div class="stack stack--tight"><h3 class="title-sm">' + esc(b.title) + '</h3><p class="text">' + esc(b.text) + '</p></div></div></li>';
      }).join('') + '</ul>' +
      '<section class="card stack stack--tight"><h2 class="title-md">' + esc(L.checklistTitle) + '</h2><p class="small-print">' + esc(L.checklistLine) + '</p>' +
      '<ul class="ac-checklist">' + L.checklist.map(function (c) { return '<li>' + site.icon('check') + '<span>' + esc(c) + '</span></li>'; }).join('') + '</ul></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">' + esc(L.rulesTitle) + '</h2><ul class="lesson-points">' +
      L.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">' + esc(L.templateTitle) + '</h2><p class="text">' + esc(L.templateLine) + '</p>' +
      '<div class="btn-row"><a class="btn" href="../../assets/academy/course-template.md" download>Template (text)</a>' +
      '<a class="btn" href="../../assets/academy/course-template.json" download>Template (JSON)</a></div></section>' +
      '<section class="card card--yellow stack stack--tight"><h2 class="title-md">' + esc(L.priceTitle) + '</h2>' +
      '<p class="price">' + esc(CONFIG.price || L.priceEmpty) + '</p><p class="small-print">' + esc(L.priceLine) + '</p>' + apply + '<p class="small-print" data-msg aria-live="polite"></p></section>' +
      '<p class="tool-disclaimer">web3.toys does not endorse any token. Not financial advice.</p>';
    app.querySelector('[data-apply]').addEventListener('click', function () {
      C.track('academy_apply_clicked');
    });
  }).catch(function (err) { app.innerHTML = C.loadError(err); });
})();
