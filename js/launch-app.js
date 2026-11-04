// Launch Readiness Checklist: about 30 scored checks across token, legal,
// security, community, marketing and liquidity; a score, a score per area,
// the gaps, and the full report and Book a Call buttons.
// Settings: data/tools/launch-checklist.json. Maths: js/launch-engine.js.

(function () {
  var C = window.Web3Common;
  var E = window.LaunchEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('launch-checklist');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/launch-checklist.json').then(function (data) {
    cfg = data;
    state = saved.load() || { answers: {} };
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Launch Readiness Checklist</h1>' +
      '<p class="text text--ink">Answer ' + cfg.checks.length + ' quick checks. Get a readiness score and the gaps to fix before launch.</p>' + K.notes() + '</section>' +
      '<p class="lc-progress" data-progress aria-live="polite"></p>' +
      cfg.categories.map(function (cat) {
        return '<section class="card stack stack--tight"><h2 class="title-md">' + cat.emoji + ' ' + esc(cat.label) + '</h2>' +
          cfg.checks.filter(function (c) { return c.category === cat.id; }).map(function (c) {
            return '<div class="lc-check"><p class="lc-text" id="lc-' + c.id + '">' + esc(c.text) + '</p><p class="small-print">' + esc(c.why) + '</p>' +
              '<div class="lc-seg" role="radiogroup" aria-labelledby="lc-' + c.id + '">' + cfg.answers.map(function (a) {
                var on = state.answers[c.id] === a.id;
                return '<button type="button" role="radio" class="lc-btn lc-btn--' + a.id + (on ? ' is-on' : '') + '" aria-checked="' + on + '" data-q="' + c.id + '" data-a="' + a.id + '">' + esc(a.label) + '</button>';
              }).join('') + '</div></div>';
          }).join('') + '</section>';
      }).join('') +
      '<div data-out class="stack"></div>' +
      K.actions() + K.footer();

    app.querySelectorAll('[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-q');
        state.answers[q] = b.getAttribute('data-a');
        app.querySelectorAll('[data-q="' + q + '"]').forEach(function (o) {
          var on = o === b;
          o.classList.toggle('is-on', on);
          o.setAttribute('aria-checked', String(on));
        });
        window.WEB3TOYS.sound.play('tick');
        update();
      });
    });
    K.bind(app, K.sheetHandlers(model, 'launch-readiness.png', { reset: function () { saved.clear(); state = { answers: {} }; render(); } }));
    update();
  }

  // The paid Full Launch Readiness Report: every check, its status, why it
  // matters and how to fix it, gaps first (sold through js/offers.js).
  function fullReport() {
    var r = E.score(state.answers, cfg);
    var cats = {};
    cfg.categories.forEach(function (c) { cats[c.id] = c; });
    var ans = function (c) { return { yes: 'Yes', partly: 'Partly', no: 'No' }[state.answers[c.id]] || 'Not answered'; };
    var gapIds = r.gaps.map(function (g) { return g.id; });
    K.printSheet(
      '<h1>Full Launch Readiness Report</h1>' +
      '<p><b>Score ' + r.score + ' / 100: ' + esc(r.grade.label) + '.</b> ' + esc(r.grade.line) + '</p>' +
      areaBars(r.categories) +
      '<h2>Your plan: fix these first</h2><ol>' + r.gaps.map(function (g) {
        var c = cfg.checks.filter(function (x) { return x.id === g.id; })[0];
        return '<li><p><b>' + esc(cats[g.category].label) + ': ' + esc(c.text) + '</b> (' + ans(c) + ', worth ' + c.weight + ' points)</p><p>Why: ' + esc(c.why) + '</p><p>How to fix: ' + esc(c.fix || '') + '</p></li>';
      }).join('') + '</ol>' +
      '<h2>Already in place</h2><ul>' + cfg.checks.filter(function (c) { return gapIds.indexOf(c.id) < 0; }).map(function (c) {
        return '<li>' + esc(cats[c.category].label) + ': ' + esc(c.text) + '</li>';
      }).join('') + '</ul>' +
      '<p>Go through the plan from the top: the first items are worth the most points.</p>'
    );
    C.track('tool_export', { tool: 'launch-checklist', format: 'full-report' });
  }
  window.WEB3TOYS.deliver('launch-report', fullReport);

  function dial(total, color) {
    var r = 70;
    var len = 2 * Math.PI * r;
    return '<svg class="kol-dial" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" role="img" aria-label="Score ' + total + ' out of 100">' +
      '<circle cx="90" cy="90" r="' + r + '" fill="#FFFFFF" stroke="#F1E9CF" stroke-width="20"/>' +
      '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="20" stroke-linecap="round" stroke-dasharray="' + (len * total / 100).toFixed(1) + ' ' + len.toFixed(1) + '" transform="rotate(-90 90 90)"/>' +
      '<circle cx="90" cy="90" r="80" fill="none" stroke="#1F1B2E" stroke-width="3"/><circle cx="90" cy="90" r="60" fill="none" stroke="#1F1B2E" stroke-width="3"/>' +
      '<text x="90" y="100" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="44" fill="#1F1B2E">' + total + '</text>' +
      '<text x="90" y="124" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="13" fill="#5A5470">out of 100</text></svg>';
  }

  function areaBars(cats) {
    var W = 400;
    var rowH = 34;
    var labelW = 130;
    var H = cats.length * rowH + 8;
    var color = function (p) { return p >= 85 ? '#6BCB77' : p >= 65 ? '#FFD23F' : p >= 40 ? '#FF9F45' : '#FF6B6B'; };
    return '<svg class="tk-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Score per area"><rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' +
      cats.map(function (c, i) {
        var y = 6 + i * rowH;
        var w = (W - labelW - 50) * c.pct / 100;
        return '<text x="0" y="' + (y + 17) + '" font-family="Nunito, sans-serif" font-weight="800" font-size="15" fill="#1F1B2E">' + esc(c.label) + '</text>' +
          '<rect x="' + labelW + '" y="' + y + '" width="' + (W - labelW - 50) + '" height="22" rx="11" fill="#F1E9CF" stroke="#1F1B2E" stroke-width="2"/>' +
          (w > 0 ? '<rect x="' + labelW + '" y="' + y + '" width="' + Math.max(22, w).toFixed(1) + '" height="22" rx="11" fill="' + color(c.pct) + '" stroke="#1F1B2E" stroke-width="2"/>' : '') +
          '<text x="' + (W - 4) + '" y="' + (y + 17) + '" text-anchor="end" font-family="Nunito, sans-serif" font-weight="800" font-size="15" fill="#1F1B2E">' + c.pct + '%</text>';
      }).join('') + '</svg>';
  }

  function gapLabel(g) {
    return g.answer === 'partly' ? 'Partly' : g.answer === 'no' ? 'No' : 'Not answered';
  }

  function update() {
    saved.save(state);
    var r = E.score(state.answers, cfg);
    app.querySelector('[data-progress]').textContent = r.answered + ' of ' + r.count + ' answered';
    var cats = {};
    cfg.categories.forEach(function (c) { cats[c.id] = c; });
    app.querySelector('[data-out]').innerHTML =
      '<section class="card stack stack--tight"><div class="kol-top">' + dial(r.score, r.grade.color) +
      '<div class="stack stack--tight"><p class="kol-grade" style="--c:' + r.grade.color + '">' + esc(r.grade.label) + '</p><p class="text text--ink">' + esc(r.grade.line) + '</p>' +
      (r.answered < r.count ? '<p class="small-print">Unanswered checks count as gaps.</p>' : '') + '</div></div>' + areaBars(r.categories) + '</section>' +
      (r.gaps.length ? '<section class="card stack stack--tight"><h2 class="title-md">Your gaps, biggest first</h2><ol class="lc-gaps">' + r.gaps.map(function (g) {
        return '<li><div class="kol-line"><span>' + cats[g.category].emoji + '</span><b>' + esc(g.text) + '</b><span class="lc-tag lc-tag--' + (g.answer || 'none') + '">' + gapLabel(g) + '</span></div><p class="small-print">' + esc(g.why) + '</p></li>';
      }).join('') + '</ol></section>' : '<p class="tk-warn is-good">No gaps. Every check is a yes.</p>');
  }

  function model() {
    var r = E.score(state.answers, cfg);
    var cats = {};
    cfg.categories.forEach(function (c) { cats[c.id] = c; });
    return {
      title: 'Launch readiness: ' + r.score + ' / 100',
      subtitle: r.grade.label + '. ' + r.grade.line,
      facts: [['Checks answered', r.answered + ' of ' + r.count], ['Gaps', String(r.gaps.length)]],
      table: { head: ['Area', 'Score'], rows: r.categories.map(function (c) { return [c.label, c.pct + '%']; }) },
      charts: [areaBars(r.categories)],
      sections: r.gaps.length ? [{ title: 'Gaps, biggest first', lines: r.gaps.map(function (g) { return cats[g.category].label + ': ' + g.text + ' (' + gapLabel(g) + ')'; }) }] : [],
    };
  }
})();
