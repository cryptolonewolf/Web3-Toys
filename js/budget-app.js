// Launch Budget Planner: split a raise across eight budget lines, see each
// line against its typical range, a donut, months of runway and warnings.
// Settings: data/tools/budget_ranges.json. Maths: js/budget-engine.js.

(function () {
  var C = window.Web3Common;
  var B = window.BudgetEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('launch-budget');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/budget_ranges.json').then(function (data) {
    cfg = data;
    state = saved.load() || fromTemplate(cfg.templates[1]);
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function fromTemplate(t) {
    var split = {};
    cfg.lines.forEach(function (l) { split[l.id] = t.split[l.id] || 0; });
    return { raise: t.raise, burn: t.burn, split: split };
  }

  function num(v) {
    return Number(String(v).replace(/[^0-9.]/g, '')) || 0;
  }

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Launch Budget Planner</h1>' +
      '<p class="text text--ink">Split your raise across the costs of a launch, see how each line compares with a typical range, and how long your runway lasts.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">Start from a template</h2><div class="tool-chips">' +
      cfg.templates.map(function (t) { return '<button type="button" class="chip-btn" data-template="' + esc(t.id) + '">' + esc(t.label) + '</button>'; }).join('') + '</div>' +
      '<div class="tool-grid3">' +
      '<div class="stack stack--tight"><label class="label" for="bd-raise">Total raise ($)</label><input id="bd-raise" class="field" inputmode="numeric" data-in="raise" value="' + K.fmt(state.raise) + '" /></div>' +
      '<div class="stack stack--tight"><label class="label" for="bd-burn">Monthly team cost ($)</label><input id="bd-burn" class="field" inputmode="numeric" data-in="burn" value="' + K.fmt(state.burn) + '" /></div>' +
      '</div></section>' +
      '<section class="stack stack--tight"><div class="tk-total" data-total></div>' + cfg.lines.map(lineCard).join('') + '</section>' +
      '<p class="small-print">' + esc(cfg.note) + '</p>' +
      '<div data-out class="stack"></div>' +
      K.actions() + K.footer();

    app.querySelectorAll('[data-template]').forEach(function (b) {
      b.addEventListener('click', function () {
        state = fromTemplate(cfg.templates.filter(function (t) { return t.id === b.getAttribute('data-template'); })[0]);
        render();
        window.WEB3TOYS.sound.play('pop');
      });
    });
    app.querySelectorAll('[data-in]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        state[inp.getAttribute('data-in')] = num(inp.value);
        update();
      });
      inp.addEventListener('blur', function () { inp.value = K.fmt(state[inp.getAttribute('data-in')]); });
    });
    app.querySelectorAll('[data-line]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-line');
        var v = Math.min(100, Math.max(0, Number(inp.value) || 0));
        state.split[id] = v;
        app.querySelectorAll('[data-line="' + id + '"]').forEach(function (x) { if (x !== inp) x.value = v; });
        update();
      });
    });
    K.bind(app, K.sheetHandlers(sheet, 'launch-budget.png', { reset: reset }));
    update();
  }

  function lineCard(l) {
    var v = state.split[l.id] || 0;
    return '<div class="card tk-group" style="--c:' + l.color + '">' +
      '<div class="tk-row"><span class="tk-dot" aria-hidden="true"></span><label class="title-sm" for="ln-' + l.id + '">' + esc(l.label) + '</label>' +
      '<span class="chip" data-state="' + l.id + '"></span>' +
      '<span class="tk-pct"><input id="ln-' + l.id + '" class="field tk-num" type="number" inputmode="decimal" min="0" max="100" step="0.5" data-line="' + l.id + '" value="' + v + '" />%</span></div>' +
      '<div class="bd-slider"><span class="bd-band" style="left:' + l.min + '%;width:' + (l.max - l.min) + '%" title="Typical ' + l.min + ' to ' + l.max + '%"></span>' +
      '<input class="tk-slider" type="range" min="0" max="100" step="0.5" aria-label="' + esc(l.label) + ' share" data-line="' + l.id + '" value="' + v + '" /></div>' +
      '<p class="small-print" data-amount="' + l.id + '"></p></div>';
  }

  function total() {
    return cfg.lines.reduce(function (s, l) { return s + (state.split[l.id] || 0); }, 0);
  }

  function update() {
    saved.save(state);
    var t = total();
    var off = Math.abs(t - 100) > 0.05;
    app.querySelector('[data-total]').innerHTML =
      '<span class="tk-total-num' + (off ? ' is-off' : '') + '">Total ' + Math.round(t * 10) / 10 + '%</span>' +
      (off ? '<button type="button" class="btn btn--small btn--yellow" data-balance>Balance to 100%</button>' : '<span class="chip is-mint">Adds up to 100%</span>');
    var bal = app.querySelector('[data-balance]');
    if (bal) bal.addEventListener('click', balance);
    cfg.lines.forEach(function (l) {
      var v = state.split[l.id] || 0;
      var st = B.status(v, l);
      var chip = app.querySelector('[data-state="' + l.id + '"]');
      chip.textContent = st === 'ok' ? 'Typical' : st === 'below' ? 'Below typical' : 'Above typical';
      chip.className = 'chip ' + (st === 'ok' ? 'is-mint' : 'is-yellow');
      app.querySelector('[data-amount="' + l.id + '"]').textContent = K.usd(state.raise * v / 100) + ' · typical ' + l.min + ' to ' + l.max + '%';
    });
    var months = B.runway(state.raise, state.split, state.burn);
    app.querySelector('[data-out]').innerHTML =
      '<section class="card stack stack--tight"><h2 class="title-md">Where the money goes</h2><div class="tk-pie-wrap">' + donut() + K.legend(legendItems()) + '</div></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Runway</h2>' + gauge(months) +
      '<p class="text text--ink">' + (months == null ? 'Add a monthly team cost to see your runway.' : 'Team and runway reserve last about <strong>' + Math.round(months * 10) / 10 + ' months</strong> at ' + K.usd(state.burn) + ' a month.') + '</p></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Warnings</h2><ul class="tk-warns">' + B.warnings(state.raise, state.split, state.burn, cfg).map(function (w) {
        return '<li class="tk-warn is-' + w.level + '">' + (w.level === 'good' ? '✓ ' : w.level === 'bad' ? '⚠ ' : '! ') + esc(w.text) + '</li>';
      }).join('') + '</ul></section>';
  }

  function legendItems() {
    return cfg.lines.map(function (l) { return { label: l.label, color: l.color, note: (state.split[l.id] || 0) + '%' }; });
  }

  function donut() {
    return K.donut(cfg.lines.map(function (l) { return { value: state.split[l.id] || 0, color: l.color }; }));
  }

  // A fuel gauge from 0 to 36 months, red when short, green when healthy.
  function gauge(months) {
    var maxM = 36;
    var v = months == null ? 0 : Math.min(maxM, months);
    var ang = function (m) { return Math.PI + (m / maxM) * Math.PI; };
    var pt = function (m, r) { return [(160 + r * Math.cos(ang(m))).toFixed(1), (150 + r * Math.sin(ang(m))).toFixed(1)]; };
    var arc = function (a, b, color) {
      var s = pt(a, 110);
      var e = pt(b, 110);
      return '<path d="M' + s[0] + ' ' + s[1] + ' A110 110 0 0 1 ' + e[0] + ' ' + e[1] + '" fill="none" stroke="' + color + '" stroke-width="26"/>';
    };
    var n = pt(v, 92);
    return '<svg class="bd-gauge" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" role="img" aria-label="Runway gauge: ' + (months == null ? 'unknown' : Math.round(v)) + ' months">' +
      arc(0, cfg.runway.short, '#FF6B6B') + arc(cfg.runway.short, cfg.runway.healthy, '#FFD93D') + arc(cfg.runway.healthy, maxM, '#6BCB77') +
      '<path d="M50 150 A110 110 0 0 1 270 150" fill="none" stroke="#1F1B2E" stroke-width="3"/>' +
      '<line x1="160" y1="150" x2="' + n[0] + '" y2="' + n[1] + '" stroke="#1F1B2E" stroke-width="7" stroke-linecap="round"/>' +
      '<circle cx="160" cy="150" r="12" fill="#FFD93D" stroke="#1F1B2E" stroke-width="4"/>' +
      '<text x="40" y="172" font-family="Nunito, sans-serif" font-weight="800" font-size="13" fill="#5A5470">0</text>' +
      '<text x="270" y="172" font-family="Nunito, sans-serif" font-weight="800" font-size="13" fill="#5A5470">36 mo</text>' +
      '<text x="160" y="96" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="30" fill="#1F1B2E" stroke="#FFFFFF" stroke-width="6" paint-order="stroke">' + (months == null ? '?' : Math.round(months * 10) / 10) + '</text></svg>';
  }

  function balance() {
    var t = total() || 1;
    cfg.lines.forEach(function (l) { state.split[l.id] = Math.round(((state.split[l.id] || 0) / t) * 200) / 2; });
    var diff = 100 - total();
    state.split.team = Math.round((state.split.team + diff) * 2) / 2;
    render();
  }

  function sheet() {
    var months = B.runway(state.raise, state.split, state.burn);
    return {
      title: 'Launch budget',
      subtitle: 'Total raise ' + K.usd(state.raise) + ' · monthly team cost ' + K.usd(state.burn),
      facts: [['Runway', months == null ? 'Not set' : Math.round(months * 10) / 10 + ' months'], ['Total', Math.round(total() * 10) / 10 + '%']],
      table: { head: ['Line', 'Share', 'Amount', 'Typical'], rows: cfg.lines.map(function (l) {
        var v = state.split[l.id] || 0;
        return [l.label, v + '%', K.usd(state.raise * v / 100), l.min + ' to ' + l.max + '%'];
      }) },
      charts: [donut()],
      sections: [{ title: 'Warnings', lines: B.warnings(state.raise, state.split, state.burn, cfg).map(function (w) { return w.text; }) }, { title: 'Note', lines: [cfg.note] }],
    };
  }

  function reset() {
    saved.clear();
    state = fromTemplate(cfg.templates[1]);
    render();
  }
})();
