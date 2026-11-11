// The Quests page: sponsored courses from data/academy/, with
// filters by chain and category. Only vetted courses whose sponsorship has
// not ended are shown.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var progress = Web3Progress.load(window.localStorage);
  var courses = [];
  var chain = '';
  var category = '';

  C.loadJson('../data/academy/index.json')
    .then(function (idx) {
      return Promise.all(idx.courses.map(function (id) {
        return C.loadJson('../data/academy/' + id + '.json').catch(function () { return null; });
      }));
    })
    .then(function (list) {
      courses = list.filter(function (c) { return Academy.visible(c); });
      render();
    })
    .catch(function (err) { app.innerHTML = C.loadError(err); });

  function options(key) {
    var seen = {};
    courses.forEach(function (c) { seen[c[key]] = true; });
    return Object.keys(seen).sort();
  }

  function chips(label, key, current) {
    return '<div class="ac-filter"><span class="label">' + label + '</span><div class="tool-chips">' +
      ['All'].concat(options(key)).map(function (v) {
        var val = v === 'All' ? '' : v;
        return '<button type="button" class="chip-btn' + (val === current ? ' is-on' : '') + '" data-' + key + '="' + esc(val) + '" aria-pressed="' + (val === current) + '">' + esc(v) + '</button>';
      }).join('') + '</div></div>';
  }

  function card(c) {
    var done = progress.certificates['academy:' + c.id];
    return '<li><a class="card ac-card" href="course/?id=' + encodeURIComponent(c.id) + '" style="--p:' + esc(c.colors.primary) + ';--a:' + esc(c.colors.accent) + ';--t:' + esc(c.colors.text) + '">' +
      '<div class="ac-card-top"><img class="ac-logo" src="../' + esc(c.logo) + '" alt="" width="56" height="56" />' +
      '<span class="ac-sponsored">Sponsored</span>' + (done ? '<span class="ac-done" title="Passed">✓</span>' : '') + '</div>' +
      '<div class="ac-card-body"><h2 class="title-sm">' + esc(c.name) + '</h2>' +
      (c.tagline ? '<p class="small-print">' + esc(c.tagline) + '</p>' : '') +
      '<div class="chips"><span class="chip is-white">' + c.minutes + ' min</span><span class="chip is-white">' + c.lessons.length + ' lessons</span>' +
      '<span class="chip is-white">' + esc(c.chain) + '</span><span class="chip is-white">' + esc(c.category) + '</span></div>' +
      '<p class="ac-pro-preview">Earn: <span class="pro-tag" style="--p:' + esc(c.colors.primary) + ';--a:' + esc(c.colors.accent) + '">' + esc(c.name) + ' Pro</span></p>' +
      '</div></a></li>';
  }

  function render() {
    var list = Academy.filterCourses(courses, chain, category);
    app.innerHTML =
      '<section class="tool-head stack stack--tight"><h1 class="tool-title">Quests</h1>' +
      '<p class="text text--ink">Pick a real web3 project, learn how it works in 5 minutes, then beat the quiz to unlock its Pro badge and a certificate you can share.</p>' +
      '<p class="tool-disclaimer">Quests are sponsored by the projects. web3.toys does not endorse any token. Not financial advice.</p></section>' +
      (courses.length ? '<div class="ac-filters">' + chips('Chain', 'chain', chain) + chips('Category', 'category', category) + '</div>' : '') +
      (list.length ? '<ul class="ac-grid">' + list.map(card).join('') + '</ul>' : '<p class="card text">No quests match. Try All.</p>') +
      '<a class="card ac-list" href="list-your-project/"><span class="title-sm">Run a web3 project?</span><span class="text">Turn it into a Quest players love. See how it works →</span></a>';
    app.querySelectorAll('[data-chain]').forEach(function (b) {
      b.addEventListener('click', function () { chain = b.getAttribute('data-chain'); render(); site.sound.play('tick'); });
    });
    app.querySelectorAll('[data-category]').forEach(function (b) {
      b.addEventListener('click', function () { category = b.getAttribute('data-category'); render(); site.sound.play('tick'); });
    });
  }
})();
