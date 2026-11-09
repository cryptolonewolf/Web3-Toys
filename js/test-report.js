// The Test Your Product report, used by the sample on /test-your-product/
// (made-up data) and by the report builder in admin (real runs).
//   Web3TestReport.build(test, runs) -> numbers per task
//   Web3TestReport.html(test, runs, { sample, shot(path) -> url })
//   Web3TestReport.print(html) prints it as a branded PDF (browser print)

(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function secs(n) {
    if (!(n > 0)) return '-';
    var m = Math.floor(n / 60), s = Math.round(n % 60);
    return m ? m + ' min ' + (s ? s + ' s' : '') : s + ' s';
  }

  function build(test, runs) {
    var sent = runs.filter(function (r) { return r.status !== 'started' && r.status !== 'rejected'; });
    var tasks = (test.tasks || []).map(function (t, i) {
      var rows = sent.map(function (r, n) { var x = (r.results || [])[i] || {}; x.tester = n + 1; return x; }).filter(function (x) { return x.outcome; });
      var done = rows.filter(function (x) { return x.outcome === 'done'; });
      var avg = function (list, k) { return list.length ? list.reduce(function (s, x) { return s + Number(x[k] || 0); }, 0) / list.length : 0; };
      return {
        title: t.title,
        total: rows.length,
        done: done.length,
        stuck: rows.filter(function (x) { return x.outcome === 'stuck'; }).length,
        gaveUp: rows.filter(function (x) { return x.outcome === 'gave_up'; }).length,
        rate: rows.length ? Math.round(done.length / rows.length * 100) : 0,
        time: avg(done, 'seconds'),
        rating: avg(rows, 'rating'),
        comments: rows.filter(function (x) { return x.comment; }).map(function (x) { return { tester: x.tester, outcome: x.outcome, text: x.comment, shot: x.shot }; }),
      };
    });
    var all = tasks.reduce(function (s, t) { return { total: s.total + t.total, done: s.done + t.done }; }, { total: 0, done: 0 });
    return { testers: sent.length, tasks: tasks, rate: all.total ? Math.round(all.done / all.total * 100) : 0,
      rating: tasks.length ? tasks.reduce(function (s, t) { return s + t.rating; }, 0) / tasks.length : 0,
      worst: tasks.slice().sort(function (a, b) { return a.rate - b.rate; })[0] };
  }

  var WORD = { done: 'Done', stuck: 'Stuck', gave_up: 'Gave up' };

  function html(test, runs, opts) {
    opts = opts || {};
    var R = build(test, runs);
    return '<article class="trep">' +
      (opts.sample ? '<p class="trep-sample">Sample report · made-up data for illustration</p>' : '') +
      '<header class="trep-head"><p class="label">web3.toys test report</p><h2 class="title-lg">' + esc(test.project) + ': ' + esc(test.title) + '</h2>' +
      '<p class="small-print">' + R.testers + (R.testers === 1 ? ' tester · ' : ' testers · ') + (test.tasks || []).length + ' tasks' + (test.network_note ? ' · ' + esc(test.network_note) : '') + '</p></header>' +
      '<ul class="trep-kpis"><li><b>' + R.rate + '%</b><span>tasks completed</span></li><li><b>' + (R.rating ? R.rating.toFixed(1) : '-') + ' / 5</b><span>average rating</span></li>' +
      '<li><b>' + R.testers + '</b><span>testers</span></li><li><b>' + esc(R.worst ? R.worst.title : '-') + '</b><span>hardest task</span></li></ul>' +
      R.tasks.map(function (t, i) {
        return '<section class="trep-task"><h3 class="title-sm">' + (i + 1) + '. ' + esc(t.title) + '</h3>' +
          '<div class="trep-bar" role="img" aria-label="' + t.rate + ' percent completed"><span class="is-done" style="width:' + (t.total ? t.done / t.total * 100 : 0) + '%"></span><span class="is-stuck" style="width:' + (t.total ? t.stuck / t.total * 100 : 0) + '%"></span><span class="is-gave" style="width:' + (t.total ? t.gaveUp / t.total * 100 : 0) + '%"></span></div>' +
          '<p class="small-print">✅ ' + t.done + ' done (' + t.rate + '%) · 😕 ' + t.stuck + ' stuck · 🏳️ ' + t.gaveUp + ' gave up · ⏱️ ' + secs(t.time) + ' on average · ⭐ ' + (t.rating ? t.rating.toFixed(1) : '-') + '</p>' +
          (t.comments.length ? '<ul class="trep-comments">' + t.comments.map(function (c) {
            var shot = c.shot && opts.shot ? opts.shot(c.shot) : '';
            return '<li><span class="chip">Tester ' + c.tester + ' · ' + WORD[c.outcome] + '</span> "' + esc(c.text) + '"' + (shot ? '<a href="' + esc(shot) + '" target="_blank" rel="noopener"><img class="trep-shot" src="' + esc(shot) + '" alt="Screenshot from tester ' + c.tester + '" loading="lazy" /></a>' : '') + '</li>';
          }).join('') + '</ul>' : '') + '</section>';
      }).join('') +
      '<footer class="trep-foot small-print">Testers used testnets or fresh empty wallets only. Report by web3.toys · Build With Aki</footer></article>';
  }

  function print(body) {
    var sheet = document.getElementById('print-sheet') || document.createElement('div');
    sheet.id = 'print-sheet';
    sheet.className = 'print-sheet';
    sheet.innerHTML = '<div class="print-brand"><img src="' + ((window.WEB3TOYS && window.WEB3TOYS.iconSrc) ? window.WEB3TOYS.iconSrc() : '') + '" alt="" width="40" height="40" /><b>web3.toys</b></div>' + body;
    document.body.appendChild(sheet);
    document.body.classList.add('is-printing');
    setTimeout(function () {
      window.print();
      setTimeout(function () { document.body.classList.remove('is-printing'); }, 500);
    }, 300);
  }

  window.Web3TestReport = { build: build, html: html, print: print };
})();
