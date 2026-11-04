// Ride the Chart: the screens. Pick a token, pick a month, ride the price as
// a roller coaster (hold or sell at each big drop), then see the result,
// a rank and a share card. Words come from data/invest-100.json, prices from
// data/prices/. The game rules are in js/ride-engine.js.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var sfx = site.sound;
  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var SHARE_URL = ((window.WEB3TOYS_CONFIG || {}).siteUrl || 'https://web3.toys') + '/invest-100/';

  var T = null; // words and settings
  var index = null; // token list
  var token = null; // { info, prices }
  var ride = null;
  var timer = null;

  Promise.all([C.loadJson('../data/invest-100.json'), C.loadJson('../data/prices/index.json')])
    .then(function (r) {
      T = r[0];
      index = r[1];
      pickToken();
    })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  // ---------- Helpers ----------

  function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  function money(v) {
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
    if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
    if (v >= 100) return '$' + Math.round(v);
    if (v >= 10) return '$' + v.toFixed(1).replace(/\.0$/, '');
    return '$' + v.toFixed(2);
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function monthName(m) {
    return MONTHS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4);
  }

  // Dark coins get white letters.
  function textOn(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return lum < 140 ? '#fff' : '#1F1B2E';
  }

  function render(html, pillText) {
    stopRiding();
    app.innerHTML = html;
    if (pill) pill.textContent = pillText;
    window.scrollTo(0, 0);
    var h = app.querySelector('h1');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }

  function on(sel, fn) {
    app.querySelectorAll(sel).forEach(function (el) { el.addEventListener('click', function (e) { fn(el, e); }); });
  }

  function sampleBanner() {
    return index.sample ? '<p class="tip ride-sample"><strong>Test prices.</strong> These are made up for testing. Real prices are on the way.</p>' : '';
  }

  // ---------- 1. Pick a token ----------

  function pickToken() {
    render(
      '<section class="ride-intro"><h1 class="ride-title">' + esc(T.title) + '</h1>' +
      '<p class="text text--ink">' + esc(T.intro) + '</p></section>' + sampleBanner() +
      '<h2 class="section-title">' + esc(T.pickToken) + '</h2>' +
      '<div class="coin-grid">' + index.tokens.map(function (t) {
        return '<button type="button" class="coin-btn" data-token="' + esc(t.id) + '" style="--c:' + esc(t.color) + ';--t:' + textOn(t.color) + '">' +
          '<span class="coin-face">' + esc(t.id) + '</span><span class="coin-name">' + esc(t.name) + '</span></button>';
      }).join('') + '</div>',
      'Pick a token'
    );
    on('[data-token]', function (el) {
      sfx.play('pop');
      var info = index.tokens.filter(function (t) { return t.id === el.getAttribute('data-token'); })[0];
      el.disabled = true;
      C.loadJson('../data/prices/' + info.id + '.json').then(function (data) {
        token = { info: info, prices: data.monthly, data: data };
        pickMonth(0);
      }).catch(function (err) { app.innerHTML = C.loadError(err); });
    });
  }

  // ---------- 2. Pick a start month ----------

  function sparkline(prices, start) {
    var W = 600;
    var H = 120;
    var logs = prices.map(function (p) { return Math.log(p[1]); });
    var lo = Math.min.apply(null, logs);
    var hi = Math.max.apply(null, logs);
    var x = function (i) { return (i / (prices.length - 1)) * W; };
    var y = function (i) { return H - 8 - ((logs[i] - lo) / (hi - lo || 1)) * (H - 16); };
    var d = prices.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(i).toFixed(1); }).join(' ');
    return '<svg class="ride-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<rect x="' + x(start).toFixed(1) + '" width="' + (W - x(start)).toFixed(1) + '" height="' + H + '" fill="#FFF1B8"/>' +
      '<path d="' + d + '" fill="none" stroke="#1F1B2E" stroke-width="3" vector-effect="non-scaling-stroke"/>' +
      '<line x1="' + x(start).toFixed(1) + '" x2="' + x(start).toFixed(1) + '" y1="0" y2="' + H + '" stroke="#FF6B6B" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>';
  }

  function pickMonth(start) {
    var prices = token.prices;
    var last = RideEngine.lastStart(prices, T.minMonths);
    render(
      '<section class="card stack stack--tight ride-pick">' +
      '<p class="label">' + esc(token.info.name) + '</p><h1 class="title-lg">' + esc(T.pickMonth) + '</h1>' +
      '<p class="ride-month" data-month aria-live="polite">' + monthName(prices[start][0]) + '</p>' +
      '<div data-spark>' + sparkline(prices, start) + '</div>' +
      '<label class="sr-only" for="ride-start">Start month</label>' +
      '<input id="ride-start" class="ride-slider" type="range" min="0" max="' + last + '" step="1" value="' + start + '" />' +
      '<div class="btn-row"><button type="button" class="btn" data-random>' + esc(T.randomButton) + '</button>' +
      '<button type="button" class="btn btn--ink" data-go>' + esc(T.startButton) + '</button></div>' +
      '<button type="button" class="text-button center" data-back>Pick another token</button></section>',
      token.info.id
    );
    var slider = app.querySelector('#ride-start');
    var update = function () {
      var i = Number(slider.value);
      app.querySelector('[data-month]').textContent = monthName(prices[i][0]);
      app.querySelector('[data-spark]').innerHTML = sparkline(prices, i);
    };
    slider.addEventListener('input', function () { update(); sfx.play('tick'); });
    on('[data-random]', function () {
      slider.value = Math.floor(Math.random() * (last + 1));
      update();
      sfx.play('pop');
    });
    on('[data-back]', pickToken);
    on('[data-go]', function () { startRide(Number(slider.value)); });
  }

  // ---------- 3. The ride ----------

  var W = 1000;
  var H = 520;
  var geo = null;

  function layout() {
    var s = ride.series;
    var logs = s.map(function (p) { return Math.log(p[1]); });
    var lo = Math.min.apply(null, logs);
    var hi = Math.max.apply(null, logs);
    if (hi - lo < 0.2) {
      lo -= 0.1;
      hi += 0.1;
    }
    geo = {
      x: function (i) { return 40 + (i / Math.max(1, s.length - 1)) * (W - 80); },
      y: function (i) { return H - 60 - ((logs[i] - lo) / (hi - lo)) * (H - 150); },
    };
  }

  function pathTo(n) {
    var d = '';
    for (var i = 0; i <= n; i++) d += (i ? 'L' : 'M') + geo.x(i).toFixed(1) + ' ' + geo.y(i).toFixed(1);
    return d;
  }

  function cart(cls, i) {
    var x = geo.x(i);
    var y = geo.y(i);
    var j = Math.min(i + 1, ride.series.length - 1);
    var k = Math.max(i - 1, 0);
    var angle = Math.atan2(geo.y(j) - geo.y(k), geo.x(j) - geo.x(k)) * 180 / Math.PI;
    return '<g class="' + cls + '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + angle.toFixed(1) + ')">' +
      '<rect x="-26" y="-34" width="52" height="26" rx="6" fill="#FFD93D" stroke="#1F1B2E" stroke-width="4"/>' +
      '<text x="0" y="-15" text-anchor="middle" font-size="18" font-weight="900" font-family="Nunito, sans-serif" fill="#1F1B2E">$</text>' +
      '<circle cx="-14" cy="-6" r="7" fill="#fff" stroke="#1F1B2E" stroke-width="4"/><circle cx="14" cy="-6" r="7" fill="#fff" stroke="#1F1B2E" stroke-width="4"/></g>';
  }

  function drawStage() {
    var i = ride.i;
    var supports = '';
    for (var k = 0; k <= i; k += Math.max(1, Math.round(ride.series.length / 24))) {
      supports += '<line x1="' + geo.x(k).toFixed(1) + '" x2="' + geo.x(k).toFixed(1) + '" y1="' + geo.y(k).toFixed(1) + '" y2="' + H + '"/>';
    }
    var baseY = geo.y(0);
    var sold = ride.soldAt != null;
    return '<svg class="ride-svg" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
      '<line class="ride-base" x1="0" x2="' + W + '" y1="' + baseY.toFixed(1) + '" y2="' + baseY.toFixed(1) + '"/>' +
      '<text class="ride-base-label" x="8" y="' + (baseY - 8).toFixed(1) + '">$100</text>' +
      '<g class="ride-supports">' + supports + '</g>' +
      '<path class="ride-rail-under" d="' + pathTo(i) + '"/><path class="ride-rail" d="' + pathTo(i) + '"/>' +
      '<rect class="ride-fog" x="' + (geo.x(i) + 30).toFixed(1) + '" y="0" width="' + Math.max(0, W - geo.x(i) - 30).toFixed(1) + '" height="' + H + '"/>' +
      (sold ? '<g class="ride-flag" transform="translate(' + geo.x(ride.soldAt).toFixed(1) + ' ' + geo.y(ride.soldAt).toFixed(1) + ')"><line y1="0" y2="-60" stroke="#1F1B2E" stroke-width="4"/><path d="M0 -60 L34 -50 L0 -40Z" fill="#FF6B6B" stroke="#1F1B2E" stroke-width="3"/></g>' : '') +
      cart(sold ? 'ride-cart is-ghost' : 'ride-cart', i) +
      '</svg>';
  }

  function hud() {
    var v = RideEngine.value(ride);
    var up = v >= ride.cfg.stake;
    return '<div class="ride-value ' + (up ? 'is-up' : 'is-down') + '">' + money(v) + '</div>' +
      '<div class="ride-meta">' + esc(token.info.id) + ' · ' + monthName(RideEngine.month(ride)) + ' · ' +
      (ride.invested ? 'riding' : 'cashed out') + '</div>';
  }

  // Sky colour follows the mood: green when up, red when down.
  function mood() {
    var r = RideEngine.value(ride) / ride.cfg.stake;
    var t = Math.max(-1, Math.min(1, Math.log(r) / Math.log(4)));
    return t >= 0
      ? 'color-mix(in srgb, #6BCB77 ' + Math.round(t * 55) + '%, #FFF8E1)'
      : 'color-mix(in srgb, #FF6B6B ' + Math.round(-t * 55) + '%, #FFF8E1)';
  }

  function startRide(start) {
    ride = RideEngine.create(token.prices, start, { tiers: T.tiers, rejoinRise: T.rejoinRise });
    layout();
    C.track('ride_started', { token: token.info.id, start: token.prices[start][0] });
    render(
      sampleBanner() +
      '<section class="ride-wrap"><div class="ride-hud" data-hud aria-live="polite">' + hud() + '</div>' +
      '<div class="ride-stage" data-stage>' + drawStage() + '</div>' +
      '<div class="ride-pause card" data-pause hidden></div></section>' +
      '<div class="sticky-bar"><button type="button" class="btn btn--ink btn--block ride-go" data-ride>' + esc(T.rideButton) + '</button>' +
      '<p class="small-print center">' + esc(T.rideHint) + '</p></div>',
      'Riding'
    );
    paint();
    var btn = app.querySelector('[data-ride]');
    var hold = null;
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      advance();
      hold = setTimeout(function () { startRiding(); }, 260);
    });
    var release = function () {
      clearTimeout(hold);
      stopRiding();
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!btn.disabled) advance();
      }
    });
  }

  function startRiding() {
    stopRiding();
    timer = setInterval(advance, 110);
  }

  function stopRiding() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function paint() {
    var stage = app.querySelector('[data-stage]');
    stage.innerHTML = drawStage();
    stage.style.background = mood();
    app.querySelector('[data-hud]').innerHTML = hud();
  }

  function advance() {
    // Stop when there is nothing to ride: no ride, a question on screen, the
    // end reached, or the screen has already moved on to the result.
    if (!ride || RideEngine.done(ride) || !app.querySelector('[data-stage]') || app.querySelector('[data-pause]:not([hidden])')) return stopRiding();
    var pause = RideEngine.step(ride);
    paint();
    sfx.play('tick');
    if (pause) {
      stopRiding();
      showPause(pause);
      return;
    }
    if (RideEngine.done(ride)) finish();
  }

  function showPause(pause) {
    var box = app.querySelector('[data-pause]');
    var btn = app.querySelector('[data-ride]');
    btn.disabled = true;
    var drop = pause.type === 'drop';
    box.innerHTML =
      '<p class="title-md">' + esc(fill(drop ? T.dropTitle : T.rejoinTitle, { pct: pause.pct })) + '</p>' +
      '<p class="text text--ink">' + esc(fill(drop ? T.dropLine : T.rejoinLine, { value: money(pause.value) })) + '</p>' +
      '<div class="btn-row">' +
      (drop
        ? '<button type="button" class="btn btn--ink" data-choice="hold">💎 ' + esc(T.holdButton) + '</button><button type="button" class="btn" data-choice="sell">🧻 ' + esc(T.sellButton) + '</button>'
        : '<button type="button" class="btn btn--ink" data-choice="rejoin">' + esc(T.rejoinYes) + '</button><button type="button" class="btn" data-choice="stay-out">' + esc(T.rejoinNo) + '</button>') +
      '</div>';
    box.hidden = false;
    sfx.play(drop ? 'drop' : 'pop');
    if (drop) site.fx.wobble(app.querySelector('[data-stage]'));
    box.querySelector('[data-choice]').focus({ preventScroll: true });
    box.querySelectorAll('[data-choice]').forEach(function (b) {
      b.addEventListener('click', function () {
        var choice = b.getAttribute('data-choice');
        RideEngine.decide(ride, pause, choice);
        if (choice === 'sell') sfx.play('cash');
        if (choice === 'rejoin') sfx.play('pop');
        box.hidden = true;
        btn.disabled = false;
        paint();
        if (choice === 'sell') app.querySelector('[data-hud]').insertAdjacentHTML('beforeend', '<p class="small-print">' + esc(T.soldNote) + '</p>');
        if (RideEngine.done(ride)) finish();
        else btn.focus({ preventScroll: true });
      });
    });
  }

  // ---------- 4. Result ----------

  function finalChart() {
    var s = ride.series;
    var d = pathTo(s.length - 1);
    var sold = ride.decisions.filter(function (x) { return x.choice === 'sell' || x.choice === 'rejoin'; });
    var marks = sold.map(function (x) {
      var i = s.map(function (p) { return p[0]; }).indexOf(x.month);
      return '<circle cx="' + geo.x(i).toFixed(1) + '" cy="' + geo.y(i).toFixed(1) + '" r="11" fill="' + (x.choice === 'sell' ? '#FF6B6B' : '#6BCB77') + '" stroke="#1F1B2E" stroke-width="4"/>';
    }).join('');
    return '<svg class="ride-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="The whole price ride, with your sells in red and buy backs in green">' +
      '<line class="ride-base" x1="0" x2="' + W + '" y1="' + geo.y(0).toFixed(1) + '" y2="' + geo.y(0).toFixed(1) + '"/>' +
      '<path class="ride-rail-under" d="' + d + '"/><path class="ride-rail" d="' + d + '"/>' + marks + '</svg>';
  }

  function finish() {
    stopRiding();
    var sum = RideEngine.summary(ride, T.ranks);
    var rank = sum.rank;
    var verdict = !sum.drops || (sum.held === sum.drops) ? T.sameLine : sum.beatHold ? T.beatLine : T.behindLine;
    C.track('ride_finished', { token: token.info.id, score: sum.score, rank: rank.name });
    sfx.play('ding');
    var card = shareCard(sum);
    render(
      sampleBanner() +
      '<section class="card card--hero stack stack--tight">' +
      '<p class="label">' + esc(T.resultTitle) + '</p><h1 class="title-xl">' + money(sum.finalValue) + '</h1>' +
      '<p class="text text--ink">' + esc(fill(T.holdLine, { hold: money(sum.holdValue) })) + '</p>' +
      '<p class="text text--ink"><strong>' + esc(verdict) + '</strong></p></section>' +
      '<section class="card ride-rank stack stack--tight"><p class="label">Your rank</p><h2 class="title-lg">' + esc(rank.name) + '</h2>' +
      '<p class="text">' + esc(rank.line) + '</p><p class="small-print">Score ' + sum.score + ' out of 100: how much of the holding result you kept.</p></section>' +
      '<div class="ride-stats">' +
      stat('Biggest drop', '-' + sum.biggestDrop + '%') +
      stat('Worst moment', money(sum.worstValue), monthName(sum.worstMonth)) +
      stat('Fell 50%+', sum.bigDrops + (sum.bigDrops === 1 ? ' time' : ' times')) +
      stat('Drops you held', sum.drops ? sum.held + ' of ' + sum.drops : 'none') + '</div>' +
      (sum.bigDrops ? '<p class="tip"><strong>' + esc(fill(T.question, { n: sum.bigDrops })) + '</strong></p>' : '') +
      '<div class="ride-stage ride-stage--final">' + finalChart() + '</div>' +
      '<p class="small-print"><strong>' + esc(T.pastNote) + '</strong> ' + esc(T.survivorNote) + '</p>' +
      (token.data.source ? '<p class="small-print">Prices: ' + esc(token.data.source) + ', snapshot ' + esc(token.data.snapshot) + '.</p>' : '') +
      '<h2 class="section-title">Your share card</h2>' +
      '<img class="share-preview" data-preview alt="Share card: ' + esc(rank.name) + ', $100 became ' + money(sum.finalValue) + '" />' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-share>Share</button>' +
      '<a class="btn" data-x target="_blank" rel="noopener" href="' + esc(xLink(sum)) + '">Post on X</a></div>' +
      '<div class="btn-row"><button type="button" class="btn" data-again>Ride it again</button><button type="button" class="btn" data-other>Another token</button></div>' +
      ToyKit.offersSlot('game', 'invest-100') +
      ToyKit.signupHtml(T.signup) +
      '<p class="small-print center" data-soon-msg aria-live="polite"></p>',
      'Done'
    );
    card.ready.then(function () {
      var img = app.querySelector('[data-preview]');
      if (img) img.src = card.canvas.toDataURL('image/png');
    }).catch(function () {});
    on('[data-share]', function () { card.share(); C.track('ride_shared', { token: token.info.id }); });
    on('[data-again]', function () { pickMonth(0); });
    on('[data-other]', pickToken);
    ToyKit.bind(app, app.querySelector('[data-soon-msg]'));
    if (sum.beatHold || (sum.drops && sum.held === sum.drops)) site.fx.confetti();
    site.coins.award('finish', 'invest-100', 'Finished Ride the Chart', app.querySelector('.title-xl'));
  }

  function stat(label, big, small) {
    return '<div class="card ride-stat"><p class="label">' + esc(label) + '</p><p class="ride-stat-big">' + esc(big) + '</p>' +
      (small ? '<p class="small-print">' + esc(small) + '</p>' : '') + '</div>';
  }

  function shareText(sum) {
    return fill(T.share.text, { token: token.info.name, start: monthName(sum.start), value: money(sum.finalValue), rank: sum.rank.name, link: SHARE_URL });
  }

  function xLink(sum) {
    return 'https://x.com/intent/tweet?text=' + encodeURIComponent(shareText(sum));
  }

  function shareCard(sum) {
    var canvas = document.createElement('canvas');
    var ready = ToyKit.drawShareCard(canvas, {
      title: T.share.title,
      big: money(sum.finalValue),
      bigLabel: 'from $100',
      rank: sum.rank.name,
      line: token.info.name + ', ' + monthName(sum.start) + ' to ' + monthName(sum.end) + '. Holding: ' + money(sum.holdValue) + '.',
      cta: T.share.cta,
      mascotSrc: site.mascotSrc('grin'),
      stats: [['Biggest drop', '-' + sum.biggestDrop + '%'], ['Worst', money(sum.worstValue)], ['Held', sum.drops ? sum.held + '/' + sum.drops : '-']],
    });
    return {
      ready: ready,
      canvas: canvas,
      share: function () { return ready.then(function () { return ToyKit.share(canvas, shareText(sum), 'ride-the-chart.png'); }); },
    };
  }
})();
