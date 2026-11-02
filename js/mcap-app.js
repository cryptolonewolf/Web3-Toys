// Market Cap and FDV Calculator: price, circulating and total supply in;
// market cap, FDV, the gap and a one line meaning out, with an iceberg whose
// tip is the circulating share. Settings: data/tools/mcap-fdv.json.

(function () {
  var C = window.Web3Common;
  var M = window.McapEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('mcap-fdv');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/mcap-fdv.json').then(function (data) {
    cfg = data;
    state = saved.load() || copy(cfg.defaults);
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function copy(o) {
    return { price: o.price, circulating: o.circulating, total: o.total };
  }

  // Numbers typed with commas or spaces still work.
  function num(v) {
    return Number(String(v).replace(/[^0-9.]/g, '')) || 0;
  }

  function full(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 });
  }

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Market Cap and FDV Calculator</h1>' +
      '<p class="text text--ink">Type a price and the supply. See what the market values today, and what is still hiding under the water.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">Try an example</h2><div class="tool-chips">' +
      cfg.presets.map(function (p, i) { return '<button type="button" class="chip-btn" data-preset="' + i + '">' + esc(p.label) + '</button>'; }).join('') + '</div>' +
      '<div class="tool-grid3">' +
      input('price', 'Price per token ($)', 'decimal') +
      input('circulating', 'Circulating supply', 'numeric') +
      input('total', 'Total supply', 'numeric') +
      '</div></section>' +
      '<div data-out class="stack"></div>' +
      K.actions() + K.footer();

    app.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        state = copy(cfg.presets[Number(b.getAttribute('data-preset'))]);
        render();
        window.WEB3TOYS.sound.play('pop');
      });
    });
    app.querySelectorAll('[data-in]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        state[inp.getAttribute('data-in')] = num(inp.value);
        update();
      });
      inp.addEventListener('blur', function () { inp.value = full(state[inp.getAttribute('data-in')]); });
    });
    K.bind(app, { pdf: pdf, png: png, copy: copyText, reset: reset });
    update();
  }

  function input(key, label, mode) {
    return '<div class="stack stack--tight"><label class="label" for="mc-' + key + '">' + label + '</label>' +
      '<input id="mc-' + key + '" class="field" inputmode="' + mode + '" data-in="' + key + '" value="' + full(state[key]) + '" /></div>';
  }

  function result() {
    return M.calc(state.price, state.circulating, state.total);
  }

  function meaning(r) {
    return M.band(r.circulatingPct, cfg.bands).line.replace('{pct}', Math.round(r.circulatingPct * 10) / 10);
  }

  function update() {
    saved.save(state);
    var r = result();
    var out = app.querySelector('[data-out]');
    if (!r.valid) {
      out.innerHTML = '<p class="tk-warn is-bad">' + esc(state.circulating > state.total ? cfg.tooMuch : 'Enter a price and a total supply above zero.') + '</p>';
      return;
    }
    out.innerHTML =
      '<div class="mc-results">' +
      big('Market cap', M.money(r.mcap), 'is-mint') +
      big('FDV', M.money(r.fdv), 'is-blue') +
      big('The gap', M.money(r.gap), 'is-coral') +
      '</div>' +
      '<section class="card stack stack--tight mc-meaning"><p class="title-sm">' + esc(meaning(r)) + '</p>' +
      (r.ratio > 1 ? '<p class="small-print">FDV is ' + (Math.round(r.ratio * 10) / 10) + ' times the market cap.</p>' : '') + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">The iceberg</h2>' + iceberg(r) +
      '<p class="small-print">' + esc(cfg.marketCapLine) + '</p><p class="small-print">' + esc(cfg.fdvLine) + '</p></section>';
  }

  function big(label, value, cls) {
    return '<div class="card mc-big ' + cls + '"><p class="label">' + label + '</p><p class="mc-value">' + value + '</p></div>';
  }

  // The tip above the water is the circulating share; the rest is under it.
  function iceberg(r) {
    var W = 360;
    var H = 260;
    var top = 30;
    var bottom = 240;
    var share = Math.max(0.03, Math.min(1, r.circulatingPct / 100));
    var waterY = top + (bottom - top) * share;
    var berg = 'M180 ' + top + ' L214 70 L236 92 L262 140 L290 196 L262 ' + bottom + ' L98 ' + bottom + ' L70 190 L104 128 L130 96 L150 64Z';
    return '<svg class="mc-berg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Iceberg: ' + Math.round(r.circulatingPct) + ' percent above the water">' +
      '<rect width="' + W + '" height="' + H + '" fill="#DFF3FF"/>' +
      '<rect y="' + waterY.toFixed(1) + '" width="' + W + '" height="' + (H - waterY).toFixed(1) + '" fill="#4D9DE0"/>' +
      '<path d="' + berg + '" fill="#FFFFFF" stroke="#1F1B2E" stroke-width="4" stroke-linejoin="round"/>' +
      '<rect y="' + waterY.toFixed(1) + '" width="' + W + '" height="' + (H - waterY).toFixed(1) + '" fill="#1D6FD6" opacity=".45"/>' +
      '<path d="M0 ' + waterY.toFixed(1) + ' q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#1F1B2E" stroke-width="3"/>' +
      '<g font-family="Nunito, sans-serif" font-weight="800" font-size="15" fill="#1F1B2E" stroke="#DFF3FF" stroke-width="4" paint-order="stroke">' +
      '<text x="12" y="' + Math.max(22, waterY - 10).toFixed(1) + '">Market cap ' + M.money(r.mcap) + '</text></g>' +
      '<g font-family="Nunito, sans-serif" font-weight="800" font-size="15" fill="#FFFFFF" stroke="#1F1B2E" stroke-width="4" paint-order="stroke">' +
      (r.gap > 0 ? '<text x="12" y="' + Math.min(H - 12, waterY + 26).toFixed(1) + '">Still locked ' + M.money(r.gap) + '</text>' : '') + '</g></svg>';
  }

  // ---------- Exports ----------

  function copyText() {
    var r = result();
    return 'Market cap and FDV\n' +
      'Price: $' + full(state.price) + '\nCirculating supply: ' + full(state.circulating) + '\nTotal supply: ' + full(state.total) + '\n\n' +
      'Market cap: ' + M.money(r.mcap) + '\nFDV: ' + M.money(r.fdv) + '\nGap: ' + M.money(r.gap) + ' (' + (Math.round(r.circulatingPct * 10) / 10) + '% circulating)\n' +
      meaning(r) + '\n\n' + K.DISCLAIMER + ' Made with web3.toys.';
  }

  function pdf() {
    var r = result();
    K.printSheet(
      '<h1>Market cap and FDV</h1>' +
      '<p>Price <b>$' + full(state.price) + '</b> · Circulating <b>' + full(state.circulating) + '</b> · Total <b>' + full(state.total) + '</b></p>' +
      '<table class="tk-table"><tr><th>Market cap</th><td>' + M.money(r.mcap) + '</td></tr><tr><th>FDV</th><td>' + M.money(r.fdv) + '</td></tr>' +
      '<tr><th>Gap</th><td>' + M.money(r.gap) + '</td></tr><tr><th>Circulating</th><td>' + (Math.round(r.circulatingPct * 10) / 10) + '%</td></tr></table>' +
      '<h2>' + esc(meaning(r)) + '</h2>' + iceberg(r) +
      '<p>' + esc(cfg.marketCapLine) + '</p><p>' + esc(cfg.fdvLine) + '</p>'
    );
    C.track('tool_export', { tool: 'mcap-fdv', format: 'pdf' });
  }

  function png() {
    var r = result();
    var canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    var ctx = canvas.getContext('2d');
    K.svgImage(iceberg(r)).then(function (img) {
      ctx.fillStyle = '#FFF8E1';
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.fillStyle = '#1F1B2E';
      ctx.font = '700 58px Fredoka, Nunito, sans-serif';
      ctx.fillText('Market cap and FDV', 60, 110);
      ctx.font = '800 26px Nunito, sans-serif';
      ctx.fillText('Price $' + full(state.price) + ' · circulating ' + full(state.circulating) + ' · total ' + full(state.total), 60, 160);
      [['Market cap', M.money(r.mcap)], ['FDV', M.money(r.fdv)], ['Gap', M.money(r.gap)]].forEach(function (b, i) {
        ctx.font = '800 26px Nunito, sans-serif';
        ctx.fillText(b[0], 60 + i * 330, 240);
        ctx.font = '700 56px Fredoka, Nunito, sans-serif';
        ctx.fillText(b[1], 60 + i * 330, 305);
      });
      if (img) ctx.drawImage(img, 60, 360, 960, 693);
      ctx.font = '800 28px Nunito, sans-serif';
      wrapText(ctx, meaning(r), 60, 1120, 960, 38);
      ctx.font = '700 20px Nunito, sans-serif';
      ctx.fillStyle = '#5A5470';
      ctx.fillText(K.DISCLAIMER + ' Made with web3.toys.', 60, 1300);
      K.downloadCanvas(canvas, 'market-cap-fdv.png');
      C.track('tool_export', { tool: 'mcap-fdv', format: 'png' });
    });
  }

  function wrapText(ctx, text, x, y, max, lh) {
    var line = '';
    String(text).split(' ').forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > max && line) {
        ctx.fillText(line, x, y);
        y += lh;
        line = w;
      } else {
        line = t;
      }
    });
    if (line) ctx.fillText(line, x, y);
  }

  function reset() {
    saved.clear();
    state = copy(cfg.defaults);
    render();
  }
})();
