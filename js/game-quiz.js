// Every game ends with a certificate: a short quiz after the score screen
// (the questions are in quizzes/ID.json, graded on the server by js/quiz.js).
//   GameQuiz.cta(toyId) -> the "Earn your certificate" box, for finish screens
// Links ending in #quiz open the quiz, and #certificate (from My Progress)
// shows the saved certificate.

(function () {
  var TITLES = {
    scam: 'Spot the Scam',
    'dead-projects': 'Fish the Dead Projects',
    'invest-100': 'What If You Invested $100',
    'token-split': 'Rug or Real: Read the Token Split',
    'token-simulator': 'Launch a Token Simulator',
  };

  function toy(id) { return { id: id, title: TITLES[id] || id }; }

  function start(id) {
    if (!window.ToyQuiz) return;
    window.scrollTo(0, 0);
    ToyQuiz.start(toy(id), {
      app: document.getElementById('app'),
      pill: document.getElementById('status-pill'),
      backToCards: function () { location.hash = ''; location.reload(); },
    });
  }

  function cta(id) {
    var saved = window.Web3Progress && Web3Progress.load(localStorage).certificates[id];
    return '<section class="card card--yellow stack stack--tight gq-cta">' +
      '<h2 class="title-md">🎓 ' + (saved ? 'Your certificate' : 'Earn your certificate') + '</h2>' +
      '<p class="text">' + (saved ? 'You passed this one (' + saved.score + '%). Retake the quiz any time.' : '6 quick questions about what you just played. Score 70% to get a certificate you can share and anyone can check.') + '</p>' +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-game-quiz="' + id + '">' + (saved ? 'Retake the quiz' : 'Take the quiz') + '</button>' +
      (saved ? '<a class="btn" href="#certificate" data-game-cert="' + id + '">See my certificate</a>' : '') + '</div></section>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-game-quiz], [data-game-cert]');
    if (!b) return;
    e.preventDefault();
    if (b.hasAttribute('data-game-quiz')) { start(b.getAttribute('data-game-quiz')); return; }
    if (window.ToyQuiz) ToyQuiz.showSaved(toy(b.getAttribute('data-game-cert')));
  });

  // Opened with #quiz or #certificate: wait until the game has finished
  // drawing its start screen (no changes for a moment), then open the quiz.
  var id = document.body.getAttribute('data-toy');
  var want = location.hash; // remembered: some games clear the address on start
  if (TITLES[id] && /^#(quiz|certificate)$/.test(want)) {
    var app = document.getElementById('app');
    var done = false, timer = null;
    var go = function () {
      if (done) return;
      done = true;
      mo.disconnect();
      if (want === '#certificate' && window.ToyQuiz && ToyQuiz.showSaved(toy(id))) return;
      start(id);
    };
    var settle = function () { clearTimeout(timer); timer = setTimeout(go, 400); };
    var mo = new MutationObserver(settle);
    if (app) mo.observe(app, { childList: true, subtree: true });
    window.addEventListener('load', settle);
    setTimeout(go, 4000);
  }

  window.GameQuiz = { cta: cta, start: start, toy: toy };
})();
