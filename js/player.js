// The toy player: shows a toy's cards one at a time, then hands over to the
// quiz. Content comes from data/toys/<toy>.json. Each toy page sets
// data-toy="<toy id>" on <body>.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var bar = document.getElementById('progress');
  var toyId = document.body.getAttribute('data-toy');
  var site = window.WEB3TOYS;

  // A small badge naming each card type, and a doodle in the card's corner.
  var KINDS = {
    story: { label: 'Story', icon: 'book' },
    reveal: { label: 'Tap to flip', icon: 'eye' },
    pick: { label: 'Quick check', icon: 'quiz' },
    steps: { label: 'Step by step', icon: 'steps' },
    trending: { label: 'Trending', icon: 'flame' },
  };
  var DOODLES = ['coin', 'block', 'key', 'star', 'chain', 'rocket'];

  var toy = null;
  var trending = null;
  var index = 0;
  var shown = -1;
  var answered = {}; // pick cards answered, by card index

  C.loadJson('../data/toys/' + toyId + '.json')
    .then(function (data) {
      toy = data;
      // Opening "#certificate" (from My Progress) jumps to the saved certificate.
      if (location.hash === '#certificate' && window.ToyQuiz && ToyQuiz.showSaved(toy)) return;
      if (location.hash === '#quiz') return startQuiz();
      show(0);
    })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function paragraphs(text) {
    return [].concat(text || []).map(function (p) { return '<p class="text text--ink">' + esc(p) + '</p>'; }).join('');
  }

  function guide(card) {
    if (!card.aki) return '';
    return '<div class="guide">' + site.face(card.mascot || 'grin') + '<p class="guide-bubble">' + esc(card.aki) + '</p></div>';
  }

  function extras(card) {
    return (card.points ? '<ul class="lesson-points">' + card.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '') +
      (card.tip ? '<p class="tip">' + site.icon('bulb') + '<strong>Aki\'s tip:</strong> ' + esc(card.tip) + '</p>' : '') +
      (card.link ? '<a class="btn btn--block" href="' + esc(card.link.href) + '">' + esc(card.link.label) + '</a>' : '');
  }

  function body(card, i) {
    if (card.type === 'reveal') {
      return paragraphs(card.text) + '<div class="reveal-grid">' + card.items.map(function (item, k) {
        return '<button type="button" class="reveal-tile" aria-pressed="false" data-tile="' + k + '">' +
          '<span class="reveal-front">' + esc(item.front) + '<span class="reveal-hint">Tap to reveal</span></span>' +
          '<span class="reveal-back">' + esc(item.back) + '</span></button>';
      }).join('') + '</div>';
    }
    if (card.type === 'pick') {
      var done = answered[i];
      return paragraphs(card.text) + '<div class="stack stack--tight">' + card.options.map(function (o, k) {
        var state = done == null ? '' : o.correct ? ' is-right' : k === done ? ' is-wrong' : '';
        return '<button type="button" class="choice' + state + '" data-option="' + k + '"' + (done != null ? ' disabled' : '') + '>' +
          '<span class="choice-title">' + esc(o.text) + '</span>' +
          (done != null && (o.correct || k === done) ? '<span class="choice-desc">' + esc(o.why || '') + '</span>' : '') + '</button>';
      }).join('') + '</div>';
    }
    if (card.type === 'steps') {
      return paragraphs(card.text) + '<ol class="step-list">' + card.steps.map(function (s, k) {
        return '<li class="step-item' + (k === 0 ? ' is-open' : '') + '" data-step="' + k + '">' +
          '<button type="button" class="step-head" aria-expanded="' + (k === 0) + '">' + esc(s.label) + '</button>' +
          '<p class="text text--ink step-body">' + esc(s.text) + '</p></li>';
      }).join('') + '</ol>';
    }
    if (card.type === 'trending') {
      if (!trending) return '<p class="text" data-trending>Loading what is trending…</p>';
      return '<p class="small-print">' + esc(trending.title) + ' · updated ' + esc(trending.updated) + '</p>' +
        '<ul class="trend-list">' + trending.items.map(function (t) {
          return '<li class="trend-item"><div class="chips"><span class="chip is-blue">' + esc(t.tag) + '</span></div>' +
            '<h3 class="title-sm">' + esc(t.name) + '</h3><p class="text">' + esc(t.why) + '</p></li>';
        }).join('') + '</ul><p class="small-print">' + esc(trending.note) + '</p>';
    }
    return paragraphs(card.text);
  }

  function show(i) {
    index = i;
    var card = toy.cards[i];
    var last = i === toy.cards.length - 1;
    var mustAnswer = card.type === 'pick' && answered[i] == null;

    pill.textContent = 'Card ' + (i + 1) + ' of ' + toy.cards.length;
    pill.className = 'pill is-yellow';
    bar.hidden = false;
    bar.innerHTML = toy.cards.map(function (_, k) { return '<span class="' + (k <= i ? 'done' : '') + '"></span>'; }).join('') + '<span></span>';

    app.innerHTML =
      guide(card) +
      '<section class="card lesson-card stack stack--tight">' +
      '<span class="card-kind">' + site.icon((KINDS[card.type] || KINDS.story).icon) + (KINDS[card.type] || KINDS.story).label + '</span>' +
      site.icon(DOODLES[i % DOODLES.length], 'doodle') +
      // Questions stay in the plain font so they are easy to read.
      '<h1 class="title-lg' + (card.type === 'pick' ? '' : ' toy-font') + '">' + esc(card.title) + '</h1>' + body(card, i) + extras(card) + '</section>' +
      '<div class="sticky-bar"><div class="btn-row">' +
      '<button type="button" class="btn" data-back' + (i === 0 ? ' disabled' : '') + '>Back</button>' +
      '<button type="button" class="btn btn--ink" data-next' + (mustAnswer ? ' disabled' : '') + '>' + (last ? 'Take the quiz' : 'Next') + '</button>' +
      '</div>' + (mustAnswer ? '<p class="small-print center">Pick an answer to continue.</p>' : '') + '</div>';

    // Answering a pick card draws the same card again; stay where you are then.
    if (i !== shown) {
      window.scrollTo(0, 0);
      var h = app.querySelector('h1');
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    shown = i;

    wire(card, i, last);
  }

  function wire(card, i, last) {
    app.querySelector('[data-back]').addEventListener('click', function () { if (i > 0) show(i - 1); });
    app.querySelector('[data-next]').addEventListener('click', function () {
      if (last) startQuiz();
      else show(i + 1);
    });
    app.querySelectorAll('[data-tile]').forEach(function (tile) {
      tile.addEventListener('click', function () {
        tile.setAttribute('aria-pressed', String(tile.getAttribute('aria-pressed') !== 'true'));
      });
    });
    app.querySelectorAll('[data-option]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = Number(btn.getAttribute('data-option'));
        answered[i] = k;
        show(i);
        var picked = app.querySelector('[data-option="' + k + '"]');
        if (card.options[k].correct) site.fx.coins(picked);
        else site.fx.wobble(picked);
      });
    });
    app.querySelectorAll('.step-head').forEach(function (head) {
      head.addEventListener('click', function () {
        var item = head.parentNode;
        var open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', String(open));
      });
    });
    if (card.type === 'trending' && !trending) {
      C.loadJson('../data/trending.json').then(function (t) {
        trending = t;
        if (index === i) show(i);
      }).catch(function () {
        var el = app.querySelector('[data-trending]');
        if (el) el.textContent = 'The trending list could not load right now.';
      });
    }
  }

  function startQuiz() {
    shown = -1;
    bar.hidden = true;
    if (window.ToyQuiz) ToyQuiz.start(toy, { app: app, pill: pill, backToCards: function () { show(toy.cards.length - 1); } });
    else app.innerHTML = '<section class="card"><p class="text">The quiz is coming soon.</p></section>';
  }

  document.addEventListener('keydown', function (e) {
    if (!toy || !app.querySelector('[data-next]')) return;
    if (e.key === 'ArrowRight') app.querySelector('[data-next]').click();
    if (e.key === 'ArrowLeft') app.querySelector('[data-back]').click();
  });
})();
