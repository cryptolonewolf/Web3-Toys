// One Hall of Fame person's page: hall-of-fame/ID/ (made by
// tools/hof-build.mjs). Their card, why they matter, the fun fact, how many
// players named them, a vote button, Share on X (tags them when they have a
// handle) and Play. Data: data/hall-of-fame-people.json.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var id = document.body.getAttribute('data-person');
  var URL_BASE = ((window.WEB3TOYS_CONFIG || {}).siteUrl || 'https://web3.toys') + '/hall-of-fame/';
  var SB = (window.WEB3TOYS_CONFIG || {}).supabase || {};
  var people = [], cats = {}, p = null, numbers = {};

  // The pencil wobble used by the sketches.
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="hof-pencil"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></svg>');

  function sb(fn, body) {
    if (!SB.url || !SB.anonKey) return Promise.reject(new Error('off'));
    return fetch(SB.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: SB.anonKey, Authorization: 'Bearer ' + SB.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (r) { if (!r.ok) throw new Error('busy'); return r.json(); });
  }

  C.loadJson('../../data/hall-of-fame-people.json').then(function (d) {
    people = d.people;
    d.categories.forEach(function (c) { cats[c.id] = c; });
    p = people.filter(function (x) { return x.id === id; })[0];
    if (!p) { app.innerHTML = '<p class="card">We could not find this builder. <a href="../">See the Hall of Fame</a></p>'; return; }
    render();
    sb('hof_numbers').then(function (rows) {
      (rows || []).forEach(function (r) { numbers[r.person_id] = r; });
      render();
    }).catch(function () {});
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function post() {
    var who = p.x && !p.caution ? '@' + p.x : p.name;
    return (p.caution ? 'A lesson from ' + p.name + ': ' + p.why + '.' : 'Fun fact about ' + p.name + ': ' + p.fun + '. ' + who + ' is in the web3.toys Hall of Fame 🏛️') +
      ' Can you name all 50 web3 builders? ' + URL_BASE + p.id + '/';
  }

  function render() {
    var cat = cats[p.cat] || {};
    var n = numbers[p.id] || {};
    var others = people.filter(function (x) { return x.cat === p.cat && x !== p; }).slice(0, 4);
    app.innerHTML =
      '<section class="card stack hof-card hof-person' + (p.caution ? ' is-caution' : '') + '">' +
      '<p class="label">' + (p.caution ? '⚠️ A cautionary tale' : '🏛️ Inducted into the web3.toys Hall of Fame') + '</p>' +
      '<div class="hof-card-top">' + Web3HofCard.portrait(p, cat.color, 'hof-face--lg', '../../') +
      '<div class="stack stack--tight"><h1 class="title-lg">' + esc(p.name) + '</h1><p class="text text--ink">' + esc(p.role) + '</p>' +
      '<p class="hof-tags"><span class="chip">' + esc(cat.icon || '') + ' ' + esc(cat.title || '') + '</span>' +
      (p.anon ? '<span class="chip">🕶️ Never shown their face</span>' : '') + '</p></div></div>' +
      '<p class="text"><b>Why they matter:</b> ' + esc(p.why) + '</p>' +
      '<h2 class="title-sm">The story</h2><p class="text">' + esc(p.story) + '</p>' +
      (p.known && p.known.length ? '<p class="hof-known"><b>Known for:</b> ' + p.known.map(function (k) { return '<span class="chip">' + esc(k) + '</span>'; }).join('') + '</p>' : '') +
      '<p class="tip">' + site.icon('bulb') + '<span><b>Fun fact:</b> ' + esc(p.fun) + '</span></p>' +
      (n.right_pct != null ? '<p class="small-print hof-pct">📊 ' + n.right_pct + '% of players named them from the clue.</p>' : '') +
      (n.votes ? '<p class="small-print">❤️ ' + n.votes + (n.votes === 1 ? ' player' : ' players') + ' voted them their favourite builder.</p>' : '') +
      '<div class="btn-row"><a class="btn btn--ink" href="../">Play Web3 Hall of Famers</a>' +
      '<a class="btn" href="https://x.com/intent/post?text=' + encodeURIComponent(post()) + '" target="_blank" rel="noopener" data-share>Share on X</a>' +
      (p.caution ? '' : '<button type="button" class="btn" data-vote>❤️ Vote favourite</button>') +
      '<a class="btn" href="' + esc(p.more) + '" target="_blank" rel="noopener">Read more</a></div>' +
      '<p class="small-print" data-msg aria-live="polite"></p></section>' +
      '<h2 class="section-title">The card</h2><img class="share-preview" data-card alt="' + esc(p.name) + ' Hall of Fame card" />' +
      '<div class="btn-row"><button type="button" class="btn btn--small" data-download>Download the card</button></div>' +
      (others.length ? '<h2 class="section-title">More ' + esc((cat.title || '').toLowerCase()) + '</h2><ul class="hof-more">' + others.map(function (x) {
        return '<li><a href="../' + esc(x.id) + '/">' + Web3HofCard.portrait(x, cat.color, 'hof-face--sm', '../../') + '<span>' + esc(x.name) + '</span></a></li>';
      }).join('') + '</ul>' : '') +
      '<p class="small-print">Public information as of November 2026. Something out of date? Tell us at hi@web3.toys.</p>';
    var canvas = document.createElement('canvas');
    Web3HofCard.draw(canvas, p, cat, { root: '../../', pct: n.right_pct }).then(function () {
      var img = app.querySelector('[data-card]');
      if (img) img.src = canvas.toDataURL('image/png');
    }).catch(function () {});
    app.querySelector('[data-download]').addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'web3toys-hall-of-fame-' + p.id + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
    app.querySelector('[data-share]').addEventListener('click', function () { site.log('share', 'hall-of-fame:' + p.id); });
    var vote = app.querySelector('[data-vote]');
    if (vote) vote.addEventListener('click', function () {
      var A = window.Web3Auth;
      var msg = app.querySelector('[data-msg]');
      if (!A) { msg.textContent = 'Voting opens soon.'; return; }
      if (!A.user()) { msg.textContent = 'Log in to vote, so every player gets one vote.'; A.open('Log in to vote for your favourite builder.'); return; }
      A.client.rpc('hof_vote', { p_person: p.id }).then(function (r) {
        if (r.error) throw r.error;
        msg.textContent = 'Voted! Your vote now goes to ' + p.name + '.';
        vote.disabled = true;
      }).catch(function (err) { msg.textContent = 'Could not save: ' + err.message; });
    });
  }
})();
