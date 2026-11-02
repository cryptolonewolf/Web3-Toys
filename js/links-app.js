// Official Links Checker: paste a link, see if its address matches the
// official domain list, looks like one of them, or is not on the list.
// Never says a link is safe. List: data/tools/official_domains.json.
// Logic: js/links-engine.js.

(function () {
  var C = window.Web3Common;
  var E = window.LinksEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('links-checker');
  var cfg = null;
  var state = null;

  C.loadJson('../../data/tools/official_domains.json').then(function (data) {
    cfg = data;
    state = saved.load() || { link: '', recent: [] };
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function render() {
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Official Links Checker</h1>' +
      '<p class="text text--ink">Paste a link. We compare its address with the official domains of well known exchanges, wallets and apps.</p>' + K.notes() + '</section>' +
      '<form class="card stack stack--tight" data-form><label class="title-md" for="lk-in">Paste a link</label>' +
      '<div class="lk-row"><input id="lk-in" class="field" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="500" placeholder="https://" value="' + esc(state.link) + '" />' +
      '<button type="submit" class="btn btn--ink">Check</button></div>' +
      '<p class="small-print">Do not paste anything secret. Only the address part is checked, and nothing leaves your browser.</p></form>' +
      '<div data-out class="stack"></div>' +
      '<section class="card stack stack--tight" data-recent hidden></section>' +
      '<details class="card lk-list"><summary class="title-sm">See our list (' + cfg.entries.length + ' projects)</summary>' +
      cfg.categories.map(function (cat) {
        return '<h3 class="label">' + esc(cat.label) + '</h3><ul>' + cfg.entries.filter(function (e) { return e.category === cat.id; }).map(function (e) {
          return '<li><b>' + esc(e.name) + '</b> ' + e.domains.map(esc).join(', ') + '</li>';
        }).join('') + '</ul>';
      }).join('') + '<p class="small-print">Projects change domains sometimes. Always confirm on their verified accounts.</p></details>' +
      K.actions() + K.footer();

    app.querySelector('[data-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      state.link = app.querySelector('#lk-in').value;
      var r = E.check(state.link, cfg);
      if (r.host) {
        state.recent = [{ host: r.host, kind: r.kind }].concat(state.recent.filter(function (x) { return x.host !== r.host; })).slice(0, 5);
        window.WEB3TOYS.sound.play(r.kind === 'match' ? 'ding' : r.kind === 'similar' ? 'buzz' : 'pop');
      }
      update(true);
    });
    K.bind(app, K.sheetHandlers(model, 'link-check.png', { reset: function () { saved.clear(); state = { link: '', recent: [] }; render(); } }));
    update(false);
  }

  function result() {
    return state.link ? E.check(state.link, cfg) : null;
  }

  function update(focus) {
    saved.save(state);
    var r = result();
    var out = app.querySelector('[data-out]');
    if (!r) {
      out.innerHTML = '';
    } else if (r.kind === 'invalid') {
      out.innerHTML = '<p class="tk-warn is-bad">That does not look like a link. Try something like https://example.com</p>';
    } else {
      var t = cfg.results[r.kind];
      out.innerHTML = '<section class="card lk-result stack stack--tight" style="--c:' + t.color + '" role="status" tabindex="-1">' +
        '<p class="lk-badge">' + (r.kind === 'match' ? '✔' : r.kind === 'similar' ? '⚠' : '?') + ' ' + esc(t.title) + '</p>' +
        '<p class="lk-host">' + esc(r.host) + '</p>' +
        '<p class="text text--ink">' + esc(E.fill(t.line, { name: r.name, domain: r.domain })) + '</p>' +
        (r.reasons.length ? '<ul class="kol-list">' + r.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '</section><p class="lk-always">' + esc(cfg.always) + '</p>';
      if (focus) out.querySelector('.lk-result').focus({ preventScroll: true });
    }
    var rec = app.querySelector('[data-recent]');
    rec.hidden = !state.recent.length;
    rec.innerHTML = '<h2 class="title-sm">Recent checks (only in this browser)</h2><ul class="lk-recent">' + state.recent.map(function (x) {
      return '<li><span class="lk-dot" style="--c:' + cfg.results[x.kind].color + '"></span>' + esc(x.host) + ' <span class="small-print">' + esc(cfg.results[x.kind].title) + '</span></li>';
    }).join('') + '</ul>';
  }

  function model() {
    var r = result();
    if (!r || r.kind === 'invalid') {
      return { title: 'Official links check', subtitle: 'No link checked yet.', sections: [{ title: 'Remember', lines: [cfg.always] }] };
    }
    var t = cfg.results[r.kind];
    return {
      title: t.title,
      subtitle: r.host,
      facts: [['Checked on', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })], ['Result', t.title]],
      sections: [{ title: 'What we found', lines: [E.fill(t.line, { name: r.name, domain: r.domain })].concat(r.reasons) }, { title: 'Remember', lines: [cfg.always] }],
    };
  }
})();
