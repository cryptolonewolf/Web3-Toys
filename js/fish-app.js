// Fish the Dead Projects: cast, wait for a bite, tap in time, reel in on a
// timing bar, and land a card for a real dead crypto project. Words:
// data/dead-projects.json. Catches: data/dead_projects.json. Rules:
// js/fish-engine.js. Every catch ever landed is kept in a tackle box in
// this browser.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var sfx = site.sound;
  var F = window.FishEngine;
  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var SHARE_URL = ((window.WEB3TOYS_CONFIG || {}).siteUrl || 'https://web3.toys') + '/dead-projects/';
  var BOX_KEY = 'web3toys.tackle.v1';

  var T = null;
  var catches = [];
  var game = null;
  var timers = [];
  var frame = null;

  Promise.all([C.loadJson('../data/dead-projects.json'), C.loadJson('../data/dead_projects.json')])
    .then(function (r) {
      T = r[0];
      catches = r[1].catches;
      intro();
    })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function stopAll() {
    timers.forEach(clearTimeout);
    timers = [];
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  }

  function box() {
    try { return JSON.parse(window.localStorage.getItem(BOX_KEY)) || {}; } catch (e) { return {}; }
  }

  function saveBox(b) {
    try { window.localStorage.setItem(BOX_KEY, JSON.stringify(b)); } catch (e) { /* private mode */ }
  }

  // ---------- Drawings ----------

  // A dead fish: a skeleton for common catches, gold bones for legendary ones.
  function fishIcon(rarity) {
    var bone = rarity === 3 ? '#FFD93D' : rarity === 2 ? '#BFE0FA' : '#E8E4D8';
    return '<svg class="fish-icon" viewBox="0 0 120 60" aria-hidden="true"><g fill="none" stroke="#1F1B2E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10 30 L26 16 L26 44Z" fill="' + bone + '"/><path d="M26 30 H88"/>' +
      '<path d="M40 18 V42 M52 16 V44 M64 18 V42 M76 20 V40"/>' +
      '<path d="M88 30 C88 14 112 14 112 30 C112 46 88 46 88 30Z" fill="' + bone + '"/>' +
      '<path d="M98 25 l6 6 M104 25 l-6 6"/></g></svg>';
  }

  function scene() {
    return '<svg class="fish-scene" viewBox="0 0 400 260" aria-hidden="true">' +
      '<defs><linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A1A66"/><stop offset="1" stop-color="#FF8F6B"/></linearGradient>' +
      '<linearGradient id="fs-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16384A"/><stop offset="1" stop-color="#03121B"/></linearGradient></defs>' +
      '<rect width="400" height="100" fill="url(#fs-sky)"/><circle cx="320" cy="70" r="26" fill="#FFE98A" opacity=".85"/>' +
      '<rect y="96" width="400" height="164" fill="url(#fs-water)"/>' +
      '<g fill="none" stroke="#2B5D73" stroke-width="2" opacity=".8">' +
      '<path d="M0 130 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>' +
      '<path d="M0 180 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/>' +
      '<path d="M0 230 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/></g>' +
      '<g stroke="#1F1B2E" stroke-width="3"><rect x="-4" y="88" width="96" height="12" fill="#B9814F"/><path d="M14 100 V150 M70 100 V150"/></g>' +
      '<path d="M60 88 L132 22" stroke="#1F1B2E" stroke-width="6" stroke-linecap="round"/><path d="M60 88 L132 22" stroke="#B9814F" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="fish-line" data-line d="M132 22 Q140 60 140 100" fill="none" stroke="#E8E4D8" stroke-width="1.5"/>' +
      '<g class="fish-float" data-float transform="translate(140 100)"><g class="fish-float-inner">' +
      '<circle r="7" fill="#fff" stroke="#1F1B2E" stroke-width="2.5"/><path d="M-7 0 A7 7 0 0 1 7 0Z" fill="#FF6B6B" stroke="#1F1B2E" stroke-width="2.5"/></g></g>' +
      '<g class="fish-rings" data-rings opacity="0"><ellipse rx="14" ry="4" fill="none" stroke="#9ED6EA" stroke-width="2"/><ellipse rx="26" ry="7" fill="none" stroke="#9ED6EA" stroke-width="1.5"/></g>' +
      '</svg>';
  }

  // Moves the float to where the line landed (power 0 to 1).
  function placeFloat(power, inWater) {
    var x = 150 + power * 210;
    var y = inWater ? 112 : 100;
    var f = app.querySelector('[data-float]');
    var line = app.querySelector('[data-line]');
    var rings = app.querySelector('[data-rings]');
    if (f) f.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y + ')');
    if (line) line.setAttribute('d', 'M132 22 Q' + ((132 + x) / 2).toFixed(1) + ' ' + (inWater ? 90 : 60) + ' ' + x.toFixed(1) + ' ' + y);
    if (rings) {
      rings.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + (y + 6) + ')');
      rings.setAttribute('opacity', inWater ? '1' : '0');
    }
  }

  // ---------- Intro ----------

  function intro() {
    stopAll();
    var b = box();
    var have = catches.filter(function (c) { return b[c.id]; }).length;
    app.innerHTML =
      '<section class="fish-intro stack stack--tight"><h1 class="fish-title">' + esc(T.title) + '</h1>' +
      '<p class="text text--ink">' + esc(T.intro) + '</p>' +
      '<div class="fish-stage">' + scene() + '</div>' +
      (have ? '<p class="small-print">Tackle box: ' + have + ' of ' + catches.length + ' caught.</p>' : '') +
      '<button type="button" class="btn btn--ink btn--block" data-dive>🦈 ' + esc(T.diveButton) + '</button>' +
      '<p class="small-print">' + esc(T.diveLine) + '</p>' +
      '<button type="button" class="btn btn--block" data-start>🎣 ' + esc(T.fishButton) + '</button></section>';
    pill.textContent = 'Go fishing';
    app.querySelector('[data-start]').addEventListener('click', start);
    app.querySelector('[data-dive]').addEventListener('click', dive);
  }

  // ---------- Shark mode (js/shark-dive.js) ----------

  function dive() {
    stopAll();
    sfx.play('pop');
    C.track('shark_started');
    SharkDive.start({
      T: T,
      catches: catches,
      app: app,
      pill: pill,
      esc: esc,
      fill: fill,
      track: C.track,
      shareUrl: SHARE_URL,
      remember: function (c) {
        var b = box();
        if (!b[c.id]) {
          b[c.id] = Date.now();
          saveBox(b);
        }
      },
      cardHtml: cardBody,
      showCard: showCard,
      goFishing: start,
    });
  }

  // The full story of one catch in a pop-up.
  function showCard(c) {
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = '<div class="card stack stack--tight fish-card--r' + c.rarity + '" role="dialog" aria-modal="true" aria-labelledby="catch-title">' +
      '<div class="fish-card-head">' + fishIcon(c.rarity) + '<div><p class="label">' + esc(c.kind) + ' · ' + (c.date || c.year) + '</p>' +
      '<h2 class="title-md" id="catch-title">' + esc(c.name) + '</h2></div></div>' + cardBody(c) +
      '<button type="button" class="btn btn--ink btn--block" data-close>Keep diving</button></div>';
    document.body.appendChild(modal);
    var close = function () { modal.remove(); };
    modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
    modal.querySelector('[data-close]').addEventListener('click', close);
    modal.querySelector('[data-close]').focus();
  }

  function start() {
    sfx.play('pop');
    game = { cast: 0, score: 0, streak: 0, haul: [], taken: {} };
    C.track('fish_started');
    cast();
  }

  // ---------- One cast ----------

  function cast() {
    stopAll();
    var n = game.cast + 1;
    pill.textContent = 'Cast ' + n + ' of ' + T.casts;
    app.innerHTML =
      '<div class="fish-hud"><span>Cast ' + n + ' of ' + T.casts + '</span><span>Score <b data-score>' + game.score + '</b></span></div>' +
      '<div class="fish-stage" data-stage>' + scene() + '</div>' +
      '<div class="fish-power" data-power><span data-power-fill></span></div>' +
      '<div class="fish-reel" data-reel hidden><span class="fish-zone" data-zone></span><span class="fish-marker" data-marker></span></div>' +
      '<div class="fish-hits" data-hits aria-live="polite"></div>' +
      '<button type="button" class="btn btn--ink btn--block fish-act" data-act>' + esc(T.castButton) + '</button>' +
      '<p class="small-print center" data-hint>' + esc(T.castHint) + '</p>' +
      '<div data-result></div>';
    var btn = app.querySelector('[data-act]');
    var state = 'ready';
    var power = 0;
    var holdStart = 0;
    var target = null;
    var z = null;
    var hits = 0;
    var misses = 0;
    var reelStart = 0;
    var period = 1300;
    var biteAt = 0;
    var ignoreClick = false; // lifting a finger to cast also sends a click

    function setButton(text, cls) {
      btn.textContent = text;
      btn.className = 'btn btn--block fish-act ' + (cls || 'btn--ink');
    }

    // Hold to cast: the power meter swings back and forth while held.
    function powerLoop() {
      var t = (Date.now() - holdStart) / 1200;
      power = F.marker(t * 1000, 2000);
      app.querySelector('[data-power-fill]').style.width = Math.round(power * 100) + '%';
      frame = requestAnimationFrame(powerLoop);
    }

    function release() {
      if (state !== 'holding') return;
      cancelAnimationFrame(frame);
      state = 'waiting';
      placeFloat(power, true);
      sfx.play('pop');
      app.querySelector('[data-stage]').classList.add('is-waiting');
      setButton(T.waitButton, 'fish-act--wait');
      app.querySelector('[data-hint]').textContent = 'Watch the float. Tap the moment it dips.';
      target = F.pickCatch(catches, power, game.taken);
      later(bite, T.biteMinMs + Math.random() * (T.biteMaxMs - T.biteMinMs));
    }

    function bite() {
      state = 'bite';
      biteAt = Date.now();
      app.querySelector('[data-stage]').classList.add('is-bite');
      setButton(T.biteButton, 'btn--yellow');
      sfx.play('drop');
      if (navigator.vibrate) navigator.vibrate(60);
      later(function () { if (state === 'bite') lose(T.gotAway); }, T.biteWindowMs);
    }

    function startReel() {
      state = 'reel';
      app.querySelector('[data-stage]').classList.remove('is-waiting', 'is-bite');
      app.querySelector('[data-stage]').classList.add('is-reeling');
      z = F.zone(target.rarity);
      period = [0, 1400, 1150, 950][target.rarity] || 1200;
      var reel = app.querySelector('[data-reel]');
      reel.hidden = false;
      app.querySelector('[data-power]').hidden = true;
      var zoneEl = app.querySelector('[data-zone]');
      zoneEl.style.left = z.start * 100 + '%';
      zoneEl.style.width = (z.end - z.start) * 100 + '%';
      setButton(T.reelButton);
      app.querySelector('[data-hint]').textContent = 'Land ' + T.hitsToLand + ' taps in the green. ' + T.missesToLose + ' misses and it slips away.';
      showHits();
      reelStart = Date.now();
      var markerEl = app.querySelector('[data-marker]');
      (function loop() {
        markerEl.style.left = F.marker(Date.now() - reelStart, period) * 100 + '%';
        frame = requestAnimationFrame(loop);
      })();
    }

    function showHits() {
      var dots = '';
      for (var i = 0; i < T.hitsToLand; i++) dots += '<span class="fish-dot' + (i < hits ? ' is-hit' : '') + '"></span>';
      dots += '<span class="fish-miss">' + (misses ? '✗'.repeat(misses) : '') + '</span>';
      app.querySelector('[data-hits]').innerHTML = dots;
    }

    function reelTap() {
      var pos = F.marker(Date.now() - reelStart, period);
      if (F.inZone(pos, z)) {
        hits++;
        sfx.play('tick');
        placeFloat(power * (1 - hits / (T.hitsToLand + 1)), true);
        if (hits >= T.hitsToLand) return land();
      } else {
        misses++;
        sfx.play('buzz');
        site.fx.wobble(app.querySelector('[data-reel]'));
        if (misses >= T.missesToLose) return lose(T.snapped);
      }
      showHits();
    }

    function lose(text) {
      stopAll();
      state = 'done';
      game.streak = 0;
      game.cast++;
      app.querySelector('[data-stage]').classList.remove('is-waiting', 'is-bite', 'is-reeling');
      app.querySelector('[data-reel]').hidden = true;
      app.querySelector('[data-hits]').innerHTML = '';
      sfx.play('buzz');
      after('<section class="card card--warning stack stack--tight fish-card"><p class="title-md">' + esc(text) + '</p></section>');
    }

    function land() {
      stopAll();
      state = 'done';
      game.cast++;
      game.streak++;
      game.taken[target.id] = true;
      var pts = F.points(target.rarity, game.streak, T.points, T.streakBonus);
      game.score += pts;
      game.haul.push(target);
      var b = box();
      var isNew = !b[target.id];
      b[target.id] = Date.now();
      saveBox(b);
      C.track('fish_caught', { id: target.id });
      app.querySelector('[data-score]').textContent = game.score;
      app.querySelector('[data-reel]').hidden = true;
      app.querySelector('[data-hits]').innerHTML = '';
      app.querySelector('[data-stage]').classList.remove('is-reeling');
      sfx.play('cash');
      after(catchCard(target, pts, isNew));
      site.fx.coins(app.querySelector('.fish-card'), target.rarity * 3);
      if (target.rarity === 3) site.fx.confetti();
    }

    function after(html) {
      var last = game.cast >= T.casts;
      app.querySelector('[data-hint]').textContent = '';
      btn.hidden = true;
      var res = app.querySelector('[data-result]');
      res.innerHTML = html + '<button type="button" class="btn btn--ink btn--block" data-next>' + esc(last ? T.finishButton : T.nextButton) + '</button>';
      var next = res.querySelector('[data-next]');
      next.focus({ preventScroll: true });
      res.scrollIntoView({ behavior: site.fx.calm() ? 'auto' : 'smooth', block: 'nearest' });
      next.addEventListener('click', function () { if (last) finish(); else cast(); });
    }

    btn.addEventListener('pointerdown', function (e) {
      if (state !== 'ready') return;
      e.preventDefault();
      state = 'holding';
      holdStart = Date.now();
      powerLoop();
    });
    btn.addEventListener('pointerup', function () {
      if (state === 'holding') ignoreClick = true;
      release();
    });
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function () {
      if (ignoreClick) {
        ignoreClick = false;
        return;
      }
      if (state === 'waiting') {
        stopAll();
        lose(T.tooEarly);
      } else if (state === 'bite') {
        startReel();
      } else if (state === 'reel') {
        reelTap();
      }
    });
    // Keyboard: hold Space or Enter to cast, then tap it like the button.
    btn.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (state === 'ready') {
        state = 'holding';
        holdStart = Date.now();
        powerLoop();
      } else if (!e.repeat && state !== 'holding') {
        btn.click();
      }
    });
    btn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') release();
    });
  }

  function catchCard(c, pts, isNew) {
    return '<section class="card fish-card stack stack--tight fish-card--r' + c.rarity + '">' +
      '<div class="fish-card-head">' + fishIcon(c.rarity) + '<div><p class="label">' + esc(T.rarity[c.rarity]) + ' · ' + esc(c.kind) + ' · died ' + c.year + '</p>' +
      '<h2 class="title-md">' + esc(c.name) + '</h2></div></div>' +
      '<div class="chips"><span class="chip is-mint">+' + pts + '</span>' + (isNew ? '<span class="chip is-yellow">New in your tackle box</span>' : '') + '</div>' +
      cardBody(c) + '</section>';
  }

  // What it promised, its peak, why it died and the source.
  function cardBody(c) {
    return (c.promised ? '<p class="text text--ink"><strong>' + esc(T.promisedLabel) + ':</strong> ' + esc(c.promised) + '</p>' : '') +
      (c.peak ? '<p class="text text--ink"><strong>' + esc(T.peakLabel) + ':</strong> ' + esc(c.peak) + '</p>' : '') +
      '<p class="text text--ink"><strong>' + esc(T.diedLabel) + ':</strong> ' + esc(c.died) + '</p>' +
      '<p class="small-print">Source: ' + c.sources.map(function (s) {
        return s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>' : esc(s.label);
      }).join(', ') + '</p>';
  }

  // ---------- The haul ----------

  function finish() {
    stopAll();
    var rank = F.rankFor(game.score, T.ranks);
    var b = box();
    var have = catches.filter(function (c) { return b[c.id]; }).length;
    var classic = catches.filter(function (c) { return !c.fresh; });
    var fresh = catches.filter(function (c) { return c.fresh; });
    var freshCaught = fresh.filter(function (c) { return b[c.id]; });
    var shareText = fill(T.share.text, { n: game.haul.length, score: game.score, rank: rank.name, link: SHARE_URL });
    var canvas = document.createElement('canvas');
    var ready = ToyKit.drawShareCard(canvas, {
      title: T.share.title,
      big: String(game.score),
      bigLabel: 'points',
      rank: rank.name,
      line: game.haul.length + ' dead projects reeled in' + (game.haul.length ? ', including ' + game.haul[0].name : '') + '.',
      cta: T.share.cta,
      mascotSrc: site.mascotSrc('grin'),
    });
    C.track('fish_finished', { score: game.score, rank: rank.name });
    sfx.play('ding');
    app.innerHTML =
      '<section class="card card--hero stack stack--tight"><p class="label">Your haul</p><h1 class="fish-title">' + esc(rank.name) + '</h1>' +
      '<p class="text text--ink">' + esc(rank.line) + '</p>' +
      '<p class="text text--ink"><strong>' + game.score + ' points · ' + game.haul.length + ' of ' + T.casts + ' casts landed</strong></p></section>' +
      '<p class="tip">' + site.icon('bulb') + esc(T.lesson) + '</p>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">' + esc(T.boxTitle) + ' (' + have + ' of ' + catches.length + ')</h2>' +
      '<p class="small-print">' + esc(T.boxLine) + '</p><ul class="fish-box">' + classic.map(function (c) {
        return '<li class="' + (b[c.id] ? 'is-caught fish-card--r' + c.rarity : '') + '">' + (b[c.id] ? fishIcon(c.rarity) + '<span>' + esc(c.name) + '</span>' : '<span aria-label="Not caught yet">???</span>') + '</li>';
      }).join('') + '</ul>' +
      (fresh.length ? '<h3 class="title-sm">' + esc(T.freshTitle) + ' (' + freshCaught.length + ' of ' + fresh.length + ')</h3>' +
        '<p class="small-print">' + (freshCaught.length ? freshCaught.map(function (c) { return esc(c.name); }).join(', ') : esc(T.freshNone)) + '</p>' : '') +
      '</section>' +
      '<h2 class="section-title">Your share card</h2>' +
      '<img class="share-preview" data-preview alt="Share card: ' + esc(rank.name) + ', ' + game.score + ' points" />' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-share>Share</button>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(shareText) + '">Post on X</a></div>' +
      '<button type="button" class="btn btn--block" data-again>Fish again</button>' +
      (window.GameQuiz ? GameQuiz.cta('dead-projects') : '') + ToyKit.offersSlot('game', 'dead-projects') +
      ToyKit.signupHtml(T.signup) +
      '<p class="small-print center" data-soon-msg aria-live="polite"></p>';
    pill.textContent = 'Done';
    window.scrollTo(0, 0);
    ready.then(function () {
      var img = app.querySelector('[data-preview]');
      if (img) img.src = canvas.toDataURL('image/png');
    }).catch(function () {});
    app.querySelector('[data-share]').addEventListener('click', function () {
      ready.then(function () { ToyKit.share(canvas, shareText, 'dead-projects.png'); });
    });
    app.querySelector('[data-again]').addEventListener('click', start);
    ToyKit.bind(app, app.querySelector('[data-soon-msg]'));
    site.coins.award('finish', 'dead-projects', 'Finished Fish the Dead Projects', app.querySelector('.fish-title'));
  }
})();
