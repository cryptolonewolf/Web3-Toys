// Who Built It? (Web3 Builders Hall of Fame). Read a clue, pick the person
// from three portraits, and their card flips over: what they did, why it
// matters and a fun fact. Every right answer adds them to your Hall of Fame
// wall (kept in this browser). 10 rounds (easy, then medium, then hard),
// then the quiz and certificate.
// Words: data/hall-of-fame.json. People: data/hall-of-fame-people.json.
// Portraits: images/people/ID.webp when a person has "photo": true;
// otherwise a sketch with their initials.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var sfx = site.sound;
  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var SHARE_URL = ((window.WEB3TOYS_CONFIG || {}).siteUrl || 'https://web3.toys') + '/hall-of-fame/';
  var WALL_KEY = 'web3toys.hof.v1';
  var T = null, people = [], cats = {};
  var round = [], at = 0, score = 0, right = 0, hint = false;

  // The pencil wobble used by every sketch, defined once.
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="hof-pencil"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></svg>');

  Promise.all([C.loadJson('../data/hall-of-fame.json'), C.loadJson('../data/hall-of-fame-people.json')]).then(function (r) {
    T = r[0];
    people = r[1].people;
    r[1].categories.forEach(function (c) { cats[c.id] = c; });
    var toy = { id: T.id, title: T.certTitle };
    if (location.hash === '#certificate' && window.ToyQuiz && ToyQuiz.showSaved(toy)) return;
    if (location.hash === '#quiz') return startQuiz();
    start();
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  // ---------- The wall (this browser) ----------

  function wall() {
    try { return JSON.parse(localStorage.getItem(WALL_KEY)) || {}; } catch (e) { return {}; }
  }

  function collect(id) {
    var w = wall();
    if (w[id]) return false;
    w[id] = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem(WALL_KEY, JSON.stringify(w)); } catch (e) { /* private mode */ }
    return true;
  }

  // ---------- Portraits ----------

  var COLORS = { blue: '#4D96FF', violet: '#9B5DE5', mint: '#6BCB77', yellow: '#FFD93D', orange: '#FF9F45', teal: '#2EC4B6', pink: '#FF7AB6', coral: '#FF6B6B' };

  function initials(name) {
    return name.replace(/\(.*?\)/g, '').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  // A coloured-pencil style sketch: wobbly circle, hatching and initials.
  function sketch(p) {
    var col = COLORS[(cats[p.cat] || {}).color] || '#FFD93D';
    var fid = 'hof-pencil';
    var face = p.anon
      ? '<path d="M50 14c-20 0-32 16-32 34v40h64V48c0-18-12-34-32-34z" fill="#3B3552"/><ellipse cx="50" cy="52" rx="17" ry="20" fill="#1F1B2E"/>' +
        '<text x="50" y="60" text-anchor="middle" font-size="22" font-weight="800" fill="#FFD93D" font-family="Fredoka, sans-serif">?</text>'
      : '<text x="50" y="62" text-anchor="middle" font-size="30" font-weight="700" fill="#1F1B2E" font-family="Chewy, Fredoka, sans-serif">' + esc(initials(p.name)) + '</text>';
    return '<svg class="hof-sketch" viewBox="0 0 100 100" aria-hidden="true">' +
      '<defs><pattern id="hatch-' + esc(p.id) + '" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="6" stroke="' + col + '" stroke-width="2.4" opacity=".75"/></pattern></defs>' +
      '<g filter="url(#' + fid + ')"><circle cx="50" cy="50" r="44" fill="#FFF8E1"/><circle cx="50" cy="50" r="44" fill="url(#hatch-' + esc(p.id) + ')"/>' +
      '<circle cx="50" cy="50" r="44" fill="none" stroke="#1F1B2E" stroke-width="2.5"/>' + face + '</g></svg>';
  }

  function portrait(p, cls) {
    return '<span class="hof-face ' + (cls || '') + '">' + (p.photo
      ? '<img src="../images/people/' + esc(p.id) + '.webp" alt="" loading="lazy" onerror="this.remove()" />'
      : '') + sketch(p) + '</span>';
  }

  // ---------- Start ----------

  function wallLine() {
    var n = Object.keys(wall()).filter(function (id) { return people.some(function (p) { return p.id === id; }); }).length;
    return fill(T.wallLine, { n: n, total: people.length });
  }

  function start() {
    var sample = ['satoshi-nakamoto', 'vitalik-buterin', 'hal-finney', 'zachxbt', 'sandeep-nailwal'].map(function (id) {
      return people.filter(function (p) { return p.id === id; })[0];
    }).filter(Boolean);
    app.innerHTML =
      '<section class="card card--hero stack hof-start"><h1 class="title-xl">' + esc(T.title) + '</h1>' +
      '<div class="hof-row" aria-hidden="true">' + sample.map(function (p) { return portrait(p, 'hof-face--sm'); }).join('') + '</div>' +
      '<p class="text text--ink">' + esc(T.intro) + '</p>' +
      '<button type="button" class="btn btn--ink btn--block" data-go>' + esc(T.startButton) + '</button>' +
      '<p class="small-print">' + esc(wallLine()) + ' <a href="#wall" data-wall-link>See your wall</a></p></section>' +
      '<p class="small-print">' + esc(T.note) + '</p>' +
      '<section class="stack stack--tight" data-wall hidden></section>';
    pill.textContent = people.length + ' builders';
    app.querySelector('[data-go]').addEventListener('click', play);
    app.querySelector('[data-wall-link]').addEventListener('click', function (e) {
      e.preventDefault();
      var box = app.querySelector('[data-wall]');
      box.hidden = false;
      box.innerHTML = wallHtml();
      bindWall(box);
      box.scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth' });
    });
  }

  // ---------- A round ----------

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // People not on the wall yet come first, so replays find new faces.
  function pick(level, n, taken) {
    var w = wall();
    var pool = shuffle(people.filter(function (p) { return p.level === level && taken.indexOf(p) < 0; }));
    pool.sort(function (a, b) { return (w[a.id] ? 1 : 0) - (w[b.id] ? 1 : 0); });
    return pool.slice(0, n);
  }

  function play() {
    round = [];
    ['easy', 'medium', 'hard'].forEach(function (lv) { round = round.concat(pick(lv, T.rounds[lv], round)); });
    at = 0; score = 0; right = 0;
    sfx.play('pop');
    C.track('hof_start');
    clue();
  }

  // Two wrong choices, from the same group when possible.
  function choices(p) {
    var same = shuffle(people.filter(function (x) { return x !== p && x.cat === p.cat; }));
    var other = shuffle(people.filter(function (x) { return x !== p && x.cat !== p.cat; }));
    return shuffle([p].concat(same.concat(other).slice(0, 2)));
  }

  function clue() {
    var p = round[at];
    var cat = cats[p.cat] || {};
    hint = false;
    pill.textContent = 'Clue ' + (at + 1) + ' of ' + round.length + ' · ' + score + ' pts';
    app.innerHTML =
      '<section class="card stack hof-clue"><div class="cap-row"><p class="label">' + esc(T.clueLabel) + '</p>' +
      '<span class="chip">' + esc(cat.icon || '') + ' ' + esc(cat.title || '') + '</span></div>' +
      '<blockquote class="hof-quote">' + esc(p.why) + '</blockquote>' +
      '<button type="button" class="text-button" data-hint>💡 ' + esc(T.hintButton) + '</button>' +
      '<p class="tip" data-hint-text hidden>' + esc(p.fun) + '</p>' +
      '<div class="hof-choices" role="group" aria-label="Pick the person">' + choices(p).map(function (x) {
        return '<button type="button" class="hof-choice" data-pick="' + esc(x.id) + '">' + portrait(x) + '<span>' + esc(x.name) + '</span></button>';
      }).join('') + '</div></section>';
    app.querySelector('[data-hint]').addEventListener('click', function (e) {
      hint = true;
      e.target.hidden = true;
      app.querySelector('[data-hint-text]').hidden = false;
      sfx.play('tick');
    });
    app.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () { answer(p, b.getAttribute('data-pick')); });
    });
    var first = app.querySelector('.hof-quote');
    if (first) first.scrollIntoView({ block: 'nearest' });
  }

  function answer(p, chosen) {
    var ok = chosen === p.id;
    var pts = ok ? (hint ? T.points.hint : T.points.right) : 0;
    score += pts;
    if (ok) right++;
    var fresh = ok && collect(p.id);
    app.querySelectorAll('[data-pick]').forEach(function (b) {
      b.disabled = true;
      var id = b.getAttribute('data-pick');
      if (id === p.id) b.classList.add('is-right');
      else if (id === chosen) b.classList.add('is-wrong');
    });
    sfx.play(ok ? 'cash' : 'buzz');
    C.track('hof_answer', { person: p.id, right: ok });
    var cat = cats[p.cat] || {};
    var card = document.createElement('section');
    card.className = 'card stack stack--tight hof-card' + (p.caution ? ' is-caution' : '');
    card.innerHTML =
      '<p class="hof-result ' + (ok ? 'is-good' : 'is-bad') + '">' + (ok ? (fresh ? '✓ Added to your wall! ' : '✓ Right! ') + '+' + pts : '✗ Not this time. It was ' + esc(p.name) + '.') + '</p>' +
      '<div class="hof-card-top">' + portrait(p, 'hof-face--lg') + '<div class="stack stack--tight"><h2 class="title-lg">' + esc(p.name) + '</h2>' +
      '<p class="text text--ink">' + esc(p.role) + '</p>' +
      '<p class="hof-tags"><span class="chip">' + esc(cat.icon || '') + ' ' + esc(cat.title || '') + '</span>' +
      (p.caution ? '<span class="chip is-coral">⚠️ ' + esc(T.cautionLabel) + '</span>' : '') +
      (p.anon ? '<span class="chip">🕶️ ' + esc(T.anonLabel) + '</span>' : '') + '</p></div></div>' +
      '<p class="text"><b>Why they matter:</b> ' + esc(p.why) + '</p>' +
      '<p class="tip">' + site.icon('bulb') + '<span><b>Fun fact:</b> ' + esc(p.fun) + '</span></p>' +
      '<button type="button" class="btn btn--ink btn--block" data-next>' + esc(at + 1 < round.length ? T.nextButton : T.finishButton) + ' →</button>';
    app.appendChild(card);
    if (ok) site.fx.coins(card.querySelector('.hof-result'), 5);
    card.scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'start' });
    pill.textContent = 'Clue ' + (at + 1) + ' of ' + round.length + ' · ' + score + ' pts';
    card.querySelector('[data-next]').addEventListener('click', function () {
      at++;
      if (at < round.length) clue(); else end();
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  // ---------- The end ----------

  function rankFor() {
    var share = score / (round.length * T.points.right);
    var r = T.ranks[0];
    T.ranks.forEach(function (x) { if (share >= x.min) r = x; });
    return r;
  }

  function wallHtml() {
    var w = wall();
    return '<h2 class="section-title">' + esc(T.wallTitle) + '</h2><p class="small-print">' + esc(wallLine()) + '</p>' +
      '<ul class="hof-wall">' + people.map(function (p) {
        return w[p.id]
          ? '<li><button type="button" class="hof-tile" data-who="' + esc(p.id) + '" aria-label="' + esc(p.name) + '">' + portrait(p, 'hof-face--sm') + '<span>' + esc(p.name) + '</span></button></li>'
          : '<li><span class="hof-tile is-empty" aria-label="Not collected yet"><span class="hof-face hof-face--sm hof-face--empty">?</span><span>???</span></span></li>';
      }).join('') + '</ul><div data-who-box aria-live="polite"></div>';
  }

  function bindWall(box) {
    box.querySelectorAll('[data-who]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = people.filter(function (x) { return x.id === b.getAttribute('data-who'); })[0];
        box.querySelector('[data-who-box]').innerHTML = '<div class="card stack stack--tight hof-card"><div class="hof-card-top">' + portrait(p, 'hof-face--lg') +
          '<div class="stack stack--tight"><h3 class="title-md">' + esc(p.name) + '</h3><p class="text text--ink">' + esc(p.role) + '</p></div></div>' +
          '<p class="text">' + esc(p.why) + '</p><p class="tip">' + site.icon('bulb') + '<span>' + esc(p.fun) + '</span></p></div>';
      });
    });
  }

  function end() {
    var rank = rankFor();
    var n = Object.keys(wall()).length;
    var card = shareCard(rank, n);
    pill.textContent = 'Done · ' + score + ' pts';
    app.innerHTML =
      '<section class="card card--hero stack stack--tight"><p class="label">' + esc(T.endTitle) + '</p>' +
      '<h1 class="title-xl">' + right + ' of ' + round.length + '</h1>' +
      '<p class="text text--ink"><strong>' + score + ' points. Rank: ' + esc(rank.name) + '.</strong></p>' +
      '<p class="text">' + esc(T.endLesson) + '</p>' +
      '<button type="button" class="btn btn--ink btn--block" data-quiz>' + esc(T.quizButton) + '</button>' +
      '<button type="button" class="btn btn--block" data-again>Play another round</button></section>' +
      '<section class="stack stack--tight" data-wall>' + wallHtml() + '</section>' +
      '<h2 class="section-title">Your share card</h2>' +
      '<img class="share-preview" data-preview alt="Share card: ' + esc(rank.name) + ', ' + score + ' points" />' +
      '<div class="btn-row"><button type="button" class="btn" data-share>Share</button>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(shareText(rank, n)) + '">Post on X</a></div>' +
      ToyKit.offersSlot('game', 'hall-of-fame');
    bindWall(app.querySelector('[data-wall]'));
    sfx.play('ding');
    if (right >= round.length * 0.7) site.fx.confetti();
    site.coins.award('finish', 'hall-of-fame', 'Finished a round of Who Built It?');
    C.track('hof_finished', { score: score, right: right, collected: n });
    card.ready.then(function () { var img = app.querySelector('[data-preview]'); if (img) img.src = card.canvas.toDataURL('image/png'); }).catch(function () {});
    app.querySelector('[data-share]').addEventListener('click', function () { card.share(); });
    app.querySelector('[data-quiz]').addEventListener('click', startQuiz);
    app.querySelector('[data-again]').addEventListener('click', play);
  }

  function shareText(rank, n) {
    return fill(T.share.text, { right: right, n: round.length, score: score, rank: rank.name, collected: n, total: people.length, link: SHARE_URL });
  }

  function shareCard(rank, n) {
    var canvas = document.createElement('canvas');
    var ready = ToyKit.drawShareCard(canvas, {
      title: T.share.title,
      big: right + '/' + round.length,
      bigLabel: 'builders named',
      rank: rank.name,
      line: 'My Hall of Fame: ' + n + ' of ' + people.length + ' web3 builders collected.',
      cta: T.share.cta,
      mascotSrc: site.mascotSrc('celebrating'),
    });
    return {
      ready: ready,
      canvas: canvas,
      share: function () { return ready.then(function () { return ToyKit.share(canvas, shareText(rank, n), 'who-built-it.png'); }); },
    };
  }

  // ---------- Quiz and certificate (shared with the other toys) ----------

  function startQuiz() {
    ToyQuiz.start({ id: T.id, title: T.certTitle }, {
      app: app,
      pill: pill,
      backToCards: function () { location.hash = ''; location.reload(); },
    });
  }
})();
