// Gas and Unit Converter: wei, gwei and ETH; lamports and SOL; a simple fee
// estimate from a gas price the visitor types. Settings: data/tools/gas.json.
// Maths: js/gas-engine.js (BigInt, so no rounding errors).

(function () {
  var C = window.Web3Common;
  var G = window.GasEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('gas-converter');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/gas.json').then(function (data) {
    cfg = data;
    state = saved.load() || JSON.parse(JSON.stringify(cfg.defaults));
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function base(kind) {
    try { return BigInt(state[kind + 'Base'] || '0'); } catch (e) { return 0n; }
  }

  function unitInputs(kind) {
    return cfg[kind].units.map(function (u) {
      return '<div class="stack stack--tight"><label class="label" for="u-' + u.id + '">' + esc(u.label) + '</label>' +
        '<input id="u-' + u.id + '" class="field gas-num" inputmode="decimal" autocomplete="off" data-kind="' + kind + '" data-unit="' + u.id + '" data-dec="' + u.decimals + '" value="' + G.group(G.fromBase(base(kind), u.decimals)) + '" /></div>';
    }).join('');
  }

  function numField(key, label, mode) {
    return '<div class="stack stack--tight"><label class="label" for="g-' + key + '">' + esc(label) + '</label>' +
      '<input id="g-' + key + '" class="field" inputmode="' + mode + '" data-in="' + key + '" value="' + K.fmt(state[key]) + '" /></div>';
  }

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Gas and Unit Converter</h1>' +
      '<p class="text text--ink">Type in any box and the others update. Then estimate a fee from a gas price.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Ethereum units</h2><p class="small-print">1 ETH = 1,000,000,000 gwei = 1,000,000,000,000,000,000 wei.</p><div class="tool-grid3">' + unitInputs('evm') + '</div></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Solana units</h2><p class="small-print">1 SOL = 1,000,000,000 lamports.</p><div class="tool-grid3">' + unitInputs('sol') + '</div></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">EVM fee estimate</h2><p class="label">What are you doing?</p><div class="tool-chips">' +
      cfg.actions.map(function (a) { return '<button type="button" class="chip-btn' + (state.action === a.id ? ' is-on' : '') + '" data-action="' + a.id + '">' + esc(a.label) + '</button>'; }).join('') + '</div>' +
      '<p class="small-print" data-action-note></p><div class="tool-grid3">' +
      numField('gasPrice', 'Gas price (gwei)', 'decimal') + numField('gasUnits', 'Gas used (units)', 'numeric') + numField('ethPrice', 'ETH price, optional ($)', 'decimal') +
      '</div><div data-evm-fee></div></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Solana fee estimate</h2><div class="tool-grid3">' +
      numField('signatures', 'Signatures', 'numeric') + numField('priorityLamports', 'Priority fee, optional (lamports)', 'numeric') + numField('solPrice', 'SOL price, optional ($)', 'decimal') +
      '</div><div data-sol-fee></div></section>' +
      '<p class="small-print" data-out>' + esc(cfg.line) + '</p>' +
      K.actions() + K.footer();

    app.querySelectorAll('[data-unit]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var kind = inp.getAttribute('data-kind');
        var b = G.toBase(inp.value, Number(inp.getAttribute('data-dec')));
        inp.classList.toggle('is-bad', b == null && inp.value.trim() !== '');
        if (b == null) return;
        state[kind + 'Base'] = b.toString();
        app.querySelectorAll('[data-kind="' + kind + '"]').forEach(function (o) {
          if (o !== inp) o.value = G.group(G.fromBase(b, Number(o.getAttribute('data-dec'))));
        });
        update();
      });
      inp.addEventListener('blur', function () {
        if (!inp.classList.contains('is-bad')) inp.value = G.group(G.fromBase(base(inp.getAttribute('data-kind')), Number(inp.getAttribute('data-dec'))));
      });
    });
    app.querySelectorAll('[data-in]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var k = inp.getAttribute('data-in');
        state[k] = Number(String(inp.value).replace(/[^0-9.]/g, '')) || 0;
        if (k === 'gasUnits') { state.action = ''; app.querySelectorAll('[data-action]').forEach(function (b) { b.classList.remove('is-on'); }); }
        update();
      });
      inp.addEventListener('blur', function () { inp.value = K.fmt(state[inp.getAttribute('data-in')]); });
    });
    app.querySelectorAll('[data-action]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = cfg.actions.filter(function (x) { return x.id === b.getAttribute('data-action'); })[0];
        state.action = a.id;
        state.gasUnits = a.gas;
        render();
        window.WEB3TOYS.sound.play('tick');
      });
    });
    K.bind(app, K.sheetHandlers(model, 'gas-and-units.png', { reset: function () { saved.clear(); state = JSON.parse(JSON.stringify(cfg.defaults)); render(); } }));
    update();
  }

  function fees() {
    var wei = G.evmFee(state.gasUnits, state.gasPrice);
    var lam = G.solFee(state.signatures, cfg.sol.baseFeeLamports, state.priorityLamports);
    var eth = G.fromBase(wei, 18);
    var sol = G.fromBase(lam, 9);
    return {
      gwei: G.fromBase(wei, 9), eth: eth, evmUsd: state.ethPrice ? Number(eth) * state.ethPrice : null,
      lamports: lam.toString(), sol: sol, solUsd: state.solPrice ? Number(sol) * state.solPrice : null,
    };
  }

  function usd(n) {
    if (n == null) return '';
    return n < 0.01 ? 'under $0.01' : '$' + n.toFixed(n < 10 ? 2 : 0);
  }

  function big(label, value, cls) {
    return '<div class="card mc-big ' + cls + '"><p class="label">' + esc(label) + '</p><p class="mc-value gas-val">' + esc(value) + '</p></div>';
  }

  function update() {
    saved.save(state);
    var f = fees();
    var a = cfg.actions.filter(function (x) { return x.id === state.action; })[0];
    app.querySelector('[data-action-note]').textContent = a ? a.note : 'Custom gas amount.';
    app.querySelector('[data-evm-fee]').innerHTML = '<div class="mc-results">' + big('Fee in gwei', G.group(f.gwei), 'is-blue') + big('Fee in ETH', f.eth, 'is-mint') +
      (f.evmUsd != null ? big('Fee in dollars', usd(f.evmUsd), 'is-coral') : '') + '</div>';
    app.querySelector('[data-sol-fee]').innerHTML = '<div class="mc-results">' + big('Fee in lamports', G.group(f.lamports), 'is-blue') + big('Fee in SOL', f.sol, 'is-mint') +
      (f.solUsd != null ? big('Fee in dollars', usd(f.solUsd), 'is-coral') : '') + '</div>';
  }

  function model() {
    var f = fees();
    var a = cfg.actions.filter(function (x) { return x.id === state.action; })[0];
    return {
      title: 'Gas and units',
      subtitle: 'Conversions and fee estimates',
      facts: [
        ['ETH', G.group(G.fromBase(base('evm'), 18))], ['Gwei', G.group(G.fromBase(base('evm'), 9))], ['Wei', G.group(G.fromBase(base('evm'), 0))],
        ['SOL', G.group(G.fromBase(base('sol'), 9))], ['Lamports', G.group(G.fromBase(base('sol'), 0))],
      ],
      table: { head: ['Fee estimate', 'Amount'], rows: [
        ['EVM: ' + (a ? a.label : 'custom') + ', ' + K.fmt(state.gasUnits) + ' gas at ' + state.gasPrice + ' gwei', f.eth + ' ETH' + (f.evmUsd != null ? ' (' + usd(f.evmUsd) + ')' : '')],
        ['Solana: ' + state.signatures + ' signature(s)' + (state.priorityLamports ? ' + priority fee' : ''), f.sol + ' SOL' + (f.solUsd != null ? ' (' + usd(f.solUsd) + ')' : '')],
      ] },
      sections: [{ title: 'Note', lines: [cfg.line] }],
    };
  }
})();
