// Paid offers on finish screens. A page marks a spot with
//   <section class="offers" data-offers="quiz-passed" data-item="crypto-in-5"></section>
// (ToyKit.offersSlot makes one) and this fills it with 1 to 3 offers from
// data/offers.json, priced from data/products.json in the visitor's
// currency, with the coin price too. Never blocks play.
// Pages say how to deliver what was bought with
//   Web3Offers.deliver('report-full', function (item) { ... })
// Loaded on every page by js/site.js.

(function () {
  var site = window.WEB3TOYS;
  var ROOT = site.root;
  var data = null;
  var products = null;
  var handlers = {};
  var owned = {};
  var tester = false; // approved testers get every full report free (supabase/016_tests.sql)
  function has(id, item) { return !!owned[key(id, item)] || (tester && id === 'report-full'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function loadData() {
    if (data) return Promise.resolve();
    return Promise.all([
      fetch(ROOT + 'data/offers.json').then(function (r) { return r.json(); }),
      fetch(ROOT + 'data/products.json').then(function (r) { return r.json(); }),
    ]).then(function (r) { data = r[0]; products = r[1].products; });
  }

  function product(id) {
    return products.filter(function (p) { return p.id === id; })[0];
  }

  function currency() {
    return window.Web3Pay ? window.Web3Pay.currency() : 'USD';
  }

  function price(p) {
    if (window.Web3Pay) return window.Web3Pay.price(p, currency());
    return '$' + p.usd;
  }

  // Which offers a slot shows: products that exist, at most 3.
  function pick(kind, item) {
    var list = (data.slots[kind] || []).map(function (id) {
      if (id === 'book') return { id: data.books[item], kind: 'book' };
      if (id === 'call') return { id: 'call', kind: 'call' };
      return { id: id, kind: 'product' };
    }).filter(function (o) { return o.kind === 'call' || (o.id && product(o.id)); });
    return list.slice(0, 3);
  }

  function key(id, item) {
    return id + '|' + (item || '');
  }

  function card(o, item) {
    if (o.kind === 'call') {
      var url = (window.WEB3TOYS_SITE || {}).callUrl || ROOT + 'book-a-call/';
      return '<li class="offer"><span class="offer-icon" aria-hidden="true">📞</span><div><b>' + esc(data.call.title) + '</b><span class="small-print">' + esc(data.call.line) + '</span></div>' +
        '<a class="btn btn--small" href="' + esc(url) + '"' + (/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(data.buttons.call) + '</a></li>';
    }
    var p = product(o.id);
    var forItem = p.perItem ? item : null;
    var have = has(p.id, forItem);
    var icon = { book: '📘', report: '📄', certificate: '🏅', export: '🎨' }[p.type] || '✨';
    var label = have ? (data.owned[o.kind === 'book' ? 'book' : p.id] || 'Open') : (data.buttons[o.kind === 'book' ? 'book' : p.id] || 'Get it');
    return '<li class="offer' + (have ? ' is-owned' : '') + '"><span class="offer-icon" aria-hidden="true">' + icon + '</span><div><b>' + esc(p.title) + '</b>' +
      '<span class="small-print">' + esc(p.line || '') + '</span>' +
      (have ? '<span class="offer-price">Yours ✓</span>' : '<span class="offer-price">' + esc(price(p)) + (p.coins ? ' <span class="small-print">or ' + p.coins.toLocaleString('en-US') + ' coins</span>' : '') + '</span>') + '</div>' +
      '<button type="button" class="btn btn--small' + (have ? ' btn--yellow' : '') + '" data-offer="' + esc(p.id) + '" data-offer-item="' + esc(forItem || '') + '">' + esc(label) + '</button></li>';
  }

  function fill(slot) {
    var kind = slot.getAttribute('data-offers');
    var item = slot.getAttribute('data-item') || '';
    var list = pick(kind, item);
    if (!list.length) { slot.hidden = true; return; }
    slot.innerHTML = '<h2 class="title-sm">' + esc(data.title) + '</h2><p class="small-print">' + esc(data.line) + '</p>' +
      '<ul class="offer-list">' + list.map(function (o) { return card(o, item); }).join('') + '</ul><p class="small-print" data-offer-msg aria-live="polite"></p>';
    slot.querySelectorAll('[data-offer]').forEach(function (b) {
      b.addEventListener('click', function () { act(slot, b.getAttribute('data-offer'), b.getAttribute('data-offer-item') || null); });
    });
    site.log('offer_view', kind + ':' + item);
  }

  function say(slot, t) {
    var m = slot.querySelector('[data-offer-msg]');
    if (m) m.textContent = t;
  }

  // Use what was bought: the page's handler, or a download for files.
  function use(slot, id, item) {
    var p = product(id);
    if (handlers[id]) return Promise.resolve(handlers[id](item)).catch(function (err) { say(slot, err.message); });
    if (p && p.file && window.Web3Pay) {
      return window.Web3Pay.purchases().then(function (rows) {
        var o = rows.filter(function (x) { return x.status === 'paid' && x.product_id === id; })[0];
        if (o) return window.Web3Pay.download(o.id);
      }).catch(function (err) { say(slot, err.message); });
    }
    say(slot, 'Open My Progress, Purchases, to get it.');
    return Promise.resolve();
  }

  function act(slot, id, item) {
    if (has(id, item)) return use(slot, id, item);
    if (!window.Web3Pay) { say(slot, 'Buying opens soon.'); return; }
    window.Web3Pay.buy(id, item, function () {
      owned[key(id, item)] = true;
      refresh();
      // Things the page delivers itself (a report, a branding box) open
      // straight away, so the Paid box closes first.
      if (handlers[id]) {
        var box = document.querySelector('.pay-modal');
        setTimeout(function () { if (box) box.remove(); use(slot, id, item); }, 900);
      } else {
        use(slot, id, item);
      }
    }).catch(function (err) { if (err.message !== 'login') say(slot, err.message); });
  }

  // What this player already owns (needs an account).
  function loadOwned() {
    if (!window.Web3Pay || !window.Web3Auth || !window.Web3Auth.user()) return Promise.resolve();
    var t = window.Web3Auth.client.rpc('is_tester').then(function (r) { tester = !r.error && r.data === true; }, function () { tester = false; });
    return Promise.all([t, window.Web3Pay.purchases().then(function (rows) {
      owned = {};
      rows.forEach(function (o) { if (o.status === 'paid') owned[key(o.product_id, o.item)] = true; });
    })]).catch(function () {});
  }

  function refresh() {
    if (!data) return;
    document.querySelectorAll('[data-offers]').forEach(fill);
    document.dispatchEvent(new CustomEvent('web3offers:owned'));
  }

  function scan() {
    var slots = document.querySelectorAll('[data-offers]:not([data-filled])');
    if (!slots.length) return;
    loadData().then(function () {
      slots.forEach(function (s) { s.setAttribute('data-filled', ''); fill(s); });
    }).catch(function () { slots.forEach(function (s) { s.hidden = true; }); });
  }

  new MutationObserver(function () { scan(); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('web3pay:ready', function () {
    window.Web3Auth.onChange(function () { loadOwned().then(refresh); });
  });
  document.addEventListener('web3toys:purchased', function () { loadOwned().then(refresh); });

  // Print a report: the browser's print window can save it as a PDF.
  function printHtml(html) {
    var sheet = document.getElementById('print-sheet');
    if (!sheet) {
      sheet = document.createElement('div');
      sheet.id = 'print-sheet';
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = html;
    document.body.classList.add('is-printing');
    var done = function () { document.body.classList.remove('is-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { window.print(); }, 50);
  }

  window.Web3Offers = {
    print: printHtml,
    deliver: function (id, fn) { handlers[id] = fn; },
    owns: function (id, item) { return has(id, item); },
    slot: function (kind, item) { return '<section class="card offers stack stack--tight" data-offers="' + esc(kind) + '" data-item="' + esc(item || '') + '"></section>'; },
    refresh: function () { return loadOwned().then(refresh); },
  };
  (window.__w3deliver || []).forEach(function (h) { handlers[h[0]] = h[1]; });
  window.__w3deliver = [];
  scan();
})();
