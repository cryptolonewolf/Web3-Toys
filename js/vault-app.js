// The Vault Dive (Famous Web3 Hacks): a deep scroll down a vault, one floor
// per hack. Guess the amount before each door opens; a coin pile drains as the
// total lost grows. Ends with a share card, then the quiz and certificate.
// Words: data/web3-hacks.json. Hacks: data/hacks.json. Scoring: js/vault-engine.js.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var sfx = site.sound;
  var V = window.VaultEngine;
  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var SHARE_URL = ((window.WEB3TOYS_CONFIG || {}).siteUrl || 'https://web3.toys') + '/web3-hacks/';

  var T = null;
  var hacks = [];
  var total = 0;
  var lost = 0;
  var score = 0;
  var opened = 0;

  Promise.all([C.loadJson('../data/web3-hacks.json'), C.loadJson('../data/hacks.json')])
    .then(function (r) {
      T = r[0];
      hacks = r[1].hacks;
      T.note = r[1].note;
      total = hacks.reduce(function (s, h) { return s + h.amountUsd; }, 0);
      var toy = { id: T.id, title: T.certTitle };
      // From My Progress, "#certificate" opens the saved certificate.
      if (location.hash === '#certificate' && window.ToyQuiz && ToyQuiz.showSaved(toy)) return;
      if (location.hash === '#quiz') return startQuiz();
      start();
    })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  // ---------- Drawings ----------

  function door() {
    var spokes = '';
    for (var a = 0; a < 360; a += 60) {
      spokes += '<line x1="100" y1="100" x2="' + (100 + 34 * Math.cos(a * Math.PI / 180)).toFixed(1) + '" y2="' + (100 + 34 * Math.sin(a * Math.PI / 180)).toFixed(1) + '"/>';
    }
    return '<svg class="vdoor-svg" viewBox="0 0 200 200" aria-hidden="true">' +
      '<rect x="8" y="8" width="184" height="184" rx="24" fill="#5A5470" stroke="#1F1B2E" stroke-width="6"/>' +
      '<circle cx="100" cy="100" r="78" fill="#B8C4D6" stroke="#1F1B2E" stroke-width="6"/>' +
      '<circle cx="100" cy="100" r="60" fill="#D9E1EC" stroke="#1F1B2E" stroke-width="4"/>' +
      '<g class="vdoor-wheel" stroke="#1F1B2E" stroke-width="8" stroke-linecap="round">' + spokes + '<circle cx="100" cy="100" r="12" fill="#FFD93D" stroke-width="5"/></g>' +
      '<rect x="176" y="70" width="14" height="60" rx="5" fill="#FFD93D" stroke="#1F1B2E" stroke-width="4"/></svg>';
  }

  // The coin pile: fuller while little has been lost, emptier as it drains.
  function pile(share) {
    var rows = [7, 6, 5, 4, 3, 2, 1];
    var left = Math.round(rows.reduce(function (a, b) { return a + b; }, 0) * (1 - share));
    var coins = '';
    var y = 92;
    rows.forEach(function (n) {
      var x0 = 60 - n * 7;
      for (var i = 0; i < n; i++) {
        if (left <= 0) break;
        left--;
        coins += '<ellipse cx="' + (x0 + i * 14 + 7) + '" cy="' + y + '" rx="7" ry="3.2" fill="#FFD93D" stroke="#1F1B2E" stroke-width="1.5"/>';
      }
      y -= 8;
    });
    return '<svg class="vpile-svg" viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="96" rx="54" ry="4" fill="#1F1B2E" opacity=".2"/>' + coins + '</svg>';
  }

  function hud() {
    return '<div class="vhud-pile">' + pile(lost / total) + '</div>' +
      '<div class="vhud-text"><p class="label">' + esc(T.pileLabel) + '</p><p class="vhud-lost">' + V.money(lost) + '</p></div>' +
      '<div class="vhud-side"><p class="small-print">Floor ' + Math.min(opened + 1, hacks.length) + ' of ' + hacks.length + '</p>' +
      '<p class="small-print">Score ' + score + '</p></div>';
  }

  function updateHud() {
    var el = app.querySelector('[data-hud]');
    if (el) el.innerHTML = hud();
  }

  // ---------- Start ----------

  function start() {
    app.innerHTML =
      '<section class="vtop"><h1 class="vtitle">' + esc(T.title) + '</h1>' +
      '<p class="text text--ink">' + esc(T.intro) + '</p>' +
      '<div class="vtop-art">' + door() + pile(0) + '</div>' +
      '<button type="button" class="btn btn--ink btn--block" data-dive>' + esc(T.startButton) + ' ↓</button>' +
      '<p class="small-print">' + esc(T.note) + '</p></section>' +
      '<div class="vhud" data-hud aria-live="polite">' + hud() + '</div>' +
      '<div class="vfloors" data-floors></div>';
    pill.textContent = 'Floor 1 of ' + hacks.length;
    addFloor(0);
    app.querySelector('[data-dive]').addEventListener('click', function () {
      sfx.play('pop');
      document.getElementById('floor-0').scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'start' });
    });
  }

  // ---------- Floors ----------

  function addFloor(k) {
    var h = hacks[k];
    var depth = (k + 1) / hacks.length;
    var mid = Math.round(V.STEPS * 0.45);
    var wrap = document.createElement('section');
    wrap.className = 'vfloor' + (depth > 0.45 ? ' is-deep' : '');
    wrap.id = 'floor-' + k;
    wrap.style.setProperty('--depth', depth.toFixed(2));
    wrap.setAttribute('aria-label', 'Floor ' + (k + 1) + ': ' + h.name);
    wrap.innerHTML =
      '<p class="vlevel">Floor B' + (k + 1) + '</p>' +
      '<div class="vdoor" data-door>' + door() + '</div>' +
      '<div class="card vcard stack stack--tight" data-card>' +
      '<p class="label">' + esc(h.year) + '</p><h2 class="title-lg">' + esc(h.name) + '</h2>' +
      '<label class="title-sm" for="guess-' + k + '">' + esc(T.guessQuestion) + '</label>' +
      '<p class="vguess-amount" data-amount aria-hidden="true">' + V.money(V.sliderToAmount(mid)) + '</p>' +
      '<input id="guess-' + k + '" class="ride-slider" type="range" min="0" max="' + V.STEPS + '" step="1" value="' + mid + '" />' +
      '<div class="vscale small-print" aria-hidden="true"><span>$1M</span><span>$3B</span></div>' +
      '<button type="button" class="btn btn--ink btn--block" data-lock>' + esc(T.lockButton) + '</button></div>';
    app.querySelector('[data-floors]').appendChild(wrap);
    var slider = wrap.querySelector('input');
    var label = wrap.querySelector('[data-amount]');
    var say = function () {
      var amount = V.money(V.sliderToAmount(Number(slider.value)));
      label.textContent = amount;
      slider.setAttribute('aria-valuetext', amount);
    };
    say();
    slider.addEventListener('input', function () { say(); sfx.play('tick'); });
    wrap.querySelector('[data-lock]').addEventListener('click', function () { reveal(k, V.sliderToAmount(Number(slider.value))); });
  }

  function reveal(k, guess) {
    var h = hacks[k];
    var wrap = document.getElementById('floor-' + k);
    var pts = V.points(guess, h.amountUsd, T.closeRatio, T.farRatio);
    score += pts;
    lost += h.amountUsd;
    opened = k + 1;
    C.track('vault_floor', { hack: h.id, points: pts });

    var doorEl = wrap.querySelector('[data-door]');
    doorEl.classList.add('is-open');
    sfx.play('clunk');
    setTimeout(function () { sfx.play(pts >= 50 ? 'cash' : 'buzz'); }, 250);
    site.fx.coins(doorEl, 8);

    wrap.querySelector('[data-card]').outerHTML =
      '<div class="card vcard vcard--open stack stack--tight">' +
      '<p class="label">' + esc(h.year) + '</p><h2 class="title-lg">' + esc(h.name) + '</h2>' +
      '<p class="vlost">' + V.money(h.amountUsd) + ' lost</p>' +
      '<p class="vpoints' + (pts >= 50 ? ' is-good' : '') + '">' + esc(fill(T.pointsLine, { guess: V.money(guess), points: pts })) + '</p>' +
      '<p class="text text--ink">' + esc(h.what) + '</p>' +
      (h.returned ? '<p class="small-print">↩ ' + esc(h.returned) + '</p>' : '') +
      '<p class="tip">' + site.icon('bulb') + '<strong>Lesson:</strong> ' + esc(h.lesson) + '</p>' +
      '<p class="small-print">Source: ' + h.sources.map(function (s) {
        return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>';
      }).join(', ') + '</p></div>';
    updateHud();
    pill.textContent = k + 1 < hacks.length ? 'Floor ' + (k + 2) + ' of ' + hacks.length : 'Bottom';

    if (k + 1 < hacks.length) {
      wrap.insertAdjacentHTML('beforeend', '<p class="vscroll" aria-hidden="true">' + esc(T.scrollHint) + ' ↓</p>');
      addFloor(k + 1);
    } else {
      bottom();
    }
  }

  // ---------- The bottom ----------

  function bottom() {
    var max = hacks.length * 100;
    var rank = V.rankFor(score, max, T.ranks);
    var card = shareCard(rank);
    var floors = app.querySelector('[data-floors]');
    floors.insertAdjacentHTML('beforeend',
      '<section class="vbottom stack" id="vault-bottom">' +
      '<div class="card card--hero stack stack--tight"><p class="label">' + esc(T.bottomTitle) + '</p>' +
      '<h2 class="title-xl">' + V.money(total) + '</h2>' +
      '<p class="text text--ink">' + esc(fill(T.bottomLine, { total: V.money(total), n: hacks.length })) + '</p>' +
      '<p class="text text--ink"><strong>Your guessing score: ' + score + ' of ' + max + '. Rank: ' + esc(rank.name) + '.</strong></p></div>' +
      '<p class="tip">' + site.icon('shield') + esc(T.bottomLesson) + '</p>' +
      '<button type="button" class="btn btn--ink btn--block" data-quiz>' + esc(T.quizButton) + '</button>' +
      '<h2 class="section-title">Your share card</h2>' +
      '<img class="share-preview" data-preview alt="Share card: ' + esc(rank.name) + ', score ' + score + '" />' +
      '<div class="btn-row"><button type="button" class="btn" data-share>Share</button>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(shareText(rank)) + '">Post on X</a></div>' +
      '</section>');
    sfx.play('ding');
    if (score >= max * 0.7) site.fx.confetti();
    site.coins.award('finish', 'web3-hacks', 'Reached the bottom of the Vault Dive');
    C.track('vault_finished', { score: score, rank: rank.name });
    card.ready.then(function () {
      var img = app.querySelector('[data-preview]');
      if (img) img.src = card.canvas.toDataURL('image/png');
    }).catch(function () {});
    app.querySelector('[data-share]').addEventListener('click', function () { card.share(); });
    app.querySelector('[data-quiz]').addEventListener('click', startQuiz);
  }

  function shareText(rank) {
    return fill(T.share.text, { n: hacks.length, score: score + '/' + hacks.length * 100, rank: rank.name, link: SHARE_URL });
  }

  function shareCard(rank) {
    var canvas = document.createElement('canvas');
    var ready = ToyKit.drawShareCard(canvas, {
      title: T.share.title,
      big: String(score),
      bigLabel: 'of ' + hacks.length * 100,
      rank: rank.name,
      line: V.money(total) + ' lost in ' + hacks.length + ' famous hacks. How close can you guess?',
      cta: T.share.cta,
      mascotSrc: site.mascotSrc('worried'),
    });
    return {
      ready: ready,
      canvas: canvas,
      share: function () { return ready.then(function () { return ToyKit.share(canvas, shareText(rank), 'vault-dive.png'); }); },
    };
  }

  // ---------- Quiz and certificate (shared with the other learning toys) ----------

  function startQuiz() {
    var toy = { id: T.id, title: T.certTitle };
    ToyQuiz.start(toy, {
      app: app,
      pill: pill,
      backToCards: function () {
        location.hash = '';
        location.reload();
      },
    });
  }
})();
