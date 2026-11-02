// Agreement templates: fills {{key}} blanks with what the visitor typed.
// Empty fields stay as [Field label] so nothing is silently left out.
// Works in the browser (window.AgreementEngine) and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgreementEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function labels(tpl) {
    var map = {};
    tpl.fields.forEach(function (f) { map[f.key] = f.label; });
    return map;
  }

  // wrap(value, filled) lets the page mark blanks; text is passed through esc.
  function fill(text, tpl, values, esc, wrap) {
    var names = labels(tpl);
    esc = esc || function (s) { return s; };
    wrap = wrap || function (v) { return v; };
    var parts = String(text).split(/(\{\{\w+\}\})/);
    return parts.map(function (p) {
      var m = /^\{\{(\w+)\}\}$/.exec(p);
      if (!m) return esc(p);
      var v = String((values || {})[m[1]] || '').trim();
      return v ? wrap(esc(v), true) : wrap(esc('[' + (names[m[1]] || m[1]) + ']'), false);
    }).join('');
  }

  function doc(tpl, values, esc, wrap) {
    var f = function (t) { return fill(t, tpl, values, esc, wrap); };
    return {
      title: tpl.title,
      sections: tpl.sections.map(function (s) { return { title: s.title, text: s.text.map(f) }; }),
      signatures: (tpl.signatures || []).map(f),
    };
  }

  function missing(tpl, values) {
    return tpl.fields.filter(function (f) { return !String((values || {})[f.key] || '').trim(); }).map(function (f) { return f.label; });
  }

  function text(tpl, values, warning) {
    var d = doc(tpl, values);
    return [warning, '', d.title.toUpperCase(), ''].concat(
      d.sections.reduce(function (a, s) { return a.concat([s.title], s.text, ['']); }, []),
      ['Signatures', ''],
      d.signatures.reduce(function (a, s) { return a.concat([s, 'Signature: ____________________   Date: ____________', '']); }, []),
      [warning]
    ).join('\n');
  }

  return { fill: fill, doc: doc, missing: missing, text: text };
});
