// Cap Table and Dilution Simulator: founders, then rounds (SAFE, priced
// round, SAFT, token warrants); ownership after each round as stacked bars,
// plus the token split when there are SAFTs or warrants.
// Settings: data/tools/cap-table.json. Maths: js/cap-engine.js.

(function () {
  var C = window.Web3Common;
  var E = window.CapEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('cap-table');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/cap-table.json').then(function (data) {
    cfg = data;
    state = saved.load() || defaults();
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function defaults() {
    return { founders: JSON.parse(JSON.stringify(cfg.founders)), rounds: JSON.parse(JSON.stringify(cfg.rounds)) };
  }

  function num(v) {
    return Number(String(v).replace(/[^0-9.]/g, '')) || 0;
  }

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Cap Table and Dilution Simulator</h1>' +
      '<p class="text text--ink">Add the founders, then each round. See who owns what after every round, and who gets tokens.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Founders</h2><div class="stack stack--tight">' +
      state.founders.map(function (f, i) {
        return '<div class="cap-row"><label class="sr-only" for="fn-' + i + '">Founder ' + (i + 1) + ' name</label><input id="fn-' + i + '" class="field" data-f="' + i + '" data-k="name" maxlength="30" value="' + esc(f.name) + '" />' +
          '<span class="tk-pct"><label class="sr-only" for="fp-' + i + '">Share</label><input id="fp-' + i + '" class="field tk-num" type="number" inputmode="decimal" min="0" max="100" data-f="' + i + '" data-k="pct" value="' + f.pct + '" />%</span>' +
          '<button type="button" class="cap-x" data-del-f="' + i + '" aria-label="Remove ' + esc(f.name) + '"' + (state.founders.length < 2 ? ' disabled' : '') + '>×</button></div>';
      }).join('') + '</div>' +
      (state.founders.length < 8 ? '<button type="button" class="btn btn--small" data-add-f>+ Add a founder</button>' : '') + '</section>' +
      '<section class="stack stack--tight"><h2 class="section-title">Rounds, in order</h2>' + state.rounds.map(roundCard).join('') +
      '<div class="tool-chips">' + Object.keys(cfg.types).map(function (t) { return '<button type="button" class="chip-btn" data-add-r="' + t + '">+ ' + esc(cfg.types[t].label) + '</button>'; }).join('') + '</div></section>' +
      '<p class="small-print">' + esc(cfg.note) + '</p>' +
      '<div data-out class="stack"></div>' + K.actions() + K.footer();

    app.querySelectorAll('[data-f]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var f = state.founders[Number(inp.getAttribute('data-f'))];
        var k = inp.getAttribute('data-k');
        f[k] = k === 'pct' ? num(inp.value) : inp.value;
        update();
      });
    });
    app.querySelectorAll('[data-r]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var r = state.rounds[Number(inp.getAttribute('data-r'))];
        var k = inp.getAttribute('data-k');
        r[k] = k === 'name' ? inp.value : num(inp.value);
        update();
      });
      if (inp.getAttribute('data-k') !== 'name' && inp.getAttribute('data-k') !== 'tokenPct') {
        inp.addEventListener('blur', function () { inp.value = K.fmt(num(inp.value)); });
      }
    });
    app.querySelectorAll('[data-del-f]').forEach(function (b) { b.addEventListener('click', function () { state.founders.splice(Number(b.getAttribute('data-del-f')), 1); render(); }); });
    app.querySelectorAll('[data-del-r]').forEach(function (b) { b.addEventListener('click', function () { state.rounds.splice(Number(b.getAttribute('data-del-r')), 1); render(); }); });
    var addF = app.querySelector('[data-add-f]');
    if (addF) addF.addEventListener('click', function () { state.founders.push({ name: 'Founder ' + String.fromCharCode(65 + state.founders.length), pct: 10 }); render(); });
    app.querySelectorAll('[data-add-r]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-add-r');
        var r = { type: t, name: cfg.types[t].label + ' ' + (state.rounds.length + 1) };
        cfg.types[t].fields.forEach(function (f) { r[f[0]] = 0; });
        state.rounds.push(r);
        render();
        window.WEB3TOYS.sound.play('pop');
      });
    });
    K.bind(app, K.sheetHandlers(sheet, 'cap-table.png', { reset: function () { saved.clear(); state = defaults(); render(); } }));
    update();
  }

  function roundCard(r, i) {
    var t = cfg.types[r.type];
    return '<div class="card cap-round stack stack--tight"><div class="cap-row"><span class="chip is-yellow">' + (i + 1) + '. ' + esc(t.label) + '</span>' +
      '<button type="button" class="cap-x" data-del-r="' + i + '" aria-label="Remove ' + esc(r.name) + '">×</button></div>' +
      '<p class="small-print">' + esc(t.line) + '</p><div class="tool-grid3">' +
      '<div class="stack stack--tight"><label class="label" for="rn-' + i + '">Name</label><input id="rn-' + i + '" class="field" maxlength="30" data-r="' + i + '" data-k="name" value="' + esc(r.name) + '" /></div>' +
      t.fields.map(function (f) {
        var id = 'r' + i + '-' + f[0];
        return '<div class="stack stack--tight"><label class="label" for="' + id + '">' + esc(f[1]) + '</label><input id="' + id + '" class="field" inputmode="decimal" data-r="' + i + '" data-k="' + f[0] + '" value="' + K.fmt(r[f[0]] || 0) + '" /></div>';
      }).join('') + '</div></div>';
  }

  function result() {
    return E.simulate(state.founders, state.rounds);
  }

  // A colour per holder, in the order they first appear.
  function colorsFor(res) {
    var map = {};
    var n = 0;
    res.final.concat(res.tokens).forEach(function (h) { if (!(h.name in map)) map[h.name] = cfg.colors[n++ % cfg.colors.length]; });
    return map;
  }

  function bars(res, colors) {
    var W = 400;
    var rowH = 44;
    var labelW = 112;
    var H = res.stages.length * rowH + 10;
    var rows = res.stages.map(function (st, i) {
      var x = labelW;
      var y = 6 + i * rowH;
      var segs = st.holders.map(function (h) {
        var w = (W - labelW - 10) * h.pct / 100;
        var seg = '<rect x="' + x.toFixed(1) + '" y="' + y + '" width="' + Math.max(0, w).toFixed(1) + '" height="30" fill="' + colors[h.name] + '" stroke="#1F1B2E" stroke-width="2"/>' +
          (w > 30 ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (y + 20) + '" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="13" fill="#1F1B2E">' + Math.round(h.pct) + '%</text>' : '');
        x += w;
        return seg;
      }).join('');
      return '<text x="0" y="' + (y + 20) + '" font-family="Nunito, sans-serif" font-weight="800" font-size="14" fill="#1F1B2E">' + esc(st.label.slice(0, 14)) + '</text>' + segs;
    }).join('');
    return '<svg class="tk-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Ownership after each round"><rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' + rows + '</svg>';
  }

  function update() {
    saved.save(state);
    var res = result();
    var colors = colorsFor(res);
    var fs = E.foundersShare(res.final);
    app.querySelector('[data-out]').innerHTML =
      '<section class="card stack stack--tight"><h2 class="title-md">Ownership after each round</h2>' + bars(res, colors) +
      K.legend(res.final.map(function (h) { return { label: h.name, color: colors[h.name], note: (Math.round(h.pct * 10) / 10) + '%' }; })) +
      '<p class="text text--ink">Founders own <strong>' + Math.round(fs * 10) / 10 + '%</strong> together after these rounds.</p></section>' +
      (res.tokens.length ? '<section class="card stack stack--tight"><h2 class="title-md">Token supply promised</h2><div class="tk-pie-wrap">' +
        K.donut(res.tokens.map(function (t) { return { value: t.pct, color: colors[t.name] }; }).concat([{ value: Math.max(0, 100 - res.tokens.reduce(function (s, t) { return s + t.pct; }, 0)), color: '#F1E9CF' }])) +
        K.legend(res.tokens.map(function (t) { return { label: t.name, color: colors[t.name], note: (Math.round(t.pct * 100) / 100) + '%' }; }).concat([{ label: 'Not promised yet', color: '#F1E9CF' }])) + '</div></section>' : '');
  }

  function sheet() {
    var res = result();
    var colors = colorsFor(res);
    return {
      title: 'Cap table and dilution',
      subtitle: state.founders.length + ' founders · ' + state.rounds.length + ' rounds',
      facts: [['Founders own', Math.round(E.foundersShare(res.final) * 10) / 10 + '%'], ['Token supply promised', Math.round(res.tokens.reduce(function (s, t) { return s + t.pct; }, 0) * 100) / 100 + '%']],
      table: { head: ['Holder', 'Shares after all rounds'], rows: res.final.map(function (h) { return [h.name, (Math.round(h.pct * 10) / 10) + '%']; }) },
      charts: [bars(res, colors)],
      sections: [
        { title: 'Rounds', lines: state.rounds.map(function (r) {
          var t = cfg.types[r.type];
          return r.name + ' (' + t.label + '): ' + t.fields.map(function (f) { return f[1] + ' ' + K.fmt(r[f[0]] || 0); }).join(', ');
        }) },
      ].concat(res.tokens.length ? [{ title: 'Tokens promised', lines: res.tokens.map(function (t) { return t.name + ': ' + (Math.round(t.pct * 100) / 100) + '% of supply'; }) }] : [])
        .concat([{ title: 'Note', lines: [cfg.note] }]),
    };
  }
})();
