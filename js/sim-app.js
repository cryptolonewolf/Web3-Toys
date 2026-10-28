// Screens for Launch a Token Simulator. Content lives in data/simulator.js,
// rules in sim-engine.js, shared pieces (share card, signup) in toy-kit.js.

(function () {
  var D = window.WEB3TOYS_SIM;
  var E = SimEngine.create(D);
  var SITE = window.WEB3TOYS_SITE || {};
  var C = D.COPY;
  var esc = ToyKit.esc;

  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var progress = document.getElementById('progress');
  var meters = document.getElementById('meters');

  var MASCOT = window.WEB3TOYS.mascotSrc('grin');
  var LABELS = { price: 'Price', hype: 'Hype', trust: 'Trust', liquidity: 'Liquidity', runway: 'Runway', ownership: 'Ownership' };
  var CHECK =
    '<span class="check" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F1B2E" ' +
    'stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg></span>';

  var game = null;
  var lastRoute = null;

  // ---------- Helpers ----------

  function fmt(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function signed(n) {
    return (n > 0 ? '+' : '') + fmt(n);
  }

  // Stat changes as green (up) and coral (down) chips, plus any extra chips.
  function chips(effects, extra) {
    var list = Object.keys(effects || {})
      .filter(function (k) { return effects[k]; })
      .map(function (k) {
        return '<span class="chip ' + (effects[k] > 0 ? 'is-mint' : 'is-coral') + '">' + LABELS[k] + ' ' + signed(effects[k]) + '</span>';
      });
    (extra || []).forEach(function (x) {
      list.push('<span class="chip is-' + x.color + '">' + esc(x.text) + '</span>');
    });
    if (!list.length) list.push('<span class="chip is-white">No change</span>');
    return '<span class="chips">' + list.join('') + '</span>';
  }

  function mascot(cls) {
    return '<img class="mascot ' + (cls || '') + '" src="' + MASCOT + '" alt="" width="84" height="84" />';
  }

  // opts: { step: 1-7 for the progress bar, pill, pillColor, meters: true to show stats }
  function render(html, opts) {
    opts = opts || {};
    app.innerHTML = html;
    pill.textContent = opts.pill || 'by BuildWithAki';
    pill.className = 'pill' + (opts.pillColor ? ' is-' + opts.pillColor : '');

    progress.hidden = !opts.step;
    if (opts.step) {
      progress.innerHTML = C.stepNames.map(function (name, i) {
        return '<span class="' + (i < opts.step ? 'done' : '') + '" title="' + esc(name) + '"></span>';
      }).join('');
      progress.setAttribute('aria-label', 'Step ' + opts.step + ' of 7: ' + C.stepNames[opts.step - 1]);
    }

    meters.hidden = !(opts.meters && game && game.choices.project);
    if (!meters.hidden) renderMeters();

    window.scrollTo(0, 0);
    var heading = app.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  function renderMeters() {
    var s = game.stats;
    meters.innerHTML = [
      ['hype', 'coral'],
      ['trust', 'blue'],
      ['liquidity', 'mint'],
      ['runway', 'yellow'],
    ].map(function (m) {
      return '<div class="meter-card"><div class="meter-card-head"><span>' + LABELS[m[0]] + '</span><b>' + s[m[0]] + '</b></div>' +
        '<div class="mini-meter"><span class="fill-' + m[1] + '" style="width:' + s[m[0]] + '%"></span></div></div>';
    }).join('');
  }

  function on(selector, handler) {
    app.querySelectorAll(selector).forEach(function (el) {
      el.addEventListener('click', function (e) { handler(el, e); });
    });
  }

  function stepOpts(step) {
    return { step: step, pill: 'Step ' + step + ' of 7', pillColor: 'yellow', meters: true };
  }

  // A "pick one, then Lock it in" screen, like the launch route mockup.
  // o: { step, title, intro, options: [{ id, title, desc, chips, tag }], onLock }
  function pickOne(o) {
    render(
      '<div class="title-row"><h1 class="title-lg">' + esc(o.title) + '</h1>' + mascot() + '</div>' +
      (o.intro ? '<p class="text">' + esc(o.intro) + '</p>' : '') +
      '<div class="stack stack--tight">' +
      o.options.map(function (opt) {
        return '<button type="button" class="choice" aria-pressed="false" data-id="' + esc(opt.id) + '">' + CHECK +
          (opt.tag ? '<span class="chips"><span class="chip is-blue">' + esc(opt.tag) + '</span></span>' : '') +
          '<span class="choice-title">' + esc(opt.title) + '</span>' +
          (opt.desc ? '<span class="choice-desc">' + esc(opt.desc) + '</span>' : '') +
          (opt.chips || '') + '</button>';
      }).join('') +
      '</div>' +
      '<div class="sticky-bar"><button type="button" class="btn btn--ink btn--block" data-lock disabled>Lock it in</button></div>',
      stepOpts(o.step)
    );
    var chosen = null;
    var lock = app.querySelector('[data-lock]');
    on('[data-id]', function (el) {
      chosen = el.getAttribute('data-id');
      app.querySelectorAll('[data-id]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === el)); });
      lock.disabled = false;
    });
    on('[data-lock]', function () { if (chosen) o.onLock(chosen); });
  }

  // The lesson card shown after each choice.
  // o: { step, title, deltas, lessons: [{ heading, text, tone }], next, nextLabel, opts }
  function lesson(o) {
    render(
      '<h1 class="title-lg">' + esc(o.title) + '</h1>' +
      (o.deltas ? '<section class="card stack stack--tight"><p class="label">What changed</p>' + chips(o.deltas) + '</section>' : '') +
      o.lessons.map(function (l) {
        return '<section class="card ' + (l.tone || 'card--yellow') + ' stack stack--tight">' +
          (l.heading ? '<h2 class="title-sm">' + esc(l.heading) + '</h2>' : '') +
          '<p class="text text--ink">' + esc(l.text) + '</p></section>';
      }).join('') +
      '<button type="button" class="btn btn--ink btn--block" data-next>' + esc(o.nextLabel || 'Continue') + '</button>',
      o.opts || stepOpts(o.step)
    );
    on('[data-next]', o.next);
  }

  // ---------- Intro ----------

  function intro() {
    game = null;
    render(
      '<section class="card card--hero hero" aria-labelledby="sim-title">' +
      '<div class="hero-copy"><p class="label">A 5 minute game</p>' +
      '<h1 id="sim-title" class="title-xl">' + esc(C.introTitle) + '</h1></div>' +
      '<p class="hero-text">' + esc(C.introText) + '</p>' +
      '<img class="mascot mascot--lg" src="' + MASCOT + '" alt="" width="116" height="116" />' +
      '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">How it works</h2>' +
      '<ol class="steps-list">' + C.introSteps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="small-print">You watch five numbers: Price, Hype, Trust, Liquidity and Runway.</p></section>' +
      '<button type="button" class="btn btn--ink btn--block" data-start>Start the launch</button>' +
      '<p class="small-print center">' + esc(D.DISCLAIMER) + '</p>'
    );
    on('[data-start]', newGame);
  }

  function newGame() {
    game = E.createGame((Math.random() * 4294967296) >>> 0);
    projectStep();
  }

  // ---------- Steps 1 to 5 ----------

  function projectStep() {
    pickOne({
      step: 1,
      title: 'What are you launching?',
      intro: 'Each type changes your starting numbers.',
      options: D.PROJECT_TYPES.map(function (p) {
        return {
          id: p.id,
          title: p.label,
          desc: p.pitch,
          chips: '<span class="chips">' + ['hype', 'trust', 'liquidity', 'runway'].map(function (k) {
            return '<span class="chip is-white">' + LABELS[k] + ' ' + p.stats[k] + '</span>';
          }).join('') + '</span>',
        };
      }),
      onLock: function (id) {
        var r = E.chooseProject(game, id);
        var type = D.PROJECT_TYPES.filter(function (p) { return p.id === id; })[0];
        lesson({ step: 1, title: 'You are launching a ' + type.label + ' project.', lessons: [{ heading: 'Lesson', text: r.lesson }], next: raiseStep });
      },
    });
  }

  function raiseStep() {
    pickOne({
      step: 2,
      title: 'How much do you raise?',
      intro: 'More money means more runway, and investors who want more of the supply.',
      options: D.RAISES.map(function (r) {
        return {
          id: r.id,
          title: r.label,
          desc: r.desc,
          chips: chips(r.effects, r.minInvestors ? [{ text: 'Investors at least ' + r.minInvestors + '%', color: 'blue' }] : null),
        };
      }),
      onLock: function (id) {
        E.chooseRaise(game, id);
        splitStep();
      },
    });
  }

  function splitStep() {
    var raise = D.RAISES.filter(function (r) { return r.id === game.choices.raise; })[0];
    var split = E.defaultSplit(raise.id);
    var minFor = function (id) { return (id === 'investors' && raise.minInvestors) || 0; };
    var hot = function (id, v) {
      var rule = D.SPLIT_RULES.filter(function (r) { return r.bucket === id; })[0];
      return rule && ((rule.gt != null && v > rule.gt) || (rule.lt != null && v < rule.lt));
    };

    render(
      '<div class="title-row"><h1 class="title-lg">Split the tokens</h1>' + mascot() + '</div>' +
      '<p class="text">Share 100 percent of the supply across four buckets.' +
      (raise.minInvestors ? ' With a ' + esc(raise.label) + ' raise, investors need at least ' + raise.minInvestors + ' percent.' : '') + '</p>' +
      '<p class="small-print">Founder ownership equals the Team bucket. It helps your score, but costs Trust once it passes 25.</p>' +
      D.BUCKETS.map(function (b) {
        return '<section class="card bucket" data-bucket="' + b.id + '">' +
          '<div class="bucket-head"><label class="title-sm" for="r-' + b.id + '">' + esc(b.label) + '</label>' +
          '<span class="bucket-value" data-value></span></div>' +
          '<p class="bucket-rule" data-rule>' + esc(b.rule) + '</p>' +
          '<div class="stepper">' +
          '<button type="button" data-dec aria-label="Less for ' + esc(b.label) + '">−</button>' +
          '<input type="range" id="r-' + b.id + '" min="' + minFor(b.id) + '" max="100" step="1" />' +
          '<button type="button" data-inc aria-label="More for ' + esc(b.label) + '">+</button>' +
          '</div></section>';
      }).join('') +
      '<div class="sticky-bar"><p class="label" data-total aria-live="polite"></p>' +
      '<button type="button" class="btn btn--ink btn--block" data-lock>Lock it in</button></div>',
      stepOpts(2)
    );

    function update() {
      var total = 0;
      D.BUCKETS.forEach(function (b) {
        total += split[b.id];
        var card = app.querySelector('[data-bucket="' + b.id + '"]');
        card.querySelector('[data-value]').textContent = split[b.id] + '%';
        card.querySelector('input').value = split[b.id];
        card.querySelector('[data-rule]').classList.toggle('hot', Boolean(hot(b.id, split[b.id])));
      });
      var left = 100 - total;
      var line = app.querySelector('[data-total]');
      line.textContent = left === 0 ? 'Total: 100 percent. Ready.'
        : left > 0 ? 'Total: ' + total + ' percent. ' + left + ' left to place.'
        : 'Total: ' + total + ' percent. ' + -left + ' too many.';
      line.classList.toggle('bad', left !== 0);
      app.querySelector('[data-lock]').disabled = left !== 0;
    }

    function set(id, v) {
      split[id] = Math.max(minFor(id), Math.min(100, v));
      update();
    }

    D.BUCKETS.forEach(function (b) {
      var card = app.querySelector('[data-bucket="' + b.id + '"]');
      card.querySelector('input').addEventListener('input', function (e) { set(b.id, Number(e.target.value)); });
      card.querySelector('[data-dec]').addEventListener('click', function () { set(b.id, split[b.id] - 1); });
      card.querySelector('[data-inc]').addEventListener('click', function () { set(b.id, split[b.id] + 1); });
    });
    update();

    on('[data-lock]', function () {
      var r = E.setSplit(game, Object.assign({}, split));
      var lessons = r.triggered.map(function (t) {
        return { text: D.BUCKETS.filter(function (b) { return b.id === t.bucket; })[0].rule, tone: 'card--warning' };
      });
      lessons.push({ heading: 'Lesson', text: r.lesson });
      lesson({
        step: 2,
        title: r.triggered.length ? 'The split has side effects.' : 'A balanced split.',
        deltas: r.deltas,
        lessons: lessons,
        next: routeStep,
      });
    });
  }

  function routeStep() {
    pickOne({
      step: 3,
      title: 'How will your token hit the market?',
      options: D.ROUTES.map(function (r) {
        return {
          id: r.id,
          title: r.label,
          desc: r.desc + ' Risk: ' + r.risk,
          chips: chips(r.effects, r.id === 'hybrid' ? [{ text: 'Needs community', color: 'blue' }] : null),
          tag: lastRoute === r.id ? 'Last time' : '',
        };
      }),
      onLock: function (id) {
        var r = E.chooseRoute(game, id);
        var route = D.ROUTES.filter(function (x) { return x.id === id; })[0];
        lesson({
          step: 3,
          title: route.label + '.',
          deltas: r.deltas,
          lessons: [
            { heading: 'Lesson', text: r.lesson },
            { heading: 'Common pattern', text: r.pattern, tone: '' },
          ],
          next: marketMakerStep,
        });
      },
    });
  }

  function marketMakerStep() {
    pickOne({
      step: 4,
      title: 'Pick a market maker deal',
      intro: 'A market maker keeps buy and sell orders in the market so people can trade smoothly.',
      options: D.MARKET_MAKERS.map(function (m) {
        return { id: m.id, title: m.label, desc: m.desc + ' Risk: ' + m.risk, chips: chips(m.effects) };
      }),
      onLock: function (id) {
        var r = E.chooseMarketMaker(game, id);
        var mm = D.MARKET_MAKERS.filter(function (x) { return x.id === id; })[0];
        if (r.needsContract) return contractStep(mm, r);
        lesson({ step: 4, title: mm.label + '.', deltas: r.deltas, lessons: [{ heading: 'Lesson', text: r.lesson }], next: primingStep });
      },
    });
  }

  function contractStep(mm, dealResult) {
    pickOne({
      step: 4,
      title: 'Did you read the contract?',
      intro: mm.label + ': ' + mm.lesson,
      options: D.CONTRACT_CHOICES.map(function (c) {
        return { id: c.id, title: c.label, desc: c.desc, chips: chips(c.effects) };
      }),
      onLock: function (id) {
        var r = E.chooseContract(game, id);
        var choice = D.CONTRACT_CHOICES.filter(function (x) { return x.id === id; })[0];
        var total = Object.assign({}, dealResult.deltas);
        Object.keys(r.deltas).forEach(function (k) { total[k] = (total[k] || 0) + r.deltas[k]; });
        lesson({
          step: 4,
          title: choice.label + '.',
          deltas: total,
          lessons: [
            { heading: 'Your deal', text: dealResult.lesson, tone: '' },
            { heading: 'Lesson', text: r.lesson },
          ],
          next: primingStep,
        });
      },
    });
  }

  function primingStep() {
    var picked = [];
    render(
      '<div class="title-row"><h1 class="title-lg">Prime the community</h1>' + mascot() + '</div>' +
      '<p class="text">You have ' + D.PRIMING_BUDGET + ' budget points for the weeks before launch. Each plan can be picked once.</p>' +
      '<div class="stack stack--tight">' +
      D.PRIMING_PLANS.map(function (p) {
        return '<button type="button" class="choice" aria-pressed="false" data-id="' + p.id + '">' + CHECK +
          '<span class="choice-title">' + esc(p.label) + '</span>' +
          chips(p.effects, [{ text: p.cost + (p.cost === 1 ? ' point' : ' points'), color: 'blue' }]) + '</button>';
      }).join('') +
      '</div>' +
      '<div class="sticky-bar"><p class="label" data-budget aria-live="polite"></p>' +
      '<button type="button" class="btn btn--ink btn--block" data-lock></button></div>',
      stepOpts(5)
    );

    function update() {
      var spent = E.primingCost(picked);
      app.querySelector('[data-budget]').textContent = 'Points left: ' + (D.PRIMING_BUDGET - spent) + ' of ' + D.PRIMING_BUDGET;
      app.querySelectorAll('[data-id]').forEach(function (el) {
        var plan = D.PRIMING_PLANS.filter(function (p) { return p.id === el.getAttribute('data-id'); })[0];
        var active = picked.indexOf(plan.id) !== -1;
        el.setAttribute('aria-pressed', String(active));
        el.disabled = !active && spent + plan.cost > D.PRIMING_BUDGET;
      });
      app.querySelector('[data-lock]').textContent = picked.length ? 'Lock it in' : D.PRIMING_NOTHING.label + ', launch now';
    }

    on('[data-id]', function (el) {
      var id = el.getAttribute('data-id');
      var at = picked.indexOf(id);
      if (at === -1) picked.push(id);
      else picked.splice(at, 1);
      update();
    });
    update();

    on('[data-lock]', function () {
      var r = E.choosePriming(game, picked.slice());
      var total = {};
      r.results.forEach(function (x) {
        Object.keys(x.deltas).forEach(function (k) { total[k] = (total[k] || 0) + x.deltas[k]; });
      });
      lesson({
        step: 5,
        title: picked.length ? 'The community is primed.' : 'You stayed quiet.',
        deltas: total,
        lessons: r.results.map(function (x) { return { heading: x.plan.label, text: x.plan.lesson, tone: '' }; })
          .concat([{ heading: 'Lesson', text: r.lesson }]),
        next: startDay,
        nextLabel: 'Start launch week',
      });
    });
  }

  // ---------- Step 6: launch week ----------

  function weekOpts() {
    return { step: 6, pill: 'Day ' + game.day + ' of ' + D.DAYS, pillColor: 'yellow', meters: true };
  }

  function lastClose() {
    return game.priceHistory[game.priceHistory.length - 1];
  }

  function priceHead(change, label) {
    var color = change > 0 ? 'is-mint' : change < 0 ? 'is-coral' : 'is-white';
    return '<div class="price-head"><span class="title-md">Price ' + fmt(game.stats.price) + '</span>' +
      '<span class="chip ' + color + '">' + (change ? signed(change) : 'No change') + ' ' + label + '</span></div>';
  }

  // Price line in the mockup style: thick ink line under a yellow one.
  function chart(points) {
    var W = 330;
    var H = 110;
    var lo = Math.min.apply(null, points.concat([60]));
    var hi = Math.max.apply(null, points.concat([140]));
    var x = function (i) { return 8 + (i * (W - 16)) / D.DAYS; };
    var y = function (p) { return 100 - ((p - lo) / (hi - lo)) * 88; };
    var pts = points.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p).toFixed(1); }).join(' ');
    var last = points.length - 1;
    return '<section class="card" style="padding:12px 12px 8px">' +
      '<p class="label" style="color:var(--ink-muted)">Price index, launch to day ' + game.day + '</p>' +
      '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Price chart, now ' + fmt(points[last]) + '">' +
      '<line x1="0" y1="' + y(100).toFixed(1) + '" x2="' + W + '" y2="' + y(100).toFixed(1) + '" stroke="#1F1B2E" stroke-width="2" stroke-dasharray="4 6" opacity=".25"/>' +
      (points.length > 1
        ? '<polyline points="' + pts + '" fill="none" stroke="#1F1B2E" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<polyline points="' + pts + '" fill="none" stroke="#FFD93D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        : '') +
      '<circle cx="' + x(last).toFixed(1) + '" cy="' + y(points[last]).toFixed(1) + '" r="7" fill="#FFD93D" stroke="#1F1B2E" stroke-width="3"/>' +
      '</svg></section>';
  }

  function startDay() {
    var r = E.startDay(game);
    var queue = r.events.slice();
    var count = r.events.length;
    var next = function () { nextEvent(queue, count); };
    if (r.milestone) {
      lesson({
        title: r.milestone.title,
        deltas: r.milestone.deltas,
        lessons: [{ text: r.milestone.text }],
        next: next,
        opts: weekOpts(),
      });
    } else {
      next();
    }
  }

  function nextEvent(queue, count) {
    if (!queue.length) return endDay(count);
    var event = queue.shift();
    var n = count - queue.length;
    render(
      priceHead(game.stats.price - lastClose(), 'today') +
      chart(game.priceHistory.concat([game.stats.price]).slice(0, game.day + 1)) +
      '<section class="card event-card stack stack--tight">' +
      '<div class="chips"><span class="chip is-coral">EVENT</span>' + (count > 1 ? '<span class="chip is-white">' + n + ' of ' + count + ' today</span>' : '') + '</div>' +
      '<h1 class="title-md">' + esc(event.title) + '</h1>' +
      mascot('mascot--peek') +
      '</section>' +
      '<h2 class="title-sm">What do you do?</h2>' +
      ['a', 'b'].map(function (k) {
        return '<button type="button" class="choice" data-answer="' + k + '">' +
          '<span class="choice-title">' + k.toUpperCase() + '. ' + esc(event[k].label) + '</span>' +
          chips(event[k].effects) + '</button>';
      }).join('') +
      '<p class="small-print center">The lesson appears after you choose.</p>',
      weekOpts()
    );
    on('[data-answer]', function (el) {
      var r = E.resolveEvent(game, event.id, el.getAttribute('data-answer'));
      lesson({
        title: r.response.label + '.',
        deltas: r.deltas,
        lessons: [{ heading: 'Lesson', text: r.lesson }],
        next: function () { nextEvent(queue, count); },
        opts: weekOpts(),
      });
    });
  }

  function endDay(eventCount) {
    var r = E.endDay(game);
    var reasons = ['Hype fell by 5 overnight.'];
    if (r.parts.drift) reasons.push('Hype and Trust pulled the price ' + (r.parts.drift > 0 ? 'up' : 'down') + ' by ' + fmt(Math.abs(r.parts.drift)) + '.');
    if (r.parts.pressure) reasons.push('Big Team or Investor buckets added sell pressure of 3.');
    reasons.push('Market noise moved it ' + (r.parts.swing >= 0 ? 'up' : 'down') + ' by ' + fmt(Math.abs(r.parts.swing)) + '.');
    if (r.parts.multiplier > 1) reasons.push('Liquidity is below 30, so every move was doubled.');

    render(
      '<h1 class="title-lg">End of day ' + r.day + '</h1>' +
      (eventCount ? '' : '<p class="text">A quiet day. Nothing new landed on your desk.</p>') +
      priceHead(r.move, 'overnight') +
      chart(game.priceHistory) +
      '<section class="card stack stack--tight"><h2 class="title-sm">Why the price moved</h2>' +
      '<ul class="flag-list">' + reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>' +
      '<button type="button" class="btn btn--ink btn--block" data-next>' + (r.done ? 'See your score' : 'Start day ' + (r.day + 1)) + '</button>',
      { step: 6, pill: 'Day ' + r.day + ' of ' + D.DAYS, pillColor: 'yellow', meters: true }
    );
    on('[data-next]', function () { (r.done ? results : startDay)(); });
  }

  // ---------- Step 7: results ----------

  function results() {
    var score = E.computeScore(game);
    var sum = E.summarizeDecisions(game);
    var s = game.stats;
    var worst = sum.worst;

    function bar(label, width, value, color) {
      return '<div class="meter-row"><span class="label">' + label + '</span>' +
        '<div class="meter"><span class="fill-' + color + '" style="width:' + Math.round(Math.max(0, Math.min(100, width))) + '%"></span></div>' +
        '<span class="label">' + value + '</span></div>';
    }

    var mistake = worst[0] ? 'My biggest mistake was ' + worst[0].short + '.' : 'My biggest mistake was not worth naming.';
    var canvas = document.createElement('canvas');
    var ready = ToyKit.drawShareCard(canvas, {
      title: C.shareTitle,
      big: score.total,
      bigLabel: 'out of 100',
      rank: score.rank.label,
      stats: [['Price day 7', fmt(s.price)], ['Trust', s.trust], ['Runway', s.runway]],
      line: mistake,
      cta: 'Can you do better?',
      mascotSrc: MASCOT,
    });
    var post = C.sharePost.replace('{rank}', score.rank.label);

    var book = SITE.bookUrl
      ? '<p class="text center"><a href="' + esc(SITE.bookUrl) + '" target="_blank" rel="noopener">' + esc(C.bookLabel) + '</a></p>'
      : '<p class="small-print center">' + esc(C.bookSoon) + '</p>';

    render(
      '<section class="card card--hero hero" aria-labelledby="rank-title">' +
      '<div class="hero-copy"><p class="label">Your rank</p><h1 id="rank-title" class="title-xl">' + esc(score.rank.label) + '</h1></div>' +
      '<p class="score-line"><span class="score-big">' + score.total + '</span><span class="label">out of 100</span></p>' +
      '<p class="hero-text">' + esc(score.rank.line) + '</p>' +
      '<img class="mascot mascot--lg" src="' + MASCOT + '" alt="" width="116" height="116" />' +
      '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">Where you ended up</h2>' +
      bar('Price', s.price / 2, fmt(s.price), 'yellow') +
      bar('Trust', s.trust, s.trust, 'blue') +
      bar('Runway', s.runway, s.runway, 'coral') +
      bar('Liquidity', s.liquidity, s.liquidity, 'mint') +
      bar('Hype', s.hype, s.hype, 'coral') +
      bar('Ownership', score.parts.ownership, game.ownership + '%', 'yellow') +
      '</section>' +
      (worst.length
        ? worst.map(function (d, i) {
            return '<section class="card card--warning stack stack--tight">' +
              '<div class="chips"><span class="chip is-coral">' + (i === 0 ? 'Most expensive decision' : 'Expensive decision') + '</span></div>' +
              '<h2 class="title-sm">' + esc(cap(d.short)) + '</h2>' +
              '<p class="text">' + esc(d.lesson) + '</p></section>';
          }).join('')
        : '<section class="card card--good"><p class="text text--ink">None of your choices cost you much. Rare.</p></section>') +
      (sum.best
        ? '<section class="card card--good stack stack--tight">' +
          '<div class="chips"><span class="chip is-mint">Best decision</span></div>' +
          '<h2 class="title-sm">' + esc(cap(sum.best.short)) + '</h2>' + chips(sum.best.deltas) +
          '<p class="text">Why it worked: ' + esc(sum.best.lesson) + '</p></section>'
        : '') +
      '<p class="small-print center">' + esc(D.RESULTS_NOTE) + ' ' + esc(D.DISCLAIMER) + '</p>' +
      '<h2 class="section-title">Your share card</h2>' +
      '<img class="share-preview" data-preview alt="Share card: ' + esc(score.rank.label) + ', ' + score.total + ' out of 100" />' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-share>Share</button>' +
      '<button type="button" class="btn" data-again>Play again with a different route</button></div>' +
      ToyKit.signupHtml(C.signup) +
      book,
      { pill: 'Launch complete', pillColor: 'mint' }
    );

    ready.then(function () {
      var img = app.querySelector('[data-preview]');
      if (img) img.src = canvas.toDataURL('image/png');
    }).catch(function () {});
    on('[data-share]', function () {
      ready.then(function () { ToyKit.share(canvas, post, 'token-launch.png'); });
    });
    on('[data-again]', function () {
      lastRoute = game.choices.route;
      newGame();
    });
    ToyKit.bind(app, null);
  }

  intro();
})();
