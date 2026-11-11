// A Quest: tap-through lessons, then a 10 question quiz drawn
// from the project's private pool (marked by /api/grade), then a Pro tag and a
// certificate in the project's colours. The course comes from
// data/academy/<id>.json; the page address is course/?id=<id>.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var CONFIG = window.WEB3TOYS_CONFIG || {};
  var app = document.getElementById('app');
  var pill = document.getElementById('status-pill');
  var id = new URLSearchParams(location.search).get('id') || '';
  var store = Academy.load(window.localStorage);
  var course = null;
  var me = null;
  var timer = null;

  if (!/^[a-z0-9-]+$/.test(id)) {
    ended('This course could not be found.');
    return;
  }

  C.loadJson('../../data/academy/' + id + '.json').then(function (c) {
    course = c;
    if (!Academy.visible(c)) return ended('This course has ended.');
    me = Academy.entry(store, id);
    document.title = c.name + ' course · Quests · web3.toys';
    var root = document.documentElement;
    root.style.setProperty('--p', c.colors.primary);
    root.style.setProperty('--a', c.colors.accent);
    root.style.setProperty('--t', c.colors.text);
    var cert = Web3Progress.load(window.localStorage).certificates['academy:' + id];
    if (location.hash === '#certificate' && cert) return showCertificate(cert, false);
    lesson(firstUnseen());
  }).catch(function () { ended('This course could not be found.'); });

  function ended(text) {
    app.innerHTML = '<section class="card stack stack--tight"><h1 class="title-lg">' + esc(text) + '</h1>' +
      '<p class="text">See the courses that are running now.</p><a class="btn btn--ink btn--block" href="../">Back to Quests</a></section>';
  }

  function save() {
    Academy.save(window.localStorage, store);
  }

  function sponsorLine() {
    return '<p class="ac-sponsor-line">Sponsored course by ' + esc(course.name) + '. web3.toys does not endorse any token. Not financial advice.</p>';
  }

  function head() {
    return '<section class="ac-head"><img class="ac-logo" src="../../' + esc(course.logo) + '" alt="" width="56" height="56" />' +
      '<div><p class="ac-head-name">' + esc(course.name) + '</p><p class="small-print ac-head-meta">' + esc(course.chain) + ' · ' + esc(course.category) +
      (course.website ? ' · <a href="' + esc(course.website) + '" target="_blank" rel="noopener">Website</a>' : '') + '</p></div>' +
      '<span class="ac-sponsored">Sponsored</span></section>' + sponsorLine();
  }

  function render(html, pillText) {
    clearInterval(timer);
    app.innerHTML = head() + html + sponsorLine();
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

  function firstUnseen() {
    for (var i = 0; i < course.lessons.length; i++) if (me.seen.indexOf(i) === -1) return i;
    return 0;
  }

  // ---------- Lessons ----------

  function lesson(i) {
    var L = course.lessons[i];
    if (me.seen.indexOf(i) === -1) {
      me.seen.push(i);
      save();
    }
    var n = course.lessons.length;
    var last = i === n - 1;
    render(
      '<div class="ac-progress" role="img" aria-label="Lesson ' + (i + 1) + ' of ' + n + '">' + course.lessons.map(function (_, k) {
        return '<span class="' + (me.seen.indexOf(k) > -1 ? 'is-seen' : '') + (k === i ? ' is-now' : '') + '"></span>';
      }).join('') + '</div>' +
      '<article class="card ac-lesson stack stack--tight">' +
      (L.image ? '<img class="ac-lesson-img" src="../../' + esc(L.image) + '" alt="" />' : '') +
      '<p class="label">Lesson ' + (i + 1) + ' of ' + n + '</p><h1 class="title-lg">' + esc(L.title) + '</h1>' +
      '<p class="text text--ink">' + esc(L.text) + '</p></article>' +
      '<div class="sticky-bar"><div class="btn-row"><button type="button" class="btn" data-back' + (i ? '' : ' disabled') + '>Back</button>' +
      '<button type="button" class="btn btn--ink" data-next>' + (last ? 'Go to the quiz' : 'Next') + '</button></div></div>',
      'Lesson ' + (i + 1) + ' of ' + n
    );
    on('[data-back]', function () { if (i) lesson(i - 1); });
    on('[data-next]', function () { if (last) quizIntro(); else lesson(i + 1); });
  }

  // ---------- Quiz ----------

  function quizIntro() {
    var ready = Academy.allSeen(me, course.lessons.length);
    var wait = Academy.msLeft(me);
    render(
      '<section class="card card--yellow stack stack--tight ac-quiz-intro"><h1 class="title-lg">' + esc(course.name) + ' quiz</h1>' +
      '<ul class="lesson-points"><li>10 questions picked at random.</li><li>20 seconds for each one.</li><li>Score 80% to earn the <strong>' + esc(course.name) + ' Pro</strong> tag and a certificate.</li>' +
      '<li>If you don\'t pass, you can retry after ' + Academy.LOCK_MINUTES + ' minutes.</li></ul></section>' +
      (!ready
        ? '<p class="tip">🔒 Finish every lesson first to unlock the quiz.</p><button type="button" class="btn btn--block" data-lessons>Back to the lessons</button>'
        : wait
          ? '<p class="tip" data-wait>🔒 Next try in <b data-left>' + clock(wait) + '</b>. Use the time to read the lessons again.</p><button type="button" class="btn btn--block" data-lessons>Read the lessons again</button>'
          : '<button type="button" class="btn btn--ink btn--block" data-go>Start the quiz</button><button type="button" class="text-button center" data-lessons>Read the lessons again</button>'),
      'Quiz'
    );
    on('[data-lessons]', function () { lesson(0); });
    on('[data-go]', run);
    if (ready && wait) {
      timer = setInterval(function () {
        var left = Academy.msLeft(me);
        if (!left) return quizIntro();
        var el = app.querySelector('[data-left]');
        if (el) el.textContent = clock(left);
      }, 1000);
    }
  }

  function clock(ms) {
    var s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function problem(text) {
    render('<section class="card card--warning stack stack--tight" role="alert"><h1 class="title-md">The quiz could not load.</h1>' +
      '<p class="text text--ink">' + esc(location.protocol === 'file:' ? 'Quizzes need the website. Open this page through its web address.' : text) + '</p></section>' +
      '<button type="button" class="btn btn--block" data-back>Back</button>', 'Quiz');
    on('[data-back]', quizIntro);
  }

  function run() {
    render('<p class="text center">Loading the questions…</p>', 'Quiz');
    fetch('../../api/quiz?toy=' + encodeURIComponent('academy:' + id)).then(function (r) {
      if (!r.ok) throw new Error('The quiz is not available right now (' + r.status + ').');
      return r.json();
    }).then(function (quiz) {
      C.track('academy_quiz_started', { course: id });
      ask(quiz, Academy.draw(quiz.questions, quiz.draw || 10), 0, {});
    }).catch(function (err) { problem(err.message); });
  }

  function ask(quiz, qs, i, answers) {
    if (i >= qs.length) return submit(answers);
    var q = qs[i];
    var limit = quiz.timeLimit * 1000;
    var started = Date.now();
    var done = false;
    render(
      '<div class="timer" role="timer" aria-label="Time left"><span class="timer-fill" data-fill></span><span class="timer-text" data-left>' + quiz.timeLimit + 's</span></div>' +
      '<section class="card stack stack--tight"><p class="label">Question ' + (i + 1) + ' of ' + qs.length + '</p><h1 class="title-md">' + esc(q.question) + '</h1></section>' +
      '<div class="stack stack--tight">' + q.options.map(function (o) {
        return '<button type="button" class="choice" data-answer="' + o.id + '"><span class="choice-title">' + esc(o.text) + '</span></button>';
      }).join('') + '</div>',
      'Question ' + (i + 1) + ' of ' + qs.length
    );
    var fill = app.querySelector('[data-fill]');
    var left = app.querySelector('[data-left]');
    timer = setInterval(function () {
      var remaining = Math.max(0, limit - (Date.now() - started));
      fill.style.width = (remaining / limit) * 100 + '%';
      fill.classList.toggle('is-low', remaining < 5000);
      left.textContent = Math.ceil(remaining / 1000) + 's';
      if (!remaining) finish(null);
    }, 200);
    function finish(choice) {
      if (done) return;
      done = true;
      clearInterval(timer);
      answers[q.id] = choice;
      setTimeout(function () { ask(quiz, qs, i + 1, answers); }, choice == null ? 600 : 250);
    }
    on('[data-answer]', function (el) {
      app.querySelectorAll('[data-answer]').forEach(function (b) { b.disabled = true; });
      el.setAttribute('aria-pressed', 'true');
      finish(Number(el.getAttribute('data-answer')));
    });
  }

  function post(body) {
    return fetch('../../api/grade', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'The server said ' + r.status); return j; }); });
  }

  function submit(answers) {
    render('<p class="text center">Marking your answers…</p>', 'Quiz');
    post({ toy: 'academy:' + id, answers: answers }).then(function (result) {
      C.track('academy_quiz_finished', { course: id, score: result.score, passed: result.passed });
      if (result.passed) passed(answers, result);
      else failed(result);
    }).catch(function (err) { problem(err.message); });
  }

  function review(result) {
    return '<details class="card review"><summary class="title-sm">See your answers (' + result.correct + ' of ' + result.total + ' right)</summary><ol class="review-list">' +
      result.review.map(function (r) {
        return '<li class="' + (r.correct ? 'is-right' : 'is-wrong') + '"><p class="text text--ink"><strong>' + (r.correct ? '✓ ' : '✗ ') + esc(r.question) + '</strong></p>' +
          (r.correct ? '' : '<p class="small-print">Your answer: ' + esc(r.chosen == null ? 'ran out of time' : r.chosen) + '</p>') +
          '<p class="small-print">Answer: ' + esc(r.answer) + '</p><p class="text">' + esc(r.explain) + '</p></li>';
      }).join('') + '</ol></details>';
  }

  function failed(result) {
    Academy.lock(me);
    save();
    render(
      '<section class="card card--warning stack stack--tight" data-result><p class="label">Not this time</p><h1 class="title-xl">' + result.score + '%</h1>' +
      '<p class="text text--ink">' + result.correct + ' of ' + result.total + ' right. You need ' + result.passMark + '% to pass. You can try again in ' + Academy.LOCK_MINUTES + ' minutes, with new questions.</p></section>' +
      review(result) + '<button type="button" class="btn btn--ink btn--block" data-lessons>Read the lessons again</button>',
      'Try again soon'
    );
    site.fx.wobble(app.querySelector('[data-result]'));
    on('[data-lessons]', function () { lesson(0); });
  }

  function passed(answers, result) {
    var progress = Web3Progress.load(window.localStorage);
    render(
      '<section class="card card--good stack stack--tight"><p class="label">You passed!</p><h1 class="title-xl">' + result.score + '%</h1>' +
      '<p class="text text--ink">Your <strong>' + esc(course.name) + ' Pro</strong> tag and certificate are one step away.</p></section>' +
      '<form class="card stack stack--tight" data-name-form><label class="title-sm" for="cert-name">Your name for the certificate</label>' +
      '<input id="cert-name" class="field" name="name" maxlength="40" autocomplete="name" required value="' + esc(progress.name) + '" />' +
      '<p class="small-print">Your name goes on the certificate and is used to check it. web3.toys does not store it.</p>' +
      '<button class="btn btn--ink btn--block" type="submit">Get my Pro tag</button><p class="small-print" data-err aria-live="polite"></p></form>' +
      review(result),
      'Passed'
    );
    site.fx.confetti();
    app.querySelector('[data-name-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = app.querySelector('#cert-name').value.trim();
      var err = app.querySelector('[data-err]');
      var btn = e.target.querySelector('button');
      if (!name) return;
      btn.disabled = true;
      err.textContent = 'Stamping your certificate…';
      post({ toy: 'academy:' + id, answers: answers, name: name }).then(function (r) {
        if (!r.certificate) {
          btn.disabled = false;
          err.textContent = r.certificateError || 'The certificate could not be made. Please try again.';
          return;
        }
        var cert = r.certificate;
        cert.pro = true;
        cert.project = course.name;
        Web3Progress.addCertificate(progress, cert);
        Web3Progress.save(window.localStorage, progress);
        C.track('academy_pro_earned', { course: id });
        site.coins.award('certificate', 'academy:' + id, 'Earned the ' + cert.title + ' tag');
        showCertificate(progress.certificates['academy:' + id], true);
      }).catch(function (x) {
        btn.disabled = false;
        err.textContent = x.message;
      });
    });
  }

  // ---------- Certificate ----------

  function verifyUrl(cert) {
    return (CONFIG.siteUrl || 'https://web3.toys') + '/verify/?code=' + encodeURIComponent(cert.code) + '&name=' + encodeURIComponent(cert.name);
  }

  function showCertificate(cert, fresh) {
    var link = verifyUrl(cert);
    var text = 'I passed the ' + course.name + ' course on web3.toys and earned my ' + course.name + ' Pro tag (' + cert.score + '%).' +
      (course.x ? ' @' + course.x.replace(/^@/, '') : '') + ' Check it:';
    var intent = 'https://x.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(link);
    var file = 'web3toys-' + id + '-pro.png';
    render(
      '<section class="card card--hero stack stack--tight"><p class="label">' + (fresh ? 'New Pro tag' : 'Your Pro tag') + '</p>' +
      '<h1 class="title-lg"><span class="pro-tag pro-tag--big">' + esc(course.name) + ' Pro</span></h1>' +
      '<p class="text text--ink">It shows on My Progress and counts toward your rank.</p></section>' +
      '<img class="share-preview certificate-preview" data-preview alt="Certificate for ' + esc(cert.name) + ', ' + esc(cert.title) + ', score ' + cert.score + ' percent" />' +
      '<div class="btn-row"><a class="btn btn--ink" data-download download="' + esc(file) + '" href="#">Download PNG</a>' +
      '<a class="btn" href="' + esc(intent) + '" target="_blank" rel="noopener">Share on X</a></div>' +
      '<p class="small-print center">Code ' + esc(cert.code) + ' · <a href="' + esc(link) + '">Anyone can check it here</a></p>' +
      '<div class="btn-row"><a class="btn" href="../">More courses</a><a class="btn" href="../../progress/">My Progress</a></div>',
      'Pro tag'
    );
    var dl = app.querySelector('[data-download]');
    dl.addEventListener('click', function (e) { if (dl.getAttribute('href') === '#') e.preventDefault(); });
    var canvas = document.createElement('canvas');
    draw(canvas, cert).then(function () {
      app.querySelector('[data-preview]').src = canvas.toDataURL('image/png');
      canvas.toBlob(function (blob) { if (blob) dl.setAttribute('href', URL.createObjectURL(blob)); }, 'image/png');
    });
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

  function fit(ctx, text, weight, size, family, max) {
    do {
      ctx.font = weight + ' ' + size + 'px ' + family;
      size -= 4;
    } while (ctx.measureText(text).width > max && size > 28);
  }

  // The certificate in the project's colours, in our cartoon style.
  function draw(canvas, cert) {
    var W = 1600;
    var H = 1000;
    var INK = '#1F1B2E';
    var DISPLAY = "'Fredoka', 'Nunito', sans-serif";
    var BODY = "'Nunito', sans-serif";
    canvas.width = W;
    canvas.height = H;
    var fonts = document.fonts ? Promise.all([document.fonts.load('700 60px Fredoka'), document.fonts.load('800 40px Nunito')]).catch(function () {}) : Promise.resolve();
    var logo = new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = '../../' + course.logo;
    });
    var mark = new Promise(function (resolve) {
      var m = new Image();
      m.onload = function () { resolve(m); };
      m.onerror = function () { resolve(null); };
      m.src = window.WEB3TOYS.iconSrc(true);
    });
    return Promise.all([fonts, logo, mark]).then(function (r) {
      var img = r[1];
      var icon = r[2];
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = course.colors.primary;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = INK;
      roundRect(ctx, 64, 64, W - 108, H - 108, 60);
      ctx.fill();
      ctx.fillStyle = '#FFF8E1';
      roundRect(ctx, 44, 44, W - 108, H - 108, 60);
      ctx.fill();
      ctx.lineWidth = 12;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.textBaseline = 'top';
      ctx.fillStyle = INK;
      ctx.font = '700 52px ' + DISPLAY;
      // The hexagon 3 icon, then the site name.
      if (icon) ctx.drawImage(icon, 110, 94, 84, 84);
      ctx.fillText('web3.toys · Quests', icon ? 204 : 120, 110);
      ctx.font = '800 32px ' + BODY;
      ctx.fillText('CERTIFICATE OF COMPLETION', 120, 210);
      fit(ctx, cert.name, '700', 108, DISPLAY, 900);
      ctx.fillText(cert.name, 120, 260);
      ctx.font = '800 36px ' + BODY;
      ctx.fillText('passed the course and earned', 120, 400);
      // The Pro tag, in the project's colours.
      fit(ctx, cert.title, '700', 64, DISPLAY, 900);
      var tw = ctx.measureText(cert.title).width + 70;
      ctx.fillStyle = course.colors.primary;
      roundRect(ctx, 120, 460, tw, 100, 50);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = course.colors.accent;
      ctx.fillText(cert.title, 155, 478);
      [['Score', cert.score + '%'], ['Date', cert.date]].forEach(function (b, i) {
        var x = 120 + i * 330;
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, x, 620, 300, 130, 26);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '800 28px ' + BODY;
        ctx.fillText(b[0], x + 24, 640);
        fit(ctx, b[1], '700', 48, DISPLAY, 250);
        ctx.fillText(b[1], x + 24, 680);
      });
      ctx.font = '800 28px ' + BODY;
      ctx.fillText('Code ' + cert.code + '  ·  Check it at web3.toys/verify', 120, 790);
      ctx.font = '700 22px ' + BODY;
      ctx.fillStyle = '#5A5470';
      ctx.fillText('Sponsored course by ' + course.name + '. web3.toys does not endorse any token. Not financial advice.', 120, 850);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(W - 300, 330, 170, 0, Math.PI * 2);
        ctx.fillStyle = course.colors.primary;
        ctx.fill();
        ctx.lineWidth = 10;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.drawImage(img, W - 440, 190, 280, 280);
        ctx.restore();
      }
      return canvas;
    });
  }
})();
