// The quiz, the certificate and the finish screen for every toy.
// Questions come from the server (/api/quiz) without answers; the server
// marks them (/api/grade) and stamps the certificate code.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var CONFIG = window.WEB3TOYS_CONFIG || {};
  var API = '../api/';
  var site = window.WEB3TOYS;
  var CELEBRATE = site.mascotSrc('celebrating');

  function peek(pose) {
    return site.mascotImg(pose, 'mascot mascot--peek', 88);
  }

  var funnel = null;
  var ranks = null;
  var ui = null; // { app, pill, backToCards }

  function extras() {
    if (funnel && ranks) return Promise.resolve();
    return Promise.all([C.loadJson('../data/funnel.json'), C.loadJson('../data/ranks.json')]).then(function (r) {
      funnel = r[0];
      ranks = r[1].ranks;
    });
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function render(html, pillText, pillColor) {
    ui.app.innerHTML = html;
    ui.pill.textContent = pillText;
    ui.pill.className = 'pill' + (pillColor ? ' is-' + pillColor : '');
    window.scrollTo(0, 0);
    var h = ui.app.querySelector('h1');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }

  function on(sel, fn) {
    ui.app.querySelectorAll(sel).forEach(function (el) { el.addEventListener('click', function (e) { fn(el, e); }); });
  }

  function problem(message) {
    var local = location.protocol === 'file:';
    render('<section class="card card--warning stack stack--tight" role="alert"><h1 class="title-md">The quiz could not load.</h1>' +
      '<p class="text text--ink">' + esc(local ? 'Quizzes need the website. Open this page through its web address or a Vercel preview link.' : message) + '</p></section>' +
      '<button type="button" class="btn btn--block" data-cards>Back to the cards</button>', 'Quiz', 'coral');
    on('[data-cards]', ui.backToCards);
  }

  function post(path, body) {
    return fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error('The server said ' + r.status); return r.json(); });
  }

  // ---------- Finish screen extras: Book a call and email signup ----------

  function funnelHtml() {
    var call = CONFIG.bookCallUrl
      ? '<a class="btn btn--yellow btn--block" href="' + esc(CONFIG.bookCallUrl) + '" target="_blank" rel="noopener">' + esc(funnel.call.button) + '</a>'
      : '<button type="button" class="btn btn--yellow btn--block" data-soon="call">' + esc(funnel.call.button) + '</button>';
    return '<section class="card stack stack--tight"><h2 class="title-md">' + esc(funnel.call.heading) + '</h2>' +
      '<p class="text">' + esc(funnel.call.line) + '</p>' + call +
      '<p class="small-print" data-soon-msg aria-live="polite"></p></section>' +
      ToyKit.signupHtml(funnel.signup);
  }

  function bindFunnel() {
    ToyKit.bind(ui.app, ui.app.querySelector('[data-soon-msg]'));
    var call = ui.app.querySelector('a[href="' + CONFIG.bookCallUrl + '"]');
    if (call) call.addEventListener('click', function () { C.track('book_call_clicked'); });
    var form = ui.app.querySelector('[data-signup]');
    if (form) form.addEventListener('submit', function () { C.track('signup_submitted'); });
  }

  // ---------- Quiz ----------

  function start(toy, context) {
    ui = context;
    extras().catch(function () {});
    render(
      '<div class="guide">' + site.face('thinking') +
      '<p class="guide-bubble">Let\'s see what stuck. You have got this.</p></div>' +
      '<section class="card card--yellow stack stack--tight"><span class="card-kind">' + site.icon('quiz') + 'Quiz</span>' +
      '<h1 class="title-lg toy-font">Quiz time</h1>' +
      '<ul class="lesson-points"><li>A few multiple choice questions.</li><li>20 seconds for each one.</li>' +
      '<li>Score 70 percent to earn your certificate.</li><li>Not this time? Retry as often as you like.</li></ul></section>' +
      '<button type="button" class="btn btn--ink btn--block" data-go>Start the quiz</button>' +
      '<button type="button" class="text-button center" data-cards>Back to the cards</button>',
      'Quiz', 'yellow'
    );
    on('[data-cards]', ui.backToCards);
    on('[data-go]', function () { run(toy); });
  }

  function run(toy) {
    render('<p class="text center">Loading the questions…</p>', 'Quiz', 'yellow');
    Promise.all([fetch(API + 'quiz?toy=' + encodeURIComponent(toy.id)).then(function (r) {
      if (!r.ok) throw new Error('The quiz is not available right now (' + r.status + ').');
      return r.json();
    }), extras()]).then(function (r) {
      var quiz = r[0];
      var questions = shuffle(quiz.questions).map(function (q) { return { id: q.id, question: q.question, options: shuffle(q.options) }; });
      C.track('quiz_started', { toy: toy.id });
      ask(toy, quiz, questions, 0, {});
    }).catch(function (err) { problem(err.message); });
  }

  function ask(toy, quiz, questions, i, answers) {
    if (i >= questions.length) return submit(toy, quiz, answers);
    var q = questions[i];
    var limit = quiz.timeLimit * 1000;
    var started = Date.now();
    var done = false;

    render(
      '<div class="timer" role="timer" aria-label="Time left"><span class="timer-fill" data-fill></span><span class="timer-text" data-left>' + quiz.timeLimit + 's</span></div>' +
      '<section class="card stack stack--tight">' +
      '<h1 class="title-md">' + esc(q.question) + '</h1></section>' +
      '<div class="stack stack--tight">' + q.options.map(function (o) {
        return '<button type="button" class="choice" aria-pressed="false" data-answer="' + o.id + '"><span class="choice-title">' + esc(o.text) + '</span></button>';
      }).join('') + '</div>',
      'Question ' + (i + 1) + ' of ' + questions.length, 'yellow'
    );

    var fill = ui.app.querySelector('[data-fill]');
    var left = ui.app.querySelector('[data-left]');
    var tick = setInterval(function () {
      var remaining = Math.max(0, limit - (Date.now() - started));
      fill.style.width = (remaining / limit) * 100 + '%';
      fill.classList.toggle('is-low', remaining < 5000);
      left.textContent = Math.ceil(remaining / 1000) + 's';
      if (remaining === 0) finish(null);
    }, 200);

    function finish(choice) {
      if (done) return;
      done = true;
      clearInterval(tick);
      answers[q.id] = choice;
      setTimeout(function () { ask(toy, quiz, questions, i + 1, answers); }, choice == null ? 600 : 250);
      if (choice == null) left.textContent = 'Time is up';
    }

    on('[data-answer]', function (el) {
      if (done) return;
      el.setAttribute('aria-pressed', 'true');
      ui.app.querySelectorAll('[data-answer]').forEach(function (b) { b.disabled = true; });
      finish(Number(el.getAttribute('data-answer')));
    });
  }

  function submit(toy, quiz, answers) {
    render('<p class="text center">Marking your answers…</p>', 'Quiz', 'yellow');
    post('grade', { toy: toy.id, answers: answers }).then(function (result) {
      C.track('quiz_finished', { toy: toy.id, score: result.score, passed: result.passed });
      showResult(toy, answers, result);
    }).catch(function (err) { problem(err.message); });
  }

  function reviewHtml(result) {
    return '<details class="card review"><summary class="title-sm">See your answers (' + result.correct + ' of ' + result.total + ' right)</summary>' +
      '<ol class="review-list">' + result.review.map(function (r) {
        return '<li class="' + (r.correct ? 'is-right' : 'is-wrong') + '"><p class="text text--ink"><strong>' + (r.correct ? '✓ ' : '✗ ') + esc(r.question) + '</strong></p>' +
          (r.correct ? '' : '<p class="small-print">Your answer: ' + esc(r.chosen == null ? 'ran out of time' : r.chosen) + '</p>') +
          '<p class="small-print">Answer: ' + esc(r.answer) + '</p><p class="text">' + esc(r.explain) + '</p></li>';
      }).join('') + '</ol></details>';
  }

  function showResult(toy, answers, result) {
    var progress = Web3Progress.load(window.localStorage);
    if (result.passed) {
      render(
        '<section class="card card--good stack stack--tight">' + peek('celebrating') +
        '<p class="label">You passed!</p><h1 class="title-xl">' + result.score + '%</h1>' +
        '<p class="text text--ink">' + result.correct + ' of ' + result.total + ' right. Your certificate is one step away.</p></section>' +
        '<form class="card stack stack--tight" data-name-form>' +
        '<label class="title-sm" for="cert-name">Your name for the certificate</label>' +
        '<input id="cert-name" class="field" name="name" maxlength="40" autocomplete="name" required value="' + esc(progress.name) + '" />' +
        '<p class="small-print">' + esc(funnel.nameNote) + '</p>' +
        '<button class="btn btn--ink btn--block" type="submit">Get my certificate</button>' +
        '<p class="small-print" data-name-error aria-live="polite"></p></form>' +
        reviewHtml(result) + funnelHtml(),
        'Passed', 'mint'
      );
      bindFunnel();
      site.fx.confetti();
      ui.app.querySelector('[data-name-form]').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = ui.app.querySelector('#cert-name').value.trim();
        var error = ui.app.querySelector('[data-name-error]');
        var button = e.target.querySelector('button');
        if (!name) return;
        button.disabled = true;
        error.textContent = 'Stamping your certificate…';
        post('grade', { toy: toy.id, answers: answers, name: name }).then(function (r) {
          if (!r.certificate) {
            button.disabled = false;
            error.textContent = r.certificateError || 'The certificate could not be made. Please try again.';
            return;
          }
          var before = Web3Progress.rankFor(Web3Progress.count(progress), ranks);
          Web3Progress.addCertificate(progress, r.certificate);
          Web3Progress.save(window.localStorage, progress);
          var after = Web3Progress.rankFor(Web3Progress.count(progress), ranks);
          C.track('certificate_earned', { toy: toy.id, score: r.certificate.score });
          showCertificate(progress.certificates[toy.id], after, after !== before ? after : null);
          site.fx.confetti();
        }).catch(function (err) {
          button.disabled = false;
          error.textContent = err.message;
        });
      });
    } else {
      render(
        '<section class="card card--warning stack stack--tight" data-result>' + peek('worried') +
        '<p class="label">Not quite</p><h1 class="title-xl">' + result.score + '%</h1>' +
        '<p class="text text--ink">' + result.correct + ' of ' + result.total + ' right. You need ' + result.passMark + ' percent to pass. Have another go, the questions come in a new order.</p></section>' +
        '<button type="button" class="btn btn--ink btn--block" data-retry>Retry the quiz</button>' +
        '<button type="button" class="btn btn--block" data-cards>Back to the cards</button>' +
        reviewHtml(result) + funnelHtml(),
        'Try again', 'coral'
      );
      on('[data-retry]', function () { run(toy); });
      on('[data-cards]', ui.backToCards);
      bindFunnel();
      site.fx.wobble(ui.app.querySelector('[data-result]'));
    }
  }

  // ---------- Certificate ----------

  function prettyDate(iso) {
    var d = new Date(iso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function verifyUrl(cert) {
    return (CONFIG.siteUrl || 'https://web3.toys') + '/verify/?code=' + encodeURIComponent(cert.code) + '&name=' + encodeURIComponent(cert.name);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitFont(ctx, text, weight, size, family, maxWidth) {
    do {
      ctx.font = weight + ' ' + size + 'px ' + family;
      size -= 4;
    } while (ctx.measureText(text).width > maxWidth && size > 30);
  }

  function drawCertificate(canvas, cert, rankName) {
    var W = 1600;
    var H = 1000;
    var INK = '#1F1B2E';
    var DISPLAY = "'Fredoka', 'Nunito', sans-serif";
    var BODY = "'Nunito', sans-serif";
    canvas.width = W;
    canvas.height = H;
    var fonts = document.fonts
      ? Promise.all([document.fonts.load('700 60px Fredoka'), document.fonts.load('800 40px Nunito')]).catch(function () {})
      : Promise.resolve();
    var mascot = new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = CELEBRATE;
    });
    return Promise.all([fonts, mascot]).then(function (r) {
      var img = r[1];
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFF8E1';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = INK;
      roundRect(ctx, 64, 64, W - 108, H - 108, 60);
      ctx.fill();
      ctx.fillStyle = '#FFD93D';
      roundRect(ctx, 44, 44, W - 108, H - 108, 60);
      ctx.fill();
      ctx.lineWidth = 12;
      ctx.strokeStyle = INK;
      ctx.stroke();

      ctx.textBaseline = 'top';
      ctx.fillStyle = INK;
      ctx.font = '700 60px ' + DISPLAY;
      ctx.fillText('web3.toys', 120, 110);
      ctx.font = '800 32px ' + BODY;
      var by = 'by BuildWithAki';
      var bw = ctx.measureText(by).width + 56;
      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, W - 120 - bw, 112, bw, 60, 30);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillText(by, W - 120 - bw + 28, 124);

      ctx.font = '800 34px ' + BODY;
      ctx.fillText('CERTIFICATE OF COMPLETION', 120, 230);
      fitFont(ctx, cert.name, '700', 112, DISPLAY, 960);
      ctx.fillText(cert.name, 120, 284);
      ctx.font = '800 38px ' + BODY;
      ctx.fillText('completed', 120, 430);
      fitFont(ctx, cert.title, '600', 64, DISPLAY, 960);
      ctx.fillText(cert.title, 120, 480);

      [['Score', cert.score + '%'], ['Rank', rankName], ['Date', prettyDate(cert.date)]].forEach(function (box, i) {
        var x = 120 + i * 320;
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, x, 620, 296, 140, 26);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '800 28px ' + BODY;
        ctx.fillText(box[0], x + 24, 640);
        fitFont(ctx, box[1], '700', 50, DISPLAY, 250);
        ctx.fillText(box[1], x + 24, 682);
      });

      ctx.font = '800 30px ' + BODY;
      ctx.fillText('Code ' + cert.code, 120, 820);
      ctx.fillText('Check it at web3.toys/verify', 120, 864);

      // Fit the mascot inside a 380 by 380 box, keeping its shape.
      if (img) {
        var k = Math.min(380 / img.width, 380 / img.height);
        var w = img.width * k;
        var h = img.height * k;
        ctx.drawImage(img, W - 120 - 190 - w / 2, H - 110 - h, w, h);
      }
      return canvas;
    });
  }

  function showCertificate(cert, rank, rankUp) {
    var canvas = document.createElement('canvas');
    var link = verifyUrl(cert);
    var text = funnel.shareText.replace('{title}', cert.title).replace('{score}', cert.score).replace('{link}', link);
    var intent = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(link);
    var file = 'web3toys-certificate-' + cert.toy + '.png';

    render(
      '<section class="card card--hero stack stack--tight">' + peek('celebrating') +
      '<p class="label">Certificate earned</p><h1 class="title-lg">' + esc(cert.title) + '</h1>' +
      (rankUp ? '<p class="text text--ink">New rank unlocked: ' + C.rankBadge(rankUp, Web3Progress.level(rankUp, ranks)) + '</p>' : '') +
      '</section>' +
      '<img class="share-preview certificate-preview" data-preview alt="Certificate for ' + esc(cert.name) + ', ' + esc(cert.title) + ', score ' + cert.score + ' percent" />' +
      '<div class="btn-row"><a class="btn btn--ink" data-download download="' + esc(file) + '" href="#">Download PNG</a>' +
      '<a class="btn" data-share href="' + esc(intent) + '" target="_blank" rel="noopener">Share on X</a></div>' +
      '<p class="tip"><strong>Tip:</strong> ' + esc(funnel.shareTip) + '</p>' +
      '<p class="small-print center">Code ' + esc(cert.code) + ' · <a href="' + esc(link) + '">Anyone can check it here</a></p>' +
      '<div class="btn-row"><a class="btn" href="../">All toys</a><a class="btn" href="../progress/">My Progress</a></div>' +
      funnelHtml(),
      'Certificate', 'mint'
    );
    bindFunnel();
    var download = ui.app.querySelector('[data-download]');
    download.addEventListener('click', function (e) {
      if (download.getAttribute('href') === '#') e.preventDefault();
      C.track('certificate_downloaded', { toy: cert.toy });
    });
    ui.app.querySelector('[data-share]').addEventListener('click', function () { C.track('certificate_shared_x', { toy: cert.toy }); });

    drawCertificate(canvas, cert, rank.name).then(function () {
      ui.app.querySelector('[data-preview]').src = canvas.toDataURL('image/png');
      canvas.toBlob(function (blob) {
        if (blob) download.setAttribute('href', URL.createObjectURL(blob));
      }, 'image/png');
    });
  }

  // From My Progress: "View certificate" opens the toy page with #certificate.
  function showSaved(toy) {
    var progress = Web3Progress.load(window.localStorage);
    var cert = progress.certificates[toy.id];
    if (!cert) return false;
    ui = {
      app: document.getElementById('app'),
      pill: document.getElementById('status-pill'),
      backToCards: function () { location.hash = ''; location.reload(); },
    };
    extras().then(function () {
      showCertificate(cert, Web3Progress.rankFor(Web3Progress.count(progress), ranks), null);
    }).catch(function (err) { ui.app.innerHTML = C.loadError(err); });
    return true;
  }

  window.ToyQuiz = { start: start, showSaved: showSaved, drawCertificate: drawCertificate };
})();
