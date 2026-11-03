// Builds the Real Toys, Books, About and Book a Call pages. Each page sets
// data-page on <body>; its words come from data/<page>.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var CONFIG = window.WEB3TOYS_CONFIG || {};
  var app = document.getElementById('app');
  var page = document.body.getAttribute('data-page');
  var COLORS = { blue: '#4D9DE0', coral: '#FF6B6B', mint: '#6BCB77', violet: '#A98BFF', yellow: '#FFD93D' };

  C.loadJson('../data/' + page + '.json')
    .then(function (data) { ({ 'real-toys': realToys, books: books, about: about, 'book-a-call': bookCall })[page](data); })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function hero(data, pose) {
    return '<section class="card card--hero page-hero">' +
      '<div class="page-hero-copy stack stack--tight"><p class="label">' + esc(data.label) + '</p>' +
      '<h1 class="title-xl">' + esc(data.title) + '</h1>' +
      (data.text ? '<p class="hero-text">' + esc(data.text) + '</p>' : '') + '</div>' +
      site.mascotImg(pose || 'grin', 'mascot', 96) + '</section>';
  }

  // Lines starting with TODO are placeholders; mark them so they stand out.
  function words(text) {
    return /^TODO/.test(text) ? '<span class="todo">' + esc(text) + '</span>' : esc(text);
  }

  // Empty url: a placeholder button that says Coming soon.
  function buyButton(item) {
    if (!item.url) return '<span class="btn btn--small" aria-disabled="true">Coming soon</span>';
    return '<a class="btn btn--yellow btn--small" href="' + esc(item.url) + '" target="_blank" rel="noopener" data-item="' + esc(item.title) + '">' + esc(item.button || 'Get it') + '</a>';
  }

  // ---------- Real Toys ----------

  var VOTES_KEY = 'web3toys.realtoys.v1';

  function loadVotes() {
    try { return JSON.parse(window.localStorage.getItem(VOTES_KEY)) || {}; } catch (e) { return {}; }
  }

  function saveVotes(v) {
    try { window.localStorage.setItem(VOTES_KEY, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }

  function realToys(data) {
    var votes = loadVotes();
    var signup = CONFIG.signup || {};
    var hidden = Object.keys(signup.hidden || {}).map(function (k) {
      return '<input type="hidden" name="' + esc(k) + '" value="' + esc(signup.hidden[k]) + '" />';
    }).join('');

    app.innerHTML = hero(data, 'grin') +
      '<ul class="concept-grid">' + data.concepts.map(function (t) {
        return '<li><article class="card concept-card">' +
          '<img class="toy-cover" src="../' + esc(t.cover) + '" alt="" width="320" height="240" loading="lazy" />' +
          '<div class="chips"><span class="chip is-white">Concept</span><span class="chip is-yellow">' + esc(t.price) + '</span></div>' +
          '<h2 class="title-md">' + esc(t.name) + '</h2><p class="text text--ink">' + esc(t.line) + '</p>' +
          '<ul class="lesson-points">' + t.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
          '<button type="button" class="btn btn--block vote" data-vote="' + esc(t.id) + '" aria-pressed="' + Boolean(votes[t.id]) + '">' +
          site.icon(votes[t.id] ? 'check' : 'star') + '<span>' + esc(votes[t.id] ? data.voted : data.vote) + '</span></button>' +
          '</article></li>';
      }).join('') + '</ul>' +
      '<form class="card stack stack--tight" data-notify' + (signup.endpoint ? ' action="' + esc(signup.endpoint) + '" method="post" target="_blank"' : '') + '>' +
      '<div class="shop-head">' + site.icon('mail', 'icon--lg') + '<h2 class="title-md">' + esc(data.form.heading) + '</h2></div>' +
      '<p class="text">' + esc(data.form.line) + '</p>' +
      data.concepts.map(function (t) {
        return '<label class="check-row"><input type="checkbox" value="' + esc(t.id) + '" data-pick' + (votes[t.id] ? ' checked' : '') + ' />' + esc(t.name) + '</label>';
      }).join('') +
      '<label class="label" for="notify-email">Your email</label>' +
      '<input id="notify-email" class="field" type="email" name="' + esc(signup.emailField || 'email') + '" placeholder="you@example.com" autocomplete="email" required />' +
      '<input type="hidden" name="interest" value="" data-interest />' + hidden +
      '<button class="btn btn--yellow btn--block" type="submit">' + esc(data.form.button) + '</button>' +
      '<p class="small-print" data-msg aria-live="polite"></p></form>';

    app.querySelectorAll('[data-vote]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-vote');
        var on = !votes[id];
        if (on) votes[id] = true;
        else delete votes[id];
        saveVotes(votes);
        btn.setAttribute('aria-pressed', String(on));
        btn.innerHTML = site.icon(on ? 'check' : 'star') + '<span>' + esc(on ? data.voted : data.vote) + '</span>';
        var box = app.querySelector('[data-pick][value="' + id + '"]');
        if (box) box.checked = on;
        if (on) {
          site.fx.coins(btn);
          C.track('real_toy_vote', { toy: id });
        }
      });
    });

    var form = app.querySelector('[data-notify]');
    form.addEventListener('submit', function (e) {
      var picked = [].slice.call(form.querySelectorAll('[data-pick]:checked')).map(function (b) { return b.value; });
      form.querySelector('[data-interest]').value = picked.join(', ');
      C.track('real_toy_notify', { toys: picked.join(',') || 'none' });
      var msg = form.querySelector('[data-msg]');
      if (!signup.endpoint) {
        e.preventDefault();
        msg.textContent = (CONFIG.supabase || {}).url ? data.form.thanks : data.form.soon;
      } else {
        msg.textContent = data.form.thanks;
      }
      site.fx.confetti();
    });
  }

  // ---------- Books ----------

  function bookCover(b) {
    if (b.cover) return '<div class="book-cover"><img src="../' + esc(b.cover) + '" alt="" loading="lazy" /></div>';
    return '<div class="book-cover" style="--c:' + (COLORS[b.color] || COLORS.yellow) + '">' + site.icon(b.icon || 'book') + '<b>' + esc(b.title) + '</b></div>';
  }

  function sells(b) {
    var pay = CONFIG.payments || {};
    return b.product && (pay.enabled || pay.crypto);
  }

  function books(data) {
    app.innerHTML = hero(data, 'grin') +
      '<ul class="book-grid">' + data.books.map(function (b) {
        return '<li><article class="card book-card">' + bookCover(b) +
          '<div class="shop-info"><h2 class="title-sm">' + esc(b.title) + '</h2>' +
          '<p class="text">' + esc(b.line) + '</p><p class="price"' + (sells(b) ? ' data-price-for="' + esc(b.product) + '"' : '') + '>' + esc(b.price) +
          '</p>' + (sells(b) ? '<button type="button" class="btn btn--yellow btn--small" data-buy="' + esc(b.product) + '">' + esc(b.button || 'Buy') + '</button>' : buyButton(b)) + '</div></article></li>';
      }).join('') + '</ul><p class="small-print" data-buy-msg aria-live="polite"></p>';
    // Paid books go through the site's checkout (js/pay.js).
    var showPrices = function () {
      window.Web3Pay.products().then(function (ps) {
        app.querySelectorAll('[data-price-for]').forEach(function (el) {
          var p = ps.filter(function (x) { return x.id === el.getAttribute('data-price-for'); })[0];
          if (p) el.textContent = window.Web3Pay.price(p, window.Web3Pay.currency());
        });
      });
    };
    if (window.Web3Pay) showPrices();
    else document.addEventListener('web3pay:ready', showPrices);
    app.querySelectorAll('[data-buy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var msg = app.querySelector('[data-buy-msg]');
        C.track('book_buy_clicked', { book: b.getAttribute('data-buy') });
        if (!window.Web3Pay) { msg.textContent = 'Buying opens soon.'; return; }
        window.Web3Pay.buy(b.getAttribute('data-buy')).catch(function (err) { if (err.message !== 'login') msg.textContent = err.message; });
      });
    });
    app.querySelectorAll('[data-item]').forEach(function (a) {
      a.addEventListener('click', function () { C.track('book_clicked', { book: a.getAttribute('data-item') }); });
    });
  }

  // ---------- About Aki ----------

  function about(data) {
    var links = data.links.filter(function (l) { return l.url; });
    app.innerHTML =
      '<section class="card card--hero stack">' +
      '<p class="label">' + esc(data.label) + '</p><h1 class="title-xl">' + esc(data.title) + '</h1>' +
      site.mascotImg('signed', 'about-photo', 320, 'Drawing of Aki in amber sunglasses, signed Build with Aki') + '</section>' +
      '<section class="card stack stack--tight">' + data.paragraphs.map(function (p) { return '<p class="text text--ink">' + words(p) + '</p>'; }).join('') + '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-md">' + esc(data.factsTitle) + '</h2>' +
      '<ul class="lesson-points">' + data.facts.map(function (f) { return '<li>' + words(f) + '</li>'; }).join('') + '</ul></section>' +
      (links.length ? '<div class="btn-row">' + links.map(function (l) {
        return '<a class="btn" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>';
      }).join('') + '</div>' : '') +
      '<a class="btn btn--ink btn--block" href="../book-a-call/">' + site.icon('call') + 'Book a call with Aki</a>';
  }

  // ---------- Book a Call ----------

  // Book a Call: settings under call in config.js. Cal.com mode links to
  // the booking page (Cal.com takes payment). Razorpay mode takes payment
  // here first, then offers Pick your time.
  function calLink(email, orderId) {
    var url = (CONFIG.call || {}).calUrl || '';
    if (!url) return '';
    var q = [];
    if (email) q.push('email=' + encodeURIComponent(email));
    if (orderId) q.push('notes=' + encodeURIComponent('Paid on web3.toys, order ' + orderId));
    return url + (q.length ? (url.indexOf('?') < 0 ? '?' : '&') + q.join('&') : '');
  }

  function bookCall(data) {
    var call = CONFIG.call || {};
    var payFirst = call.mode === 'razorpay';
    var ready = Boolean(call.calUrl) && (!payFirst || ((CONFIG.payments || {}).enabled || (CONFIG.payments || {}).crypto));
    var button = !ready
      ? '<button type="button" class="btn btn--ink btn--block" data-book>' + site.icon('call') + esc(data.button) + '</button>'
      : payFirst
        ? '<button type="button" class="btn btn--ink btn--block" data-pay-call>' + site.icon('call') + esc(data.payButton || 'Pay and pick a time') + '</button>'
        : '<a class="btn btn--ink btn--block" href="' + esc(call.calUrl) + '" target="_blank" rel="noopener" data-book>' + site.icon('call') + esc(data.button) + '</a>';
    app.innerHTML = hero(data, 'grin') +
      '<h2 class="section-title">' + esc(data.getTitle) + '</h2>' +
      '<ul class="perk-grid">' + data.get.map(function (g) {
        return '<li><div class="card perk"><span class="icon-badge">' + site.icon(g.icon) + '</span>' +
          '<div class="stack stack--tight"><h3 class="title-sm">' + esc(g.title) + '</h3><p class="text">' + esc(g.text) + '</p></div></div></li>';
      }).join('') + '</ul>' +
      '<section class="card stack stack--tight"><h2 class="title-md">' + esc(data.forTitle) + '</h2>' +
      '<ul class="lesson-points">' + data['for'].map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></section>' +
      '<section class="card card--yellow stack stack--tight" id="pay"><h2 class="title-md">' + esc(data.priceTitle) + '</h2>' +
      '<p class="price" data-call-price>' + words(data.price) + '</p><p class="small-print">' + esc(payFirst ? data.payNote || data.priceNote : data.priceNote) + '</p>' +
      '<div class="stack stack--tight" data-call-actions>' + button + '</div>' +
      '<p class="small-print" data-msg aria-live="polite"></p></section>';

    var msg = app.querySelector('[data-msg]');
    var actions = app.querySelector('[data-call-actions]');
    var book = app.querySelector('[data-book]');
    if (book) book.addEventListener('click', function () {
      C.track('book_call_clicked', { from: 'book-a-call' });
      if (!ready) msg.textContent = data.soon;
    });

    // The real price, in the visitor's currency, from data/products.json.
    var withPay = function (fn) {
      if (window.Web3Pay) fn(window.Web3Pay);
      else document.addEventListener('web3pay:ready', function () { fn(window.Web3Pay); }, { once: true });
    };
    if (call.product) withPay(function (P) {
      P.products().then(function (ps) {
        var p = ps.filter(function (x) { return x.id === call.product; })[0];
        if (p) app.querySelector('[data-call-price]').textContent = P.price(p, payFirst ? P.currency() : 'USD');
      });
    });

    if (!payFirst || !ready) return;
    var showPick = function (orderId) {
      var A = window.Web3Auth;
      var u = A && A.user();
      actions.innerHTML = '<a class="btn btn--ink btn--block" href="' + esc(calLink(u && u.email, orderId)) + '" target="_blank" rel="noopener">' + site.icon('call') + 'Pick your time</a>' +
        '<p class="small-print">Your call is paid. Pick a time that suits you; the link also stays in My Progress, Purchases.</p>';
    };
    var pay = app.querySelector('[data-pay-call]');
    pay.addEventListener('click', function () {
      if (!window.Web3Pay) { msg.textContent = data.soon; return; }
      window.Web3Pay.buy(call.product, null, function (order) { showPick(order.id); })
        .catch(function (err) { if (err.message !== 'login') msg.textContent = err.message; });
    });
    // Already paid for a call and not booked yet: offer the time picker.
    withPay(function (P) {
      P.purchases().then(function (rows) {
        var paid = rows.filter(function (o) { return o.status === 'paid' && o.product_id === call.product; })[0];
        if (paid) {
          actions.insertAdjacentHTML('afterbegin', '<a class="btn btn--yellow btn--block" href="' + esc(calLink((window.Web3Auth.user() || {}).email, paid.id)) + '" target="_blank" rel="noopener">You have a paid call: pick your time</a>');
        }
      }).catch(function () {});
    });
  }

  window.Web3CallLink = calLink;

})();
