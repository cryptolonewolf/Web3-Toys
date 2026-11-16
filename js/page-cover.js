// The banner at the top of a page that is not a toy (the For Projects pages
// and Become a tester): <body data-cover="ID" data-cover-title="Title">, with
// its drawing in js/home-cards.js. It goes inside the page's hero card when
// there is one (the For Projects kit), otherwise first on the page. Pages
// draw themselves after loading, so it is added again whenever it is missing.

(function () {
  var body = document.body;
  var id = body && body.getAttribute('data-cover');
  var app = document.getElementById('app');
  if (!id || !app || !window.Web3Cards) return;
  var title = body.getAttribute('data-cover-title') || document.title.split(/[·|]/)[0].trim();
  var esc = window.Web3Common ? window.Web3Common.esc : function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var busy = false;
  function place() {
    if (busy || app.querySelector('.page-cover')) return;
    var first = app.querySelector('.bk-hero') || app.firstElementChild;
    if (!first || first.tagName === 'NOSCRIPT' || first.classList.contains('page-loader')) return;
    busy = true;
    var html = window.Web3Cards.cover(id, title, esc);
    if (first.classList.contains('bk-hero')) first.insertAdjacentHTML('afterbegin', html);
    else first.insertAdjacentHTML('beforebegin', html);
    busy = false;
  }
  new MutationObserver(place).observe(app, { childList: true });
  place();
})();
