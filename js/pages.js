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
        msg.textContent = data.form.soon;
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

  function books(data) {
    app.innerHTML = hero(data, 'grin') +
      '<ul class="book-grid">' + data.books.map(function (b) {
        return '<li><article class="card book-card">' + bookCover(b) +
          '<div class="shop-info"><h2 class="title-sm">' + esc(b.title) + '</h2>' +
          '<p class="text">' + esc(b.line) + '</p><p class="price">' + esc(b.price) + '</p>' + buyButton(b) + '</div></article></li>';
      }).join('') + '</ul>';
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

  function bookCall(data) {
    var url = CONFIG.bookCallUrl;
    var button = url
      ? '<a class="btn btn--ink btn--block" href="' + esc(url) + '" target="_blank" rel="noopener" data-book>' + site.icon('call') + esc(data.button) + '</a>'
      : '<button type="button" class="btn btn--ink btn--block" data-book>' + site.icon('call') + esc(data.button) + '</button>';
    app.innerHTML = hero(data, 'grin') +
      '<h2 class="section-title">' + esc(data.getTitle) + '</h2>' +
      '<ul class="perk-grid">' + data.get.map(function (g) {
        return '<li><div class="card perk"><span class="icon-badge">' + site.icon(g.icon) + '</span>' +
          '<div class="stack stack--tight"><h3 class="title-sm">' + esc(g.title) + '</h3><p class="text">' + esc(g.text) + '</p></div></div></li>';
      }).join('') + '</ul>' +
      '<section class="card stack stack--tight"><h2 class="title-md">' + esc(data.forTitle) + '</h2>' +
      '<ul class="lesson-points">' + data['for'].map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></section>' +
      '<section class="card card--yellow stack stack--tight"><h2 class="title-md">' + esc(data.priceTitle) + '</h2>' +
      '<p class="price">' + words(data.price) + '</p><p class="small-print">' + esc(data.priceNote) + '</p>' + button +
      '<p class="small-print" data-msg aria-live="polite"></p></section>';
    app.querySelector('[data-book]').addEventListener('click', function () {
      C.track('book_call_clicked', { from: 'book-a-call' });
      if (!url) app.querySelector('[data-msg]').textContent = data.soon;
    });
  }
})();
