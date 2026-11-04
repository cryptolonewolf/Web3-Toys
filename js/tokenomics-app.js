// Tokenomics Generator: split a token's supply between groups, add vesting
// and see the split, the monthly unlocks, the circulating supply and the
// warnings. Settings: data/tools/tokenomics.json. Maths:
// js/tokenomics-engine.js. Inputs are remembered in this browser only.

(function () {
  var C = window.Web3Common;
  var E = window.TokenomicsEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var saved = K.store('tokenomics');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/tokenomics.json').then(function (data) {
    cfg = data;
    state = saved.load() || fromTemplate(cfg.templates[0]);
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function fromTemplate(t, keep) {
    var groups = {};
    cfg.groups.forEach(function (g) {
      var v = t.groups[g.id] || { pct: 0, tge: 0, cliff: 0, vest: 0 };
      groups[g.id] = { pct: v.pct, tge: v.tge, cliff: v.cliff, vest: v.vest };
    });
    return {
      name: keep ? keep.name : '',
      ticker: keep ? keep.ticker : '',
      supply: keep ? keep.supply : cfg.defaultSupply,
      groups: groups,
    };
  }

  function list() {
    return cfg.groups.map(function (g) {
      var v = state.groups[g.id];
      return { id: g.id, label: g.label, color: g.color, pct: Number(v.pct) || 0, tge: Number(v.tge) || 0, cliff: Number(v.cliff) || 0, vest: Number(v.vest) || 0 };
    });
  }

  function total() {
    return list().reduce(function (s, g) { return s + g.pct; }, 0);
  }

  function tokens(pct) {
    return K.fmt((state.supply || 0) * pct / 100);
  }

  function vestLine(g) {
    if (!g.pct) return 'Not used';
    if (!g.cliff && !g.vest) return g.tge >= 100 || g.tge === 0 ? 'All unlocked at launch' : g.tge + '% at launch';
    return (g.tge ? g.tge + '% at launch, ' : '') + (g.cliff ? g.cliff + ' mo cliff, ' : '') + (g.vest ? g.vest + ' mo vesting' : 'then all at once');
  }

  // ---------- Page ----------

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Tokenomics Generator</h1>' +
      '<p class="text text--ink">Split your supply, add vesting, and see the unlocks and the red flags as you drag.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">Start from a template</h2><div class="tool-chips">' +
      cfg.templates.map(function (t) { return '<button type="button" class="chip-btn" data-template="' + esc(t.id) + '">' + esc(t.label) + '</button>'; }).join('') + '</div>' +
      '<div class="tool-grid3">' +
      field('tk-name', 'Project name', '<input id="tk-name" class="field" data-basic="name" maxlength="40" placeholder="My Token" value="' + esc(state.name) + '" />') +
      field('tk-ticker', 'Ticker', '<input id="tk-ticker" class="field" data-basic="ticker" maxlength="10" placeholder="MYT" value="' + esc(state.ticker) + '" />') +
      field('tk-supply', 'Total supply', '<input id="tk-supply" class="field" data-basic="supply" inputmode="numeric" value="' + K.fmt(state.supply) + '" />') +
      '</div></section>' +
      '<section class="stack stack--tight"><div class="tk-total" data-total></div>' +
      list().map(groupCard).join('') + '</section>' +
      '<div data-out class="stack"></div>' +
      K.actions() + K.footer();

    app.querySelectorAll('[data-template]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = cfg.templates.filter(function (x) { return x.id === b.getAttribute('data-template'); })[0];
        state = fromTemplate(t, state);
        render();
        site.sound.play('pop');
      });
    });
    app.querySelectorAll('[data-basic]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-basic');
        if (k === 'supply') state.supply = Number(inp.value.replace(/[^0-9]/g, '')) || 0;
        else state[k] = inp.value;
        update();
      });
    });
    app.querySelector('#tk-supply').addEventListener('blur', function (e) { e.target.value = K.fmt(state.supply); });
    app.querySelectorAll('[data-g]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-g');
        var k = inp.getAttribute('data-k');
        var v = Math.max(0, Number(inp.value) || 0);
        if (k === 'pct' || k === 'tge') v = Math.min(100, v);
        state.groups[id][k] = v;
        // Keep the slider and the number box in step.
        if (k === 'pct') app.querySelectorAll('[data-g="' + id + '"][data-k="pct"]').forEach(function (x) { if (x !== inp) x.value = v; });
        update();
      });
    });
    K.bind(app, { pdf: pdf, png: png, copy: copyText, reset: reset });
    update();
  }

  function field(id, label, input) {
    return '<div class="stack stack--tight"><label class="label" for="' + id + '">' + label + '</label>' + input + '</div>';
  }

  function groupCard(g) {
    return '<div class="card tk-group" style="--c:' + g.color + '">' +
      '<div class="tk-row"><span class="tk-dot" aria-hidden="true"></span><label class="title-sm" for="pct-' + g.id + '">' + esc(g.label) + '</label>' +
      '<span class="tk-pct"><input id="pct-' + g.id + '" class="field tk-num" type="number" inputmode="decimal" min="0" max="100" step="0.5" data-g="' + g.id + '" data-k="pct" value="' + g.pct + '" />%</span></div>' +
      '<input class="tk-slider" type="range" min="0" max="100" step="0.5" aria-label="' + esc(g.label) + ' share" data-g="' + g.id + '" data-k="pct" value="' + g.pct + '" />' +
      '<p class="small-print" data-tokens="' + g.id + '"></p>' +
      '<details class="tk-vest"><summary data-vest="' + g.id + '"></summary><div class="tool-grid3">' +
      field('tge-' + g.id, 'At launch (%)', '<input id="tge-' + g.id + '" class="field" type="number" inputmode="decimal" min="0" max="100" data-g="' + g.id + '" data-k="tge" value="' + g.tge + '" />') +
      field('cliff-' + g.id, 'Cliff (months)', '<input id="cliff-' + g.id + '" class="field" type="number" inputmode="numeric" min="0" max="60" data-g="' + g.id + '" data-k="cliff" value="' + g.cliff + '" />') +
      field('vest-' + g.id, 'Vesting (months)', '<input id="vest-' + g.id + '" class="field" type="number" inputmode="numeric" min="0" max="96" data-g="' + g.id + '" data-k="vest" value="' + g.vest + '" />') +
      '</div></details></div>';
  }

  // Redraws everything below the inputs.
  function update() {
    saved.save(state);
    var groups = list();
    var sched = E.schedule(groups, cfg.months);
    var warns = E.warnings(groups, sched, cfg);
    var t = total();
    var off = Math.abs(t - 100) > 0.05;
    app.querySelector('[data-total]').innerHTML =
      '<span class="tk-total-num' + (off ? ' is-off' : '') + '">Total ' + (Math.round(t * 10) / 10) + '%</span>' +
      (off ? '<button type="button" class="btn btn--small btn--yellow" data-balance>Balance to 100%</button>' : '<span class="chip is-mint">Adds up to 100%</span>');
    var bal = app.querySelector('[data-balance]');
    if (bal) bal.addEventListener('click', function () {
      E.balance(list()).forEach(function (g) { state.groups[g.id].pct = g.pct; });
      render();
    });
    groups.forEach(function (g) {
      app.querySelector('[data-tokens="' + g.id + '"]').textContent = tokens(g.pct) + ' tokens';
      app.querySelector('[data-vest="' + g.id + '"]').textContent = 'Vesting: ' + vestLine(g);
    });
    app.querySelector('[data-out]').innerHTML =
      '<section class="card stack stack--tight"><h2 class="title-md">The split</h2><div class="tk-pie-wrap">' + pie(groups) + legend(groups) + '</div></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Monthly unlocks</h2>' +
      '<p class="small-print">At launch: ' + round(sched.total[0]) + '% of the supply. Bars show the share unlocking each month after.</p>' + unlockChart(groups, sched) + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Circulating supply</h2>' +
      '<p class="small-print">' + round(sched.circulating[12]) + '% after 1 year, ' + round(sched.circulating[24]) + '% after 2 years, ' + round(sched.circulating[cfg.months]) + '% after ' + cfg.months / 12 + ' years.</p>' +
      circChart(sched) + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Warnings</h2><ul class="tk-warns">' + warns.map(function (w) {
        return '<li class="tk-warn is-' + w.level + '">' + (w.level === 'good' ? '✓ ' : w.level === 'bad' ? '⚠ ' : '! ') + esc(w.text) + '</li>';
      }).join('') + '</ul></section>';
  }

  function round(n) {
    return Math.round(n * 10) / 10;
  }

  // ---------- Charts (SVG, so they also go into the PDF and PNG) ----------

  function pie(groups) {
    var used = groups.filter(function (g) { return g.pct > 0; });
    var sum = used.reduce(function (s, g) { return s + g.pct; }, 0) || 1;
    var a = -Math.PI / 2;
    var paths = used.map(function (g) {
      var b = a + (g.pct / sum) * Math.PI * 2;
      var p = used.length === 1
        ? '<circle cx="100" cy="100" r="90" fill="' + g.color + '" stroke="#1F1B2E" stroke-width="4"/>'
        : '<path d="M100 100 L' + (100 + 90 * Math.cos(a)).toFixed(2) + ' ' + (100 + 90 * Math.sin(a)).toFixed(2) + ' A90 90 0 ' + (b - a > Math.PI ? 1 : 0) + ' 1 ' +
          (100 + 90 * Math.cos(b)).toFixed(2) + ' ' + (100 + 90 * Math.sin(b)).toFixed(2) + 'Z" fill="' + g.color + '" stroke="#1F1B2E" stroke-width="4" stroke-linejoin="round"/>';
      a = b;
      return p;
    }).join('');
    return '<svg class="tk-pie" viewBox="0 0 200 200" role="img" aria-label="Pie chart of the split">' + (paths || '<circle cx="100" cy="100" r="90" fill="#F1E9CF" stroke="#1F1B2E" stroke-width="4"/>') + '</svg>';
  }

  function legend(groups) {
    return '<ul class="tk-legend">' + groups.map(function (g) {
      return '<li><span class="tk-dot" style="--c:' + g.color + '"></span>' + esc(g.label) + ' <b>' + g.pct + '%</b></li>';
    }).join('') + '</ul>';
  }

  function unlockChart(groups, sched) {
    var W = 640;
    var H = 230;
    var pad = { l: 40, r: 10, t: 12, b: 28 };
    var months = cfg.months;
    var max = Math.max.apply(null, sched.total.slice(1).concat([1]));
    var bw = (W - pad.l - pad.r) / months;
    var y = function (v) { return (v / max) * (H - pad.t - pad.b); };
    var bars = '';
    for (var m = 1; m <= months; m++) {
      var base = H - pad.b;
      groups.forEach(function (g) {
        var v = sched.byGroup[g.id][m];
        if (v <= 0) return;
        var h = y(v);
        base -= h;
        bars += '<rect x="' + (pad.l + (m - 1) * bw + 1).toFixed(1) + '" y="' + base.toFixed(1) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + g.color + '" stroke="#1F1B2E" stroke-width="0.8"/>';
      });
    }
    return '<svg class="tk-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Monthly unlocks for ' + months + ' months">' +
      axes(W, H, pad, months, round(max) + '%') + bars + '</svg>';
  }

  function circChart(sched) {
    var W = 640;
    var H = 200;
    var pad = { l: 40, r: 10, t: 12, b: 28 };
    var months = cfg.months;
    var x = function (m) { return pad.l + (m / months) * (W - pad.l - pad.r); };
    var y = function (v) { return H - pad.b - (Math.min(100, v) / 100) * (H - pad.t - pad.b); };
    var d = sched.circulating.map(function (v, m) { return (m ? 'L' : 'M') + x(m).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
    var grid = [25, 50, 75].map(function (v) {
      return '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#D9D2B8" stroke-dasharray="4 4"/><text x="' + (pad.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="11" font-family="Nunito, sans-serif" fill="#5A5470">' + v + '%</text>';
    }).join('');
    return '<svg class="tk-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Circulating supply over ' + months + ' months">' +
      axes(W, H, pad, months, '100%') + grid +
      '<path d="' + d + ' L' + x(months) + ' ' + (H - pad.b) + ' L' + x(0) + ' ' + (H - pad.b) + 'Z" fill="#FFD93D" opacity=".45"/>' +
      '<path d="' + d + '" fill="none" stroke="#1F1B2E" stroke-width="3" stroke-linejoin="round"/></svg>';
  }

  function axes(W, H, pad, months, topLabel) {
    var ticks = '';
    for (var m = 0; m <= months; m += 12) {
      var x = pad.l + (m / months) * (W - pad.l - pad.r);
      var anchor = m === 0 ? 'start' : m + 12 > months ? 'end' : 'middle';
      ticks += '<text x="' + x.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="' + anchor + '" font-size="12" font-family="Nunito, sans-serif" fill="#5A5470">' + (m ? 'Month ' + m : 'Launch') + '</text>';
    }
    return '<rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' +
      '<line x1="' + pad.l + '" x2="' + pad.l + '" y1="' + pad.t + '" y2="' + (H - pad.b) + '" stroke="#1F1B2E" stroke-width="2"/>' +
      '<line x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (H - pad.b) + '" y2="' + (H - pad.b) + '" stroke="#1F1B2E" stroke-width="2"/>' +
      '<text x="' + (pad.l - 6) + '" y="' + (pad.t + 10) + '" text-anchor="end" font-size="11" font-family="Nunito, sans-serif" fill="#5A5470">' + topLabel + '</text>' + ticks;
  }

  // ---------- Exports ----------

  function title() {
    return (state.name || 'My token') + (state.ticker ? ' ($' + state.ticker.replace(/^\$/, '') + ')' : '');
  }

  function copyText() {
    var groups = list();
    var sched = E.schedule(groups, cfg.months);
    return title() + ' tokenomics\n' +
      'Total supply: ' + K.fmt(state.supply) + '\n\n' +
      groups.map(function (g) { return g.label + ': ' + g.pct + '% (' + tokens(g.pct) + ' tokens). ' + vestLine(g) + '.'; }).join('\n') +
      '\n\nCirculating: ' + round(sched.total[0]) + '% at launch, ' + round(sched.circulating[12]) + '% after 1 year, ' + round(sched.circulating[24]) + '% after 2 years.' +
      '\n\nWarnings:\n' + E.warnings(groups, sched, cfg).map(function (w) { return '- ' + w.text; }).join('\n') +
      '\n\n' + K.footLine();
  }

  function sheetTable(groups) {
    return '<table class="tk-table"><thead><tr><th>Group</th><th>Share</th><th>Tokens</th><th>Vesting</th></tr></thead><tbody>' +
      groups.map(function (g) {
        return '<tr><td><span class="tk-dot" style="--c:' + g.color + '"></span>' + esc(g.label) + '</td><td>' + g.pct + '%</td><td>' + tokens(g.pct) + '</td><td>' + esc(vestLine(g)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function pdf() {
    var groups = list();
    var sched = E.schedule(groups, cfg.months);
    K.printSheet(
      '<h1>' + esc(title()) + ': tokenomics</h1><p>Total supply: <b>' + K.fmt(state.supply) + '</b></p>' +
      '<div class="print-row">' + pie(groups) + sheetTable(groups) + '</div>' +
      '<h2>Monthly unlocks</h2>' + unlockChart(groups, sched) +
      '<h2>Circulating supply</h2>' + circChart(sched) +
      '<h2>Warnings</h2><ul>' + E.warnings(groups, sched, cfg).map(function (w) { return '<li>' + esc(w.text) + '</li>'; }).join('') + '</ul>'
    );
    C.track('tool_export', { tool: 'tokenomics', format: 'pdf' });
  }

  function png() {
    var groups = list();
    var sched = E.schedule(groups, cfg.months);
    var warns = E.warnings(groups, sched, cfg);
    var W = 1240;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var rowsH = groups.length * 44;
    var H = 260 + Math.max(420, rowsH + 60) + 480 + 400 + 70 + warns.length * 40 + 90;
    canvas.width = W;
    canvas.height = H;
    Promise.all([K.svgImage(pie(groups)), K.svgImage(unlockChart(groups, sched)), K.svgImage(circChart(sched))]).then(function (imgs) {
      ctx.fillStyle = '#FFF8E1';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1F1B2E';
      ctx.font = '700 54px Fredoka, Nunito, sans-serif';
      ctx.fillText(title(), 60, 100);
      ctx.font = '800 28px Nunito, sans-serif';
      ctx.fillText('Tokenomics · total supply ' + K.fmt(state.supply), 60, 150);
      var y = 200;
      if (imgs[0]) ctx.drawImage(imgs[0], 60, y, 380, 380);
      ctx.font = '800 24px Nunito, sans-serif';
      groups.forEach(function (g, i) {
        var ry = y + 30 + i * 44;
        ctx.fillStyle = g.color;
        ctx.fillRect(480, ry - 20, 22, 22);
        ctx.strokeStyle = '#1F1B2E';
        ctx.lineWidth = 2;
        ctx.strokeRect(480, ry - 20, 22, 22);
        ctx.fillStyle = '#1F1B2E';
        ctx.fillText(g.label + '  ' + g.pct + '%', 515, ry);
        ctx.font = '700 20px Nunito, sans-serif';
        ctx.fillText(vestLine(g), 800, ry);
        ctx.font = '800 24px Nunito, sans-serif';
      });
      y += Math.max(420, rowsH + 60);
      ctx.font = '700 34px Fredoka, Nunito, sans-serif';
      ctx.fillText('Monthly unlocks', 60, y);
      if (imgs[1]) ctx.drawImage(imgs[1], 60, y + 20, 1120, 402);
      y += 480;
      ctx.fillText('Circulating supply', 60, y);
      if (imgs[2]) ctx.drawImage(imgs[2], 60, y + 20, 1120, 350);
      y += 420;
      ctx.fillText('Warnings', 60, y);
      ctx.font = '700 22px Nunito, sans-serif';
      warns.forEach(function (w, i) { ctx.fillText('• ' + w.text, 60, y + 44 + i * 40); });
      ctx.font = '700 20px Nunito, sans-serif';
      ctx.fillStyle = '#5A5470';
      ctx.fillText(K.footLine(), 60, H - 40);
      K.downloadCanvas(canvas, (state.ticker || 'token').toLowerCase() + '-tokenomics.png');
      C.track('tool_export', { tool: 'tokenomics', format: 'png' });
    });
  }

  function reset() {
    saved.clear();
    state = fromTemplate(cfg.templates[0]);
    render();
  }
})();
