// /testers/: become a tester and run product tests (Test Your Product).
// Words: data/business/testers_page.json. Rank and coins: test_tiers.json.
// Database: supabase/016_tests.sql (join_testers, open_tests, start_test,
// submit_test, my_test_runs). Screenshots go to the private test-shots
// bucket. Answers are saved on this device while you test.
// Safety: testnets or fresh empty wallets only; comments that look like a
// recovery phrase or private key are refused here and in the database.

(function () {
  var C = window.Web3Common;
  var esc = C.esc;
  var site = window.WEB3TOYS;
  var app = document.getElementById('app');
  var P, T, A, profile, certs = 0;
  var NETWORKS = [['ethereum', 'Ethereum'], ['base', 'Base'], ['arbitrum', 'Arbitrum'], ['optimism', 'Optimism'], ['polygon', 'Polygon'], ['bnb', 'BNB Chain'], ['solana', 'Solana'], ['tron', 'Tron']];
  var SEED = /([a-z]{3,8} ){11,}[a-z]{3,8}/;
  var KEY = /[0-9a-f]{64}/;
  var MAX_SHOT = 2 * 1024 * 1024;

  function money(n) { var f = Number(n) % 1 ? 2 : 0; return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f }); }
  function store(id) { return 'web3toys.testRun.' + id + '.v1'; }
  function load(id) { try { return JSON.parse(localStorage.getItem(store(id))) || {}; } catch (e) { return {}; } }
  function keep(id, v) { try { localStorage.setItem(store(id), JSON.stringify(v)); } catch (e) { /* private mode */ } }
  function looksSecret(t) { var s = String(t || '').toLowerCase(); return SEED.test(s) || KEY.test(s); }
  function must(r) { if (r.error) throw r.error; return r.data; }

  if (!site.businessOn()) {
    app.innerHTML = '<section class="card card--hero stack stack--tight"><p class="label">For players</p><h1 class="title-lg">Become a tester</h1>' +
      '<p class="text text--ink">Coming in December: test new web3 products before they launch and get paid for your work.</p>' +
      '<a class="btn btn--ink" href="../">Play the toys meanwhile</a></section>';
    return;
  }

  Promise.all([C.loadJson('../data/business/testers_page.json'), C.loadJson('../data/business/test_tiers.json')]).then(function (r) {
    P = r[0]; T = r[1];
    var go = function () { A = window.Web3Auth; A.onChange(function () { refresh(); }); };
    if (window.Web3Auth) go(); else { document.addEventListener('web3auth:ready', go, { once: true }); shell('<p class="text">Loading…</p>'); }
  }).catch(function (err) { app.innerHTML = C.loadError(err); });

  function head() {
    return '<section class="biz-hero stack stack--tight"><p class="label">For players</p><h1 class="biz-title">' + esc(P.title) + '</h1><p class="text text--ink">' + esc(P.intro) + '</p></section>' +
      '<ul class="perk-grid">' + P.perks.map(function (b) {
        return '<li><div class="card perk"><span class="icon-badge" aria-hidden="true">' + b.icon + '</span><div class="stack stack--tight"><h3 class="title-sm">' + esc(b.title) + '</h3><p class="text">' + esc(b.text) + '</p></div></div></li>';
      }).join('') + '</ul>';
  }
  function shell(body, bare) { app.innerHTML = (bare ? '' : head()) + '<div class="stack" data-body>' + body + '</div>'; return app.querySelector('[data-body]'); }

  function refresh() {
    if (!A.user()) {
      var b = shell('<section class="card stack stack--tight"><p class="text">' + esc(P.rankLine.replace('{n}', minCerts())) + '</p><button type="button" class="btn btn--ink" data-login>Log in to start</button></section>');
      b.querySelector('[data-login]').addEventListener('click', function () { A.open('Log in to become a tester.'); });
      return;
    }
    Promise.all([
      A.client.from('certificates').select('toy').then(must),
      A.client.from('tester_profiles').select('network,token,wallet').maybeSingle().then(must),
    ]).then(function (r) {
      certs = r[0].length;
      profile = r[1];
      if (!profile) return joinForm();
      home();
    }).catch(function (err) { shell(C.loadError(err)); });
  }

  function minCerts() { return 2; } // Explorer, see tests/business.test.mjs (kept in step with ranks.json and 016_tests.sql)

  // ---------- Join ----------
  function joinForm() {
    if (certs < minCerts()) {
      shell('<section class="card stack stack--tight"><h2 class="title-md">🔒 ' + esc(P.rankLine.replace('{n}', minCerts())) + '</h2>' +
        '<p class="text">You have ' + certs + ' of ' + minCerts() + '. Finish toys to earn certificates.</p><a class="btn btn--ink" href="../">Play a toy</a></section>');
      return;
    }
    var b = shell('<form class="card stack biz-form tst-join" novalidate><h2 class="title-md">' + esc(P.joinTitle) + '</h2><p class="small-print">' + esc(P.joinLine) + '</p>' +
      '<div class="stack stack--tight"><label class="label" for="tj-net">Network</label><select class="field" id="tj-net">' + NETWORKS.map(function (n) { return '<option value="' + n[0] + '">' + n[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="stack stack--tight"><label class="label" for="tj-token">Stablecoin</label><select class="field" id="tj-token"><option>USDC</option><option>USDT</option></select></div>' +
      '<div class="stack stack--tight"><label class="label" for="tj-wallet">Your wallet address (public address only)</label><input class="field" id="tj-wallet" maxlength="64" autocomplete="off" spellcheck="false" /></div>' +
      P.agree.map(function (a, i) { return '<label class="mk-check"><input type="checkbox" data-agree="' + i + '" /> <span>' + esc(a) + '</span></label>'; }).join('') +
      '<button type="submit" class="btn btn--ink btn--block">Join as a tester</button><p class="small-print" data-msg aria-live="polite"></p>' +
      '<p class="small-print">Read the <a href="../terms/#testers">tester terms</a> and <a href="../privacy/#testers">how we store your wallet address</a>.</p></form>');
    var f = b.querySelector('form');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = f.querySelector('[data-msg]');
      var w = f.querySelector('#tj-wallet').value.trim();
      if (looksSecret(w) || /\s/.test(w)) { msg.textContent = 'That looks like a recovery phrase or private key. Never share those. Paste your public address only.'; return; }
      if (!w) { msg.textContent = 'Paste your wallet address.'; return; }
      if (Array.prototype.some.call(f.querySelectorAll('[data-agree]'), function (c) { return !c.checked; })) { msg.textContent = 'Please tick every box.'; return; }
      msg.textContent = 'Joining…';
      A.client.rpc('join_testers', { p_network: f.querySelector('#tj-net').value, p_token: f.querySelector('#tj-token').value, p_wallet: w, p_agree: true })
        .then(must).then(function () { if (site.log) site.log('request', 'tester-join'); refresh(); })
        .catch(function (err) { msg.textContent = err.message; });
    });
  }

  // ---------- Home: open tests and my runs ----------
  function home() {
    var b = shell('<section class="stack stack--tight"><h2 class="section-title">Open tests</h2><div data-open><p class="small-print">Loading…</p></div></section>' +
      '<section class="stack stack--tight"><h2 class="section-title">Your tests and payouts</h2><div data-runs></div></section>' +
      '<details class="card"><summary><b>Your payout wallet</b></summary><p class="small-print">' + esc(profile.token) + ' on ' + esc((NETWORKS.filter(function (n) { return n[0] === profile.network; })[0] || [0, profile.network])[1]) + ': <code>' + esc(profile.wallet) + '</code></p>' +
      '<button type="button" class="btn btn--small" data-change>Change wallet</button></details>');
    b.querySelector('[data-change]').addEventListener('click', function () { certs = Math.max(certs, minCerts()); joinForm(); });
    A.client.rpc('open_tests').then(must).then(function (rows) {
      var el = b.querySelector('[data-open]');
      if (!rows.length) { el.innerHTML = '<p class="text">No open tests right now. New tests appear here, usually a few each month.</p>'; return; }
      el.innerHTML = '<ul class="tst-list">' + rows.map(function (t) {
        var st = t.my_status;
        return '<li class="card stack stack--tight"><div class="cap-row"><b>' + esc(t.project) + ': ' + esc(t.title) + '</b>' + (st ? '<span class="chip is-mint">' + esc(P.statuses[st] || st) + '</span>' : '') + '</div>' +
          (t.intro ? '<p class="text">' + esc(t.intro) + '</p>' : '') +
          '<p class="small-print">' + (t.tasks || []).length + ' tasks · about ' + t.minutes + ' min · ' + money(t.reward_usd) + ' in stablecoins + ' + t.coins + ' coins if approved · ' + t.spots_left + ' spots left' + (t.network_note ? ' · ' + esc(t.network_note) : '') + '</p>' +
          (!st && t.spots_left > 0 ? '<button type="button" class="btn btn--ink btn--small" data-start="' + esc(t.id) + '">Start this test</button>' : '') +
          (st === 'started' ? '<button type="button" class="btn btn--ink btn--small" data-start="' + esc(t.id) + '">Continue</button>' : '') + '</li>';
      }).join('') + '</ul>';
      el.querySelectorAll('[data-start]').forEach(function (btn) {
        btn.addEventListener('click', function () { var t = rows.filter(function (x) { return x.id === btn.getAttribute('data-start'); })[0]; t.my_status === 'started' ? begin(t, {}) : safety(t); });
      });
    }).catch(function (err) { b.querySelector('[data-open]').innerHTML = C.loadError(err); });
    A.client.rpc('my_test_runs').then(must).then(function (rows) {
      var el = b.querySelector('[data-runs]');
      if (!rows.length) { el.innerHTML = '<p class="small-print">Nothing yet. Your tests and payouts will show here.</p>'; return; }
      el.innerHTML = '<ul class="tst-list">' + rows.map(function (r) {
        var pay = r.status === 'approved' ? (r.paid_at ? 'Paid ' + money(r.owed_usd) + (r.paid_tx ? ' · <a href="' + esc(r.paid_tx) + '" target="_blank" rel="noopener">see transaction</a>' : '') : money(r.owed_usd || 0) + ' owed, paid within 14 days') : '';
        return '<li class="card stack stack--tight"><div class="cap-row"><b>' + esc(r.project) + ': ' + esc(r.title) + '</b><span class="chip ' + (r.status === 'rejected' ? 'is-white' : 'is-mint') + '">' + esc(P.statuses[r.status] || r.status) + '</span></div>' +
          (pay ? '<p class="small-print">💵 ' + pay + '</p>' : '') + '</li>';
      }).join('') + '</ul>';
    }).catch(function () {});
  }

  // ---------- Safety ticks before a test ----------
  function safety(t) {
    var b = shell('<section class="card biz-safe stack tst-safety"><h2 class="title-md">🛡️ ' + esc(P.safetyTitle) + '</h2><p class="text"><b>' + esc(t.project) + ': ' + esc(t.title) + '</b></p>' +
      P.safety.map(function (s) { return '<label class="mk-check"><input type="checkbox" data-safe="' + esc(s.id) + '" /> <span>' + esc(s.text) + '</span></label>'; }).join('') +
      '<div class="btn-row"><button type="button" class="btn btn--ink" data-go disabled>Start the test</button><button type="button" class="btn" data-back>Back</button></div><p class="small-print" data-msg aria-live="polite"></p></section>', true);
    var boxes = b.querySelectorAll('[data-safe]');
    var go = b.querySelector('[data-go]');
    boxes.forEach(function (c) { c.addEventListener('change', function () { go.disabled = Array.prototype.some.call(boxes, function (x) { return !x.checked; }); }); });
    b.querySelector('[data-back]').addEventListener('click', refresh);
    go.addEventListener('click', function () {
      var s = {};
      boxes.forEach(function (c) { s[c.getAttribute('data-safe')] = c.checked; });
      go.disabled = true;
      A.client.rpc('start_test', { p_test: t.id, p_safety: s }).then(must).then(function () { begin(t, s); })
        .catch(function (err) { go.disabled = false; b.querySelector('[data-msg]').textContent = err.message; });
    });
  }

  // ---------- The run: one task at a time ----------
  function begin(t) {
    A.client.from('test_runs').select('id,status').eq('test_id', t.id).maybeSingle().then(must).then(function (run) {
      if (!run || run.status !== 'started') return refresh();
      var S = load(run.id);
      S.results = S.results || [];
      var tasks = t.tasks || [];
      var i = Math.min(S.at || 0, tasks.length);
      var timer, startAt;

      function finish() {
        var b = shell('<section class="card stack"><h2 class="title-md">Check and send</h2><ol class="tst-review">' + tasks.map(function (task, n) {
          var x = S.results[n] || {};
          return '<li><b>' + esc(task.title) + '</b><span class="small-print">' + esc(P.outcomes[x.outcome] || '-') + ' · ' + (x.rating || '-') + '/5' + (x.shot ? ' · 📷' : '') + '</span></li>';
        }).join('') + '</ol><div class="btn-row"><button type="button" class="btn btn--ink" data-send>Send my test</button><button type="button" class="btn" data-edit>Change an answer</button></div><p class="small-print" data-msg aria-live="polite"></p></section>', true);
        b.querySelector('[data-edit]').addEventListener('click', function () { i = 0; S.at = 0; keep(run.id, S); step(); });
        b.querySelector('[data-send]').addEventListener('click', function (e) {
          e.target.disabled = true;
          var out = tasks.map(function (task, n) { var x = S.results[n] || {}; var o = { task: task.id, outcome: x.outcome, seconds: Math.round(x.seconds || 0), rating: x.rating, comment: x.comment || '' }; if (x.shot) o.shot = x.shot; return o; });
          A.client.rpc('submit_test', { p_run: run.id, p_results: out }).then(must).then(function () {
            try { localStorage.removeItem(store(run.id)); } catch (err) { /* private mode */ }
            if (site.log) site.log('request', 'tester-submit');
            var d = shell('<section class="card card--yellow stack stack--tight"><h2 class="title-md">✅ Sent, thank you!</h2><p class="text">The team reviews every test. Once approved you get ' + t.coins + ' coins and ' + money(t.reward_usd) + ' in ' + esc(profile.token) + ' to your wallet.</p><button type="button" class="btn btn--ink" data-home>Back to tests</button></section>');
            d.querySelector('[data-home]').addEventListener('click', refresh);
          }).catch(function (err) { e.target.disabled = false; b.querySelector('[data-msg]').textContent = err.message; });
        });
      }

      function step() {
        clearInterval(timer);
        if (i >= tasks.length) return finish();
        var task = tasks[i];
        var x = S.results[i] = S.results[i] || {};
        startAt = Date.now() - (x.seconds || 0) * 1000;
        var b = shell('<section class="card stack tst-run"><p class="label">' + esc(t.project) + ' · task ' + (i + 1) + ' of ' + tasks.length + '</p>' +
          '<div class="tst-progress" aria-hidden="true"><span style="width:' + Math.round(i / tasks.length * 100) + '%"></span></div>' +
          '<h2 class="title-md">' + esc(task.title) + '</h2>' + (task.hint ? '<p class="text">' + esc(task.hint) + '</p>' : '') +
          '<div class="cap-row"><a class="btn btn--small" href="' + esc(t.url) + '" target="_blank" rel="noopener">Open ' + esc(t.project) + ' ↗</a><span class="tst-timer" data-timer aria-live="off">0:00</span></div>' +
          '<p class="small-print">🛡️ Testnet or empty wallet only. If anything asks for a recovery phrase, stop and choose Gave up.</p>' +
          '<fieldset class="tst-outcome"><legend class="label">How did it go?</legend>' + ['done', 'stuck', 'gave_up'].map(function (o) {
            return '<button type="button" class="btn btn--small' + (x.outcome === o ? ' btn--ink' : '') + '" data-out="' + o + '" aria-pressed="' + (x.outcome === o) + '">' + esc(P.outcomes[o]) + '</button>';
          }).join('') + '</fieldset>' +
          '<fieldset class="tst-stars"><legend class="label">How easy was it? (1 = very hard, 5 = very easy)</legend>' + [1, 2, 3, 4, 5].map(function (n) {
            return '<button type="button" class="tst-star' + (x.rating >= n ? ' is-on' : '') + '" data-star="' + n + '" aria-label="' + n + ' of 5" aria-pressed="' + (x.rating === n) + '">★</button>';
          }).join('') + '</fieldset>' +
          '<div class="stack stack--tight"><label class="label" for="tr-c">Comment <span class="small-print">(optional)</span></label><textarea class="field field--area" id="tr-c" rows="3" maxlength="1000" placeholder="' + esc(P.commentHint) + '">' + esc(x.comment || '') + '</textarea></div>' +
          '<div class="stack stack--tight"><label class="label" for="tr-shot">Screenshot <span class="small-print">(optional, PNG or JPG, up to 2 MB; hide any personal details)</span></label><input type="file" id="tr-shot" accept="image/png,image/jpeg" />' + (x.shot ? '<p class="small-print">📷 Screenshot added.</p>' : '') + '</div>' +
          '<div class="btn-row"><button type="button" class="btn btn--ink" data-next>' + (i + 1 < tasks.length ? 'Next task' : 'Finish') + '</button>' + (i ? '<button type="button" class="btn" data-prev>Back</button>' : '') + '</div>' +
          '<p class="small-print" data-msg aria-live="polite"></p></section>', true);
        var msg = b.querySelector('[data-msg]');
        var clock = b.querySelector('[data-timer]');
        var tick = function () { var s = Math.floor((Date.now() - startAt) / 1000); clock.textContent = Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); };
        tick();
        timer = setInterval(tick, 1000);
        var save = function () { x.seconds = (Date.now() - startAt) / 1000; x.comment = b.querySelector('#tr-c').value; S.at = i; keep(run.id, S); };
        b.querySelectorAll('[data-out]').forEach(function (o) { o.addEventListener('click', function () { x.outcome = o.getAttribute('data-out'); save(); b.querySelectorAll('[data-out]').forEach(function (y) { var on = y === o; y.classList.toggle('btn--ink', on); y.setAttribute('aria-pressed', on); }); }); });
        b.querySelectorAll('[data-star]').forEach(function (o) { o.addEventListener('click', function () { x.rating = Number(o.getAttribute('data-star')); save(); b.querySelectorAll('[data-star]').forEach(function (y) { y.classList.toggle('is-on', Number(y.getAttribute('data-star')) <= x.rating); y.setAttribute('aria-pressed', Number(y.getAttribute('data-star')) === x.rating); }); }); });
        b.querySelector('#tr-c').addEventListener('input', save);
        b.querySelector('#tr-shot').addEventListener('change', function (e) {
          var file = e.target.files[0];
          if (!file) return;
          if (!/^image\/(png|jpeg)$/.test(file.type)) { msg.textContent = 'Please use a PNG or JPG.'; e.target.value = ''; return; }
          if (file.size > MAX_SHOT) { msg.textContent = 'That screenshot is over 2 MB. Crop it or save it as JPG.'; e.target.value = ''; return; }
          var path = A.user().id + '/' + t.id + '/' + String(task.id).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20) + '-' + Math.random().toString(36).slice(2, 10) + (file.type === 'image/png' ? '.png' : '.jpg');
          msg.textContent = 'Uploading…';
          A.client.storage.from('test-shots').upload(path, file, { contentType: file.type }).then(function (r) {
            if (r.error) throw r.error;
            x.shot = path; save(); msg.textContent = '📷 Screenshot added.';
          }).catch(function (err) { msg.textContent = 'Could not upload: ' + err.message; });
        });
        b.querySelector('[data-next]').addEventListener('click', function () {
          save();
          if (!x.outcome) { msg.textContent = 'Choose Done, Stuck or Gave up.'; return; }
          if (!x.rating) { msg.textContent = 'Rate it from 1 to 5.'; return; }
          if (looksSecret(x.comment)) { msg.textContent = 'Your comment looks like a recovery phrase or private key. Never share those. Please remove it.'; return; }
          i += 1; S.at = i; keep(run.id, S); step();
        });
        var prev = b.querySelector('[data-prev]');
        if (prev) prev.addEventListener('click', function () { save(); i -= 1; S.at = i; keep(run.id, S); step(); });
        b.scrollIntoView({ block: 'start' });
      }
      step();
    }).catch(function (err) { shell(C.loadError(err)); });
  }
})();
