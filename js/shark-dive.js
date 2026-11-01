// Fish the Dead Projects, shark mode: hold a button and a shark dives down
// the ocean, eating every dead project on the way, numbered from the oldest
// at the top to the newest at the bottom. Let go any time to read. Started
// from js/fish-app.js, which passes in the words, catches and shared helpers.

(function () {
  var SPACING = 170; // pixels between fish
  var MAX_SPEED = 520; // pixels a second at full speed
  var ACCEL = 900;

  function start(ctx) {
    var T = ctx.T;
    var esc = ctx.esc;
    var site = window.WEB3TOYS;
    var sfx = site.sound;
    var app = ctx.app;
    var fish = window.FishEngine.diveOrder(ctx.catches);
    var n = fish.length;

    ctx.pill.textContent = 'Shark dive';
    app.innerHTML =
      '<div class="dive-hud"><span>' + esc(T.eatenLabel) + ' <b data-eaten>0</b> of ' + n + '</span><span class="dive-year" data-year>' + fish[0].year + '</span></div>' +
      '<div class="dive-ocean" data-ocean>' +
      '<div class="dive-world" data-world></div>' +
      '<div class="dive-shark" data-shark aria-hidden="true">' + sharkSvg() + '</div>' +
      '<button type="button" class="dive-toast card" data-toast hidden></button>' +
      '</div>' +
      '<div class="sticky-bar"><button type="button" class="btn btn--ink btn--block dive-go" data-dive>' + esc(T.holdDive) + '</button>' +
      '<p class="small-print center">' + esc(T.diveHint) + ' <button type="button" class="text-button" data-finish>Finish the dive</button></p></div>' +
      '<div data-end></div>';
    // Bring the ocean up under the menu bar, with the dive button stuck to
    // the bottom of the screen.
    var hud = app.querySelector('.dive-hud');
    window.scrollTo(0, Math.max(0, hud.getBoundingClientRect().top + window.scrollY - 76));

    var ocean = app.querySelector('[data-ocean]');
    var world = app.querySelector('[data-world]');
    var shark = app.querySelector('[data-shark]');
    var toast = app.querySelector('[data-toast]');
    var btn = app.querySelector('[data-dive]');
    var H = ocean.clientHeight;
    var mouth = H * 0.22 + 70; // where the shark's mouth is, from the top of the ocean
    var top0 = H * 0.65;
    var worldH = top0 + n * SPACING + H;
    var lastYear = null;

    // Lay out the fish, with a year marker wherever a new year starts.
    world.style.height = worldH + 'px';
    world.innerHTML = fish.map(function (c, i) {
      var y = top0 + i * SPACING;
      var x = [18, 52, 30, 64, 40][i % 5];
      var mark = c.year !== lastYear ? '<div class="dive-mark" style="top:' + (y - 50) + 'px">' + c.year + '</div>' : '';
      lastYear = c.year;
      return mark + '<div class="dfish dfish--r' + c.rarity + (c.fresh ? ' is-fresh' : '') + '" data-fish="' + i + '" style="top:' + y + 'px;left:' + x + '%">' +
        fishSvg() + '<span class="dfish-num">#' + (i + 1) + '</span><span class="dfish-name">' + esc(c.name) + '</span></div>';
    }).join('');

    var offset = 0;
    var speed = 0;
    var holding = false;
    var next = 0; // the next fish to eat
    var eaten = [];
    var frame = null;
    var last = 0;
    var finished = false;

    function fishX(i) {
      return [18, 52, 30, 64, 40][i % 5];
    }

    function loop(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      speed = holding ? Math.min(MAX_SPEED, speed + ACCEL * dt) : Math.max(0, speed - ACCEL * 2 * dt);
      offset = Math.min(worldH - H, offset + speed * dt);
      world.style.transform = 'translateY(' + (-offset).toFixed(1) + 'px)';
      // The deeper, the darker.
      ocean.style.setProperty('--depth', (offset / (worldH - H)).toFixed(3));
      while (next < n && offset + mouth >= top0 + next * SPACING + 20) eat(next++);
      if (next < n) shark.style.left = fishX(next) + 8 + '%';
      if (next >= n && !finished) {
        finished = true;
        holding = false;
        setTimeout(finish, 600);
      }
      if (holding || speed > 0) frame = requestAnimationFrame(loop);
      else {
        frame = null;
        last = 0;
      }
    }

    function eat(i) {
      var c = fish[i];
      eaten.push(c);
      var el = world.querySelector('[data-fish="' + i + '"]');
      if (el) el.classList.add('is-eaten');
      shark.classList.remove('is-chomping');
      void shark.offsetWidth;
      shark.classList.add('is-chomping');
      sfx.play(c.rarity === 3 ? 'cash' : 'pop');
      ctx.remember(c);
      app.querySelector('[data-eaten]').textContent = eaten.length;
      app.querySelector('[data-year]').textContent = c.year;
      toast.hidden = false;
      toast.setAttribute('data-show', i);
      toast.innerHTML = '<span class="dive-toast-num">#' + (i + 1) + '</span><span class="dive-toast-body"><b>' + esc(c.name) + '</b>' +
        '<span class="small-print">' + esc(c.kind) + ' · ' + (c.date ? esc(c.date) : c.year) + '</span>' +
        '<span class="dive-toast-line">' + esc(c.died) + '</span></span>';
      if (c.rarity === 3) site.fx.coins(toast, 5);
    }

    function go() {
      if (finished) return;
      holding = true;
      btn.classList.add('is-holding');
      if (!frame) frame = requestAnimationFrame(loop);
    }

    function stop() {
      holding = false;
      btn.classList.remove('is-holding');
    }

    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      go();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    });
    btn.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter') stop();
    });

    // Tap the card at the bottom for the full story.
    toast.addEventListener('click', function () {
      stop();
      var c = fish[Number(toast.getAttribute('data-show'))];
      ctx.showCard(c);
    });

    app.querySelector('[data-finish]').addEventListener('click', function () {
      stop();
      finished = true;
      finish();
    });

    function finish() {
      stop();
      var share = n ? eaten.length / n : 0;
      var rank = T.sharkRanks[0];
      T.sharkRanks.forEach(function (r) { if (share >= r.min) rank = r; });
      var first = eaten[0];
      var lastOne = eaten[eaten.length - 1];
      var text = ctx.fill(T.sharkShare.text, { n: eaten.length, first: first ? first.name : '-', last: lastOne ? lastOne.name : '-', rank: rank.name, link: ctx.shareUrl });
      var canvas = document.createElement('canvas');
      var ready = ToyKit.drawShareCard(canvas, {
        title: T.sharkShare.title,
        big: String(eaten.length),
        bigLabel: 'eaten',
        rank: rank.name,
        line: eaten.length ? 'From ' + first.name + ' to ' + lastOne.name + '.' : 'Barely got wet.',
        cta: T.sharkShare.cta,
        mascotSrc: site.mascotSrc('grin'),
      });
      sfx.play('ding');
      ctx.track('shark_finished', { eaten: eaten.length });
      var end = app.querySelector('[data-end]');
      end.innerHTML =
        '<section class="card card--hero stack stack--tight"><p class="label">' + (eaten.length === n ? esc(T.sharkDone) : 'Your dive') + '</p>' +
        '<h2 class="fish-title">' + esc(rank.name) + '</h2><p class="text text--ink">' + esc(rank.line) + '</p>' +
        '<p class="text text--ink"><strong>' + eaten.length + ' of ' + n + ' dead projects eaten</strong></p></section>' +
        '<p class="tip">' + site.icon('bulb') + esc(T.lesson) + '</p>' +
        (eaten.length ? '<section class="card stack stack--tight"><h2 class="title-sm">' + esc(T.logTitle) + '</h2><ol class="dive-log">' + eaten.map(function (c, i) {
          return '<li><details><summary><b>#' + (i + 1) + ' ' + esc(c.name) + '</b> <span class="small-print">' + esc(c.kind) + ' · ' + (c.date || c.year) + '</span></summary>' +
            ctx.cardHtml(c) + '</details></li>';
        }).join('') + '</ol></section>' : '') +
        '<h2 class="section-title">Your share card</h2>' +
        '<img class="share-preview" data-preview alt="Share card: ' + esc(rank.name) + ', ' + eaten.length + ' eaten" />' +
        '<div class="btn-row"><button type="button" class="btn btn--ink" data-share>Share</button>' +
        '<a class="btn" target="_blank" rel="noopener" href="https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '">Post on X</a></div>' +
        '<div class="btn-row"><button type="button" class="btn" data-again>Dive again</button><button type="button" class="btn" data-fishing>Go fishing</button></div>' +
        ToyKit.signupHtml(T.signup) +
        '<div class="btn-row">' + ToyKit.callButton() + '</div>' +
        '<p class="small-print center" data-soon-msg aria-live="polite"></p>';
      btn.parentNode.hidden = true;
      window.scrollTo({ top: end.getBoundingClientRect().top + window.scrollY - 76, behavior: site.fx.calm() ? 'auto' : 'smooth' });
      ready.then(function () {
        var img = end.querySelector('[data-preview]');
        if (img) img.src = canvas.toDataURL('image/png');
      }).catch(function () {});
      end.querySelector('[data-share]').addEventListener('click', function () {
        ready.then(function () { ToyKit.share(canvas, text, 'shark-dive.png'); });
      });
      end.querySelector('[data-again]').addEventListener('click', function () { start(ctx); });
      end.querySelector('[data-fishing]').addEventListener('click', ctx.goFishing);
      ToyKit.bind(end, end.querySelector('[data-soon-msg]'));
      if (eaten.length === n) site.fx.confetti();
      if (eaten.length) site.coins.award('finish', 'dead-projects-dive', 'Finished the shark dive', end.querySelector('.fish-title'));
    }
  }

  function sharkSvg() {
    return '<svg viewBox="0 0 120 150" class="shark-svg">' +
      '<g class="shark-tail"><path d="M60 8 L44 -6 L60 22 L76 -6Z" fill="#6E7F8F" stroke="#1F1B2E" stroke-width="4" stroke-linejoin="round"/></g>' +
      '<path d="M60 14 C86 34 92 82 76 118 L60 142 L44 118 C28 82 34 34 60 14Z" fill="#8FA3B5" stroke="#1F1B2E" stroke-width="5" stroke-linejoin="round"/>' +
      '<path d="M36 70 L10 92 L42 88Z M84 70 L110 92 L78 88Z" fill="#6E7F8F" stroke="#1F1B2E" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M60 100 C70 100 76 112 76 118 L60 142 L44 118 C44 112 50 100 60 100Z" fill="#E8EEF2"/>' +
      '<circle cx="46" cy="104" r="5" fill="#1F1B2E"/><circle cx="74" cy="104" r="5" fill="#1F1B2E"/>' +
      '<g class="shark-jaw"><path d="M48 124 L60 146 L72 124" fill="#FF6B6B" stroke="#1F1B2E" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M50 126 l3 6 l3 -6 l3 6 l3 -6 l3 6 l3 -6" fill="none" stroke="#fff" stroke-width="2"/></g></svg>';
  }

  // A dead fish: X for an eye.
  function fishSvg() {
    return '<svg viewBox="0 0 100 50" class="dfish-svg" aria-hidden="true"><g stroke="#1F1B2E" stroke-width="3.5" stroke-linejoin="round">' +
      '<path d="M78 25 L98 10 L94 25 L98 40Z" class="dfish-fill"/>' +
      '<path d="M8 25 C20 6 60 4 80 25 C60 46 20 44 8 25Z" class="dfish-fill"/>' +
      '<path d="M20 18 l8 8 M28 18 l-8 8" fill="none"/><path d="M40 14 C44 22 44 30 40 36" fill="none" stroke-width="2.5"/></g></svg>';
  }

  window.SharkDive = { start: start };
})();
