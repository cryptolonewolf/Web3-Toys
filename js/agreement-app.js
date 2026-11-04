// SAFT and Agreement Templates: pick a template, fill the form, get the
// filled document as a PDF, a Word file or copied text. Template text lives
// in data/tools/templates/. Fill logic: js/agreement-engine.js.

(function () {
  var C = window.Web3Common;
  var E = window.AgreementEngine;
  var K = window.ToolKit;
  var esc = K.esc;
  var app = document.getElementById('app');
  var saved = K.store('agreements');
  var base = '../../data/tools/templates/';
  var index = null;
  var tpls = {};
  var state = null;

  C.loadJson(base + 'index.json').then(function (data) {
    index = data;
    return Promise.all(index.templates.map(function (t) {
      return C.loadJson(base + t.id + '.json').then(function (d) { tpls[t.id] = d; });
    }));
  }).then(function () {
    state = saved.load() || { id: index.templates[0].id, values: {} };
    if (!tpls[state.id]) state.id = index.templates[0].id;
    render();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function values() {
    var v = state.values[state.id] || (state.values[state.id] = {});
    if (!v.date) v.date = today();
    return v;
  }

  function warnBox() {
    return '<div class="ag-warn" role="note"><span aria-hidden="true">⚖️</span><p>' + esc(index.warning) + '</p></div>';
  }

  function render() {
    var tpl = tpls[state.id];
    var v = values();
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">SAFT and Agreement Templates</h1>' +
      '<p class="text text--ink">Pick a template, fill in the blanks, download a filled document.</p>' + K.notes() + '</section>' +
      warnBox() +
      '<div class="ag-pick" role="group" aria-label="Choose a template">' + index.templates.map(function (t) {
        return '<button type="button" class="ag-tab' + (t.id === state.id ? ' is-on' : '') + '" data-pick="' + t.id + '" aria-pressed="' + (t.id === state.id) + '">' +
          '<span class="ag-emoji" aria-hidden="true">' + t.emoji + '</span><b>' + esc(t.title) + '</b><span class="small-print">' + esc(t.line) + '</span></button>';
      }).join('') + '</div>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Fill in the blanks</h2><div class="tool-grid3">' +
      tpl.fields.map(function (f) {
        var id = 'ag-' + f.key;
        var input = f.type === 'textarea'
          ? '<textarea id="' + id + '" class="field" rows="3" maxlength="600" data-in="' + f.key + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(v[f.key] || '') + '</textarea>'
          : '<input id="' + id + '" class="field" type="' + (f.type === 'date' ? 'date' : 'text') + '" maxlength="200" data-in="' + f.key + '" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(v[f.key] || '') + '" />';
        return '<div class="stack stack--tight' + (f.type === 'textarea' ? ' ag-wide' : '') + '"><label class="label" for="' + id + '">' + esc(f.label) + '</label>' + input + '</div>';
      }).join('') + '</div><p class="small-print" data-missing aria-live="polite"></p></section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">Your document</h2><div class="ag-doc" data-doc data-out></div></section>' +
      warnBox() +
      K.actions({ png: false, extra: [{ id: 'word', label: 'Download Word file' }] }) + K.footer();

    app.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.id = b.getAttribute('data-pick');
        render();
        window.WEB3TOYS.sound.play('pop');
      });
    });
    app.querySelectorAll('[data-in]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        values()[inp.getAttribute('data-in')] = inp.value;
        update();
      });
    });
    K.bind(app, {
      pdf: function () { K.printSheet(docHtml(false)); C.track('tool_export', { tool: 'agreements', format: 'pdf' }); },
      word: word,
      copy: function () { return E.text(tpls[state.id], values(), index.warning); },
      reset: function () { delete state.values[state.id]; render(); },
    });
    update();
  }

  function docHtml(marks) {
    var wrap = function (v, filled) { return marks ? '<mark class="' + (filled ? 'ag-filled' : 'ag-blank') + '">' + v + '</mark>' : v; };
    var d = E.doc(tpls[state.id], values(), esc, wrap);
    var warn = '<p class="ag-doc-warn"><strong>' + esc(index.warning) + '</strong></p>';
    return warn + '<h1>' + esc(d.title) + '</h1>' +
      d.sections.map(function (s) { return '<h2>' + esc(s.title) + '</h2>' + s.text.map(function (t) { return '<p>' + t + '</p>'; }).join(''); }).join('') +
      '<h2>Signatures</h2>' + d.signatures.map(function (s) { return '<p class="ag-sign">' + s + '<br>Signature: ____________________ &nbsp; Date: ____________</p>'; }).join('') + warn;
  }

  function update() {
    saved.save(state);
    app.querySelector('[data-doc]').innerHTML = docHtml(true);
    var miss = E.missing(tpls[state.id], values());
    app.querySelector('[data-missing]').textContent = miss.length ? 'Still blank: ' + miss.join(', ') + '.' : 'All blanks filled.';
  }

  // A Word file is an HTML page with a Word content type: Word and Google
  // Docs open it and it stays editable for the lawyer.
  function word() {
    var html = '<html><head><meta charset="utf-8"><title>' + esc(tpls[state.id].title) + '</title>' +
      '<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4}h1{font-size:18pt}h2{font-size:13pt;margin-top:14pt}.ag-doc-warn{border:2pt solid #000;padding:8pt;font-size:13pt}</style></head><body>' +
      docHtml(false) + '<p><em>' + esc(K.footLine()) + '</em></p></body></html>';
    var blob = new Blob(['﻿', html], { type: 'application/msword' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = state.id + '-agreement.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    C.track('tool_export', { tool: 'agreements', format: 'word' });
    return 'Downloaded. Open it in Word or Google Docs.';
  }
})();
