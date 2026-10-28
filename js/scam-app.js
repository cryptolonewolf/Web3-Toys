// Screens for Spot the Scam. Content lives in data/, logic in scam-game.js and
// scam-checker.js, shared pieces in toy-kit.js.

(function () {
  var RULES = null; // checker rules, loaded from data/scam_rules.json when the checker opens
  var SCENARIOS = window.WEB3TOYS_SCAM_SCENARIOS;
  var SETTINGS = window.WEB3TOYS_SCAM_GAME;
  var esc = ToyKit.esc;

  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var progress = document.getElementById('progress');

  var MASCOT = '../assets/mascot.svg';
  var SHARE_URL = 'web3.toys/scam';
  var ruleById = {};
  SETTINGS.flags.forEach(function (r) { ruleById[r.id] = r; });

  var game = null;

  // ---------- Helpers ----------

  function render(html, status) {
    app.innerHTML = html;
    pill.textContent = status.text;
    pill.className = 'pill' + (status.color ? ' is-' + status.color : '');
    progress.hidden = !game || status.progress == null;
    if (!progress.hidden) {
      progress.innerHTML = game.rounds.map(function (_, i) {
        return '<span class="' + (i < status.progress ? 'done' : '') + '"></span>';
      }).join('');
    }
    window.scrollTo(0, 0);
    var heading = app.querySelector('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
  }

  function on(selector, handler) {
    app.querySelectorAll(selector).forEach(function (el) {
      el.addEventListener('click', function (e) { handler(el, e); });
    });
  }

  function setHash(hash) {
    if (location.protocol === 'file:') return;
    history.replaceState(null, '', hash ? '#' + hash : location.pathname);
  }

  // Signup, report and call buttons, used on both end screens.
  function endExtras() {
    return (
      ToyKit.signupHtml(SETTINGS.signup) +
      '<div class="btn-row">' + ToyKit.reportButton() + ToyKit.callButton() + '</div>' +
      '<p class="small-print center" data-soon-msg aria-live="polite"></p>'
    );
  }

  function bindExtras() {
    ToyKit.bind(app, app.querySelector('[data-soon-msg]'));
  }

  function shareCard(data, text, filename) {
    var canvas = document.createElement('canvas');
    data.mascotSrc = MASCOT;
    var ready = ToyKit.drawShareCard(canvas, data);
    return {
      ready: ready,
      canvas: canvas,
      share: function () {
        return ready.then(function () { return ToyKit.share(canvas, text, filename); });
      },
    };
  }

  // ---------- Start ----------

  function start() {
    game = null;
    setHash('');
    render(
      '<section class="card card--hero hero" aria-labelledby="scam-title">' +
      '<div class="hero-copy"><p class="label">Free web3 toy</p>' +
      '<h1 id="scam-title" class="title-xl">Spot the Scam</h1></div>' +
      '<p class="hero-text">Crypto scams look more real every year. Practise on fake ones, or check a message you got.</p>' +
      '<img class="mascot mascot--lg" src="' + MASCOT + '" alt="" width="116" height="116" />' +
      '</section>' +
      '<div class="stack stack--tight">' +
      '<button type="button" class="choice choice--big is-yellow" data-play>' +
      '<span class="choice-title">Play the game</span>' +
      '<span class="choice-desc">10 rounds. Scam or legit? Tag the red flags and get a rank.</span></button>' +
      '<button type="button" class="choice choice--big" data-check>' +
      '<span class="choice-title">Check a message</span>' +
      '<span class="choice-desc">Paste a message you got and see what feels fake. It never leaves your device.</span></button>' +
      '</div>',
      { text: 'by BuildWithAki' }
    );
    on('[data-play]', newGame);
    on('[data-check]', function () { checker(); });
  }

  // ---------- Game ----------

  function newGame() {
    game = {
      rounds: ScamGame.pickRounds(SCENARIOS, SETTINGS),
      i: 0,
      results: [],
    };
    setHash('play');
    round();
  }

  function initial(name) {
    return esc((name || '?').trim().charAt(0).toUpperCase());
  }

  function artifactHtml(s) {
    var label = esc(SETTINGS.typeLabels[s.type]);
    if (s.type === 'airdrop' || s.type === 'token') {
      return (
        '<article class="artifact artifact--page" aria-label="' + label + '">' +
        '<div class="browser-bar"><span class="browser-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span class="browser-url">' + esc(s.url) + '</span></div>' +
        '<div class="artifact-body">' +
        '<h2 class="title-md">' + esc(s.title) + '</h2>' +
        '<p class="text">' + esc(s.body) + '</p>' +
        (s.button ? '<span class="fake-btn" aria-hidden="true">' + esc(s.button) + '</span>' : '') +
        '</div></article>'
      );
    }
    if (s.type === 'support') {
      return (
        '<article class="artifact artifact--mail" aria-label="' + label + '">' +
        '<p class="mail-row"><span class="mail-key">From</span><span>' + esc(s.from.name) +
        ' <span class="handle">&lt;' + esc(s.from.handle) + '&gt;</span></span></p>' +
        '<p class="mail-row"><span class="mail-key">Subject</span><strong>' + esc(s.subject) + '</strong></p>' +
        '<p class="artifact-text">' + esc(s.body) + '</p>' +
        '</article>'
      );
    }
    var head =
      '<div class="artifact-head"><span class="avatar avatar--' + s.type + '" aria-hidden="true">' + initial(s.from.name) + '</span>' +
      '<span><strong>' + esc(s.from.name) + '</strong><span class="handle">' + esc(s.from.handle) + '</span></span></div>';
    if (s.type === 'dm') {
      return '<article class="artifact" aria-label="' + label + '">' + head +
        '<p class="bubble">' + esc(s.body) + '</p></article>';
    }
    return (
      '<article class="artifact" aria-label="' + label + '">' + head +
      '<p class="artifact-text">' + esc(s.body) + '</p>' +
      '<p class="artifact-meta">2h · ' + (s.body.length * 7) + ' likes · ' + (s.body.length * 2) + ' reposts</p>' +
      '</article>'
    );
  }

  function round() {
    var s = game.rounds[game.i];
    var tags = [];
    render(
      '<div class="stack stack--tight">' +
      '<div class="chips"><span class="chip is-blue">' + esc(SETTINGS.typeLabels[s.type]) + '</span></div>' +
      '<h1 class="title-lg">Scam or legit?</h1></div>' +
      artifactHtml(s) +
      '<section class="stack stack--tight" aria-labelledby="tag-title">' +
      '<h2 id="tag-title" class="title-sm">Tag the red flags you spot <span class="small-print">(optional)</span></h2>' +
      '<div class="flag-grid">' +
      SETTINGS.flags.map(function (r) {
        return '<button type="button" class="flag-toggle" aria-pressed="false" data-tag="' + esc(r.id) + '">' + esc(r.tag) + '</button>';
      }).join('') +
      '</div></section>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn--scam" data-verdict="scam">Scam</button>' +
      '<button type="button" class="btn btn--legit" data-verdict="legit">Legit</button>' +
      '</div>' +
      '<p class="small-print center">The explanation appears after you choose.</p>',
      { text: 'Round ' + (game.i + 1) + ' of ' + game.rounds.length, color: 'yellow', progress: game.i }
    );
    on('[data-tag]', function (el) {
      var id = el.getAttribute('data-tag');
      var at = tags.indexOf(id);
      if (at === -1) tags.push(id);
      else tags.splice(at, 1);
      el.setAttribute('aria-pressed', String(at === -1));
    });
    on('[data-verdict]', function (el) {
      var verdict = el.getAttribute('data-verdict');
      var result = ScamGame.scoreRound(s, verdict, tags, SETTINGS);
      game.results.push(result);
      reveal(s, result);
    });
  }

  function names(ids) {
    return ids.map(function (id) { return ruleById[id].tag; }).join(', ');
  }

  function reveal(s, r) {
    var isScam = s.answer === 'scam';
    var last = game.i === game.rounds.length - 1;
    var flagsHtml;
    if (isScam) {
      flagsHtml =
        '<ul class="flag-list">' +
        s.flags.map(function (id) {
          var got = r.spotted.indexOf(id) !== -1;
          return '<li><span class="chip ' + (got ? 'is-mint">You spotted it' : 'is-white">Missed') + '</span> ' +
            esc(ruleById[id].name) + '</li>';
        }).join('') +
        '</ul>' +
        (r.extra.length ? '<p class="text">You also tagged: ' + esc(names(r.extra)) + '. Those were not in this one.</p>' : '');
    } else {
      flagsHtml =
        '<p class="text">No red flags in this one.' +
        (r.extra.length ? ' You tagged: ' + esc(names(r.extra)) + '. Those were not in this one.' : '') + '</p>';
    }

    render(
      '<section class="card stack stack--tight ' + (r.correct ? 'card--good' : 'card--warning') + '">' +
      '<p class="label">' + (r.correct ? 'Nice call' : 'Not quite') + '</p>' +
      '<h1 class="title-lg">' + (r.correct ? (isScam ? 'Right, it is a scam.' : 'Right, it is legit.') : (isScam ? 'This one is a scam.' : 'This one is legit.')) + '</h1>' +
      '<div class="chips"><span class="chip is-white">+' + r.points + ' points</span></div>' +
      '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">Red flags</h2>' + flagsHtml + '</section>' +
      '<section class="card card--yellow stack stack--tight"><h2 class="title-sm">Why</h2>' +
      '<p class="text text--ink">' + esc(s.explain) + '</p></section>' +
      '<button type="button" class="btn btn--ink btn--block" data-next>' + (last ? 'See my rank' : 'Next round') + '</button>',
      { text: 'Round ' + (game.i + 1) + ' of ' + game.rounds.length, color: 'yellow', progress: game.i + 1 }
    );
    on('[data-next]', function () {
      if (last) return gameEnd();
      game.i++;
      round();
    });
  }

  function gameEnd() {
    var score = game.results.reduce(function (sum, r) { return sum + r.points; }, 0);
    var rank = ScamGame.rankFor(score, SETTINGS.ranks);
    var right = game.results.filter(function (r) { return r.correct; }).length;
    var flagsTotal = game.rounds.reduce(function (sum, s) { return sum + s.flags.length; }, 0);
    var flagsSpotted = game.results.reduce(function (sum, r) { return sum + r.spotted.length; }, 0);

    function meter(label, n, of) {
      return '<div class="meter-row"><span class="label">' + label + '</span>' +
        '<div class="meter"><span style="width:' + Math.round((n / Math.max(1, of)) * 100) + '%"></span></div>' +
        '<span class="label">' + n + '/' + of + '</span></div>';
    }

    var card = shareCard(
      {
        title: 'I played Spot the Scam.',
        big: score,
        bigLabel: 'out of 100',
        rank: rank.label,
        line: right + ' of 10 called right. ' + flagsSpotted + (flagsSpotted === 1 ? ' red flag' : ' red flags') + ' spotted.',
        cta: 'Can you do better?',
      },
      'I played Spot the Scam and got ' + rank.label + ' (' + score + '/100). Can you do better? ' + SHARE_URL,
      'spot-the-scam.png'
    );

    render(
      '<section class="card card--hero hero" aria-labelledby="rank-title">' +
      '<div class="hero-copy"><p class="label">Your rank</p><h1 id="rank-title" class="title-xl">' + esc(rank.label) + '</h1></div>' +
      '<p class="score-line"><span class="score-big">' + score + '</span><span class="label">out of 100</span></p>' +
      '<p class="hero-text">' + esc(rank.line) + '</p>' +
      '<img class="mascot mascot--lg" src="' + MASCOT + '" alt="" width="116" height="116" />' +
      '</section>' +
      '<section class="card stack stack--tight"><h2 class="title-sm">How you did</h2>' +
      meter('Right calls', right, game.rounds.length) +
      meter('Red flags', flagsSpotted, flagsTotal) +
      '</section>' +
      '<h2 class="section-title">Your share card</h2>' +
      '<img class="share-preview" data-preview alt="Share card: ' + esc(rank.label) + ', ' + score + ' out of 100" />' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-share>Share</button>' +
      '<button type="button" class="btn" data-again>Play again</button></div>' +
      endExtras() +
      '<button type="button" class="btn btn--block" data-check>Check a real message</button>',
      { text: 'Game complete', color: 'mint' }
    );
    card.ready.then(function () {
      var img = app.querySelector('[data-preview]');
      if (img) img.src = card.canvas.toDataURL('image/png');
    }).catch(function () {});
    on('[data-share]', function () { card.share(); });
    on('[data-again]', newGame);
    on('[data-check]', function () { game = null; checker(); });
    bindExtras();
  }

  // ---------- Checker ----------

  // The public phishing lists (data/scam-feed.js) are large, so they load only
  // when the checker opens, before anything is pasted. Turned on and off with
  // usePublicLists in data/scam-known.js.
  var feedLoading = null;

  function loadFeed() {
    var known = window.WEB3TOYS_SCAM_KNOWN || {};
    if (!known.usePublicLists) return Promise.resolve(null);
    if (!feedLoading) {
      feedLoading = new Promise(function (resolve) {
        var s = document.createElement('script');
        s.src = '../data/scam-feed.js';
        s.onload = function () { resolve(window.WEB3TOYS_SCAM_FEED || null); };
        s.onerror = function () { resolve(null); };
        document.head.appendChild(s);
      });
    }
    return feedLoading;
  }

  // Waits for the feed, but never more than a few seconds.
  function feedReady() {
    return Promise.race([
      loadFeed(),
      new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 4000); }),
    ]);
  }

  // The checker rules (data/scam_rules.json) load when the checker opens.
  var rulesLoading = null;

  function loadRules() {
    if (!rulesLoading) {
      rulesLoading = fetch('../data/scam_rules.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error('rules ' + r.status); return r.json(); })
        .then(function (data) { RULES = data; return data; })
        .catch(function (err) { rulesLoading = null; throw err; });
    }
    return rulesLoading;
  }

  function checker(prefill) {
    game = null;
    setHash('check');
    render(
      '<div class="stack stack--tight">' +
      '<h1 class="title-lg">Check a message</h1>' +
      '<p class="text">Paste a message, email, promotion or deal you got, then tap Check it. We point out what looks like a scam.</p></div>' +
      '<section class="card stack stack--tight">' +
      '<label class="label" for="message">Paste it here</label>' +
      '<textarea id="message" class="field field--area" rows="8" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" placeholder="Paste the message here"></textarea>' +
      '<p class="privacy-line">Your message stays in your browser.</p>' +
      '<p class="small-print">The check runs on this device using our rules. Nothing you paste is sent anywhere or saved, and links in it are never opened.</p>' +
      '<p class="small-print" data-error aria-live="polite"></p>' +
      '<button type="button" class="btn btn--ink btn--block" data-run>Check it</button>' +
      '<button type="button" class="btn btn--block" data-example>Try an example</button>' +
      '</section>' +
      '<p class="small-print center"><strong>Never paste a seed phrase, private key or password</strong>, here or anywhere.</p>' +
      '<p class="small-print center" data-feed-credit></p>' +
      '<button type="button" class="text-button center" data-home>Or play the game instead</button>',
      { text: 'Message checker', color: 'yellow' }
    );
    var box = app.querySelector('#message');
    var error = app.querySelector('[data-error]');
    if (prefill) box.value = prefill;
    loadRules().catch(function () {
      error.textContent = location.protocol === 'file:'
        ? 'The checker needs the website. Open this page through its web address or a Vercel preview link.'
        : 'The checker rules could not load. Please refresh the page.';
    });
    loadFeed().then(function (feed) {
      var credit = app.querySelector('[data-feed-credit]');
      if (feed && credit) {
        credit.textContent = 'Also checks against public phishing lists from MetaMask and Polkadot, updated ' + feed.updated + '.';
      }
    });
    on('[data-example]', function () {
      loadRules().then(function (rules) {
        box.value = rules.example;
        box.focus();
      }).catch(function () {});
    });
    on('[data-home]', start);
    on('[data-run]', function () {
      var text = box.value;
      if (!text.trim()) {
        error.textContent = 'Paste a message in the box first.';
        box.focus();
        return;
      }
      var button = app.querySelector('[data-run]');
      button.disabled = true;
      Promise.all([loadRules(), feedReady()]).then(function (r) {
        var result = ScamChecker.check(text, r[0], [window.WEB3TOYS_SCAM_KNOWN, r[1]]);
        box.value = '';
        if (result.blocked) {
          text = '';
          blocked(result.blocked);
        } else {
          checkResult(result, text);
        }
      }).catch(function () {
        button.disabled = false;
        error.textContent = 'The checker rules could not load. Please refresh the page.';
      });
    });
  }

  function blocked(kind) {
    var what = kind === 'seed' ? 'a seed phrase' : 'a private key';
    render(
      '<section class="card card--warning stack stack--tight" role="alert">' +
      '<div class="chips"><span class="chip is-coral">Stop</span></div>' +
      '<h1 class="title-lg">That looks like ' + what + '.</h1>' +
      '<p class="text text--ink"><strong>Never paste these anywhere. Delete it now.</strong></p>' +
      '<p class="text">We did not check it, and we cleared the box. Nothing left your device.</p>' +
      '<p class="text">Delete it from wherever you copied it, too. If you ever typed it into a website or sent it to someone, move your funds to a new wallet right away.</p>' +
      '</section>' +
      '<button type="button" class="btn btn--ink btn--block" data-delete>Delete it and go back</button>' +
      '<p class="small-print center" data-clip aria-live="polite"></p>',
      { text: 'Message checker', color: 'coral' }
    );
    on('[data-delete]', function () {
      // Overwrite the clipboard too, in case the secret is still on it.
      var go = function () { checker(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(' ').then(go, go);
      else go();
    });
  }

  var LEVEL_STYLE = {
    critical: { card: 'card--warning', chip: 'is-coral' },
    high: { card: 'card--warning', chip: 'is-coral' },
    medium: { card: 'card--yellow', chip: 'is-white' },
    low: { card: '', chip: 'is-white' },
  };

  // text: the pasted message. It is only shown back on this screen, in this
  // browser, and is gone when the visitor checks another or leaves.
  function checkResult(r, text) {
    var style = LEVEL_STYLE[r.level.id] || LEVEL_STYLE.low;
    var flagWord = r.count === 1 ? 'red flag' : 'red flags';

    var card = shareCard(
      {
        title: 'I checked a message for scams.',
        big: r.score,
        bigLabel: 'out of 100',
        rank: r.level.label + ' risk',
        line: r.count + ' ' + flagWord + ' found. Nothing I pasted left my device.',
        cta: 'Check yours',
      },
      'I ran a message through the Spot the Scam checker: ' + r.level.label + ' risk, ' + r.count + ' ' + flagWord + '. Check yours at ' + SHARE_URL,
      'scam-check.png'
    );

    render(
      '<section class="card ' + style.card + ' stack stack--tight" aria-labelledby="result-title">' +
      '<div class="chips"><span class="chip ' + style.chip + '">' + esc(r.level.label) + ' risk</span>' +
      '<span class="chip is-white">' + r.count + ' ' + flagWord + '</span></div>' +
      '<p class="score-line"><span class="score-big">' + r.score + '</span><span class="label">out of 100</span></p>' +
      '<h1 id="result-title" class="title-md">' + esc(r.level.message) + '</h1>' +
      '</section>' +
      (r.flags.length
        ? '<section class="stack stack--tight"><h2 class="section-title">What we found</h2>' +
          r.flags.map(function (f) {
            return '<article class="card stack stack--tight">' +
              '<div class="chips"><span class="chip is-white">' + esc(f.category) + '</span>' +
              '<span class="chip ' + (f.rule.critical ? 'is-coral' : 'is-yellow') + '">' + (f.rule.critical ? 'Critical' : '+' + f.points) + '</span></div>' +
              '<h3 class="title-sm">' + esc(f.rule.name) + '</h3>' +
              '<p class="text">' + esc(f.rule.explain) + '</p></article>';
          }).join('') + '</section>'
        : '') +
      '<section class="card stack stack--tight"><h2 class="title-sm">Your message</h2>' +
      (r.spans.length ? '<p class="small-print">Highlighted words matched a rule.</p>' : '') +
      '<div class="msg-highlight">' + ScamChecker.highlight(text, r.spans) + '</div>' +
      '<p class="small-print">Shown only on this screen, in your browser.</p></section>' +
      '<p class="small-print center">' + esc(SETTINGS.notes.checker) + '</p>' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn--ink" data-again>Check another</button>' +
      '<button type="button" class="btn" data-share>Share</button>' +
      ToyKit.reportButton('btn--yellow') + ToyKit.callButton() +
      '</div>' +
      '<p class="small-print center" data-soon-msg aria-live="polite"></p>' +
      '<p class="text center">' + esc(SETTINGS.notes.secondOpinion) + ' ' + ToyKit.callLink('Book a call') + '.</p>' +
      ToyKit.signupHtml(SETTINGS.signup) +
      '<button type="button" class="text-button center" data-play>Play the game</button>',
      { text: 'Message checker', color: 'yellow' }
    );
    on('[data-again]', function () { checker(); });
    on('[data-share]', function () { card.share(); });
    on('[data-play]', newGame);
    bindExtras();
  }

  // Open the checker straight away for links ending in #check.
  if (location.hash === '#check') checker();
  else start();
})();
