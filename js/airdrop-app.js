// Airdrop Campaign Planner: supply for the airdrop, eligibility rules,
// anti-farming ideas and a claim timeline, exported as a one page plan.
// Settings: data/tools/airdrop.json. Maths: js/airdrop-engine.js.

(function () {
  var C = window.Web3Common;
  var E = window.AirdropEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('airdrop-planner');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/airdrop.json').then(function (data) {
    cfg = data;
    state = saved.load() || defaults();
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function defaults() {
    var s = JSON.parse(JSON.stringify(cfg.defaults));
    if (!s.snapshot) s.snapshot = E.addDays(new Date().toISOString().slice(0, 10), 30);
    s.ruleN = {};
    cfg.rules.forEach(function (r) { if (r.n != null) s.ruleN[r.id] = r.n; });
    return s;
  }

  function num(v) {
    return Number(String(v).replace(/[^0-9.]/g, '')) || 0;
  }

  function ruleText(r) {
    return r.text.replace('{n}', K.fmt(state.ruleN[r.id] != null ? state.ruleN[r.id] : r.n));
  }

  function field(key, label, mode, suffix) {
    return '<div class="stack stack--tight"><label class="label" for="ad-' + key + '">' + esc(label) + '</label>' +
      '<input id="ad-' + key + '" class="field" inputmode="' + mode + '" data-in="' + key + '" value="' + K.fmt(state[key]) + '" />' + (suffix || '') + '</div>';
  }

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Airdrop Campaign Planner</h1>' +
      '<p class="text text--ink">Plan who gets tokens, how many, how to keep farmers out and when people can claim. Get a one page plan.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">1. How much</h2><div class="tool-grid3">' +
      '<div class="stack stack--tight"><label class="label" for="ad-token">Token ticker</label><input id="ad-token" class="field" maxlength="12" data-text="token" value="' + esc(state.token) + '" /></div>' +
      field('supply', 'Total supply', 'numeric') + field('airdropPct', 'Airdrop share of supply (%)', 'decimal') +
      field('wallets', 'Eligible wallets you expect', 'numeric') + field('price', 'Token price, if known ($)', 'decimal') +
      '</div><p class="label">How to share it</p><div class="tool-chips" role="radiogroup" aria-label="How to share it">' + cfg.methods.map(function (m) {
        return '<button type="button" role="radio" class="chip-btn' + (state.method === m.id ? ' is-on' : '') + '" aria-checked="' + (state.method === m.id) + '" data-method="' + m.id + '">' + esc(m.label) + '</button>';
      }).join('') + '</div><p class="small-print" data-method-line></p></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">2. Who is eligible</h2>' + cfg.rules.map(function (r) {
        return '<div class="ad-rule"><label class="mk-check"><input type="checkbox" data-rule="' + r.id + '"' + (state.rules[r.id] ? ' checked' : '') + ' /> <span data-rule-text="' + r.id + '">' + esc(ruleText(r)) + '</span></label>' +
          (r.n != null ? '<label class="ad-n"><span class="sr-only">Number for: ' + esc(r.text.replace('{n}', 'N')) + '</span><input class="field" inputmode="numeric" data-rule-n="' + r.id + '" value="' + K.fmt(state.ruleN[r.id]) + '" /></label>' : '') + '</div>';
      }).join('') + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">3. Keep farmers out</h2>' + cfg.anti.map(function (a) {
        return '<label class="mk-check mk-check--big"><input type="checkbox" data-anti="' + a.id + '"' + (state.anti[a.id] ? ' checked' : '') + ' /> <span><b>' + esc(a.text) + '</b><br><span class="small-print">' + esc(a.why) + '</span></span></label>';
      }).join('') + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">4. Claim timeline</h2><div class="tool-grid3">' +
      '<div class="stack stack--tight"><label class="label" for="ad-snapshot">Snapshot date</label><input id="ad-snapshot" class="field" type="date" data-text="snapshot" value="' + esc(state.snapshot) + '" /></div>' +
      field('claimDays', 'Claim window (days)', 'numeric') + field('atClaimPct', 'Unlocked at claim (%)', 'decimal') + field('vestMonths', 'Rest unlocks over (months)', 'numeric') +
      '<div class="stack stack--tight"><label class="label" for="ad-unclaimed">Unclaimed tokens go</label><select id="ad-unclaimed" class="field" data-text="unclaimed">' +
      cfg.unclaimed.map(function (u) { return '<option value="' + u.id + '"' + (state.unclaimed === u.id ? ' selected' : '') + '>' + esc(u.label) + '</option>'; }).join('') + '</select></div>' +
      '</div></section>' +
      '<div data-out class="stack"></div>' + K.actions() + K.footer();

    app.querySelectorAll('[data-in]').forEach(function (inp) {
      inp.addEventListener('input', function () { state[inp.getAttribute('data-in')] = num(inp.value); update(); });
      inp.addEventListener('blur', function () { inp.value = K.fmt(state[inp.getAttribute('data-in')]); });
    });
    app.querySelectorAll('[data-text]').forEach(function (inp) {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', function () { state[inp.getAttribute('data-text')] = inp.value; update(); });
    });
    app.querySelectorAll('[data-method]').forEach(function (b) {
      b.addEventListener('click', function () { state.method = b.getAttribute('data-method'); render(); window.WEB3TOYS.sound.play('tick'); });
    });
    app.querySelectorAll('[data-rule]').forEach(function (c) { c.addEventListener('change', function () { state.rules[c.getAttribute('data-rule')] = c.checked ? 1 : 0; update(); }); });
    app.querySelectorAll('[data-anti]').forEach(function (c) { c.addEventListener('change', function () { state.anti[c.getAttribute('data-anti')] = c.checked ? 1 : 0; update(); }); });
    app.querySelectorAll('[data-rule-n]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-rule-n');
        state.ruleN[id] = num(inp.value);
        app.querySelector('[data-rule-text="' + id + '"]').textContent = ruleText(cfg.rules.filter(function (r) { return r.id === id; })[0]);
        update();
      });
    });
    K.bind(app, K.sheetHandlers(model, 'airdrop-plan.png', { reset: function () { saved.clear(); state = defaults(); render(); } }));
    update();
  }

  function tk(n) {
    return K.fmt(Math.round(n)) + ' ' + (state.token || 'tokens');
  }

  function nice(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function timeline(steps) {
    var W = 400;
    var rowH = 40;
    var H = steps.length * rowH + 16;
    var colors = ['#4D9DE0', '#A98BFF', '#FF9F45', '#6BCB77', '#FF6B6B', '#FFD23F'];
    return '<svg class="tk-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Claim timeline"><rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>' +
      '<path d="M24 20 V' + (H - 20) + '" stroke="#1F1B2E" stroke-width="4" stroke-linecap="round"/>' +
      steps.map(function (s, i) {
        var y = 20 + i * rowH;
        return '<circle cx="24" cy="' + y + '" r="10" fill="' + colors[i % colors.length] + '" stroke="#1F1B2E" stroke-width="3"/>' +
          '<text x="46" y="' + (y + 5) + '" font-family="Nunito, sans-serif" font-weight="800" font-size="15" fill="#1F1B2E">' + esc(s.label) + '</text>' +
          '<text x="' + (W - 8) + '" y="' + (y + 5) + '" text-anchor="end" font-family="Nunito, sans-serif" font-weight="700" font-size="14" fill="#5A5470">' + esc(s.date ? nice(s.date) : 'day ' + s.day) + '</text>';
      }).join('') + '</svg>';
  }

  function update() {
    saved.save(state);
    var p = E.plan(state, cfg);
    var m = cfg.methods.filter(function (x) { return x.id === state.method; })[0];
    app.querySelector('[data-method-line]').textContent = m ? m.line : '';
    app.querySelector('[data-out]').innerHTML =
      '<div class="mc-results">' +
      '<div class="card mc-big is-mint"><p class="label">Airdrop size</p><p class="mc-value">' + tk(p.tokens) + '</p></div>' +
      (p.value ? '<div class="card mc-big is-blue"><p class="label">Worth at your price</p><p class="mc-value">' + K.usd(p.value) + '</p></div>' : '') + '</div>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Tokens per wallet</h2><table class="tk-table"><thead><tr><th>Group</th><th>Wallets</th><th>Each gets</th></tr></thead><tbody>' +
      p.shares.map(function (s) { return '<tr><td>' + esc(s.label) + '</td><td>' + K.fmt(s.wallets) + '</td><td>' + tk(s.each) + '</td></tr>'; }).join('') + '</tbody></table></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Timeline</h2>' + timeline(p.steps) + '</section>' +
      (p.warnings.length ? '<section class="stack stack--tight">' + p.warnings.map(function (w) { return '<p class="tk-warn is-bad">' + esc(w) + '</p>'; }).join('') + '</section>' : '<p class="tk-warn is-good">No warnings. Nice plan.</p>');
  }

  function model() {
    var p = E.plan(state, cfg);
    var un = cfg.unclaimed.filter(function (u) { return u.id === state.unclaimed; })[0];
    var m = cfg.methods.filter(function (x) { return x.id === state.method; })[0];
    return {
      title: (state.token || 'Token') + ' airdrop plan',
      subtitle: K.fmt(state.airdropPct) + '% of supply · ' + K.fmt(state.wallets) + ' wallets · ' + (m ? m.label : '') + ' sharing',
      facts: [['Airdrop size', tk(p.tokens)], ['Unlocked at claim', state.atClaimPct + '%' + (state.atClaimPct < 100 && state.vestMonths ? ', rest over ' + state.vestMonths + ' months' : '')],
        ['Claim window', state.claimDays + ' days'], ['Unclaimed tokens', un ? un.label : '']].concat(p.value ? [['Worth at your price', K.usd(p.value)]] : []),
      table: { head: ['Group', 'Wallets', 'Each gets'], rows: p.shares.map(function (s) { return [s.label, K.fmt(s.wallets), tk(s.each)]; }) },
      charts: [timeline(p.steps)],
      sections: [
        { title: 'Who is eligible', lines: cfg.rules.filter(function (r) { return state.rules[r.id]; }).map(ruleText) },
        { title: 'Keeping farmers out', lines: cfg.anti.filter(function (a) { return state.anti[a.id]; }).map(function (a) { return a.text; }) },
      ].concat(p.warnings.length ? [{ title: 'Watch out', lines: p.warnings }] : []),
    };
  }
})();
