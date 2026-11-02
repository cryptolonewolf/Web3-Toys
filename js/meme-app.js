// Meme Coin Launch Kit: a theme in; 10 names and tickers, launch words, a
// simple logo, the pump.fun info sheet and a required "Launch responsibly"
// checklist out. Settings: data/tools/meme-kit.json. Ideas: js/meme-engine.js.

(function () {
  var C = window.Web3Common;
  var E = window.MemeEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('meme-kit');
  var cfg = null;
  var state = null;
  var TEXT_KEYS = ['description', 'story', 'bio', 'post0', 'post1', 'post2'];

  C.loadJson('../../data/tools/meme-kit.json').then(function (data) {
    cfg = data;
    state = saved.load() || defaults();
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function defaults() {
    return {
      theme: cfg.examples[0], round: 0, pick: 0, text: null,
      logo: { shape: 'circle', bg: cfg.logo.colors[0], ring: cfg.logo.colors[6], emoji: cfg.logo.emojis[0], showTicker: true },
      links: { website: '', x: '', telegram: '' },
      checks: {},
    };
  }

  function ideas() {
    return E.names(state.theme, cfg, state.round);
  }

  function chosen() {
    var list = ideas();
    return list[Math.min(state.pick, list.length - 1)];
  }

  // The words, generated for the chosen name unless the visitor edited them.
  function words() {
    if (!state.text) {
      var c = E.copy(state.theme, chosen(), cfg, state.round);
      state.text = { description: c.description, story: c.story, bio: c.bio, post0: c.posts[0], post1: c.posts[1], post2: c.posts[2] };
    }
    return state.text;
  }

  function allChecked() {
    return cfg.checklist.every(function (c) { return state.checks[c.id]; });
  }

  function render() {
    var list = ideas();
    var t = words();
    var L = state.logo;
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Meme Coin Launch Kit</h1>' +
      '<p class="text text--ink">Type a theme. Get names, tickers, launch words, a logo and the info sheet. Then launch responsibly.</p>' + K.notes() + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">1. Your theme or idea</h2>' +
      '<label class="sr-only" for="mk-theme">Theme</label><input id="mk-theme" class="field" maxlength="80" value="' + esc(state.theme) + '" placeholder="a frog who loves coffee" />' +
      '<div class="tool-chips">' + cfg.examples.map(function (x) { return '<button type="button" class="chip-btn" data-example="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></section>' +
      '<section class="card stack stack--tight"><div class="cap-row"><h2 class="title-md">2. Pick a name</h2><button type="button" class="btn btn--small" data-more>🎲 More names</button></div>' +
      '<div class="mk-names" role="radiogroup" aria-label="Names and tickers">' + list.map(function (n, i) {
        return '<button type="button" role="radio" class="mk-name' + (i === state.pick ? ' is-on' : '') + '" aria-checked="' + (i === state.pick) + '" data-pick="' + i + '"><b>' + esc(n.name) + '</b><span>' + esc(n.ticker) + '</span></button>';
      }).join('') + '</div></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">3. Launch words</h2><p class="small-print">Edit anything. Each box has its own copy button.</p>' +
      textBox('description', 'Short description', 3) + textBox('story', 'One-line story', 2) + textBox('bio', 'X bio (160 characters max)', 2) +
      textBox('post0', 'Launch post 1', 4) + textBox('post1', 'Launch post 2', 4) + textBox('post2', 'Launch post 3', 4) +
      '<p class="tk-warn is-bad" data-banned hidden></p></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">4. Logo</h2><div class="mk-logo-wrap"><div class="mk-logo" data-logo>' + logoSvg() + '</div><div class="stack stack--tight">' +
      '<p class="label">Shape</p><div class="tool-chips">' + cfg.logo.shapes.map(function (s) { return '<button type="button" class="chip-btn' + (L.shape === s.id ? ' is-on' : '') + '" data-shape="' + s.id + '">' + esc(s.label) + '</button>'; }).join('') + '</div>' +
      '<p class="label">Colour</p><div class="mk-swatches">' + cfg.logo.colors.map(function (c) { return swatch('bg', c, L.bg); }).join('') + '</div>' +
      '<p class="label">Ring colour</p><div class="mk-swatches">' + cfg.logo.colors.map(function (c) { return swatch('ring', c, L.ring); }).join('') + '</div>' +
      '<p class="label">Emoji</p><div class="mk-emojis">' + cfg.logo.emojis.map(function (e) { return '<button type="button" class="mk-emoji' + (L.emoji === e ? ' is-on' : '') + '" data-emoji="' + e + '" aria-label="Emoji ' + e + '" aria-pressed="' + (L.emoji === e) + '">' + e + '</button>'; }).join('') + '</div>' +
      '<label class="mk-check"><input type="checkbox" data-showticker' + (L.showTicker ? ' checked' : '') + ' /> Show the ticker on the logo</label>' +
      '</div></div></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">5. Info sheet</h2><p class="small-print">The fields the pump.fun create form asks for. Check them against the site before you launch.</p>' +
      '<div class="tool-grid3">' + linkInput('website', 'Website') + linkInput('x', 'X link') + linkInput('telegram', 'Telegram link') + '</div>' +
      '<table class="tk-table mk-sheet" data-sheet></table><div class="btn-row"><button type="button" class="btn btn--small" data-copy-sheet>Copy info sheet</button></div></section>' +
      '<section class="card mk-respo stack stack--tight" data-out><h2 class="title-md">6. Launch responsibly</h2><p class="text text--ink">' + esc(cfg.checklistLine) + '</p>' +
      cfg.checklist.map(function (c) {
        return '<label class="mk-check mk-check--big"><input type="checkbox" data-check="' + c.id + '"' + (state.checks[c.id] ? ' checked' : '') + ' /> <span>' + esc(c.text) + '</span></label>';
      }).join('') + '<p class="small-print" data-lock aria-live="polite"></p></section>' +
      K.actions({ extra: [{ id: 'logo', label: 'Download logo PNG' }] }) + K.footer();

    var themeIn = app.querySelector('#mk-theme');
    themeIn.addEventListener('change', function () { setTheme(themeIn.value); });
    app.querySelectorAll('[data-example]').forEach(function (b) { b.addEventListener('click', function () { setTheme(b.getAttribute('data-example')); }); });
    app.querySelector('[data-more]').addEventListener('click', function () { state.round++; state.pick = 0; state.text = null; render(); window.WEB3TOYS.sound.play('pop'); });
    app.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () { state.pick = Number(b.getAttribute('data-pick')); state.text = null; render(); window.WEB3TOYS.sound.play('tick'); });
    });
    app.querySelectorAll('[data-text]').forEach(function (ta) {
      ta.addEventListener('input', function () { t[ta.getAttribute('data-text')] = ta.value; update(); });
    });
    app.querySelectorAll('[data-copy-text]').forEach(function (b) {
      b.addEventListener('click', function () {
        K.copyText(t[b.getAttribute('data-copy-text')]).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); });
      });
    });
    app.querySelectorAll('[data-shape]').forEach(function (b) { b.addEventListener('click', function () { L.shape = b.getAttribute('data-shape'); render(); }); });
    app.querySelectorAll('[data-swatch]').forEach(function (b) { b.addEventListener('click', function () { L[b.getAttribute('data-swatch')] = b.getAttribute('data-color'); render(); }); });
    app.querySelectorAll('[data-emoji]').forEach(function (b) { b.addEventListener('click', function () { L.emoji = b.getAttribute('data-emoji'); render(); }); });
    app.querySelector('[data-showticker]').addEventListener('change', function (e) { L.showTicker = e.target.checked; update(); });
    app.querySelectorAll('[data-link]').forEach(function (inp) { inp.addEventListener('input', function () { state.links[inp.getAttribute('data-link')] = inp.value; update(); }); });
    app.querySelector('[data-copy-sheet]').addEventListener('click', function (e) {
      var b = e.currentTarget;
      K.copyText(sheetText()).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy info sheet'; }, 1500); });
    });
    app.querySelectorAll('[data-check]').forEach(function (c) {
      c.addEventListener('change', function () {
        state.checks[c.getAttribute('data-check')] = c.checked;
        update();
        if (allChecked()) window.WEB3TOYS.sound.play('ding');
      });
    });

    var h = K.sheetHandlers(model, 'meme-launch-kit.png');
    K.bind(app, {
      blocked: function () {
        if (allChecked()) return '';
        app.querySelector('.mk-respo').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return 'Tick the Launch responsibly checklist first.';
      },
      pdf: h.pdf,
      png: h.png,
      copy: h.copy,
      logo: downloadLogo,
      reset: function () { saved.clear(); state = defaults(); render(); },
    });
    update();
  }

  function textBox(key, label, rows) {
    return '<div class="stack stack--tight"><div class="cap-row"><label class="label" for="mk-' + key + '">' + esc(label) + '</label>' +
      '<button type="button" class="btn btn--small mk-copy" data-copy-text="' + key + '">Copy</button></div>' +
      '<textarea id="mk-' + key + '" class="field" rows="' + rows + '" maxlength="' + (key === 'bio' ? 160 : 600) + '" data-text="' + key + '">' + esc(words()[key]) + '</textarea></div>';
  }

  function swatch(kind, c, current) {
    return '<button type="button" class="mk-swatch' + (c === current ? ' is-on' : '') + '" style="--c:' + c + '" data-swatch="' + kind + '" data-color="' + c + '" aria-label="' + (kind === 'bg' ? 'Colour ' : 'Ring ') + c + '" aria-pressed="' + (c === current) + '"></button>';
  }

  function linkInput(key, label) {
    return '<div class="stack stack--tight"><label class="label" for="mk-l-' + key + '">' + label + ' (optional)</label><input id="mk-l-' + key + '" class="field" type="url" inputmode="url" maxlength="200" data-link="' + key + '" value="' + esc(state.links[key]) + '" placeholder="https://" /></div>';
  }

  function setTheme(v) {
    state.theme = String(v).slice(0, 80);
    state.round = 0;
    state.pick = 0;
    state.text = null;
    render();
    window.WEB3TOYS.sound.play('pop');
  }

  function shapePath(id) {
    if (id === 'rounded') return '<rect x="24" y="24" width="464" height="464" rx="110"';
    if (id === 'hexagon') return '<path d="M256 20 L460 138 L460 374 L256 492 L52 374 L52 138 Z"';
    if (id === 'shield') return '<path d="M256 24 L460 92 L460 250 C460 380 360 456 256 492 C152 456 52 380 52 250 L52 92 Z"';
    if (id === 'badge') {
      var pts = [];
      for (var i = 0; i < 24; i++) {
        var a = (i / 24) * Math.PI * 2 - Math.PI / 2;
        var r = i % 2 ? 210 : 240;
        pts.push((256 + r * Math.cos(a)).toFixed(1) + ' ' + (256 + r * Math.sin(a)).toFixed(1));
      }
      return '<path d="M' + pts.join(' L') + ' Z"';
    }
    return '<circle cx="256" cy="256" r="232"';
  }

  function logoSvg() {
    var L = state.logo;
    var tk = chosen().ticker;
    var dark = /^#(1F1B2E|4D9DE0|A98BFF|FF6B6B)$/i.test(L.bg);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Logo for ' + esc(chosen().name) + '">' +
      shapePath(L.shape) + ' fill="' + L.bg + '" stroke="' + L.ring + '" stroke-width="22" stroke-linejoin="round"/>' +
      '<text x="256" y="' + (L.showTicker ? 290 : 330) + '" text-anchor="middle" font-size="' + (L.showTicker ? 230 : 270) + '" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">' + L.emoji + '</text>' +
      (L.showTicker ? '<text x="256" y="420" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="' + Math.min(78, Math.floor(400 / tk.length * 1.4)) + '" fill="' + (dark ? '#FFFFFF' : '#1F1B2E') + '" stroke="' + (dark ? '#1F1B2E' : '#FFFFFF') + '" stroke-width="8" paint-order="stroke">' + esc(tk) + '</text>' : '') +
      '</svg>';
  }

  function sheetRows() {
    var n = chosen();
    var t = words();
    var v = { name: n.name, ticker: n.ticker.replace('$', ''), description: t.description, image: 'logo.png (from Download logo PNG)', website: state.links.website, x: state.links.x, telegram: state.links.telegram };
    return cfg.pumpFields.map(function (f) { return [f.label, v[f.key] || '—']; });
  }

  function sheetText() {
    return sheetRows().map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
  }

  function update() {
    saved.save(state);
    var t = words();
    app.querySelector('[data-logo]').innerHTML = logoSvg();
    app.querySelector('[data-sheet]').innerHTML = sheetRows().map(function (r) { return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    var bad = E.banned(TEXT_KEYS.map(function (k) { return t[k]; }).join(' '), cfg);
    var bw = app.querySelector('[data-banned]');
    bw.hidden = !bad.length;
    bw.textContent = bad.length ? 'Careful: "' + bad.join('", "') + '" sounds like a promise of returns. Meme coins should never promise prices or profits.' : '';
    var ok = allChecked();
    app.querySelector('.mk-respo').classList.toggle('is-done', ok);
    app.querySelector('[data-lock]').textContent = ok ? '✅ Downloads unlocked. Launch for fun, never for other people\'s money.' : '🔒 Downloads unlock when all four are ticked.';
    app.querySelectorAll('[data-tool="pdf"],[data-tool="png"],[data-tool="copy"],[data-tool="logo"]').forEach(function (b) { b.classList.toggle('is-locked', !ok); });
  }

  function model() {
    var n = chosen();
    var t = words();
    return {
      title: n.name + ' (' + n.ticker + ')',
      subtitle: 'Meme coin launch kit · theme: ' + state.theme,
      facts: sheetRows().slice(0, 3).concat([['Story', t.story], ['X bio', t.bio]]),
      charts: [logoSvg()],
      sections: [
        { title: 'Launch posts', lines: [t.post0, t.post1, t.post2] },
        { title: 'Other name ideas', lines: ideas().map(function (x) { return x.name + ' ' + x.ticker; }) },
        { title: 'Launch responsibly (all agreed)', lines: cfg.checklist.map(function (c) { return c.text; }) },
      ],
    };
  }

  function downloadLogo() {
    K.svgImage(logoSvg()).then(function (img) {
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      if (img) canvas.getContext('2d').drawImage(img, 0, 0, 1024, 1024);
      K.downloadCanvas(canvas, chosen().ticker.replace('$', '').toLowerCase() + '-logo.png');
      C.track('tool_export', { tool: 'meme-kit', format: 'logo' });
    });
    return 'Making your logo…';
  }
})();
