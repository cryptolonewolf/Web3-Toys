// Rug or Real (Read the Token Split): timed swipes on made up token splits.
// Swipe right (Real) if the split looks fair, left (Rug) if it has red
// flags. Words: data/token-split.json. Tokens: data/token_splits.json.
// Rules: js/split-engine.js.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var sfx = site.sound;
  var S = window.SplitEngine;
  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var SHARE_URL = ((window.WEB3TOYS_CONFIG || {}).siteUrl || 'https://web3.toys') + '/token-split/';

  // Slice colours by label, so the same kind of holder always looks the same.
  var COLORS = {
    Team: '#FF6B6B', Investors: '#A98BFF', Advisors: '#FF8FC8', Community: '#6BCB77', Treasury: '#4D9DE0',
    Liquidity: '#FFD93D', Airdrop: '#3CC6C0', Ecosystem: '#8FD694', 'Public sale': '#B5E48C', Presale: '#FF9F43',
    Rewards: '#9BE7A0', 'Mining rewards': '#9BE7A0', Grants: '#7FD8BE', 'Unknown wallet': '#3D3750', 'Marketing wallet': '#E07A5F',
  };

  var T = null;
  var pool = [];
  var game = null;
  var tick = null;

  Promise.all([C.loadJson('../data/token-split.json'), C.loadJson('../data/token_splits.json')])
    .then(function (r) {
      T = r[0];
      pool = r[1].tokens;
      intro();
    })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  function render(html, pillText) {
    clearInterval(tick);
    app.innerHTML = html;
    pill.textContent = pillText;
    window.scrollTo(0, 0);
    var h = app.querySelector('h1');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }

  // ---------- Pie chart ----------

  function pie(slices) {
    var a = -Math.PI / 2;
    var paths = slices.map(function (s) {
      var b = a + (s.pct / 100) * Math.PI * 2;
      var large = b - a > Math.PI ? 1 : 0;
      var p = s.pct >= 100
        ? '<circle cx="100" cy="100" r="88" fill="' + (COLORS[s.label] || '#ccc') + '" stroke="#1F1B2E" stroke-width="4"/>'
        : '<path d="M100 100 L' + (100 + 88 * Math.cos(a)).toFixed(1) + ' ' + (100 + 88 * Math.sin(a)).toFixed(1) +
          ' A88 88 0 ' + large + ' 1 ' + (100 + 88 * Math.cos(b)).toFixed(1) + ' ' + (100 + 88 * Math.sin(b)).toFixed(1) +
          'Z" fill="' + (COLORS[s.label] || '#ccc') + '" stroke="#1F1B2E" stroke-width="4" stroke-linejoin="round"/>';
      var mid = (a + b) / 2;
      var label = s.pct >= 8
        ? '<text x="' + (100 + 58 * Math.cos(mid)).toFixed(1) + '" y="' + (100 + 58 * Math.sin(mid) + 7).toFixed(1) + '" text-anchor="middle" class="split-pct">' + s.pct + '%</text>'
        : '';
      a = b;
      return p + label;
    }).join('');
    return '<svg class="split-pie" viewBox="0 0 200 200" aria-hidden="true">' + paths + '</svg>';
  }

  function legend(slices) {
    return '<ul class="split-legend">' + slices.map(function (s) {
      return '<li><span class="split-dot" style="background:' + (COLORS[s.label] || '#ccc') + '"></span>' + esc(s.label) + ' <b>' + s.pct + '%</b></li>';
    }).join('') + '</ul>';
  }

  function describe(t) {
    return t.name + ' token split: ' + t.slices.map(function (s) { return s.label + ' ' + s.pct + ' percent'; }).join(', ') + '. ' + t.tags.join('. ') + '.';
  }

  // ---------- Intro ----------

  function intro() {
    render(
      '<section class="split-intro stack stack--tight"><h1 class="split-title">' + esc(T.title) + '</h1>' +
      '<p class="text text--ink">' + esc(T.intro) + '</p>' +
      '<div class="split-demo" aria-hidden="true"><span class="split-stamp is-rug">RUG</span><span class="split-stamp is-real">REAL</span></div>' +
      '<p class="small-print">' + esc(T.note) + '</p>' +
      '<button type="button" class="btn btn--ink btn--block" data-start>' + esc(T.startButton) + '</button></section>',
      'Rug or Real'
    );
    app.querySelector('[data-start]').addEventListener('click', start);
  }

  function start() {
    sfx.play('pop');
    game = { cards: S.pick(pool, T.rounds), i: 0, score: 0, right: 0, results: [] };
    C.track('split_started');
    card();
  }

  // ---------- A card ----------

  function card() {
    var t = game.cards[game.i];
    var ms = T.seconds * 1000;
    var started = Date.now();
    var done = false;
    render(
      '<div class="split-top"><span class="split-count">Card ' + (game.i + 1) + ' of ' + game.cards.length + '</span>' +
      '<span class="split-score">Score ' + game.score + '</span></div>' +
      '<div class="timer" role="timer" aria-label="Time left"><span class="timer-fill" data-fill></span><span class="timer-text" data-left>' + T.seconds + 's</span></div>' +
      '<div class="split-deck">' +
      '<article class="card split-card" data-card aria-label="' + esc(describe(t)) + '">' +
      '<span class="split-stamp is-rug" data-stamp-rug aria-hidden="true">RUG</span><span class="split-stamp is-real" data-stamp-real aria-hidden="true">REAL</span>' +
      '<h1 class="split-name">' + esc(t.name) + ' <span class="split-ticker">$' + esc(t.ticker) + '</span></h1>' +
      '<div class="split-chart">' + pie(t.slices) + legend(t.slices) + '</div>' +
      '<div class="chips">' + t.tags.map(function (g) { return '<span class="chip is-white">' + esc(g) + '</span>'; }).join('') + '</div>' +
      '</article></div>' +
      '<div class="split-buttons"><button type="button" class="btn split-btn split-btn--rug" data-answer="rug">👈 ' + esc(T.rugButton) + '</button>' +
      '<button type="button" class="btn split-btn split-btn--real" data-answer="real">' + esc(T.realButton) + ' 👉</button></div>' +
      '<p class="small-print center">' + esc(T.swipeHint) + '</p>' +
      '<div data-feedback></div>',
      'Card ' + (game.i + 1) + ' of ' + game.cards.length
    );

    var el = app.querySelector('[data-card]');
    var fillBar = app.querySelector('[data-fill]');
    var left = app.querySelector('[data-left]');

    tick = setInterval(function () {
      var remaining = Math.max(0, ms - (Date.now() - started));
      fillBar.style.width = (remaining / ms) * 100 + '%';
      fillBar.classList.toggle('is-low', remaining < 3000);
      left.textContent = Math.ceil(remaining / 1000) + 's';
      if (remaining === 0) answer(null);
    }, 100);

    function answer(choice) {
      if (done) return;
      done = true;
      clearInterval(tick);
      var msLeft = Math.max(0, ms - (Date.now() - started));
      var pts = S.points(choice, t.verdict, msLeft, ms, T.points, T.speedBonus);
      var right = pts > 0;
      game.score += pts;
      if (right) game.right++;
      game.results.push({ id: t.id, choice: choice, right: right });
      el.classList.add(choice === 'real' ? 'is-flying-right' : choice === 'rug' ? 'is-flying-left' : 'is-flying-down');
      app.querySelectorAll('[data-answer]').forEach(function (b) { b.disabled = true; });
      // Once the card has flown off, fold away its space and the buttons so
      // the answer sits right under the timer.
      setTimeout(function () {
        ['.split-deck', '.split-buttons', '.split-buttons + .small-print'].forEach(function (sel) {
          var x = app.querySelector(sel);
          if (x) x.hidden = true;
        });
      }, site.fx.calm() ? 0 : 320);
      var last = game.i === game.cards.length - 1;
      var box = app.querySelector('[data-feedback]');
      box.innerHTML =
        '<section class="card split-result ' + (right ? 'card--good' : 'card--warning') + ' stack stack--tight" data-result>' +
        '<p class="title-md">' + esc(choice == null ? T.slowLine : right ? T.rightLine : T.wrongLine) + ' ' +
        esc(t.verdict === 'rug' ? T.isRug : T.isReal) + (pts ? ' <span class="chip is-mint">+' + pts + '</span>' : '') + '</p>' +
        '<p class="text text--ink">' + esc(t.why) + '</p>' +
        '<button type="button" class="btn btn--ink btn--block" data-next>' + esc(last ? T.finishButton : T.nextButton) + '</button></section>';
      var result = box.querySelector('[data-result]');
      sfx.play(right ? 'cash' : 'buzz');
      // Coins or a wobble once the answer has moved into place.
      setTimeout(function () {
        if (right) site.fx.coins(result, 6);
        else site.fx.wobble(result);
      }, site.fx.calm() ? 0 : 340);
      app.querySelector('.split-score').textContent = 'Score ' + game.score;
      var next = box.querySelector('[data-next]');
      next.focus({ preventScroll: true });
      next.addEventListener('click', function () {
        if (last) return finish();
        game.i++;
        card();
      });
    }

    app.querySelectorAll('[data-answer]').forEach(function (b) {
      b.addEventListener('click', function () { answer(b.getAttribute('data-answer')); });
    });
    swipe(el, answer);
    keys(answer);
  }

  // Drag the card left (Rug) or right (Real). Short drags spring back.
  function swipe(el, answer) {
    var x0 = null;
    var dx = 0;
    var rug = el.querySelector('[data-stamp-rug]');
    var real = el.querySelector('[data-stamp-real]');
    el.addEventListener('pointerdown', function (e) {
      x0 = e.clientX;
      dx = 0;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
    });
    el.addEventListener('pointermove', function (e) {
      if (x0 == null) return;
      dx = e.clientX - x0;
      el.style.transform = 'translateX(' + dx + 'px) rotate(' + dx / 18 + 'deg)';
      rug.style.opacity = Math.max(0, Math.min(1, -dx / 90));
      real.style.opacity = Math.max(0, Math.min(1, dx / 90));
    });
    var end = function () {
      if (x0 == null) return;
      x0 = null;
      el.classList.remove('is-dragging');
      el.style.transform = '';
      if (dx > 90) answer('real');
      else if (dx < -90) answer('rug');
      else {
        rug.style.opacity = '';
        real.style.opacity = '';
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // Arrow keys: left for Rug, right for Real.
  var keyHandler = null;
  function keys(answer) {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = function (e) {
      if (e.key === 'ArrowLeft') answer('rug');
      if (e.key === 'ArrowRight') answer('real');
    };
    document.addEventListener('keydown', keyHandler);
  }

  // ---------- Finish ----------

  function finish() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    var max = game.cards.length * (T.points + T.speedBonus);
    var rank = S.rankFor(game.score, max, T.ranks);
    C.track('split_finished', { score: game.score, rank: rank.name });
    sfx.play('ding');
    var shareText = fill(T.share.text, { score: game.score, rank: rank.name, link: SHARE_URL });
    var canvas = document.createElement('canvas');
    var ready = ToyKit.drawShareCard(canvas, {
      title: T.share.title,
      big: String(game.score),
      bigLabel: 'points',
      rank: rank.name,
      line: game.right + ' of ' + game.cards.length + ' token splits read right.',
      cta: T.share.cta,
      mascotSrc: site.mascotSrc('grin'),
    });
    render(
      '<section class="card card--hero stack stack--tight"><p class="label">Your rank</p><h1 class="split-title">' + esc(rank.name) + '</h1>' +
      '<p class="text text--ink">' + esc(rank.line) + '</p>' +
      '<p class="text text--ink"><strong>' + game.score + ' points · ' + game.right + ' of ' + game.cards.length + ' right</strong></p></section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">Red flags to remember</h2><ul class="lesson-points">' +
      '<li>A big team or insider share with no vesting.</li><li>Everything unlocked at launch.</li>' +
      '<li>Liquidity that is not locked.</li><li>One unexplained wallet holding a big chunk.</li></ul></section>' +
      '<h2 class="section-title">Your share card</h2>' +
      '<img class="share-preview" data-preview alt="Share card: ' + esc(rank.name) + ', ' + game.score + ' points" />' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-share>Share</button>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(shareText) + '">Post on X</a></div>' +
      '<button type="button" class="btn btn--block" data-again>Play again</button>' +
      (window.GameQuiz ? GameQuiz.cta('token-split') : '') + ToyKit.offersSlot('game', 'token-split') +
      ToyKit.signupHtml(T.signup) +
      '<p class="small-print center" data-soon-msg aria-live="polite"></p>' +
      '<p class="small-print center">' + esc(T.note) + ' All tokens here are made up.</p>',
      'Done'
    );
    ready.then(function () {
      var img = app.querySelector('[data-preview]');
      if (img) img.src = canvas.toDataURL('image/png');
    }).catch(function () {});
    app.querySelector('[data-share]').addEventListener('click', function () {
      ready.then(function () { ToyKit.share(canvas, shareText, 'rug-or-real.png'); });
    });
    app.querySelector('[data-again]').addEventListener('click', start);
    ToyKit.bind(app, app.querySelector('[data-soon-msg]'));
    if (game.score >= max * 0.8) site.fx.confetti();
    site.coins.award('finish', 'token-split', 'Finished Rug or Real', app.querySelector('.split-title'));
  }
})();
