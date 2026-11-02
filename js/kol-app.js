// KOL Vetting Scorecard: public numbers about a creator in, a score out of
// 100 with reasons and red flags, plus a KOL deal ROI box. Not a list of
// real people. Settings: data/tools/kol-scorecard.json. Maths: js/kol-engine.js.

(function () {
  var C = window.Web3Common;
  var E = window.KolEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('kol-scorecard');
  var cfg = null;
  var state = null;

  var INPUTS = [
    ['followers', 'Followers', 'numeric'],
    ['likes', 'Average likes per post', 'numeric'],
    ['replies', 'Average replies per post', 'numeric'],
    ['growth', 'Follower growth per month (%)', 'decimal'],
    ['paidShare', 'Posts that are paid promos (%)', 'decimal'],
    ['promoted', 'Tokens they promoted before', 'numeric'],
    ['died', 'Of those, how many died', 'numeric'],
  ];
  var ROI = [
    ['cost', 'Cost per post ($)', 'decimal'],
    ['viewPct', 'Followers who will see it (%)', 'decimal'],
    ['clickPct', 'Viewers who will click (%)', 'decimal'],
  ];

  C.loadJson('../../data/tools/kol-scorecard.json').then(function (data) {
    cfg = data;
    state = saved.load() || JSON.parse(JSON.stringify(cfg.defaults));
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function num(v) {
    var s = String(v).replace(/[^0-9.-]/g, '');
    return Number(s) || 0;
  }

  function field(f) {
    return '<div class="stack stack--tight"><label class="label" for="kol-' + f[0] + '">' + esc(f[1]) + '</label>' +
      '<input id="kol-' + f[0] + '" class="field" inputmode="' + f[2] + '" data-in="' + f[0] + '" value="' + K.fmt(state[f[0]]) + '" /></div>';
  }

  function render() {
    var disc = cfg.checks.filter(function (c) { return c.options; })[0];
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">KOL Vetting Scorecard</h1>' +
      '<p class="text text--ink">Type the public numbers of a creator you are thinking of paying. Get a score, the reasons and the red flags.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Their numbers</h2><p class="small-print">Look at their last 10 to 20 posts. Nothing you type leaves this page.</p>' +
      '<div class="tool-grid3">' + INPUTS.map(field).join('') + '</div>' +
      '<p class="label">' + esc(disc.label) + '</p><div class="tool-chips" role="radiogroup" aria-label="' + esc(disc.label) + '">' + disc.options.map(function (o) {
        return '<button type="button" role="radio" class="chip-btn' + (state.disclosure === o.id ? ' is-on' : '') + '" aria-checked="' + (state.disclosure === o.id) + '" data-disc="' + o.id + '">' + esc(o.label) + '</button>';
      }).join('') + '</div></section>' +
      '<div data-out class="stack"></div>' +
      '<section class="card stack stack--tight"><h2 class="title-md">KOL deal ROI</h2><div class="tool-grid3">' + ROI.map(field).join('') + '</div><div data-roi></div>' +
      '<p class="small-print">' + esc(cfg.roiLine) + '</p></section>' +
      K.actions() + K.footer();

    app.querySelectorAll('[data-in]').forEach(function (inp) {
      inp.addEventListener('input', function () { state[inp.getAttribute('data-in')] = num(inp.value); update(); });
      inp.addEventListener('blur', function () { inp.value = K.fmt(state[inp.getAttribute('data-in')]); });
    });
    app.querySelectorAll('[data-disc]').forEach(function (b) {
      b.addEventListener('click', function () { state.disclosure = b.getAttribute('data-disc'); render(); window.WEB3TOYS.sound.play('tick'); });
    });
    K.bind(app, K.sheetHandlers(model, 'kol-scorecard.png', { reset: function () { saved.clear(); state = JSON.parse(JSON.stringify(cfg.defaults)); render(); } }));
    update();
  }

  function shown(x) {
    if (x.value == null) return 'no data';
    if (typeof x.value === 'string') return x.value;
    return (Math.round(x.value * 100) / 100) + (x.unit || '');
  }

  function dial(total, color) {
    var r = 70;
    var len = 2 * Math.PI * r;
    return '<svg class="kol-dial" viewBox="0 0 180 180" role="img" aria-label="Score ' + total + ' out of 100">' +
      '<circle cx="90" cy="90" r="' + r + '" fill="#FFFFFF" stroke="#F1E9CF" stroke-width="20"/>' +
      '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="20" stroke-linecap="round" stroke-dasharray="' + (len * total / 100).toFixed(1) + ' ' + len.toFixed(1) + '" transform="rotate(-90 90 90)"/>' +
      '<circle cx="90" cy="90" r="' + (r + 10) + '" fill="none" stroke="#1F1B2E" stroke-width="3"/><circle cx="90" cy="90" r="' + (r - 10) + '" fill="none" stroke="#1F1B2E" stroke-width="3"/>' +
      '<text x="90" y="100" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="44" fill="#1F1B2E">' + total + '</text>' +
      '<text x="90" y="124" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="13" fill="#5A5470">out of 100</text></svg>';
  }

  function money(n) {
    return n == null ? '—' : '$' + (n < 10 ? n.toFixed(2) : K.fmt(Math.round(n)));
  }

  function update() {
    saved.save(state);
    var s = E.score(state, cfg);
    var r = E.roi(state);
    app.querySelector('[data-out]').innerHTML =
      '<section class="card stack stack--tight kol-score"><div class="kol-top">' + dial(s.total, s.grade.color) +
      '<div class="stack stack--tight"><p class="kol-grade" style="--c:' + s.grade.color + '">' + esc(s.grade.label) + '</p><p class="text text--ink">' + esc(s.grade.line) + '</p></div></div></section>' +
      (s.flags.length ? '<section class="card kol-flags stack stack--tight"><h2 class="title-md">🚩 Red flags</h2><ul class="kol-list">' +
        s.flags.map(function (x) { return '<li>' + esc(x.reason) + '</li>'; }).join('') + '</ul></section>' : '') +
      '<section class="card stack stack--tight"><h2 class="title-md">Why this score</h2><ul class="kol-reasons">' +
      s.items.map(function (x) {
        return '<li class="' + (x.flag ? 'is-bad' : x.points === x.max ? 'is-good' : '') + '"><div class="kol-line"><b>' + esc(x.label) + '</b><span>' + esc(shown(x)) + '</span><span class="kol-pts">' + x.points + ' / ' + x.max + '</span></div><p class="small-print">' + esc(x.reason) + '</p></li>';
      }).join('') + '</ul></section>';
    app.querySelector('[data-roi]').innerHTML = '<div class="mc-results">' +
      '<div class="card mc-big is-blue"><p class="label">Expected views</p><p class="mc-value">' + K.fmt(r.views) + '</p></div>' +
      '<div class="card mc-big is-mint"><p class="label">Expected clicks</p><p class="mc-value">' + K.fmt(r.clicks) + '</p></div>' +
      '<div class="card mc-big is-coral"><p class="label">Cost per 1,000 views</p><p class="mc-value">' + money(r.cpm) + '</p></div>' +
      '<div class="card mc-big"><p class="label">Cost per click</p><p class="mc-value">' + money(r.cpc) + '</p></div></div>';
  }

  function model() {
    var s = E.score(state, cfg);
    var r = E.roi(state);
    return {
      title: 'KOL scorecard: ' + s.total + ' / 100',
      subtitle: s.grade.label + '. ' + s.grade.line,
      facts: [['Followers', K.fmt(state.followers)], ['Engagement rate', (Math.round(s.metrics.engagement * 100) / 100) + '%'], ['Cost per post', money(state.cost)],
        ['Expected views', K.fmt(r.views)], ['Expected clicks', K.fmt(r.clicks)], ['Cost per click', money(r.cpc)]],
      table: { head: ['Check', 'Value', 'Points'], rows: s.items.map(function (x) { return [x.label, shown(x), x.points + ' / ' + x.max]; }) },
      sections: (s.flags.length ? [{ title: 'Red flags', lines: s.flags.map(function (x) { return x.reason; }) }] : [])
        .concat([{ title: 'Why this score', lines: s.items.map(function (x) { return x.label + ': ' + x.reason; }) }, { title: 'About the ROI', lines: [cfg.roiLine] }]),
    };
  }
})();
