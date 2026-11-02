// The Privacy, Terms, Refunds and Contact pages. Each page sets data-doc on
// <body>; its words come from data/legal/<doc>.json. The Contact page adds
// the details from config.js (contact).

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var doc = document.body.getAttribute('data-doc');
  var contact = (window.WEB3TOYS_CONFIG || {}).contact || {};

  C.loadJson('../data/legal/' + doc + '.json').then(function (d) {
    var line = function (t) { return /^TODO/.test(t) ? '<span class="todo">' + esc(t) + '</span>' : esc(t); };
    app.innerHTML = '<article class="card legal stack stack--tight">' +
      '<h1 class="title-xl">' + esc(d.title) + '</h1>' +
      (d.updated ? '<p class="small-print">Last updated: ' + esc(d.updated) + '</p>' : '') +
      '<p class="text text--ink">' + esc(d.intro) + '</p>' +
      (doc === 'contact' ? contactBox() : '') +
      d.sections.map(function (s) {
        return '<h2 class="title-md">' + esc(s.title) + '</h2><ul>' + s.list.map(function (l) { return '<li>' + line(l) + '</li>'; }).join('') + '</ul>';
      }).join('') +
      '<p class="small-print legal-links"><a href="../privacy/">Privacy</a> · <a href="../terms/">Terms</a> · <a href="../refunds/">Refunds and delivery</a> · <a href="../contact/">Contact</a></p>' +
      '</article>';
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function contactBox() {
    var row = function (label, value, html) {
      return '<tr><th>' + label + '</th><td>' + (value ? html || esc(value) : '<span class="todo">TODO: add in config.js (contact)</span>') + '</td></tr>';
    };
    return '<table class="tk-table">' +
      row('Email', contact.email, contact.email && '<a href="mailto:' + esc(contact.email) + '">' + esc(contact.email) + '</a>') +
      row('Business name', contact.business) + row('Address', contact.address) + '</table>';
  }
})();
