// Pitch Deck Builder: a step by step form (one step per slide), then pick one
// of 10 visual templates and the deck renders as slides, with Download PDF
// (one slide per page), PNG and Copy. Steps: data/tools/pitch-deck.json.
// Templates: data/tools/deck_templates.json. Slides: js/deck-engine.js.

(function () {
  var C = window.Web3Common;
  var D = window.DeckEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var saved = K.store('pitch-deck');
  var steps = null;
  var templates = null;
  var state = null;
  var fontsLoaded = {};

  Promise.all([C.loadJson('../../data/tools/pitch-deck.json'), C.loadJson('../../data/tools/deck_templates.json')]).then(function (r) {
    steps = r[0].steps;
    templates = r[1].templates;
    state = saved.load() || { answers: {}, step: 0, template: '', view: 'form' };
    show();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function save() {
    saved.save(state);
  }

  function tpl() {
    return templates.filter(function (t) { return t.id === state.template; })[0] || templates[0];
  }

  function show() {
    if (state.view === 'deck' && state.template) return deckView();
    if (state.view === 'style') return styleView();
    formView(Math.min(state.step || 0, steps.length - 1));
  }

  function head() {
    return '<section class="tool-head stack stack--tight"><h1 class="tool-title">Pitch Deck Builder</h1>' +
      '<p class="text text--ink">Answer one short step per slide, pick a style, and download your deck.</p>' + K.notes() + '</section>';
  }

  // ---------- 1. The form ----------

  function formView(k) {
    state.step = k;
    state.view = 'form';
    save();
    var s = steps[k];
    var a = state.answers[s.id] || {};
    app.innerHTML = head() +
      '<nav class="deck-steps" aria-label="Steps">' + steps.map(function (x, i) {
        var done = state.answers[x.id] && Object.keys(state.answers[x.id]).some(function (f) { return String(state.answers[x.id][f]).trim(); });
        return '<button type="button" class="deck-step' + (i === k ? ' is-now' : '') + (done ? ' is-done' : '') + '" data-step="' + i + '" aria-label="Step ' + (i + 1) + ': ' + esc(x.title) + '"' + (i === k ? ' aria-current="step"' : '') + '>' + (i + 1) + '</button>';
      }).join('') + '</nav>' +
      '<section class="card stack stack--tight"><p class="label">Slide ' + (k + 1) + ' of ' + steps.length + '</p><h2 class="title-md">' + esc(s.title) + '</h2>' +
      s.fields.map(function (f) {
        var v = esc(a[f.id] || '');
        var idf = 'f-' + s.id + '-' + f.id;
        return '<div class="stack stack--tight"><label class="label" for="' + idf + '">' + esc(f.label) + '</label>' +
          (f.type === 'area'
            ? '<textarea id="' + idf + '" class="field field--area" rows="4" data-field="' + f.id + '" placeholder="' + esc(f.placeholder || '') + '">' + v + '</textarea>'
            : '<input id="' + idf + '" class="field" data-field="' + f.id + '" maxlength="90" placeholder="' + esc(f.placeholder || '') + '" value="' + v + '" />') + '</div>';
      }).join('') +
      '<p class="small-print">Leave a step empty to skip that slide.</p></section>' +
      '<div class="sticky-bar"><div class="btn-row"><button type="button" class="btn" data-back' + (k ? '' : ' disabled') + '>Back</button>' +
      '<button type="button" class="btn btn--ink" data-next>' + (k === steps.length - 1 ? 'Pick a style' : 'Next') + '</button></div>' +
      '<button type="button" class="text-button center" data-skip>Skip to the styles</button></div>' +
      K.footer();
    app.querySelectorAll('[data-field]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        state.answers[s.id] = state.answers[s.id] || {};
        state.answers[s.id][inp.getAttribute('data-field')] = inp.value;
        save();
      });
    });
    app.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () { formView(Number(b.getAttribute('data-step'))); });
    });
    app.querySelector('[data-back]').addEventListener('click', function () { if (k) formView(k - 1); });
    app.querySelector('[data-next]').addEventListener('click', function () { if (k === steps.length - 1) styleView(); else formView(k + 1); });
    app.querySelector('[data-skip]').addEventListener('click', styleView);
    ToyKit.bind(app, app.querySelector('[data-soon-msg]'));
    window.scrollTo(0, 0);
  }

  // ---------- 2. Pick a style ----------

  // Loads a template's fonts. Thumbnails only need a few letters.
  function loadFonts(t, text) {
    var key = t.id + (text ? ':' + text : '');
    if (fontsLoaded[key]) return;
    fontsLoaded[key] = true;
    var fam = function (f, w) { return 'family=' + f.replace(/ /g, '+') + (w && w !== 400 ? ':wght@400;' + w : ''); };
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + fam(t.title, t.titleWeight) + (t.body !== t.title ? '&' + fam(t.body, 700) : '') +
      (text ? '&text=' + encodeURIComponent(text) : '') + '&display=swap';
    document.head.appendChild(link);
  }

  function styleView() {
    state.view = 'style';
    save();
    var deck = D.slides(steps, state.answers);
    var cover = deck[0];
    app.innerHTML = head() +
      '<section class="stack stack--tight"><h2 class="title-md">Pick a style</h2><p class="small-print">Tap one to see your whole deck in it.</p>' +
      '<ul class="deck-styles">' + templates.map(function (t) {
        loadFonts(t, unique(cover.name + cover.headline + t.name + 'Slide 0123456789'));
        return '<li><button type="button" class="deck-style' + (t.id === state.template ? ' is-on' : '') + '" data-tpl="' + t.id + '">' + slideHtml(cover, t, deck.length) +
          '<span class="deck-style-name">' + esc(t.name) + '</span></button></li>';
      }).join('') + '</ul></section>' +
      '<button type="button" class="btn btn--block" data-edit>Back to the questions</button>' + K.footer();
    app.querySelectorAll('[data-tpl]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.template = b.getAttribute('data-tpl');
        site.sound.play('pop');
        deckView();
      });
    });
    app.querySelector('[data-edit]').addEventListener('click', function () { formView(state.step || 0); });
    ToyKit.bind(app, app.querySelector('[data-soon-msg]'));
    window.scrollTo(0, 0);
  }

  function unique(s) {
    var seen = {};
    return String(s).split('').filter(function (c) { if (seen[c]) return false; seen[c] = true; return true; }).join('');
  }

  // ---------- 3. The deck ----------

  function slideHtml(s, t, total) {
    var vars = '--bg:' + t.bg + ';--fg:' + t.fg + ';--ac:' + t.accent + ';--ac2:' + t.accent2 + ";--tf:'" + t.title + "';--bf:'" + t.body + "';--tw:" + t.titleWeight;
    var cover = s.id === 'cover';
    return '<div class="slide deco-' + t.deco + (cover ? ' slide--cover' : '') + '" style="' + vars + '">' +
      '<span class="slide-deco" aria-hidden="true"></span>' +
      (cover
        ? '<h2 class="slide-title">' + esc(s.name) + '</h2>' + (s.headline ? '<p class="slide-sub">' + esc(s.headline) + '</p>' : '')
        : '<p class="slide-kicker">' + esc(s.kicker) + '</p>' + (s.headline ? '<h2 class="slide-title">' + esc(s.headline) + '</h2>' : '')) +
      (s.stats.length ? '<div class="slide-stats">' + s.stats.map(function (x) { return '<div><b>' + esc(x.value) + '</b><span>' + esc(x.label) + '</span></div>'; }).join('') + '</div>' : '') +
      (s.points.length ? '<ul class="slide-points">' + s.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
      '<span class="slide-foot">' + esc(s.project) + ' · ' + s.number + '/' + total + '</span></div>';
  }

  function deckView() {
    state.view = 'deck';
    save();
    var t = tpl();
    loadFonts(t);
    var deck = D.slides(steps, state.answers);
    app.innerHTML = head() +
      '<div class="btn-row"><button type="button" class="btn" data-edit>Edit answers</button><button type="button" class="btn" data-style>Change style</button></div>' +
      '<p class="small-print">Style: <strong>' + esc(t.name) + '</strong> · ' + deck.length + ' slides</p>' +
      '<div class="deck-list">' + deck.map(function (s, i) {
        return '<figure class="deck-item">' + slideHtml(s, t, deck.length) +
          '<figcaption><button type="button" class="text-button" data-png="' + i + '">Download slide ' + (i + 1) + ' as PNG</button></figcaption></figure>';
      }).join('') + '</div>' +
      K.actions() + K.footer();
    app.querySelector('[data-edit]').addEventListener('click', function () { formView(state.step || 0); });
    app.querySelector('[data-style]').addEventListener('click', styleView);
    app.querySelectorAll('[data-png]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-png'));
        pngOf([deck[i]], t, deck.length, (deck[0].name || 'deck').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-slide-' + (i + 1) + '.png');
      });
    });
    K.bind(app, {
      pdf: function () { pdf(deck, t); },
      png: function () { pngOf(deck, t, deck.length, (deck[0].name || 'deck').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-deck.png'); },
      copy: function () { return D.outline(deck) + '\n\nMade with web3.toys.'; },
      reset: function () {
        saved.clear();
        state = { answers: {}, step: 0, template: '', view: 'form' };
        show();
      },
    });
    window.scrollTo(0, 0);
  }

  function pdf(deck, t) {
    K.printSheet('<div class="print-deck">' + deck.map(function (s) { return slideHtml(s, t, deck.length); }).join('') + '</div>');
    document.body.classList.add('is-printing-deck');
    window.addEventListener('afterprint', function done() {
      document.body.classList.remove('is-printing-deck');
      window.removeEventListener('afterprint', done);
    });
    C.track('tool_export', { tool: 'pitch-deck', format: 'pdf' });
  }

  // ---------- PNG: slides drawn on a canvas ----------

  function pngOf(list, t, total, filename) {
    var W = 1600;
    var H = 900;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H * list.length;
    var ctx = canvas.getContext('2d');
    var tf = "'" + t.title + "', sans-serif";
    var bf = "'" + t.body + "', sans-serif";
    var ready = document.fonts ? Promise.all([document.fonts.load(t.titleWeight + ' 80px ' + tf), document.fonts.load('400 40px ' + bf), document.fonts.load('700 40px ' + bf)]).catch(function () {}) : Promise.resolve();
    ready.then(function () {
      list.forEach(function (s, i) { drawSlide(ctx, 0, i * H, W, H, s, t, total, tf, bf); });
      K.downloadCanvas(canvas, filename);
      C.track('tool_export', { tool: 'pitch-deck', format: 'png' });
    });
  }

  function drawSlide(ctx, x, y, W, H, s, t, total, tf, bf) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, W, H);
    // A simple version of the template's decoration.
    ctx.fillStyle = t.accent;
    ctx.fillRect(0, 0, 28, H);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = t.accent2;
    ctx.beginPath();
    ctx.arc(W - 120, 120, 180, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.fg;
    ctx.textBaseline = 'top';
    var X = 110;
    var yy = s.id === 'cover' ? 280 : 110;
    var wrap = function (text, font, size, lh, maxLines) {
      ctx.font = font.replace('{s}', size);
      var words = String(text).split(' ');
      var line = '';
      var n = 0;
      words.forEach(function (w) {
        var tt = line ? line + ' ' + w : w;
        if (ctx.measureText(tt).width > W - X - 140 && line) {
          if (n < maxLines) ctx.fillText(line, X, yy);
          yy += lh;
          n++;
          line = w;
        } else {
          line = tt;
        }
      });
      if (line && n < maxLines) {
        ctx.fillText(line, X, yy);
        yy += lh;
      }
    };
    if (s.id === 'cover') {
      wrap(s.name, t.titleWeight + ' {s}px ' + tf, 110, 120, 2);
      if (s.headline) wrap(s.headline, '400 {s}px ' + bf, 48, 60, 2);
    } else {
      ctx.fillStyle = t.accent;
      ctx.font = '700 34px ' + bf;
      ctx.fillText(s.kicker.toUpperCase(), X, yy);
      yy += 70;
      ctx.fillStyle = t.fg;
      if (s.headline) wrap(s.headline, t.titleWeight + ' {s}px ' + tf, 72, 86, 3);
      yy += 30;
    }
    if (s.stats.length) {
      var bw = (W - X - 140) / s.stats.length;
      s.stats.forEach(function (st, i) {
        ctx.fillStyle = t.accent;
        ctx.font = t.titleWeight + ' 72px ' + tf;
        ctx.fillText(st.value, X + i * bw, yy);
        ctx.fillStyle = t.fg;
        ctx.font = '400 32px ' + bf;
        ctx.fillText(st.label, X + i * bw, yy + 90);
      });
      yy += 160;
    }
    ctx.fillStyle = t.fg;
    s.points.forEach(function (p) {
      ctx.fillStyle = t.accent;
      ctx.fillRect(X, yy + 16, 18, 18);
      ctx.fillStyle = t.fg;
      var keep = X;
      X += 44;
      wrap(p, '400 {s}px ' + bf, 40, 52, 2);
      X = keep;
      yy += 10;
    });
    ctx.font = '400 26px ' + bf;
    ctx.globalAlpha = 0.7;
    ctx.fillText(s.project + ' · ' + s.number + '/' + total, X, H - 70);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
})();
